import { beforeEach, describe, expect, it } from 'vitest'
import type { Rig } from './CharacterModel'
import { QUEUE_DOOR_CLEAR, QUEUE_LANE_CLEAR, computeLayout, doorQueue, type XZ } from './layout'
import { createMockState } from './mockState'
import { DESPAWN_MS, MIN_SCALE, SPAWN_MS, despawnCurve, easeOutBack, spawnCurve } from './useSpawnScale'
import { DOOR_CLEAR, Mover, SEPARATION, poseSit, poseStand, settle, type Neighbour } from './walker'
import { STAND, claim, clearSpots, hold, pawnSpots, release, reservations, reserve, visitorFan } from './spots'
import { visitorCandidates, visitorSpot } from './Npc'
import { CELL } from './constants'
import { isFreeFloor } from './nav'

const row: XZ[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i * 0.3, 0] as XZ)

describe('spots', () => {
  beforeEach(clearSpots)

  it('a held seat pushes a visitor to the next free point beside the planned one', () => {
    const s = createMockState()
    const L = computeLayout(s.office.slots, s.office.rings, s.office.stage)
    const tgt = { pos: [L.center[0], L.center[1]] as XZ, yaw: 0 }
    hold(STAND, 'e1', tgt.pos)
    const cands = visitorCandidates(tgt, L)
    expect(cands[0]).toEqual(tgt.pos)
    const got = reserve(STAND, 'v1', cands)!
    expect(Math.hypot(got[0] - tgt.pos[0], got[1] - tgt.pos[1])).toBeGreaterThanOrEqual(0.55)
  })

  it('two people never get points closer than minDist', () => {
    const a = reserve('stand', 'a', row)!
    const b = reserve('stand', 'b', row)!
    const c = reserve('stand', 'c', row)!
    expect(a).toBe(row[0])
    for (const [p, q] of [
      [a, b],
      [a, c],
      [b, c],
    ] as const)
      expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeGreaterThanOrEqual(0.55)
  })

  it('a held spot stays put across calls, and is freed on release', () => {
    const a = reserve('stand', 'a', row)!
    const b = reserve('stand', 'b', row)!
    expect(reserve('stand', 'a', row)).toBe(a)
    expect(reserve('stand', 'b', row)).toBe(b)
    release('stand', 'a')
    expect(reservations('stand').has('a')).toBe(false)
    expect(reserve('stand', 'c', row)).toBe(row[0])
  })

  it('kinds are independent', () => {
    expect(reserve('stand', 'a', row)).toBe(row[0])
    expect(reserve('door', 'b', row)).toBe(row[0])
  })

  it('crowded: falls back to the least crowded candidate', () => {
    const two: XZ[] = [
      [0, 0],
      [0.2, 0],
      [3, 0],
    ]
    reserve('stand', 'a', [two[0]!])
    reserve('stand', 'b', [two[2]!])
    // Neither free (0.55): [0.2,0] is 0.2 from a, [3,0] is taken → pick the one furthest from anyone.
    const c = reserve('stand', 'c', [two[1]!, two[2]!])
    expect(c).toBe(two[1])
    expect(reserve('stand', 'x', [])).toBeNull()
  })

  it('visitor fan spreads across and steps back', () => {
    expect(visitorFan(0, 1)).toEqual({ dx: 0, dz: -0 })
    const xs = [0, 1, 2].map((i) => visitorFan(i, 3))
    expect(xs.map((x) => x.dx)).toEqual([-0.6, 0, 0.6])
    expect(xs[2]!.dz).toBeCloseTo(-0.24)
    for (let i = 1; i < 3; i++) expect(Math.hypot(xs[i]!.dx - xs[i - 1]!.dx, xs[i]!.dz - xs[i - 1]!.dz)).toBeGreaterThanOrEqual(0.55)
  })
})

function minGap(pts: readonly XZ[]): number {
  let m = Infinity
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![1] - pts[j]![1]))
  return m
}

function segDist(p: XZ, a: XZ, b: XZ): number {
  const vx = b[0] - a[0]
  const vz = b[1] - a[1]
  const k = Math.min(1, Math.max(0, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (vx * vx + vz * vz)))
  return Math.hypot(p[0] - (a[0] + vx * k), p[1] - (a[1] + vz * k))
}

// The door queue (layout.doorQueue) and visitor allocation (Npc.visitorSpot): a crowd at the door never shares a point.
describe('door queue', () => {
  beforeEach(clearSpots)

  for (const stage of [0, 1, 2, 3] as const) {
    it(`stage ${stage}: queue spots fan either side of the lane, clear of the door, apart, on free floor`, () => {
      const st = createMockState(stage)
      const L = computeLayout(st.office.slots, st.office.rings, st.office.stage)
      const q = doorQueue(L)
      expect(q.length).toBeGreaterThanOrEqual(2)
      expect(doorQueue(L)).toBe(q)
      expect(minGap(q)).toBeGreaterThanOrEqual(0.55)
      for (const p of q) {
        expect(isFreeFloor(L, p)).toBe(true)
        expect(Math.hypot(p[0] - L.door.outside[0], p[1] - L.door.outside[1])).toBeGreaterThanOrEqual(Math.max(QUEUE_DOOR_CLEAR, DOOR_CLEAR))
        expect(segDist(p, L.door.outside, L.door.inside)).toBeGreaterThanOrEqual(QUEUE_LANE_CLEAR)
      }
      // Nearest first: the fan grows away from the door.
      const d = q.map((p) => Math.hypot(p[0] - L.door.inside[0], p[1] - L.door.inside[1]))
      for (let i = 1; i < d.length; i++) expect(d[i]!).toBeGreaterThanOrEqual(d[i - 1]! - 1e-9)
    })
  }

  it('claim is strict: null when every candidate is taken, and the old reservation stays', () => {
    expect(claim(STAND, 'a', [row[0]!])).toBe(row[0])
    expect(claim(STAND, 'b', [row[1]!])).toBeNull()
    expect(reservations(STAND).has('b')).toBe(false)
    expect(claim(STAND, 'b', [row[4]!])).toBe(row[4])
    expect(claim(STAND, 'b', [row[1]!])).toBeNull()
    expect(reservations(STAND).get('b')).toBe(row[4])
    expect(claim(STAND, 'x', [])).toBeNull()
  })

  it('visitors at one target: target spots, then queue spots inside the door, then wait outside; never a shared point', () => {
    const st = createMockState(1)
    const L = computeLayout(st.office.slots, st.office.rings, st.office.stage)
    const tgt = { pos: [L.center[0], L.center[1]] as XZ, yaw: 0 }
    const target = visitorCandidates(tgt, L).length
    const queue = doorQueue(L).length
    const n = target + queue + 3
    const got = Array.from({ length: n }, (_, i) => visitorSpot(`v${i}`, tgt, L, false))
    const placed = got.filter((g) => g !== null)
    expect(placed.length).toBeLessThanOrEqual(target + queue)
    expect(placed.length).toBeGreaterThan(target)
    expect(placed.some((g) => g.queued)).toBe(true)
    // The overflow stays outside with no reservation (not spawned).
    expect(got[n - 1]).toBeNull()
    expect(reservations(STAND).has(`v${n - 1}`)).toBe(false)
    expect(minGap([...reservations(STAND).values()])).toBeGreaterThanOrEqual(0.55)
    // Queued spots come from the door queue; target spots from the target.
    const qs = doorQueue(L)
    for (const g of placed) if (g.queued) expect(qs).toContain(g.spot)
  })

  it('a queued visitor walks on once a target spot frees up, releasing the queue spot', () => {
    const st = createMockState(1)
    const L = computeLayout(st.office.slots, st.office.rings, st.office.stage)
    const tgt = { pos: [L.center[0], L.center[1]] as XZ, yaw: 0 }
    const cands = visitorCandidates(tgt, L)
    cands.forEach((c, i) => hold(STAND, `seat${i}`, c))
    const first = visitorSpot('v', tgt, L, false)!
    expect(first.queued).toBe(true)
    // Same answer next frame (no hopping).
    expect(visitorSpot('v', tgt, L, true)!.spot).toBe(first.spot)
    release(STAND, 'seat0')
    const next = visitorSpot('v', tgt, L, true)!
    expect(next.queued).toBe(false)
    expect(next.spot).toEqual(cands[0])
    expect([...reservations(STAND).values()].some((p) => p[0] === first.spot[0] && p[1] === first.spot[1])).toBe(false)
  })

  it('someone already inside keeps a spot (least crowded) instead of vanishing', () => {
    const st = createMockState(1)
    const L = computeLayout(st.office.slots, st.office.rings, st.office.stage)
    const tgt = { pos: [L.center[0], L.center[1]] as XZ, yaw: 0 }
    visitorCandidates(tgt, L).forEach((c, i) => hold(STAND, `t${i}`, c))
    doorQueue(L).forEach((c, i) => hold(STAND, `q${i}`, c))
    expect(visitorSpot('out', tgt, L, false)).toBeNull()
    const inside = visitorSpot('in', tgt, L, true)
    expect(inside).not.toBeNull()
    expect(inside!.queued).toBe(false)
  })

  it('release-wave pawns stop clear of everyone holding a spot and of each other', () => {
    const st = createMockState(1)
    const L = computeLayout(st.office.slots, st.office.rings, st.office.stage)
    const desk = L.slotWorld.get('founder')!
    const free = (p: XZ) => isFreeFloor(L, p)
    // A visitor and a lounger stand exactly where two ring pawns would.
    hold(STAND, 'v', [desk[0] + CELL * 0.9, desk[1]])
    hold(STAND, 'e', [desk[0], desk[1] + CELL * 0.9])
    const pts = pawnSpots(desk, 6, CELL, free)
    expect(pts).toHaveLength(6)
    const people = [...reservations(STAND).values()]
    for (const p of pts) {
      if (!free(p)) continue
      for (const o of people) expect(Math.hypot(p[0] - o[0], p[1] - o[1])).toBeGreaterThanOrEqual(0.55)
    }
    expect(minGap(pts)).toBeGreaterThanOrEqual(0.44 - 1e-9)
    // Pawns reserve nothing.
    expect(reservations(STAND).size).toBe(2)
  })
})

// Motion helpers that keep bodies apart and poses smooth (walker.ts / useSpawnScale.ts).
describe('separation, turn-in, pose settle, spawn curves', () => {
  const L = computeLayout(createMockState(2).office.slots, createMockState(2).office.rings, 2)

  it('two people on one point push apart, capped per frame, never past SEPARATION', () => {
    const a = new Mover(L.center[0], L.center[1])
    a.id = 'a'
    const b = new Mover(L.center[0], L.center[1])
    b.id = 'b'
    const others = new Map<string, Neighbour>()
    for (let i = 0; i < 60; i++) {
      others.set('a', { x: a.x, z: a.z, visible: true })
      others.set('b', { x: b.x, z: b.z, visible: true })
      const ax = a.x
      a.update(1 / 60, 1, i, others)
      b.update(1 / 60, 1, i, others)
      expect(Math.abs(a.x - ax)).toBeLessThanOrEqual(0.05 + 1e-9)
    }
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(SEPARATION - 0.02)
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(SEPARATION + 0.06)
  })

  it('invisible neighbours, the desk anchor and a held world push nobody', () => {
    const a = new Mover(0, 0)
    a.id = 'a'
    const others = new Map<string, Neighbour>([
      ['x', { x: 0.1, z: 0, visible: false }],
      ['desk', { x: 0.1, z: 0, visible: true }],
    ])
    a.update(1 / 60, 1, 0, others)
    expect([a.x, a.z]).toEqual([0, 0])
    others.set('y', { x: 0.1, z: 0, visible: true })
    a.update(0, 0, 0, others)
    expect([a.x, a.z]).toEqual([0, 0])
  })

  it('turns toward faceYaw over the last stretch and only then counts as settled', () => {
    const m = new Mover(L.center[0] - 3, L.center[1])
    m.goTo([L.center[0], L.center[1]], L, 'k', Math.PI)
    m.path = [[L.center[0], L.center[1]]]
    let yawAtArrival = 0
    for (let i = 0; i < 600 && m.update(1 / 60, 1, i); i++) yawAtArrival = m.yaw
    // Walking along +x is yaw π/2; the arrival facing π was already blended in before stopping.
    expect(Math.abs(yawAtArrival - Math.PI / 2)).toBeGreaterThan(0.2)
    for (let i = 0; i < 120; i++) m.update(1 / 60, 1, i)
    expect(m.yawSettled).toBe(true)
    m.faceYaw = 0
    expect(m.yawSettled).toBe(false)
  })

  it('settle chases the pose instead of snapping; dt 0 freezes it', () => {
    const g = () => ({ rotation: { x: 0, z: 0 }, position: { y: 0, z: 0 } })
    const rig = { body: g(), head: g(), armL: g(), armR: g(), legL: g(), legR: g(), cup: null } as unknown as Rig
    poseStand(rig, 0)
    settle(rig, 1 / 60)
    poseSit(rig, 0, 1)
    settle(rig, 1 / 60)
    const legAfterOne = rig.legL!.rotation.x
    expect(legAfterOne).toBeLessThan(0)
    expect(legAfterOne).toBeGreaterThan(-Math.PI / 2 + 0.5)
    poseSit(rig, 0, 1)
    settle(rig, 0)
    expect(rig.legL!.rotation.x).toBeCloseTo(legAfterOne)
    for (let i = 0; i < 60; i++) {
      poseSit(rig, 0, 1)
      settle(rig, 1 / 60)
    }
    expect(rig.legL!.rotation.x).toBeCloseTo(-Math.PI / 2, 3)
  })

  it('spawn grows from ~0 with a small overshoot; despawn shrinks to ~0', () => {
    expect(spawnCurve(0)).toBeCloseTo(MIN_SCALE)
    expect(spawnCurve(SPAWN_MS)).toBe(1)
    const peak = Math.max(...[0.6, 0.7, 0.8, 0.9].map((k) => spawnCurve(k * SPAWN_MS)))
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThan(1.15)
    expect(despawnCurve(0)).toBe(1)
    expect(despawnCurve(DESPAWN_MS)).toBeCloseTo(MIN_SCALE)
    expect(easeOutBack(1)).toBeCloseTo(1)
  })
})
