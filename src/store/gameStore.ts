// zustand store: the only bridge between the pure engine and render/ui.
// dispatch → engine.applyAction; tick → fixed engine steps (FIXED_STEP_DAYS) scaled by time.speed.
import { create } from 'zustand'
import { applyAction, createGame, step } from '../engine'
import { FIXED_STEP_DAYS, SECONDS_PER_DAY, type GameState, type NewGameOptions } from '../engine/types'
import { clearSave, readProfile, readSave, writeProfile, writeSave } from './save'
import type { GameStore, UiState } from './types'

export { SAVE_KEY } from './save'

/** Upper bound of engine days advanced by one tick (keeps a hitch from fast-forwarding). */
const MAX_DAYS_PER_TICK = 4

const initialUi = (): UiState => ({
  selection: null,
  hoverSlotId: null,
  dockTab: null,
  overlay: null,
  placing: null,
  zoom: 1,
  lastError: null,
  lastSeenEventId: 0,
})

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

function maxEventId(s: GameState): number {
  return s.events.reduce((m, e) => Math.max(m, e.id), 0)
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
  replay: [],

  dispatch(action) {
    const { state } = get()
    const res = applyAction(state, action)
    if (!res.ok) {
      set((s) => ({ ui: { ...s.ui, lastError: { code: res.error ?? 'invalid', at: performance.now() } } }))
      return res
    }
    set((s) => ({ state: res.state, replay: [...s.replay, { atDay: state.time.day, action }] }))
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
    set({ state, ui: { ...initialUi(), zoom: get().ui.zoom, lastSeenEventId: maxEventId(state) }, replay: [] })
    writeSave(state)
  },

  save() {
    const { state } = get()
    if (state.gameOver) return
    writeSave(state)
  },

  load() {
    const state = readSave()
    if (!state || state.gameOver) return false
    pendingDays = 0
    set({ state, ui: { ...initialUi(), zoom: get().ui.zoom, lastSeenEventId: maxEventId(state) }, replay: [] })
    return true
  },

  select: (selection) => set((s) => ({ ui: { ...s.ui, selection } })),
  setHoverSlot: (hoverSlotId) => set((s) => (s.ui.hoverSlotId === hoverSlotId ? s : { ui: { ...s.ui, hoverSlotId } })),
  setDockTab: (dockTab) => set((s) => ({ ui: { ...s.ui, dockTab } })),
  openOverlay: (overlay) => set((s) => ({ ui: { ...s.ui, overlay } })),
  closeOverlay: () => set((s) => ({ ui: { ...s.ui, overlay: null } })),
  setPlacing: (placing) => set((s) => ({ ui: { ...s.ui, placing } })),
  setZoom: (zoom) => set((s) => ({ ui: { ...s.ui, zoom } })),
  markEventsSeen: (eventId) => set((s) => ({ ui: { ...s.ui, lastSeenEventId: Math.max(s.ui.lastSeenEventId, eventId) } })),
}))
