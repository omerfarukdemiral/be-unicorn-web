// Core loop, phase 1 (docs/CORE_LOOP.md §4–§6): payday + month receipt, release moments, next step chain,
// horizon, stage goals and "Kararın → sonucu".
import { describe, expect, it } from 'vitest'
import { CRISES, CRISIS_CARDS, type StageGoal } from '../../content/index'
import * as B from '../balance'
import { createEngine } from '../index'
import { releaseLevel } from '../loop'
import { daysToPayday, horizon, nextCrisis, nextStep } from '../loopSelectors'
import { migrate } from '../save'
import type { EngineApi, GameState, RoundState, StageIndex } from '../types'
import { fakeCard, fakeContent, fakeCrisis } from './fixtures'

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

describe('tech debt (GAMEPLAY V2 §4.2)', () => {
  const finished = (s: GameState, stage: GameState['stage']): GameState => ({
    ...s,
    stage,
    stats: { ...s.stats, cash: 10_000_000 },
    projects: s.projects.map((p) => ({ ...p, maturity: 1, launched: true, releaseLevel: 5, updateProgress: B.RELEASE_UPDATE_SIZE })),
  })

  it('from Series A every shipped update adds TECH_DEBT_PER_UPDATE; before it none', () => {
    const early = api.step(finished(withTeam(), 2), 0.25)
    expect(early.releases!.at(-1)!.update).toBe(1)
    expect(early.techDebt).toBe(0)
    const late = api.step(finished(withTeam(), B.TECH_DEBT_MIN_STAGE), 0.25)
    expect(late.releases!.at(-1)!.update).toBe(1)
    expect(late.techDebt).toBeCloseTo(B.TECH_DEBT_PER_UPDATE, 6)
  })

  it('each month end the engineers pay TECH_DEBT_AMORT_PER_ENG × eng back, never below 0', () => {
    let s = { ...withTeam(), techDebt: 10 }
    const eng = s.employees.filter((e) => e.dept === 'eng').length
    expect(eng).toBeGreaterThan(0)
    s = { ...s, stats: { ...s.stats, cash: 10_000_000 } }
    s = api.step(s, 29.5)
    expect(s.techDebt).toBe(10)
    s = api.step(s, 1)
    expect(s.techDebt).toBeCloseTo(10 - B.TECH_DEBT_AMORT_PER_ENG * eng, 6)
    const clean = api.step({ ...s, techDebt: 0.01 }, 30)
    expect(clean.techDebt).toBe(0)
  })

  it('debt slows the builders: speed × (1 − 0.02 × debt), floor 0.5', () => {
    const s = withTeam()
    const rate = (debt: number) => Object.values(api.step({ ...s, techDebt: debt }, 0.01).derived.maturityPerDay!)[0]!
    expect(rate(10) / rate(0)).toBeCloseTo(1 - 10 * B.TECH_DEBT_PER_POINT, 3)
    expect(rate(1000) / rate(0)).toBeCloseTo(B.TECH_DEBT_MIN_SPEED, 3)
  })
})

describe('next step chain (sıradaki adım)', () => {
  it('from Seed below $1K MRR the valuation line adds up: revenue part + the fading pre-revenue part', () => {
    const base = withTeam()
    const s0: GameState = { ...base, stage: 2, projects: base.projects.map((p) => ({ ...p, maturity: 0.3, launched: true, releaseLevel: 1 })), stats: { ...base.stats, users: 40 } }
    const v = api.step(s0, 0.01).derived.valuationParts!
    expect(v.mode).toBe('post')
    expect(v.blend).toBeGreaterThan(0)
    expect(v.blend).toBeLessThan(1)
    expect(v.preFade).toBeGreaterThan(0)
    expect(v.mrr * 12 * v.multiple * v.blend + v.preFade).toBeCloseTo(v.total, 6)
  })

  it('garage: idea → first users → desk → hire → launch → users → traction → grow', () => {
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
    // Pre-revenue the valuation link is traction (users + releases), not the team (GAMEPLAY V2 §4.1).
    const traction = nextStep(s)
    expect(traction.id).toBe('traction')
    expect(traction.value).toBeUndefined()
    expect(traction.target).toBe(B.STAGE_TARGET_VALUATION[1]! * B.ROUND_EARLY_RATIO)
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

describe('crisis calendar (GAMEPLAY V2 §5.1)', () => {
  const CARD = fakeCard('card-storm', { category: 'crisis', once: false, condition: () => false })
  const NORMAL = fakeCard('c-normal', { condition: () => false })
  const capi = createEngine(fakeContent({ decisions: [CARD, NORMAL, fakeCard('card-gale', { category: 'crisis', once: false, condition: () => false })], crises: [fakeCrisis('storm', 1), fakeCrisis('gale', 2)] }))

  /** A rich garage (no bankruptcy over long runs). */
  function rich(e: EngineApi, seed = 1): GameState {
    const s = e.createGame({ seed })
    return { ...s, stats: { ...s.stats, cash: 50_000_000 } }
  }

  /** Closes a one-week round into `target` (the real close: rng chain progressRound → closeRound → enterStage). */
  function closeInto(e: EngineApi, s: GameState, target: StageIndex): GameState {
    const round: RoundState = { active: true, targetStage: target, startedDay: s.time.day, weeksTotal: 1, weeksLeft: 1, offer: { amount: 1000, equity: 0.01, preMoney: 0 }, baseValuation: 1 }
    const out = e.step({ ...s, round }, 7)
    expect(out.stage).toBe(target)
    return out
  }

  const stepTo = (e: EngineApi, s: GameState, day: number): GameState => e.step(s, day - s.time.day)
  const pending = (s: GameState) => (s.calendar ?? []).filter((c) => !c.fired)

  it('the first crisis lands 30–80 days after arriving at Pre-seed; the garage has none', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const garage = capi.step(rich(capi, seed), 5)
      expect(garage.calendar).toEqual([])
      const s = closeInto(capi, garage, 1)
      const up = s.events.find((ev) => ev.kind === 'stageUp')!
      const [c] = s.calendar!
      expect(s.calendar).toHaveLength(1)
      expect(c!.id).toBeNull()
      expect(c!.day - up.day).toBeGreaterThanOrEqual(B.CRISIS_FIRST_DAYS[0])
      expect(c!.day - up.day).toBeLessThanOrEqual(B.CRISIS_FIRST_DAYS[1] + 1)
      expect(c!.revealDay).toBe(c!.day - B.CRISIS_TELEGRAPH_DAYS)
    }
  })

  it('a stage change keeps the pending date and never stacks a second crisis', () => {
    const s = closeInto(capi, rich(capi, 3), 1)
    const day = s.calendar![0]!.day
    const seed = closeInto(capi, s, 2)
    expect(seed.calendar).toHaveLength(1)
    expect(seed.calendar![0]!.day).toBe(day)
    // Drawn on the reveal day from the stage it is in then: Seed's pool.
    const revealed = stepTo(capi, seed, day - 20)
    expect(revealed.calendar![0]!.id).toBe('gale')
    expect(revealed.events.some((ev) => ev.kind === 'crisisRevealed' && ev.refId === 'gale')).toBe(true)
  })

  it('crises come 150–300 days apart; a used pool repeats the last one, lighter', () => {
    let s = closeInto(capi, rich(capi, 5), 1)
    s = capi.step(s, 1300)
    const fired = s.calendar!.filter((c) => c.fired)
    expect(fired.length).toBeGreaterThanOrEqual(5)
    for (let i = 1; i < fired.length; i++) {
      expect(fired[i]!.day - fired[i - 1]!.day).toBeGreaterThanOrEqual(B.CRISIS_GAP_MIN)
      expect(fired[i]!.day - fired[i - 1]!.day).toBeLessThanOrEqual(B.CRISIS_GAP_MAX)
    }
    expect(fired[0]!.id).toBe('storm')
    expect(fired[1]!.light).toBe(true)
    expect(pending(s)).toHaveLength(1)
    // The lighter repeat lands at × CRISIS_LIGHT_SEVERITY and still brings its card (always a way to soften it, §18).
    const sev = B.CRISIS_SEVERITY_BASE + B.CRISIS_SEVERITY_PER_PRESSURE * B.DIRECTOR_PRESSURE_DEFAULT
    expect(s.events.filter((ev) => ev.kind === 'crisis').at(-1)!.value).toBeCloseTo(sev * B.CRISIS_LIGHT_SEVERITY, 9)
    const storm = s.decisions.history.filter((h) => h.cardId === 'card-storm').length + (s.decisions.active?.cardId === 'card-storm' ? 1 : 0)
    expect(storm).toBe(fired.length)
  })

  it('the crisis card takes the slot of a rolled card: no roll in the reserve window before a crisis day', () => {
    const roll = fakeCard('c-roll', { once: false })
    const e = createEngine(fakeContent({ decisions: [CARD, roll], crises: [fakeCrisis('storm', 1)] }))
    let s = closeInto(e, rich(e, 7), 1)
    s = e.step(s, 1300)
    const crisisDays = s.calendar!.filter((c) => c.fired).map((c) => c.day)
    const rolled = s.events.filter((ev) => ev.kind === 'decisionShown' && ev.refId === 'c-roll')
    for (const ev of rolled) for (const d of crisisDays) expect(ev.day > d - B.CRISIS_CARD_RESERVE_DAYS && ev.day <= d).toBe(false)
  })

  it('a rescue on the desk stays first: the crisis card waits behind it', () => {
    const rescue = fakeCard('bridge', { category: 'crisis', once: false, condition: () => false })
    const e = createEngine(fakeContent({ decisions: [CARD, rescue], crises: [fakeCrisis('storm', 1)] }))
    let s = closeInto(e, rich(e, 2), 1)
    const day = s.calendar![0]!.day
    s = stepTo(e, s, day - 1)
    s = { ...s, decisions: { ...s.decisions, active: { cardId: 'bridge', shownDay: s.time.day } } }
    s = stepTo(e, s, day)
    expect(s.decisions.active?.cardId).toBe('bridge')
    expect(s.decisions.queue[0]).toBe('card-storm')
  })

  it('investor winter prices the multiple: the ceiling × ~0.6 (above the floor) and a higher growth ask', () => {
    const winter = CRISES.find((c) => c.id === 'investor-winter')!
    const e = createEngine(fakeContent({ decisions: [...CRISIS_CARDS], crises: [{ ...winter, stage: 1 }] }))
    let s = closeInto(e, rich(e, 3), 1)
    const day = s.calendar![0]!.day
    s = stepTo(e, s, day - 1)
    const cap = s.derived.multipleCap!
    s = stepTo(e, s, day)
    expect(s.modifiers.some((m) => m.kind === 'multipleCap' && m.source === 'crisis:investor-winter')).toBe(true)
    const sev = B.CRISIS_SEVERITY_BASE + B.CRISIS_SEVERITY_PER_PRESSURE * B.DIRECTOR_PRESSURE_DEFAULT
    expect(s.derived.multipleCap!).toBeCloseTo(Math.max(B.MULTIPLE_MIN_BY_STAGE[1]!, cap * (1 - 0.4 * sev)), 9)
    expect(s.derived.multipleCap!).toBeLessThan(cap)
    expect(s.derived.multipleCap!).toBeGreaterThanOrEqual(B.MULTIPLE_MIN_BY_STAGE[1]!)
  })

  it('crisis day: the effects land at severity and the crisis card comes first', () => {
    let s = closeInto(capi, rich(capi, 2), 1)
    const day = s.calendar![0]!.day
    s = stepTo(capi, s, day - 1)
    // An unanswered normal card is on the desk the day before.
    s = { ...s, decisions: { ...s.decisions, active: { cardId: 'c-normal', shownDay: s.time.day } } }
    s = stepTo(capi, s, day)
    const sev = B.CRISIS_SEVERITY_BASE + B.CRISIS_SEVERITY_PER_PRESSURE * B.DIRECTOR_PRESSURE_DEFAULT
    const mod = s.modifiers.find((m) => m.source === 'crisis:storm')!
    expect(mod.kind).toBe('churn')
    expect(mod.value).toBeCloseTo(1 + 0.5 * sev, 9)
    expect(mod.untilDay).toBe(day + 90)
    expect(s.events.find((ev) => ev.kind === 'crisis')).toMatchObject({ refId: 'storm', day })
    expect(s.decisions.active?.cardId).toBe('card-storm')
    expect(s.calendar![0]!.fired).toBe(true)
    expect(pending(s)).toHaveLength(1)
    // One card a day: the pushed normal card is not queued behind it, it waits for the shared cooldown.
    expect(s.decisions.queue).not.toContain('c-normal')
    expect(s.events.filter((ev) => ev.kind === 'decisionShown' && ev.day === day)).toHaveLength(1)
    s = capi.applyAction(s, { type: 'answerDecision', cardId: 'card-storm', optionIndex: 0 }).state
    const after = capi.step(s, B.CARD_COOLDOWN_DAYS - 1)
    expect(after.events.filter((ev) => ev.kind === 'decisionShown' && ev.day > day)).toHaveLength(0)
    expect(after.decisions.lastCardDay).toBe(day)
  })

  it('horizon: "?" from 60 days ahead, the id from 30 days ahead', () => {
    let s = closeInto(capi, rich(capi, 4), 1)
    const day = s.calendar![0]!.day
    s = capi.step(s, 1)
    if (day - s.time.day > 58) {
      s = stepTo(capi, s, day - 58)
      const far = horizon(s).find((h) => h.kind === 'crisis')!
      expect(far).toMatchObject({ day, hidden: true })
      expect(far.crisisId).toBeUndefined()
    }
    expect(horizon(s).some((h) => h.kind === 'crisis')).toBe(day - s.time.day <= B.CRISIS_HORIZON_DAYS)
    s = stepTo(capi, s, day - 29)
    expect(horizon(s).find((h) => h.kind === 'crisis')).toMatchObject({ day, hidden: false, crisisId: 'storm' })
    expect(nextCrisis(s)).toEqual({ day, id: 'storm', hidden: false })
    expect(s.derived.nextCrisis).toEqual({ day, id: 'storm', hidden: false })
  })

  it('the first-crisis 58-day "?" (a date far enough ahead)', () => {
    // Find a seed whose first crisis lands ≥ 60 days out, then look at it 58 days before.
    for (let seed = 1; seed <= 30; seed++) {
      let s = closeInto(capi, rich(capi, seed), 1)
      const day = s.calendar![0]!.day
      if (day - s.time.day < 60) continue
      s = stepTo(capi, s, day - 58)
      expect(horizon(s).find((h) => h.kind === 'crisis')).toMatchObject({ day, hidden: true })
      expect(nextCrisis(s)).toEqual({ day, hidden: true })
      expect(s.derived.nextCrisis).toEqual({ day, hidden: true })
      return
    }
    throw new Error('no seed with a first crisis ≥ 60 days out')
  })

  it('same seed → same calendar (across round closes and step batching)', () => {
    const run = (batch: number) => {
      let s = closeInto(capi, rich(capi, 9), 1)
      for (let d = 0; d < 400; d += batch) s = capi.step(s, batch)
      s = closeInto(capi, s, 2)
      return capi.step(s, 500).calendar
    }
    const a = run(1)
    expect(a!.length).toBeGreaterThanOrEqual(3)
    expect(run(1)).toEqual(a)
    expect(run(50)).toEqual(a)
    const other = (() => {
      let s = closeInto(capi, rich(capi, 10), 1)
      s = capi.step(s, 400)
      return capi.step(closeInto(capi, s, 2), 500).calendar
    })()
    expect(other).not.toEqual(a)
  })

  it('an old v3 save opens and schedules its crisis on the first day (lazily, deterministically)', () => {
    const s = closeInto(capi, closeInto(capi, rich(capi, 6), 1), 2)
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>
    delete old.calendar
    const load = () => migrate({ version: 3, state: JSON.parse(JSON.stringify(old)) })!
    const loaded = load()
    expect(loaded.calendar).toEqual([])
    const a = capi.step(loaded, 1)
    expect(a.calendar).toHaveLength(1)
    expect(a.calendar![0]!.day).toBeGreaterThanOrEqual(a.time.day + B.CRISIS_TELEGRAPH_DAYS - 1)
    expect(capi.step(load(), 1).calendar).toEqual(a.calendar)
    // A v4 save from before the calendar (no field at all) defaults lazily too.
    const bare = { ...s }
    delete bare.calendar
    expect(capi.step(bare, 1).calendar).toHaveLength(1)
  })

  it('runs without crisis content: the dates pass quietly', () => {
    let s = closeInto(api, rich(api, 1), 1)
    s = api.step(s, 400)
    expect(s.calendar!.filter((c) => c.fired).length).toBeGreaterThanOrEqual(1)
    expect(s.calendar!.every((c) => c.id === null)).toBe(true)
    expect(s.events.some((ev) => ev.kind === 'crisis')).toBe(false)
  })

  it('the card budget: CARD_DAILY_CHANCE 0.08; every crisis has its calendar-only card within the text budgets', () => {
    expect(B.CARD_DAILY_CHANCE).toBe(0.08)
    const words = (t: string) => t.trim().split(/\s+/).length
    expect(new Set(CRISES.map((c) => c.stage)).size).toBe(CRISES.length)
    for (const c of CRISES) {
      const card = CRISIS_CARDS.find((x) => x.id === c.cardId)!
      expect(card.category).toBe('crisis')
      expect(card.condition?.(rich(api))).toBe(false)
      expect(card.options).toHaveLength(2)
      expect(words(card.question)).toBeLessThanOrEqual(12)
      for (const o of card.options) expect(words(o.label)).toBeLessThanOrEqual(5)
      expect(words(c.name)).toBeLessThanOrEqual(6)
    }
  })
})
