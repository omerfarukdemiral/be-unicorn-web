// Pure core-loop selectors (docs/CORE_LOOP.md §5): the next link of the main chain and the horizon ahead.
// recomputeDerived stores both in state.derived (render/ui read them there); sim may call them directly.
import * as B from './balance'
import { ledgerCosts, runway } from './economy'
import { firstFreeDesk, isFreeDesk } from './office'
import {
  DAYS_PER_WEEK,
  type CashProjection,
  type CompanyProfile,
  type GameState,
  type HorizonItem,
  type NextStep,
  type NextStepId,
  type SpendPreview,
} from './types'

/** Chain order; round / roundWait / grow share the last link. */
const CHAIN: readonly NextStepId[] = ['idea', 'findUsers', 'desk', 'hire', 'launch', 'users', 'traction', 'round']
const CHAIN_TOTAL = CHAIN.length

function step(id: NextStepId, extra: Omit<NextStep, 'id' | 'index' | 'total'> = {}): NextStep {
  const i = CHAIN.indexOf(id)
  return { id, index: (i < 0 ? CHAIN_TOTAL - 1 : i) + 1, total: CHAIN_TOTAL, ...extra }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Day of a project's last update or 1.0 release (−∞ = none on record). */
export function lastUpdateDay(s: GameState, projectId: string): number {
  const list = s.releases ?? []
  for (let i = list.length - 1; i >= 0; i--) if (list[i]!.projectId === projectId && list[i]!.level >= B.RELEASE_THRESHOLDS.length) return list[i]!.day
  return -Infinity
}

/**
 * First unmet link of: idea → first manual users → desk → hire → release (MVP) → users → traction → round.
 * 'traction' is the garage / pre-seed valuation link before revenue: valuation there is launched × $150K + users ×
 * $400 + releases (max 5) × $15K (economy.valuationPreRevenue, GAMEPLAY V2 §4.1): users and releases, not hires.
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
  const target = B.STAGE_TARGET_VALUATION[s.stage + 1] ?? null
  if (s.finance.mrr < B.PRE_REVENUE_MRR && s.stage <= 1 && !s.round?.active && !s.derived.canStartRound && target !== null) {
    const windowAt = target * B.ROUND_EARLY_RATIO
    return step('traction', { progress: clamp01(s.finance.valuation / windowAt), target: windowAt })
  }
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
    if (rate <= 0) continue
    if (p.maturity >= 1) {
      // The next update: its work left at today's speed, but not before the update cool-down ends.
      const eta = Math.max(now + Math.max(0, B.RELEASE_UPDATE_SIZE - (p.updateProgress ?? 0)) / rate, lastUpdateDay(s, p.id) + B.RELEASE_UPDATE_MIN_DAYS)
      if (eta <= end) out.push({ kind: 'release', day: eta, projectId: p.id, level: B.RELEASE_THRESHOLDS.length, update: (p.updates ?? 0) + 1 })
      continue
    }
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

// ---------------------------------------------------------------------------
// GAMEPLAY V2 (§4.4, §14.2): spend preview, cash projection, company profile. Not stored in derived: the UI calls
// them (useMemo) and draws what they return.
// ---------------------------------------------------------------------------

/** Cash after payday at today's net: `free` is cash − owed, `net` the monthly net, `first` the next payday. */
interface CashCore {
  now: number
  first: number
  free: number
  net: number
}

function cashCore(s: GameState, cashDelta: number, burnDelta: number): CashCore {
  const l = s.finance.ledger
  const now = s.time.day
  return {
    now,
    first: now + daysToPayday(now),
    free: s.stats.cash - (l ? ledgerCosts(l) : 0) + cashDelta,
    net: s.finance.net - burnDelta,
  }
}

/** Cash left right after the payday on `day` (revenue flows in daily, costs leave on payday: same totals). */
const cashAfterPayday = (c: CashCore, day: number): number => c.free + (c.net * (day - c.now)) / B.PAYDAY_EVERY_DAYS

/** First payday whose cash goes below zero; null if none ever does (net ≥ 0 and the next one is paid). */
function deathDayOf(c: CashCore): number | null {
  const a = cashAfterPayday(c, c.first)
  if (a < 0) return c.first
  if (c.net >= 0) return null
  return c.first + B.PAYDAY_EVERY_DAYS * (Math.floor(a / -c.net) + 1)
}

/**
 * What a commit button would do to the money (§4.4): `cashDelta` is paid now (a purchase: negative), `burnDelta` is
 * added to the monthly burn (a hire: its salary). Death day at payday granularity.
 */
export function previewSpend(s: GameState, delta: { cashDelta?: number; burnDelta?: number } = {}): SpendPreview {
  const c = cashCore(s, delta.cashDelta ?? 0, delta.burnDelta ?? 0)
  const deathDay = deathDayOf(c)
  return { runwayNow: s.finance.runway, runwayAfter: runway(c.free, c.net), deathDay, paydayShort: deathDay === c.first }
}

/** Cash after each of the next `months` paydays at today's net, and the death day (same core as previewSpend). */
export function cashProjection(s: GameState, months = 12): CashProjection {
  const c = cashCore(s, 0, 0)
  const points: CashProjection['points'] = []
  for (let k = 0; k < months; k++) {
    const day = c.first + k * B.PAYDAY_EVERY_DAYS
    points.push({ day, cash: cashAfterPayday(c, day) })
  }
  return { points, deathDay: deathDayOf(c) }
}

const profileAxis = (v: number): number => (v < 0 ? 0 : v > B.PROFILE_MAX ? B.PROFILE_MAX : v)
const stageValue = (list: readonly number[], stage: number): number => list[Math.min(list.length - 1, stage)] ?? 1

/**
 * Company radar (§14.2), each axis 0–PROFILE_MAX where 1 = what the stage expects: product (average maturity),
 * growth (3-month MoM vs the diligence ask; null before revenue), efficiency (burn multiple vs the diligence ask;
 * null before revenue and before Seed, where it is not asked; not burning = full),
 * team (head count), morale (vs the diligence floor), cash (runway months; profitable = full).
 */
export function companyProfile(s: GameState): CompanyProfile {
  const st = s.stage
  const rw = s.finance.runway
  return {
    product: s.projects.length ? profileAxis(s.derived.avgMaturity / stageValue(B.PROFILE_PRODUCT_EXPECT, st)) : null,
    growth: s.finance.mrr >= B.PRE_REVENUE_MRR ? profileAxis((s.derived.momAvg ?? s.derived.momGrowth) / stageValue(B.DILIGENCE_MOM, st)) : null,
    efficiency: efficiencyAxis(s),
    team: profileAxis(s.employees.length / stageValue(B.PROFILE_TEAM_EXPECT, st)),
    morale: profileAxis(s.stats.morale / B.DILIGENCE_MORALE),
    cash: rw === null ? B.PROFILE_MAX : profileAxis(rw / B.PROFILE_RUNWAY_MONTHS),
  }
}

/** The stage asks for a burn multiple (DILIGENCE_BM below the cap: Seed on). */
const asksBurn = (stage: number): boolean => stageValue(B.DILIGENCE_BM, stage) < B.BURN_MULTIPLE_MAX

/** Efficiency axis: DILIGENCE_BM / burn multiple (1 = at the ask); null while the stage does not ask for it. */
function efficiencyAxis(s: GameState): number | null {
  if (s.finance.mrr < B.PRE_REVENUE_MRR || !asksBurn(s.stage)) return null
  const bm = s.derived.burnMultiple ?? 0
  return bm <= 0 ? B.PROFILE_MAX : profileAxis(stageValue(B.DILIGENCE_BM, s.stage) / bm)
}

/** The investor's expectation on the same axes (due diligence): the second polygon of the radar. */
export function targetProfile(stage: number): CompanyProfile {
  return {
    product: 1,
    growth: 1,
    efficiency: asksBurn(stage) ? 1 : null,
    team: 1,
    morale: 1,
    cash: profileAxis(B.DILIGENCE_RUNWAY_MONTHS / B.PROFILE_RUNWAY_MONTHS),
  }
}
