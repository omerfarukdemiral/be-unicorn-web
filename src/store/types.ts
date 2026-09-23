// Store contract: the ONLY bridge between engine and render/ui.
// Render/UI read `state` via selectors and change it only through `dispatch(action)`.
import type { Action, ActionErrorCode, ActionResult, ConceptId, DecisionCardId, EmployeeId, FurnitureId, GameState, NewGameOptions, ProjectId, SlotId, TimedAction, VisitorId } from '../engine/types'

export type Selection =
  | { kind: 'slot'; id: SlotId }
  | { kind: 'employee'; id: EmployeeId }
  | { kind: 'project'; id: ProjectId }
  | { kind: 'visitor'; id: VisitorId }
  | { kind: 'founder' }

export type DockTab = 'shop' | 'team' | 'projects' | 'growth' | 'journal'

/** At most one blocking overlay at a time (PLAN §10). */
export type Overlay =
  | { kind: 'conceptCard'; conceptId: ConceptId }
  | { kind: 'decision'; cardId: DecisionCardId }
  | { kind: 'reflection'; cardId: DecisionCardId; optionIndex: number }
  | { kind: 'round' }
  | { kind: 'moveScene' }
  | { kind: 'postMortem' }
  | { kind: 'victory' }
  | { kind: 'settings' }

/** Pointer mode on the 3D floor. */
export type PlacingMode =
  | { kind: 'place'; itemId: FurnitureId }
  | { kind: 'move'; fromSlotId: SlotId }
  | { kind: 'seat'; employeeId: EmployeeId }

/** 0 = far (whole office), 1 = default, 2 = close. */
export type ZoomLevel = 0 | 1 | 2

export interface UiState {
  selection: Selection | null
  hoverSlotId: SlotId | null
  dockTab: DockTab | null
  overlay: Overlay | null
  placing: PlacingMode | null
  zoom: ZoomLevel
  /** Last rejected action, for a short inline error. `at` = performance.now(). */
  lastError: { code: ActionErrorCode; at: number } | null
  /** Highest GameEvent.id already consumed by effects (confetti, sounds). */
  lastSeenEventId: number
}

export interface GameStore {
  state: GameState
  ui: UiState
  /** Replay log for this run: seed + these actions reproduce it (PLAN §8.3). */
  replay: TimedAction[]

  // Engine bridge
  dispatch(action: Action): ActionResult
  /** Called by the loop with real elapsed seconds; advances in FIXED_STEP_DAYS chunks × speed. */
  tick(realDtSeconds: number): void
  newGame(opts?: Partial<NewGameOptions>): void
  save(): void
  /** Returns false if no compatible save exists. */
  load(): boolean

  // UI slice (never touches GameState)
  select(selection: Selection | null): void
  setHoverSlot(slotId: SlotId | null): void
  setDockTab(tab: DockTab | null): void
  openOverlay(overlay: Overlay): void
  closeOverlay(): void
  setPlacing(mode: PlacingMode | null): void
  setZoom(zoom: ZoomLevel): void
  markEventsSeen(eventId: number): void
}
