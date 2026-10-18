// Fix round 3: the chip names one concrete move when the garage / Pre-seed / Seed run needs one; stepAction plays it.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../content/index'
import * as B from '../balance'
import { createEngine } from '../index'
import { moveKey, nextMove, nextStep, snoozed, stepAction, trackChip } from '../loopSelectors'
import { deserialize, serialize } from '../save'
import type { GameState } from '../types'

const api = createEngine(CONTENT)
const applyAction = api.applyAction

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
    const engCand = { ...l.candidates[0]!, id: 'cand-eng-test', dept: 'eng' as const, salary: 500 }
    const rich: GameState = { ...l, stage: 1, candidates: [...l.candidates, engCand], stats: { ...l.stats, cash: 300_000 }, finance: { ...l.finance, runway: 30 } }
    expect(nextMove({ ...rich, derived: { ...rich.derived, overload: 0.5 } })).toBe('hireEng')
    const a = stepAction(rich, { ...nextStep(rich), move: 'hireEng' })
    expect(rich.candidates.find((c) => c.id === (a as { candidateId: string }).candidateId)?.dept).toBe('eng')
    const calm: GameState = { ...rich, derived: { ...rich.derived, overload: 0, deptCounts: { ...rich.derived.deptCounts, eng: 1, marketing: 1 } } }
    expect(['hireGrowth', 'module', 'openRing', 'adsUp', 'growthAsk', 'focusTalk', 'progress']).toContain(nextMove(calm))
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

  it('round 6: no spending move with negative cash or a payday waiting; an open window starts the round; never empty after the garage', () => {
    const l = live()
    const rich: GameState = { ...l, stage: 2, stats: { ...l.stats, cash: 300_000 }, finance: { ...l.finance, runway: null, net: 50_000 } }
    const broke: GameState = { ...rich, stats: { ...rich.stats, cash: -4_000 }, derived: { ...rich.derived, overload: 0.5 } }
    expect(['hireEng', 'hireGrowth', 'hireMarketing', 'openRing', 'ads', 'adsUp', 'module']).not.toContain(nextMove(broke))
    const desk: GameState = { ...rich, finance: { ...rich.finance, pendingPayday: {} as never }, derived: { ...rich.derived, overload: 0.5 } }
    expect(['hireEng', 'hireGrowth', 'hireMarketing', 'openRing', 'ads', 'adsUp', 'module']).not.toContain(nextMove(desk))
    const window: GameState = { ...rich, derived: { ...rich.derived, canStartRound: true } }
    expect(nextMove(window)).toBe('startRound')
    expect(stepAction(window, { ...nextStep(window), move: 'startRound' })).toEqual({ type: 'startRound' })
    // Series A–C too, and always something.
    for (const stage of [1, 2, 3, 4, 5] as const) expect(nextMove({ ...rich, stage })).toBeDefined()
  })

  it('a bored leaver gets work, not a raise', () => {
    const l = live()
    const e = l.employees[0]!
    const s: GameState = { ...l, stage: 1, employees: [{ ...e, status: 'leaving', leaveCause: 'bored', leaveDay: l.time.day + 3, projectId: undefined }] }
    const a = stepAction(s, { ...nextStep(s), move: 'keepStaff' })
    expect(a?.type === 'assign' || (a?.type === 'respondResignation' && a.response === 'talk')).toBe(true)
  })

  it('round 7, the late walls: a finished lone product at A opens a second, servers tight with no seat ask for a server room, a carried segment opens', () => {
    const l = live()
    const base: GameState = { ...l, stats: { ...l.stats, cash: 50_000_000 }, finance: { ...l.finance, runway: null, net: 1_000_000, burn: 1_000_000 } }
    const done: GameState = { ...base, stage: 3, projects: base.projects.map((p) => ({ ...p, maturity: 1 })) }
    expect(nextMove(done)).toBe('newProduct')
    expect(stepAction(done, { ...nextStep(done), move: 'newProduct' })).toMatchObject({ type: 'startProject' })
    const two: GameState = { ...done, projects: [...done.projects, { ...done.projects[0]!, id: 'p-two', category: 'ai' }] }
    const tight: GameState = {
      ...two,
      stage: 4,
      stats: { ...two.stats, users: 100_000 },
      derived: { ...two.derived, capacity: 50_000, overload: 1, hireDeskCost: null, serverRoom: { price: 250_000, upkeep: 3_000 } },
    }
    expect(['serverRoom', 'refactor', 'signLaw', 'openSegment', 'adsTune', 'acquire']).toContain(nextMove(tight))
    expect(stepAction(tight, { ...nextStep(tight), move: 'serverRoom' })).toEqual({ type: 'placeItem', itemId: 'server-room' })
  })

  it('round 8 snooze: a declined law falls through to the next one; 45 days ignored snoozes it; old saves load', () => {
    const l = live()
    const pol = { available: ['management', 'quality-gate'], adopted: [], nextSignDay: 0, mult: {}, movesBonus: 0, burnAsk: 0, payLater: 0 }
    const base: GameState = {
      ...l,
      stage: 2,
      stats: { ...l.stats, cash: 5_000_000 },
      finance: { ...l.finance, runway: null, net: 100_000 },
      founder: { ...l.founder, moves: { left: 3, weekStart: l.time.day } },
      derived: { ...l.derived, policies: pol as never },
    }
    // Only the law matters here: the moves before it are kept off.
    const lawFirst = (st: GameState) => nextMove({ ...st, employees: [], projects: st.projects.map((p) => ({ ...p, maturity: 1 })) })
    expect(lawFirst(base)).toBe('signLaw')
    expect(moveKey(base, 'signLaw')).toBe('signLaw:management')
    const once: GameState = { ...base, chipSnooze: { 'signLaw:management': base.time.day + B.MOVE_SNOOZE_DAYS } }
    expect(moveKey(once, 'signLaw')).toBe('signLaw:quality-gate')
    const both: GameState = { ...once, chipSnooze: { ...once.chipSnooze, 'signLaw:quality-gate': base.time.day + 10 } }
    expect(lawFirst(both)).not.toBe('signLaw')
    expect(snoozed(both, 'signLaw:quality-gate')).toBe(true)
    expect(snoozed({ ...both, time: { ...both.time, day: both.time.day + 11 } }, 'signLaw:quality-gate')).toBe(false)
    // The action: only the move on the chip, and only confirm moves.
    const onChip: GameState = { ...base, derived: { ...base.derived, nextStep: { id: 'grow', index: 6, total: 6, move: 'signLaw' } } }
    const r = applyAction(onChip, { type: 'snoozeMove', move: 'signLaw' })
    expect(r.ok).toBe(true)
    expect(r.state.chipSnooze?.['signLaw:management']).toBe(Math.floor(base.time.day) + B.MOVE_SNOOZE_DAYS)
    expect(applyAction(onChip, { type: 'snoozeMove', move: 'acquire' }).ok).toBe(false)
    // Auto: the same confirm move 45 days on the chip.
    const seen: GameState = { ...onChip, chipSeen: { key: 'signLaw:management', since: Math.floor(base.time.day) - B.MOVE_SNOOZE_SHOWN_DAYS } }
    trackChip(seen)
    expect(seen.chipSnooze?.['signLaw:management']).toBeGreaterThan(base.time.day)
    // A save without the fields loads and plays.
    const { chipSnooze: _a, chipSeen: _b, ...old } = seen
    expect(deserialize(serialize(old as GameState))).not.toBeNull()
  })

  it('stops at Unicorn', () => {
    const l = live()
    expect(nextMove({ ...l, stage: 6, finance: { ...l.finance, runway: 1 } })).toBeUndefined()
  })
})
