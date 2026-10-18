// Round 8 (prepared for the engine's snooze): a confirm-type chip move opened its place (chipTarget); this watches
// whether the player confirmed there. The place closing without the move's own action = the move was declined, and
// `onDeclined` listeners hear it (the engine's snooze action is wired here once it lands).
import type { Action, NextMove } from '../engine/types'
import { onAction, useGameStore } from '../store/gameStore'
import type { UiState } from '../store/types'

type Pending = { move: NextMove; actionType: Action['type'] | null; place: 'panel' | 'overlay' }

let pending: Pending | null = null
const listeners = new Set<(move: NextMove) => void>()

/** Called by the chip when it opens a confirm move's place. `actionType`: the engine action that confirms it. */
export function watchConfirm(move: NextMove, actionType: Action['type'] | null, place: 'panel' | 'overlay'): void {
  pending = { move, actionType, place }
}

export function onDeclined(f: (move: NextMove) => void): () => void {
  listeners.add(f)
  return () => listeners.delete(f)
}

export const pendingConfirm = (): Pending | null => pending

/** A dispatched action: the confirm the chip waited for ends the watch. */
export function noteAction(a: Action): void {
  if (pending && pending.actionType !== null && a.type === pending.actionType) pending = null
}

/** The place closed (panel gone or swapped, the center screen closed): still pending = declined. */
export function noteUi(prev: Pick<UiState, 'panel' | 'overlay'>, next: Pick<UiState, 'panel' | 'overlay'>): void {
  if (!pending) return
  const closed = pending.place === 'panel' ? prev.panel !== null && (next.panel === null || next.panel.kind !== prev.panel.kind) : prev.overlay !== null && next.overlay === null
  if (!closed) return
  const move = pending.move
  pending = null
  for (const f of listeners) f(move)
}

let wired = false
/** Hooks the watch into the store once: applied actions and panel / center-screen changes. */
export function wireConfirmWatch(): void {
  if (wired) return
  wired = true
  onAction(noteAction)
  // Declined = the engine snoozes that move for 90 days (it refuses unless the move is still on the chip).
  onDeclined((move) => useGameStore.getState().dispatch({ type: 'snoozeMove', move }))
  useGameStore.subscribe((st, prev) => {
    // A new run (or a load) starts with nothing waiting.
    if (st.ui.generation !== prev.ui.generation) {
      pending = null
      return
    }
    if (st.ui.panel !== prev.ui.panel || st.ui.overlay !== prev.ui.overlay) noteUi(prev.ui, st.ui)
  })
}
