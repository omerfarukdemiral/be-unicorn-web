// Core loop beats (docs/CORE_LOOP.md §4–§5): payday + month receipt, release moments, stage goals (☆).
import * as B from './balance'
import { recomputeDerived } from './derive'
import { DAYS_PER_MONTH, type GameState, type MonthLedger } from './types'
import { newId, pushActivity, pushEvent, uniquePush, type EngineContent } from './util'

const emptyLedger = (): MonthLedger => ({ revenue: 0, salaries: 0, rent: 0, infra: 0, ads: 0 })

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
  s.stats.cash += revenue
}

/** Payday (day % 30 === 0): salaries, rent, infra and ads leave in one lump; the month receipt is written. */
export function payday(s: GameState, content: EngineContent): void {
  const l = ledgerOf(s)
  const paid = l.salaries + l.rent + l.infra + l.ads
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

/**
 * Release moment: a project passing a maturity threshold ships a version (MVP, then 40/60/80/100%) and a user
 * wave walks in; MRR jumps with it. A project seen for the first time (old save) is set silently.
 */
export function checkReleases(s: GameState, content: EngineContent): void {
  for (const p of s.projects) {
    const lvl = releaseLevel(p.maturity)
    if (p.releaseLevel === undefined) {
      p.releaseLevel = lvl
      continue
    }
    if (lvl <= p.releaseLevel) continue
    p.releaseLevel = lvl
    const mrrBefore = s.finance.mrr
    const users = releaseWave(s, lvl)
    s.stats.users += users
    recomputeDerived(s, content)
    const entry = { id: newId(s, 'rel'), day: s.time.day, projectId: p.id, projectName: p.name, level: lvl, users, mrr: Math.max(0, s.finance.mrr - mrrBefore) }
    const list = (s.releases ??= [])
    list.push(entry)
    if (list.length > B.RELEASES_MAX) list.splice(0, list.length - B.RELEASES_MAX)
    pushActivity(s, 'release', { project: p.name, level: lvl, users, mrr: Math.round(entry.mrr) })
    pushEvent(s, { kind: 'release', refId: entry.id, value: lvl })
  }
}

/** Daily: latch the current stage's ☆ goals the first time they hold. */
export function checkGoals(s: GameState, content: EngineContent): void {
  const goals = content.goals
  if (!goals?.length) return
  for (const g of goals) {
    if (g.stage !== s.stage || s.goalsDone?.includes(g.id)) continue
    let ok = false
    try {
      ok = g.check(s) === true
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
