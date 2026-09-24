// Small UI hooks: responsive breakpoint, real-time ticker, persisted UI prefs.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { useGameStore } from '../store/gameStore'

/**
 * Narrow screens (phones AND the 768–1023 band: tablets in portrait, narrow windows) plus phones in landscape
 * (short + touch) get the compact layout. Below 1024 the one-row desktop bars do not fit (stage + 4 gauges + speed
 * + view controls ≈ 840px), so the tablet band takes the phone bars and the bottom sheet.
 */
const MOBILE_QUERY = '(max-width: 1023px), (pointer: coarse) and (max-height: 500px)'

function subscribeMq(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** True below 1024px or on a landscape phone (DECISIONS #3 mobile layout). */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMq,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : false),
    () => false,
  )
}

/**
 * The ONE layout mode every bar, the panel and the scene inset agree on (never decide "landscape" locally):
 * - desktop:   one-row top bar, one-row bottom bar, right-hand panel;
 * - portrait:  two-row top bar, two-row bottom bar, bottom sheet;
 * - landscape: compact (mobile) and short (≤ 500px tall, wider than tall): one-row bars (h52), side panel.
 */
export type LayoutMode = 'desktop' | 'portrait' | 'landscape'

/** Height at or under which a wider-than-tall compact screen counts as landscape. */
export const LANDSCAPE_MAX_H = 500

export function layoutModeOf(mobile: boolean, w: number, h: number): LayoutMode {
  if (!mobile) return 'desktop'
  return w > h && h <= LANDSCAPE_MAX_H ? 'landscape' : 'portrait'
}

function subscribeLayout(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', cb)
  const unMq = subscribeMq(cb)
  return () => {
    window.removeEventListener('resize', cb)
    unMq()
  }
}

function layoutSnapshot(): LayoutMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop'
  return layoutModeOf(window.matchMedia(MOBILE_QUERY).matches, window.innerWidth, window.innerHeight)
}

export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribeLayout, layoutSnapshot, () => 'desktop')
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
  /** UI and game sound cues (src/audio). */
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

const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image'])

/** True when the event target takes typed text (keyboard shortcuts skip it). Sliders and toggles do not. */
export function isTypingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type)
  return tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Open/closed state of a small local expander (HUD "+N" widgets, activity history) that obeys the single
 * panel rule on phones: opening the panel closes it, opening it closes the panel. Desktop: plain state
 * (the expanders sit left of the panel there and never overlap it).
 */
export function useExclusiveExpander(): [boolean, (next: boolean | ((open: boolean) => boolean)) => void] {
  const mobile = useIsMobile()
  const [open, setOpenRaw] = useState(false)
  const panelOpen = useGameStore((s) => s.ui.panel !== null)
  useEffect(() => {
    if (mobile && panelOpen) setOpenRaw(false)
  }, [mobile, panelOpen])
  const setOpen = (next: boolean | ((open: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next
    if (value && mobile) useGameStore.getState().closePanel()
    setOpenRaw(value)
  }
  return [open, setOpen]
}
