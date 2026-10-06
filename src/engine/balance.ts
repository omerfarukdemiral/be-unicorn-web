// All tunable numbers. Every value is a [DENGE] starting point, tuned by sim/.
// Values that differ from the PLAN §5 starting points are listed, with the sim result, in docs/DECISIONS.md (#12).
import type { Dept, FounderActionKind, ProjectCategory, RoundSize, StageIndex, ToolId } from './types'

// ---------------------------------------------------------------------------
// Start (PLAN §5.10)
// ---------------------------------------------------------------------------
/** [Faz 3] Garage (CORE_LOOP §9 S1-b): $15K + founder living cost → ~10 months runway, ~4–5 after the first hire. */
export const START_CASH = 15_000
export const START_MORALE = 70
export const START_REPUTATION = 10
/** Start cash bonus = min(XP_BONUS_CAP, XP_BONUS_PER_XP × xp). */
export const XP_BONUS_PER_XP = 0.1
export const XP_BONUS_CAP = 0.4
export const XP_PER_STAGE = 1

// ---------------------------------------------------------------------------
// Stage table (PLAN §3.1). Mirrors content/stages.ts; a test keeps them in sync.
// ---------------------------------------------------------------------------
export const STAGE_COUNT = 7
export const LAST_STAGE: StageIndex = 6
export const STAGE_RINGS: readonly number[] = [1, 2, 3, 4, 5, 6, 0]
export const STAGE_SLOTS: readonly number[] = [4, 10, 18, 30, 44, 60, 0]
/** Valuation needed to reach stage i (index = target stage). */
export const STAGE_TARGET_VALUATION: readonly (number | null)[] = [null, 500_000, 3_000_000, 15_000_000, 75_000_000, 300_000_000, 1_000_000_000]
export const ROUND_AMOUNT: readonly (number | null)[] = [null, 150_000, 800_000, 4_000_000, 20_000_000, 150_000_000, null]
/** Tools unlocked on arriving at a stage (mirrors content STAGES.unlockTools). */
export const STAGE_UNLOCK_TOOLS: Readonly<Partial<Record<number, readonly ToolId[]>>> = {
  1: ['capTableView'],
  // Seed's price control is unlocked by the `pricing` concept (Hisset → Adlandır → Kullan).
  3: ['adBudget', 'refactor', 'segments', 'renewal'],
  4: ['enterpriseSales', 'mna'],
}
export const ROUND_EQUITY: readonly (number | null)[] = [null, 0.1, 0.15, 0.18, 0.15, 0.12, null]

// ---------------------------------------------------------------------------
// Office (PLAN §3.2–3.4)
// ---------------------------------------------------------------------------
/** Slots per ring (ring 1..6). Cumulative = STAGE_SLOTS. */
export const RING_SLOT_COUNTS: readonly number[] = [4, 6, 8, 12, 14, 16]
/** One-off renovation cost to open ring r (index = ring). Ring 1 is always open. */
export const RING_OPEN_COST: readonly number[] = [0, 0, 6_000, 30_000, 150_000, 700_000, 3_500_000]
/** Base office rent per month (index = stage). */
export const OFFICE_BASE_RENT: readonly number[] = [300, 1_500, 5_000, 20_000, 80_000, 300_000, 300_000]
/** Rent per opened extra ring (beyond ring 1) per month (index = stage). */
export const RING_RENT: readonly number[] = [0, 800, 2_500, 8_000, 30_000, 100_000, 100_000]
/** Chebyshev radius for "adjacent" (aura, dept cluster). */
export const ADJACENCY_RADIUS = 2
export const DEPT_CLUSTER_MIN = 3
export const DEPT_CLUSTER_BONUS = 0.1
/** Output factor for an employee on a desk slot without a desk item / without any desk. */
export const NO_DESK_ITEM_QUALITY = 0.85
export const NO_DESK_QUALITY = 0.6
export const SELL_REFUND = 0.5
/** Bookshelf: extra global morale per learned concept, capped. */
export const BOOKSHELF_PER_CONCEPT = 0.2
export const BOOKSHELF_CONCEPT_CAP = 5

// ---------------------------------------------------------------------------
// Production (PLAN §5.2–5.3)
// ---------------------------------------------------------------------------
/** [DENGE ≠ PLAN] marketing 3: organic reach per marketer (PLAN: every dept 1). See DECISIONS #12. */
export const BASE_OUTPUT: Readonly<Record<Dept, number>> = { eng: 1, product: 1, marketing: 3, sales: 1, ops: 1 }
export const ONBOARDING_DAYS = 3
export const ONBOARDING_OUTPUT = 0.5
/**
 * [GAMEPLAY V2 §4.2] Coordination: free up to 10 people, then −1.5%/person down to COORDINATION_MIN. A meeting room
 * only softens the loss (× COORDINATION_ROOM_FACTOR); it no longer zeroes it.
 */
export const COORDINATION_TEAM_FREE = 10
export const COORDINATION_PER_PERSON = 0.015
export const COORDINATION_MIN = 0.7
export const COORDINATION_ROOM_FACTOR = 0.5
/** Morale points lost per 1.0 of coordination loss (0.3 loss → −15). */
export const COORDINATION_MORALE_FACTOR = 50
/** Maturity weights. */
export const MATURITY_ENG_WEIGHT = 1.0
export const MATURITY_PRODUCT_WEIGHT = 0.5
/** Founder codes on the oldest unfinished project when idle (eng-equivalent output). */
export const FOUNDER_PROJECT_OUTPUT = 0.5
export const MVP_MATURITY = 0.2
/** Garage–Seed: each extra active project slows all by this much. */
export const PARALLEL_PENALTY = 0.2
export const PARALLEL_PENALTY_MAX_STAGE: StageIndex = 2
export const PARALLEL_MIN_SPEED = 0.2
/** Tech debt: speed × max(TECH_DEBT_MIN_SPEED, 1 − TECH_DEBT_PER_POINT × debt) (GAMEPLAY V2 §4.2: 0.05 → 0.02). */
export const TECH_DEBT_PER_POINT = 0.02
export const TECH_DEBT_MIN_SPEED = 0.5
/**
 * [GAMEPLAY V2 §4.2] From Series A every update adds TECH_DEBT_PER_UPDATE (0.4, not 1.5: a stage ships 15–52 updates);
 * each month end the engineers pay TECH_DEBT_AMORT_PER_ENG × eng back; churn × (1 + debt / TECH_DEBT_CHURN_DIV).
 */
export const TECH_DEBT_MIN_STAGE: StageIndex = 3
export const TECH_DEBT_PER_UPDATE = 0.4
export const TECH_DEBT_AMORT_PER_ENG = 0.05
export const TECH_DEBT_CHURN_DIV = 200
/** "Refactor sprinti" (the debt sink): −(BASE + eng) debt, production × REFACTOR_PRODUCTION for REFACTOR_DAYS, 90-day cooldown. */
export const REFACTOR_DEBT_BASE = 8
export const REFACTOR_PRODUCTION = 0.7
export const REFACTOR_DAYS = 30
export const REFACTOR_COOLDOWN_DAYS = 90
/** Maturity per month = output / size; size per category. */
export const PROJECT_SIZE: Readonly<Record<ProjectCategory, number>> = { mobile: 10, web: 8, ai: 14, api: 9, game: 12, marketplace: 12 }
/**
 * [Playtest 2026-10-06] The category is a real trade-off, not just a build time: per-user revenue and word of mouth
 * of the launched projects (their mean; 1 before any launch). Fast + cheap (web), slow + rich (ai), viral but poor
 * (game), B2B price with little buzz (api). Means ≈ 0.99 / 1.04 and the rich end capped at 1.2: the first cut
 * (api 1.25, ai 1.45) moved the fastest Unicorn from day 1855 to 1378 in sim/minStageDays.ts.
 */
export const CATEGORY_ARPU: Readonly<Record<ProjectCategory, number>> = { web: 0.85, mobile: 1, api: 1.1, ai: 1.2, game: 0.8, marketplace: 1 }
export const CATEGORY_ORGANIC: Readonly<Record<ProjectCategory, number>> = { web: 1, mobile: 1.1, api: 0.75, ai: 0.9, game: 1.35, marketplace: 1.15 }

// ---------------------------------------------------------------------------
// Users (PLAN §5.4)
// ---------------------------------------------------------------------------
export const CAPACITY_MIN = 50
/** [DENGE ≠ PLAN 1500] Faz 3: 20K (was 4K): with 36 desks the late game hit a server wall that stalled user-heavy archetypes at random. */
export const CAPACITY_PER_ENG = 20000
/** [DENGE ≠ PLAN 25] */
export const ORGANIC_PER_MARKETING = 42
/** [DENGE ≠ PLAN 8 × 1.3^aşama] */
export const CAC_BASE = 45
export const CAC_STAGE_GROWTH = 1.7
export const CHURN_BASE = 0.06
export const CHURN_OPS_PER = 0.02
export const CHURN_OPS_MAX = 0.6
/** [GAMEPLAY V2 §4.3] Churn floor (before the market and debt terms) and the lift of a full market (× (1 + 0.5 × pen)). */
export const CHURN_MIN = 0.025
export const CHURN_SATURATION = 0.5
export const AD_BUDGET_MAX = 50_000_000
/**
 * [GAMEPLAY V2 §4.3] Paid channel saturates. CAC × (1 + CAC_SPEND_K × (ads / max(mrr, CAC_SPEND_FLOOR[stage]))^CAC_SPEND_EXP):
 * super-linear, so paid users PEAK (ads = (2 / K)^(2/3) × MRR ≈ 1.9 × MRR) instead of creeping to an asymptote.
 * CAC × (1 + CAC_SATURATION_K × pen²) for a full market; paid × (1 − pen), organic × max(ORGANIC_PEN_FLOOR, 1 − pen).
 * [DENGE ≠ GAMEPLAY V2 §4.3 K 1 → 0.75] At 1 the best paid growth at Series C (0.53 × ARPU / CAC₀ ≈ 3.7%/month) sat
 * under churn: Series C became a wall (1/24 Unicorn in 100 min, sim). 0.75 keeps the peak below 2 × MRR.
 */
export const CAC_SPEND_K = 0.75
export const CAC_SPEND_EXP = 1.5
export const CAC_SPEND_FLOOR: readonly number[] = [500, 2_000, 10_000, 50_000, 250_000, 1_000_000, 1_000_000]
export const CAC_SATURATION_K = 3
export const ORGANIC_PEN_FLOOR = 0.1

// ---------------------------------------------------------------------------
// GAMEPLAY V2 §8.1: a finite market (segments in content/markets.ts; penetration = users / Σ open segments)
// ---------------------------------------------------------------------------
/** An opened segment joins the TAM linearly over this many days (no overnight jump in reach). */
export const MARKET_RAMP_DAYS = 60
/**
 * [DENGE ≠ GAMEPLAY V2 §8.1 × 1] Users a segment really adds = its content size × this. At × 1 (exit pen ≈ 0.3, the §4.3
 * channel terms (1 − pen) / (1 + 3 pen²) and churn × (1 + 0.5 pen) hold users where inflow = churn) 1/48 good bots
 * reached Unicorn in 100 min (sim T17); × 2 brings them back to ~84 min at exit pen ≈ 0.15. [T20 duration knob 2 → 2.5]
 * At × 2 platform stalled under $1B in Series C (15/24 Unicorn, 104 min); × 2.5 gives 24/24 at ~92 min and the archetype
 * spread 1.18× (24 seeds). Still open: §4.3's saturation curve vs §8.1's exit pen 0.5–0.9 (pen stays ≈ 0.15).
 */
export const MARKET_SIZE_SCALE = 2.5
/** Penetration at which the horizon shows 'saturation' (ads go to waste; time for the next segment). */
export const MARKET_SATURATION_PEN = 0.7

// ---------------------------------------------------------------------------
// GAMEPLAY V2 §8.2: buying a rival (acquireRival, from Series B)
// ---------------------------------------------------------------------------
export const ACQUIRE_MIN_STAGE: StageIndex = 4
/** Price = rival MRR × 12 × the player's multiple × this. */
export const ACQUIRE_PRICE_FACTOR = 0.8
/** The rival's users that stay: share × TAM × this. */
export const ACQUIRE_USERS_SHARE = 0.6
/** Merging two codebases and two teams: debt, morale, and production × ACQUIRE_PRODUCTION for ACQUIRE_PRODUCTION_DAYS. */
export const ACQUIRE_TECH_DEBT = 15
export const ACQUIRE_MORALE = -8
export const ACQUIRE_PRODUCTION = 0.85
export const ACQUIRE_PRODUCTION_DAYS = 60
/** The rival thread's "Teklif hazırla" (flags.rivalBuyIntent): the prepared offer prices the next purchase × this. */
export const ACQUIRE_INTENT_FLAG = 'rivalBuyIntent'
export const ACQUIRE_INTENT_DISCOUNT = 0.85
/** The rival thread's rival-dies (flags.rivalGone): the lead closes down and leaves the market (world.leadGone). */
export const RIVAL_GONE_FLAG = 'rivalGone'
/** The market verbs' tools: a save from before them gets those of the stages it reached (world.marketTools). */
export const MARKET_TOOLS: readonly ToolId[] = ['segments', 'mna']

// ---------------------------------------------------------------------------
// Revenue (PLAN §5.5)
// ---------------------------------------------------------------------------
export const ARPU_BASE = 4
/** [DENGE ≠ PLAN 1.15 / 0.04] */
export const ARPU_STAGE_GROWTH = 1.45
export const ARPU_SALES_PER = 0.06
export const ARPU_SALES_MAX = 0.8
export const PRICE_MIN = 0.7
export const PRICE_MAX = 1.6
export const PRICE_CHURN_FACTOR = 1.8
export const PRICE_CHURN_DAYS = 100_000

// ---------------------------------------------------------------------------
// Costs (PLAN §5.6)
// ---------------------------------------------------------------------------
/** Garage-level monthly salary; × SALARY_STAGE_GROWTH^stage at hire, then a yearly market raise (DECISIONS #5, GAMEPLAY V2 §4.2). */
export const BASE_SALARY: Readonly<Record<Dept, number>> = { eng: 1_200, product: 1_000, marketing: 900, sales: 900, ops: 800 }
export const SALARY_STAGE_GROWTH = 1.6
/** Yearly market raise: every RAISE_EVERY_DAYS since hire, on payday, salary × (1 + RAISE_YEARLY). */
export const RAISE_YEARLY = 0.08
export const RAISE_EVERY_DAYS = 360
/**
 * [GAMEPLAY V2 §4.2] Infra = max(users / 1000 × INFRA_PER_1000_BY_STAGE, mrr × INFRA_MRR_SHARE) × infraMult:
 * the bill grows with the business, not only with the head count of the servers.
 */
export const INFRA_PER_1000_BY_STAGE: readonly number[] = [10, 10, 15, 25, 40, 60, 60]
/**
 * [B2 difficulty knob 0.05/0.08/0.12/0.15/0.18 → 0.06/0.10/0.16/0.20/0.24] Profitable runs banked too much cash (sim).
 * [T20 Seed 0.10 → 0.18, B 0.20 → 0.16, C 0.24 → 0.22] toward the §15 min-runway bands (Seed 9.8 → 7.3, B 4.1 → 3.9,
 * C 6.0 months); the bands and the profit-month share stay out of reach of this knob (DECISIONS #21).
 */
export const INFRA_MRR_SHARE: readonly number[] = [0, 0.06, 0.18, 0.16, 0.16, 0.22, 0.22]
export const SERVER_ROOM_INFRA_MULT = 0.8
export const SEVERANCE_MONTHS = 0.5
/**
 * Founder living cost per month (index = stage; CORE_LOOP §5 "Garaj burn'ü"). Paid on payday like a salary
 * ("Kurucu" line on the month receipt). Garage–Pre-seed make the money visible; later it is noise next to payroll.
 */
export const FOUNDER_LIVING_COST: readonly number[] = [1_200, 1_200, 2_000, 3_000, 5_000, 8_000, 8_000]

// ---------------------------------------------------------------------------
// Morale (PLAN §5.7)
// ---------------------------------------------------------------------------
export const MORALE_BASE_TARGET = 60
export const MORALE_NEGATIVE_CASH = 40
export const MORALE_OVERLOAD = 15
/** Fraction of the gap closed per day. */
export const MORALE_APPROACH_PER_DAY = 0.05
export const TIRED_MORALE = 40
export const RESIGN_MORALE = 28
export const RESIGN_WARNING_DAYS = 3
/** After a retain, no new warning for this many days. */
export const RETAIN_GRACE_DAYS = 20
/** Mola (PLAN §7.2): a content employee near a common-area item takes a coffee break every N days. */
export const BREAK_EVERY_DAYS = 5
export const RAISE_FACTOR = 1.15
export const RAISE_MORALE = 25
export const TALK_MORALE = 15
export const TALK_ENERGY = 15
export const FIRE_TEAM_MORALE = -5
export const ROUND_CLOSE_MORALE = 10
export const ROUND_CLOSE_REPUTATION = 15

// ---------------------------------------------------------------------------
// Valuation (PLAN §5.8)
// ---------------------------------------------------------------------------
export const PRE_REVENUE_MRR = 1_000
/**
 * [GAMEPLAY V2 §4.1] Pre-revenue valuation prices traction, not head count: users + launched products + releases
 * (min(VAL_RELEASE_MAX, releaseCount)). The Pre-seed window (300K) opens at 1 launch + 5 releases + ~190 users.
 */
export const VAL_PER_USER = 400
export const VAL_PER_LAUNCHED = 150_000
export const VAL_PER_RELEASE = 15_000
export const VAL_RELEASE_MAX = 5
/**
 * [GAMEPLAY V2 §4.1] Growth-scaled multiple: MIN[stage] + (MAX − MIN) × growthScore, where growthScore =
 * clamp(0, 1, momAvg / (GROWTH_FULL_K × DILIGENCE_MOM[stage])). Zero growth really gives MIN at every stage; the
 * ceiling asks for GROWTH_FULL_K × the stage's diligence MoM. Unicorn TIME is tuned with GROWTH_FULL_K (and
 * STAGE_TARGET_VALUATION), never with MULTIPLE_MAX_BY_STAGE: a higher ceiling makes the coaster stronger too.
 */
export const MULTIPLE_MIN_BY_STAGE: readonly number[] = [4, 4, 3, 2.5, 2, 1.5, 1.5]
export const MULTIPLE_MAX = 30
/** Placeholder multiple of a new game before its first step (createGame): the Garage floor. */
export const MULTIPLE_BASE = 4
/**
 * [DENGE ≠ GAMEPLAY V2 §4.1 2 → 1] At 2 the good bots stalled in Series C (MoM 1–4% there: 2/48 runs reached Unicorn in 100 min);
 * at 1 the ceiling asks for the diligence MoM itself and the Unicorn medians land at 60–83 min (sim, 12 seeds).
 * [B2 1 → 0.35] With costs and channels saturating (§4.2–4.3) Series C grows 1–2%/month, not 3–5%: the ceiling now asks
 * for about a third of the diligence MoM (Series C ≈ 1%). The duration knob of §4.2; MULTIPLE_MAX_BY_STAGE untouched.
 */
export const GROWTH_FULL_K = 0.35
/**
 * [Faz 3] Multiple ceiling by the company's stage (CORE_LOOP §5, S5). [DENGE ≠ CORE_LOOP 30 → 25 → 20 → 15 → 12 → 10]
 * Investors pay less for growth % the bigger the company is. Not a tuning knob (GAMEPLAY V2 §4.2).
 */
export const MULTIPLE_MAX_BY_STAGE: readonly number[] = [30, 30, 15, 10, 7, 5.15, 5.15]
/** [Faz 3] The multiple prices the average MoM of the last N months (finance.mrrHistory), not one noisy month. */
export const MULTIPLE_MOM_MONTHS = 3
/**
 * [GAMEPLAY V2 §4.1] Burn multiple = Σ positive net burn of the last BURN_MULTIPLE_MONTHS months / (MRR gained over
 * them × 12), capped at BURN_MULTIPLE_MAX (no growth at all reads as the cap, not as infinity).
 */
export const BURN_MULTIPLE_MONTHS = 3
export const BURN_MULTIPLE_MAX = 99
/** From Series A a burn multiple above the diligence ask costs 10% of multiple per point, at most BM_PENALTY_MAX_POINTS. */
export const BM_PENALTY_MIN_STAGE = 3
export const BM_PENALTY_PER_POINT = 0.1
export const BM_PENALTY_MAX_POINTS = 3
/**
 * [GAMEPLAY V2 §4.1] Idle cash: from Series A, a company sitting on more than IDLE_CASH_MONTHS of gross burn is
 * priced × IDLE_PENALTY, except in the IDLE_GRACE_DAYS after a round closed (the big round is not punished at once).
 */
export const IDLE_PENALTY_MIN_STAGE = 3
export const IDLE_CASH_MONTHS = 36
export const IDLE_GRACE_DAYS = 180
export const IDLE_PENALTY = 0.9
/** Board quarter missed (flags.boardCapPenalty, §8.3): multiple × this. */
export const BOARD_CAP_PENALTY = 0.8
/** The pre-revenue floor holds only up to this stage (Pre-seed); from Seed valuation is the revenue multiple alone. */
export const PRE_REVENUE_FLOOR_MAX_STAGE = 1
/** Continuity fix: once revenue starts, valuation never drops below the pre-revenue formula. */
export const VALUATION_KEEP_PRE_REVENUE_FLOOR = true

// ---------------------------------------------------------------------------
// Rounds (PLAN §5.9)
// ---------------------------------------------------------------------------
export const ROUND_WEEKS_MIN = 8
export const ROUND_WEEKS_MAX = 12
export const BRIDGE_CARD_ID = 'vc-bridge-loan'

// Live round window (docs/CORE_LOOP.md §4.3, phase 2) ------------------------
/** The round can start once valuation ≥ target × this ("şimdi mi, biraz daha mı?"). */
export const ROUND_EARLY_RATIO = 0.6
/**
 * Months of runway each size buys (on the new burn). [GAMEPLAY V2 §4.2: 12/18/24 → 8/12/16] The round is the breath of
 * the cash constraint: 8–16 months, so the next round is always in sight (DECISIONS #16 revised).
 */
export const ROUND_RUNWAY_MONTHS: Readonly<Record<RoundSize, number>> = { small: 8, target: 12, large: 16 }
/** Equity sold per size, × the stage's ROUND_EQUITY. */
export const ROUND_SIZE_EQUITY: Readonly<Record<RoundSize, number>> = { small: 0.75, target: 1, large: 1.3 }
/**
 * "Yeni burn": the burn the company will run after the round (bigger office, the hires the money is for),
 * as a multiple of today's round burn (round.ts roundBurn: ads count at most what last payday paid).
 * Amount = clamp(table × MIN × k, table × MAX × k, burn × this × months), k = months / target months: both bounds follow the
 * size, so Küçük < Hedef < Büyük always (review fix: at a small burn all three used to clip to the same ceiling).
 */
/** [B2 difficulty knob 1.25 → 1] With 1.25 the stage min-runway medians sat at Seed 20 / C 24 months (sim). */
export const ROUND_NEW_BURN_MULT = 1
/**
 * [GAMEPLAY V2 §4.2 0.5 → 0.3] 76% of rounds closed on the table floor: the amount now really follows burn × months.
 * [T20 0.3 → 0.25] the floor still carried the Seed runway (min-runway median 9.8 → 7.3 months with INFRA_MRR_SHARE).
 */
export const ROUND_AMOUNT_TABLE_MIN = 0.25
export const ROUND_AMOUNT_TABLE_MAX = 0.7
/** Price part of the offer: valuation / target, clamped to this range. */
export const ROUND_OFFER_CLAMP: readonly [number, number] = [0.6, 1.2]
/**
 * Offer factor = clamp(price × diligence, FLOOR, CEIL) + pitch bonus (±PITCH_BONUS_CAP): the ceiling holds the
 * numbers only, so pitches still move the money at the top (review fix: 38/40 rounds closed pinned at 1.1).
 * The price part is √(price at start × price at close): an early start locks a cheaper price.
 */
export const ROUND_OFFER_FLOOR = 0.5
export const ROUND_OFFER_CEIL = 1.15
export const PITCH_BONUS_CAP = 0.15
/** Due diligence: each met item +5%, each unmet −10% of the offer. */
export const DILIGENCE_MET = 0.05
export const DILIGENCE_UNMET = -0.1
export const DILIGENCE_RUNWAY_MONTHS = 3
/** MoM growth asked for, by the round's current stage (index = stage). */
export const DILIGENCE_MOM: readonly number[] = [0.04, 0.06, 0.06, 0.05, 0.04, 0.03, 0.03]
export const DILIGENCE_MORALE = 50
/** [GAMEPLAY V2 §4.1] Burn multiple the investor accepts, by stage (99 = not asked before Seed). */
export const DILIGENCE_BM: readonly number[] = [99, 99, 3, 2.5, 2, 1.5, 1.5]
/** Pitch "Metrik göster": + when the 3-month MoM meets the diligence ask, − when it does not (the numbers speak). */
export const PITCH_METRICS_GOOD = 0.05
export const PITCH_METRICS_BAD = -0.03
/** Pitch "Hikâye anlat": a gamble in [MIN, MAX] + reputation/100 × per-rep (both ends), costs founder energy. */
export const PITCH_STORY_MIN = -0.04
export const PITCH_STORY_MAX = 0.06
export const PITCH_STORY_PER_REP = 0.04
export const PITCH_STORY_ENERGY = 10
/** Pitch "İkinci yatırımcı getir": one week shorter, but the co-investor takes this much extra equity. */
export const PITCH_COINVESTOR_WEEKS = 1
export const PITCH_COINVESTOR_EQUITY = 0.01

// GAMEPLAY V2 §6.3: a round can fail ---------------------------------------
/** Strikes that fail a round (a week where ≥ ROUND_STRIKE_BROKEN checks met at the start broke: +1, else −1). */
export const ROUND_FAIL_STRIKES = 3
/**
 * 1, not the plan's 2: only checks met at the start count, so the plan's reason for 2 (Seed's burn check always unmet)
 * is gone, and a good player who starts on ≥ 3/4 met almost never breaks two at once (sim: 0.2% of rounds failed).
 */
export const ROUND_STRIKE_BROKEN = 1
/** From this round week on, a metrics part at the offer floor fails the round (not at the close: no 8–12 wasted weeks). */
export const ROUND_FAIL_FLOOR_WEEK = 4
/** Days after a failed round before the next can start (45 + a new round ≈ 4 months: a failed round would be death). */
export const ROUND_RETRY_DAYS = 14
export const ROUND_FAIL_REPUTATION = -10
export const ROUND_FAIL_MORALE = -8
/** The one-time down round after a failed one: amount × this, equity × this, and no offer floor. */
export const DOWN_ROUND_AMOUNT = 0.7
export const DOWN_ROUND_EQUITY = 1.5
/** Equity a round can sell at most (a co-investor or a down round never takes more). */
export const ROUND_EQUITY_MAX = 0.5

// ---------------------------------------------------------------------------
// Bankruptcy (PLAN §5.10)
// ---------------------------------------------------------------------------
export const BANKRUPT_DAYS = 60
/** [Faz 3] The bankruptcy clock starts only when payday cannot be paid (cash < 0 after payday), not on a dip. */
export const RESCUE_CARD_ID = 'emergency-loan'
export const BANKRUPT_WARNING_DAYS: readonly number[] = [1, 30, 45, 55]
/** Team at 0 (after first hire) ends the run after this many days (DECISIONS #6). */
export const TEAM_ZERO_GRACE_DAYS = 14

// ---------------------------------------------------------------------------
// Founder (PLAN §4.4)
// ---------------------------------------------------------------------------
export const ENERGY_MAX = 100
export const ENERGY_REGEN_PER_DAY = 8
export const REST_REGEN_PER_DAY = 30
export const LOW_ENERGY = 20

export interface FounderActionDef {
  stage: StageIndex
  durationDays: number
  energy: number
  /** Days after the action ends before it can be used again. */
  cooldownDays: number
  /** Weekly moves it takes (GAMEPLAY V2 §7.1); from MOVES_FROM_STAGE on this replaces energy and cooldown. */
  moves: number
}

/**
 * GAMEPLAY V2 §7.1 weekly move budget (limited labour): from Pre-seed on the founder has MOVES_PER_WEEK[stage] moves a
 * week, refilled on every day % 7 === 0. The garage keeps energy and cooldowns as they were (its one verb is
 * findUsers; a 3/week budget there would halve it and delay Pre-seed). From Pre-seed on actions cost no energy and have
 * no cooldown (saturation stays); energy becomes a health gauge only rest refills. refactorSprint keeps its cooldown:
 * it is the month its production cut runs, not founder fatigue.
 */
export const MOVES_FROM_STAGE = 1
export const MOVES_PER_WEEK: readonly number[] = [0, 3, 3, 4, 4, 5, 5]
/**
 * Late verbs that come off the budget too ("answerDecision" never does); the policy / market / board waves use theirs.
 * talkResignation: the talk that keeps a leaver costs no energy on the budget, so it takes a move (else it is free and
 * the raise never wins).
 */
export const MOVE_COST = { roundPitch: 1, refactorSprint: 2, talkResignation: 1, renewContract: 1, acquireRival: 2, adoptPolicy: 1, openSegment: 1 } as const
export type MoveVerb = keyof typeof MOVE_COST

/**
 * GAMEPLAY V2 §7.2 company policies (Kanun Kitabı): from POLICY_MIN_STAGE, one signature per POLICY_SIGN_COOLDOWN_DAYS,
 * never revoked. Every survival signature adds POLICY_SURVIVAL_EQUITY to each later round's equity and takes
 * POLICY_SURVIVAL_TEAM off the radar's team axis (creeping normality made visible). 'resign' × k raises the quitting
 * morale bar by RESIGN_RISK_MORALE × (k − 1) points. lastSignedDay of a fresh / older run: POLICY_NEVER_SIGNED.
 */
export const POLICY_MIN_STAGE = 1
export const POLICY_SIGN_COOLDOWN_DAYS = 30
export const POLICY_SURVIVAL_EQUITY = 0.005
export const POLICY_SURVIVAL_TEAM = 0.1
export const RESIGN_RISK_MORALE = 8
export const POLICY_NEVER_SIGNED = -999

export const FOUNDER_ACTION_DEFS: Readonly<Record<FounderActionKind, FounderActionDef>> = {
  findUsers: { stage: 0, durationDays: 1, energy: 12, cooldownDays: 1, moves: 1 },
  talkToUsers: { stage: 0, durationDays: 1, energy: 10, cooldownDays: 3, moves: 1 },
  motivateTeam: { stage: 1, durationDays: 0.5, energy: 20, cooldownDays: 5, moves: 1 },
  investorCoffee: { stage: 1, durationDays: 1, energy: 15, cooldownDays: 4, moves: 1 },
  salesCall: { stage: 2, durationDays: 2, energy: 20, cooldownDays: 7, moves: 2 },
  rest: { stage: 0, durationDays: 2, energy: 0, cooldownDays: 0, moves: 0 },
  refactorSprint: { stage: TECH_DEBT_MIN_STAGE, durationDays: 1, energy: 15, cooldownDays: REFACTOR_COOLDOWN_DAYS, moves: MOVE_COST.refactorSprint },
}
export const FIND_USERS_MIN = 3
export const FIND_USERS_MAX = 6
/**
 * "Elle kullanıcı bul" saturation (docs/CORE_LOOP.md §5, dont-scale): the first N finds of a month return in full,
 * each further block of N halves again ("tanıdık çevren tükeniyor"); above FIND_USERS_BIG_AT users the return halves.
 */
export const FIND_USERS_FULL_PER_MONTH = 3
export const FIND_USERS_SATURATION = 0.5
export const FIND_USERS_BIG_AT = 100
export const FIND_USERS_BIG_FACTOR = 0.5
/** "Kullanıcıyla konuş": +maturity on an unfinished project, or the same progress toward the next update after 1.0. */
export const TALK_MATURITY = 0.03
export const MOTIVATE_MORALE = 10
export const MOTIVATE_DAYS = 10
export const COFFEE_ROUND_WEEKS = 1
export const COFFEE_REPUTATION = 2
/** Enterprise deal MRR = arpu × users-equivalent. */
export const SALES_CALL_SEATS_MIN = 14
export const SALES_CALL_SEATS_MAX = 40
/** "Satış görüşmesi" saturation: full-size deals per month, then each further deal × this again. */
export const SALES_CALL_FULL_PER_MONTH = 2
export const SALES_CALL_SATURATION = 0.5
/** Enterprise contracts run this long, then the customer leaves (contract length, no churn in between). */
export const SALES_CONTRACT_DAYS = 360

/**
 * GAMEPLAY V2 §8.4 renewal (from Series A): RENEWAL_NOTICE_DAYS before its end a key account (one of the
 * RENEWAL_KEY_ACCOUNTS biggest contracts on that day: the whales the key-account storm names) comes up for renewal;
 * left unanswered it leaves on its day. The smaller deals end on their day as before.
 * [DENGE, T19 sim] Key accounts only, not every contract (§8.4 says all): the sellers make up to ~280 sales calls a run
 * and each would come back once a year for good, burying the week under paperwork. At 4 the good bots meet ~4.7
 * renewals per B/C run (band 4–10; the sellers ~9, the others none), at 2 only ~2.9. 'hold' asks for more: it stays at MRR × RENEW_HOLD_MRR with chance
 * RENEW_HOLD_BASE + RENEW_HOLD_MAT × avgMaturity − RENEW_HOLD_SHARE × Σ rival share (− RENEW_HOLD_CRISIS while the
 * key-account-renewal storm is on, − RENEW_DISCOUNTED_HOLD if it was bought with a discount before), else it leaves
 * now. 'discount' keeps it for sure at MRR × RENEW_DISCOUNT_MRR and marks it. A renewed contract runs
 * SALES_CONTRACT_DAYS again. With no rival share, at maturity ≥ 0.7 'hold' is worth at least 'discount'
 * (0.85 × 1.1 ≥ 0.85); each 0.1 of rival share takes 0.03 off the chance, so in B/C (Σshare 0.15–0.35) it needs more
 * maturity: derived.renewals carries the chance, the comparison is holdChance × RENEW_HOLD_MRR vs RENEW_DISCOUNT_MRR.
 */
export const RENEWAL_FROM_STAGE: StageIndex = 3
export const RENEWAL_NOTICE_DAYS = 30
export const RENEWAL_KEY_ACCOUNTS = 4
export const RENEW_HOLD_BASE = 0.5
export const RENEW_HOLD_MAT = 0.5
export const RENEW_HOLD_SHARE = 0.3
export const RENEW_HOLD_CRISIS = 0.2
export const RENEW_DISCOUNTED_HOLD = 0.1
export const RENEW_HOLD_MRR = 1.1
export const RENEW_DISCOUNT_MRR = 0.85
/** The calendar crisis that makes 'hold' harder while its modifiers last (content/crises.ts). */
export const RENEW_CRISIS_ID = 'key-account-renewal'

/**
 * GAMEPLAY V2 §8.3 board (from Series A): on arriving at A and every BOARD_QUARTER_DAYS the board sets
 * targetMrr = MRR × (1 + growthAsk)^3 (three months at the investor's ask). Hit → reputation +BOARD_HIT_REPUTATION and
 * BOARD_HIT_EQUITY less equity in the next round (at most BOARD_CREDIT_MAX quarters stack); missed
 * BOARD_PENALTY_MISSES in a row → flags.boardCapPenalty (multiple × BOARD_CAP_PENALTY until a hit) and the
 * board-review card (it takes the card budget like a crisis card).
 * [DENGE, T19 sim] After a miss the board revises its plan: the next quarter asks growthAsk × BOARD_REVISED_ASK. At the
 * full ask every quarter the ×0.8 cap held so often that only 24/48 good bots reached Unicorn in 3000 days (99 min
 * censored median); revised at 0.5 they miss ~32% of B/C quarters (band 30–50%) and 33/48 arrive (88 min).
 */
export const BOARD_FROM_STAGE: StageIndex = 3
export const BOARD_QUARTER_DAYS = 90
export const BOARD_REVISED_ASK = 0.5
export const BOARD_HIT_REPUTATION = 3
export const BOARD_HIT_EQUITY = 0.005
export const BOARD_CREDIT_MAX = 4
export const BOARD_PENALTY_MISSES = 2
export const BOARD_PENALTY_FLAG = 'boardCapPenalty'
export const BOARD_REVIEW_CARD_ID = 'board-review'

/**
 * GAMEPLAY V2 §8.2 sub-ending: the acquisition-offer's "sell" option sets this flag (content/decisions.ts mirrors the
 * name) and the run ends as 'acquired'.
 */
export const ACQUIRED_FLAG = 'companySold'

// ---------------------------------------------------------------------------
// Hiring
// ---------------------------------------------------------------------------
export const CANDIDATE_POOL_BASE = 3
export const CANDIDATE_POOL_MAX = 6
export const CANDIDATE_LIFETIME_DAYS = 14
export const CANDIDATE_QUALITY_MIN = 0.6
export const CANDIDATE_QUALITY_MAX = 1.4
export const REFRESH_COST_BASE = 200
export const CANDIDATE_DEPT_WEIGHT: Readonly<Record<Dept, number>> = { eng: 3, product: 2, marketing: 2, sales: 1, ops: 1 }

// ---------------------------------------------------------------------------
// Decisions (PLAN §6.3)
// ---------------------------------------------------------------------------
export const FIRST_CARD_DAY = 8
/** [Faz 3] Fewer, heavier cards (CORE_LOOP §5 "Karar sıklığı"): ~1 per 30–40 days instead of ~1 per 13. */
export const CARD_COOLDOWN_DAYS = 25
/**
 * [GAMEPLAY V2 §3 md.11 0.1 → 0.08] The card budget is fixed: crisis cards share CARD_COOLDOWN_DAYS with the normal
 * ones (one card a day at most, the crisis first), so the random roll gives up what the calendar brings.
 */
export const CARD_DAILY_CHANCE = 0.08
/** Repeatable (once: false) cards: days before the same card may show again, and max shows per run. */
export const REPEAT_CARD_COOLDOWN_DAYS = 90
export const REPEAT_CARD_MAX = 3
export const CASH_PERCENT_CAP = 0.25
/** Absolute cap of a cashPercent effect: this × monthly-ish scale (base rent × 20). */
export const CASH_PERCENT_ABS_CAP: readonly number[] = [10_000, 50_000, 250_000, 1_000_000, 5_000_000, 30_000_000, 30_000_000]
export const USERS_PERCENT_CAP = 0.5
/**
 * A decision visitor waits for the answer (no timed card, docs/CORE_LOOP.md §3.2): its leaveDay is pushed this
 * far out and answering sets it to "now". Finite so the state stays JSON-serializable.
 */
export const DECISION_VISITOR_WAIT_DAYS = 100_000
/** [Faz 3] An unanswered card applies its written default option after this many days ("Cevapsız kalırsa: A"). */
export const DECISION_DEFAULT_AFTER_DAYS = 60
/** [Faz 3] Delayed effects land within this many days (they must stay visible on the 6-week horizon). */
export const DECISION_DELAY_MAX_DAYS = 30

// ---------------------------------------------------------------------------
// Concepts & world flavour
// ---------------------------------------------------------------------------
export const CONCEPT_VISITOR_DAYS = 20
/** At most one new concept bubble per this many days (review fix: three Defter cards in the first 20 s). */
export const CONCEPT_GAP_DAYS = 5
export const BUBBLE_DAYS = 1.5
export const BUBBLE_MAX = 3
export const IDLE_BUBBLE_EVERY_DAYS = 3
export const AMBIENT_VISITOR_EVERY_DAYS = 12
export const AMBIENT_VISITOR_DAYS = 2
export const ACTIVITY_MAX = 30
export const EVENTS_MAX = 64
export const MODIFIER_MORALE_IS_ADDITIVE = true
export const ARCHETYPE_MIN_STAGE: StageIndex = 3
export const LOW_GROWTH_MOM = 0.02
export const MOM_CLAMP_MAX = 5

// ---------------------------------------------------------------------------
// Core loop, phase 1 (docs/CORE_LOOP.md §4–§5): payday, release moments, next step, horizon, stage goals
// ---------------------------------------------------------------------------
/** Payday: costs (salaries, rent, infra, ads) accrue daily and are paid in one lump every DAYS_PER_MONTH days. */
export const PAYDAY_EVERY_DAYS = 30
/** Maturity thresholds that each make a release moment (1 = MVP). */
export const RELEASE_THRESHOLDS: readonly number[] = [0.2, 0.4, 0.6, 0.8, 1.0]
/** User wave per release level (garage scale), × RELEASE_WAVE_STAGE_GROWTH^stage × (0.5 + reputation/100). */
export const RELEASE_WAVE_USERS: readonly number[] = [6, 15, 30, 50, 80]
export const RELEASE_WAVE_STAGE_GROWTH = 2
/** Plus this share of current users (word of mouth from the people already there). */
export const RELEASE_WAVE_USER_SHARE = 0.02
export const RELEASES_MAX = 12
/**
 * After 1.0 the builders keep shipping updates (review fix: the five threshold releases were used up in the garage and
 * the main beat never fired again). Each RELEASE_UPDATE_SIZE of maturity-equivalent work is one update, at most one
 * per RELEASE_UPDATE_MIN_DAYS per project; its wave is RELEASE_UPDATE_USERS × stage scale + a share of users.
 */
export const RELEASE_UPDATE_SIZE = 0.2
export const RELEASE_UPDATE_MIN_DAYS = 20
export const RELEASE_UPDATE_USERS = 15
export const RELEASE_UPDATE_USER_SHARE = 0.003
/** Landed delayed decision effects kept for "Kararın → sonucu". */
export const OUTCOMES_MAX = 20
/** Horizon strip looks this many days ahead (6 weeks). */
export const HORIZON_DAYS = 42
/** Next step chain targets: users before "revenue" becomes the step, and first manual users before the desk. */
export const NEXT_STEP_USERS = 50
export const NEXT_STEP_FIRST_USERS = 3
/** Each ☆ stage goal reached takes this much off the equity sold in the next round (1 point). */
export const GOAL_STAR_EQUITY_DISCOUNT = 0.01
/** GAMEPLAY V2 §9.2: a thread card's default pick weight (it still takes the shared card cooldown). */
export const THREAD_CARD_WEIGHT = 3

// ---------------------------------------------------------------------------
// GAMEPLAY V2 §6.2: the loan ("şeytanla anlaşma")
// ---------------------------------------------------------------------------
/** Smallest loan by stage: max(burn × burnMonths, this). */
export const LOAN_MIN: readonly number[] = [15_000, 40_000, 150_000, 600_000, 3_000_000, 15_000_000, 15_000_000]
/** No amortization for this many months after the loan is taken (only interest). */
export const LOAN_INTEREST_ONLY_MONTHS = 6
/** The covenant is not measured in the first this many days. */
export const LOAN_COVENANT_GRACE_DAYS = 90
/** covenantRunway when the option does not say: burnMonths × this. */
export const LOAN_COVENANT_PER_BURN_MONTH = 0.5
/** 2nd breach: this share of the balance is called and the rate × LOAN_CALL_RATE_MULT. */
export const LOAN_CALL_SHARE = 0.5
export const LOAN_CALL_RATE_MULT = 1.5
/** Horizon of the 1st-breach warning (the next measured payday). */
export const LOAN_WARNING_DAYS = 30
/**
 * Terms of a loan from an older save (debt without a loan) or a legacy loan flag (bridgeLoan / emergencyLoan without
 * `loan`): GAMEPLAY V2 §3.1 migration values.
 */
export const LOAN_LEGACY_RATE = 0.02
export const LOAN_LEGACY_MONTHS = 12
export const LOAN_LEGACY_COVENANT = 1

// ---------------------------------------------------------------------------
// GAMEPLAY V2 §6.1: the payday desk (a month cash cannot cover)
// ---------------------------------------------------------------------------
/** Deferred costs are paid back × (1 + this) on a later payday. */
export const DEFER_INTEREST = 0.05
/** Owed (deferred) above this many months of gross burn starts the bankruptcy clock: no living on deferrals. */
export const DEFER_CAP_MONTHS = 1
/** The desk waits this many days, then the default order (salaries → infra → rent → founder → ads) pays what it can. */
export const PAYDAY_DECIDE_DAYS = 3
/** Every employee's morale on half / deferred salaries. */
export const PAYDAY_HALF_MORALE = -8
export const PAYDAY_DEFER_MORALE = -15
/** Morale target while salaries are owed (a one-off delta would melt back in two weeks; this term stays until paid). */
export const WAGES_OWED_MORALE_TARGET = 10
/** Founder energy when the founder skips their own pay. */
export const FOUNDER_SKIP_ENERGY = -20
/** Infra deferred: server capacity × this for INFRA_DEFER_DAYS; the second month in a row × the second value. */
export const INFRA_DEFER_CAPACITY: readonly number[] = [0.7, 0.4]
export const INFRA_DEFER_DAYS = 30
/** Rent deferred this many months: the landlord's notice (card), then eviction. */
export const LANDLORD_NOTICE_MONTHS = 2
export const EVICTION_MONTHS = 3
export const LANDLORD_CARD_ID = 'landlord-notice'
/** The landlord-notice option that moves to a smaller place (the rent deferral count starts over). */
export const LANDLORD_MOVE_OPTION = 1
/** Eviction: capacity × this for EVICTION_DAYS, plus the moving cost (EVICTION_MOVE_RENT_MONTHS of the month's rent). */
export const EVICTION_CAPACITY = 0.5
export const EVICTION_DAYS = 60
export const EVICTION_MOVE_RENT_MONTHS = 2

/** GAMEPLAY V2 §9.3: stage report cards kept (one per stage left). */
export const STAGE_REPORTS_MAX = 7

// ---------------------------------------------------------------------------
// GAMEPLAY V2 §14.2: month history (stats screen) and the company profile radar
// ---------------------------------------------------------------------------
/** finance.receipts keeps this many months (rounded ≈ 300–400 B of JSON each; cloud save ≤ 160 KB). */
export const HISTORY_MAX_MONTHS = 120
/** Ratio fields of a stored receipt (mom, multiple, runway, equity, …) keep this many decimals. */
export const HISTORY_RATIO_DECIMALS = 3
/** Profile axes are capped here (1 = what the stage expects). */
export const PROFILE_MAX = 1.5
/** Product axis: average maturity the stage expects (MVP in the garage, 1.0 from Series B). */
export const PROFILE_PRODUCT_EXPECT: readonly number[] = [0.2, 0.4, 0.6, 0.8, 1, 1, 1]
/** Team axis: head count the stage expects. */
export const PROFILE_TEAM_EXPECT: readonly number[] = [2, 5, 9, 16, 26, 36, 36]
/** Cash axis: months of runway that count as 1 (profitable = PROFILE_MAX). */
export const PROFILE_RUNWAY_MONTHS = 6

// ---------------------------------------------------------------------------
// GAMEPLAY V2 §5.1: crisis calendar (a known storm, tied to time, not to stages)
// ---------------------------------------------------------------------------
/** The first crisis lands this many days after arriving at Pre-seed (rng.int, inclusive). */
export const CRISIS_FIRST_DAYS: readonly [number, number] = [30, 80]
/** Days from one crisis to the next, by the stage it fired in (index = stage; Garage never schedules). */
export const CRISIS_INTERVAL_DAYS: readonly number[] = [150, 150, 180, 210, 240, 270, 270]
/** ± jitter on the interval (rng.int(−J, J)). */
export const CRISIS_INTERVAL_JITTER = 30
/**
 * Gap between two crises stays in this band whatever the jitter (§5.1 kabul: 150–300 days); the Pre-seed interval
 * (150 − 30) would otherwise dip below it.
 */
export const CRISIS_GAP_MIN = 150
export const CRISIS_GAP_MAX = 300
/** The date shows on the horizon as "?" this many days ahead (a round's length: time to plan it around). */
export const CRISIS_HORIZON_DAYS = 60
/** What the crisis is shows this many days ahead (crisisRevealed). */
export const CRISIS_TELEGRAPH_DAYS = 30
/**
 * Severity = BASE + PER_PRESSURE × director pressure. §5.2's 0.7 + 0.6 × p hit Series C (pressure ≈ 1) at 1.3 and
 * cost the good bots ~300 days (sim T08); 0.5 + 0.4 × p keeps C at the pre-director 0.9 and softens the early storms.
 */
export const CRISIS_SEVERITY_BASE = 0.5
export const CRISIS_SEVERITY_PER_PRESSURE = 0.4
/** Director pressure of a save from before the director (and the migration's default, §3.1). */
export const DIRECTOR_PRESSURE_DEFAULT = 0.3
/** The stage's pool used up: the previous crisis comes back this much softer (still with its card). */
export const CRISIS_LIGHT_SEVERITY = 0.7
/**
 * §3 md.11: the crisis card takes the slot of a rolled one. No random roll this many days before a crisis day
 * (≈ one card's expected gap: CARD_COOLDOWN_DAYS + 1 / CARD_DAILY_CHANCE).
 */
export const CRISIS_CARD_RESERVE_DAYS = 38

// ---------------------------------------------------------------------------
// GAMEPLAY V2 §5.2: the director (RimWorld; pressure scales with wealth, never with how often cards come)
// ---------------------------------------------------------------------------
/**
 * raw = BASE + PER_STAGE × stage + RICH × [runway null or > RICH_RUNWAY] + PROFIT × [profitMonths ≥ PROFIT_MONTHS]
 *       + FAST × [momAvg > FAST_MOM] − GRACE × [day < graceUntil]; pressure = clamp(MIN, MAX, raw).
 */
export const DIRECTOR_BASE = 0.2
export const DIRECTOR_PER_STAGE = 0.1
export const DIRECTOR_RICH = 0.25
export const DIRECTOR_RICH_RUNWAY = 12
export const DIRECTOR_PROFIT = 0.2
export const DIRECTOR_PROFIT_MONTHS = 3
export const DIRECTOR_FAST = 0.1
export const DIRECTOR_FAST_MOM = 0.15
export const DIRECTOR_GRACE = 0.4
/** A missed payroll gives this many days of breath (lower pressure, weaker rivals). */
export const DIRECTOR_GRACE_DAYS = 180
export const DIRECTOR_PRESSURE_MIN = 0.1
export const DIRECTOR_PRESSURE_MAX = 1
/** The one-time angel lifeline: comes instead of the rescue on the first missed payroll up to Seed. */
export const ANGEL_CARD_ID = 'angel-lifeline'
export const ANGEL_MAX_STAGE: StageIndex = 2

// ---------------------------------------------------------------------------
// GAMEPLAY V2 §8.2: named rivals (pull share, pace the valuation)
// ---------------------------------------------------------------------------
/** Rivals in the market by stage (index = stage): the lead at Seed, the 2nd at Series A, the 3rd at Series B. */
export const RIVALS_BY_STAGE: readonly number[] = [0, 0, 1, 2, 3, 3, 3]
/** The lead is born (and re-anchored on every stage arrival) at this share of the player's valuation and MRR. */
export const RIVAL_START_RATIO = 0.75
/** Later rivals are born at this share of the player's valuation (they pull share, they do not pace). */
export const RIVAL_FOLLOWER_RATIO = 0.4
/** Monthly valuation and MRR tempo: × (1 + TEMPO_ASK[stage] × DILIGENCE_MOM[stage] × (1 + TEMPO_PRESSURE × pressure)). */
export const RIVAL_TEMPO_PRESSURE = 0.5
/**
 * Share of the ask the lead keeps up, by stage. Series C is long and slow: at the full ask (× pressure ≈ 1 there) every
 * good bot was passed late in C (sim T08: 48/48, §15 wants 10–30%). Up to B a stalled company still falls behind in
 * about four months (§8.2).
 */
export const RIVAL_TEMPO_ASK: readonly number[] = [1, 1, 1, 1, 1, 0.5, 0.5]
export const RIVAL_BORN_SHARE = 0.1
/** Weekly: share += SHARE_K × (strength − player power) + SLOW_GROWTH (when momAvg < the ask); clamp(0, SHARE_MAX). */
export const RIVAL_SHARE_K = 0.03
export const RIVAL_SHARE_SLOW_GROWTH = 0.005
export const RIVAL_SHARE_MAX = 0.5
/** Player power = MAT × avgMaturity + REP × rep/100 + ROOM × (1 − pen). */
export const RIVAL_POWER_MAT = 0.5
export const RIVAL_POWER_REP = 0.3
export const RIVAL_POWER_ROOM = 0.2
/** strengthTarget = clamp(MIN, MAX, BASE + PER_STAGE × stage + PER_MRR × (mrr / stage target MRR) + PER_PRESSURE × pressure). */
export const RIVAL_STRENGTH_BASE = 0.3
export const RIVAL_STRENGTH_PER_STAGE = 0.1
export const RIVAL_STRENGTH_PER_MRR = 0.2
export const RIVAL_STRENGTH_PER_PRESSURE = 0.1
export const RIVAL_STRENGTH_MIN = 0.2
export const RIVAL_STRENGTH_MAX = 0.9
/** Monthly, strength moves this share of the way to its target. */
export const RIVAL_STRENGTH_LERP = 0.5
/** Inside adaptUntilDay (DIRECTOR_GRACE_DAYS after a missed payroll) the target is × this. */
export const RIVAL_ADAPT_STRENGTH = 0.6
/**
 * Σ share takes organic × (1 − Σ × ORGANIC) and ARPU × (1 − Σ × ARPU) (§4.3); Σ is capped at SHARE_TOTAL_MAX. §4.3's
 * 0.5 / 0.2 cost Series C (Σ at its cap, growth slow) 400+ days: C's growth is slow, so every percent compounds (sim T08).
 */
export const RIVAL_ORGANIC_SHARE = 0.2
export const RIVAL_ARPU_SHARE = 0.05
/**
 * The rivals together hold at most this share (weekly growth stops there). At 1 the late game (strength at its cap,
 * growth under the ask) let Σ reach ~1 by Series C; 0.4 still left no Unicorn in reach (sim T08).
 */
export const RIVAL_SHARE_TOTAL_MAX = 0.25
/** flags.rivalPressure = clamp(0, 1, Σ strength × share + VALUATION × lead valuation / player valuation). */
export const RIVAL_PRESSURE_VALUATION = 0.2
/** After an overtake the player must lead by this much (× the lead's MRR) before the next rivalPassed. */
export const RIVAL_PASS_RESET = 1.05
/** The lead / player valuation ratio counted at most this (a pre-revenue player is near 0). */
export const RIVAL_PRESSURE_RATIO_MAX = 3
