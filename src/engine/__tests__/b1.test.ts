// Playtest bugs (round 3, B1): fatigueRate, the hire guard, and the team-zero end condition.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { dailyEndgame } from '../endgame'
import { dailyEffort, fatigueRate } from '../effort'
import { createEngine, freeCash } from '../index'
import { clone } from '../util'
import { company, content } from './moduleFixtures'
import { fakeContent } from './fixtures'

const api = createEngine(fakeContent())

describe('fatigueRate (pace box)', () => {
  it('Normal and Rahat differ for a person at load 1.2, and dailyEffort uses the same arithmetic', () => {
    const s = company(['web'], 2)
    const e = s.employees.find((x) => x.dept === 'eng')!
    e.loadAvg = 1.2
    delete e.projectId
    const normal = fatigueRate(s, content, e, 'normal')
    const calm = fatigueRate(s, content, e, 'calm')
    expect(normal).toBeGreaterThan(calm)
    expect(calm).toBeLessThan(0)
    // One day at normal pace moves fatigue by that delta (no break day / common area in this fixture's seat).
    const t = clone(s)
    const te = t.employees.find((x) => x.id === e.id)!
    te.fatigue = 40
    te.pace = 'normal'
    dailyEffort(t, content)
    const la = te.loadAvg!
    expect(la).toBeGreaterThan(0)
    expect(Math.abs(te.fatigue! - 40 - fatigueRate(t, content, { ...te, loadAvg: la }, 'normal'))).toBeLessThan(B.BREAK_DAY_RECOVERY + 0.01)
  })
})

describe('hire with no free desk', () => {
  it('is refused and costs nothing (no cash, no owed, no employee, candidate stays)', () => {
    const s = api.createGame({ seed: 3 })
    const c = s.candidates[0]!
    const r = api.applyAction(s, { type: 'hire', candidateId: c.id })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('noDesk')
    expect(r.state).toBe(s)
    expect(s.employees).toHaveLength(0)
    expect(s.candidates.some((x) => x.id === c.id)).toBe(true)
  })
  it('never says noDesk while a ring-1 desk with an item is free; the hire sits on a rendered desk', () => {
    let s = api.createGame({ seed: 3 })
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s2' }).state
    const cash = s.stats.cash
    const r = api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id })
    expect(r.ok).toBe(true)
    const e = r.state.employees[0]!
    const slot = r.state.office.slots.find((x) => x.id === e.deskSlotId)!
    expect(slot.itemId).toBe('desk-basic')
    expect(slot.ring).toBeLessThanOrEqual(1)
    expect(r.state.stats.cash).toBe(cash)
  })
})

describe('team zero with cash left', () => {
  function lone(cash: number) {
    const s = clone(api.createGame({ seed: 5 }))
    s.counters.hires = 2
    s.employees = []
    s.stats.cash = cash
    s.flags['teamZeroSince'] = s.time.day - B.TEAM_ZERO_GRACE_DAYS - 1
    return s
  }
  it('a lone founder with free cash keeps playing', () => {
    const s = lone(50_000)
    dailyEndgame(s, fakeContent())
    expect(s.gameOver).toBeUndefined()
  })
  it('an empty till ends it, and freeCash is the HUD number', () => {
    const s = lone(0)
    dailyEndgame(s, fakeContent())
    expect(s.gameOver?.kind).toBe('teamLost')
    expect(freeCash(s)).toBe(s.stats.cash - (s.finance.ledger ? s.finance.ledger.salaries + s.finance.ledger.rent + s.finance.ledger.infra + s.finance.ledger.ads + (s.finance.ledger.founder ?? 0) : 0))
  })
})

describe('cheap extras', () => {
  it('a resigned person leaves no staff bubble behind', async () => {
    const { staffAttention } = await import('../loopSelectors')
    const s = company(['web'], 2)
    const e = s.employees[0]!
    e.status = 'leaving'
    e.leaveDay = s.time.day + 3
    expect(staffAttention(s).some(([id]) => id === e.id)).toBe(true)
    const r = api.applyAction(s, { type: 'respondResignation', employeeId: e.id, response: 'letGo' })
    expect(r.ok).toBe(true)
    expect(staffAttention(r.state).some(([id]) => id === e.id)).toBe(false)
  })
  it('the ad preview moves the runway with the tile amount (non-profitable company)', async () => {
    const { previewSpend } = await import('../loopSelectors')
    const s = company(['web'], 2)
    s.finance.net = -4_000
    s.finance.adBudget = 0
    const none = previewSpend(s, { burnDelta: 0 })
    const five = previewSpend(s, { burnDelta: 5_000 })
    expect(none.runwayAfter).not.toBeNull()
    expect(five.runwayAfter!).toBeLessThan(none.runwayAfter!)
  })
})
