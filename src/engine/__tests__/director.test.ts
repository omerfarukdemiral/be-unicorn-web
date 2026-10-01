// GAMEPLAY V2 §5.2: the director (pressure scales with wealth, a missed payroll gives breath) and the one-time angel.
import { describe, expect, it } from 'vitest'
import { DECISIONS } from '../../content/decisions'
import * as B from '../balance'
import { crisisSeverity } from '../decisions'
import { createEngine } from '../index'
import type { GameState } from '../types'
import { fakeCard, fakeContent } from './fixtures'

const ANGEL = DECISIONS.find((c) => c.id === B.ANGEL_CARD_ID)!
const RESCUE = fakeCard(B.RESCUE_CARD_ID, { category: 'crisis', once: false, condition: (x) => x.stats.cash < 0, defaultAfterDays: 14, defaultOption: 1 })
const content = fakeContent({ decisions: [ANGEL, RESCUE] })
const api = createEngine(content)

/** A garage with a launched, finished web project and `users`: profitable without a team. */
function profitable(seed: number, users = 3000): GameState {
  let s = api.createGame({ seed })
  s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
  return api.step({ ...s, projects: s.projects.map((p) => ({ ...p, maturity: 1, launched: true, releaseLevel: 5 })), stats: { ...s.stats, users, cash: 200_000 } }, 1)
}

/** Steps to just before the next payday and empties the till: the payday is missed. */
function missPayday(s: GameState, cash = -5_000): GameState {
  const day = (Math.floor(s.time.day / 30) + 1) * 30 - 0.5
  return api.step({ ...s, time: { ...s.time, day }, stats: { ...s.stats, cash } }, 1)
}

describe('director pressure (§5.2)', () => {
  it('three profitable months (a long runway) → pressure ≥ 0.6, and the crisis gets harder', () => {
    let s = profitable(3)
    expect(s.finance.net).toBeGreaterThan(0)
    s = api.step(s, 95)
    expect(s.counters.profitMonths ?? 0).toBeGreaterThanOrEqual(3)
    expect(s.director!.pressure).toBeGreaterThanOrEqual(0.6)
    expect(crisisSeverity(s)).toBeCloseTo(B.CRISIS_SEVERITY_BASE + B.CRISIS_SEVERITY_PER_PRESSURE * s.director!.pressure, 9)
    expect(crisisSeverity(s)).toBeGreaterThan(B.CRISIS_SEVERITY_BASE + B.CRISIS_SEVERITY_PER_PRESSURE * B.DIRECTOR_PRESSURE_DEFAULT)
  })

  it('a missed payroll → pressure ≤ 0.3 for DIRECTOR_GRACE_DAYS, then it climbs back', () => {
    let s = api.step(profitable(5), 95)
    expect(s.director!.pressure).toBeGreaterThan(0.3)
    s = missPayday(s)
    expect(s.finance.payrollMissed).toBe(true)
    const missed = s.time.day
    expect(s.director!.graceUntil).toBeCloseTo(Math.floor(missed) + B.DIRECTOR_GRACE_DAYS, 0)
    // The cash comes back (the rescue), so the run goes on: rich and profitable again, still inside the grace.
    s = { ...s, stats: { ...s.stats, cash: 200_000 } }
    let maxInGrace = 0
    while (s.time.day < s.director!.graceUntil - 1) {
      s = api.step(s, 5)
      if (s.time.day < s.director!.graceUntil) maxInGrace = Math.max(maxInGrace, s.director!.pressure)
    }
    expect(maxInGrace).toBeLessThanOrEqual(0.3)
    s = api.step(s, 5)
    expect(s.director!.pressure).toBeGreaterThan(0.3)
  })

  it('weighs crisis and rival cards, never how often cards come (CARD_DAILY_CHANCE untouched)', () => {
    expect(B.CARD_DAILY_CHANCE).toBe(0.08)
  })
})

describe('the one-time angel (§5.2)', () => {
  it('up to Seed the first missed payroll brings the angel: 2 months of burn for 5% equity, once', () => {
    let s = api.step(api.createGame({ seed: 9 }), 2)
    s = missPayday(s)
    expect(s.director!.angelUsed).toBe(true)
    expect(s.decisions.active?.cardId).toBe(B.ANGEL_CARD_ID)
    const cash0 = s.stats.cash
    const burn = s.finance.burn
    const equity0 = s.stats.equity
    s = api.applyAction(s, { type: 'answerDecision', cardId: B.ANGEL_CARD_ID, optionIndex: 0 }).state
    expect(s.stats.cash - cash0).toBeCloseTo(Math.round(burn * 2), 0)
    expect(s.stats.equity).toBeCloseTo(equity0 - 0.05, 9)
    // A second missed payroll brings the usual rescue, never the angel again.
    s = api.step({ ...s, stats: { ...s.stats, cash: 10_000 } }, 5)
    expect(s.finance.payrollMissed).toBeFalsy()
    s = missPayday(s)
    expect(s.finance.payrollMissed).toBe(true)
    expect(s.decisions.active?.cardId).toBe(B.RESCUE_CARD_ID)
    expect(s.decisions.queue).not.toContain(B.ANGEL_CARD_ID)
  })

  it('declining it brings the usual rescue next; the angel is still spent', () => {
    let s = missPayday(api.step(api.createGame({ seed: 10 }), 2))
    s = api.applyAction(s, { type: 'answerDecision', cardId: B.ANGEL_CARD_ID, optionIndex: 1 }).state
    s = api.step(s, 1)
    expect(s.decisions.active?.cardId).toBe(B.RESCUE_CARD_ID)
    expect(s.director!.angelUsed).toBe(true)
  })

  it('never after Seed, never by a roll', () => {
    let s = api.step(api.createGame({ seed: 11 }), 2)
    s = missPayday({ ...s, stage: 3 })
    expect(s.decisions.active?.cardId).toBe(B.RESCUE_CARD_ID)
    expect(s.director!.angelUsed).toBeUndefined()
    expect(ANGEL.maxStage).toBe(B.ANGEL_MAX_STAGE)
    expect(ANGEL.condition!(s)).toBe(false)
  })
})
