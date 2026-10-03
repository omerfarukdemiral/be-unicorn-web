// Store contract: the ONLY bridge between engine and render/ui.
// Render/UI read `state` via selectors and change it only through `dispatch(action)`.
import type { Action, ActionErrorCode, ActionResult, ConceptId, DecisionCardId, EmployeeId, GameState, HudWidget, NewGameOptions, ProjectId, SlotId, TimedAction, VisitorId } from '../engine/types'

export type Selection =
  | { kind: 'slot'; id: SlotId }
  | { kind: 'employee'; id: EmployeeId }
  | { kind: 'project'; id: ProjectId }
  | { kind: 'visitor'; id: VisitorId }
  | { kind: 'founder' }

export type DockTab = 'shop' | 'team' | 'projects' | 'growth' | 'metrics' | 'journal'

/**
 * The single right panel (bottom sheet on phones). Dock tabs, scene selections, Defter cards,
 * decisions and settings all live here: opening one replaces the other, the scene stays visible.
 */
export type Panel =
  /** `slotTarget`: an empty slot was tapped, a purchase goes there (filtered to its type). */
  | { kind: 'shop'; slotTarget?: SlotId }
  | { kind: 'team' }
  | { kind: 'projects' }
  /** `section: 'round'` scrolls to the funding round block. */
  | { kind: 'growth'; section?: 'round' }
  /** Metrikler (docs/LAYOUT.md §5): every unlocked secondary gauge. `focus` scrolls to that card and highlights it. Never pauses. */
  | { kind: 'metrics'; focus?: HudWidget }
  /** `conceptId`: that Defter card is shown on top of the shelf. */
  | { kind: 'journal'; conceptId?: ConceptId }
  | { kind: 'detail'; selection: Selection }
  /** `answered`: option picked, the panel shows the reflection. */
  | { kind: 'decision'; cardId: DecisionCardId; answered?: number }
  | { kind: 'settings' }
  /** Unicorn yolu: the 7 stages (office, target, round, what opens). Opened from the top-bar stepper. */
  | { kind: 'roadmap' }
  /** Liderlik: the live leaderboard (L, top-bar trophy). Polls every 10 s while open. */
  | { kind: 'leaderboard' }

export type PanelKind = Panel['kind']

/** Tabs of the center statistics screen (docs/GAMEPLAY_V2.md §14.5). */
export type StatsTab = 'money' | 'growth' | 'team' | 'profile'

/**
 * Centered surfaces. Move scene / post-mortem / victory are blocking modals (they pause the game). The center screens
 * (CENTER_KINDS: statistics, Kanun Kitabı, Pazar haritası) sit in the CenterFrame between the bars and never pause:
 * time keeps flowing while the player reads (docs/GAMEPLAY_V2.md §14.1). The payday desk (§6.1) holds time only while
 * it is open AND a month waits on it (its own `payday` pause, not `modal`); "Sonra" closes it and time flows.
 */
export type Overlay =
  | { kind: 'moveScene' }
  | { kind: 'payday' }
  | { kind: 'postMortem' }
  | { kind: 'victory' }
  | { kind: 'stats'; tab?: StatsTab }
  | { kind: 'lawbook' }
  | { kind: 'market' }

export type OverlayKind = Overlay['kind']
export type CenterKind = 'stats' | 'lawbook' | 'market'

/** Overlays shown in the CenterFrame: no pause, one surface with the panel (opening one closes the other). */
export const CENTER_KINDS: ReadonlySet<OverlayKind> = new Set<CenterKind>(['stats', 'lawbook', 'market'])

/** Pointer mode on the 3D floor. Buying places automatically (no place mode). */
export type PlacingMode = { kind: 'move'; fromSlotId: SlotId } | { kind: 'seat'; employeeId: EmployeeId }

/** Screen px covered by UI along each edge (open panel / sheet, phone HUD). The camera frames the office in the rest. */
export interface SceneInset {
  top: number
  right: number
  bottom: number
}

/**
 * Automatic focus pauses: a blocking modal (never a center screen), an unanswered decision card open in the panel or
 * expanded in the scene bubble (ui.decisionExpanded), a Defter (concept) card open in the panel, the round offer
 * (`offer`: Büyüme › Tur `{kind:'growth', section:'round'}`, the only view that draws the size picker, while a size
 * choice or a weekly pitch waits), or the payday desk open while finance.pendingPayday waits (`payday`, GAMEPLAY V2
 * §3 md.6). Shop / team / projects panels and the plain Büyüme hub never pause; a concept arriving never pauses.
 */
export type PauseReason = 'modal' | 'decision' | 'concept' | 'offer' | 'payday'

/**
 * Keşif (docs/GAMEPLAY_V2.md §9.2, §12): decision cards ever shown and threads whose last step came, across runs.
 * Outside the engine and outside keptUi: its own localStorage key 'be-unicorn:codex' (PLAN §1: no meta progress).
 */
export interface Codex {
  seenCards: string[]
  threadsDone: string[]
}

/** 0 = far (whole office), 1 = default, 2 = close. */
export type ZoomLevel = 0 | 1 | 2

export interface UiState {
  /** The one open panel (null = scene only). */
  panel: Panel | null
  /** One level of history for the panel's back button. */
  panelBack: Panel | null
  hoverSlotId: SlotId | null
  overlay: Overlay | null
  placing: PlacingMode | null
  zoom: ZoomLevel
  /** Last rejected action, for a short inline error. `at` = performance.now(). */
  lastError: { code: ActionErrorCode; at: number } | null
  /**
   * Why the world is held still right now, besides the player's own speed (state.time.speed).
   * Derived from panel/overlay by the store: empty = time flows at state.time.speed.
   * Never written as setSpeed (replay/save keep the player's speed).
   */
  pauseReasons: readonly PauseReason[]
  /** False until the player first sets a speed > 0 in this session (new game / continue start paused). */
  runStarted: boolean
  /** Bumped by newGame()/load(): event consumers skip the loaded history. */
  generation: number
  /** Area hidden by the panel (set by ui RightPanel, read by render CameraRig). */
  sceneInset: SceneInset
  /** The scene decision bubble is expanded (the player is reading the card there): a `decision` focus pause. */
  decisionExpanded: boolean
  /** "Önemli anda yavaşla": at 4× an important moment drops the speed to 1× (never pauses), and returns to 4× after the moment. Default on. */
  slowOnMoments: boolean
  /** performance.now() of the last automatic 4× → 1× slowdown (UI shows a short note), null = none yet. */
  slowdownAt: number | null
  /** Game day the automatic slowdown hands 4× back (null = no restore pending; the player's own setSpeed clears it). */
  slowdownResumeDay: number | null
  /**
   * Gauges pinned to the top bar (docs/LAYOUT.md §5.2): at most PIN_MAX, oldest first. A pin whose gauge is locked
   * (e.g. a new run) is not shown but keeps its place. Persisted in localStorage 'be-unicorn:ui'.
   */
  pinnedMetrics: HudWidget[]
  /** Gauges already seen in Metrikler; the other unlocked, pinnable ones count as "new" (Dock badge, "Yeni" tag). */
  seenMetrics: HudWidget[]
  /** The player pinned or unpinned by hand at least once: automatic pinning of new gauges stops. */
  pinTouched: boolean
  /** Stage goals (☆ ids) already seen in Kazanımlar; the other done ones count on the achievements badge. */
  seenGoals: string[]
  /** Keşif grid (cards seen, threads done over every run); read from 'be-unicorn:codex', written by afterStep. */
  codex: Codex
}

/** Seed + ordered actions of the current run (PLAN §8.3 reproducible bug reports). */
export interface ReplayLog {
  seed: number
  runIndex: number
  /** True when the log starts from a loaded save instead of day 0. */
  fromSave: boolean
  actions: TimedAction[]
}

export interface GameStore {
  state: GameState
  ui: UiState

  // Engine bridge
  dispatch(action: Action): ActionResult
  /** Called by the loop with real elapsed seconds; advances in FIXED_STEP_DAYS chunks × speed. */
  tick(realDtSeconds: number): void
  newGame(opts?: Partial<NewGameOptions>): void
  save(): void
  /** Returns false if no compatible save exists. The loaded run starts paused (the player presses Başlat). */
  load(): boolean
  /** Replay log of this run (kept outside reactive state). Dev builds expose it as window.__replay(). */
  exportReplay(): ReplayLog

  // UI slice (never touches GameState)
  /** Scene / list selection → detail panel. An empty open slot opens the shop targeted at it. null leaves a detail panel (back, or close). */
  select(selection: Selection | null): void
  /** Opens `panel` in the single panel. `root` (dock tabs) clears history; `replace` keeps the current back entry. */
  openPanel(panel: Panel, opts?: { root?: boolean; replace?: boolean }): void
  /** Dock tab: opens it, or closes the panel when that tab is already open. */
  togglePanel(tab: DockTab): void
  closePanel(): void
  /** Back to the previous panel content (if any). */
  panelGoBack(): void
  setHoverSlot(slotId: SlotId | null): void
  /** A center screen (CENTER_KINDS) closes the panel; a blocking modal keeps it under the backdrop. */
  openOverlay(overlay: Overlay): void
  closeOverlay(): void
  /** Center screen toggle (shortcuts, top-bar icons): opens it, or closes it when it is already open. */
  toggleCenter(kind: CenterKind): void
  setPlacing(mode: PlacingMode | null): void
  setZoom(zoom: ZoomLevel): void
  setSceneInset(inset: SceneInset): void
  /** Scene decision bubble expanded / collapsed (focus pause while expanded). */
  setDecisionExpanded(expanded: boolean): void
  /** Settings: slow 4× down to 1× on important moments. */
  setSlowOnMoments(on: boolean): void
  /** Pins a gauge to the top bar. Already pinned = no-op; with PIN_MAX pinned one locked in this run leaves first, else the OLDEST. Sets pinTouched. */
  pinMetric(id: HudWidget): void
  /** Removes a pin. Sets pinTouched. */
  unpinMetric(id: HudWidget): void
  /** Metrikler showed these gauges: they stop counting as new. */
  markMetricsSeen(ids: readonly HudWidget[]): void
  /** Kazanımlar was opened: every goal done so far stops counting on the badge. */
  markGoalsSeen(): void
}
