import { describe, expect, it } from 'vitest'
import { computeLayout, lPath, pathFromDoor, type OfficeLayout, type XZ } from './layout'
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
})
