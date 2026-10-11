import { describe, expect, it } from 'vitest'
import { computeLayout, furnishedBox, idleSpots, lPath, meetingSeats, pathFromDoor, seatPoint, type OfficeLayout, type XZ } from './layout'
import { createMockState } from './mockState'

describe('render layout', () => {
  it('mock states are JSON-serializable for every stage', () => {
    for (const st of [0, 1, 2, 3, 4, 5, 6] as const) {
      const s = createMockState(st)
      expect(JSON.parse(JSON.stringify(s))).toEqual(JSON.parse(JSON.stringify(s)))
      expect(s.office.slots.some((x) => x.id === 'founder')).toBe(true)
    }
  })

  it('ring bands nest outward and lock state follows rings[]', () => {
    const s = createMockState(3)
    const L = computeLayout(s.office.slots, s.office.rings, 3)
    for (let i = 1; i < L.bands.length; i++) {
      const a = L.bands[i - 1]!.box
      const b = L.bands[i]!.box
      expect(b.minX).toBeLessThanOrEqual(a.minX)
      expect(b.maxZ).toBeGreaterThanOrEqual(a.maxZ)
    }
    expect(L.bands[L.bands.length - 1]!.unlocked).toBe(false)
    expect(L.lounge.length).toBeGreaterThan(0)
  })

  it('handles an empty office', () => {
    const L = computeLayout([], [], 6)
    expect(L.bands).toHaveLength(0)
    expect(L.bounds.maxX).toBeGreaterThan(L.bounds.minX)
  })

  it('L paths end at the target', () => {
    const p = lPath([0, 0], [2, 3])
    expect(p[p.length - 1]).toEqual([2, 3])
  })

  it('ring 1 keeps a walkway gap from the founder desk', () => {
    const s = createMockState(3)
    const L = computeLayout(s.office.slots, s.office.rings, 3)
    const f = L.itemCenter.get('founder')!.pos
    for (const slot of s.office.slots.filter((x) => x.ring === 1)) {
      const p = L.slotWorld.get(slot.id)!
      expect(Math.max(Math.abs(p[0] - f[0]), Math.abs(p[1] - f[1]))).toBeGreaterThan(2)
    }
  })

  it('paths from the door walk around furniture', () => {
    const hits = (L: OfficeLayout, a: XZ, b: XZ) => {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05)
      for (let k = 0; k <= n; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / n
        const z = a[1] + ((b[1] - a[1]) * k) / n
        if (L.obstacles.some((o) => x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ)) return true
      }
      return false
    }
    for (const st of [1, 3, 5] as const) {
      const s = createMockState(st)
      const L = computeLayout(s.office.slots, s.office.rings, st)
      expect(L.obstacles.length).toBeGreaterThan(0)
      for (const [, c] of L.itemCenter) {
        // Stand spot just in front of each item (like a visitor would).
        const target: XZ = [c.pos[0] + Math.sin(c.yaw) * 0.6 * 1.5, c.pos[1] + Math.cos(c.yaw) * 0.6 * 1.5]
        const path = pathFromDoor(target, L)
        // Every leg except the final step onto the target stays off furniture.
        for (let i = 0; i < path.length - 2; i++) expect(hits(L, path[i]!, path[i + 1]!)).toBe(false)
      }
    }
  })

  it('columns never stand on a slot cell', () => {
    for (const st of [3, 4, 5] as const) {
      const s = createMockState(st)
      const L = computeLayout(s.office.slots, s.office.rings, st)
      for (const c of L.columns) {
        for (const p of L.slotWorld.values()) expect(Math.max(Math.abs(p[0] - c[0]), Math.abs(p[1] - c[1]))).toBeGreaterThanOrEqual(1.1)
      }
    }
  })

  const inBox = (L: OfficeLayout, p: XZ, pad = 0) => L.obstacles.some((o) => p[0] > o.minX - pad && p[0] < o.maxX + pad && p[1] > o.minZ - pad && p[1] < o.maxZ + pad)

  it('idle spots: at least 8, off furniture, off the door lane, spaced apart', () => {
    for (const st of [0, 1, 2, 3, 4, 5, 6] as const) {
      const s = createMockState(st)
      const L = computeLayout(s.office.slots, s.office.rings, st)
      const spots = idleSpots(L)
      expect(spots.length).toBeGreaterThanOrEqual(8)
      const f = L.slotWorld.get('founder')!
      const fs = seatPoint(f, s.office.slots.find((x) => x.id === 'founder')!.rotation)
      for (const p of spots) {
        expect(inBox(L, p)).toBe(false)
        // Not on the straight door → founder seat segment.
        const [ax, az] = L.door.inside
        const vx = fs[0] - ax
        const vz = fs[1] - az
        const t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - az) * vz) / (vx * vx + vz * vz)))
        expect(Math.hypot(p[0] - (ax + vx * t), p[1] - (az + vz * t))).toBeGreaterThanOrEqual(0.6)
        expect(p[0]).toBeGreaterThan(L.walkBox.minX)
        expect(p[0]).toBeLessThan(L.walkBox.maxX)
      }
      for (let i = 0; i < spots.length; i++)
        for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i]![0] - spots[j]![0], spots[i]![1] - spots[j]![1])).toBeGreaterThanOrEqual(0.55)
    }
  })

  it('lounge spots turn with their item, stay clear of it and face it', () => {
    for (const st of [2, 3, 4, 5] as const) {
      const s = createMockState(st)
      const L = computeLayout(s.office.slots, s.office.rings, st)
      expect(L.loungeYaw).toHaveLength(L.lounge.length)
      for (const p of L.lounge) expect(inBox(L, p)).toBe(false)
    }
    // A common item rotated 90°: its lounge spots sit on its rotated front, not on +z of the world.
    const s = createMockState(2)
    const common = s.office.slots.find((x) => x.type === 'common' && x.itemId && !x.spanOf)!
    const turned = s.office.slots.map((x) => (x.id === common.id ? { ...x, rotation: 1 as const } : x))
    const L = computeLayout(turned, s.office.rings, 2)
    const c = L.itemCenter.get(common.id)!
    const near = L.lounge.filter((p) => Math.hypot(p[0] - c.pos[0], p[1] - c.pos[1]) < 2)
    expect(near.length).toBe(2)
    for (const p of near) {
      // Front of a rotation-1 item is world +x / −x (yaw −90°): the offset along x is the 0.45 cell push.
      const fx = Math.sin(c.yaw)
      const fz = Math.cos(c.yaw)
      expect((p[0] - c.pos[0]) * fx + (p[1] - c.pos[1]) * fz).toBeCloseTo(0.45 * 1.5 + 0.1)
      const i = L.lounge.indexOf(p)
      expect(Math.abs(Math.atan2(c.pos[0] - p[0], c.pos[1] - p[1]) - L.loungeYaw[i]!)).toBeLessThan(1e-9)
    }
  })

  it('occupied seats are obstacles; the seat itself stays reachable', () => {
    const s = createMockState(1)
    const L = computeLayout(s.office.slots, s.office.rings, 1)
    for (const d of s.office.slots.filter((x) => x.type === 'desk' && x.occupantId)) {
      const seat = seatPoint(L.slotWorld.get(d.id)!, d.rotation)
      expect(inBox(L, seat)).toBe(true)
      const path = pathFromDoor(seat, L)
      const end = path[path.length - 1]!
      expect(Math.hypot(end[0] - seat[0], end[1] - seat[1])).toBeLessThan(1e-6)
    }
  })

  it('meeting seats sit at the two table ends, facing each other', () => {
    const s = createMockState(3)
    const L = computeLayout(s.office.slots, s.office.rings, 3)
    const m = meetingSeats(L)!
    expect(m).not.toBeNull()
    const d = Math.hypot(m.founder.pos[0] - m.guest.pos[0], m.founder.pos[1] - m.guest.pos[1])
    expect(d).toBeGreaterThan(1)
    const toGuest = Math.atan2(m.guest.pos[0] - m.founder.pos[0], m.guest.pos[1] - m.founder.pos[1])
    expect(m.founder.yaw).toBeCloseTo(toGuest)
    expect(Math.abs(Math.cos(m.guest.yaw - m.founder.yaw) + 1)).toBeLessThan(1e-9)
    expect(meetingSeats(computeLayout(createMockState(0).office.slots, [], 0))).toBeNull()
  })
})

describe('furnishedBox (phone framing)', () => {
  it('frames the furnished middle of a big office, not its bare edges, and always keeps the door', () => {
    const s = createMockState(3)
    const L = computeLayout(s.office.slots, s.office.rings, s.office.stage)
    const full = Math.hypot(L.bounds.maxX - L.bounds.minX, L.bounds.maxZ - L.bounds.minZ) / 2
    // Only the founder desk furnished: a box around it and the door, smaller than the whole floor.
    const bare = s.office.slots.map((x) => (x.id === 'founder' ? x : { ...x, itemId: undefined }))
    const box = furnishedBox(L, bare)!
    expect(box.r).toBeLessThan(full)
    const f = L.slotWorld.get('founder')!
    for (const p of [f, L.door.inside]) {
      expect(Math.abs(p[0] - box.cx)).toBeLessThanOrEqual(box.r)
      expect(Math.abs(p[1] - box.cz)).toBeLessThanOrEqual(box.r)
    }
    // Nothing furnished: no opinion.
    expect(furnishedBox(L, s.office.slots.map((x) => ({ ...x, itemId: undefined })))).toBeNull()
  })
})
