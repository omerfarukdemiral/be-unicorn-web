// Numbers the server needs to judge leaderboard submissions, shared with the client. No imports on purpose: the
// Vercel functions load this file at runtime and must not pull in game content. A test keeps it equal to
// src/content/stages.ts and the engine time constants.

export const STAGE_COUNT = 7
export const UNICORN_STAGE = 6
/** Target valuation of each stage (index = StageIndex; Garaj has none). */
export const STAGE_TARGET: readonly number[] = [0, 500_000, 3_000_000, 15_000_000, 75_000_000, 300_000_000, 1_000_000_000]
/** Office slots per stage (Unicorn keeps Series C's). */
export const STAGE_SLOTS: readonly number[] = [4, 10, 18, 30, 44, 60, 60]
/** engine SECONDS_PER_DAY and the fastest GameSpeed. */
export const SECONDS_PER_DAY = 2
export const MAX_SPEED = 4
/** Share of the fastest measured day a submission may reach a stage at (DECISIONS #20). */
export const MIN_STAGE_SHARE = 0.65
/**
 * Fastest day each stage was reached over 160 real-engine bot runs (`npx tsx sim/minStageDays.ts`: 4 archetypes ×
 * 2 decision policies × 20 seeds × 3000 days), re-measured 2026-10-06 after the project-category trade-off
 * (CATEGORY_ARPU / CATEGORY_ORGANIC; was 0/109/155/381/695/1033/1855). Rebalancing ⇒ re-measure.
 */
export const MEASURED_FASTEST_DAYS: readonly number[] = [0, 105, 146, 332, 619, 947, 1681]
/** MIN_STAGE_SHARE of the fastest day, floored to 5 days (never above the measured share). */
export const minDayTable = (fastest: readonly number[]): number[] => fastest.map((d) => Math.floor((d * MIN_STAGE_SHARE) / 5) * 5)
/** Earliest believable game day for each stage (cumulative from day 0) = minDayTable(MEASURED_FASTEST_DAYS). */
export const MIN_DAY_FOR_STAGE: readonly number[] = [0, 65, 90, 215, 400, 615, 1090]
