// Focus rules on the engine side (docs/CORE_LOOP.md §3.2): paused start, no timed decision cards;
// GAMEPLAY V2 §7.1 the founder's weekly move budget (limited labour).
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { createEngine } from '../index'
import { FOUNDER_EXHAUSTED_FLAG } from '../founder'
import { enterStage } from '../round'
import type { Action, GameState } from '../types'
import { fakeCard, fakeContent } from './fixtures'

const api = createEngine(fakeContent({ decisions: [fakeCard('c1')] }))

describe('focus: engine side', () => {
  it('createGame starts paused (speed 0): game and sim agree, the player presses Başlat', () => {
    expect(api.createGame({ seed: 1 }).time.speed).toBe(0)
    // step() does not care about the speed: the sim steps a paused game directly.
    expect(api.step(api.createGame({ seed: 1 }), 1).time.day).toBeCloseTo(1, 6)
  })

  it('a decision visitor waits for the answer: card and visitor outlive the old 20-day timer', () => {
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    const active = s.decisions.active!
    expect(active.cardId).toBe('c1')
    const vid = active.visitorId!
    s = api.step(s, 50) // well past the old 20-day timer, before the 60-day default
    expect(s.decisions.active?.cardId).toBe('c1')
    const v = s.visitors.find((x) => x.id === vid)!
    expect(v).toBeDefined()
    // Render walks a visitor out at leaveDay: it must stay far in the future while the card is open.
    expect(v.leaveDay).toBeGreaterThan(s.time.day + 1000)
    expect(Number.isFinite(v.leaveDay)).toBe(true)
    // Answering sends the visitor off.
    s = api.applyAction(s, { type: 'answerDecision', cardId: 'c1', optionIndex: 0 }).state
    expect(s.visitors.find((x) => x.id === vid)!.leaveDay).toBeLessThanOrEqual(s.time.day)
    s = api.step(s, 1)
    expect(s.visitors.some((x) => x.id === vid)).toBe(false)
  })

  it('an old save with a 20-day decision visitor gets its leaveDay pushed out', () => {
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    const vid = s.decisions.active!.visitorId!
    const old = structuredClone(s)
    const ov = old.visitors.find((x) => x.id === vid)!
    ov.leaveDay = ov.arriveDay + 20
    const next = api.step(old, 25)
    const nv = next.visitors.find((x) => x.id === vid)!
    expect(nv.leaveDay).toBe(nv.arriveDay + B.DECISION_VISITOR_WAIT_DAYS)
  })
})

describe('the weekly move budget (GAMEPLAY V2 §7.1)', () => {
  const plain = createEngine(fakeContent())
  const find: Action = { type: 'founderAction', kind: 'findUsers' }
  /** A fresh run moved to `stage` on day 0 (the budget starts from Pre-seed). */
  const at = (stage: GameState['stage']): GameState => ({ ...plain.createGame({ seed: 1 }), stage })

  it('the garage keeps energy and cooldowns: no noMoves however often the founder finds users', () => {
    let s = at(0)
    for (let d = 0; d < 21; d++) {
      const r = plain.applyAction(s, find)
      expect(r.error).not.toBe('noMoves')
      s = plain.step(r.state, 1)
    }
    expect(s.derived.moves).toBeUndefined()
    // The garage price still holds: energy pays for the action.
    const rested = { ...s, founder: { ...s.founder, energy: 100, cooldowns: {} } }
    const r = plain.applyAction(rested, find)
    expect(r.ok).toBe(true)
    expect(r.state.founder.energy).toBe(100 - B.FOUNDER_ACTION_DEFS.findUsers.energy)
  })

  it('Pre-seed: 3 moves a week, the 4th findUsers is noMoves, day 7 refills', () => {
    let s = at(1)
    for (let i = 0; i < B.MOVES_PER_WEEK[1]!; i++) {
      const r = plain.applyAction(s, find)
      expect(r.ok).toBe(true)
      s = plain.step(r.state, 1)
    }
    expect(s.derived.moves).toEqual({ left: 0, total: 3, resetDay: 7 })
    expect(plain.applyAction(s, find).error).toBe('noMoves')
    s = plain.step(s, 7 - s.time.day - 0.5)
    expect(plain.applyAction(s, find).error).toBe('noMoves')
    s = plain.step(s, 0.5)
    expect(s.founder.moves).toEqual({ left: 3, weekStart: 7 })
    expect(s.derived.moves).toEqual({ left: 3, total: 3, resetDay: 14 })
    expect(plain.applyAction(s, find).ok).toBe(true)
  })

  it('Pre-seed: actions cost no energy and have no cooldown; energy 0 does not lock them', () => {
    let s = at(1)
    s = { ...s, founder: { ...s.founder, energy: 0 } }
    const r = plain.applyAction(s, find)
    expect(r.ok).toBe(true)
    expect(r.state.founder.energy).toBe(0)
    s = plain.step(r.state, 1)
    // No cooldown: the next find goes the day the last one ended.
    expect(plain.applyAction(s, find).ok).toBe(true)
    // Energy is a health gauge: idle days do not refill it, a dry gauge raises the exhaustion flag, rest clears it.
    s = plain.step(s, 2)
    expect(s.founder.energy).toBe(0)
    expect(s.flags[FOUNDER_EXHAUSTED_FLAG]).toBe(true)
    const rest = plain.applyAction(s, { type: 'founderAction', kind: 'rest' })
    expect(rest.ok).toBe(true)
    expect(rest.state.founder.moves?.left).toBe(s.founder.moves?.left)
    s = plain.step(rest.state, B.FOUNDER_ACTION_DEFS.rest.durationDays + 0.1)
    expect(s.founder.energy).toBeGreaterThan(0)
    expect(s.flags[FOUNDER_EXHAUSTED_FLAG]).toBeUndefined()
  })

  it('roundPitch takes 1 move: the round week is a week the founder cannot sell', () => {
    let s = at(1)
    s = {
      ...s,
      round: { active: true, targetStage: 2, startedDay: 0, weeksTotal: 8, weeksLeft: 6, offer: { amount: 100_000, equity: 0.15, preMoney: 500_000 }, baseValuation: 500_000, pitchDue: 1 },
    }
    const r = plain.applyAction(s, { type: 'roundPitch', pitch: 'metrics' })
    expect(r.ok).toBe(true)
    expect(r.state.founder.moves?.left).toBe(B.MOVES_PER_WEEK[1]! - B.MOVE_COST.roundPitch)
    // With the week spent the pitch waits for the next one.
    const spent = { ...s, founder: { ...s.founder, moves: { left: 0, weekStart: 0 } } }
    expect(plain.applyAction(spent, { type: 'roundPitch', pitch: 'metrics' }).error).toBe('noMoves')
    // A garage round (to Pre-seed) is not on the budget.
    const garage = { ...spent, stage: 0 as const, round: { ...s.round!, targetStage: 1 as const } }
    expect(plain.applyAction(garage, { type: 'roundPitch', pitch: 'metrics' }).ok).toBe(true)
  })

  it('the resignation talk takes a move on the budget (else it would be free next to the raise)', () => {
    const desk = plain.applyAction(at(0), { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s1' }).state
    const base = { ...plain.applyAction(desk, { type: 'hire', candidateId: desk.candidates[0]!.id }).state, stage: 2 as const }
    const e = base.employees[0]
    expect(e).toBeDefined()
    const s: GameState = { ...base, employees: base.employees.map((x) => (x.id === e!.id ? { ...x, status: 'leaving' as const } : x)) }
    const talk: Action = { type: 'respondResignation', employeeId: e!.id, response: 'talk' }
    const r = plain.applyAction(s, talk)
    expect(r.ok).toBe(true)
    expect(r.state.founder.moves?.left).toBe(B.MOVES_PER_WEEK[2]! - B.MOVE_COST.talkResignation)
    expect(plain.applyAction({ ...s, founder: { ...s.founder, moves: { left: 0, weekStart: 0 } } }, talk).error).toBe('noMoves')
  })

  it('arriving on Pre-seed: a full week, full energy, no garage cooldowns', () => {
    let s = at(0)
    s = { ...s, founder: { ...s.founder, energy: 0, lowEnergyDays: 4, cooldowns: { talkToUsers: 3, findUsers: 2 } } }
    enterStage(s, 1)
    expect(s.founder.energy).toBe(B.ENERGY_MAX)
    expect(s.founder.cooldowns).toEqual({})
    expect(s.founder.moves).toEqual({ left: B.MOVES_PER_WEEK[1], weekStart: 0 })
    s = plain.step(s, 1)
    expect(s.flags[FOUNDER_EXHAUSTED_FLAG]).toBeUndefined()
  })

  it('refactorSprint takes 2 moves; salesCall 2 does not fit in 1', () => {
    const s = { ...at(3), techDebt: 50 }
    const r = plain.applyAction(s, { type: 'founderAction', kind: 'refactorSprint' })
    expect(r.ok).toBe(true)
    expect(r.state.founder.moves?.left).toBe(B.MOVES_PER_WEEK[3]! - 2)
    const one = { ...s, stage: 2 as const, founder: { ...s.founder, moves: { left: 1, weekStart: 0 } } }
    expect(plain.applyAction(one, { type: 'founderAction', kind: 'salesCall' }).error).toBe('noMoves')
  })
})
