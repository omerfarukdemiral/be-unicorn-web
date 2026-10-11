import { beforeEach, describe, expect, it } from 'vitest'
import { computeLayout } from './layout'
import { createMockState } from './mockState'
import { DOOR_CLEAR, DOOR_FADE, DRIFT_BACK, Mover, resetDoor, speedMultiplier } from './walker'

const s = createMockState(2)
const L = computeLayout(s.office.slots, s.office.rings, s.office.stage)

function run(m: Mover, maxSteps = 4000, onStep?: (m: Mover) => void): void {
  for (let i = 0; i < maxSteps && m.update(1 / 60, 1, i); i++) onStep?.(m)
}

describe('walker', () => {
  beforeEach(resetDoor)

  it('one speed formula; paused means nobody walks', () => {
    expect(speedMultiplier(0)).toBe(0)
    expect(speedMultiplier(1)).toBeCloseTo(1.1)
    expect(speedMultiplier(4)).toBeGreaterThan(speedMultiplier(2))
  })

  it('goTo from outside enters through the door and grows in over the threshold', () => {
    const m = new Mover(L.door.outside[0], L.door.outside[1], true)
    expect(m.fade).toBe(0)
    const target: [number, number] = [L.center[0], L.center[1]]
    m.goTo(target, L, 'k')
    // Queued at the door until its first update (the doorway may be busy).
    expect(m.outside).toBe(true)
    expect(m.moving).toBe(true)
    m.update(1 / 60, 1, 0)
    expect(m.outside).toBe(false)
    expect(m.path[0]).toEqual(L.door.inside)
    expect(m.fade).toBeGreaterThan(0)
    expect(m.fade).toBeLessThan(1)
    let prev = m.fade
    let monotonic = true
    run(m, 4000, (x) => {
      if (x.fade + 1e-9 < prev) monotonic = false
      prev = x.fade
    })
    expect(monotonic).toBe(true)
    expect(m.fade).toBe(1)
  })

  it('people arriving together walk in one at a time, never sharing a point', () => {
    const a = new Mover(L.door.outside[0], L.door.outside[1], true)
    const b = new Mover(L.door.outside[0], L.door.outside[1], true)
    a.id = 'a'
    b.id = 'b'
    a.goTo(L.center, L, 'k')
    b.goTo(L.center, L, 'k')
    a.update(1 / 60, 1, 0)
    b.update(1 / 60, 1, 0)
    expect(a.outside).toBe(false)
    expect(b.outside).toBe(true)
    let steps = 0
    while (b.outside && steps < 2000) {
      a.update(1 / 60, 1, steps)
      b.update(1 / 60, 1, steps)
      steps++
    }
    expect(b.outside).toBe(false)
    // b stepped in only once a was DOOR_CLEAR into the room.
    expect(Math.hypot(a.x - L.door.outside[0], a.z - L.door.outside[1])).toBeGreaterThanOrEqual(DOOR_CLEAR - 0.1)
  })

  it('waits while someone stands in the doorway lane, then steps in anyway after a while', () => {
    const m = new Mover(L.door.outside[0], L.door.outside[1], true)
    m.id = 'm'
    m.goTo(L.center, L, 'k')
    const mid: [number, number] = [(L.door.outside[0] + L.door.inside[0]) / 2, (L.door.outside[1] + L.door.inside[1]) / 2]
    const others = new Map([['v', { x: mid[0], z: mid[1], visible: true }]])
    m.update(1 / 60, 1, 0, others)
    expect(m.outside).toBe(true)
    for (let i = 0; i < 60 * 7; i++) m.update(1 / 60, 1, i, others)
    expect(m.outside).toBe(false)
  })

  it('a group leaving together files out of the door one at a time', () => {
    // Three visitors standing side by side just inside the door (same walk to the threshold) leave on the same frame.
    const ms = ['a', 'b', 'c'].map((id, k) => {
      const m = new Mover(L.door.inside[0] + (k - 1) * 0.5, L.door.inside[1] + 1)
      m.id = id
      return m
    })
    for (const m of ms) m.exit(L, 'exit')
    const out = L.door.outside
    let worst = Infinity
    for (let i = 0; i < 60 * 30 && ms.some((m) => !m.outside); i++) {
      for (const m of ms) m.update(1 / 60, 1, i)
      // Two bodies inside DOOR_CLEAR of the threshold at once = drawn through each other in the doorframe.
      const near = ms.filter((m) => !m.outside && Math.hypot(m.x - out[0], m.z - out[1]) < DOOR_CLEAR - 0.05)
      for (const a of near) for (const b of near) if (a !== b) worst = Math.min(worst, Math.hypot(a.x - b.x, a.z - b.z))
    }
    expect(ms.every((m) => m.outside)).toBe(true)
    expect(worst).toBeGreaterThanOrEqual(0.3)
  })

  it('a crowd that waited out DOOR_WAIT_MAX still steps in one at a time, never as one body', () => {
    // Parked at the lane's edge (blocks a normal entry, lets a body squeeze past).
    const mid: [number, number] = [(L.door.outside[0] + L.door.inside[0]) / 2 + 0.35, (L.door.outside[1] + L.door.inside[1]) / 2]
    const others = new Map([['parked', { x: mid[0], z: mid[1], visible: true }]])
    const ms = ['a', 'b', 'c'].map((id) => {
      const m = new Mover(L.door.outside[0], L.door.outside[1], true)
      m.id = id
      m.goTo(L.center, L, 'k')
      return m
    })
    // At the frame someone steps in, everyone already inside is DOOR_CLEAR along (they all walk to one point later).
    let minGap = Infinity
    for (let i = 0; i < 60 * 14; i++) {
      const before = ms.map((m) => m.outside)
      for (const m of ms) m.update(1 / 60, 1, i, others)
      const entered = ms.filter((m, k) => before[k] && !m.outside)
      expect(entered.length).toBeLessThanOrEqual(1)
      for (const e of entered)
        for (const o of ms) if (o !== e && !o.outside) minGap = Math.min(minGap, Math.hypot(o.x - e.x, o.z - e.z))
    }
    expect(ms.every((m) => !m.outside)).toBe(true)
    expect(minGap).toBeGreaterThanOrEqual(DOOR_CLEAR - 0.1)
  })

  it('a standing person shoved off their spot steps back onto it', () => {
    const m = new Mover(L.center[0] - 1, L.center[1])
    m.id = 'm'
    const spot: [number, number] = [L.center[0] - 1.6, L.center[1] - 0.3]
    m.goTo(spot, L, 'k')
    const none = new Map<string, { x: number; z: number; visible: boolean }>()
    for (let i = 0; i < 600; i++) m.update(1 / 60, 1, i, none)
    const end = m.path.length === 0 ? [m.x, m.z] : null
    expect(end).not.toBeNull()
    // Someone walks through: push for a while, then they are gone.
    for (let i = 0; i < 20; i++) m.update(1 / 60, 1, i, new Map([['p', { x: m.x + 0.1, z: m.z, visible: true }]]))
    expect(Math.hypot(m.x - end![0]!, m.z - end![1]!)).toBeGreaterThan(DRIFT_BACK)
    for (let i = 0; i < 300; i++) m.update(1 / 60, 1, i, none)
    expect(Math.hypot(m.x - end![0]!, m.z - end![1]!)).toBeLessThan(0.01)
  })

  it('stayOut drops the place in the door queue: unseen, not walking in', () => {
    const m = new Mover(L.door.outside[0], L.door.outside[1], true)
    m.goTo(L.center, L, 'k')
    m.stayOut('wait')
    expect(m.moving).toBe(false)
    for (let i = 0; i < 60; i++) m.update(1 / 60, 1, i)
    expect(m.outside).toBe(true)
    expect(m.goalKey).toBe('wait')
  })

  it('exit walks out through the door, shrinking to 0 and ending outside', () => {
    const m = new Mover(L.center[0], L.center[1])
    m.exit(L, 'exit')
    expect(m.path[m.path.length - 1]).toEqual(L.door.outside)
    let sawPartial = false
    run(m, 4000, (x) => {
      if (x.fade > 0 && x.fade < 1) sawPartial = true
    })
    expect(sawPartial).toBe(true)
    expect(m.outside).toBe(true)
    expect(m.fade).toBe(0)
  })

  it('fade is full anywhere further than DOOR_FADE from the threshold', () => {
    const m = new Mover(L.door.outside[0], L.door.outside[1] + DOOR_FADE * 2)
    m.goTo(L.center, L, 'k')
    m.update(0, 0, 0)
    expect(m.fade).toBe(1)
  })
})
