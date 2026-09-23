// localStorage persistence: versioned save (engine save.ts migrates) + a small cross-run profile.
// Every storage access is guarded: private mode / blocked storage must never break the game.
import { deserialize, serialize } from '../engine'
import type { GameState } from '../engine/types'

export const SAVE_KEY = 'be-unicorn:save'
export const PROFILE_KEY = 'be-unicorn:profile'

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
