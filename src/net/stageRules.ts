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
/**
 * Earliest believable game day for each stage (cumulative from day 0). About 65% of the fastest bot run over
 * 160 simulated runs (sim/: 4 archetypes × 2 decision policies × 20 seeds; fastest days were
 * 104 / 184 / 318 / 583 / 866 / 1529). Rebalancing the game ⇒ re-measure these.
 */
export const MIN_DAY_FOR_STAGE: readonly number[] = [0, 65, 120, 210, 380, 560, 1000]
