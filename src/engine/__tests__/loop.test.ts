// Core loop, phase 1 (docs/CORE_LOOP.md §4–§6): payday + month receipt, release moments, next step chain,
// horizon, stage goals and "Kararın → sonucu".
import { describe, expect, it } from 'vitest'
import type { StageGoal } from '../../content/index'
import * as B from '../balance'
import { createEngine } from '../index'
import { releaseLevel } from '../loop'
import { daysToPayday, horizon, nextStep } from '../loopSelectors'
import type { GameState } from '../types'
import { fakeCard, fakeContent } from './fixtures'

const GOALS: StageGoal[] = [
  { id: 'g-launch', stage: 0, text: 't', hint: 'h', check: (s) => s.projects.some((p) => p.launched) },
  { id: 'g-never', stage: 0, text: 't', hint: 'h', check: () => false },
  { id: 'g-later', stage: 1, text: 't', hint: 'h', check: () => true },
]
const api = createEngine(fakeContent({ goals: GOALS }))

function withTeam(seed = 1): GameState {
  let s = api.createGame({ seed })
  s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
  s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
  const eng = s.candidates.find((c) => c.dept === 'eng') ?? s.candidates[0]!
  const r = api.applyAction(s, { type: 'hire', candidateId: eng.id })
  expect(r.ok).toBe(true)
  return r.state
}

describe('payday (maaş günü)', () => {
  it('costs accrue during the month and leave in one lump on day 30; revenue flows daily', () => {
    let s = withTeam()
    const cash0 = s.stats.cash
    s = api.step(s, 29.5)
    // No salary / rent taken yet: cash only grew by the revenue that flowed in day by day.
    expect(s.stats.cash).toBeCloseTo(cash0 + s.finance.ledger!.revenue, 6)
    const owed = s.finance.ledger!
    expect(owed.salaries + owed.rent).toBeGreaterThan(0)
    const due = horizon(s).find((h) => h.kind === 'payday')!
    expect(due.day).toBe(30)
    s = api.step(s, 1)
    const r = s.finance.lastReceipt!
    expect(r.day).toBe(30)
    expect(r.month).toBe(0)
    expect(s.stats.cash).toBeCloseTo(cash0 + r.revenue - r.paid + s.finance.ledger!.revenue, 6)
    expect(r.paid).toBeCloseTo(r.salaries + r.rent + r.infra + r.ads + (r.founder ?? 0), 6)
    expect(r.founder).toBeGreaterThan(0)
    expect(r.paid).toBeCloseTo(due.amount!, 0)
    expect(r.net).toBeCloseTo(r.revenue - r.paid, 6)
    expect(r.runwayAfter).not.toBeNull()
    expect(s.events.some((e) => e.kind === 'payday' && e.value === r.paid)).toBe(true)
    expect(s.activity.some((a) => a.kind === 'payday')).toBe(true)
    // Ledger restarts after payday.
    expect(s.finance.ledger!.salaries).toBeLessThan(owed.salaries)
  })

  it('pays the same total as the old daily accrual (net × days), just on the 1st', () => {
    let s = withTeam(3)
    // Give it revenue so both sides of the ledger move.
    s = { ...s, stats: { ...s.stats, users: 400 }, projects: s.projects.map((p) => ({ ...p, maturity: 0.5, launched: true, releaseLevel: 2 })) }
    s = api.step(s, 0.25)
    // Cash net of what payday already owes for the first quarter day.
    const l0 = s.finance.ledger!
    const cash0 = s.stats.cash - (l0.salaries + l0.rent + l0.infra + l0.ads + (l0.founder ?? 0))
    const dayStart = s.time.day
    let expected = 0
    let cur = s
    while (cur.time.day < 60 - 1e-9) {
      expected += (cur.finance.net / 30) * 0.25
      cur = api.step(cur, 0.25)
    }
    // Month 1 is fully settled at day 60 (the month 0 remainder was paid on day 30).
    expect(cur.time.day - dayStart).toBeCloseTo(59.75, 6)
    expect(cur.stats.cash - cash0).toBeCloseTo(expected, 0)
  })

  it('runway counts the costs already owed for payday', () => {
    let s = withTeam()
    s = api.step(s, 20)
    const l = s.finance.ledger!
    const owed = l.salaries + l.rent + l.infra + l.ads + (l.founder ?? 0)
    expect(s.finance.runway).toBeCloseTo((s.stats.cash - owed) / -s.finance.net, 6)
  })

  it('an old save without a ledger starts an empty one (its costs so far were taken daily)', () => {
    let s = withTeam()
    s = api.step(s, 10)
    const old = structuredClone(s)
    delete old.finance.ledger
    const next = api.step(old, 1)
    expect(next.finance.ledger).toBeDefined()
    expect(next.finance.ledger!.salaries).toBeCloseTo(s.finance.burnBreakdown.salaries / 30, 6)
  })

  it('daysToPayday counts to the next multiple of 30', () => {
    expect(daysToPayday(0)).toBe(30)
    expect(daysToPayday(29.5)).toBeCloseTo(0.5)
    expect(daysToPayday(30)).toBe(30)
  })
})

describe('release moments (sürüm anı)', () => {
  it('releaseLevel counts the thresholds reached', () => {
    expect(releaseLevel(0)).toBe(0)
    expect(releaseLevel(0.2)).toBe(1)
    expect(releaseLevel(0.59)).toBe(2)
    expect(releaseLevel(1)).toBe(5)
  })

  it('passing MVP ships a release: event, user wave, MRR jump, release log; once per threshold', () => {
    let s = withTeam()
    s = { ...s, projects: s.projects.map((p) => ({ ...p, maturity: 0.199 })) }
    const users0 = s.stats.users
    s = api.step(s, 1)
    const rel = s.releases!
    expect(rel).toHaveLength(1)
    expect(rel[0]!.level).toBe(1)
    expect(rel[0]!.users).toBeGreaterThan(0)
    expect(s.stats.users).toBeGreaterThanOrEqual(users0 + rel[0]!.users - 1)
    expect(s.events.some((e) => e.kind === 'release' && e.refId === rel[0]!.id && e.value === 1)).toBe(true)
    expect(s.projects[0]!.releaseLevel).toBe(1)
    expect(rel[0]!.mrr).toBeGreaterThan(0)
    s = api.step(s, 1)
    expect(s.releases).toHaveLength(1)
  })

  it('later thresholds (40/60/80/100%) each ship; bigger levels bring bigger waves', () => {
    let s = withTeam()
    const at = (m: number) => {
      s = { ...s, projects: s.projects.map((p) => ({ ...p, maturity: m })) }
      s = api.step(s, 0.25)
    }
    at(0.2)
    at(0.4)
    at(0.6)
    expect(s.releases!.map((r) => r.level)).toEqual([1, 2, 3])
    expect(s.releases![2]!.users).toBeGreaterThan(s.releases![0]!.users)
  })

  it('a project first seen in an old save is set silently (no burst of releases)', () => {
    let s = withTeam()
    s = { ...s, projects: s.projects.map((p) => ({ ...p, maturity: 0.65, launched: true, releaseLevel: undefined })) }
    s = api.step(s, 1)
    expect(s.releases ?? []).toHaveLength(0)
    expect(s.projects[0]!.releaseLevel).toBe(3)
  })

  it('is deterministic', () => {
    const go = () => {
      let s = withTeam(9)
      for (let i = 0; i < 120; i++) s = api.step(s, 1)
      return JSON.stringify(s)
    }
    expect(go()).toBe(go())
  })
})

describe('next step chain (sıradaki adım)', () => {
  it('garage: idea → first users → desk → hire → launch → users → team → grow', () => {
    let s = api.createGame({ seed: 1 })
    expect(nextStep(s).id).toBe('idea')
    expect(s.derived.nextStep?.id).toBe('idea')
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    expect(nextStep(s).id).toBe('findUsers')
    s = api.applyAction(s, { type: 'founderAction', kind: 'findUsers' }).state
    s = api.step(s, 1.5)
    // No desk item yet: the chip points at the shop and an empty desk slot (no noDesk trap).
    const desk = nextStep(s)
    expect(desk.id).toBe('desk')
    expect(desk.slotId).toBeDefined()
    expect(s.office.slots.find((x) => x.id === desk.slotId)?.type).toBe('desk')
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: desk.slotId! }).state
    expect(nextStep(s).id).toBe('hire')
    s = api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id }).state
    const launch = nextStep(s)
    expect(launch.id).toBe('launch')
    expect(launch.progress).toBeGreaterThanOrEqual(0)
    s = { ...s, projects: s.projects.map((p) => ({ ...p, maturity: 0.3, launched: true, releaseLevel: 1 })), stats: { ...s.stats, users: 10 } }
    expect(nextStep(s).id).toBe('users')
    s = { ...s, stats: { ...s.stats, users: 60 } }
    // Pre-revenue the valuation link is the team: it names what one hire adds and what it costs in runway.
    const team = nextStep(s)
    expect(team.id).toBe('team')
    expect(team.value).toBe(B.VAL_PER_TEAM)
    expect(team.target).toBe(B.STAGE_TARGET_VALUATION[1]! * B.ROUND_EARLY_RATIO)
    if (team.runwayNow != null && team.runwayAfter != null) expect(team.runwayAfter).toBeLessThan(team.runwayNow)
    s = { ...s, finance: { ...s.finance, mrr: 2000 } }
    expect(nextStep(s).id).toBe('grow')
    // Links are numbered along the chain.
    expect(nextStep(s).index).toBe(8)
  })

  it('a free desk skips the desk link; a ready or running round is the last link', () => {
    let s = api.createGame({ seed: 1 })
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    s = { ...s, counters: { ...s.counters, manualFinds: 1 } }
    expect(nextStep(s).id).toBe('hire')
    const hired = withTeam()
    const grown: GameState = {
      ...hired,
      stats: { ...hired.stats, users: 500 },
      finance: { ...hired.finance, mrr: 5000 },
      projects: hired.projects.map((p) => ({ ...p, launched: true })),
      derived: { ...hired.derived, canStartRound: true },
    }
    expect(nextStep(grown).id).toBe('round')
    expect(nextStep({ ...grown, round: { active: true, targetStage: 1, startedDay: 0, weeksTotal: 4, weeksLeft: 1, offer: { amount: 1, equity: 0.1, preMoney: 9 }, baseValuation: 1 } }).id).toBe('roundWait')
  })
})

describe('horizon (ufuk şeridi)', () => {
  it('lists paydays, delayed decision effects with their source card and release ETAs, sorted', () => {
    const dapi = createEngine(fakeContent({ decisions: [fakeCard('c1')] }))
    let s = dapi.createGame({ seed: 1 })
    s = dapi.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    s = dapi.applyAction(s, { type: 'startProject', category: 'web' }).state
    s = dapi.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id }).state
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = dapi.step(s, 1)
    s = dapi.applyAction(s, { type: 'answerDecision', cardId: 'c1', optionIndex: 1 }).state
    const h = horizon(s)
    const delayed = h.find((x) => x.kind === 'delayed')!
    expect(delayed.cardId).toBe('c1')
    expect(delayed.optionIndex).toBe(1)
    expect(delayed.noteKey).toBe('n')
    expect(h.filter((x) => x.kind === 'payday').length).toBeGreaterThanOrEqual(1)
    expect(h.some((x) => x.kind === 'release' && x.level === 1)).toBe(true)
    for (let i = 1; i < h.length; i++) expect(h[i]!.day).toBeGreaterThanOrEqual(h[i - 1]!.day)
    for (const x of h) expect(x.day).toBeLessThanOrEqual(s.time.day + B.HORIZON_DAYS + 1e-9)
    // derived keeps a copy after every step.
    expect(s.derived.horizon?.length).toBe(h.length)
  })

  it('a running round shows its close; a ready round shows now', () => {
    const s = withTeam()
    const running = { ...s, round: { active: true, targetStage: 1 as const, startedDay: 0, weeksTotal: 5, weeksLeft: 2, offer: { amount: 1, equity: 0.1, preMoney: 9 }, baseValuation: 1 } }
    expect(horizon(running).find((x) => x.kind === 'roundClose')?.day).toBeCloseTo(s.time.day + 14, 6)
    const ready = { ...s, derived: { ...s.derived, canStartRound: true } }
    expect(horizon(ready).find((x) => x.kind === 'roundReady')?.day).toBe(s.time.day)
  })
})

describe('Kararın → sonucu', () => {
  it('a landed delayed effect records its card, option and effects', () => {
    const dapi = createEngine(fakeContent({ decisions: [fakeCard('c1')] }))
    let s = dapi.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = dapi.step(s, 1)
    const answered = s.time.day
    s = dapi.applyAction(s, { type: 'answerDecision', cardId: 'c1', optionIndex: 1 }).state
    expect(s.decisions.pending[0]!.sourceOption).toBe(1)
    const users = s.stats.users
    s = dapi.step(s, 6)
    const o = s.decisions.outcomes![0]!
    expect(o.cardId).toBe('c1')
    expect(o.optionIndex).toBe(1)
    expect(o.answeredDay).toBeCloseTo(answered, 6)
    expect(o.effects.users).toBe(50)
    expect(s.stats.users).toBeGreaterThanOrEqual(users + 49)
    expect(s.events.some((e) => e.kind === 'delayedEffect' && e.refId === 'c1' && e.value === 1)).toBe(true)
  })
})

describe('stage goals (☆)', () => {
  it('latches the current stage goals once, with an event; other stages wait', () => {
    let s = withTeam()
    s = { ...s, projects: s.projects.map((p) => ({ ...p, maturity: 0.199 })) }
    s = api.step(s, 2)
    expect(s.goalsDone).toEqual(['g-launch'])
    expect(s.events.filter((e) => e.kind === 'goalDone')).toHaveLength(1)
    s = api.step(s, 3)
    expect(s.goalsDone).toEqual(['g-launch'])
  })

  it('each ☆ of the stage takes a point off the equity the next round sells', () => {
    const s = withTeam()
    const ready: GameState = { ...s, goalsDone: ['g-launch'], derived: { ...s.derived, canStartRound: true } }
    const r = api.applyAction(ready, { type: 'startRound' })
    expect(r.ok).toBe(true)
    expect(r.state.round!.offer.equity).toBeCloseTo(B.ROUND_EQUITY[1]! - B.GOAL_STAR_EQUITY_DISCOUNT, 6)
    const plain = api.applyAction({ ...ready, goalsDone: [] }, { type: 'startRound' })
    expect(plain.state.round!.offer.equity).toBeCloseTo(B.ROUND_EQUITY[1]!, 6)
  })
})
