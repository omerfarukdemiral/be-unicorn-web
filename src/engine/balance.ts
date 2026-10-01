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
  3: ['adBudget', 'refactor'],
  4: ['enterpriseSales'],
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
/**
 * [GAMEPLAY V2 §4.3, §8.1] Cumulative market size by stage until the segments of §8 land: penetration = users / this.
 * [DENGE ≠ GAMEPLAY V2 §8.1 × 4: 2K/2K/12K/62K/262K/712K/712K] At the §8.1 sizes (exit pen ≈ 0.7) the channels die
 * long before the exit ((1 − pen) / (1 + 3 pen²) ≈ 0.12 at 0.7) and users settle where inflow = churn: no good bot got
 * past Series C (sim). Interim ×4 (exit pen 0.1–0.2); E1 re-derives the real segment sizes with openSegment.
 */
export const MARKET_FALLBACK_TAM: readonly number[] = [8_000, 8_000, 48_000, 248_000, 1_048_000, 2_848_000, 2_848_000]

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
/** [B2 difficulty knob 0.05/0.08/0.12/0.15/0.18 → 0.06/0.10/0.16/0.20/0.24] Profitable runs banked too much cash (sim). */
export const INFRA_MRR_SHARE: readonly number[] = [0, 0.06, 0.1, 0.16, 0.2, 0.24, 0.24]
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
/** [GAMEPLAY V2 §4.2 0.5 → 0.3] 76% of rounds closed on the table floor: the amount now really follows burn × months. */
export const ROUND_AMOUNT_TABLE_MIN = 0.3
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

// ---------------------------------------------------------------------------
// Bankruptcy (PLAN §5.10)
// ---------------------------------------------------------------------------
export const BANKRUPT_DAYS = 60
/** [Faz 3] The bankruptcy clock starts only when payday cannot be paid (cash < 0 after payday), not on a dip. */
export const RESCUE_CARD_ID = 'emergency-bridge'
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
}

export const FOUNDER_ACTION_DEFS: Readonly<Record<FounderActionKind, FounderActionDef>> = {
  findUsers: { stage: 0, durationDays: 1, energy: 12, cooldownDays: 1 },
  talkToUsers: { stage: 0, durationDays: 1, energy: 10, cooldownDays: 3 },
  motivateTeam: { stage: 1, durationDays: 0.5, energy: 20, cooldownDays: 5 },
  investorCoffee: { stage: 1, durationDays: 1, energy: 15, cooldownDays: 4 },
  salesCall: { stage: 2, durationDays: 2, energy: 20, cooldownDays: 7 },
  rest: { stage: 0, durationDays: 2, energy: 0, cooldownDays: 0 },
  refactorSprint: { stage: TECH_DEBT_MIN_STAGE, durationDays: 1, energy: 15, cooldownDays: REFACTOR_COOLDOWN_DAYS },
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
