// Who gets the office edit mode (grid §4, owner decision): PC only, a fine pointer on a wide screen. Phones, tablets
// and any touch-first device get no entry at all (no button, no O key); auto placement arranges their office.
import { useSyncExternalStore } from 'react'
import { useGameStore } from '../store/gameStore'
import { MOBILE_QUERY } from './hooks'

/** A mouse (or trackpad) is the primary pointer. */
export const FINE_POINTER_QUERY = '(pointer: fine)'

export interface PointerEnv {
  /** The compact layout (useIsMobile: under 1024px, or a short touch screen). */
  mobile: boolean
  /** Primary pointer is fine. */
  fine: boolean
}

export function layoutEditAllowed(env: PointerEnv): boolean {
  return !env.mobile && env.fine
}

/** The device as the browser reports it; no window (server render, tests without one) = no edit mode. */
export function readPointerEnv(): PointerEnv {
  if (typeof window === 'undefined' || !window.matchMedia) return { mobile: true, fine: false }
  return { mobile: window.matchMedia(MOBILE_QUERY).matches, fine: window.matchMedia(FINE_POINTER_QUERY).matches }
}

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const qs = [window.matchMedia(MOBILE_QUERY), window.matchMedia(FINE_POINTER_QUERY)]
  for (const q of qs) q.addEventListener?.('change', cb)
  return () => {
    for (const q of qs) q.removeEventListener?.('change', cb)
  }
}

const snapshot = (): boolean => layoutEditAllowed(readPointerEnv())

/** Live: a window dragged under 1024px loses the entry. */
export function useCanEditLayout(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** O key / "Ofisi düzenle" button: opens the edit mode on a PC, does nothing anywhere else. */
export function tryBeginLayoutEdit(env: PointerEnv = readPointerEnv()): boolean {
  if (!layoutEditAllowed(env)) return false
  return useGameStore.getState().beginLayoutEdit()
}
