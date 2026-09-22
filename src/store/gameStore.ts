// zustand store. Scaffold version: UI slice is real, engine bridge is a placeholder
// (dispatch → 'engineNotConnected', tick advances only the clock). Integrate lane wires src/engine.
import { create } from 'zustand'
import { DAYS_PER_MONTH, SAVE_VERSION, SECONDS_PER_DAY, type GameState } from '../engine/types'
import { createBootstrapState } from './bootstrapState'
import type { GameStore, UiState } from './types'

export const SAVE_KEY = 'be-unicorn:save'

const initialUi: UiState = {
  selection: null,
  hoverSlotId: null,
  dockTab: null,
  overlay: null,
  placing: null,
  zoom: 1,
  lastError: null,
  lastSeenEventId: 0,
}

function advanceClock(state: GameState, days: number): GameState {
  const day = state.time.day + days
  return { ...state, time: { ...state.time, day, month: Math.floor(day / DAYS_PER_MONTH) } }
}

export const useGameStore = create<GameStore>()((set, get) => ({
  state: createBootstrapState(),
  ui: initialUi,

  dispatch(action) {
    const { state } = get()
    if (action.type === 'setSpeed') {
      const next = { ...state, time: { ...state.time, speed: action.speed } }
      set({ state: next })
      return { state: next, ok: true }
    }
    set((s) => ({ ui: { ...s.ui, lastError: { code: 'engineNotConnected', at: performance.now() } } }))
    return { state, ok: false, error: 'engineNotConnected' }
  },
  tick(realDtSeconds) {
    const { state } = get()
    if (state.time.speed === 0 || state.gameOver) return
    set({ state: advanceClock(state, (realDtSeconds / SECONDS_PER_DAY) * state.time.speed) })
  },
  newGame(opts) {
    set({ state: createBootstrapState(opts?.seed ?? 1), ui: initialUi })
  },
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(get().state))
    } catch {
      /* storage unavailable (private mode) */
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw) as GameState
      if (parsed.meta?.saveVersion !== SAVE_VERSION) return false
      set({ state: parsed, ui: initialUi })
      return true
    } catch {
      return false
    }
  },

  select: (selection) => set((s) => ({ ui: { ...s.ui, selection } })),
  setHoverSlot: (hoverSlotId) => set((s) => ({ ui: { ...s.ui, hoverSlotId } })),
  setDockTab: (dockTab) => set((s) => ({ ui: { ...s.ui, dockTab } })),
  openOverlay: (overlay) => set((s) => ({ ui: { ...s.ui, overlay } })),
  closeOverlay: () => set((s) => ({ ui: { ...s.ui, overlay: null } })),
  setPlacing: (placing) => set((s) => ({ ui: { ...s.ui, placing } })),
  setZoom: (zoom) => set((s) => ({ ui: { ...s.ui, zoom } })),
  markEventsSeen: (eventId) => set((s) => ({ ui: { ...s.ui, lastSeenEventId: Math.max(s.ui.lastSeenEventId, eventId) } })),
}))
