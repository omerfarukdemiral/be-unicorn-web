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
 * 2 decision policies × 20 seeds × 3000 days), re-measured 2026-10-16 after master's B1/B2/F3 balance (10 module slots, pricing forks, game/web levers, payday dust)
 * met the free office grid (before: 0/103/151/258/464/759/1433 after the sim bots stopped spending the month owed on payday,
 * 0/103/151/258/464/759/1434 after the free office grid's team islands (+3%, replacing the +10% dept cluster) and auto seating (grid step 5), 0/103/150/265/495/788/1359 after the kind-weight module bots and the module effect scale MV2d round 3 follow-up, 0/103/150/267/492/800/1427 after the first MV2d pass with tight caps, 0/103/150/282/496/865/1378 after per-product users and the ad focus that routes paid users A1 round 3, 0/103/150/280/547/865/1378 after the crisis slowdown and 7-day burnout notice E1 round 3, 0/103/150/280/546/865/1378 after the effort bots E2, 0/103/150/270/516/923/1459 after effort management E1,
 * 0/103/150/271/515/896/1419 after the ad focus, 0/103/150/277/523/918/1721 after the four
 * round meetings, 0/105/150/290/560/876/1667 after the garage levers, 0/105/146/332/619/947/1681, and 0/109/155/381/695/1033/1855 before
 * the category trade-off).
 * Rebalancing ⇒ re-measure.
 */
export const MEASURED_FASTEST_DAYS: readonly number[] = [0, 103, 151, 257, 486, 758, 1372]
/** MIN_STAGE_SHARE of the fastest day, floored to 5 days (never above the measured share). */
export const minDayTable = (fastest: readonly number[]): number[] => fastest.map((d) => Math.floor((d * MIN_STAGE_SHARE) / 5) * 5)
/** Earliest believable game day for each stage (cumulative from day 0) = minDayTable(MEASURED_FASTEST_DAYS). */
export const MIN_DAY_FOR_STAGE: readonly number[] = [0, 65, 95, 165, 315, 490, 890]
