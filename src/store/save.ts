// localStorage persistence: versioned save (engine save.ts migrates) + a small cross-run profile.
// Every storage access is guarded: private mode / blocked storage must never break the game.
import { deserialize, serialize } from '../engine'
import { HUD_WIDGETS, type GameState, type HudWidget } from '../engine/types'
import { cleanMetricIds, PIN_MAX } from './metricPins'

export const SAVE_KEY = 'be-unicorn:save'
export const PROFILE_KEY = 'be-unicorn:profile'
/** UI profile (docs/LAYOUT.md §5.2): top-bar pins survive runs and reloads; the game save never holds UI state. */
export const UI_KEY = 'be-unicorn:ui'

export interface UiSave {
  pinnedMetrics: HudWidget[]
  seenMetrics: HudWidget[]
  pinTouched: boolean
}

/** Survives bankruptcies: founder XP carries into the next run (PLAN §5.10). */
export interface Profile {
  founderXp: number
  runIndex: number
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function writeSave(state: GameState): boolean {
  try {
    storage()?.setItem(SAVE_KEY, serialize(state))
    return true
  } catch {
    return false
  }
}

export function readSave(): GameState | null {
  try {
    const raw = storage()?.getItem(SAVE_KEY)
    return raw ? deserialize(raw) : null
  } catch {
    return null
  }
}

export function clearSave(): void {
  try {
    storage()?.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

export function readProfile(): Profile {
  try {
    const raw = storage()?.getItem(PROFILE_KEY)
    if (!raw) return { founderXp: 0, runIndex: 0 }
    const p = JSON.parse(raw) as Partial<Profile>
    return {
      founderXp: typeof p.founderXp === 'number' && p.founderXp >= 0 ? p.founderXp : 0,
      runIndex: typeof p.runIndex === 'number' && p.runIndex >= 0 ? p.runIndex : 0,
    }
  } catch {
    return { founderXp: 0, runIndex: 0 }
  }
}

export function writeProfile(p: Profile): void {
  try {
    storage()?.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/** Whatever of the UI profile is readable; unknown gauge ids are dropped. A missing field stays absent. */
export function readUiSave(): Partial<UiSave> {
  try {
    const raw = storage()?.getItem(UI_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as { v?: number } & Partial<Record<keyof UiSave, unknown>>
    if (!p || typeof p !== 'object' || p.v !== 1) return {}
    const out: Partial<UiSave> = {}
    if (Array.isArray(p.pinnedMetrics)) out.pinnedMetrics = cleanMetricIds(p.pinnedMetrics, HUD_WIDGETS).slice(-PIN_MAX)
    if (Array.isArray(p.seenMetrics)) out.seenMetrics = cleanMetricIds(p.seenMetrics, HUD_WIDGETS)
    if (typeof p.pinTouched === 'boolean') out.pinTouched = p.pinTouched
    return out
  } catch {
    return {}
  }
}

export function writeUiSave(u: UiSave): void {
  try {
    storage()?.setItem(UI_KEY, JSON.stringify({ v: 1, pinnedMetrics: u.pinnedMetrics, seenMetrics: u.seenMetrics, pinTouched: u.pinTouched }))
  } catch {
    /* ignore */
  }
}
