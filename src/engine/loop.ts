// Core loop beats (docs/CORE_LOOP.md §4–§5): payday + month receipt, release moments, stage goals (☆).
import * as B from './balance'
import { bringCardNow, isCardEligible } from './decisions'
import { recomputeDerived } from './derive'
import { clamp, ledgerCosts } from './economy'
import { applyMorale, loanOf, syncDebt } from './effects'
import { lastUpdateDay, owedTotal } from './loopSelectors'
import { yearlyRaises } from './people'
import { DAYS_PER_MONTH, type GameState, type MonthLedger, type MonthReceipt, type PaydayChoice, type PendingPayday, type Project, type ReleaseEntry } from './types'
import { newId, policiesOf, policyMult, policySum, pushActivity, pushEvent, stageBaseline, uniquePush, type EngineContent } from './util'
import { directorOf, graceAfterMissedPayroll } from './world'

const emptyLedger = (): MonthLedger => ({ revenue: 0, salaries: 0, rent: 0, infra: 0, ads: 0, founder: 0 })

/**
 * The month's ledger. Saves from before payday had no ledger: their costs so far this month were already taken
 * day by day, so the ledger starts empty and the first payday only charges the rest of that month.
 */
export function ledgerOf(s: GameState): MonthLedger {
  if (!s.finance.ledger) s.finance.ledger = emptyLedger()
  return s.finance.ledger
}

/** Continuous: revenue flows into cash, costs accrue for payday (same totals as the old daily accrual). */
export function accrueMonth(s: GameState, dt: number): void {
  const l = ledgerOf(s)
  const k = dt / DAYS_PER_MONTH
  const bb = s.finance.burnBreakdown
  const revenue = s.finance.mrr * k
  l.revenue += revenue
  l.salaries += bb.salaries * k
  l.rent += bb.rent * k
  l.infra += bb.infra * k
  l.ads += bb.ads * k
  l.founder = (l.founder ?? 0) + (bb.founder ?? 0) * k
  s.stats.cash += revenue
  // GAMEPLAY V2 §7.2 deferred-pay: the wages held back are owed, paid when the next round closes.
  const later = s.derived.policies?.payLater ?? 0
  if (later > 0) {
    const p = policiesOf(s)
    p.owed = (p.owed ?? 0) + later * k
  }
}

/**
 * Payday (day % 30 === 0): salaries, rent, infra and ads leave in one lump, with the loan's interest and principal
 * and what the payday desk deferred (× (1 + DEFER_INTEREST)); the lender checks its covenant; the month receipt is
 * written. GAMEPLAY V2 §6.1: when cash (> 0) cannot cover the month, nothing but the loan service leaves: the month
 * waits on the payday desk (finance.pendingPayday, event paydayShort) until resolvePayday or PAYDAY_DECIDE_DAYS.
 */
export function payday(s: GameState, content: EngineContent): void {
  // A month still on the desk at the next payday (it waits only PAYDAY_DECIDE_DAYS): the default order closes it first.
  if (s.finance.pendingPayday) autoResolvePayday(s, content)
  const l = ledgerOf(s)
  const loan = serviceLoan(s)
  const deferredBefore = (s.finance.deferred ??= 0)
  const due = ledgerCosts(l) + deferredBefore * (1 + B.DEFER_INTEREST)
  // Runway already counts owed costs, so payday itself does not move it: compare with last payday instead.
  const prev = s.finance.lastReceipt
  const runwayBefore = prev ? prev.runwayAfter : null
  s.stats.cash -= loan.interest + loan.repay
  s.finance.ledger = emptyLedger()
  // Nothing in the till at all (cash ≤ 0): nothing to choose between, the month is missed as before (the clock starts).
  const short = s.stats.cash < due && s.stats.cash > 0
  if (!short) {
    s.stats.cash -= due
    clearDeferred(s)
  }
  // On the desk before the covenant check: the month waiting is still owed, so runway judges it as a paid month would.
  const desk: PendingPayday | null = short ? { day: Math.floor(s.time.day), ledger: l, deferredBefore, interest: loan.interest, runwayBefore } : null
  if (desk) s.finance.pendingPayday = desk
  // The month is paid at the old salaries; a raise earned today shows on the next receipt (salary-freeze: none).
  yearlyRaises(s, content)
  // crunch-culture (§7.2): the month's shortcuts land as tech debt.
  const debt = policySum(s, content, 'techDebtMonthly')
  if (debt > 0) s.techDebt = (s.techDebt ?? 0) + debt
  recomputeDerived(s, content)
  // A covenant call is principal leaving today: it goes on the receipt with the instalment (the receipt reconciles).
  loan.repay += checkCovenant(s, content)
  if (desk) {
    desk.loanRepay = loan.repay
    recomputeDerived(s, content)
    pushEvent(s, { kind: 'paydayShort', value: Math.max(0, due - s.stats.cash) })
    return
  }
  closeMonth(s, content, l, { paid: due + loan.interest + loan.repay, net: l.revenue - due - loan.interest - loan.repay, interest: loan.interest, repay: loan.repay, runwayBefore })
  missedPayroll(s, content)
}

/** What closes a month on the receipt: paid in total (loan service included), the month's net, the runway before. */
interface MonthClose {
  paid: number
  net: number
  interest: number
  repay: number
  runwayBefore: number | null
}

/** The month receipt (unrounded in lastReceipt, rounded in receipts), the stage's lowest runway, the payday beat. */
function closeMonth(s: GameState, content: EngineContent, l: MonthLedger, m: MonthClose): void {
  recomputeDerived(s, content)
  const deferred = s.finance.deferred ?? 0
  s.finance.lastReceipt = {
    month: Math.max(0, Math.round(s.time.day / DAYS_PER_MONTH) - 1),
    day: Math.floor(s.time.day),
    revenue: l.revenue,
    salaries: l.salaries,
    rent: l.rent,
    infra: l.infra,
    ads: l.ads,
    founder: l.founder ?? 0,
    ...(m.interest > 0 || m.repay > 0 ? { interest: m.interest, loanRepay: m.repay } : {}),
    ...(deferred > 0 ? { deferred } : {}),
    paid: m.paid,
    net: m.net,
    cashAfter: s.stats.cash,
    runwayBefore: m.runwayBefore,
    runwayAfter: s.finance.runway,
    mom: s.derived.momGrowth,
    multiple: s.derived.valuationMultiple,
    burnMultiple: s.derived.burnMultiple,
    mrr: s.finance.mrr,
    users: s.stats.users,
    team: s.employees.length,
    morale: s.stats.morale,
    valuation: s.finance.valuation,
    equity: s.stats.equity,
    reputation: s.stats.reputation,
    debt: s.finance.debt,
    adBudget: s.finance.adBudget,
    usersDelta: usersDelta(s),
    stage: s.stage,
    ...(s.derived.penetration !== undefined ? { penetration: s.derived.penetration } : {}),
  }
  pushReceipt(s, s.finance.lastReceipt)
  // §9.3 stage report: the stage's lowest payday runway.
  if (s.stageStart?.stage === s.stage) s.stageStart.minRunway = Math.min(s.stageStart.minRunway ?? 99, s.finance.runway ?? 99)
  if (m.paid > 0.5) pushActivity(s, 'payday', { amount: Math.round(m.paid) })
  pushEvent(s, { kind: 'payday', value: m.paid })
}

/** Nothing is owed any more: the deferral marks (wages owed, rent and infra streaks) go with it. */
function clearDeferred(s: GameState): void {
  s.finance.deferred = 0
  delete s.flags['wagesOwed']
  delete s.flags['rentDeferredMonths']
  delete s.flags['landlordNoticeDay']
  delete s.flags['infraDeferStreak']
}

const PAYDAY_CHOICES: { [K in keyof PaydayChoice]: readonly PaydayChoice[K][] } = {
  salaries: ['full', 'half', 'defer'],
  rent: ['pay', 'defer'],
  infra: ['pay', 'defer'],
  ads: ['pay', 'cut'],
  founder: ['pay', 'skip'],
}

/** Every line of the choice is one of its allowed answers (ads have no 'defer'). */
export function isPaydayChoice(c: unknown): c is PaydayChoice {
  if (!c || typeof c !== 'object') return false
  const o = c as Record<string, unknown>
  return (Object.keys(PAYDAY_CHOICES) as (keyof PaydayChoice)[]).every((k) => (PAYDAY_CHOICES[k] as readonly unknown[]).includes(o[k]))
}

/**
 * The desk's default order (§6.1), also what an unanswered desk applies: salaries → infra → rent → founder → ads,
 * each paid while cash lasts, the rest deferred (salaries half when half fits; founder skipped; ads cut).
 */
export function autoPaydayChoice(s: GameState): PaydayChoice {
  const l = s.finance.pendingPayday?.ledger ?? emptyLedger()
  let left = s.stats.cash
  const take = (v: number): boolean => {
    if (left < v) return false
    left -= v
    return true
  }
  const salaries = take(l.salaries) ? 'full' : take(l.salaries / 2) ? 'half' : 'defer'
  const infra = take(l.infra) ? 'pay' : 'defer'
  const rent = take(l.rent) ? 'pay' : 'defer'
  const founder = take(l.founder ?? 0) ? 'pay' : 'skip'
  const ads = take(l.ads) ? 'pay' : 'cut'
  return { salaries, rent, infra, ads, founder }
}

/**
 * The payday desk's answer (§6.1). Salaries half / deferred hit every morale (and the target while owed); rent deferred
 * twice brings the landlord's notice, three times the eviction; infra deferred cuts capacity (× 0.7, the second month
 * in a row × 0.4); ads are paid either way ('cut' zeroes the budget); the founder's skipped pay is owed and costs
 * energy. What cash is left pays the older deferrals back with interest. The bankruptcy clock starts on salaries not
 * paid in full, cash below zero, or owed above DEFER_CAP_MONTHS of gross burn. Returns false when no month waits.
 */
export function resolvePayday(s: GameState, content: EngineContent, choice: PaydayChoice): boolean {
  const p = s.finance.pendingPayday
  if (!p) return false
  const l = p.ledger
  let paid = 0
  let deferAdd = 0
  if (choice.salaries === 'full') paid += l.salaries
  else {
    const owe = choice.salaries === 'half' ? l.salaries / 2 : l.salaries
    paid += l.salaries - owe
    deferAdd += owe
    applyMorale(s, choice.salaries === 'half' ? B.PAYDAY_HALF_MORALE : B.PAYDAY_DEFER_MORALE)
    if (owe > 0) s.flags['wagesOwed'] = true
  }
  if (choice.infra === 'pay') {
    paid += l.infra
    delete s.flags['infraDeferStreak']
  } else {
    deferAdd += l.infra
    const streak = Number(s.flags['infraDeferStreak'] ?? 0) + 1
    s.flags['infraDeferStreak'] = streak
    const value = B.INFRA_DEFER_CAPACITY[Math.min(B.INFRA_DEFER_CAPACITY.length, streak) - 1]!
    // The new month's cut replaces the last one (two overlapping cuts would multiply below the second month's value).
    s.modifiers = s.modifiers.filter((m) => m.source !== 'paydayInfra')
    s.modifiers.push({ id: newId(s, 'mod'), kind: 'capacity', value, untilDay: s.time.day + B.INFRA_DEFER_DAYS, source: 'paydayInfra' })
  }
  if (choice.rent === 'pay') paid += l.rent
  else {
    deferAdd += l.rent
    deferRent(s, content, l.rent)
  }
  paid += l.ads
  if (choice.ads === 'cut') s.finance.adBudget = 0
  if (choice.founder === 'pay') paid += l.founder ?? 0
  // Skipped, not owed: the founder lives on nothing this month and it costs energy.
  else {
    s.founder.energy = clamp(0, B.ENERGY_MAX, s.founder.energy + B.FOUNDER_SKIP_ENERGY)
  }
  s.stats.cash -= paid
  // Older deferrals come back with interest from what cash is left; the rest stays owed.
  const old = p.deferredBefore * (1 + B.DEFER_INTEREST)
  const back = Math.min(old, Math.max(0, s.stats.cash))
  s.stats.cash -= back
  paid += back
  s.finance.deferred = old - back + deferAdd
  if (s.finance.deferred < 0.5) clearDeferred(s)
  s.finance.pendingPayday = undefined
  const loanPaid = (p.interest ?? 0) + (p.loanRepay ?? 0)
  closeMonth(s, content, l, { paid: paid + loanPaid, net: l.revenue - paid - loanPaid - deferAdd, interest: p.interest ?? 0, repay: p.loanRepay ?? 0, runwayBefore: p.runwayBefore ?? null })
  const overCap = (s.finance.deferred ?? 0) > B.DEFER_CAP_MONTHS * s.finance.burn
  missedPayroll(s, content, choice.salaries !== 'full' || overCap)
  return true
}

/** Unanswered for PAYDAY_DECIDE_DAYS (or still there at the next payday): the default order applies. */
export function autoResolvePayday(s: GameState, content: EngineContent): void {
  if (!s.finance.pendingPayday) return
  resolvePayday(s, content, autoPaydayChoice(s))
  pushEvent(s, { kind: 'paydayAutoResolved', value: s.finance.deferred ?? 0 })
}

/** Daily: the desk's PAYDAY_DECIDE_DAYS ran out (time flows only while the desk is closed: "Sonra"). */
export function checkPaydayDesk(s: GameState, content: EngineContent): void {
  const p = s.finance.pendingPayday
  if (p && s.time.day >= p.day + B.PAYDAY_DECIDE_DAYS) autoResolvePayday(s, content)
}

/**
 * Rent deferred again: LANDLORD_NOTICE_MONTHS brings the landlord's card (shared card budget), EVICTION_MONTHS the
 * eviction. Moved to a smaller place on the notice (LANDLORD_MOVE_OPTION): a new landlord, the count starts over.
 */
function deferRent(s: GameState, content: EngineContent, rent: number): void {
  let n = Number(s.flags['rentDeferredMonths'] ?? 0) + 1
  const id = B.LANDLORD_CARD_ID
  const noticeDay = s.flags['landlordNoticeDay']
  if (n >= B.EVICTION_MONTHS && typeof noticeDay === 'number') {
    const moved = s.decisions.history.some((h) => h.cardId === id && h.optionIndex === B.LANDLORD_MOVE_OPTION && h.day >= noticeDay)
    if (moved) {
      n = 1
      delete s.flags['landlordNoticeDay']
    }
  }
  s.flags['rentDeferredMonths'] = n
  if (n === B.LANDLORD_NOTICE_MONTHS && content.decisions.some((c) => c.id === id) && s.decisions.active?.cardId !== id && !s.decisions.queue.includes(id)) {
    s.decisions.queue.push(id)
    s.flags['landlordNoticeDay'] = Math.floor(s.time.day)
  }
  if (n < B.EVICTION_MONTHS) return
  // Moved out: a smaller place for a while and the move itself (EVICTION_MOVE_RENT_MONTHS of the month's rent).
  const cost = rent * B.EVICTION_MOVE_RENT_MONTHS
  s.stats.cash -= cost
  s.modifiers.push({ id: newId(s, 'mod'), kind: 'capacity', value: B.EVICTION_CAPACITY, untilDay: s.time.day + B.EVICTION_DAYS, source: 'eviction' })
  delete s.flags['rentDeferredMonths']
  delete s.flags['landlordNoticeDay']
  pushEvent(s, { kind: 'eviction', value: cost })
}

/**
 * GAMEPLAY V2 §6.2: the month's loan service. Interest = balance × rate; principal only after the interest-only months
 * (balance / months left). The last instalment closes the loan.
 */
function serviceLoan(s: GameState): { interest: number; repay: number } {
  const loan = loanOf(s)
  if (!loan) return { interest: 0, repay: 0 }
  const interest = loan.balance * loan.rateMonthly
  let repay = 0
  if (s.time.day >= loan.interestOnlyUntil) {
    repay = loan.balance / Math.max(1, loan.monthsLeft)
    loan.monthsLeft = Math.max(0, loan.monthsLeft - 1)
    loan.balance = Math.max(0, loan.balance - repay)
  }
  if (loan.monthsLeft <= 0 || loan.balance < 0.5) {
    repay += loan.balance
    s.finance.loan = undefined
    pushEvent(s, { kind: 'loanRepaid', value: loan.principal })
  }
  syncDebt(s)
  return { interest, repay }
}

/**
 * GAMEPLAY V2 §6.2 covenant, measured on paydays from covenantFromDay: runway < covenantRunway is a breach.
 * 1st: a warning (the next payday is the next check); 2nd: LOAN_CALL_SHARE of the balance is called and the rate
 * goes × LOAN_CALL_RATE_MULT; 3rd: the rest is called. A call that leaves cash < 0 is a missed payroll (the desk).
 * Returns the amount called today.
 */
function checkCovenant(s: GameState, content: EngineContent): number {
  const loan = s.finance.loan
  if (!loan || s.time.day < loan.covenantFromDay) return 0
  const runway = s.finance.runway
  if (runway === null || runway >= loan.covenantRunway) return 0
  loan.breaches += 1
  if (loan.breaches === 1) {
    pushEvent(s, { kind: 'loanWarning', refId: 'warn', value: s.time.day + B.LOAN_WARNING_DAYS })
    return 0
  }
  let called: number
  if (loan.breaches === 2) {
    called = loan.balance * B.LOAN_CALL_SHARE
    loan.balance -= called
    loan.rateMonthly *= B.LOAN_CALL_RATE_MULT
    pushEvent(s, { kind: 'loanWarning', refId: 'half', value: called })
  } else {
    called = loan.balance
    s.finance.loan = undefined
    pushEvent(s, { kind: 'loanCalled', value: called })
  }
  s.stats.cash -= called
  syncDebt(s)
  recomputeDerived(s, content)
  return called
}

/** Month end: the engineers pay TECH_DEBT_AMORT_PER_ENG × eng of tech debt back (the reason to keep engineers). */
export function amortizeTechDebt(s: GameState): void {
  const eng = s.employees.filter((e) => e.dept === 'eng').length
  s.techDebt = Math.max(0, (s.techDebt ?? 0) - B.TECH_DEBT_AMORT_PER_ENG * eng)
}

/** Users gained over the month that just closed (monthEnd has already taken this month's snapshot). */
function usersDelta(s: GameState): number {
  const h = s.finance.usersHistory
  return s.stats.users - (h.length >= 2 ? h[h.length - 2]! : 0)
}

const ratio = (v: number): number => {
  const k = 10 ** B.HISTORY_RATIO_DECIMALS
  return Math.round(v * k) / k
}
const ratioOrNull = (v: number | null): number | null => (v === null ? null : ratio(v))

/**
 * The only writer of finance.receipts (docs/GAMEPLAY_V2.md §14.2): a rounded copy of the payday receipt, capped at
 * HISTORY_MAX_MONTHS. Money and users round to whole numbers, ratios to HISTORY_RATIO_DECIMALS (unrounded floats
 * would triple the save). Zero debt / ad budget are left out.
 */
function pushReceipt(s: GameState, r: MonthReceipt): void {
  const out: MonthReceipt = {
    month: r.month,
    day: r.day,
    revenue: Math.round(r.revenue),
    salaries: Math.round(r.salaries),
    rent: Math.round(r.rent),
    infra: Math.round(r.infra),
    ads: Math.round(r.ads),
    founder: Math.round(r.founder ?? 0),
    paid: Math.round(r.paid),
    net: Math.round(r.net),
    cashAfter: Math.round(r.cashAfter),
    runwayBefore: ratioOrNull(r.runwayBefore),
    runwayAfter: ratioOrNull(r.runwayAfter),
    mom: ratio(r.mom),
    multiple: ratio(r.multiple),
    mrr: Math.round(r.mrr),
    users: Math.round(r.users),
  }
  if (r.team !== undefined) out.team = r.team
  if (r.morale !== undefined) out.morale = Math.round(r.morale)
  if (r.valuation !== undefined) out.valuation = Math.round(r.valuation)
  if (r.equity !== undefined) out.equity = ratio(r.equity)
  if (r.reputation !== undefined) out.reputation = Math.round(r.reputation)
  if (r.debt) out.debt = Math.round(r.debt)
  if (r.interest) out.interest = Math.round(r.interest)
  if (r.loanRepay) out.loanRepay = Math.round(r.loanRepay)
  if (r.deferred) out.deferred = Math.round(r.deferred)
  if (r.adBudget) out.adBudget = Math.round(r.adBudget)
  if (r.usersDelta !== undefined) out.usersDelta = Math.round(r.usersDelta)
  if (r.stage !== undefined) out.stage = r.stage
  if (r.burnMultiple !== undefined) out.burnMultiple = ratio(r.burnMultiple)
  if (r.penetration !== undefined) out.penetration = ratio(r.penetration)
  const list = (s.finance.receipts ??= [])
  list.push(out)
  if (list.length > B.HISTORY_MAX_MONTHS) list.splice(0, list.length - B.HISTORY_MAX_MONTHS)
}

/**
 * Payday left the cash below zero (or the payday desk left salaries unpaid / owed past DEFER_CAP_MONTHS: `missed`):
 * payroll was missed. The bankruptcy clock starts (endgame.ts counts it until cash − owed ≥ 0 again) and the rescue card
 * comes (docs/CORE_LOOP.md §5 "maaş ödenemedi → kurtarma kartı → 60 gün"). A dip below zero between paydays (a card,
 * a desk) does not start the clock.
 */
function missedPayroll(s: GameState, content: EngineContent, missed = false): void {
  if ((s.stats.cash >= 0 && !missed) || s.finance.payrollMissed) return
  const short = Math.max(0, owedTotal(s) - s.stats.cash, -s.stats.cash)
  s.finance.payrollMissed = true
  s.finance.negativeCashDays = 0
  pushActivity(s, 'payrollMissed', { amount: Math.round(short) })
  pushEvent(s, { kind: 'payrollMissed', value: short })
  // A desk answer that leaves the free cash ≥ 0 starts the clock but is no crisis: no director grace, no angel.
  if (missed && s.stats.cash - owedTotal(s) >= 0) return
  graceAfterMissedPayroll(s)
  // GAMEPLAY V2 §5.2: up to Seed, the first missed payroll brings the one-time angel instead (its second option is the
  // usual rescue). Offered once: it never comes again, taken or not.
  const director = directorOf(s)
  if (s.stage <= B.ANGEL_MAX_STAGE && !director.angelUsed && content.decisions.some((c) => c.id === B.ANGEL_CARD_ID)) {
    director.angelUsed = true
    bringCardNow(s, B.ANGEL_CARD_ID)
    return
  }
  const id = B.RESCUE_CARD_ID
  const card = content.decisions.find((c) => c.id === id)
  // The rescue skips the repeat cooldown (a second missed payday must still have a way out) but keeps REPEAT_CARD_MAX,
  // and it takes over from an unanswered active card instead of waiting behind it. After the payday desk the cash may
  // still be ≥ 0 but spoken for: the rescue reads the free cash (cash − owed).
  const view = missed ? { ...s, stats: { ...s.stats, cash: Math.min(s.stats.cash, s.stats.cash - owedTotal(s), -short) } } : s
  if (card && isCardEligible(card, view, { ignoreCooldown: true })) bringCardNow(s, id)
}

/** Release level (0–5) of a maturity: how many RELEASE_THRESHOLDS it has reached. */
export function releaseLevel(maturity: number): number {
  let n = 0
  for (const t of B.RELEASE_THRESHOLDS) if (maturity >= t - 1e-9) n++
  return n
}

/** Users a release brings: level size × stage scale × reputation, plus word of mouth from current users. */
export function releaseWave(s: GameState, level: number): number {
  const base = B.RELEASE_WAVE_USERS[Math.max(0, Math.min(B.RELEASE_WAVE_USERS.length - 1, level - 1))] ?? 0
  const w = base * B.RELEASE_WAVE_STAGE_GROWTH ** s.stage * (0.5 + s.stats.reputation / 100) + s.stats.users * B.RELEASE_WAVE_USER_SHARE
  return Math.max(1, Math.round(w))
}

/** Users an update (after 1.0) brings: a smaller wave than a version, plus word of mouth. */
export function updateWave(s: GameState): number {
  const w = B.RELEASE_UPDATE_USERS * B.RELEASE_WAVE_STAGE_GROWTH ** s.stage * (0.5 + s.stats.reputation / 100) + s.stats.users * B.RELEASE_UPDATE_USER_SHARE
  return Math.max(1, Math.round(w))
}

function ship(s: GameState, content: EngineContent, p: Project, level: number, users: number, update?: number): void {
  const mrrBefore = s.finance.mrr
  s.stats.users += users
  recomputeDerived(s, content)
  const entry: ReleaseEntry = { id: newId(s, 'rel'), day: s.time.day, projectId: p.id, projectName: p.name, level, users, mrr: Math.max(0, s.finance.mrr - mrrBefore) }
  if (update !== undefined) entry.update = update
  const list = (s.releases ??= [])
  list.push(entry)
  if (list.length > B.RELEASES_MAX) list.splice(0, list.length - B.RELEASES_MAX)
  s.releaseCount = (s.releaseCount ?? 0) + 1
  // GAMEPLAY V2 §4.2: from Series A every shipped update leaves a little debt behind (versions before 1.0 do not).
  if (update !== undefined && s.stage >= B.TECH_DEBT_MIN_STAGE) s.techDebt = (s.techDebt ?? 0) + B.TECH_DEBT_PER_UPDATE
  pushActivity(s, 'release', { project: p.name, level, users, mrr: Math.round(entry.mrr), update: update ?? 0 })
  pushEvent(s, { kind: 'release', refId: entry.id, value: level })
}

/**
 * Release moment: a project passing a maturity threshold ships a version (MVP, then 40/60/80/100%) and a user
 * wave walks in; MRR jumps with it. After 1.0 its builders ship updates (RELEASE_UPDATE_SIZE of work, at most one per
 * RELEASE_UPDATE_MIN_DAYS × the policies' releaseGap), so the beat keeps coming in every stage. A project seen for the first time (old save) is
 * set silently.
 */
export function checkReleases(s: GameState, content: EngineContent): void {
  // quality-gate (§7.2): updates come further apart.
  const gap = B.RELEASE_UPDATE_MIN_DAYS * policyMult(s, content, 'releaseGap')
  for (const p of s.projects) {
    const lvl = releaseLevel(p.maturity)
    if (p.releaseLevel === undefined) {
      p.releaseLevel = lvl
      continue
    }
    if (lvl > p.releaseLevel) {
      p.releaseLevel = lvl
      ship(s, content, p, lvl, releaseWave(s, lvl))
      continue
    }
    if (p.maturity < 1 || (p.updateProgress ?? 0) < B.RELEASE_UPDATE_SIZE - 1e-9) continue
    if (s.time.day - lastUpdateDay(s, p.id) < gap) continue
    p.updateProgress = 0
    p.updates = (p.updates ?? 0) + 1
    ship(s, content, p, B.RELEASE_THRESHOLDS.length, updateWave(s), p.updates)
  }
}

/** Daily: latch the current stage's ☆ goals the first time they hold (measured from the stage's baseline). */
export function checkGoals(s: GameState, content: EngineContent): void {
  const goals = content.goals
  if (!goals?.length) return
  // A save from before baselines (or a stage entered outside enterStage) starts measuring today.
  if (!s.stageStart || s.stageStart.stage !== s.stage) {
    s.stageStart = stageBaseline(s)
    return
  }
  const base = s.stageStart
  for (const g of goals) {
    if (g.stage !== s.stage || s.goalsDone?.includes(g.id)) continue
    let ok = false
    try {
      ok = g.check(s, base) === true
    } catch {
      ok = false
    }
    if (!ok) continue
    uniquePush((s.goalsDone ??= []), g.id)
    pushActivity(s, 'goalDone', { goal: g.id })
    pushEvent(s, { kind: 'goalDone', refId: g.id })
  }
}

/** ☆ goals reached in `stage` (each takes GOAL_STAR_EQUITY_DISCOUNT off the next round's equity). */
export function starsOfStage(s: GameState, content: EngineContent, stage: number): number {
  const done = s.goalsDone ?? []
  return (content.goals ?? []).filter((g) => g.stage === stage && done.includes(g.id)).length
}
