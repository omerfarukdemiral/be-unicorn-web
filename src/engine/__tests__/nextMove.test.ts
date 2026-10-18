// Fix round 3: the chip names one concrete move when the garage / Pre-seed / Seed run needs one; stepAction plays it.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../content/index'
import * as B from '../balance'
import { createEngine } from '../index'
import { nextMove, nextStep, stepAction } from '../loopSelectors'
import type { GameState } from '../types'

const api = createEngine(CONTENT)

/** A garage with a launched product, a builder, and some users. */
function live(seed = 1): GameState {
  let s = api.applyAction(api.createGame({ seed }), { type: 'startProject', category: 'web' }).state
  s = api.applyAction(s, { type: 'hire', candidateId: s.candidates.find((c) => c.dept === 'eng' || c.dept === 'product')!.id, autoDesk: true }).state
  for (let i = 0; i < 200 && !s.projects.some((p) => p.launched); i++) s = api.step(s, 1)
  expect(s.projects.some((p) => p.launched)).toBe(true)
  return s
}

describe('nextMove', () => {
  it('none before the MVP and none while a round runs', () => {
    const s = api.applyAction(api.createGame({ seed: 1 }), { type: 'startProject', category: 'web' }).state
    expect(nextMove(s)).toBeUndefined()
    const l = live()
    expect(nextMove({ ...l, round: { ...(l.round ?? {}), active: true } as GameState['round'] })).toBeUndefined()
  })

  it('short runway: a sales call first, its tap is the founder action', () => {
    const l = live()
    const s: GameState = { ...l, finance: { ...l.finance, runway: B.HIRE_RUNWAY_MIN - 1 } }
    expect(nextMove(s)).toBe('salesCall')
    const st = nextStep(s)
    expect(st.move).toBe('salesCall')
    expect(stepAction(s, st)).toEqual({ type: 'founderAction', kind: 'salesCall' })
  })

  it('short runway, no sales call: stop the ads, else a price step up', () => {
    const l = live()
    const busy: GameState = { ...l, founder: { ...l.founder, currentAction: { kind: 'rest', startDay: l.time.day, endDay: l.time.day + 2 } }, finance: { ...l.finance, runway: 1 } }
    expect(nextMove({ ...busy, finance: { ...busy.finance, adBudget: 800 } })).toBe('adsCut')
    expect(nextMove(busy)).toBe('price')
    expect(stepAction(busy, { ...nextStep(busy), move: 'price' })).toMatchObject({ type: 'setPrice' })
  })

  it('users flat against last month: the users focus, then a first ad budget the runway carries', () => {
    const l = live()
    const flat: GameState = { ...l, stats: { ...l.stats, cash: 200_000 }, finance: { ...l.finance, runway: 12, usersHistory: [...l.finance.usersHistory, l.stats.users + 5] } }
    expect(nextMove({ ...flat, founder: { ...flat.founder, focus: 'build' } })).toBe('focusUsers')
    const focused: GameState = { ...flat, founder: { ...flat.founder, focus: 'users' } }
    expect(nextMove(focused)).toBe('ads')
    const a = stepAction(focused, { ...nextStep(focused), move: 'ads' })
    expect(a).toMatchObject({ type: 'setAdBudget' })
    expect((a as { amount: number }).amount).toBeGreaterThanOrEqual(B.CAC_SPEND_FLOOR[0]!)
  })

  it('Pre-seed / Seed: overloaded servers ask for an engineer the runway carries; money idle grows the team', () => {
    const l = live()
    const engCand = { ...l.candidates[0]!, id: 'cand-eng-test', dept: 'eng' as const }
    const rich: GameState = { ...l, stage: 1, candidates: [...l.candidates, engCand], stats: { ...l.stats, cash: 300_000 }, finance: { ...l.finance, runway: 30 } }
    expect(nextMove({ ...rich, derived: { ...rich.derived, overload: 0.5 } })).toBe('hireEng')
    const a = stepAction(rich, { ...nextStep(rich), move: 'hireEng' })
    expect(rich.candidates.find((c) => c.id === (a as { candidateId: string }).candidateId)?.dept).toBe('eng')
    const calm: GameState = { ...rich, derived: { ...rich.derived, overload: 0, deptCounts: { ...rich.derived.deptCounts, eng: 1, marketing: 1 } } }
    expect(['hireGrowth', 'module', 'openRing', 'adsUp', 'growthAsk', 'focusTalk']).toContain(nextMove(calm))
    // Thin runway: no hire is ever named.
    const thin: GameState = { ...rich, stats: { ...rich.stats, cash: 0 }, finance: { ...rich.finance, runway: B.HIRE_RUNWAY_MIN + 0.5 }, derived: { ...rich.derived, overload: 0.5 } }
    expect(['hireEng', 'hireGrowth', 'hireMarketing']).not.toContain(nextMove(thin))
  })

  it('people first: a leaver, then low morale; a waiting meeting; a spent circle switches to talks; one growth hire a month', () => {
    const l = live()
    const pre: GameState = { ...l, stage: 1, stats: { ...l.stats, cash: 300_000 }, finance: { ...l.finance, runway: 30 } }
    const e = pre.employees[0]!
    const leaving: GameState = { ...pre, employees: [{ ...e, status: 'leaving', leaveDay: pre.time.day + 3 }] }
    expect(nextMove(leaving)).toBe('keepStaff')
    expect(stepAction(leaving, { ...nextStep(leaving), move: 'keepStaff' })).toMatchObject({ type: 'respondResignation', employeeId: e.id, response: 'raise' })
    expect(nextMove({ ...pre, stats: { ...pre.stats, morale: 20 } })).toBe('morale')
    const round = { active: true, pitchDue: 1, meeting: 'intro' } as unknown as GameState['round']
    expect(nextMove({ ...pre, round })).toBe('pitch')
    expect(stepAction({ ...pre, round }, { ...nextStep({ ...pre, round }), move: 'pitch' })).toBeNull()
    const spent: GameState = { ...pre, founder: { ...pre.founder, focus: 'users' }, derived: { ...pre.derived, findUsers: { ...pre.derived.findUsers!, factor: 0.1 } } }
    expect(nextMove(spent)).toBe('focusTalk')
    // A hire this week: no growth hire named.
    const fresh: GameState = { ...pre, employees: pre.employees.map((x) => ({ ...x, hiredDay: pre.time.day - 5 })) }
    expect(nextMove(fresh)).not.toBe('hireGrowth')
  })

  it('stops at Series A', () => {
    const l = live()
    expect(nextMove({ ...l, stage: 3, finance: { ...l.finance, runway: 1 } })).toBeUndefined()
  })
})
