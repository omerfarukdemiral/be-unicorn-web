// Small UI hooks: responsive breakpoint, real-time ticker, persisted UI prefs.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { create } from 'zustand'

const MOBILE_QUERY = '(max-width: 767px)'

function subscribeMq(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** True below 768px (DECISIONS #3 mobile layout). */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMq,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : false),
    () => false,
  )
}

/** Re-renders every `ms` real milliseconds while `active`. Returns performance.now(). */
export function useNow(ms: number, active = true): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(performance.now()), ms)
    return () => window.clearInterval(id)
  }, [ms, active])
  return now
}

// ---------------------------------------------------------------------------
// UI preferences (per browser; not game state)
// ---------------------------------------------------------------------------

const PREFS_KEY = 'be-unicorn:prefs'

export interface UiPrefs {
  sound: boolean
  /** Show screen-space bubbles (fallback when render does not draw world bubbles). */
  screenBubbles: boolean
}

function loadPrefs(): UiPrefs {
  const base: UiPrefs = { sound: true, screenBubbles: true }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<UiPrefs>) }
  } catch {
    /* storage unavailable */
  }
  return base
}

interface PrefsStore extends UiPrefs {
  setPref<K extends keyof UiPrefs>(key: K, value: UiPrefs[K]): void
}

export const usePrefs = create<PrefsStore>()((set, get) => ({
  ...loadPrefs(),
  setPref(key, value) {
    set({ [key]: value } as Pick<UiPrefs, typeof key>)
    try {
      const { sound, screenBubbles } = get()
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sound, screenBubbles }))
    } catch {
      /* ignore */
    }
  },
}))

/** True when the event target is a text field (keyboard shortcuts skip it). */
export function isTypingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
