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
export const SAVE_VERSION = 3

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

/** Active founder actions (PLAN §4.4). 'rest' recovers energy. */
export const FOUNDER_ACTIONS = ['findUsers', 'talkToUsers', 'motivateTeam', 'investorCoffee', 'salesCall', 'rest'] as const
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
export const TOOL_IDS = ['priceControl', 'adBudget', 'enterpriseSales', 'capTableView'] as const
export type ToolId = (typeof TOOL_IDS)[number]

// ---------------------------------------------------------------------------
// Ids (plain strings, documented for readability)
// ---------------------------------------------------------------------------

export type SlotId = string // 'founder' for the fixed center desk, else e.g. 'r2-s5'
export type EmployeeId = string
export type ProjectId = string
export type VisitorId = string
export type FurnitureId = string // FurnitureItem.id from content
export type DecisionCardId = string // DecisionCard.id from content
export type OfficeLineId = string

export const FOUNDER_SLOT_ID: SlotId = 'founder'

// ---------------------------------------------------------------------------
// Effects (shared by decisions, concepts, furniture, founder actions)
// ---------------------------------------------------------------------------

export type ModifierKind = 'churn' | 'arpu' | 'production' | 'morale' | 'cac' | 'organic' | 'roundSpeed'

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
  /** Monthly salary in $, fixed at hire (stage multiplier applied then; see DECISIONS.md). */
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

/** Due-diligence checks (docs/CORE_LOOP.md §4.3): runway ≥ months, MoM ≥ fraction, morale ≥ points. */
export type DiligenceId = 'runway' | 'growth' | 'morale'

export interface DiligenceItem {
  id: DiligenceId
  target: number
  /** Current value (runway null = profitable → counts as met, stored as target). */
  value: number
  met: boolean
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
  /** Can be picked now (energy). */
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
  /** Costs paid on payday (salaries + rent + infra + ads + founder). */
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
  /** Bridge loan outstanding, if any. */
  debt: number
  /** Costs accrue daily and are paid in one lump on payday (day % 30 === 0, the 1st of the month). */
  ledger?: MonthLedger
  /** Last payday's receipt. */
  lastReceipt?: MonthReceipt
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
}

/** Valuation breakdown (docs/CORE_LOOP.md §4.3 "çarpan dökümü"): engine computed, the UI only prints it. */
export interface ValuationBreakdown {
  /** 'pre': team × $40K + users × $150 + launched × $100K; 'post': MRR × 12 × multiple (blended in below $1K MRR). */
  mode: 'pre' | 'post'
  team: number
  users: number
  launched: number
  /** Pre-revenue parts in dollars. */
  teamValue: number
  usersValue: number
  launchedValue: number
  mrr: number
  multiple: number
  /** 3-month average MoM the multiple prices, and the stage's ceiling. */
  momAvg: number
  cap: number
  /** Share of the post-revenue formula counted (mrr / PRE_REVENUE_MRR, max 1). */
  blend: number
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

/** Main chain: idea → first users → desk → hire → release → users → team (pre-revenue valuation) → round. */
export const NEXT_STEP_IDS = ['idea', 'findUsers', 'desk', 'hire', 'launch', 'users', 'revenue', 'team', 'round', 'roundWait', 'grow'] as const
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
  /** 'team': valuation one more hire adds, and runway (months) today → after that hire. */
  value?: number
  runwayNow?: number | null
  runwayAfter?: number | null
}

export type HorizonKind = 'payday' | 'delayed' | 'release' | 'roundClose' | 'roundReady'

export interface HorizonItem {
  kind: HorizonKind
  /** Game day it lands (estimate for releases and round close). */
  day: number
  /** Payday: projected costs. */
  amount?: number
  cardId?: DecisionCardId
  optionIndex?: number
  noteKey?: string
  projectId?: ProjectId
  /** Release level it would reach. */
  level?: number
  /** Update number (after 1.0), when the release is an update. */
  update?: number
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
  | 'peakTeam' | 'lowGrowthMonths' | 'profitMonths'

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
  /** `size` omitted = 'target' (18 months). */
  | { type: 'startRound'; size?: RoundSize }
  /** This week's pitch of the running round (docs/CORE_LOOP.md §4.3). */
  | { type: 'roundPitch'; pitch: RoundPitch }

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
  | 'roundActive' | 'roundNotReady' | 'gameOver' | 'invalid' | 'engineNotConnected'

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
