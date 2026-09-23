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
  3: ['adBudget'],
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
export const COORDINATION_TEAM_FREE = 6
export const COORDINATION_PER_PERSON = 0.03
export const COORDINATION_MIN = 0.7
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
/** Tech debt: speed × max(TECH_DEBT_MIN_SPEED, 1 − TECH_DEBT_PER_POINT × debt). */
export const TECH_DEBT_PER_POINT = 0.05
export const TECH_DEBT_MIN_SPEED = 0.5
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
export const AD_BUDGET_MAX = 50_000_000

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
/** Garage-level monthly salary; × SALARY_STAGE_GROWTH^stage at hire, then fixed (DECISIONS #5). */
export const BASE_SALARY: Readonly<Record<Dept, number>> = { eng: 1_200, product: 1_000, marketing: 900, sales: 900, ops: 800 }
export const SALARY_STAGE_GROWTH = 1.6
export const INFRA_PER_1000_USERS = 10
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
export const VAL_PER_TEAM = 40_000
export const VAL_PER_USER = 150
export const VAL_PER_LAUNCHED = 100_000
/**
 * [DENGE ≠ PLAN 6 + 150 × MoM] Faz 3: clamp(4, cap(stage), 5 + 100 × 3-month MoM) — growth is what investors price,
 * and a flat quarter now costs multiple instead of sitting on the ceiling (DECISIONS #17).
 */
export const MULTIPLE_MIN = 4
export const MULTIPLE_MAX = 30
export const MULTIPLE_BASE = 5
export const MULTIPLE_GROWTH = 100
/**
 * [Faz 3] Multiple ceiling by the company's stage (CORE_LOOP §5, S5). [DENGE ≠ CORE_LOOP 30 → 25 → 20 → 15 → 12 → 10]
 * Investors pay less for growth % the bigger the company is; the lower late ceilings stretch Series A–C so the run
 * lands in 60–90 min (sim/REPORT.md).
 */
export const MULTIPLE_MAX_BY_STAGE: readonly number[] = [30, 30, 15, 10, 7.5, 5.5, 5.5]
/** [Faz 3] The multiple prices the average MoM of the last N months (finance.mrrHistory), not one noisy month. */
export const MULTIPLE_MOM_MONTHS = 3
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
/** Months of runway each size buys (on the new burn). */
export const ROUND_RUNWAY_MONTHS: Readonly<Record<RoundSize, number>> = { small: 12, target: 18, large: 24 }
/** Equity sold per size, × the stage's ROUND_EQUITY. */
export const ROUND_SIZE_EQUITY: Readonly<Record<RoundSize, number>> = { small: 0.75, target: 1, large: 1.3 }
/**
 * "Yeni burn": the burn the company will run after the round (bigger office, the hires the money is for),
 * as a multiple of today's burn. Amount = clamp(table × MIN × months/18, table × MAX, burn × this × months):
 * the floor follows the size, so Küçük never brings a Hedef round's money for less equity (Faz 3).
 */
export const ROUND_NEW_BURN_MULT = 2
export const ROUND_AMOUNT_TABLE_MIN = 0.5
export const ROUND_AMOUNT_TABLE_MAX = 0.8
/** Price part of the offer: valuation / target, clamped to this range. */
export const ROUND_OFFER_CLAMP: readonly [number, number] = [0.6, 1.2]
/** Whole offer factor (price × diligence × pitches) floor and ceiling. */
export const ROUND_OFFER_FLOOR = 0.5
export const ROUND_OFFER_CEIL = 1.1
/** Due diligence: each met item +5%, each unmet −10% of the offer. */
export const DILIGENCE_MET = 0.05
export const DILIGENCE_UNMET = -0.1
export const DILIGENCE_RUNWAY_MONTHS = 3
/** MoM growth asked for, by the round's current stage (index = stage). */
export const DILIGENCE_MOM: readonly number[] = [0.04, 0.06, 0.06, 0.05, 0.04, 0.03, 0.03]
export const DILIGENCE_MORALE = 50
/** Pitch "Metrik göster": + when MoM meets the diligence ask, − when it does not (the numbers speak). */
export const PITCH_METRICS_GOOD = 0.06
export const PITCH_METRICS_BAD = -0.03
/** Pitch "Hikâye anlat": base + reputation/100 × per-rep, costs founder energy. */
export const PITCH_STORY_BASE = 0.02
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
export const TALK_MATURITY = 0.03
export const MOTIVATE_MORALE = 10
export const MOTIVATE_DAYS = 10
export const COFFEE_ROUND_WEEKS = 1
export const COFFEE_REPUTATION = 2
/** Enterprise deal MRR = arpu × users-equivalent. */
export const SALES_CALL_SEATS_MIN = 14
export const SALES_CALL_SEATS_MAX = 40

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
export const CARD_DAILY_CHANCE = 0.1
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
export const BUBBLE_DAYS = 1.5
export const BUBBLE_MAX = 3
export const IDLE_BUBBLE_EVERY_DAYS = 3
export const AMBIENT_VISITOR_EVERY_DAYS = 12
export const AMBIENT_VISITOR_DAYS = 2
export const ACTIVITY_MAX = 30
export const EVENTS_MAX = 64
export const MODIFIER_MORALE_IS_ADDITIVE = true
export const RIVAL_PRESSURE_PER_STAGE = 0.1
export const RIVAL_PRESSURE_BASE = 0.05
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
/** Landed delayed decision effects kept for "Kararın → sonucu". */
export const OUTCOMES_MAX = 20
/** Horizon strip looks this many days ahead (6 weeks). */
export const HORIZON_DAYS = 42
/** Next step chain targets: users before "revenue" becomes the step, and first manual users before the desk. */
export const NEXT_STEP_USERS = 50
export const NEXT_STEP_FIRST_USERS = 3
/** Each ☆ stage goal reached takes this much off the equity sold in the next round (1 point). */
export const GOAL_STAR_EQUITY_DISCOUNT = 0.01
