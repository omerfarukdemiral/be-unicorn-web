// Bankruptcy, team loss, victory (PLAN §5.10) and the sale (GAMEPLAY V2 §8.2). Post-mortem reasons come from the player's own data.
import * as B from './balance'
import { promoteConcept } from './concepts'
import { queueConcept } from './effects'
import { owedCosts } from './derive'
import { enterStage, pushStageReport } from './round'
import type { ConceptId, GameState, PostMortemCode, PostMortemReason } from './types'
import { pushActivity, pushEvent, type EngineContent } from './util'

const REASON_CONCEPT: Record<PostMortemCode, ConceptId | undefined> = {
  runwayIgnored: 'runway',
  burnTooHigh: 'burn',
  scaledWithoutPmf: 'pmf',
  highChurn: 'churn',
  lowMorale: 'morale-compounds',
  prematureScaling: 'premature-scaling',
  lateFundraise: 'fundraise-time',
  overload: 'dont-scale',
  teamLost: 'hire-bar',
  unfocused: 'focus',
}

/** Scores every reason (higher = more relevant) and returns exactly 3. */
export function postMortemReasons(s: GameState, kind: 'bankrupt' | 'teamLost'): PostMortemReason[] {
  const f = s.finance
  const d = s.derived
  const active = s.projects.filter((p) => p.maturity < 1).length
  const scored: { code: PostMortemCode; score: number; value: number }[] = [
    { code: 'burnTooHigh', score: f.burn / Math.max(1, f.mrr), value: f.burn },
    { code: 'runwayIgnored', score: s.flags['roundStartedOnce'] ? 0.5 : 2.5, value: f.runway ?? 0 },
    { code: 'highChurn', score: s.stats.churn / 0.05, value: s.stats.churn },
    { code: 'lowMorale', score: (60 - s.stats.morale) / 15, value: s.stats.morale },
    { code: 'prematureScaling', score: d.teamSize >= 6 && s.stats.users < 300 ? 2 : 0, value: d.teamSize },
    { code: 'scaledWithoutPmf', score: f.adBudget > 0 && d.avgMaturity < 0.4 ? 2.2 : d.avgMaturity < 0.3 ? 1 : 0, value: d.avgMaturity },
    { code: 'overload', score: d.overload * 3, value: d.overload },
    { code: 'unfocused', score: s.stage <= B.PARALLEL_PENALTY_MAX_STAGE && active > 1 ? 1.5 * (active - 1) : 0, value: active },
    { code: 'lateFundraise', score: s.round?.active ? 3 : 0, value: s.round?.weeksLeft ?? 0 },
    { code: 'teamLost', score: kind === 'teamLost' ? 10 : 0, value: s.counters.resignations ?? 0 },
  ]
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3).map((r) => {
    const conceptId = REASON_CONCEPT[r.code]
    return { code: r.code, value: r.value, ...(conceptId ? { conceptId } : {}) }
  })
}

export function endRun(s: GameState, content: EngineContent, kind: 'bankrupt' | 'teamLost'): void {
  if (s.gameOver) return
  const xp = B.XP_PER_STAGE * (1 + s.stage)
  s.gameOver = { kind, day: s.time.day, reasons: postMortemReasons(s, kind), xpEarned: xp }
  s.time.speed = 0
  queueConcept(s, content, 'failure-is-data')
  promoteConcept(s, content.concepts, true)
  pushEvent(s, { kind: 'gameOver', value: xp })
}

/** `content`: the Series C report card is written (GAMEPLAY V2 §9.3); without it (tests) none is. */
export function winRun(s: GameState, content?: EngineContent): void {
  if (s.gameOver) return
  if (content) pushStageReport(s, content)
  // No rng: Unicorn ends the run, no crisis is scheduled there (GAMEPLAY V2 §5.1 RNG chain).
  enterStage(s, B.LAST_STAGE)
  s.gameOver = { kind: 'unicorn', day: s.time.day, reasons: [], xpEarned: B.XP_PER_STAGE * (B.LAST_STAGE + 1) }
  s.time.speed = 0
  pushEvent(s, { kind: 'victory', value: s.finance.valuation })
}

/**
 * GAMEPLAY V2 §8.2 sub-ending: the acquisition-offer was taken ("Sat, oyunu bitir"). The run ends as 'acquired' with the
 * XP of the stage it was sold in (as a run ending there would earn); it never goes to the leaderboard (net/cloud.ts).
 */
export function sellCompany(s: GameState): void {
  if (s.gameOver) return
  delete s.flags[B.ACQUIRED_FLAG]
  const xp = B.XP_PER_STAGE * (1 + s.stage)
  s.gameOver = { kind: 'acquired', day: s.time.day, reasons: [], xpEarned: xp }
  s.time.speed = 0
  pushEvent(s, { kind: 'gameOver', value: xp })
}

/** The sale was signed (the card's flag): it ends the run at once, wherever the answer came from (click or default). */
export function checkSale(s: GameState): void {
  if (s.flags[B.ACQUIRED_FLAG]) sellCompany(s)
}

/**
 * Daily: the sale, bankruptcy clock + warnings, team-zero grace, unicorn check. The clock runs only after a missed payday
 * (loop.ts `missedPayroll`) and stops once cash covers what is owed again (docs/CORE_LOOP.md §5 "Maaş günü").
 */
export function dailyEndgame(s: GameState, content: EngineContent): void {
  checkSale(s)
  if (s.gameOver) return
  if (s.finance.payrollMissed && s.stats.cash - owedCosts(s) >= 0) s.finance.payrollMissed = false
  if (s.finance.payrollMissed) {
    s.finance.negativeCashDays += 1
    const n = s.finance.negativeCashDays
    if (B.BANKRUPT_WARNING_DAYS.includes(n)) {
      pushActivity(s, 'bankruptWarning', { days: B.BANKRUPT_DAYS - n })
      pushEvent(s, { kind: 'bankruptWarning', value: B.BANKRUPT_DAYS - n })
    }
    if (n >= B.BANKRUPT_DAYS) return endRun(s, content, 'bankrupt')
  } else {
    s.finance.negativeCashDays = 0
  }
  if ((s.counters.hires ?? 0) > 0 && s.employees.length === 0) {
    const since = Number(s.flags['teamZeroSince'] ?? s.time.day)
    s.flags['teamZeroSince'] = since
    if (s.time.day - since >= B.TEAM_ZERO_GRACE_DAYS) return endRun(s, content, 'teamLost')
  } else if (s.flags['teamZeroSince'] !== undefined) {
    delete s.flags['teamZeroSince']
  }
  const target = B.STAGE_TARGET_VALUATION[B.LAST_STAGE] ?? Infinity
  if (s.stage === B.LAST_STAGE - 1 && s.finance.valuation >= target) winRun(s, content)
}
