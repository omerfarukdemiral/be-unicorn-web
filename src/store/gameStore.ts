// zustand store: the only bridge between the pure engine and render/ui.
// dispatch → engine.applyAction; tick → fixed engine steps (FIXED_STEP_DAYS) scaled by time.speed.
import { create } from 'zustand'
import { applyAction, createGame, step } from '../engine'
import { FIXED_STEP_DAYS, FOUNDER_SLOT_ID, SECONDS_PER_DAY, type GameState, type NewGameOptions } from '../engine/types'
import { clearSave, readProfile, readSave, writeProfile, writeSave } from './save'
import type { GameStore, Panel, ReplayLog, Selection, UiState } from './types'

export { SAVE_KEY } from './save'

/** Upper bound of engine days advanced by one tick (keeps a hitch from fast-forwarding). */
const MAX_DAYS_PER_TICK = 4

const initialUi = (): UiState => ({
  panel: null,
  panelBack: null,
  hoverSlotId: null,
  overlay: null,
  placing: null,
  zoom: 1,
  lastError: null,
  pausedFrom: null,
  generation: 0,
})

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

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

/** Replay log lives outside zustand: appended in place, never triggers renders. Capped. */
const REPLAY_MAX = 20_000
let replay: ReplayLog = { seed: 1, runIndex: 0, fromSave: false, actions: [] }
function resetReplay(s: GameState, fromSave: boolean): void {
  replay = { seed: s.rng.seed, runIndex: s.meta.runIndex, fromSave, actions: [] }
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
    set({ state: res.state })
    if (res.state.gameOver && !state.gameOver) onGameOver(res.state)
    return res
  },

  tick(realDtSeconds) {
    const { state } = get()
    if (state.gameOver || state.time.speed === 0 || !(realDtSeconds > 0)) return
    pendingDays = Math.min(MAX_DAYS_PER_TICK, pendingDays + (realDtSeconds / SECONDS_PER_DAY) * state.time.speed)
    const chunks = Math.floor(pendingDays / FIXED_STEP_DAYS + 1e-9)
    if (chunks <= 0) return
    pendingDays -= chunks * FIXED_STEP_DAYS
    // step() works in FIXED_STEP_DAYS chunks internally: one call == `chunks` separate calls.
    const next = step(state, chunks * FIXED_STEP_DAYS)
    if (next === state) return
    set({ state: next })
    if (next.gameOver && !state.gameOver) onGameOver(next)
  },

  newGame(opts) {
    pendingDays = 0
    const state = freshState(opts)
    writeProfile({ founderXp: state.meta.founderXp, runIndex: state.meta.runIndex })
    resetReplay(state, false)
    set({ state, ui: { ...initialUi(), zoom: get().ui.zoom, generation: get().ui.generation + 1 } })
    writeSave(state)
  },

  save() {
    const { state, ui } = get()
    if (state.gameOver) return
    // A modal pause is UI state: save the speed the player actually chose.
    const speed = state.time.speed === 0 && ui.pausedFrom !== null ? ui.pausedFrom : state.time.speed
    writeSave(speed === state.time.speed ? state : { ...state, time: { ...state.time, speed } })
  },

  load(opts) {
    let state = readSave()
    if (!state || state.gameOver) return false
    if (opts?.resume && state.time.speed === 0) state = { ...state, time: { ...state.time, speed: 1 } }
    pendingDays = 0
    resetReplay(state, true)
    set({ state, ui: { ...initialUi(), zoom: get().ui.zoom, generation: get().ui.generation + 1 } })
    return true
  },

  exportReplay: () => ({ ...replay, actions: [...replay.actions] }),

  select(selection) {
    const { ui, state, openPanel, closePanel } = get()
    if (!selection) {
      if (ui.panel?.kind === 'detail' || (ui.panel?.kind === 'shop' && ui.panel.slotTarget)) closePanel()
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
      return { ui: { ...s.ui, panel, panelBack } }
    })
  },
  togglePanel(tab) {
    const { ui, openPanel, closePanel } = get()
    // Same tab again closes (a targeted shop counts as the shop tab).
    if (ui.panel?.kind === tab) closePanel()
    else openPanel({ kind: tab }, { root: true })
  },
  closePanel: () => set((s) => (s.ui.panel === null && s.ui.panelBack === null ? s : { ui: { ...s.ui, panel: null, panelBack: null } })),
  panelGoBack: () => set((s) => (s.ui.panelBack ? { ui: { ...s.ui, panel: s.ui.panelBack, panelBack: null } } : s)),
  setHoverSlot: (hoverSlotId) => set((s) => (s.ui.hoverSlotId === hoverSlotId ? s : { ui: { ...s.ui, hoverSlotId } })),
  openOverlay: (overlay) => set((s) => ({ ui: { ...s.ui, overlay } })),
  closeOverlay: () => set((s) => ({ ui: { ...s.ui, overlay: null } })),
  setPlacing: (placing) => set((s) => ({ ui: { ...s.ui, placing } })),
  setZoom: (zoom) => set((s) => ({ ui: { ...s.ui, zoom } })),
  setPausedFrom: (pausedFrom) => set((s) => (s.ui.pausedFrom === pausedFrom ? s : { ui: { ...s.ui, pausedFrom } })),
}))
