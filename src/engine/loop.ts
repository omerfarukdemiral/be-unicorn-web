// Core loop beats (docs/CORE_LOOP.md §4–§5): payday + month receipt, release moments, stage goals (☆).
import * as B from './balance'
import { bringCardNow, isCardEligible } from './decisions'
import { recomputeDerived } from './derive'
import { ledgerCosts } from './economy'
import { loanOf, syncDebt } from './effects'
import { lastUpdateDay } from './loopSelectors'
import { yearlyRaises } from './people'
import { DAYS_PER_MONTH, type GameState, type MonthLedger, type MonthReceipt, type Project, type ReleaseEntry } from './types'
import { newId, pushActivity, pushEvent, stageBaseline, uniquePush, type EngineContent } from './util'
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
}

/**
 * Payday (day % 30 === 0): salaries, rent, infra and ads leave in one lump, with the loan's interest and principal;
 * the lender checks its covenant; the month receipt is written.
 */
export function payday(s: GameState, content: EngineContent): void {
  const l = ledgerOf(s)
  const loan = serviceLoan(s)
  let paid = ledgerCosts(l) + loan.interest + loan.repay
  // Runway already counts owed costs, so payday itself does not move it: compare with last payday instead.
  const prev = s.finance.lastReceipt
  s.stats.cash -= paid
  s.finance.ledger = emptyLedger()
  // The month is paid at the old salaries; a raise earned today shows on the next receipt.
  yearlyRaises(s)
  recomputeDerived(s, content)
  // A covenant call is principal leaving today: it goes on the receipt with the instalment (the receipt reconciles).
  const called = checkCovenant(s, content)
  loan.repay += called
  paid += called
  s.finance.lastReceipt = {
    month: Math.max(0, Math.round(s.time.day / DAYS_PER_MONTH) - 1),
    day: Math.floor(s.time.day),
    revenue: l.revenue,
    salaries: l.salaries,
    rent: l.rent,
    infra: l.infra,
    ads: l.ads,
    founder: l.founder ?? 0,
    ...(loan.interest > 0 || loan.repay > 0 ? { interest: loan.interest, loanRepay: loan.repay } : {}),
    paid,
    net: l.revenue - paid,
    cashAfter: s.stats.cash,
    runwayBefore: prev ? prev.runwayAfter : null,
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
  if (paid > 0.5) pushActivity(s, 'payday', { amount: Math.round(paid) })
  pushEvent(s, { kind: 'payday', value: paid })
  missedPayroll(s, content)
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
 * Payday left the cash below zero: payroll was missed. The bankruptcy clock starts (endgame.ts counts it until
 * cash − owed ≥ 0 again) and the rescue card comes (docs/CORE_LOOP.md §5 "maaş ödenemedi → kurtarma kartı → 60 gün").
 * A dip below zero between paydays (a card, a desk) does not start the clock.
 */
function missedPayroll(s: GameState, content: EngineContent): void {
  if (s.stats.cash >= 0 || s.finance.payrollMissed) return
  s.finance.payrollMissed = true
  s.finance.negativeCashDays = 0
  pushActivity(s, 'payrollMissed', { amount: Math.round(-s.stats.cash) })
  pushEvent(s, { kind: 'payrollMissed', value: -s.stats.cash })
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
  // and it takes over from an unanswered active card instead of waiting behind it.
  if (card && isCardEligible(card, s, { ignoreCooldown: true })) bringCardNow(s, id)
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
 * RELEASE_UPDATE_MIN_DAYS), so the beat keeps coming in every stage. A project seen for the first time (old save) is
 * set silently.
 */
export function checkReleases(s: GameState, content: EngineContent): void {
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
    if (s.time.day - lastUpdateDay(s, p.id) < B.RELEASE_UPDATE_MIN_DAYS) continue
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
