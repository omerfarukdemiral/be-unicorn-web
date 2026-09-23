// zustand store: the only bridge between the pure engine and render/ui.
// dispatch → engine.applyAction; tick → fixed engine steps (FIXED_STEP_DAYS) scaled by the effective speed
// (time.speed = the player's choice, held at 0 while any ui.pauseReasons is active: modal, decision, concept card,
// round offer / pitch).
// After each tick: an unclicked concept bubble shrinks after CONCEPT_MINIMIZE_DAYS of game time, and at 4× an
// important moment slows the run to 1× (docs/CORE_LOOP.md §3.2).
import { create } from 'zustand'
import { applyAction, createGame, step } from '../engine'
import { FIXED_STEP_DAYS, FOUNDER_SLOT_ID, SECONDS_PER_DAY, type Action, type GameEventKind, type GameSpeed, type GameState, type NewGameOptions } from '../engine/types'
import { clearSave, readProfile, readSave, writeProfile, writeSave } from './save'
import type { GameStore, Panel, PauseReason, ReplayLog, Selection, UiState } from './types'

export { SAVE_KEY } from './save'

/** Upper bound of engine days advanced by one tick (keeps a hitch from fast-forwarding). */
const MAX_DAYS_PER_TICK = 4

const NO_INSET = { top: 0, right: 0, bottom: 0 }

/**
 * An unclicked concept bubble shrinks to an icon after this many GAME days (10 days = 20 s at 1×).
 * Counted in game time, so it never shrinks while time is still (paused, card open).
 */
export const CONCEPT_MINIMIZE_DAYS = 10

/** Events that are worth watching at 1×: at 4× they slow the run down (never pause). */
export const IMPORTANT_EVENT_KINDS: ReadonlySet<GameEventKind> = new Set<GameEventKind>([
  'projectLaunched',
  'decisionShown',
  'milestone',
  'bankruptWarning',
  'roundClosed',
  'release',
  // The early round window opening is the "tur teklifi" moment.
  'roundWindow',
  // Payroll could not be paid: the bankruptcy clock started (phase 3).
  'payrollMissed',
])

/** A payday that leaves less than this many months of runway is an important moment too (docs/CORE_LOOP.md §3.2). */
export const PAYDAY_SLOW_RUNWAY_MONTHS = 3

/** True when `next` brought an event that should slow 4× down to 1× (see IMPORTANT_EVENT_KINDS). */
export function hasImportantMoment(prev: GameState, next: GameState): boolean {
  const since = lastEventId(prev)
  for (const e of next.events) {
    if (e.id <= since) continue
    if (IMPORTANT_EVENT_KINDS.has(e.kind)) return true
    if (e.kind === 'payday') {
      const r = next.finance.runway
      if (r !== null && r < PAYDAY_SLOW_RUNWAY_MONTHS) return true
    }
  }
  return false
}

const initialUi = (): UiState => ({
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
})

/** UI fields that survive newGame()/load() (player preferences of this session). */
const keptUi = (ui: UiState): Pick<UiState, 'zoom' | 'slowOnMoments' | 'generation'> => ({ zoom: ui.zoom, slowOnMoments: ui.slowOnMoments, generation: ui.generation + 1 })

/**
 * A round choice waits for the player: the early window is open (size chooser) or this week's pitch is due
 * (docs/CORE_LOOP.md §4.3). Read with the Tur section open, it is the `offer` focus pause.
 */
export function offerWaiting(s: GameState): boolean {
  const r = s.round
  if (r?.active) return r.pitchDue !== undefined
  return s.derived.canStartRound && !s.gameOver
}

/** Focus pauses implied by what is open (one mechanism for modals, decision cards, Defter cards and round offers). */
export function pauseReasonsOf(ui: Pick<UiState, 'overlay' | 'panel'> & { decisionExpanded?: boolean }, state?: GameState): PauseReason[] {
  const r: PauseReason[] = []
  if (ui.overlay) r.push('modal')
  const p = ui.panel
  if ((p?.kind === 'decision' && p.answered === undefined) || ui.decisionExpanded) r.push('decision')
  if (p?.kind === 'journal' && p.conceptId) r.push('concept')
  if (p?.kind === 'growth' && p.section === 'round' && state && offerWaiting(state)) r.push('offer')
  return r
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
    set((s) => ({ state: res.state, ui: withPause(starts ? { ...s.ui, runStarted: true } : s.ui, res.state) }))
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
    set((s) => ({ state: next, ui: withPause(s.ui, next) }))
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
    set({ state, ui: { ...initialUi(), ...keptUi(get().ui) } })
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
    set({ state, ui: { ...initialUi(), ...keptUi(get().ui) } })
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
    else openPanel({ kind: 'detail', selection })
  },
  openPanel(panel, opts) {
    set((s) => {
      const cur = s.ui.panel
      if (samePanel(cur, panel)) return s
      const panelBack = opts?.root ? null : opts?.replace ? s.ui.panelBack : cur
      return { ui: withPause({ ...s.ui, panel, panelBack }, s.state) }
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
  openOverlay: (overlay) => set((s) => ({ ui: withPause({ ...s.ui, overlay }, s.state) })),
  closeOverlay: () => set((s) => ({ ui: withPause({ ...s.ui, overlay: null }, s.state) })),
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
}))

/**
 * Store-side rules that follow game time (run after every tick that advanced the world):
 * - an unclicked concept bubble shrinks after CONCEPT_MINIMIZE_DAYS game days;
 * - at 4× an important event slows the run to 1× (a real setSpeed: the player sees and may undo it).
 * Both go through dispatch, so the replay log reproduces them.
 */
function afterStep(prev: GameState, next: GameState): void {
  const { dispatch, ui } = useGameStore.getState()
  const ac = next.concepts.active
  if (ac && next.time.day - ac.shownDay >= CONCEPT_MINIMIZE_DAYS) dispatch({ type: 'minimizeConcept', conceptId: ac.id })
  if (ui.slowOnMoments && next.time.speed === 4) {
    if (hasImportantMoment(prev, next)) {
      dispatch({ type: 'setSpeed', speed: 1 })
      useGameStore.setState((s) => ({ ui: { ...s.ui, slowdownAt: performance.now() } }))
    }
  }
}
