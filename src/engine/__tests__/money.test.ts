// Phase 3 (docs/CORE_LOOP.md §5, §10 Faz 3): money constraint, stage multiple cap, unanswered card default,
// delayed effects inside the horizon, rescue loan → debt, v1 → v2 save migration; GAMEPLAY V2 §6.2 the loan,
// §6.1 the payday desk.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { createEngine } from '../index'
import { migrate } from '../save'
import { CRISIS_CARDS, DECISIONS, type DecisionCard } from '../../content/index'
import { isCardEligible } from '../decisions'
import { autoPaydayChoice } from '../loop'
import { adBudgetSteps, covenantState, nearestPriceStep, owedTotal, PRICE_STEPS, roundEndRunway, runwayAt } from '../loopSelectors'
import { COMPANY_NAME_MAX, DEFAULT_COMPANY_NAME, SAVE_VERSION, type GameState, type MonthReceipt, type PaydayChoice } from '../types'
import { fakeCard, fakeContent } from './fixtures'

describe('garage money (S1-b)', () => {
  it('starts with $15K and a $1.2K founder living cost in the burn', () => {
    const api = createEngine(fakeContent())
    const s = api.step(api.createGame({ seed: 1 }), 1)
    expect(s.stats.cash).toBeLessThanOrEqual(B.START_CASH)
    expect(s.finance.burnBreakdown.founder).toBe(B.FOUNDER_LIVING_COST[0])
    expect(s.finance.burn).toBeGreaterThanOrEqual(B.FOUNDER_LIVING_COST[0]!)
    // ~10 months of runway with no team.
    expect(s.finance.runway!).toBeGreaterThan(8)
    expect(s.finance.runway!).toBeLessThan(13)
  })

  it('the derived multiple is capped by the stage ceiling', () => {
    const api = createEngine(fakeContent())
    const s = api.step(api.createGame({ seed: 1 }), 1)
    expect(s.derived.multipleCap).toBe(B.MULTIPLE_MAX_BY_STAGE[0])
    expect(s.derived.valuationMultiple).toBeLessThanOrEqual(s.derived.multipleCap!)
  })
})

describe('costs scale (GAMEPLAY V2 §4.2)', () => {
  const api = createEngine(fakeContent())
  /** A garage with one hire on day 0 and deep pockets (the test is about salaries, not survival). */
  function hired(): GameState {
    let s = api.createGame({ seed: 1 })
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    const c = s.candidates.find((x) => x.dept === 'eng') ?? s.candidates[0]!
    s = api.applyAction(s, { type: 'hire', candidateId: c.id }).state
    return { ...s, stats: { ...s.stats, cash: 50_000_000 } }
  }

  it('yearly raise: none on the first payday, × 1.08 by day 361, not again on day 391', () => {
    let s = hired()
    const pay0 = s.employees[0]!.salary
    s = api.step(s, 30.5)
    expect(s.employees[0]!.salary).toBe(pay0)
    s = api.step(s, 361 - s.time.day)
    expect(s.employees[0]!.salary).toBeCloseTo(pay0 * (1 + B.RAISE_YEARLY), 6)
    expect(s.employees[0]!.raises).toBe(1)
    s = api.step(s, 391 - s.time.day)
    expect(s.employees[0]!.salary).toBeCloseTo(pay0 * (1 + B.RAISE_YEARLY), 6)
    expect(s.employees[0]!.raises).toBe(1)
    // The raise shows in the burn right away; the month it was earned in was paid at the old salary.
    expect(s.finance.burnBreakdown.salaries).toBeCloseTo(pay0 * (1 + B.RAISE_YEARLY), 6)
  })

  it('an old save (no raises field) counts the years served as paid: no back pay, the next anniversary raises', () => {
    let s = hired()
    s = api.step(s, 700)
    const old = structuredClone(s)
    const pay = old.employees[0]!.salary
    delete old.employees[0]!.raises
    let next = api.step(old, 30)
    const years = Math.floor((next.time.day - next.employees[0]!.hiredDay) / B.RAISE_EVERY_DAYS)
    expect(next.employees[0]!.raises).toBe(years)
    expect(next.employees[0]!.salary).toBeCloseTo(pay, 6)
    next = api.step(next, (years + 1) * B.RAISE_EVERY_DAYS + 31 - next.time.day)
    expect(next.employees[0]!.raises).toBe(years + 1)
    expect(next.employees[0]!.salary).toBeCloseTo(pay * (1 + B.RAISE_YEARLY), 6)
  })

  it('infra is at least the stage share of MRR (the bill grows with the business)', () => {
    let s = hired()
    s = { ...s, stage: 4, stats: { ...s.stats, users: 20_000 }, projects: s.projects.map((p) => ({ ...p, maturity: 1, launched: true, releaseLevel: 5 })) }
    s = api.step(s, 0.01)
    const byUsers = (s.stats.users / 1000) * B.INFRA_PER_1000_BY_STAGE[4]!
    const byMrr = s.finance.mrr * B.INFRA_MRR_SHARE[4]!
    expect(byMrr).toBeGreaterThan(byUsers)
    expect(s.finance.burnBreakdown.infra).toBeCloseTo(byMrr, 3)
  })

  it('churn × (1 + techDebt / 200)', () => {
    let s = hired()
    s = { ...s, stats: { ...s.stats, users: 300 }, projects: s.projects.map((p) => ({ ...p, maturity: 0.5, launched: true, releaseLevel: 2 })) }
    const clean = api.step({ ...s, techDebt: 0 }, 0.01)
    const debt = api.step({ ...s, techDebt: 40 }, 0.01)
    expect(debt.stats.churn / clean.stats.churn).toBeCloseTo(1 + 40 / B.TECH_DEBT_CHURN_DIV, 3)
  })

  it('refactorSprint (Series A on): −(8 + eng) debt, production × 0.7 for 30 days, 90-day cooldown', () => {
    let s = hired()
    expect(api.applyAction({ ...s, techDebt: 50 }, { type: 'founderAction', kind: 'refactorSprint' }).error).toBe('notUnlocked')
    s = { ...s, stage: 3, techDebt: 50 }
    expect(api.applyAction({ ...s, techDebt: 0 }, { type: 'founderAction', kind: 'refactorSprint' }).error).toBe('notFound')
    const eng = s.employees.filter((e) => e.dept === 'eng').length
    const r = api.applyAction(s, { type: 'founderAction', kind: 'refactorSprint' })
    expect(r.ok).toBe(true)
    s = api.step(r.state, B.FOUNDER_ACTION_DEFS.refactorSprint.durationDays + 0.5)
    expect(s.techDebt).toBeCloseTo(50 - (B.REFACTOR_DEBT_BASE + eng), 6)
    const mod = s.modifiers.find((m) => m.source === 'refactorSprint')!
    expect(mod.kind).toBe('production')
    expect(mod.value).toBe(B.REFACTOR_PRODUCTION)
    expect(mod.untilDay - s.time.day).toBeGreaterThan(B.REFACTOR_DAYS - 1)
    s = api.step(s, 60)
    expect(api.applyAction(s, { type: 'founderAction', kind: 'refactorSprint' }).error).toBe('cooldown')
    s = api.step(s, B.REFACTOR_COOLDOWN_DAYS - 60 + 1)
    expect(api.applyAction(s, { type: 'founderAction', kind: 'refactorSprint' }).ok).toBe(true)
  })
})

describe('unanswered card default (Cevapsız kalırsa)', () => {
  it('applies the written default option after DECISION_DEFAULT_AFTER_DAYS', () => {
    const api = createEngine(fakeContent({ decisions: [fakeCard('c1', { defaultOption: 0 })] }))
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    const shown = s.decisions.active!.shownDay
    const cash = s.stats.cash
    s = api.step(s, B.DECISION_DEFAULT_AFTER_DAYS - 2)
    expect(s.decisions.active?.cardId).toBe('c1')
    s = api.step(s, 3)
    expect(s.time.day - shown).toBeGreaterThanOrEqual(B.DECISION_DEFAULT_AFTER_DAYS)
    expect(s.decisions.active?.cardId).not.toBe('c1')
    expect(s.events.some((e) => e.kind === 'decisionDefaulted' && e.refId === 'c1' && e.value === 0)).toBe(true)
    // Option 0 gave +$1000 (costs of the days in between are far smaller than a payday here? no: compare history).
    expect(s.decisions.history.some((h) => h.cardId === 'c1' && h.optionIndex === 0)).toBe(true)
    expect(Number.isFinite(cash)).toBe(true)
  })

  it('without defaultOption the last option is the default', () => {
    const api = createEngine(fakeContent({ decisions: [fakeCard('c1')] }))
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    s = api.step(s, B.DECISION_DEFAULT_AFTER_DAYS + 1)
    expect(s.decisions.history.some((h) => h.cardId === 'c1' && h.optionIndex === 1)).toBe(true)
  })
})

describe('delayed effects stay on the horizon', () => {
  it('a long delay is capped at DECISION_DELAY_MAX_DAYS', () => {
    const card = fakeCard('c1')
    card.options[1]!.delayed = { days: 120, effects: { users: 10 }, note: 'n' }
    const api = createEngine(fakeContent({ decisions: [card] }))
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    s = api.applyAction(s, { type: 'answerDecision', cardId: 'c1', optionIndex: 1 }).state
    const p = s.decisions.pending.find((x) => x.sourceCardId === 'c1')!
    expect(p.applyDay - s.time.day).toBeLessThanOrEqual(B.DECISION_DELAY_MAX_DAYS + 1e-9)
  })
})

describe('rescue loan', () => {
  it('cash from a legacy emergencyLoan flag becomes the loan (finance.debt mirrors its balance)', () => {
    const card = fakeCard('loan', {
      options: [{ label: 'a', tradeoff: { gain: 'g', cost: 'c' }, effects: { cash: 15_000, setFlag: 'emergencyLoan' }, reflection: 'r' }],
    })
    const api = createEngine(fakeContent({ decisions: [card] }))
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    s = api.applyAction(s, { type: 'answerDecision', cardId: 'loan', optionIndex: 0 }).state
    expect(s.finance.debt).toBe(15_000)
    expect(s.finance.loan!.balance).toBe(15_000)
    expect(s.finance.loan!.rateMonthly).toBe(B.LOAN_LEGACY_RATE)
  })
})

describe('the loan (GAMEPLAY V2 §6.2: şeytanla anlaşma)', () => {
  const TERMS = { burnMonths: 3, months: 12, rate: 0.03, covenantRunway: 1 }
  const loanCard = (id: string, terms = TERMS): DecisionCard =>
    fakeCard(id, {
      category: 'crisis',
      options: [
        { label: 'a', tradeoff: { gain: 'g', cost: 'c' }, effects: { loan: terms }, reflection: 'r' },
        { label: 'b', tradeoff: { gain: 'g', cost: 'c' }, effects: { morale: 1 }, reflection: 'r' },
      ],
    })
  const api = createEngine(fakeContent({ decisions: [loanCard('loan'), loanCard('loan-2', { burnMonths: 4, months: 9, rate: 0.02, covenantRunway: 2 })] }))

  /** A garage with one hire and no revenue (nothing launched), `cash` in the bank, day 0. */
  function garage(cash: number): GameState {
    let s = api.createGame({ seed: 1 })
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    const c = s.candidates.find((x) => x.dept === 'eng') ?? s.candidates[0]!
    s = api.applyAction(s, { type: 'hire', candidateId: c.id }).state
    return { ...s, stats: { ...s.stats, cash } }
  }

  /** The loan card comes (queued) and its loan option is taken. */
  function borrow(s: GameState, id = 'loan'): GameState {
    s = api.step({ ...s, decisions: { ...s.decisions, queue: [id] } }, 1)
    expect(s.decisions.active?.cardId).toBe(id)
    return api.applyAction(s, { type: 'answerDecision', cardId: id, optionIndex: 0 }).state
  }

  it('takes max(burn × burnMonths, LOAN_MIN[stage]) into cash; debt mirrors the balance', () => {
    const s0 = api.step(garage(50_000), 1)
    const s = borrow(s0)
    const loan = s.finance.loan!
    const amount = Math.round(Math.max(s0.finance.burn * TERMS.burnMonths, B.LOAN_MIN[0]!))
    expect(loan.principal).toBeCloseTo(amount, -1)
    expect(loan.balance).toBe(loan.principal)
    expect(s.finance.debt).toBe(loan.balance)
    expect(loan.covenantFromDay - s.time.day).toBeCloseTo(B.LOAN_COVENANT_GRACE_DAYS, 0)
    expect(loan.interestOnlyUntil - s.time.day).toBeCloseTo(B.LOAN_INTEREST_ONLY_MONTHS * 30, 0)
    expect(s.events.some((e) => e.kind === 'loanTaken')).toBe(true)
  })

  it('payday pays the interest on the receipt; no principal for the first 6 months, then amortization', () => {
    let s = borrow(garage(50_000_000))
    const loan0 = s.finance.loan!
    s = api.step(s, 30 - s.time.day + 0.5)
    const r = s.finance.lastReceipt!
    expect(r.interest).toBeCloseTo(loan0.balance * loan0.rateMonthly, 6)
    expect(r.loanRepay ?? 0).toBe(0)
    expect(r.paid).toBeGreaterThan(r.salaries + r.rent + r.infra + r.ads + (r.founder ?? 0))
    expect((s.finance.receipts!.at(-1) as MonthReceipt).interest).toBe(Math.round(r.interest!))
    // Interest only until interestOnlyUntil (6 months): every payday before it repays nothing.
    while (s.time.day + 30 < loan0.interestOnlyUntil) {
      s = api.step(s, 30)
      expect(s.finance.lastReceipt!.loanRepay ?? 0).toBe(0)
      expect(s.finance.loan!.balance).toBe(loan0.balance)
    }
    s = api.step(s, 60)
    expect(s.finance.lastReceipt!.loanRepay!).toBeGreaterThan(0)
    expect(s.finance.loan!.balance).toBeLessThan(loan0.balance)
    expect(s.finance.debt).toBe(s.finance.loan!.balance)
  })

  it('the covenant is not measured for 90 days; then warning → half called (rate × 1.5) → the rest called', () => {
    let s = borrow(garage(50_000_000))
    // Raise the bar out of reach: every measured payday is a breach.
    s = { ...s, finance: { ...s.finance, loan: { ...s.finance.loan!, covenantRunway: 1e12 } } }
    const from = s.finance.loan!.covenantFromDay
    // Every payday before covenantFromDay (30, 60, 90) passes unmeasured.
    const firstMeasured = Math.ceil(from / 30) * 30
    while (s.time.day + 30 < firstMeasured) {
      s = api.step(s, 30)
      expect(s.finance.loan!.breaches).toBe(0)
    }
    s = api.step(s, firstMeasured - 0.5 - s.time.day)
    expect(s.finance.loan!.breaches).toBe(0)
    expect(s.events.some((e) => e.kind === 'loanWarning')).toBe(false)
    s = api.step(s, 1)
    expect(s.finance.loan!.breaches).toBe(1)
    expect(s.events.some((e) => e.kind === 'loanWarning' && e.refId === 'warn')).toBe(true)
    const before = s.finance.loan!
    const cash = s.stats.cash
    s = api.step(s, 30)
    expect(s.finance.loan!.breaches).toBe(2)
    expect(s.finance.loan!.balance).toBeCloseTo(before.balance * (1 - B.LOAN_CALL_SHARE), 3)
    expect(s.finance.loan!.rateMonthly).toBeCloseTo(before.rateMonthly * B.LOAN_CALL_RATE_MULT, 9)
    expect(s.events.some((e) => e.kind === 'loanWarning' && e.refId === 'half')).toBe(true)
    expect(cash - s.stats.cash).toBeGreaterThan(before.balance * B.LOAN_CALL_SHARE)
    // The called money is on the receipt (with the instalment), so the receipt explains the cash drop.
    expect(s.finance.lastReceipt!.loanRepay).toBeCloseTo(before.balance * B.LOAN_CALL_SHARE, 3)
    const half = s.finance.loan!.balance
    s = api.step(s, 30)
    expect(s.finance.lastReceipt!.loanRepay).toBeCloseTo(half, 3)
    expect(s.finance.loan).toBeUndefined()
    expect(s.finance.debt).toBe(0)
    expect(s.events.some((e) => e.kind === 'loanCalled')).toBe(true)
  })

  it('a company with no revenue that takes the loan lives ≥ 90 days without closing a round', () => {
    const s0 = api.step(garage(500), 1)
    expect(s0.finance.mrr).toBe(0)
    let s = borrow(s0)
    s = api.step(s, 92)
    expect(s.gameOver).toBeUndefined()
    expect(s.finance.loan!.breaches).toBe(0)
    expect(s.time.day).toBeGreaterThanOrEqual(90)
  })

  it('one loan only: with a loan running every loan offer is closed (eligibility and the queue)', () => {
    let s = borrow(garage(50_000_000))
    const p = s.finance.loan!.principal
    const card2 = loanCard('loan-2')
    expect(isCardEligible(card2, s)).toBe(false)
    expect(isCardEligible(card2, { ...s, finance: { ...s.finance, loan: undefined, debt: 0 } })).toBe(true)
    // An older save's debt before its lazy loan is written counts as a running loan.
    expect(isCardEligible(card2, { ...s, finance: { ...s.finance, loan: undefined, debt: 5_000 } })).toBe(false)
    s = api.step({ ...s, decisions: { ...s.decisions, active: undefined, queue: ['loan-2'] } }, 1)
    expect(s.decisions.active?.cardId).not.toBe('loan-2')
    expect(s.finance.loan!.principal).toBe(p)
    // The real rescue and bridge cards close too.
    const rescue = DECISIONS.find((c) => c.id === B.RESCUE_CARD_ID)!
    const bridge = DECISIONS.find((c) => c.id === B.BRIDGE_CARD_ID)!
    const broke = { ...s, stats: { ...s.stats, cash: -100 } }
    expect(rescue.condition!(broke)).toBe(false)
    expect(rescue.condition!({ ...broke, finance: { ...broke.finance, loan: undefined } })).toBe(true)
    expect(isCardEligible(bridge, broke)).toBe(false)
    expect(rescue.options.some((o) => o.effects.loan)).toBe(true)
  })
})

describe('a legacy loan flag never stacks on the running loan', () => {
  it('with a loan running, the option brings no cash and takes no equity', () => {
    const card = fakeCard('legacy', {
      category: 'crisis',
      options: [{ label: 'a', tradeoff: { gain: 'g', cost: 'c' }, effects: { cash: 2_000_000, equity: -0.02, setFlag: 'bridgeLoan' }, reflection: 'r' }],
    })
    const api = createEngine(fakeContent({ decisions: [card] }))
    let s = api.createGame({ seed: 1 })
    const loan = { principal: 20_000, balance: 20_000, rateMonthly: 0.03, monthsLeft: 12, covenantRunway: 1, covenantFromDay: 999, interestOnlyUntil: 999, breaches: 0 }
    s = api.step({ ...s, finance: { ...s.finance, loan, debt: loan.balance }, decisions: { ...s.decisions, queue: ['legacy'] } }, 1)
    expect(s.decisions.active?.cardId).toBe('legacy')
    const cash = s.stats.cash
    const equity = s.stats.equity
    s = api.applyAction(s, { type: 'answerDecision', cardId: 'legacy', optionIndex: 0 }).state
    expect(s.stats.cash).toBe(cash)
    expect(s.stats.equity).toBe(equity)
    expect(s.finance.loan!.principal).toBe(20_000)
    expect(s.finance.debt).toBe(20_000)
  })
})

describe('save v3 → v4 (GAMEPLAY V2 §3.1: loan, strikes, stage reports)', () => {
  it('an old debt becomes the loan on the legacy terms; a running round gets 0 strikes; no stage reports', () => {
    const api = createEngine(fakeContent())
    const s = api.step(api.createGame({ seed: 1 }), 40)
    const v3 = structuredClone(s) as unknown as Record<string, unknown>
    const fin = v3.finance as Record<string, unknown>
    fin.debt = 20_000
    delete fin.loan
    delete v3.stageReports
    v3.round = { active: true, targetStage: 1, startedDay: 30, weeksTotal: 8, weeksLeft: 6, offer: { amount: 1000, equity: 0.1, preMoney: 0 }, baseValuation: 1 }
    const out = migrate({ version: 3, state: v3 })!
    expect(out.finance.loan).toEqual({
      principal: 20_000, balance: 20_000, rateMonthly: 0.02, monthsLeft: 12, covenantRunway: 1,
      covenantFromDay: s.time.day + 90, interestOnlyUntil: s.time.day + 180, breaches: 0,
    })
    expect(out.round!.strikes).toBe(0)
    expect(out.round!.ddStart).toBeUndefined()
    expect(out.stageReports).toEqual([])
    // No debt: no loan.
    const clean = migrate({ version: 3, state: structuredClone(s) })!
    expect(clean.finance.loan).toBeUndefined()
    // The engine defaults the same lazily (a v4 save with debt but no loan).
    const lazy = api.step({ ...s, finance: { ...s.finance, debt: 20_000 } }, 30)
    expect(lazy.finance.loan!.principal).toBe(20_000)
  })
})

describe('save v1 → v2', () => {
  it('a v1 save already counting negative-cash days keeps its clock as a missed payday', () => {
    const api = createEngine(fakeContent())
    const s = api.createGame({ seed: 1 })
    const v1 = structuredClone(s) as unknown as Record<string, unknown>
    ;(v1.finance as { negativeCashDays: number }).negativeCashDays = 12
    delete (v1.finance as { payrollMissed?: boolean }).payrollMissed
    const out = migrate({ version: 1, state: v1 })!
    expect(out.finance.payrollMissed).toBe(true)
    expect(out.meta.saveVersion).toBe(SAVE_VERSION)
    const calm = migrate({ version: 1, state: structuredClone(s) })!
    expect(calm.finance.payrollMissed).toBeFalsy()
  })
})

describe('save chain v1 → v4', () => {
  it('a v1 save walks every migration and lands on the current version with v4 defaults', () => {
    const api = createEngine(fakeContent())
    const v1 = structuredClone(api.step(api.createGame({ seed: 1 }), 65)) as unknown as { meta: Record<string, unknown>; finance: Record<string, unknown>; founder: Record<string, unknown> }
    delete v1.meta.companyName
    delete v1.finance.receipts
    delete v1.finance.netHistory
    delete v1.founder.moves
    const out = migrate({ version: 1, state: v1 })!
    expect(out.meta.saveVersion).toBe(SAVE_VERSION)
    expect(out.meta.companyName).toBe(DEFAULT_COMPANY_NAME)
    expect(out.finance.receipts).toHaveLength(out.finance.mrrHistory.length)
    expect(out.finance.netHistory).toEqual([])
    // GAMEPLAY V2 §7.1: a full week of moves from the day of the load.
    expect(out.founder.moves).toEqual({ left: B.MOVES_PER_WEEK[B.MOVES_FROM_STAGE], weekStart: Math.floor(out.time.day) })
    // The engine keeps playing it (lazy ??= defaults for everything the migration did not touch).
    expect(api.step(out, 30).finance.receipts).toHaveLength(out.finance.mrrHistory.length + 1)
    // A v4 save from before the budget gets it lazily on its next day, and its first Pre-seed action spends from it.
    const lazy = { ...structuredClone(out), stage: 1 as const }
    delete lazy.founder.moves
    const next = api.step(lazy, 1)
    expect(next.founder.moves?.left).toBe(B.MOVES_PER_WEEK[1])
    const acted = api.applyAction(next, { type: 'founderAction', kind: 'findUsers' })
    expect(acted.ok).toBe(true)
    expect(acted.state.founder.moves?.left).toBe(B.MOVES_PER_WEEK[1]! - 1)
  })

  it('a save from the future is refused', () => {
    const api = createEngine(fakeContent())
    expect(migrate({ version: SAVE_VERSION + 1, state: api.createGame({ seed: 1 }) })).toBeNull()
  })
})

describe('company name (save v3)', () => {
  it('createGame trims, collapses and caps the name; blank falls back to the default', () => {
    const api = createEngine(fakeContent())
    expect(api.createGame({ seed: 1, companyName: '  Helio   Studio ' }).meta.companyName).toBe('Helio Studio')
    expect(api.createGame({ seed: 1, companyName: ' ' }).meta.companyName).toBe(DEFAULT_COMPANY_NAME)
    expect(api.createGame({ seed: 1 }).meta.companyName).toBe(DEFAULT_COMPANY_NAME)
    expect(Array.from(api.createGame({ seed: 1, companyName: 'x'.repeat(50) }).meta.companyName)).toHaveLength(COMPANY_NAME_MAX)
  })

  it('a v2 save gets the default company name', () => {
    const api = createEngine(fakeContent())
    const v2 = structuredClone(api.createGame({ seed: 1 })) as unknown as { meta: Record<string, unknown> }
    delete v2.meta.companyName
    const out = migrate({ version: 2, state: v2 })!
    expect(out.meta.companyName).toBe(DEFAULT_COMPANY_NAME)
    expect(out.meta.saveVersion).toBe(SAVE_VERSION)
  })
})

describe('the payday desk (GAMEPLAY V2 §6.1)', () => {
  const LANDLORD = CRISIS_CARDS.find((c) => c.id === B.LANDLORD_CARD_ID)!
  const api = createEngine(fakeContent({ decisions: [LANDLORD] }))
  const ALL_PAID: PaydayChoice = { salaries: 'full', rent: 'pay', infra: 'pay', ads: 'pay', founder: 'pay' }

  /** A garage with two engineers on day 0 and a full till until the eve of payday. */
  function team(): GameState {
    let s = api.createGame({ seed: 4 })
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    for (let i = 0; i < 2; i++) {
      s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
      const c = s.candidates.find((x) => x.dept === 'eng') ?? s.candidates[0]!
      s = api.applyAction(s, { type: 'hire', candidateId: c.id }).state
    }
    return api.step({ ...s, stats: { ...s.stats, cash: 1_000_000 } }, 29.5)
  }

  /** Payday with `cash(state)` in the till (set half a day before it). */
  function payWith(s: GameState, cash: (s: GameState) => number, finance: Partial<GameState['finance']> = {}): GameState {
    return api.step({ ...s, stats: { ...s.stats, cash: cash(s) }, finance: { ...s.finance, ...finance } }, 0.6)
  }
  const salaries = (s: GameState) => s.finance.ledger!.salaries
  const resolve = (s: GameState, choice: PaydayChoice) => api.applyAction(s, { type: 'resolvePayday', choice })

  it('cash 0.6 × salaries → the month waits on the desk (paydayShort); nothing but the loan service leaves', () => {
    const eve = team()
    const sal = salaries(eve)
    const s = payWith(eve, () => 0.6 * sal)
    expect(s.finance.pendingPayday).toBeDefined()
    expect(s.finance.pendingPayday!.ledger.salaries).toBeGreaterThanOrEqual(sal)
    expect(s.events.filter((e) => e.kind === 'paydayShort')).toHaveLength(1)
    expect(s.events.some((e) => e.kind === 'payday')).toBe(false)
    expect(s.finance.payrollMissed).toBeFalsy()
    expect(s.stats.cash).toBeGreaterThan(0.6 * sal - 1)
    // The month is still owed: runway counts it, and the desk's last day is on the horizon.
    expect(owedTotal(s)).toBeGreaterThanOrEqual(sal)
    expect(s.derived.horizon!.find((h) => h.kind === 'payday' && h.due)!.day).toBe(s.finance.pendingPayday!.day + B.PAYDAY_DECIDE_DAYS)
    // Nothing waits on the desk any more → notFound; ads cannot be deferred (type and engine).
    // @ts-expect-error ads: 'defer' is not a PaydayChoice
    expect(resolve(s, { ...ALL_PAID, ads: 'defer' }).error).toBe('invalid')
    expect(api.applyAction(eve, { type: 'resolvePayday', choice: ALL_PAID }).error).toBe('notFound')
  })

  it('half salaries: every morale −8, the target −10 while owed, half deferred, the clock starts', () => {
    const s = payWith(team(), (x) => 0.6 * salaries(x))
    const sal = s.finance.pendingPayday!.ledger.salaries
    const before = s.employees.map((e) => e.morale)
    const r = resolve(s, { salaries: 'half', rent: 'pay', infra: 'pay', ads: 'pay', founder: 'skip' })
    expect(r.ok).toBe(true)
    const out = r.state
    out.employees.forEach((e, i) => expect(e.morale).toBeCloseTo(Math.max(0, before[i]! + B.PAYDAY_HALF_MORALE), 6))
    expect(out.finance.pendingPayday).toBeUndefined()
    // The founder's skipped pay is not owed.
    const owed = sal / 2
    expect(out.finance.deferred).toBeCloseTo(owed, 0)
    expect(out.finance.payrollMissed).toBe(true)
    expect(out.finance.lastReceipt!.deferred).toBeCloseTo(owed, 0)
    expect(out.events.some((e) => e.kind === 'paydayResolved')).toBe(true)
    // The target term: the same company with the wages paid aims 10 points higher.
    const paid = api.applyAction({ ...out, flags: { ...out.flags, wagesOwed: false } }, { type: 'setSpeed', speed: 0 }).state
    expect(paid.derived.moraleTarget - out.derived.moraleTarget).toBeCloseTo(B.WAGES_OWED_MORALE_TARGET, 6)
    // The skipped founder pay costs energy.
    expect(out.founder.energy).toBe(Math.max(0, s.founder.energy + B.FOUNDER_SKIP_ENERGY))
  })

  it('left unanswered for 3 days: the default order (salaries → infra → rent → founder → ads), one P0 event', () => {
    const s = payWith(team(), (x) => 0.6 * salaries(x))
    const expected = autoPaydayChoice(s)
    expect(expected).toEqual({ salaries: 'half', infra: 'pay', rent: expected.rent, founder: expected.founder, ads: expected.ads })
    const l = s.finance.pendingPayday!.ledger
    let t = api.step(s, B.PAYDAY_DECIDE_DAYS - 1)
    expect(t.finance.pendingPayday).toBeDefined()
    t = api.step(t, 1)
    expect(t.finance.pendingPayday).toBeUndefined()
    expect(t.events.filter((e) => e.kind === 'paydayAutoResolved')).toHaveLength(1)
    const owed = l.salaries / 2 + (expected.rent === 'defer' ? l.rent : 0)
    expect(t.finance.deferred).toBeCloseTo(owed, 0)
    expect(t.finance.payrollMissed).toBe(true)
  })

  it('owed above 1 month of gross burn starts the clock even with everything paid and cash ≥ 0', () => {
    const eve = team()
    const month = owedTotal(eve) + eve.finance.burn / 60
    const s = payWith(eve, () => month + 100, { deferred: eve.finance.burn * 1.5 })
    expect(s.finance.pendingPayday).toBeDefined()
    const out = resolve(s, ALL_PAID).state
    expect(out.stats.cash).toBeGreaterThanOrEqual(0)
    expect(out.finance.deferred!).toBeGreaterThan(B.DEFER_CAP_MONTHS * out.finance.burn)
    expect(out.finance.payrollMissed).toBe(true)
    // Under the cap with salaries paid: no clock.
    const small = payWith(eve, () => month + 100, { deferred: eve.finance.burn * 0.3 })
    expect(resolve(small, ALL_PAID).state.finance.payrollMissed).toBeFalsy()
  })

  it('rent: the 2nd deferral brings landlord-notice, the 3rd the eviction (capacity × 0.5 + moving cost)', () => {
    const s = payWith(team(), (x) => 0.6 * salaries(x))
    const deferRent: PaydayChoice = { ...ALL_PAID, salaries: 'half', rent: 'defer' }
    const second = resolve({ ...s, flags: { ...s.flags, rentDeferredMonths: 1 } }, deferRent).state
    expect(second.flags['rentDeferredMonths']).toBe(2)
    expect(second.decisions.queue).toContain(B.LANDLORD_CARD_ID)
    expect(second.events.some((e) => e.kind === 'eviction')).toBe(false)
    const third = resolve({ ...s, flags: { ...s.flags, rentDeferredMonths: 2 } }, deferRent).state
    const ev = third.events.find((e) => e.kind === 'eviction')!
    expect(ev.value).toBeCloseTo(s.finance.pendingPayday!.ledger.rent * B.EVICTION_MOVE_RENT_MONTHS, 6)
    expect(ev.value).toBeGreaterThan(0)
    expect(third.modifiers.some((m) => m.kind === 'capacity' && m.value === B.EVICTION_CAPACITY)).toBe(true)
    expect(third.flags['rentDeferredMonths']).toBeUndefined()
    // Moved on the notice (option 'Küçük yere taşın'): a new landlord, the next deferral is the first again.
    const noticeDay = Number(second.flags['landlordNoticeDay'])
    const moved: GameState = {
      ...s,
      flags: { ...s.flags, rentDeferredMonths: 2, landlordNoticeDay: noticeDay },
      decisions: { ...s.decisions, history: [...s.decisions.history, { cardId: B.LANDLORD_CARD_ID, optionIndex: B.LANDLORD_MOVE_OPTION, day: noticeDay }] },
    }
    const after = resolve(moved, deferRent).state
    expect(after.events.some((e) => e.kind === 'eviction')).toBe(false)
    expect(after.flags['rentDeferredMonths']).toBe(1)
  })

  it('infra: deferred once → capacity × 0.7 for 30 days; twice in a row → × 0.4', () => {
    const s = payWith(team(), (x) => 0.6 * salaries(x))
    const deferInfra: PaydayChoice = { ...ALL_PAID, salaries: 'half', infra: 'defer' }
    const once = resolve(s, deferInfra).state
    const capMods = (x: GameState) => x.modifiers.filter((m) => m.kind === 'capacity')
    expect(capMods(once).map((m) => m.value)).toEqual([0.7])
    expect(capMods(once)[0]!.untilDay).toBeCloseTo(s.time.day + B.INFRA_DEFER_DAYS, 6)
    const twice = resolve({ ...s, flags: { ...s.flags, infraDeferStreak: 1 } }, deferInfra).state
    expect(capMods(twice).map((m) => m.value)).toEqual([0.4])
    // A cut still running when the next month is deferred is replaced, not multiplied (never below 0.4).
    expect(capMods(resolve({ ...once, finance: { ...once.finance, pendingPayday: s.finance.pendingPayday } }, deferInfra).state).map((m) => m.value)).toEqual([0.4])
    const full = resolve(s, { ...deferInfra, infra: 'pay' }).state
    expect(twice.derived.capacity).toBeLessThan(full.derived.capacity)
    // Ads 'cut': this month paid, the budget is 0 from now on.
    expect(resolve({ ...s, finance: { ...s.finance, adBudget: 500 } }, { ...ALL_PAID, ads: 'cut' }).state.finance.adBudget).toBe(0)
  })

  it('runway counts the deferred: owed costs come off the cash', () => {
    const eve = team()
    const recompute = (x: GameState) => api.applyAction(x, { type: 'setSpeed', speed: 0 }).state
    const a = recompute(eve)
    const b = recompute({ ...eve, finance: { ...eve.finance, deferred: 50_000 } })
    expect(owedTotal(b) - owedTotal(a)).toBeCloseTo(50_000, 6)
    expect(b.finance.runway!).toBeLessThan(a.finance.runway!)
    expect(a.finance.runway! - b.finance.runway!).toBeCloseTo(50_000 / -(a.finance.net - 0), 3)
  })

  it('a profitable company never sees the desk (regression: no paydayShort while in profit)', () => {
    let s = api.createGame({ seed: 6 })
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    s = api.step({ ...s, projects: s.projects.map((p) => ({ ...p, maturity: 1, launched: true, releaseLevel: 5 })), stats: { ...s.stats, users: 3000, cash: 2_000 } }, 1)
    expect(s.finance.net).toBeGreaterThan(0)
    let shorts = 0
    let paydays = 0
    let seen = s.events[s.events.length - 1]?.id ?? 0
    // Every payday while the company is in profit (a garage with a fixed user base drifts out of it in time).
    for (let d = 0; d < 365 && s.finance.net > 0; d++) {
      s = api.step(s, 1)
      for (const e of s.events) {
        if (e.id <= seen) continue
        if (e.kind === 'paydayShort') shorts++
        if (e.kind === 'payday') paydays++
      }
      seen = s.events[s.events.length - 1]?.id ?? seen
    }
    expect(paydays).toBeGreaterThanOrEqual(3)
    expect(shorts).toBe(0)
    expect(s.finance.deferred).toBe(0)
  })

  it('an old save has nothing deferred and no desk (migration and the lazy default)', () => {
    const s = api.step(api.createGame({ seed: 1 }), 40)
    const v3 = structuredClone(s) as unknown as { finance: Record<string, unknown> }
    delete v3.finance.deferred
    const out = migrate({ version: 3, state: v3 })!
    expect(out.finance.deferred).toBe(0)
    expect(out.finance.pendingPayday).toBeUndefined()
    const lazy = structuredClone(s)
    delete lazy.finance.deferred
    expect(api.step(lazy, 30).finance.deferred).toBe(0)
  })
})

describe('panel selectors (covenant light, round-end runway, ad / price steps)', () => {
  const base = (): GameState => createEngine(fakeContent()).createGame({ seed: 3 })
  const withLoan = (s: GameState, over: Partial<NonNullable<GameState['finance']['loan']>>): GameState => ({
    ...s,
    finance: {
      ...s.finance,
      loan: { principal: 20_000, balance: 20_000, rateMonthly: 0.02, monthsLeft: 12, covenantRunway: 3, covenantFromDay: 0, interestOnlyUntil: 0, breaches: 0, ...over },
    },
  })

  it('covenantState: grace → ok / atRisk (runway under the line) → breached; null without a loan', () => {
    const s = base()
    expect(covenantState(s)).toBeNull()
    expect(covenantState(withLoan(s, { covenantFromDay: s.time.day + 40 }))!.light).toBe('grace')
    expect(covenantState({ ...withLoan(s, {}), finance: { ...withLoan(s, {}).finance, runway: 10 } })!.light).toBe('ok')
    expect(covenantState({ ...withLoan(s, {}), finance: { ...withLoan(s, {}).finance, runway: null } })!.light).toBe('ok')
    const risk = covenantState({ ...withLoan(s, {}), finance: { ...withLoan(s, {}).finance, runway: 1 } })!
    expect(risk.light).toBe('atRisk')
    expect(risk.checkDays).toBeGreaterThan(0)
    expect(covenantState(withLoan(s, { breaches: 1 }))!.light).toBe('breached')
  })

  it('roundEndRunway is runwayAt the latest round end and never negative', () => {
    const s = base()
    const end = s.time.day + B.ROUND_WEEKS_MAX * 7
    expect(roundEndRunway(s)).toEqual(runwayAt(s, end))
    const r = runwayAt(s, s.time.day + 100_000)
    expect(r === null || r === 0).toBe(true)
  })

  it('ad steps fold on the cap and centre on the paid floor with no budget; price steps span the engine range', () => {
    expect(adBudgetSteps(0, 1).map((x) => x.amount)).toEqual([0, B.CAC_SPEND_FLOOR[1]! / 2, B.CAC_SPEND_FLOOR[1]!, B.CAC_SPEND_FLOOR[1]! * 2])
    const capped = adBudgetSteps(B.AD_BUDGET_MAX, 6)
    expect(capped.map((x) => x.key)).toEqual(['off', 'half', 'same'])
    expect(PRICE_STEPS[0]).toBe(B.PRICE_MIN)
    expect(PRICE_STEPS[PRICE_STEPS.length - 1]).toBe(B.PRICE_MAX)
    expect(nearestPriceStep(1.01)).toBe(PRICE_STEPS.reduce((b, p) => (Math.abs(p - 1.01) < Math.abs(b - 1.01) ? p : b)))
  })
})
