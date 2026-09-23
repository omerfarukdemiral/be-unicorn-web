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
export const SAVE_VERSION = 1

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
  createdDay: number
  assignedIds: EmployeeId[]
}

export interface EnterpriseCustomer {
  id: string
  name: string
  mrr: number
  sinceDay: number
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
}

// ---------------------------------------------------------------------------
// Finance & derived metrics
// ---------------------------------------------------------------------------

export interface BurnBreakdown {
  salaries: number
  rent: number
  infra: number
  ads: number
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
  /** Consecutive days with cash < 0 (game over at 60). */
  negativeCashDays: number
  /** Monthly ad spend, 0 until adBudget tool. */
  adBudget: number
  /** 0.7–1.6, player-set once priceControl unlocked. */
  priceMultiplier: number
  /** Day of last price increase (churn penalty lasts 30 days). */
  priceChangeDay?: number
  enterpriseCustomers: EnterpriseCustomer[]
  /** Bridge loan outstanding, if any. */
  debt: number
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
  valuationMultiple: number
  /** Monthly user inflow by channel (channelBreakdown widget). */
  channels: { organic: number; paid: number; manual: number; enterprise: number }
  /** Valuation / next stage target, 0–1+ (stage progress bar). */
  stageProgress: number
  canStartRound: boolean
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
  | { type: 'startRound' }

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
