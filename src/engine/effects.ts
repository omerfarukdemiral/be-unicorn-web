// Applies an EffectBundle (cards, actions, furniture) with anti-farm clamps.
import type { Concept } from '../content/index'
import * as B from './balance'
import { clamp } from './economy'
import { DAYS_PER_MONTH, HUD_WIDGETS, TOOL_IDS, type ConceptId, type EffectBundle, type GameState, type HudWidget, type LoanState, type LoanTerms, type ToolId } from './types'
import { incCounter, newId, pushEvent, uniquePush, type EngineContent } from './util'

/** Flags that also bump a counter (content sets them via `setFlag`). */
const FLAG_COUNTERS: Record<string, keyof GameState['counters']> = { crunch: 'crunches' }

export function cappedCashPercent(s: GameState, pct: number): number {
  const p = clamp(-B.CASH_PERCENT_CAP, B.CASH_PERCENT_CAP, pct)
  const base = Math.max(0, s.stats.cash)
  const cap = B.CASH_PERCENT_ABS_CAP[s.stage] ?? Infinity
  return clamp(-cap, cap, base * p)
}

export function unlockWidget(s: GameState, w: HudWidget): void {
  uniquePush(s.unlockedWidgets, w)
}

export function unlockTool(s: GameState, t: ToolId): void {
  uniquePush(s.unlockedTools, t)
}

/** Unlock a concept's `unlocks` value(s) (widget or tool). */
export function unlockAny(s: GameState, id: string | readonly string[] | undefined): void {
  if (id === undefined) return
  if (typeof id !== 'string') {
    for (const x of id) unlockAny(s, x)
    return
  }
  if ((HUD_WIDGETS as readonly string[]).includes(id)) unlockWidget(s, id as HudWidget)
  else if ((TOOL_IDS as readonly string[]).includes(id)) unlockTool(s, id as ToolId)
}

/** Stores the card's "where" line with the numbers of the moment the concept fired. */
export function snapshotWhere(s: GameState, c: Concept): void {
  let text: string
  try {
    text = c.card.where(s)
  } catch {
    return
  }
  s.concepts.where = { ...(s.concepts.where ?? {}), [c.id]: text }
}

/** Triggers a concept out of band (effects, bankruptcy). */
export function queueConcept(s: GameState, content: EngineContent, id: ConceptId): boolean {
  if (s.concepts.triggered.includes(id)) return false
  const c = content.concepts.find((x) => x.id === id)
  if (!c) return false
  snapshotWhere(s, c)
  s.concepts.triggered.push(id)
  s.concepts.queue.push(id)
  pushEvent(s, { kind: 'conceptQueued', refId: id })
  return true
}

export function applyMorale(s: GameState, delta: number): void {
  s.stats.morale = clamp(0, 100, s.stats.morale + delta)
  for (const e of s.employees) e.morale = clamp(0, 100, e.morale + delta)
}

/**
 * Legacy loan flags (an option without `loan` that still sets them, e.g. an older content card): the cash it brought
 * becomes a loan on the legacy terms (GAMEPLAY V2 §3.1).
 */
const LOAN_FLAGS: ReadonlySet<string> = new Set(['emergencyLoan', 'bridgeLoan'])

/** finance.debt mirrors the loan balance (older readers: top bar, receipts). */
export function syncDebt(s: GameState): void {
  s.finance.debt = s.finance.loan ? s.finance.loan.balance : 0
}

/** A loan of `amount` taken today on the given terms (GAMEPLAY V2 §6.2): interest-only, then amortized; covenant later. */
export function newLoan(day: number, amount: number, rate: number, months: number, covenantRunway: number): LoanState {
  return {
    principal: amount,
    balance: amount,
    rateMonthly: rate,
    monthsLeft: Math.max(1, Math.round(months)),
    covenantRunway,
    covenantFromDay: day + B.LOAN_COVENANT_GRACE_DAYS,
    interestOnlyUntil: day + B.LOAN_INTEREST_ONLY_MONTHS * DAYS_PER_MONTH,
    breaches: 0,
  }
}

/** The loan; an older save's debt without one becomes a loan on the legacy terms (lazy twin of the v4 migration). */
export function loanOf(s: GameState): LoanState | undefined {
  if (!s.finance.loan && s.finance.debt > 0) {
    s.finance.loan = newLoan(s.time.day, s.finance.debt, B.LOAN_LEGACY_RATE, B.LOAN_LEGACY_MONTHS, B.LOAN_LEGACY_COVENANT)
  }
  return s.finance.loan
}

/** Next payday's loan service (interest, plus principal once amortizing): runway counts it (it does not lie). */
export function loanMonthlyService(s: GameState): number {
  const loan = s.finance.loan
  if (!loan) return s.finance.debt > 0 ? s.finance.debt * B.LOAN_LEGACY_RATE : 0
  const repay = s.time.day >= loan.interestOnlyUntil ? loan.balance / Math.max(1, loan.monthsLeft) : 0
  return loan.balance * loan.rateMonthly + repay
}

/** What a loan option would bring right now: max(burn × burnMonths, LOAN_MIN[stage]). */
export function loanAmount(s: GameState, terms: LoanTerms): number {
  return Math.round(Math.max(Math.max(0, s.finance.burn) * terms.burnMonths, B.LOAN_MIN[s.stage] ?? 0))
}

/** Takes the loan; there is only ever one (a second offer is closed by isCardEligible, and is a no-op here). */
export function takeLoan(s: GameState, terms: LoanTerms): void {
  if (loanOf(s)) return
  const amount = loanAmount(s, terms)
  if (!(amount > 0)) return
  const covenant = terms.covenantRunway ?? terms.burnMonths * B.LOAN_COVENANT_PER_BURN_MONTH
  s.finance.loan = newLoan(s.time.day, amount, terms.rate, terms.months, covenant)
  s.stats.cash += amount
  syncDebt(s)
  pushEvent(s, { kind: 'loanTaken', value: amount })
}

/** An option on a legacy loan flag without `loan` terms (its cash is the loan). */
export function isLegacyLoanOption(fx: EffectBundle): boolean {
  if (fx.loan !== undefined || fx.setFlag === undefined) return false
  return (typeof fx.setFlag === 'string' ? [fx.setFlag] : fx.setFlag).some((f) => LOAN_FLAGS.has(f))
}

/** Legacy flag: the cash an option already brought becomes a loan (applyEffects never lets it stack on a running one). */
function legacyLoan(s: GameState, amount: number): void {
  if (!(amount > 0) || loanOf(s)) return
  s.finance.loan = newLoan(s.time.day, amount, B.LOAN_LEGACY_RATE, B.LOAN_LEGACY_MONTHS, B.LOAN_LEGACY_COVENANT)
  syncDebt(s)
  pushEvent(s, { kind: 'loanTaken', value: amount })
}

export function applyEffects(s: GameState, content: EngineContent, fx: EffectBundle, source: string): void {
  // One loan only (GAMEPLAY V2 §6.2): with a loan running, a legacy loan option's lender says no — no cash, no equity.
  if (isLegacyLoanOption(fx) && loanOf(s)) fx = { ...fx, cash: undefined, cashPercent: undefined, cashBurnMonths: undefined, equity: undefined }
  const cash0 = s.stats.cash
  if (fx.cash !== undefined) s.stats.cash += fx.cash
  if (fx.cashPercent !== undefined) s.stats.cash += cappedCashPercent(s, fx.cashPercent)
  // GAMEPLAY V2 §5.2 angel: months of today's burn (the angel pays for time, not a percent of an empty till).
  if (fx.cashBurnMonths !== undefined) s.stats.cash += Math.round(Math.max(0, s.finance.burn) * fx.cashBurnMonths)
  if (fx.loan !== undefined) takeLoan(s, fx.loan)
  if (fx.users !== undefined) s.stats.users = Math.max(0, s.stats.users + fx.users)
  if (fx.usersPercent !== undefined) s.stats.users = Math.max(0, s.stats.users * (1 + clamp(-B.USERS_PERCENT_CAP, B.USERS_PERCENT_CAP, fx.usersPercent)))
  if (fx.morale !== undefined) applyMorale(s, fx.morale)
  if (fx.reputation !== undefined) {
    s.stats.reputation = clamp(0, 100, s.stats.reputation + fx.reputation)
    // İtibar göstergesi: the first choice that moves reputation makes it visible (PLAN §5.1).
    if (fx.reputation !== 0) unlockWidget(s, 'reputation')
  }
  if (fx.equity !== undefined) s.stats.equity = clamp(0.01, 1, s.stats.equity + fx.equity)
  if (fx.energy !== undefined) s.founder.energy = clamp(0, B.ENERGY_MAX, s.founder.energy + fx.energy)
  if (fx.maturity !== undefined) {
    for (const p of s.projects) if (p.maturity < 1) p.maturity = clamp(0, 1, p.maturity + fx.maturity)
  }
  if (fx.techDebt !== undefined) s.techDebt = Math.max(0, s.techDebt + fx.techDebt)
  for (const m of fx.modifiers ?? []) {
    s.modifiers.push({ id: newId(s, 'mod'), kind: m.kind, value: m.value, untilDay: s.time.day + m.days, source })
  }
  if (fx.roundWeeks !== undefined && s.round?.active) {
    s.round.weeksLeft = Math.max(1, s.round.weeksLeft + fx.roundWeeks)
    s.round.weeksTotal = Math.max(s.round.weeksTotal, s.round.weeksLeft)
  }
  if (fx.unlockTool !== undefined) unlockTool(s, fx.unlockTool)
  if (fx.unlockWidget !== undefined) unlockWidget(s, fx.unlockWidget)
  if (fx.queueConcept !== undefined) queueConcept(s, content, fx.queueConcept)
  if (fx.queueCard !== undefined && content.decisions.some((d) => d.id === fx.queueCard)) s.decisions.queue.push(fx.queueCard)
  for (const flag of fx.setFlag === undefined ? [] : typeof fx.setFlag === 'string' ? [fx.setFlag] : fx.setFlag) {
    s.flags[flag] = true
    const counter = FLAG_COUNTERS[flag]
    if (counter) incCounter(s, counter)
  }
  if (isLegacyLoanOption(fx)) legacyLoan(s, s.stats.cash - cash0)
}
