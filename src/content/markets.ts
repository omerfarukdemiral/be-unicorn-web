// Market segments (GAMEPLAY V2 §8.1): ABSOLUTE sizes in users. The engine sums the open ones into the TAM.
// Sizes follow Σsize(≤ stage) ≈ STAGE_TARGET_VALUATION[stage + 1] / (12 × MULTIPLE_MAX_BY_STAGE[stage] × ARPU[stage])
// / 0.7 × 1.15 (stage exit at pen ≈ 0.7; sales contracts bring MRR without users, × 1.15). market.test checks it.
// The engine counts size × MARKET_SIZE_SCALE (balance.ts, interim: the §4.3 saturation curve stalls growth at that pen).
import type { MarketSegmentId, StageIndex, ToolId } from '../engine/types'

export interface MarketSegmentDef {
  id: MarketSegmentId
  /** Stage it opens at (auto) or can be opened from (verb). */
  stage: StageIndex
  /** Users it adds to the TAM. */
  size: number
  /** true: opens by itself on arriving at `stage` (no cost, no move). */
  auto: boolean
  /** One-off cost and monthly upkeep (openSegment). */
  cost: number
  upkeep: number
  /** Tool that must be unlocked first (enterprise needs enterpriseSales). */
  needsTool?: ToolId
  /** Ops people needed (global: compliance). */
  needsOps?: number
}

/**
 * [DENGE ≠ GAMEPLAY V2 §8.1 table 2K/10K/50K/200K/450K] The table was derived from older constants; with today's
 * MULTIPLE_MAX_BY_STAGE (C 5.15) the formula asks for 2K / 14K / 68K / 250K / 700K (cumulative 16K / 84K / 334K / 1.03M).
 */
export const MARKET_SEGMENTS: readonly MarketSegmentDef[] = [
  { id: 'early', stage: 0, size: 2_000, auto: true, cost: 0, upkeep: 0 },
  { id: 'smb', stage: 2, size: 14_000, auto: true, cost: 0, upkeep: 0 },
  { id: 'midmarket', stage: 3, size: 68_000, auto: false, cost: 250_000, upkeep: 8_000 },
  { id: 'enterprise', stage: 4, size: 250_000, auto: false, cost: 1_500_000, upkeep: 40_000, needsTool: 'enterpriseSales' },
  { id: 'global', stage: 5, size: 700_000, auto: false, cost: 8_000_000, upkeep: 150_000, needsOps: 3 },
]

export function segmentDef(id: MarketSegmentId): MarketSegmentDef | undefined {
  return MARKET_SEGMENTS.find((m) => m.id === id)
}
