// Be Unicorn — engine contract types.
// Pure TS: no DOM, no Three. State must stay JSON-serializable (no Set/Map/class/Infinity/functions).
// Ownership: engine lane. Changes after scaffold must be ADDITIVE (new optional fields / new union members).

// ---------------------------------------------------------------------------
// Time constants (PLAN §4.1)
// ---------------------------------------------------------------------------

/** Real seconds per game day at 1x. */
export const SECONDS_PER_DAY = 2
export const DAYS_PER_MONTH = 30
export const DAYS_PER_WEEK = 7
/** The store advances the engine in fixed chunks of this many days (determinism). */
export const FIXED_STEP_DAYS = 0.25
/** Bump when GameState shape changes incompatibly; save.ts migrates. */
export const SAVE_VERSION = 4

/** Company name when none was given (and for pre-v3 saves). */
export const DEFAULT_COMPANY_NAME = 'İsimsiz Startup'
export const COMPANY_NAME_MIN = 2
export const COMPANY_NAME_MAX = 32

// ---------------------------------------------------------------------------
// Enums (string unions + const lists for iteration)
// ---------------------------------------------------------------------------

export type StageIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6
/** 0 Garaj, 1 Pre-seed, 2 Seed, 3 Series A, 4 Series B, 5 Series C, 6 Unicorn */
export const STAGE_KEYS = ['garage', 'preseed', 'seed', 'seriesA', 'seriesB', 'seriesC', 'unicorn'] as const
export type StageKey = (typeof STAGE_KEYS)[number]

export const DEPTS = ['eng', 'product', 'marketing', 'sales', 'ops'] as const
export type Dept = (typeof DEPTS)[number]

export const PROJECT_CATEGORIES = ['mobile', 'web', 'ai', 'api', 'game', 'marketplace'] as const
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

export const SLOT_TYPES = ['desk', 'common', 'room', 'special'] as const
export type SlotType = (typeof SLOT_TYPES)[number]

/** Speakers for concepts, decisions and visiting NPCs (PLAN §6.1, §7.3). */
export const NPC_ROLES = ['mentor', 'cofounder', 'accountant', 'engineer', 'investor', 'customer', 'journalist'] as const
export type NpcRole = (typeof NPC_ROLES)[number]

export const ARCHETYPES = ['bootstrap', 'vcRocket', 'niche', 'platform'] as const
export type Archetype = (typeof ARCHETYPES)[number]

/** 0 = paused. */
export type GameSpeed = 0 | 1 | 2 | 4

export type EmployeeStatus = 'working' | 'tired' | 'burnout' | 'break' | 'onboarding' | 'leaving'

/** Active founder actions (PLAN §4.4). 'rest' recovers energy; 'refactorSprint' pays tech debt down (GAMEPLAY V2 §4.2). */
export const FOUNDER_ACTIONS = ['findUsers', 'talkToUsers', 'motivateTeam', 'investorCoffee', 'salesCall', 'rest', 'refactorSprint'] as const
export type FounderActionKind = (typeof FOUNDER_ACTIONS)[number]

/** Concept ids from PLAN §6.2 (each triggers at most once per run). */
export const CONCEPT_IDS = [
  // Garaj
  'runway', 'burn', 'dont-scale', 'pmf', 'focus', 'default-alive',
  // Pre-seed
  'dilution', 'safe', 'fundraise-time', 'hire-bar', 'morale-compounds',
  // Seed
  'churn', 'pricing', 'feature-vs-product', 'premature-scaling',
  // Series A
  'ltv-cac', 'organic-vs-paid', 'tech-debt', 'ten-x-myth', 'culture-freezes',
  // Series B–C
  'concentration', 'compliance', 'trough', 'cap-table-health', 'no-single-path',
  // Every stage
  'founder-burnout', 'failure-is-data',
] as const
export type ConceptId = (typeof CONCEPT_IDS)[number]

/** HUD indicators. The first three are visible from the start; the rest unlock via concepts (PLAN §2 "Kullan"). */
export const HUD_WIDGETS = [
  'cash', 'users', 'morale',
  'runway', 'burnBreakdown', 'retention', 'profitProjection',
  'capTable', 'roundTimer', 'candidateQuality', 'moraleHeatmap',
  'churn', 'arpu', 'reputation', 'equity',
  'ltvCac', 'channelBreakdown', 'debtCounter', 'coordinationWarning', 'cultureBadge',
  'revenueDistribution', 'archetypeBadge',
] as const
export type HudWidget = (typeof HUD_WIDGETS)[number]
export const INITIAL_WIDGETS: readonly HudWidget[] = ['cash', 'users', 'morale']

/** Player tools unlocked by concepts or stages. */
export const TOOL_IDS = ['priceControl', 'adBudget', 'enterpriseSales', 'capTableView', 'refactor', 'segments', 'mna'] as const
export type ToolId = (typeof TOOL_IDS)[number]

/** Company policies, the Kanun Kitabı (GAMEPLAY V2 §7.2): signed once, never revoked. Effects live in content/policies.ts. */
export const POLICY_IDS = [
  'salary-freeze', 'founder-no-pay', 'lean-office', 'deferred-pay', 'layoff-round',
  'hire-fast', 'ads-first', 'crunch-culture',
  'quality-gate', 'remote-first', 'profit-share',
  'management',
] as const
export type PolicyId = (typeof POLICY_IDS)[number]

/**
 * Market segments (GAMEPLAY V2 §8.1), smallest first. 'early' is open from the garage, 'smb' opens on arriving at Seed;
 * the rest are opened by the player (openSegment). Sizes, costs and conditions live in content/markets.ts.
 */
export const MARKET_SEGMENT_IDS = ['early', 'smb', 'midmarket', 'enterprise', 'global'] as const
export type MarketSegmentId = (typeof MARKET_SEGMENT_IDS)[number]

// ---------------------------------------------------------------------------
// Ids (plain strings, documented for readability)
// ---------------------------------------------------------------------------

export type SlotId = string // 'founder' for the fixed center desk, else e.g. 'r2-s5'
export type EmployeeId = string
export type ProjectId = string
export type VisitorId = string
export type FurnitureId = string // FurnitureItem.id from content
export type DecisionCardId = string // DecisionCard.id from content
export type CrisisId = string // CrisisDef.id from content (GAMEPLAY V2 §5.1)
export type OfficeLineId = string

export const FOUNDER_SLOT_ID: SlotId = 'founder'

// ---------------------------------------------------------------------------
// Effects (shared by decisions, concepts, furniture, founder actions)
// ---------------------------------------------------------------------------

/**
 * GAMEPLAY V2 §5.1 (additive): 'multipleCap' scales the stage's multiple ceiling, 'diligenceMom' the MoM the investor
 * asks for (investor winter); 'capacity' scales the servers' capacity (payday desk: infra deferred, eviction; §6.1);
 * 'rent' scales the rent (landlord-notice).
 */
export type ModifierKind = 'churn' | 'arpu' | 'production' | 'morale' | 'cac' | 'organic' | 'roundSpeed' | 'multipleCap' | 'diligenceMom' | 'capacity' | 'rent'

/** Temporary multiplier living in state until `untilDay`. */
export interface TimedModifier {
  id: string
  kind: ModifierKind
  /** Multiplier (1 = neutral). For 'morale' it is an additive target bonus instead. */
  value: number
  untilDay: number
  source: string // card id / action kind / concept id
}

/** Declarative effect payload. Engine applies & clamps (e.g. cashPercent capped to ±25%). */
export interface EffectBundle {
  cash?: number
  /** Fraction of current cash, e.g. 0.1 = +10%. Engine caps to anti-farm limits. */
  cashPercent?: number
  users?: number
  usersPercent?: number
  /** Direct morale delta (0–100 scale). */
  morale?: number
  reputation?: number
  /** Founder equity delta as fraction (−0.05 = give away 5 points). */
  equity?: number
  /** Founder energy delta (0–100). */
  energy?: number
  /** Added to every active (not finished) project's maturity, 0–1 scale. */
  maturity?: number
  techDebt?: number
  /** Temporary modifiers, durations in days. */
  modifiers?: { kind: ModifierKind; value: number; days: number }[]
  /** Changes weeks left on an active round (negative = faster). */
  roundWeeks?: number
  unlockTool?: ToolId
  unlockWidget?: HudWidget
  /** Queues this concept bubble (if not triggered yet). */
  queueConcept?: ConceptId
  /** Queues a follow-up decision card. */
  queueCard?: DecisionCardId
  /** Sets named flag(s) (for card conditions / archetype detection). */
  setFlag?: string | readonly string[]
  /** Cash worth this many months of today's burn (the one-time angel, GAMEPLAY V2 §5.2). */
  cashBurnMonths?: number
  /** Takes the (single) loan (GAMEPLAY V2 §6.2): max(burn × burnMonths, LOAN_MIN[stage]) into cash, on these terms. */
  loan?: LoanTerms
}

/** Terms of a loan option. `covenantRunway` (months of runway the lender asks for) defaults to burnMonths × 0.5. */
export interface LoanTerms {
  burnMonths: number
  /** Months of amortization after the interest-only period. */
  months: number
  /** Monthly interest rate (0.03 = 3%). */
  rate: number
  covenantRunway?: number
}

/**
 * The loan (GAMEPLAY V2 §6.2, "şeytanla anlaşma"): interest from the first payday, amortization only after
 * `interestOnlyUntil`, the covenant (runway ≥ covenantRunway) measured on paydays from `covenantFromDay`.
 * 1st breach: warning; 2nd: half the balance is called and the rate × LOAN_CALL_RATE_MULT; 3rd: the rest is called.
 */
export interface LoanState {
  principal: number
  balance: number
  rateMonthly: number
  /** Amortization months left (counted down once amortization starts). */
  monthsLeft: number
  covenantRunway: number
  covenantFromDay: number
  interestOnlyUntil: number
  breaches: number
}

export interface DelayedEffect {
  id: string
  applyDay: number
  effects: EffectBundle
  sourceCardId?: DecisionCardId
  /** Optional activity note shown when it fires (ActivityKind 'delayedEffect'). */
  noteKey?: string
  /** Option picked on the source card ("Kararın → sonucu", docs/CORE_LOOP.md §6). */
  sourceOption?: number
}

/** A delayed decision effect that has landed: the card, the option and what it did. */
export interface DecisionOutcome {
  cardId: DecisionCardId
  optionIndex: number
  /** Day the card was answered. */
  answeredDay: number
  /** Day the effect landed. */
  day: number
  effects: EffectBundle
  noteKey?: string
}

// ---------------------------------------------------------------------------
// Office (PLAN §3)
// ---------------------------------------------------------------------------

export interface GridPos {
  /** Integer cell coords on the floor grid, founder desk at (0,0). +x right, +z toward camera. */
  x: number
  z: number
}

export interface Slot {
  id: SlotId
  /** 0 = founder desk only, 1..6 rings outward. */
  ring: number
  type: SlotType
  pos: GridPos
  /** Quarter turns (0..3) the item faces; render rotates by rotation * 90°. */
  rotation: 0 | 1 | 2 | 3
  /** Catalog id of the item placed here. For size-2 items set on BOTH covered slots. */
  itemId?: FurnitureId
  /** Set on the secondary slot of a size-2 item: id of the anchor slot. */
  spanOf?: SlotId
  /** Employee sitting here (desk slots only). */
  occupantId?: EmployeeId
}

export interface RingState {
  index: number
  unlocked: boolean
  /** One-off renovation cost to open. */
  openCost: number
  /** Monthly rent increase once open. */
  rentPerMonth: number
}

export interface OfficeState {
  stage: StageIndex // office layout belongs to this stage
  rings: RingState[]
  slots: Slot[]
}

// ---------------------------------------------------------------------------
// People & projects
// ---------------------------------------------------------------------------

export interface Employee {
  id: EmployeeId
  name: string
  dept: Dept
  /** Hidden-ish quality 0.5–1.5; shown only once 'candidateQuality' widget is unlocked. */
  quality: number
  /** Monthly salary in $: set at hire (stage multiplier applied then), then a yearly market raise (GAMEPLAY V2 §4.2). */
  salary: number
  status: EmployeeStatus
  statusSinceDay: number
  hiredDay: number
  deskSlotId?: SlotId
  projectId?: ProjectId
  /** Individual morale 0–100 (global target + local auras). */
  morale: number
  /** Set while status === 'leaving': day they walk out unless retained. */
  leaveDay?: number
  /** True for the "star" hire (ten-x-myth card). */
  star?: boolean
  /** Yearly market raises paid so far (the one source of truth; old saves default lazily to the years served, no back pay). */
  raises?: number
}

export interface Candidate {
  id: string
  name: string
  dept: Dept
  quality: number
  salary: number
  /** Day this candidate disappears from the pool. */
  expiresDay: number
}

export interface Project {
  id: ProjectId
  name: string
  category: ProjectCategory
  /** Project size divisor (§5.3). */
  size: number
  /** 0–1 */
  maturity: number
  /** maturity ≥ 0.2 (MVP) has been reached. */
  launched: boolean
  launchedDay?: number
  /** Release thresholds passed (balance RELEASE_THRESHOLDS: MVP 0.2, 0.4, 0.6, 0.8, 1.0). Missing = not seen yet. */
  releaseLevel?: number
  /**
   * After 1.0 the builders keep shipping updates (docs/CORE_LOOP.md §5 "Sürüm anı"): progress toward the next update
   * (maturity-equivalent, balance RELEASE_UPDATE_SIZE) and updates shipped so far.
   */
  updateProgress?: number
  updates?: number
  createdDay: number
  assignedIds: EmployeeId[]
}

export interface EnterpriseCustomer {
  id: string
  name: string
  mrr: number
  sinceDay: number
  /** Contract end (balance SALES_CONTRACT_DAYS): the customer leaves unless renewed. Missing = old save, open-ended. */
  untilDay?: number
}

// ---------------------------------------------------------------------------
// Founder
// ---------------------------------------------------------------------------

export interface FounderActionRun {
  kind: FounderActionKind
  startDay: number
  endDay: number
  targetId?: string // e.g. project id for talkToUsers
}

export interface FounderState {
  /** 0–100, regenerates daily. */
  energy: number
  currentAction?: FounderActionRun
  /** Day each action becomes available again. Missing = available. */
  cooldowns: Partial<Record<FounderActionKind, number>>
  /** Consecutive days with energy < 20 (founder-burnout concept). */
  lowEnergyDays: number
  /** Weekly move budget (GAMEPLAY V2 §7.1), from Pre-seed on; older saves default lazily (founder.movesOf). */
  moves?: FounderMoves
}

/** Moves left this week and the day the week began (refilled on every day % 7 === 0). */
export interface FounderMoves {
  left: number
  weekStart: number
}

/** The move budget as the bottom bar shows it ("3/4"): left, this week's total, the day it refills. */
export interface MovesView {
  left: number
  total: number
  resetDay: number
}

// ---------------------------------------------------------------------------
// Teaching (concepts), decisions, rounds
// ---------------------------------------------------------------------------

export interface ConceptsState {
  /** Triggered at least once (never re-triggers). */
  triggered: ConceptId[]
  /** Player opened the card → learned (widget unlocked). */
  learned: ConceptId[]
  /** Waiting to be shown (max 1 bubble on screen). */
  queue: ConceptId[]
  /** Bubble currently on screen. */
  active?: { id: ConceptId; shownDay: number }
  /** Bubbles shrunk to an icon above the speaker (after 20s real time, UI dispatches minimizeConcept). */
  minimized: ConceptId[]
  /** "Sen nerede gördün?" text captured when the concept triggered (the player's numbers at that moment). */
  where?: Partial<Record<ConceptId, string>>
}

export interface DecisionHistoryEntry {
  cardId: DecisionCardId
  optionIndex: number
  day: number
}

export interface DecisionsState {
  active?: { cardId: DecisionCardId; shownDay: number; visitorId?: VisitorId }
  /** Cards queued by effects / engine, shown when slot frees. */
  queue: DecisionCardId[]
  history: DecisionHistoryEntry[]
  pending: DelayedEffect[]
  /** Last answered option, for the reflection line in UI. */
  lastAnswer?: DecisionHistoryEntry
  lastCardDay: number
  /** Landed delayed effects, newest last (capped). */
  outcomes?: DecisionOutcome[]
}

export interface RoundOffer {
  amount: number
  /** Equity sold, fraction (0.10 = 10%). */
  equity: number
  preMoney: number
}

export interface RoundState {
  active: boolean
  targetStage: StageIndex
  startedDay: number
  weeksTotal: number
  weeksLeft: number
  offer: RoundOffer
  /** Valuation when the round started; offer shrinks if metrics fall below. */
  baseValuation: number
  // --- Live round (docs/CORE_LOOP.md §4.3, phase 2). Optional: rounds from older saves lack them. ---
  /** Size picked at start: runway months ↔ equity. */
  size?: RoundSize
  /** Months of (new) burn the amount was sized for. */
  months?: number
  /** Amount at an offer factor of 1 (sized on the new burn); the live offer = baseAmount × factor. */
  baseAmount?: number
  /** Valuation the round is priced against (the next stage's target). */
  targetValuation?: number
  /** Product of the weekly pitch results (1 = neutral). Older saves; replaced by pitchBonus. */
  pitchFactor?: number
  /**
   * The investor's overall impression: the AVERAGE result of the weekly pitches (a week whose pitch was skipped counts
   * as 0), within ±PITCH_BONUS_CAP, added on top of price × diligence. An average never saturates, so every pitch
   * still moves the money (review fix: pitches stopped mattering once a sum hit the ceiling).
   */
  pitchBonus?: number
  /** Weeks a pitch was due so far (the average's denominator). */
  pitchWeeks?: number
  /** Price ratio (valuation / target) when the round started: half of the price is locked at the start. */
  priceAtStart?: number
  /** What decided the amount at the last weekly re-size: the table floor, the burn × months, or the table ceiling. */
  amountBy?: 'floor' | 'burn' | 'ceiling'
  /** Week (1-based, weeks done) whose pitch waits for the player's choice; undefined = none due. */
  pitchDue?: number
  /** Pitches made, oldest first. `delta`: offer factor change (fraction). */
  pitches?: RoundPitchEntry[]
  /** Due-diligence list brought by the investor; values refresh every week. */
  diligence?: DiligenceItem[]
  /** Last weekly move of the offer (the live offer line). */
  lastMove?: { week: number; from: number; to: number }
  /**
   * GAMEPLAY V2 §6.3: strikes (a week where ≥ 2 checks met at the start broke: +1, else −1, min 0); ROUND_FAIL_STRIKES
   * fails the round. Older saves default to 0.
   */
  strikes?: number
  /** Diligence checks met when the round started (the investor only gets angry at what broke). Older saves: first week. */
  ddStart?: DiligenceId[]
  /** A down round (after a failed one): less money, more equity, no offer floor. */
  down?: boolean
}

/** Round size: Küçük (12 months of runway, less equity) / Hedef (18) / Büyük (24, more equity). */
export const ROUND_SIZES = ['small', 'target', 'large'] as const
export type RoundSize = (typeof ROUND_SIZES)[number]

/** Weekly pitch: show metrics / tell the story / bring a second investor. */
export const ROUND_PITCHES = ['metrics', 'story', 'coinvestor'] as const
export type RoundPitch = (typeof ROUND_PITCHES)[number]

export interface RoundPitchEntry {
  week: number
  pitch: RoundPitch
  /** Offer factor change, fraction (+0.05 = +5%). */
  delta: number
}

/** Due-diligence checks (docs/CORE_LOOP.md §4.3): runway ≥ months, MoM ≥ fraction, morale ≥ points, burn multiple ≤ ask. */
export type DiligenceId = 'runway' | 'growth' | 'morale' | 'burn'

export interface DiligenceItem {
  id: DiligenceId
  target: number
  /** Current value (runway null = profitable → counts as met, stored as target). */
  value: number
  met: boolean
  /** false: not asked at this stage (burn before Seed), neutral in the offer. Missing = asked (old saves). */
  asked?: boolean
}

/** One size option of the round chooser (engine computed, UI shows it as is). */
export interface RoundSizeOption {
  size: RoundSize
  months: number
  /** Amount at an offer factor of 1. */
  amount: number
  /** What the offer would be at today's factor (amount × factor). */
  offer: number
  /** Equity sold (after ☆ discounts). */
  equity: number
  /** The same size as the one-time down round (GAMEPLAY V2 §6.3), when it is open: less money, more equity, no floor. */
  down?: { amount: number; offer: number; equity: number }
}

/** Live round numbers for the Büyüme > Tur section (recomputed every step). */
export interface RoundView {
  /** Valuation the next round is priced against. */
  target: number
  /** Valuation at which the early window opens (target × ROUND_EARLY_RATIO). */
  windowAt: number
  /** Valuation / target, clamped to the offer range (the price part of the offer factor). */
  priceRatio: number
  /** Whole offer factor if the round closed now: clamp(price × diligence) + pitch bonus. */
  factor: number
  /** Ceiling of price × diligence (ROUND_OFFER_CEIL); the pitch bonus is added on top. */
  ceiling: number
  /** Pitch bonus so far (running round) and its cap (±PITCH_BONUS_CAP). */
  pitchBonus: number
  pitchCap: number
  /** Round length range in weeks (ROUND_WEEKS_MIN–MAX), for the panel text. */
  weeksMin: number
  weeksMax: number
  /** Running round: price ratio locked at the start (half of the price counts it). */
  priceAtStart?: number
  /** Pre-round: the three size options. */
  sizes?: RoundSizeOption[]
  /** Due-diligence list: the running round's, or what the investor would ask now. */
  diligence: DiligenceItem[]
  /** Running round: the offer if it closed at today's numbers. */
  projected?: number
  /** Running round: what each pitch would do right now. */
  pitchOptions?: PitchOption[]
  /** MoM growth the investor asks for at this stage (diligence + "Metrik göster"). */
  growthAsk: number
  /** Running round: strikes / ROUND_FAIL_STRIKES (0–1, the round chip's colour; GAMEPLAY V2 §6.3). */
  risk?: number
  /** Running round: strikes so far. */
  strikes?: number
  /** The one-time down round is open (a round failed this stage); the running round is one when on a down round. */
  downRound?: boolean
  /** Days until a round can start again after a failed one (0 = can). */
  retryIn?: number
}

/** Preview of one weekly pitch (engine computed). */
export interface PitchOption {
  pitch: RoundPitch
  /** Offer factor change, fraction (the expected value for 'story'). */
  delta: number
  /** 'story' is a gamble: the change lands between min and max (reputation moves both up). */
  min?: number
  max?: number
  /** Weeks taken off the round. */
  weeks: number
  /** Extra equity sold, fraction. */
  equity: number
  /** Founder energy it costs. */
  energy: number
  /** Can be picked now (energy, and a move from Pre-seed on: GAMEPLAY V2 §7.1). */
  ok: boolean
}

// ---------------------------------------------------------------------------
// Finance & derived metrics
// ---------------------------------------------------------------------------

export interface BurnBreakdown {
  salaries: number
  rent: number
  infra: number
  ads: number
  /** Founder living cost (FOUNDER_LIVING_COST[stage]); optional for older saves and mocks. */
  founder?: number
  /** Monthly upkeep of the opened market segments (GAMEPLAY V2 §8.1); missing = none. */
  expansion?: number
}

/** Costs accrued since the last payday (+ revenue, which already flowed into cash day by day). */
export interface MonthLedger {
  revenue: number
  salaries: number
  rent: number
  infra: number
  ads: number
  /** Founder living cost accrued (optional: older saves). */
  founder?: number
  /** Segment upkeep accrued (GAMEPLAY V2 §8.1; optional: older saves). Paid like ads: it cannot be deferred. */
  expansion?: number
}

/** GAMEPLAY V2 §6.1: what the payday desk does with each line of a month it cannot pay. Ads cannot be deferred. */
export interface PaydayChoice {
  salaries: 'full' | 'half' | 'defer'
  rent: 'pay' | 'defer'
  infra: 'pay' | 'defer'
  /** 'cut' pays this month's ads and sets the budget to 0 from now on. */
  ads: 'pay' | 'cut'
  /** 'skip': the founder takes nothing this month (owed like a deferral, and it costs energy). */
  founder: 'pay' | 'skip'
}

/** A payday that cash could not cover (§6.1): the month waits on the desk for PAYDAY_DECIDE_DAYS. */
export interface PendingPayday {
  /** The payday (game day). */
  day: number
  /** The month's costs, still owed (a new ledger accrues the next month meanwhile). */
  ledger: MonthLedger
  /** finance.deferred before this payday (paid back with DEFER_INTEREST once cash allows). */
  deferredBefore: number
  /** Loan service already taken on the payday (it goes on the receipt when the month closes). */
  interest?: number
  loanRepay?: number
  /** Runway after the previous payday (the receipt's runwayBefore). */
  runwayBefore?: number | null
}

/** Month receipt ("ay fişi"): what the month earned and what payday paid, in one line. */
export interface MonthReceipt {
  /** 0-based index of the month that just closed. */
  month: number
  /** Payday (game day). */
  day: number
  revenue: number
  salaries: number
  rent: number
  infra: number
  ads: number
  /** Founder living cost ("Kurucu"). */
  founder?: number
  /** Segment upkeep ("Pazar", GAMEPLAY V2 §8.1); missing = no segment bought. */
  expansion?: number
  /** Loan interest and principal repaid on this payday (GAMEPLAY V2 §6.2); missing = no loan. */
  interest?: number
  loanRepay?: number
  /** Owed after this payday (GAMEPLAY V2 §6.1, deferred costs + their interest); missing = nothing owed. */
  deferred?: number
  /** Costs paid on payday (salaries + rent + infra + ads + founder + expansion + loan service). */
  paid: number
  /** revenue − paid. */
  net: number
  cashAfter: number
  /** Runway (months) after the previous payday (null on the first one / profitable) and after this one. */
  runwayBefore: number | null
  runwayAfter: number | null
  /** MoM MRR growth and valuation multiple at month end. */
  mom: number
  multiple: number
  mrr: number
  users: number
  // v4 (docs/GAMEPLAY_V2.md §14.2): month-end snapshot for the stats screen. Later waves add deferred / interest /
  // loanRepay / expansion; burnMultiple and penetration are written once the engine computes them.
  team?: number
  morale?: number
  valuation?: number
  /** Founder equity fraction. */
  equity?: number
  reputation?: number
  debt?: number
  adBudget?: number
  /** Users gained (or lost) over the month. */
  usersDelta?: number
  stage?: StageIndex
  burnMultiple?: number
  /** users / reachable market (0–1). */
  penetration?: number
}

/** A month rebuilt from a pre-v4 save (mrrHistory / usersHistory): only its users and MRR are known. */
export interface PartialReceipt {
  partial: true
  month: number
  day: number
  mrr: number
  users: number
  usersDelta: number
}

/** One month of `finance.receipts`: a payday receipt (rounded), or a month rebuilt from an older save. */
export type ReceiptEntry = MonthReceipt | PartialReceipt

/** Radar axes of the company profile (docs/GAMEPLAY_V2.md §14.2), in drawing order. */
export const PROFILE_AXES = ['product', 'growth', 'efficiency', 'team', 'morale', 'cash'] as const
export type ProfileAxis = (typeof PROFILE_AXES)[number]
/** 0–1.5 per axis (1 = what the stage expects); null = locked or not measurable yet (e.g. before revenue). */
export type CompanyProfile = Record<ProfileAxis, number | null>

/** Spend preview (docs/GAMEPLAY_V2.md §4.4): runway before / after and the first payday cash runs out. */
export interface SpendPreview {
  runwayNow: number | null
  runwayAfter: number | null
  /** First payday (game day) that cash − owed goes below zero; null = never (profitable). */
  deathDay: number | null
  /** The very next payday cannot be paid. */
  paydayShort: boolean
}

/** Cash after each of the next paydays at today's net, and the death day (same core as SpendPreview). */
export interface CashProjection {
  points: { day: number; cash: number }[]
  deathDay: number | null
}

export interface FinanceState {
  mrr: number
  burn: number // monthly
  burnBreakdown: BurnBreakdown
  /** mrr − burn, monthly. */
  net: number
  /** Months of runway; null = infinite (net ≥ 0). */
  runway: number | null
  valuation: number
  /** MRR snapshot at the end of each month (index = month). */
  mrrHistory: number[]
  /** Users snapshot at the end of each month. */
  usersHistory: number[]
  /** Days since a payday that could not be paid, while cash stays short (game over at 60). */
  negativeCashDays: number
  /** Payday left cash < 0: the bankruptcy clock runs until cash − owed ≥ 0 again (docs/CORE_LOOP.md §5). */
  payrollMissed?: boolean
  /** Monthly ad spend, 0 until adBudget tool. */
  adBudget: number
  /** 0.7–1.6, player-set once priceControl unlocked. */
  priceMultiplier: number
  /** Day of last price increase (churn penalty lasts 30 days). */
  priceChangeDay?: number
  enterpriseCustomers: EnterpriseCustomer[]
  /** Loan balance outstanding (= loan.balance; kept for older readers). */
  debt: number
  /** The single loan (GAMEPLAY V2 §6.2); older saves with debt get one in the v4 migration (or lazily on payday). */
  loan?: LoanState
  /** Costs accrue daily and are paid in one lump on payday (day % 30 === 0, the 1st of the month). */
  ledger?: MonthLedger
  /** Last payday's receipt (unrounded; the UI reads it). */
  lastReceipt?: MonthReceipt
  /** Month history, oldest first, at most HISTORY_MAX_MONTHS (v4; payday appends, rounded). */
  receipts?: ReceiptEntry[]
  /** Net (mrr − burn) at each month end (v4; world.monthEnd appends, same index as mrrHistory from then on). */
  netHistory?: number[]
  /** Day the last round closed (v4; idle-cash penalty grace). Undefined = none on record. */
  lastRoundCloseDay?: number
  /** A payday cash could not cover, waiting on the desk (GAMEPLAY V2 §6.1). */
  pendingPayday?: PendingPayday
  /** Costs deferred at the payday desk, owed (counted in owed costs and runway); older saves default lazily to 0. */
  deferred?: number
}

/** Main variables (PLAN §5.1). Per-project maturity lives on Project. */
export interface CoreStats {
  cash: number
  users: number
  /** 0–100 */
  morale: number
  /** 0–100 */
  reputation: number
  /** $/user/month */
  arpu: number
  /** Monthly churn fraction (0.06 = 6%). */
  churn: number
  /** Founder equity fraction (1 = 100%). */
  equity: number
}

/** Recomputed by the engine every step; read-only for UI/render. */
export interface DerivedMetrics {
  teamSize: number
  deptCounts: Record<Dept, number>
  /** Effective output per dept after all multipliers. */
  deptOutput: Record<Dept, number>
  avgMaturity: number
  capacity: number
  /** max(0, users/capacity − 1) */
  overload: number
  /** Coordination multiplier 0.7–1. */
  coordination: number
  moraleTarget: number
  cac: number
  ltv: number
  /** null until meaningful (no paid users / no churn). */
  ltvCac: number | null
  /** Month-over-month MRR growth fraction. */
  momGrowth: number
  /** Average MoM of the last MULTIPLE_MOM_MONTHS months: what the multiple prices. Optional for old saves/mocks. */
  momAvg?: number
  /** The stage's multiple ceiling (MULTIPLE_MAX_BY_STAGE). */
  multipleCap?: number
  valuationMultiple: number
  /** Net burn of the last 3 months / MRR gained × 12 (0 = not burning; GAMEPLAY V2 §4.1). */
  burnMultiple?: number
  /** Display only: annualised MoM % + net margin %. */
  ruleOf40?: number
  /** Monthly user inflow by channel (channelBreakdown widget). */
  channels: { organic: number; paid: number; manual: number; enterprise: number }
  /** Valuation / next stage target, 0–1+ (stage progress bar). */
  stageProgress: number
  canStartRound: boolean
  /** Round window / live offer numbers (docs/CORE_LOOP.md §4.3); undefined past the last round. */
  round?: RoundView
  /** "Elle kullanıcı bul" return preview (monthly saturation). */
  findUsers?: FindUsersPreview
  /** Next link of the main chain (docs/CORE_LOOP.md §5 "Sıradaki adım"). */
  nextStep?: NextStep
  /** What is coming in the next weeks: paydays, delayed decision effects, releases, round (§5 "Ufuk şeridi"). */
  horizon?: HorizonItem[]
  /** Maturity gained per day by each project (unfinished: maturity; finished: update progress). For release ETAs. */
  maturityPerDay?: Record<ProjectId, number>
  /** How valuation is built right now (pre-revenue parts or MRR × 12 × multiple). */
  valuationParts?: ValuationBreakdown
  /** "Satış görüşmesi" return preview (monthly saturation). */
  salesCall?: SalesCallPreview
  /** Market size the users are measured against: Σ of the open segments, each ramping in (GAMEPLAY V2 §8.1). */
  tam?: number
  /** users / tam, 0–1: saturates paid and organic reach and lifts churn and CAC. */
  penetration?: number
  /** The next scheduled crisis (GAMEPLAY V2 §5.1): its day, and its id once revealed (hidden = "?" on the horizon). */
  nextCrisis?: NextCrisis
  /** Founder move budget (GAMEPLAY V2 §7.1); absent in the garage (no budget there). */
  moves?: MovesView
  /** The Kanun Kitabı (GAMEPLAY V2 §7.2). */
  policies?: PoliciesView
  /** The market map (GAMEPLAY V2 §8.1–8.2): segments and the rivals that can be bought, as the engine prices them. */
  market?: MarketView
}

/**
 * An opened market segment (GAMEPLAY V2 §8.1). `size` users join the TAM over MARKET_RAMP_DAYS from `openedDay`;
 * `upkeep` is its monthly cost (0 for the free ones). Never closed again.
 */
export interface MarketSegment {
  id: MarketSegmentId
  size: number
  openedDay: number
  upkeep: number
}

/** The market (GAMEPLAY V2 §8.1): the opened segments, oldest first. Older saves default by stage (market.marketOf). */
export interface MarketState {
  segments: MarketSegment[]
}

/** One segment as the market map shows it: open (and how far ramped) or a silhouette with its price and lock. */
export interface SegmentView {
  id: MarketSegmentId
  /** Stage it opens at. */
  stage: StageIndex
  size: number
  /** One-off cost and monthly upkeep (0 = free / automatic). */
  cost: number
  upkeep: number
  open: boolean
  /** 0–1 of its size counted in the TAM (1 once MARKET_RAMP_DAYS passed; 0 while closed). */
  ramp: number
  /** Opens by itself on arriving at its stage (no verb). */
  auto: boolean
  /** Why openSegment would fail right now (null = it can be opened; closed auto ones are 'notUnlocked'). */
  error: ActionErrorCode | null
}

/** A rival as the M&A row prices it (GAMEPLAY V2 §8.2): what it costs and the users it brings. */
export interface AcquisitionView {
  id: string
  price: number
  users: number
  /** Why acquireRival would fail right now (null = it can be bought). */
  error: ActionErrorCode | null
}

export interface MarketView {
  segments: SegmentView[]
  /** Rivals still in the market (bought ones left out). */
  rivals: AcquisitionView[]
}

/** Next crisis on the calendar: the date is known, the id only from CRISIS_TELEGRAPH_DAYS before. */
export interface NextCrisis {
  day: number
  id?: CrisisId
  hidden: boolean
}

/**
 * One date of the crisis calendar (GAMEPLAY V2 §5.1). The date is set when it is scheduled; the id is drawn from the
 * then-current stage's pool on `revealDay` (null until then). `light`: the pool was used up, so it is a softer repeat
 * of the previous crisis (severity × CRISIS_LIGHT_SEVERITY).
 */
export interface CalendarEntry {
  id: CrisisId | null
  day: number
  revealDay: number
  fired?: true
  light?: true
}

/**
 * The director (GAMEPLAY V2 §5.2, RimWorld): pressure 0.1–1 grows with the player's wealth and drops for
 * DIRECTOR_GRACE_DAYS after a missed payroll. It weighs crisis / rival cards (never how often cards come), the crisis
 * severity and the rivals' strength. `angelUsed`: the one-time angel lifeline was offered.
 */
export interface DirectorState {
  pressure: number
  graceUntil: number
  angelUsed?: true
}

/**
 * A named rival (GAMEPLAY V2 §8.2). `strength` and `share` are 0–1; the lead (rivals[0]) paces the player's valuation
 * (born at RIVAL_START_RATIO of it, growing at the investor's ask). `ahead`: its valuation is past the player's now.
 */
export interface Rival {
  id: string
  name: string
  bornDay: number
  strength: number
  share: number
  mrr: number
  valuation: number
  momentum: -1 | 0 | 1
  /** Bought by the player (acquireRival, GAMEPLAY V2 §8.2): out of the market, its share 0 for good. */
  acquiredDay?: number
  /** Closed down (the rival thread's rival-dies, flags.rivalGone): out of the market like a bought one. */
  goneDay?: number
  /** Strength × RIVAL_ADAPT_STRENGTH until this day (a missed payroll gives the player room to breathe). */
  adaptUntilDay?: number
  ahead?: boolean
}

/** Valuation breakdown (docs/CORE_LOOP.md §4.3 "çarpan dökümü"): engine computed, the UI only prints it. */
export interface ValuationBreakdown {
  /** 'pre': launched × $150K + users × $400 + releases (max 5) × $15K; 'post': MRR × 12 × multiple (blended in below $1K MRR). */
  mode: 'pre' | 'post'
  users: number
  launched: number
  /** Releases counted (min(VAL_RELEASE_MAX, releaseCount)). */
  releases: number
  /** Pre-revenue parts in dollars. */
  usersValue: number
  launchedValue: number
  releasesValue: number
  mrr: number
  multiple: number
  /** 3-month average MoM the multiple prices, the stage's floor and ceiling. */
  momAvg: number
  min: number
  cap: number
  /** bmPenalty × idlePenalty × boardPenalty (1 = none). */
  penalty: number
  /** Share of the post-revenue formula counted (mrr / PRE_REVENUE_MRR, max 1). */
  blend: number
  /** From Seed, below $1K MRR: the fading pre-revenue part, pre × (1 − blend) (0 otherwise). */
  preFade: number
  total: number
}

/** Preview of the next "Satış görüşmesi": contract MRR range and the month's saturation. */
export interface SalesCallPreview {
  min: number
  max: number
  /** Return multiplier (1 = full). */
  factor: number
  /** Full-return deals left this month. */
  fullLeft: number
  /** Contract length in days. */
  contractDays: number
}

/** Preview of the next "Elle kullanıcı bul": users range and why it is reduced. */
export interface FindUsersPreview {
  min: number
  max: number
  /** Full-return finds left this month. */
  fullLeft: number
  /** Return multiplier (1 = full). */
  factor: number
  /** 'circle': the month's full finds are used up; 'big': over FIND_USERS_BIG_AT users. */
  reasons: ('circle' | 'big')[]
}

/** Main chain: idea → first users → desk → hire → release → users → traction (pre-revenue valuation) → round. */
export const NEXT_STEP_IDS = ['idea', 'findUsers', 'desk', 'hire', 'launch', 'users', 'revenue', 'traction', 'round', 'roundWait', 'grow'] as const
export type NextStepId = (typeof NEXT_STEP_IDS)[number]

export interface NextStep {
  id: NextStepId
  /** 1-based link number in the chain (round / roundWait / grow share the last one). */
  index: number
  total: number
  /** 0–1 toward this link, when measurable. */
  progress?: number
  /** Slot the step points at (empty desk slot for 'desk'). */
  slotId?: SlotId
  /** Target number (users / MRR / valuation). */
  target?: number
  /** 'traction': valuation one more release adds (0 once VAL_RELEASE_MAX releases count). */
  value?: number
}

/** 'saturation': penetration ≥ MARKET_SATURATION_PEN (GAMEPLAY V2 §8.1): ads go to waste, a segment waits. */
export type HorizonKind = 'payday' | 'delayed' | 'release' | 'roundClose' | 'roundReady' | 'crisis' | 'saturation'

export interface HorizonItem {
  kind: HorizonKind
  /** Game day it lands (estimate for releases and round close). */
  day: number
  /** Payday: projected costs (the desk's deadline: the shortfall). */
  amount?: number
  /**
   * Payday: the payday desk's last day before its default order applies (GAMEPLAY V2 §6.1). A flag on 'payday', not a
   * kind of its own, until the horizon UI has a row for it.
   */
  due?: boolean
  cardId?: DecisionCardId
  optionIndex?: number
  noteKey?: string
  projectId?: ProjectId
  /** Release level it would reach. */
  level?: number
  /** Update number (after 1.0), when the release is an update. */
  update?: number
  /** Crisis: its id once revealed. */
  crisisId?: CrisisId
  /** Crisis: the date is known but not what it is yet ("?"). */
  hidden?: boolean
}

/** A release moment (maturity threshold passed): the user wave and the MRR jump it brought. */
export interface ReleaseEntry {
  id: string
  day: number
  projectId: ProjectId
  projectName: string
  /** 1 = MVP (0.2), 2 = 0.4, 3 = 0.6, 4 = 0.8, 5 = 1.0 */
  level: number
  /** Update number after 1.0 (level stays 5). */
  update?: number
  users: number
  mrr: number
}

/** Where a stage started (goals ☆ measure progress inside the stage, not what was carried in). */
export interface StageBaseline {
  stage: StageIndex
  day: number
  users: number
  team: number
  /** Total releases (levels + updates) shipped before the stage. */
  releases: number
  mrr: number
  projects: number
  /** Lowest payday runway seen in the stage (months, 99 = profitable; GAMEPLAY V2 §9.3). */
  minRunway?: number
}

/**
 * The Kanun Kitabı (GAMEPLAY V2 §7.2): policies signed, oldest first (never revoked), and the day of the last signature
 * (POLICY_SIGN_COOLDOWN_DAYS between two). Older saves default lazily to {adopted: [], lastSignedDay: -999}.
 */
export interface PolicyState {
  adopted: PolicyId[]
  lastSignedDay: number
  /** Survival policies signed: each adds POLICY_SURVIVAL_EQUITY to every round's equity for good. Missing = 0. */
  survival?: number
  /** Wages held back by 'deferred-pay' since the last round close (paid out when the next round closes). Missing = 0. */
  owed?: number
}

/**
 * Policy multipliers and additive terms (GAMEPLAY V2 §7.2). 'salary' scales the payroll, 'founderPay' the founder's
 * living cost, 'severance' a fire's severance, 'resign' the resignation risk (the quitting morale bar), 'energyRegen'
 * the founder's energy regen, 'coordination' the coordination loss, 'releaseGap' the days between two updates.
 */
export type PolicyKind = ModifierKind | 'salary' | 'infra' | 'energyRegen' | 'coordination' | 'founderPay' | 'severance' | 'resign' | 'releaseGap'

/** The Kanun Kitabı as the engine computed it (state.derived.policies), and the totals content-free paths read. */
export interface PoliciesView {
  /** Can be signed now: unlocked, not signed, not excluded by a signed one (the cooldown is nextSignDay). */
  available: PolicyId[]
  adopted: PolicyId[]
  /** First day the next signature is allowed. */
  nextSignDay: number
  /** Product of the signed policies' multipliers per kind (missing = 1). */
  mult: Partial<Record<PolicyKind, number>>
  /** Weekly moves added (or taken: management) by the signed policies. */
  movesBonus: number
  /** Burn multiple the investor tolerates on top of the stage's ask (profit-share). */
  burnAsk: number
  /** Monthly wages 'deferred-pay' holds back (owed until the next round close). */
  payLater: number
}

/** A stage's report card (GAMEPLAY V2 §9.3), written when the stage is left (round close, Unicorn). */
export interface StageReport {
  stage: StageIndex
  /** Days spent in the stage. */
  days: number
  /** Rounds closed over the run so far. */
  roundsClosed: number
  /** ☆ goals reached in the stage. */
  goalsDone: number
  /** Thread cards answered in the stage. */
  threadSteps: number
  /** Lead rival valuation / the player's (0 = no rival). */
  rivalRatio: number
  /** Lowest payday runway in the stage (months, 99 = profitable). */
  minRunway: number
}

// ---------------------------------------------------------------------------
// World flavour: visitors, ambient bubbles, activity, events
// ---------------------------------------------------------------------------

export type VisitorPurpose = 'decision' | 'concept' | 'round' | 'ambient'

export interface Visitor {
  id: VisitorId
  role: NpcRole
  purpose: VisitorPurpose
  /** Where the visitor walks to (e.g. meeting room slot or founder desk). */
  targetSlotId?: SlotId
  arriveDay: number
  leaveDay: number
  /** Related card / concept id. */
  refId?: string
}

/** Short non-clickable office line (PLAN §6.4), ~3s visible. */
export interface AmbientBubble {
  id: string
  lineId: OfficeLineId
  /** Employee id, visitor id, or 'founder'. */
  speakerId: string
  day: number
  /** Game day after which it disappears. */
  untilDay: number
}

export type ActivityKind =
  | 'hired' | 'fired' | 'resigned' | 'resignWarning' | 'retained'
  | 'itemPlaced' | 'itemSold' | 'itemMoved' | 'ringOpened'
  | 'projectStarted' | 'projectLaunched'
  | 'founderActionStarted' | 'founderActionDone'
  | 'roundStarted' | 'roundProgress' | 'roundClosed' | 'roundShrunk'
  | 'stageUp' | 'milestone' | 'delayedEffect' | 'bankruptWarning' | 'enterpriseWon' | 'enterpriseLost'
  | 'payday' | 'release' | 'goalDone'
  | 'roundWindow' | 'roundOffer' | 'roundPitch'
  | 'payrollMissed' | 'decisionDefaulted'

/** Bottom-left activity line. Text lives in content (ACTIVITY_TEXT[kind]) with {param} placeholders. */
export interface ActivityEntry {
  id: number
  day: number
  kind: ActivityKind
  params?: Record<string, string | number>
}

export type MilestoneId = 'users100' | 'users1000' | 'users10k' | 'firstMrr' | 'firstProfitMonth' | 'firstLaunch'

export type GameEventKind =
  | 'hired' | 'fired' | 'resigned' | 'itemPlaced' | 'itemSold' | 'itemMoved' | 'ringOpened'
  | 'projectLaunched' | 'milestone' | 'roundStarted' | 'roundClosed' | 'stageUp'
  | 'conceptQueued' | 'conceptLearned' | 'decisionShown' | 'decisionAnswered'
  | 'visitorArrived' | 'visitorLeft' | 'founderActionStarted' | 'founderActionDone'
  | 'bankruptWarning' | 'gameOver' | 'victory'
  | 'payday' | 'release' | 'goalDone' | 'delayedEffect'
  /** The early round window opened (valuation ≥ 60% of target). */
  | 'roundWindow'
  /** A round week passed: the live offer moved (value = new amount) and a pitch is due. */
  | 'roundWeek'
  /** The player pitched (refId = RoundPitch, value = offer factor change). */
  | 'roundPitched'
  /** Payday left cash < 0 (value = shortfall): the bankruptcy clock starts, the rescue card comes. */
  | 'payrollMissed'
  /** An unanswered card applied its default option (refId = card, value = option index). */
  | 'decisionDefaulted'
  /** A scheduled crisis showed what it is (refId = CrisisId, value = crisis day). */
  | 'crisisRevealed'
  /** A scheduled crisis hit (refId = CrisisId, value = severity). */
  | 'crisis'
  /** A named rival entered the market (refId = rival id). */
  | 'rivalBorn'
  /** The lead rival's valuation went past the player's (refId = rival id, value = its valuation); once per overtake. */
  | 'rivalPassed'
  /** A loan was taken (value = amount). */
  | 'loanTaken'
  /** Covenant breach (GAMEPLAY V2 §6.2): refId 'warn' (1st, value = the next check day) or 'half' (2nd, value = cash called). */
  | 'loanWarning'
  /** 3rd breach: the whole balance is called (value = amount). */
  | 'loanCalled'
  /** The loan was paid off (by amortization or a round close). */
  | 'loanRepaid'
  /** The investor walked away (GAMEPLAY V2 §6.3; value = the round's target stage). */
  | 'roundFailed'
  /** Payday cash cannot cover the month (GAMEPLAY V2 §6.1; value = the shortfall): the payday desk opens. */
  | 'paydayShort'
  /** The desk was answered (value = deferred after it). */
  | 'paydayResolved'
  /** The desk was left PAYDAY_DECIDE_DAYS: the default order paid what it could (value = deferred after it). */
  | 'paydayAutoResolved'
  /** Third rent deferral: the company is moved out (capacity × EVICTION_CAPACITY, value = the moving cost). */
  | 'eviction'
  /** A policy was signed (GAMEPLAY V2 §7.2; refId = PolicyId). */
  | 'policyAdopted'
  /** A market segment was opened (GAMEPLAY V2 §8.1; refId = MarketSegmentId, value = its size). */
  | 'segmentOpened'
  /** A rival was bought (GAMEPLAY V2 §8.2; refId = rival id, value = the price). */
  | 'rivalAcquired'

/**
 * One-shot events for render/UI effects (confetti, move scene, sounds).
 * Kept as a ring buffer (last ~64). Consumers track the last seen `id`.
 */
export interface GameEvent {
  id: number
  day: number
  kind: GameEventKind
  refId?: string
  milestone?: MilestoneId
  value?: number
}

export type PostMortemCode =
  | 'runwayIgnored' | 'burnTooHigh' | 'scaledWithoutPmf' | 'highChurn' | 'lowMorale'
  | 'prematureScaling' | 'lateFundraise' | 'overload' | 'teamLost' | 'unfocused'

export interface PostMortemReason {
  code: PostMortemCode
  conceptId?: ConceptId
  /** Player's own number backing the reason (formatted by UI). */
  value?: number
}

export interface GameOverState {
  kind: 'bankrupt' | 'teamLost' | 'unicorn'
  day: number
  /** Exactly 3 for bankruptcies (PLAN §5.10). */
  reasons: PostMortemReason[]
  xpEarned: number
}

export type CounterKey =
  | 'hires' | 'fires' | 'resignations' | 'manualFinds' | 'userTalks' | 'motivates'
  | 'investorCoffees' | 'salesCalls' | 'crunches' | 'projectsStarted' | 'roundsClosed'
  | 'peakTeam' | 'lowGrowthMonths' | 'profitMonths' | 'refactors'

// ---------------------------------------------------------------------------
// GameState
// ---------------------------------------------------------------------------

export interface RngState {
  seed: number
  /** mulberry32 internal state (uint32). */
  state: number
}

export interface TimeState {
  /** Total elapsed days (float). Integer crossings trigger daily logic. */
  day: number
  /** floor(day / 30) */
  month: number
  speed: GameSpeed
}

export interface MetaState {
  saveVersion: number
  /** XP carried into this run (start cash bonus = min(0.4, 0.1 × xp)). */
  founderXp: number
  runIndex: number
  /** The player's startup name (start screen; shown in the top bar and on the leaderboard). */
  companyName: string
}

export interface GameState {
  meta: MetaState
  rng: RngState
  time: TimeState
  stage: StageIndex
  stats: CoreStats
  finance: FinanceState
  derived: DerivedMetrics
  office: OfficeState
  employees: Employee[]
  candidates: Candidate[]
  projects: Project[]
  founder: FounderState
  concepts: ConceptsState
  decisions: DecisionsState
  round?: RoundState
  modifiers: TimedModifier[]
  techDebt: number
  unlockedWidgets: HudWidget[]
  unlockedTools: ToolId[]
  visitors: Visitor[]
  bubbles: AmbientBubble[]
  milestones: MilestoneId[]
  archetype?: Archetype
  counters: Partial<Record<CounterKey, number>>
  flags: Record<string, boolean | number>
  activity: ActivityEntry[]
  events: GameEvent[]
  /** Monotonic id source for activity/events/entities. */
  nextId: number
  gameOver?: GameOverState
  /** Release moments, newest last (capped). */
  releases?: ReleaseEntry[]
  /** Optional stage goals (☆) reached, content goal ids (content/goals.ts). */
  goalsDone?: string[]
  /** Baseline taken on arriving at the current stage (stage goals measure from here). */
  stageStart?: StageBaseline
  /** Releases shipped over the run (levels + updates), for stage goals. */
  releaseCount?: number
  /** Crisis calendar (GAMEPLAY V2 §5.1), oldest first; older saves default lazily to [] (tick.ts). */
  calendar?: CalendarEntry[]
  /** The director (GAMEPLAY V2 §5.2); older saves default lazily (world.directorOf). */
  director?: DirectorState
  /** The fixed cast (GAMEPLAY V2 §9.1): one name per NPC role for the whole run. Older saves: each role's first name. */
  cast?: Record<NpcRole, string>
  /** Named rivals (GAMEPLAY V2 §8.2), the lead first; older saves from Seed on get theirs lazily (world.ensureRivals). */
  rivals?: Rival[]
  /** Stage report cards (GAMEPLAY V2 §9.3), oldest first (at most STAGE_REPORTS_MAX). Older saves: []. */
  stageReports?: StageReport[]
  /** Company policies (GAMEPLAY V2 §7.2); older saves default lazily (util.policiesOf). */
  policies?: PolicyState
  /** The market's opened segments (GAMEPLAY V2 §8.1); older saves default lazily by stage (market.marketOf). */
  market?: MarketState
}

// ---------------------------------------------------------------------------
// Actions (the ONLY way UI/render change game state: store.dispatch(action))
// ---------------------------------------------------------------------------

export type Action =
  // Team
  | { type: 'hire'; candidateId: string; deskSlotId?: SlotId }
  | { type: 'fire'; employeeId: EmployeeId }
  | { type: 'assignDesk'; employeeId: EmployeeId; slotId: SlotId | null }
  | { type: 'respondResignation'; employeeId: EmployeeId; response: 'raise' | 'talk' | 'letGo' }
  | { type: 'refreshCandidates' }
  // Office
  /** `slotId` omitted: auto place on the free slot nearest the center (findAutoSlot), else `noFreeSlot`. */
  | { type: 'placeItem'; itemId: FurnitureId; slotId?: SlotId }
  | { type: 'sellItem'; slotId: SlotId }
  | { type: 'moveItem'; fromSlotId: SlotId; toSlotId: SlotId }
  | { type: 'upgradeItem'; slotId: SlotId; toItemId: FurnitureId }
  | { type: 'openRing'; ring: number }
  // Projects
  | { type: 'startProject'; category: ProjectCategory; name?: string }
  | { type: 'assign'; employeeId: EmployeeId; projectId: ProjectId | null }
  // Founder
  | { type: 'founderAction'; kind: FounderActionKind; targetId?: string }
  // Controls & growth
  | { type: 'setSpeed'; speed: GameSpeed }
  | { type: 'setAdBudget'; amount: number }
  | { type: 'setPrice'; multiplier: number }
  // Teaching & decisions
  | { type: 'openConcept'; conceptId: ConceptId }
  | { type: 'minimizeConcept'; conceptId: ConceptId }
  | { type: 'answerDecision'; cardId: DecisionCardId; optionIndex: number }
  // Fundraising
  /** `size` omitted = 'target' (12 months). `down`: the one-time down round after a failed round (GAMEPLAY V2 §6.3). */
  | { type: 'startRound'; size?: RoundSize; down?: boolean }
  /** This week's pitch of the running round (docs/CORE_LOOP.md §4.3). */
  | { type: 'roundPitch'; pitch: RoundPitch }
  /** The payday desk's answer (GAMEPLAY V2 §6.1); only while finance.pendingPayday waits. */
  | { type: 'resolvePayday'; choice: PaydayChoice }
  // Company
  /** Signs a policy of the Kanun Kitabı (GAMEPLAY V2 §7.2): one move, irreversible. */
  | { type: 'adoptPolicy'; policyId: PolicyId }
  // Market (GAMEPLAY V2 §8)
  /** Opens a market segment: one move, its cost now and its upkeep monthly; never closed again. */
  | { type: 'openSegment'; id: MarketSegmentId }
  /** Buys a rival (from Series B): two moves, its price now; its share of the market comes with it. */
  | { type: 'acquireRival'; id: string }

export type ActionType = Action['type']
export type ActionOf<T extends ActionType> = Extract<Action, { type: T }>

/** Replay log entry: seed + ordered TimedActions reproduce a run exactly. */
export interface TimedAction {
  atDay: number
  action: Action
}

// ---------------------------------------------------------------------------
// Engine API (implemented in src/engine/index.ts by the engine lane)
// ---------------------------------------------------------------------------

export interface NewGameOptions {
  seed: number
  founderXp?: number
  runIndex?: number
  /** Trimmed, collapsed and capped by the engine; blank → DEFAULT_COMPANY_NAME. */
  companyName?: string
}

export type ActionErrorCode =
  | 'insufficientCash' | 'noFreeSlot' | 'slotOccupied' | 'slotLocked' | 'wrongSlotType'
  | 'ringOrder' | 'noDesk' | 'notUnlocked' | 'cooldown' | 'noEnergy' | 'founderBusy' | 'notFound'
  | 'roundActive' | 'roundNotReady' | 'gameOver' | 'invalid' | 'engineNotConnected' | 'noMoves'

export interface ActionResult {
  state: GameState
  ok: boolean
  error?: ActionErrorCode
}

export interface EngineApi {
  createGame(opts: NewGameOptions): GameState
  /** Pure: must not mutate `state`. Same state + dt ⇒ same result. */
  step(state: GameState, dtDays: number): GameState
  /** Pure: must not mutate `state`. Invalid actions return ok:false and the unchanged state. */
  applyAction(state: GameState, action: Action): ActionResult
}
