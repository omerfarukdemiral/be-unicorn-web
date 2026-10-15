// Ads you can read (A1, docs round 3 §3): what a budget step buys, why the CAC is what it is, when a step ends the
// runway. Pure selectors over the derived state: the Growth panel and the bots read them, the tick never does.
import * as B from './balance'
import * as E from './economy'
import { previewSpend } from './loopSelectors'
import { adFocusWarmup, adWeights, moduleMult, wMean } from './modules'
import type { GameState, ProjectModuleId } from './types'

export interface AdPreview {
  /** Paid users a month at that budget (today's CAC factors, the spend saturation at that budget). */
  paid: number
  cac: number
  /** Runway (months) after the change; null = not burning. */
  runwayAfter: number | null
}

/**
 * What `budget` a month would buy today: the CAC with that spend (every other factor as derived now: the spend
 * saturation is the only one the budget moves), the paid users it brings and the runway it leaves (previewSpend).
 */
export function adPreview(s: GameState, budget: number): AdPreview {
  const d = s.derived
  const pen = d.penetration ?? 0
  const now = E.cac(s.stage, d.avgMaturity, s.finance.adBudget, s.finance.mrr, pen)
  const then = E.cac(s.stage, d.avgMaturity, budget, s.finance.mrr, pen)
  const cac = now > 0 ? (d.cac * then) / now : then
  return { paid: E.paidPerMonth(budget, cac, pen), cac, runwayAfter: previewSpend(s, { burnDelta: budget - s.finance.adBudget }).runwayAfter }
}

/**
 * A step above today's budget that leaves under a month of runway (or any step up while the runway is already under a
 * month): the tile turns red, "Runway bitiyor". It stays a button (the player may still choose it). A step that keeps
 * the company profitable (runway ∞ after) never warns.
 */
export function adStepWarning(s: GameState, amount: number): boolean {
  if (amount <= s.finance.adBudget) return false
  const after = adPreview(s, amount).runwayAfter
  if (after === null) return false
  const now = s.finance.runway
  return after < 1 || (now !== null && now < 1)
}

export type CacFactorKey = 'crisis' | 'spend' | 'market' | 'focus' | 'maturity' | 'stage' | 'category' | 'modules' | 'policy'

/** Tie order of the reason line: the first one the player can act on or name. */
export const CAC_FACTOR_ORDER: readonly CacFactorKey[] = ['crisis', 'spend', 'market', 'focus', 'maturity', 'stage', 'category', 'modules', 'policy']

export interface CacFactor {
  key: CacFactorKey
  /** Multiplier on the CAC (1 = no effect). */
  value: number
  /** crisis: the modifier's source (card id or "crisis:{id}"); modules: the module raising it most. */
  source?: string
  module?: ProjectModuleId
  /** focus: warm-up days left. */
  days?: number
  /** market: penetration 0–1. */
  pen?: number
}

/**
 * The multiplicative parts of today's CAC (economy.cac × modifiers × policies × module mix × warm-up):
 * stage (CAC_STAGE_GROWTH, only CAC_STAGE_REASON_DAYS after a stage-up, against the stage before), maturity (against
 * avgMaturity 1), spend (the ad budget past the MRR), market (the penetration), crisis (the 'cac' modifiers), focus
 * (the warm-up), category (the ad-weighted CATEGORY_CAC, B1), modules (the ad-weighted module mix), policy. Every part but stage multiplies back to derived.cac
 * from CAC_BASE × CAC_STAGE_GROWTH^stage / 1.5.
 */
export function cacFactors(s: GameState): CacFactor[] {
  const d = s.derived
  const day = s.time.day
  const floor = B.CAC_SPEND_FLOOR[Math.min(B.CAC_SPEND_FLOOR.length - 1, Math.max(0, s.stage))]!
  const pen = d.penetration ?? 0
  const start = s.stageStart
  const fresh = s.stage > 0 && start !== undefined && start.stage === s.stage && day - start.day < B.CAC_STAGE_REASON_DAYS
  let crisis = 1
  let source: string | undefined
  let worst = 1
  for (const m of s.modifiers) {
    if (m.kind !== 'cac' || m.untilDay <= day) continue
    crisis *= m.value
    if (m.value > worst) {
      worst = m.value
      source = m.source
    }
  }
  const ads = adWeights(s)
  const modules = wMean(ads, (p) => moduleMult(p, 'cac', day))
  // The module that raises the CAC most on the products the ads promote (localization's minus today).
  let module: ProjectModuleId | undefined
  let top = 1
  for (const { p } of ads) {
    for (const m of p.modules ?? []) {
      const one = moduleMult(p, 'cac', day, [m])
      if (one > top) {
        top = one
        module = m.id
      }
    }
  }
  const warm = adFocusWarmup(s)
  const left = s.finance.adFocusDay !== undefined ? Math.max(1, Math.ceil(B.AD_FOCUS_WARMUP_DAYS - (day - s.finance.adFocusDay))) : 0
  return [
    { key: 'crisis', value: crisis, ...(source !== undefined ? { source } : {}) },
    { key: 'spend', value: 1 + B.CAC_SPEND_K * (Math.max(0, s.finance.adBudget) / Math.max(s.finance.mrr, floor)) ** B.CAC_SPEND_EXP },
    { key: 'market', value: 1 + B.CAC_SATURATION_K * pen * pen, pen },
    { key: 'focus', value: warm, ...(warm > 1 ? { days: left } : {}) },
    { key: 'maturity', value: 1.5 / (0.5 + d.avgMaturity) },
    { key: 'stage', value: fresh ? B.CAC_STAGE_GROWTH : 1 },
    { key: 'category', value: wMean(ads, (p) => B.CATEGORY_CAC[p.category] ?? 1) },
    { key: 'modules', value: modules, ...(module ? { module } : {}) },
    { key: 'policy', value: d.policies?.mult.cac ?? 1 },
  ]
}

/** The one reason line: the biggest factor at or above CAC_REASON_MIN (ties in CAC_FACTOR_ORDER), or null. */
export function cacReason(s: GameState): CacFactor | null {
  let best: CacFactor | null = null
  for (const f of cacFactors(s)) {
    if (f.value < B.CAC_REASON_MIN - 1e-9) continue
    if (!best || f.value > best.value + 1e-9) best = f
  }
  return best
}
