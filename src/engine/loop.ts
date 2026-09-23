// Core loop beats (docs/CORE_LOOP.md §4–§5): payday + month receipt, release moments, stage goals (☆).
import * as B from './balance'
import { bringCardNow, isCardEligible } from './decisions'
import { recomputeDerived } from './derive'
import { ledgerCosts } from './economy'
import { lastUpdateDay } from './loopSelectors'
import { DAYS_PER_MONTH, type GameState, type MonthLedger, type Project, type ReleaseEntry } from './types'
import { newId, pushActivity, pushEvent, stageBaseline, uniquePush, type EngineContent } from './util'

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

/** Payday (day % 30 === 0): salaries, rent, infra and ads leave in one lump; the month receipt is written. */
export function payday(s: GameState, content: EngineContent): void {
  const l = ledgerOf(s)
  const paid = ledgerCosts(l)
  // Runway already counts owed costs, so payday itself does not move it: compare with last payday instead.
  const prev = s.finance.lastReceipt
  s.stats.cash -= paid
  s.finance.ledger = emptyLedger()
  recomputeDerived(s, content)
  s.finance.lastReceipt = {
    month: Math.max(0, Math.round(s.time.day / DAYS_PER_MONTH) - 1),
    day: Math.floor(s.time.day),
    revenue: l.revenue,
    salaries: l.salaries,
    rent: l.rent,
    infra: l.infra,
    ads: l.ads,
    founder: l.founder ?? 0,
    paid,
    net: l.revenue - paid,
    cashAfter: s.stats.cash,
    runwayBefore: prev ? prev.runwayAfter : null,
    runwayAfter: s.finance.runway,
    mom: s.derived.momGrowth,
    multiple: s.derived.valuationMultiple,
    mrr: s.finance.mrr,
    users: s.stats.users,
  }
  if (paid > 0.5) pushActivity(s, 'payday', { amount: Math.round(paid) })
  pushEvent(s, { kind: 'payday', value: paid })
  missedPayroll(s, content)
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
