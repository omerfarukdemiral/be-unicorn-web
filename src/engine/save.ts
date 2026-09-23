// Versioned (de)serialization. Storage-agnostic: the store owns localStorage.
import { SAVE_VERSION, type GameState } from './types'

export interface SaveFile {
  version: number
  state: GameState
}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>

/** MIGRATIONS[v] upgrades a v-save to v+1. Add one per SAVE_VERSION bump. */
const MIGRATIONS: Record<number, Migration> = {}

export function serialize(state: GameState): string {
  const file: SaveFile = { version: SAVE_VERSION, state }
  return JSON.stringify(file)
}

/** Upgrades an older save; null if it is from the future or cannot be migrated. */
export function migrate(file: { version: number; state: unknown }): GameState | null {
  let v = file.version
  let st = file.state as Record<string, unknown> | null
  if (!st || typeof st !== 'object' || !Number.isInteger(v) || v > SAVE_VERSION) return null
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v]
    if (!m) return null
    st = m(st)
    v += 1
  }
  const out = st as unknown as GameState
  if (!out.meta || !out.time || !out.stats) return null
  out.meta.saveVersion = SAVE_VERSION
  return out
}

export function deserialize(raw: string): GameState | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const p = parsed as Record<string, unknown>
    // Accept a SaveFile, or a bare GameState (scaffold store format).
    if (typeof p.version === 'number' && p.state) return migrate({ version: p.version, state: p.state })
    const meta = p.meta as { saveVersion?: unknown } | undefined
    if (meta && typeof meta.saveVersion === 'number') return migrate({ version: meta.saveVersion, state: p })
    return null
  } catch {
    return null
  }
}
