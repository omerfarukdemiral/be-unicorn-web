// zustand store: the only bridge between the pure engine and render/ui.
// dispatch → engine.applyAction; tick → fixed engine steps (FIXED_STEP_DAYS) scaled by the effective speed
// (time.speed = the player's choice, held at 0 while any ui.pauseReasons is active: modal, decision, concept card,
// round offer / pitch, the payday desk open on a waiting month; a center screen never holds it).
// After each tick: a new concept goes straight to the Kazanımlar badge (no scene bubble), an interrupting event closes
// the center screen, and at 4× an important moment slows the run to 1× (docs/GAMEPLAY_V2.md §3.6, §12).
import { create } from 'zustand'
import { applyAction, createGame, step } from '../engine'
import { FIXED_STEP_DAYS, FOUNDER_SLOT_ID, INITIAL_WIDGETS, SECONDS_PER_DAY, type Action, type ConceptId, type GameEventKind, type GameSpeed, type GameState, type NewGameOptions } from '../engine/types'
import { clearSave, readProfile, readSave, readUiSave, writeProfile, writeSave, writeUiSave } from './save'
import { addPin, autoPin, defaultPins, removePin } from './metricPins'
import { CENTER_KINDS, type GameStore, type Overlay, type Panel, type PauseReason, type ReplayLog, type Selection, type UiState } from './types'

export { SAVE_KEY } from './save'

/** Upper bound of engine days advanced by one tick (keeps a hitch from fast-forwarding). */
const MAX_DAYS_PER_TICK = 4

const NO_INSET = { top: 0, right: 0, bottom: 0 }

/**
 * Events that interrupt a center screen: it closes so no card or payday desk is hidden behind it (and 4× drops to 1×).
 * docs/GAMEPLAY_V2.md §3.6.
 */
const INTERRUPTS: readonly GameEventKind[] = [
  'decisionShown',
  'paydayShort',
  'crisis',
  // The early round window opening is the "tur teklifi" moment.
  'roundWindow',
  // Payroll could not be paid: the bankruptcy clock started (phase 3).
  'payrollMissed',
  'roundFailed',
  'loanCalled',
]
export const INTERRUPT_EVENT_KINDS: ReadonlySet<GameEventKind> = new Set<GameEventKind>(INTERRUPTS)

/** Events that are worth watching at 1×: at 4× they slow the run down (never pause). */
export const IMPORTANT_EVENT_KINDS: ReadonlySet<GameEventKind> = new Set<GameEventKind>([
  ...INTERRUPTS,
  // A crisis showing what it is (GAMEPLAY V2 §5.1): the player plans around it.
  'crisisRevealed',
  'projectLaunched',
  'milestone',
  'bankruptWarning',
  'roundClosed',
  'release',
])

/** A payday that leaves less than this many months of runway is an important moment too (docs/CORE_LOOP.md §3.2). */
export const PAYDAY_SLOW_RUNWAY_MONTHS = 3

/**
 * True when `next` brought an event that should slow 4× down to 1× (see IMPORTANT_EVENT_KINDS), with two edges so
 * 4× is not dropped every ~25 s (review fix):
 * - a release only for a new version, not for the updates after 1.0;
 * - a payday only when runway CROSSES below PAYDAY_SLOW_RUNWAY_MONTHS, not on every tight month.
 * Every decision card counts (the card budget keeps them rare, docs/GAMEPLAY_V2.md §3.11).
 */
export function hasImportantMoment(prev: GameState, next: GameState): boolean {
  const since = lastEventId(prev)
  for (const e of next.events) {
    if (e.id <= since) continue
    if (e.kind === 'release') {
      if (next.releases?.find((r) => r.id === e.refId)?.update === undefined) return true
      continue
    }
    if (IMPORTANT_EVENT_KINDS.has(e.kind)) return true
    if (e.kind === 'payday') {
      const rc = next.finance.lastReceipt
      const after = rc ? rc.runwayAfter : next.finance.runway
      const before = rc ? rc.runwayBefore : null
      if (after !== null && after < PAYDAY_SLOW_RUNWAY_MONTHS && (before === null || before >= PAYDAY_SLOW_RUNWAY_MONTHS)) return true
    }
  }
  return false
}

/** True when `next` brought an event that closes an open center screen (INTERRUPT_EVENT_KINDS). */
export function hasInterrupt(prev: GameState, next: GameState): boolean {
  const since = lastEventId(prev)
  return next.events.some((e) => e.id > since && INTERRUPT_EVENT_KINDS.has(e.kind))
}

/** Stable empty list (older saves have no goalsDone). */
const NO_GOALS: readonly string[] = []

/** Concepts waiting to be read: the one just arrived plus the minimized ones, never a learned one. */
export function waitingConcepts(s: GameState): ConceptId[] {
  const c = s.concepts
  const out = c.minimized.filter((id) => !c.learned.includes(id))
  if (c.active && !c.learned.includes(c.active.id) && !out.includes(c.active.id)) out.push(c.active.id)
  return out
}

/** Kazanımlar badge (docs/GAMEPLAY_V2.md §12): concepts waiting to be read + stage goals done since last opened. */
export function achievementsBadge(s: GameState, seenGoals: readonly string[]): number {
  const done = s.goalsDone ?? NO_GOALS
  return waitingConcepts(s).length + done.filter((id) => !seenGoals.includes(id)).length
}

const initialUi = (saved = readUiSave()): UiState => ({
  panel: null,
  panelBack: null,
  hoverSlotId: null,
  overlay: null,
  placing: null,
  zoom: 1,
  lastError: null,
  pauseReasons: [],
  runStarted: false,
  generation: 0,
  sceneInset: NO_INSET,
  decisionExpanded: false,
  slowOnMoments: true,
  slowdownAt: null,
  pinnedMetrics: saved.pinnedMetrics ?? [],
  seenMetrics: saved.seenMetrics ?? [...INITIAL_WIDGETS],
  pinTouched: saved.pinTouched ?? false,
  seenGoals: saved.seenGoals ?? [],
})

/** UI fields that survive newGame()/load() (player preferences of this session, top-bar pins included). */
const keptUi = (ui: UiState): Pick<UiState, 'zoom' | 'slowOnMoments' | 'generation' | 'pinnedMetrics' | 'pinTouched'> => ({
  zoom: ui.zoom,
  slowOnMoments: ui.slowOnMoments,
  generation: ui.generation + 1,
  pinnedMetrics: ui.pinnedMetrics,
  pinTouched: ui.pinTouched,
})

/** Writes the UI profile (pins, seen gauges, seen goals) to localStorage 'be-unicorn:ui'. */
function persistUi(ui: UiState): void {
  writeUiSave({ pinnedMetrics: ui.pinnedMetrics, seenMetrics: ui.seenMetrics, pinTouched: ui.pinTouched, seenGoals: ui.seenGoals })
}

/**
 * Automatic pinning (docs/LAYOUT.md §5.2): a gauge unlocked by this step fills a free top-bar slot until the player
 * pins or unpins by hand. Keeps the old UiState when nothing changed.
 */
function withAutoPins(ui: UiState, prev: GameState, next: GameState): UiState {
  if (ui.pinTouched || next.unlockedWidgets.length === prev.unlockedWidgets.length) return ui
  const fresh = next.unlockedWidgets.filter((id) => !prev.unlockedWidgets.includes(id))
  const pins = autoPin(ui.pinnedMetrics, fresh, next.unlockedWidgets)
  if (pins === ui.pinnedMetrics) return ui
  const out = { ...ui, pinnedMetrics: pins }
  persistUi(out)
  return out
}

/**
 * A round choice waits for the player: the early window is open (size chooser) or this week's pitch is due
 * (docs/CORE_LOOP.md §4.3). Read with the Tur section open, it is the `offer` focus pause.
 */
export function offerWaiting(s: GameState): boolean {
  const r = s.round
  if (r?.active) return r.pitchDue !== undefined
  return s.derived.canStartRound && !s.gameOver
}

/**
 * The open overlay when it is a blocking modal; null for none, a center screen (time flows under those) or the payday
 * desk (it holds time through its own `payday` reason, only while a month waits on it).
 */
export function blockingOverlay(ui: Pick<UiState, 'overlay'>): Overlay | null {
  return ui.overlay && !CENTER_KINDS.has(ui.overlay.kind) && ui.overlay.kind !== 'payday' ? ui.overlay : null
}

/** GAMEPLAY V2 §6.1: the payday desk is open on a month waiting on it (the `payday` pause). */
export function paydayDeskOpen(ui: Pick<UiState, 'overlay'>, state?: GameState): boolean {
  return ui.overlay?.kind === 'payday' && !!state?.finance.pendingPayday && !state.gameOver
}

/** True when a center screen (statistics, Kanun Kitabı, Pazar haritası) is open. */
export function centerOpen(ui: Pick<UiState, 'overlay'>): boolean {
  return !!ui.overlay && CENTER_KINDS.has(ui.overlay.kind)
}

/**
 * Focus pauses implied by what is open (one mechanism for modals, decision cards, Defter cards and round offers).
 * A center screen is not one: it shows, it does not ask for a decision (docs/GAMEPLAY_V2.md §14.1).
 * `concept` holds only while the card itself is open; a concept arriving never pauses.
 */
export function pauseReasonsOf(ui: Pick<UiState, 'overlay' | 'panel'> & { decisionExpanded?: boolean }, state?: GameState): PauseReason[] {
  const r: PauseReason[] = []
  if (blockingOverlay(ui)) r.push('modal')
  const p = ui.panel
  if ((p?.kind === 'decision' && p.answered === undefined) || ui.decisionExpanded) r.push('decision')
  if (p?.kind === 'journal' && p.conceptId) r.push('concept')
  if (p?.kind === 'growth' && p.section === 'round' && state && offerWaiting(state)) r.push('offer')
  if (paydayDeskOpen(ui, state)) r.push('payday')
  return r
}

/** The payday desk stays open only while a month waits on it (answered or defaulted → it closes). */
function withDesk(ui: UiState, state: GameState): UiState {
  return ui.overlay?.kind === 'payday' && !state.finance.pendingPayday ? { ...ui, overlay: null } : ui
}

/** Recomputes ui.pauseReasons after a panel/overlay/state change; keeps the old UiState when nothing changed. */
function withPause(ui: UiState, state: GameState): UiState {
  const next = pauseReasonsOf(ui, state)
  const cur = ui.pauseReasons
  if (next.length === cur.length && next.every((x, i) => x === cur[i])) return ui
  return { ...ui, pauseReasons: next }
}

/** Speed the world actually runs at: the player's speed unless a focus pause holds it (or the run is over). */
export function effectiveSpeed(st: { state: GameState; ui: UiState }): GameSpeed {
  if (st.state.gameOver || st.ui.pauseReasons.length > 0) return 0
  return st.state.time.speed
}

/** New game / continue: the world waits for the player's first "Başlat". */
function pausedStart(s: GameState): GameState {
  return s.time.speed === 0 ? s : { ...s, time: { ...s.time, speed: 0 } }
}

/** Scene selection shown by the panel (detail, or the slot a targeted shop buys for). Render highlights it. */
export function panelSelection(panel: Panel | null): Selection | null {
  if (!panel) return null
  if (panel.kind === 'detail') return panel.selection
  if (panel.kind === 'shop' && panel.slotTarget) {
    // Stable per panel object, so selectors (tuples, useShallow) see the same reference every call.
    let sel = targetSelections.get(panel)
    if (!sel) targetSelections.set(panel, (sel = { kind: 'slot', id: panel.slotTarget }))
    return sel
  }
  return null
}
const targetSelections = new WeakMap<Panel, Selection>()

function samePanel(a: Panel | null, b: Panel | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * True while the visitor who brought `id` is still standing in the office. minimizeConcept sends that visitor away,
 * so the store only shelves the concept after the visitor's own stay (CONCEPT_VISITOR_DAYS) is over.
 */
function conceptVisitorStays(s: GameState, id: ConceptId): boolean {
  return s.visitors.some((v) => v.purpose === 'concept' && v.refId === id && v.leaveDay > s.time.day)
}

/** Concept a visitor came to tell, while it is still unread (they stand silently until tapped). */
function visitorConcept(s: GameState, visitorId: string): ConceptId | null {
  const v = s.visitors.find((x) => x.id === visitorId)
  if (v?.purpose !== 'concept' || !v.refId) return null
  const id = v.refId as ConceptId
  return s.concepts.triggered.includes(id) && !s.concepts.learned.includes(id) ? id : null
}

/** Empty slot in an open ring (not the founder desk): tapping it goes straight to the shop. */
function isEmptyOpenSlot(s: GameState, id: string): boolean {
  const slot = s.office.slots.find((x) => x.id === id)
  if (!slot || slot.id === FOUNDER_SLOT_ID || slot.itemId !== undefined || slot.spanOf !== undefined) return false
  return slot.ring === 0 || s.office.rings.some((r) => r.index === slot.ring && r.unlocked)
}

/**
 * A slot detail whose item just left (sold, moved away) would show a dead-end "Boş slot" page.
 * Move → follow the item to its new slot; otherwise → the shop targeted at the now empty slot.
 */
function retargetEmptiedDetail(action: Action, s: GameState): void {
  const { ui, openPanel } = useGameStore.getState()
  const p = ui.panel
  if (p?.kind !== 'detail' || p.selection.kind !== 'slot' || !isEmptyOpenSlot(s, p.selection.id)) return
  if (action.type === 'moveItem') openPanel({ kind: 'detail', selection: { kind: 'slot', id: action.toSlotId } }, { replace: true })
  else openPanel({ kind: 'shop', slotTarget: p.selection.id }, { replace: true })
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

/** Replay log lives outside zustand: appended in place, never triggers renders. Capped. */
const REPLAY_MAX = 20_000
let replay: ReplayLog = { seed: 1, runIndex: 0, fromSave: false, actions: [] }
function resetReplay(s: GameState, fromSave: boolean): void {
  replay = { seed: s.rng.seed, runIndex: s.meta.runIndex, fromSave, actions: [] }
}

/** Id of the newest engine event (the events buffer is ordered by id). */
function lastEventId(s: GameState): number {
  return s.events[s.events.length - 1]?.id ?? 0
}

/** Fractional days not yet stepped (below one fixed chunk). Reset on new game / load. */
let pendingDays = 0

/** Records XP once the run ends so a reload still carries it into the next run. */
function onGameOver(s: GameState): void {
  if (!s.gameOver) return
  writeProfile({ founderXp: s.meta.founderXp + s.gameOver.xpEarned, runIndex: s.meta.runIndex + 1 })
  clearSave()
}

function freshState(opts?: Partial<NewGameOptions>): GameState {
  const profile = readProfile()
  const full: NewGameOptions = {
    seed: opts?.seed ?? randomSeed(),
    founderXp: opts?.founderXp ?? profile.founderXp,
    runIndex: opts?.runIndex ?? profile.runIndex,
    companyName: opts?.companyName,
  }
  return createGame(full)
}

export const useGameStore = create<GameStore>()((set, get) => ({
  // Placeholder run until the start screen calls newGame() or load().
  state: createGame({ seed: 1 }),
  ui: initialUi(),

  dispatch(action) {
    const { state } = get()
    const res = applyAction(state, action)
    if (!res.ok) {
      set((s) => ({ ui: { ...s.ui, lastError: { code: res.error ?? 'invalid', at: performance.now() } } }))
      return res
    }
    if (replay.actions.length < REPLAY_MAX) replay.actions.push({ atDay: state.time.day, action })
    const starts = action.type === 'setSpeed' && action.speed > 0 && !get().ui.runStarted
    // A round choice made (size picked, pitch sent) ends the `offer` pause: pause reasons follow the new state.
    // The payday desk closes once its month is answered (`payday` pause ends with it).
    set((s) => ({ state: res.state, ui: withAutoPins(withPause(withDesk(starts ? { ...s.ui, runStarted: true } : s.ui, res.state), res.state), state, res.state) }))
    retargetEmptiedDetail(action, res.state)
    if (res.state.gameOver && !state.gameOver) onGameOver(res.state)
    // The expanded scene bubble's card is gone (answered): its focus pause ends with it.
    if (!res.state.decisions.active && get().ui.decisionExpanded) get().setDecisionExpanded(false)
    return res
  },

  tick(realDtSeconds) {
    const { state } = get()
    const speed = effectiveSpeed(get())
    if (speed === 0 || !(realDtSeconds > 0)) return
    pendingDays = Math.min(MAX_DAYS_PER_TICK, pendingDays + (realDtSeconds / SECONDS_PER_DAY) * speed)
    const chunks = Math.floor(pendingDays / FIXED_STEP_DAYS + 1e-9)
    if (chunks <= 0) return
    pendingDays -= chunks * FIXED_STEP_DAYS
    // step() works in FIXED_STEP_DAYS chunks internally: one call == `chunks` separate calls.
    const next = step(state, chunks * FIXED_STEP_DAYS)
    if (next === state) return
    // A pitch falling due with the Tur section open pauses right away (`offer`).
    set((s) => ({ state: next, ui: withAutoPins(withPause(withDesk(s.ui, next), next), state, next) }))
    if (next.gameOver && !state.gameOver) {
      onGameOver(next)
      return
    }
    afterStep(state, next)
  },

  newGame(opts) {
    pendingDays = 0
    const state = pausedStart(freshState(opts))
    writeProfile({ founderXp: state.meta.founderXp, runIndex: state.meta.runIndex })
    resetReplay(state, false)
    // A fresh run: every gauge beyond the first three is new again (pins stay, locked until relearned).
    const ui: UiState = { ...initialUi(), ...keptUi(get().ui), seenMetrics: [...INITIAL_WIDGETS], seenGoals: [] }
    set({ state, ui })
    persistUi(ui)
    writeSave(state)
  },

  save() {
    const { state } = get()
    if (state.gameOver) return
    // Focus pauses are UI state and never touch time.speed: the save keeps the player's speed.
    writeSave(state)
  },

  load() {
    const saved = readSave()
    if (!saved || saved.gameOver) return false
    const state = pausedStart(saved)
    pendingDays = 0
    resetReplay(state, true)
    // Pins and seen gauges come from the UI profile; an old profile without `seenMetrics` counts what the save
    // already unlocked as seen (no badge storm on continue).
    const prof = readUiSave()
    const kept = keptUi(get().ui)
    const pinTouched = prof.pinTouched ?? kept.pinTouched
    const pins = prof.pinnedMetrics ?? kept.pinnedMetrics
    // A mid-game save loaded by a player who never picked pins: fill the free slots with the defaults (Yakıt, Kâr
    // tahmini) so the old HUD's secondary numbers do not simply vanish (auto-pin only reacts to NEW unlocks).
    const pinnedMetrics = pinTouched ? pins : defaultPins(pins, state.unlockedWidgets)
    const ui: UiState = {
      ...initialUi(prof),
      ...kept,
      pinnedMetrics,
      pinTouched,
      seenMetrics: prof.seenMetrics ?? [...state.unlockedWidgets],
      // An old profile without seenGoals counts the save's goals as seen (no badge on continue).
      seenGoals: prof.seenGoals ?? [...(state.goalsDone ?? NO_GOALS)],
    }
    set({ state, ui })
    if (pinnedMetrics.join() !== pins.join()) persistUi(ui)
    return true
  },

  exportReplay: () => ({ ...replay, actions: [...replay.actions] }),

  select(selection) {
    const { ui, state, openPanel, closePanel, panelGoBack } = get()
    if (!selection) {
      // Empty floor: leave a detail / targeted shop the way the back button does (a dock tab stays open).
      if (ui.panel?.kind === 'detail' || (ui.panel?.kind === 'shop' && ui.panel.slotTarget)) {
        if (ui.panelBack) panelGoBack()
        else closePanel()
      }
      return
    }
    if (selection.kind === 'slot' && isEmptyOpenSlot(state, selection.id)) openPanel({ kind: 'shop', slotTarget: selection.id })
    else if (selection.kind === 'visitor' && visitorConcept(state, selection.id)) {
      // The visitor who brought a concept stands silently; tapping them opens the card (the only concept pause).
      const conceptId = visitorConcept(state, selection.id)!
      if (!state.concepts.learned.includes(conceptId)) get().dispatch({ type: 'openConcept', conceptId })
      openPanel({ kind: 'journal', conceptId })
    } else openPanel({ kind: 'detail', selection })
  },
  openPanel(panel, opts) {
    set((s) => {
      const cur = s.ui.panel
      if (samePanel(cur, panel)) return s
      const panelBack = opts?.root ? null : opts?.replace ? s.ui.panelBack : cur
      // One surface: a panel replaces an open center screen (a blocking modal stays).
      const overlay = centerOpen(s.ui) ? null : s.ui.overlay
      return { ui: withPause({ ...s.ui, panel, panelBack, overlay }, s.state) }
    })
  },
  togglePanel(tab) {
    const { ui, openPanel, closePanel } = get()
    // Same tab again closes (a targeted shop counts as the shop tab).
    if (ui.panel?.kind === tab) closePanel()
    else openPanel({ kind: tab }, { root: true })
  },
  closePanel: () => set((s) => (s.ui.panel === null && s.ui.panelBack === null ? s : { ui: withPause({ ...s.ui, panel: null, panelBack: null }, s.state) })),
  panelGoBack: () => set((s) => (s.ui.panelBack ? { ui: withPause({ ...s.ui, panel: s.ui.panelBack, panelBack: null }, s.state) } : s)),
  setHoverSlot: (hoverSlotId) => set((s) => (s.ui.hoverSlotId === hoverSlotId ? s : { ui: { ...s.ui, hoverSlotId } })),
  openOverlay: (overlay) =>
    set((s) => {
      // A center screen and the panel are one surface (phones have room for one): the screen closes the panel.
      if (CENTER_KINDS.has(overlay.kind)) return { ui: withPause({ ...s.ui, overlay, panel: null, panelBack: null }, s.state) }
      return { ui: withPause({ ...s.ui, overlay }, s.state) }
    }),
  toggleCenter(kind) {
    const { ui, openOverlay, closeOverlay } = get()
    if (ui.overlay?.kind === kind) closeOverlay()
    // Neither a blocking modal nor the payday desk is replaced by a center screen.
    else if (!blockingOverlay(ui) && ui.overlay?.kind !== 'payday') openOverlay({ kind })
  },
  closeOverlay: () =>
    set((s) => {
      // "Yeni ofise geç": the new office opens paused with the Başlat call, like a new game (docs/CORE_LOOP.md §3.2
      // rule 1, §4.3 "Yerleşme"). Like pausedStart this is not a player action: the replay keeps the player's choices.
      if (s.ui.overlay?.kind === 'moveScene' && !s.state.gameOver) {
        pendingDays = 0
        const state = pausedStart(s.state)
        return { state, ui: withPause({ ...s.ui, overlay: null, runStarted: false }, state) }
      }
      return { ui: withPause({ ...s.ui, overlay: null }, s.state) }
    }),
  setPlacing: (placing) => set((s) => ({ ui: { ...s.ui, placing } })),
  setZoom: (zoom) => set((s) => ({ ui: { ...s.ui, zoom } })),
  setSceneInset: (inset) =>
    set((s) => {
      const c = s.ui.sceneInset
      return c.top === inset.top && c.right === inset.right && c.bottom === inset.bottom ? s : { ui: { ...s.ui, sceneInset: inset } }
    }),
  setDecisionExpanded: (decisionExpanded) =>
    set((s) => (s.ui.decisionExpanded === decisionExpanded ? s : { ui: withPause({ ...s.ui, decisionExpanded }, s.state) })),
  setSlowOnMoments: (slowOnMoments) => set((s) => (s.ui.slowOnMoments === slowOnMoments ? s : { ui: { ...s.ui, slowOnMoments } })),
  pinMetric(id) {
    const ui = get().ui
    // Over PIN_MAX a pin locked in this run leaves first (it is invisible), then the oldest.
    const pinnedMetrics = addPin(ui.pinnedMetrics, id, get().state.unlockedWidgets)
    // Already pinned or not pinnable: nothing to do.
    if (pinnedMetrics.length === ui.pinnedMetrics.length && pinnedMetrics.every((x, i) => x === ui.pinnedMetrics[i])) return
    const next = { ...ui, pinnedMetrics, pinTouched: true }
    set({ ui: next })
    persistUi(next)
  },
  unpinMetric(id) {
    const ui = get().ui
    const next = { ...ui, pinnedMetrics: removePin(ui.pinnedMetrics, id), pinTouched: true }
    set({ ui: next })
    persistUi(next)
  },
  markGoalsSeen() {
    const { ui, state } = get()
    const done = state.goalsDone ?? NO_GOALS
    if (done.every((id) => ui.seenGoals.includes(id))) return
    const next = { ...ui, seenGoals: [...new Set([...ui.seenGoals, ...done])] }
    set({ ui: next })
    persistUi(next)
  },
  markMetricsSeen(ids) {
    const ui = get().ui
    const add = [...new Set(ids)].filter((x) => !ui.seenMetrics.includes(x))
    if (add.length === 0) return
    const next = { ...ui, seenMetrics: [...ui.seenMetrics, ...add] }
    set({ ui: next })
    persistUi(next)
  },
}))

/**
 * Store-side rules that follow game time (run after every tick that advanced the world):
 * - a concept that arrived never shows as a scene bubble: it counts on the Kazanımlar badge at once, its visitor
 *   stands silently (tap → card) and, once the visitor's stay is over, it moves to the shelf (minimizeConcept);
 * - an interrupting event (a card, the round window, a missed payroll…) closes an open center screen;
 * - at 4× an important event slows the run to 1× (a real setSpeed: the player sees and may undo it).
 * Engine changes go through dispatch, so the replay log reproduces them.
 */
function afterStep(prev: GameState, next: GameState): void {
  const { dispatch, closeOverlay } = useGameStore.getState()
  const ac = next.concepts.active
  if (ac && !conceptVisitorStays(next, ac.id)) dispatch({ type: 'minimizeConcept', conceptId: ac.id })
  if (centerOpen(useGameStore.getState().ui) && hasInterrupt(prev, next)) closeOverlay()
  const ui = useGameStore.getState().ui
  if (ui.slowOnMoments && next.time.speed === 4) {
    if (hasImportantMoment(prev, next)) {
      dispatch({ type: 'setSpeed', speed: 1 })
      useGameStore.setState((s) => ({ ui: { ...s.ui, slowdownAt: performance.now() } }))
    }
  }
}
