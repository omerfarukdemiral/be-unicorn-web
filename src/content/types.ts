// Be Unicorn — content contract types. All player-facing text is Turkish and lives in content/.
// Ownership: content lane. Changes after scaffold must be ADDITIVE.
import type {
  ActivityKind,
  ConceptId,
  CrisisId,
  DecisionCardId,
  Dept,
  EffectBundle,
  FounderActionKind,
  FurnitureId,
  GameState,
  HudWidget,
  MilestoneId,
  NpcRole,
  OfficeLineId,
  PolicyId,
  PolicyKind,
  PostMortemCode,
  ProjectCategory,
  SlotType,
  StageBaseline,
  StageIndex,
  StageKey,
  ToolId,
} from '../engine/types'

// ---------------------------------------------------------------------------
// Concepts (PLAN §6.1 — kept verbatim, plus id typing)
// ---------------------------------------------------------------------------

export interface Concept {
  id: ConceptId
  /** Earliest stage it can appear. */
  stage: StageIndex
  /** Evaluated by the engine each day; fires at most once per run. */
  trigger: (s: GameState) => boolean
  speaker: NpcRole
  /** ≤ 12 words, conversational, blameless. */
  bubble: string
  card: {
    /** "Ne?" */
    what: string
    /** "Sen nerede gördün?" — filled with the player's own numbers. */
    where: (s: GameState) => string
    /** "Kural" */
    rule: string
  }
  /** Widget(s) or tool(s) opened when learned. */
  unlocks?: HudWidget | ToolId | readonly (HudWidget | ToolId)[]
  /** Book color on the bookshelf (CSS hex). */
  shelfColor: string
}

// ---------------------------------------------------------------------------
// Decision cards (PLAN §6.3)
// ---------------------------------------------------------------------------

export interface DecisionOption {
  label: string
  /** Visible trade-off under the option: kazanç / bedel. */
  tradeoff: { gain: string; cost: string }
  effects: EffectBundle
  /** Delayed consequence (PLAN: "bazı kararların etkisi gecikmeli gelir"). */
  delayed?: { days: number; effects: EffectBundle; note?: string }
  /** ≤ 1 sentence, non-judgmental reflection after choosing. */
  reflection: string
  /** Links the reflection to a Defter card. */
  conceptId?: ConceptId
}

/** 'thread': a step of a card thread (GAMEPLAY V2 §9.2). */
export type DecisionCategory = 'normal' | 'crisis' | 'rival' | 'thread'

/** Card threads (GAMEPLAY V2 §9.2): recurring characters whose cards follow each other. */
export const THREAD_IDS = ['mentor', 'investor', 'customer', 'rival', 'press'] as const
export type ThreadId = (typeof THREAD_IDS)[number]

/**
 * A card's place in a thread: step > 1 waits for the thread's step − 1 card in the history; `after` (option indexes of
 * that step) narrows it to the branch the player took. At most one card per thread per stage.
 */
export interface CardThread {
  id: ThreadId
  step: number
  after?: readonly number[]
}

export interface DecisionCard {
  id: DecisionCardId
  /** Earliest stage. */
  stage: StageIndex
  /** Latest stage (inclusive); omit = no limit. */
  maxStage?: StageIndex
  category: DecisionCategory
  speaker: NpcRole
  /** ≤ 2 sentences. */
  question: string
  /** 2 options, sometimes 3. */
  options: DecisionOption[]
  /** Extra gating on top of stage. */
  condition?: (s: GameState) => boolean
  /** Relative pick weight, default 1. */
  weight?: number
  /** Default true: card shown at most once per run. */
  once?: boolean
  /**
   * Option applied if the card stays unanswered for DECISION_DEFAULT_AFTER_DAYS ("Cevapsız kalırsa: A").
   * Omitted = the last option (usually the cautious one).
   */
  defaultOption?: number
  /** Days before the default applies (crisis / rescue cards are short); omitted = DECISION_DEFAULT_AFTER_DAYS. */
  defaultAfterDays?: number
  /** Thread step (GAMEPLAY V2 §9.2); thread cards weigh THREAD_CARD_WEIGHT unless `weight` says otherwise. */
  thread?: CardThread
  /** A secret card (GAMEPLAY V2 §9.2): rare, deterministic, counted by the discovery grid. */
  secret?: boolean
}

// ---------------------------------------------------------------------------
// Crisis calendar (GAMEPLAY V2 §5.1)
// ---------------------------------------------------------------------------

export interface CrisisDef {
  id: CrisisId
  /** The stage whose pool it belongs to (drawn on the reveal day from the then-current stage). */
  stage: StageIndex
  /** Horizon name, ≤ 6 words. */
  name: string
  /** Mitigation card brought on the crisis day (category 'crisis', 2 options). */
  cardId: DecisionCardId
  /**
   * What hits on the crisis day at `severity` (≈ 0.7–1.3): modifiers scale as 1 + (v − 1) × severity. Pure; reads the
   * state for sizes (rent, burn).
   */
  effects: (s: GameState, severity: number) => EffectBundle
  /**
   * The remedy is in place: this storm cannot hit again (the reveal skips it, also as the lighter repeat). Missing =
   * never settled.
   */
  settled?: (s: GameState) => boolean
}

// ---------------------------------------------------------------------------
// Company policies / Kanun Kitabı (GAMEPLAY V2 §7.2)
// ---------------------------------------------------------------------------

/** 'org': the management policy (no tree of its own; it opens with the head count). */
export type PolicyTree = 'growth' | 'craft' | 'survival' | 'org'

/** What a signed policy does, for good. Every term is optional; the engine multiplies / adds over the signed ones. */
export interface PolicyEffect {
  mult?: Partial<Record<PolicyKind, number>>
  /** Added to the morale target. */
  moraleTarget?: number
  /** Weekly moves added (negative: taken). */
  movesBonus?: number
  /** Candidates added to the hiring pool. */
  candidates?: number
  /** Ceiling on a new candidate's quality (salary-freeze: no stars apply). */
  qualityCap?: number
  /** No yearly market raise (GAMEPLAY V2 §4.2). */
  noRaises?: true
  /** Tech debt added every payday. */
  techDebtMonthly?: number
  /** Burn multiple the investor tolerates on top of the stage's ask (due diligence). */
  burnAsk?: number
  /** The 'salary' multiplier is wages held back, not saved: owed and paid when the next round closes. */
  payLater?: true
  /** Share of the team let go on signing (lowest quality first). */
  layoff?: number
  /** One-off effects on signing (reputation, a timed morale target…). */
  onSign?: EffectBundle
  /** Flag set to the signing day (threads read it, e.g. crunch-culture → founder-burnout). */
  flagDay?: string
}

/** A policy's lock: 'runway' below `value` months, 'stage' / 'team' / 'profitMonths' at least `value`; 'crisis' adds an
 * earlier way in (lease-hike's remote option). */
export interface PolicyLock {
  metric: 'runway' | 'stage' | 'team' | 'profitMonths'
  value: number
  crisis?: string
}

export interface Policy {
  id: PolicyId
  tree: PolicyTree
  tier: 1 | 2 | 3
  /** Name, ≤ 6 words. */
  name: string
  /** What it does, ≤ 12 words (the lawbook card). */
  text: string
  /** Pure: can it be signed now. */
  unlock: (s: GameState) => boolean
  /** The lock as a number for the lawbook card (runway below / stage at least / team at least / profit months). */
  lock: PolicyLock
  /** Signed together never: either one closes the other. */
  excludes?: readonly PolicyId[]
  effect: PolicyEffect
}

// ---------------------------------------------------------------------------
// Furniture (~30 items, PLAN §3.3)
// ---------------------------------------------------------------------------

export type PrimitiveKind = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'capsule'
export type ColorRole = 'primary' | 'secondary' | 'accent'

/** Procedural geometry hint, in cell units (1 cell = 1×1 footprint, y up, origin = cell center on floor). */
export interface PrimitiveHint {
  kind: PrimitiveKind
  /** box: [w,h,d]; cylinder/cone: [radius, height, radius]; sphere: [radius, radius, radius]; torus: [radius, tube, _]; capsule: [radius, length, radius]. */
  size: [number, number, number]
  pos: [number, number, number]
  /** Euler radians. */
  rot?: [number, number, number]
  /** A palette role of the item, or a literal CSS color. */
  color: ColorRole | string
}

export interface FurnitureEffects {
  /** Morale target bonus to adjacent desks (+3..+8, PLAN §3.4). */
  moraleAura?: number
  /** Desk quality multiplier on the occupant's output (e.g. 1.0 / 1.15 / 1.3). */
  deskQuality?: number
  /** Additive global output bonus per dept (0.05 = +5%). */
  deptBonus?: Partial<Record<Dept, number>>
  /** Server capacity multiplier. */
  capacityMult?: number
  /** Infra cost multiplier (server room 0.8). */
  infraMult?: number
  /** Meeting room: removes coordination penalty. */
  coordinationFix?: boolean
  /** Small global morale bonus (bookshelf etc.). */
  globalMorale?: number
  /** Reputation bonus (one-off when placed, or ongoing — engine decides & documents). */
  reputation?: number
  /** Concept learning / maturity helpers. */
  maturityBonus?: number
  /** Enables enterprise sales, demo stage etc. */
  enablesTool?: ToolId
}

export interface FurnitureItem {
  id: FurnitureId
  /** Turkish display name. */
  name: string
  /** Turkish one-liner. */
  description: string
  slotType: SlotType
  size: 1 | 2
  tier: 1 | 2 | 3
  price: number
  /** Monthly upkeep added to burn (optional). */
  upkeep?: number
  stageUnlock: StageIndex
  /** Desks only: which dept it suits; omit = any. */
  dept?: Dept
  /** Upgrade path (desk basic → ergonomic → dual screen). */
  upgradesTo?: FurnitureId
  effects: FurnitureEffects
  visual: {
    /** Semantic hint for a hand-built mesh in render (e.g. 'desk', 'deskDual', 'plant', 'coffee', 'serverRack'). */
    shape: string
    primitives?: PrimitiveHint[]
    colors: { primary: string; secondary?: string; accent?: string }
  }
}

// ---------------------------------------------------------------------------
// Office ambient lines (PLAN §6.4)
// ---------------------------------------------------------------------------

export type OfficeLineTrigger =
  | 'hire' | 'fire' | 'resign' | 'milestone' | 'crisisResolved' | 'idle' | 'lowMorale' | 'highMorale'
  | 'profit' | 'launch' | 'roundStarted' | 'roundClosed' | 'stageUp' | 'overload' | 'lowRunway'

export interface OfficeLine {
  id: OfficeLineId
  trigger: OfficeLineTrigger
  /** Who says it: an NPC role, an employee of a dept, 'anyEmployee' or 'founder'. */
  speaker: NpcRole | Dept | 'anyEmployee' | 'founder'
  /** ≤ 12 words. */
  text: string
  /** For 'milestone' lines. */
  milestone?: MilestoneId
  minStage?: StageIndex
  maxStage?: StageIndex
  /** Situational gating, e.g. no runway panic while profitable. */
  condition?: (s: GameState) => boolean
}

// ---------------------------------------------------------------------------
// Stages (PLAN §3.1 table)
// ---------------------------------------------------------------------------

export interface StageDef {
  index: StageIndex
  key: StageKey
  /** "Garaj", "Pre-seed", ... */
  name: string
  /** "Garaj", "Coworking köşesi", ... */
  officeName: string
  /** Ring count of this stage's office (0 for Unicorn campus = final scene). */
  rings: number
  totalSlots: number
  /** Valuation needed to reach THIS stage (null for Garaj). */
  targetValuation: number | null
  /** Round raised to enter this stage. */
  roundAmount: number | null
  /** Equity sold in that round (fraction). */
  roundEquity: number | null
  /** Slot type first available at this stage. */
  newSlotType?: SlotType
  /** Tools unlocked on arrival. */
  unlockTools?: ToolId[]
  /** Turkish summary of what opens ("Açılan yeni şey"). */
  unlocksText: string
  /** Palette key for render/palette.ts (floor & wall tones per office, PLAN §7.1). */
  paletteKey?: StagePaletteKey
  /** Founder actions first available at this stage (PLAN §4.4). */
  unlockActions?: FounderActionKind[]
  /** Short Turkish tagline for the move / stage-up scene. */
  tagline?: string
}

/** Office look per stage: garage concrete grey → campus warm wood. */
export type StagePaletteKey = 'concrete' | 'cowork' | 'smallOffice' | 'openPlan' | 'twoFloor' | 'tower' | 'campus'

// ---------------------------------------------------------------------------
// Text tables (keyed so EN can be added later)
// ---------------------------------------------------------------------------

/** Activity line templates with {param} placeholders. */
export type ActivityTextTable = Record<ActivityKind, string>

export type PostMortemTextTable = Record<PostMortemCode, string>

export type DeptTextTable = Record<Dept, { name: string; short: string }>
export type ProjectCategoryTextTable = Record<ProjectCategory, { name: string; description: string }>
export type NpcTextTable = Record<NpcRole, { name: string; title: string }>

/** Everything the content lane exports from src/content/index.ts. */
/** Optional stage goal (☆, docs/CORE_LOOP.md §4.3). The ★ goal is always the next stage's valuation. */
export interface StageGoal {
  id: string
  stage: StageIndex
  /** Short imperative, ≤ 8 words. */
  text: string
  /** One line: why it matters / how. */
  hint: string
  /**
   * Pure: reached right now? The engine latches the first true (goalsDone). `base` is where the stage started
   * (state.stageStart), so a goal measures progress made in this stage, not what was carried in.
   */
  check: (s: GameState, base: StageBaseline) => boolean
}

export interface ContentBundle {
  stages: readonly StageDef[]
  concepts: readonly Concept[]
  decisions: readonly DecisionCard[]
  furniture: readonly FurnitureItem[]
  officeLines: readonly OfficeLine[]
  employeeNames: readonly string[]
  activityText: ActivityTextTable
  postMortemText: PostMortemTextTable
  deptText: DeptTextTable
  projectCategoryText: ProjectCategoryTextTable
  npcText: NpcTextTable
  /** Generic UI strings, key → Turkish text (with {param} placeholders). */
  uiText: Record<string, string>
  /** Optional stage goals (☆). */
  goals?: readonly StageGoal[]
  /** Crisis calendar pool (GAMEPLAY V2 §5.1); optional so engine fakes run without it. */
  crises?: readonly CrisisDef[]
  /** Company policies, the Kanun Kitabı (GAMEPLAY V2 §7.2); optional so engine fakes run without it. */
  policies?: readonly Policy[]
}
