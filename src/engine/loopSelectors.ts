// Pure core-loop selectors (docs/CORE_LOOP.md §5): the next link of the main chain and the horizon ahead.
// recomputeDerived stores both in state.derived (render/ui read them there); sim may call them directly.
import * as B from './balance'
import { ledgerCosts } from './economy'
import { firstFreeDesk, isFreeDesk } from './office'
import { DAYS_PER_WEEK, type GameState, type HorizonItem, type NextStep, type NextStepId } from './types'

/** Chain order; round / roundWait / grow share the last link. */
const CHAIN: readonly NextStepId[] = ['idea', 'findUsers', 'desk', 'hire', 'launch', 'users', 'revenue', 'round']
const CHAIN_TOTAL = CHAIN.length

function step(id: NextStepId, extra: Omit<NextStep, 'id' | 'index' | 'total'> = {}): NextStep {
  const i = CHAIN.indexOf(id)
  return { id, index: (i < 0 ? CHAIN_TOTAL - 1 : i) + 1, total: CHAIN_TOTAL, ...extra }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * First unmet link of: idea → first manual users → desk → hire → release (MVP) → users → revenue → round.
 * Links that are done stay done (a later stage never sends the player back to "pick an idea" once a project runs).
 */
export function nextStep(s: GameState): NextStep {
  if (s.projects.length === 0) return step('idea')
  const hired = (s.counters.hires ?? 0) > 0 || s.employees.length > 0
  if (!hired && s.stage === 0 && (s.counters.manualFinds ?? 0) === 0 && s.stats.users < B.NEXT_STEP_FIRST_USERS) return step('findUsers')
  if (!hired) {
    if (!firstFreeDesk(s.office)) {
      const empty = s.office.slots.find((x) => isFreeDesk(s.office, x) && x.itemId === undefined && x.spanOf === undefined)
      return step('desk', empty ? { slotId: empty.id } : {})
    }
    return step('hire')
  }
  if (!s.projects.some((p) => p.launched)) {
    const best = s.projects.reduce((m, p) => Math.max(m, p.maturity), 0)
    return step('launch', { progress: clamp01(best / B.MVP_MATURITY), target: B.MVP_MATURITY })
  }
  if (s.stats.users < B.NEXT_STEP_USERS && s.stage === 0) return step('users', { progress: clamp01(s.stats.users / B.NEXT_STEP_USERS), target: B.NEXT_STEP_USERS })
  if (s.finance.mrr < B.PRE_REVENUE_MRR && s.stage <= 1) return step('revenue', { progress: clamp01(s.finance.mrr / B.PRE_REVENUE_MRR), target: B.PRE_REVENUE_MRR })
  const target = B.STAGE_TARGET_VALUATION[s.stage + 1] ?? null
  if (s.round?.active) {
    const r = s.round
    return step('roundWait', { progress: r.weeksTotal > 0 ? clamp01(1 - r.weeksLeft / r.weeksTotal) : 0 })
  }
  if (s.derived.canStartRound) return step('round')
  return step('grow', { progress: clamp01(s.derived.stageProgress), ...(target !== null ? { target } : {}) })
}

/** Days until the next payday (1..30) from `day`. */
export function daysToPayday(day: number): number {
  const next = (Math.floor(day / B.PAYDAY_EVERY_DAYS) + 1) * B.PAYDAY_EVERY_DAYS
  return next - day
}

/**
 * The next HORIZON_DAYS: paydays with their projected lump, delayed decision effects (with the source card),
 * release ETAs at today's build speed, the round close and a ready round. Sorted by day.
 */
export function horizon(s: GameState): HorizonItem[] {
  const now = s.time.day
  const end = now + B.HORIZON_DAYS
  const out: HorizonItem[] = []
  const burn = s.finance.burn
  const l = s.finance.ledger
  const owed = l ? ledgerCosts(l) : 0
  let pay = now + daysToPayday(now)
  let first = true
  while (pay <= end + 1e-9) {
    const amount = first ? owed + (burn * (pay - now)) / B.PAYDAY_EVERY_DAYS : burn
    out.push({ kind: 'payday', day: pay, amount })
    first = false
    pay += B.PAYDAY_EVERY_DAYS
  }
  for (const p of s.decisions.pending) {
    if (p.applyDay > end) continue
    out.push({
      kind: 'delayed',
      day: p.applyDay,
      ...(p.sourceCardId !== undefined ? { cardId: p.sourceCardId } : {}),
      ...(p.sourceOption !== undefined ? { optionIndex: p.sourceOption } : {}),
      ...(p.noteKey !== undefined ? { noteKey: p.noteKey } : {}),
    })
  }
  const rates = s.derived.maturityPerDay ?? {}
  for (const p of s.projects) {
    const rate = rates[p.id] ?? 0
    if (p.maturity >= 1 || rate <= 0) continue
    const lvl = B.RELEASE_THRESHOLDS.findIndex((t) => p.maturity < t - 1e-9)
    if (lvl < 0) continue
    const eta = now + (B.RELEASE_THRESHOLDS[lvl]! - p.maturity) / rate
    if (eta <= end) out.push({ kind: 'release', day: eta, projectId: p.id, level: lvl + 1 })
  }
  const r = s.round
  if (r?.active) {
    const acc = Number(s.flags['roundWeekAcc'] ?? 0)
    out.push({ kind: 'roundClose', day: now + Math.max(0, r.weeksLeft * DAYS_PER_WEEK - acc) })
  } else if (s.derived.canStartRound) {
    out.push({ kind: 'roundReady', day: now })
  }
  return out.sort((a, b) => a.day - b.day)
}
