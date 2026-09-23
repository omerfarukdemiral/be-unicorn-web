// All tunable numbers. Every value is a [DENGE] starting point, tuned by sim/.
// Values that differ from the PLAN §5 starting points are listed, with the sim result, in docs/DECISIONS.md (#12).
import type { Dept, FounderActionKind, ProjectCategory, StageIndex, ToolId } from './types'

// ---------------------------------------------------------------------------
// Start (PLAN §5.10)
// ---------------------------------------------------------------------------
export const START_CASH = 30_000
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
/** [DENGE ≠ PLAN 1500] */
export const CAPACITY_PER_ENG = 4000
/** [DENGE ≠ PLAN 25] */
export const ORGANIC_PER_MARKETING = 45
/** [DENGE ≠ PLAN 8 × 1.3^aşama] */
export const CAC_BASE = 20
export const CAC_STAGE_GROWTH = 1.4
export const CHURN_BASE = 0.06
export const CHURN_OPS_PER = 0.02
export const CHURN_OPS_MAX = 0.6
export const AD_BUDGET_MAX = 50_000_000

// ---------------------------------------------------------------------------
// Revenue (PLAN §5.5)
// ---------------------------------------------------------------------------
export const ARPU_BASE = 4
/** [DENGE ≠ PLAN 1.15 / 0.04] */
export const ARPU_STAGE_GROWTH = 1.3
export const ARPU_SALES_PER = 0.06
export const ARPU_SALES_MAX = 0.8
export const PRICE_MIN = 0.7
export const PRICE_MAX = 1.6
export const PRICE_CHURN_FACTOR = 0.8
export const PRICE_CHURN_DAYS = 30

// ---------------------------------------------------------------------------
// Costs (PLAN §5.6)
// ---------------------------------------------------------------------------
/** Garage-level monthly salary; × SALARY_STAGE_GROWTH^stage at hire, then fixed (DECISIONS #5). */
export const BASE_SALARY: Readonly<Record<Dept, number>> = { eng: 1_200, product: 1_000, marketing: 900, sales: 900, ops: 800 }
export const SALARY_STAGE_GROWTH = 1.5
export const INFRA_PER_1000_USERS = 10
export const SERVER_ROOM_INFRA_MULT = 0.8
export const SEVERANCE_MONTHS = 0.5

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
export const VAL_PER_TEAM = 60_000
export const VAL_PER_USER = 150
export const VAL_PER_LAUNCHED = 200_000
/** PLAN §5.8 exactly: clamp(4, 30, 6 + 150 × MoM) — growth is what investors price. */
export const MULTIPLE_MIN = 4
export const MULTIPLE_MAX = 30
export const MULTIPLE_BASE = 6
export const MULTIPLE_GROWTH = 150
/** Continuity fix: once revenue starts, valuation never drops below the pre-revenue formula. */
export const VALUATION_KEEP_PRE_REVENUE_FLOOR = true

// ---------------------------------------------------------------------------
// Rounds (PLAN §5.9)
// ---------------------------------------------------------------------------
export const ROUND_WEEKS_MIN = 4
export const ROUND_WEEKS_MAX = 8
/** Offer shrinks when valuation falls below base × this. */
export const ROUND_SHRINK_THRESHOLD = 0.85
export const ROUND_SHRINK_FACTOR = 0.9
export const ROUND_MIN_OFFER = 0.5
export const BRIDGE_CARD_ID = 'vc-bridge-loan'

// ---------------------------------------------------------------------------
// Bankruptcy (PLAN §5.10)
// ---------------------------------------------------------------------------
export const BANKRUPT_DAYS = 60
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
export const TALK_MATURITY = 0.03
export const MOTIVATE_MORALE = 10
export const MOTIVATE_DAYS = 10
export const COFFEE_ROUND_WEEKS = 1
export const COFFEE_REPUTATION = 2
/** Enterprise deal MRR = arpu × users-equivalent. */
export const SALES_CALL_SEATS_MIN = 20
export const SALES_CALL_SEATS_MAX = 60

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
export const CARD_COOLDOWN_DAYS = 10
export const CARD_DAILY_CHANCE = 0.35
export const CASH_PERCENT_CAP = 0.25
/** Absolute cap of a cashPercent effect: this × monthly-ish scale (base rent × 20). */
export const CASH_PERCENT_ABS_CAP: readonly number[] = [10_000, 50_000, 250_000, 1_000_000, 5_000_000, 30_000_000, 30_000_000]
export const USERS_PERCENT_CAP = 0.5
export const DECISION_VISITOR_DAYS = 20

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
