// Versioned (de)serialization. Storage-agnostic: the store owns localStorage.
import { HISTORY_MAX_MONTHS } from './balance'
import { DAYS_PER_MONTH, DEFAULT_COMPANY_NAME, SAVE_VERSION, type GameState, type PartialReceipt } from './types'

export interface SaveFile {
  version: number
  state: GameState
}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>

/** MIGRATIONS[v] upgrades a v-save to v+1. Add one per SAVE_VERSION bump. */
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2 (core loop phase 3): the bankruptcy clock now runs only after a missed payday. A v1 save already
  // counting negative-cash days keeps its clock (as a missed payday); everything else defaults lazily in the engine
  // (ledger.founder, derived.momAvg, finance.payrollMissed).
  1: (st) => {
    const finance = st.finance as { negativeCashDays?: number; payrollMissed?: boolean } | undefined
    if (finance && (finance.negativeCashDays ?? 0) > 0) finance.payrollMissed = true
    return st
  },
  // v2 → v3 (online): the run carries a company name. Older runs get the default one.
  2: (st) => {
    const meta = st.meta as { companyName?: unknown } | undefined
    if (meta && (typeof meta.companyName !== 'string' || !meta.companyName.trim())) meta.companyName = DEFAULT_COMPANY_NAME
    return st
  },
  // v3 → v4 (docs/GAMEPLAY_V2.md §3.1): the single migration of GAMEPLAY V2. Every wave adds its own defaults here;
  // the engine also defaults each new field lazily (??=), so a wave never depends on another one having landed.
  3: (st) => {
    const finance = st.finance as { mrrHistory?: unknown; usersHistory?: unknown; receipts?: unknown; netHistory?: unknown } | undefined
    if (finance) {
      if (!Array.isArray(finance.receipts)) finance.receipts = partialReceipts(finance.mrrHistory, finance.usersHistory)
      if (!Array.isArray(finance.netHistory)) finance.netHistory = []
    }
    // Yearly raises (§4.2) need no migration: hiredDay was always written and Employee.raises defaults lazily to the years served.
    // Idle-cash grace (§4.1): a v3 save never recorded its last round close, so the 180-day grace starts at load.
    const time = st.time as { day?: unknown } | undefined
    const fin = finance as { lastRoundCloseDay?: unknown } | undefined
    if (fin && typeof fin.lastRoundCloseDay !== 'number' && typeof time?.day === 'number') fin.lastRoundCloseDay = time.day
    return st
  },
}

/** Month history rebuilt from the v3 month-end snapshots (MRR, users): the last HISTORY_MAX_MONTHS months. */
function partialReceipts(mrrRaw: unknown, usersRaw: unknown): PartialReceipt[] {
  const mrr = Array.isArray(mrrRaw) ? (mrrRaw as unknown[]) : []
  const users = Array.isArray(usersRaw) ? (usersRaw as unknown[]) : []
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const out: PartialReceipt[] = []
  const n = Math.max(mrr.length, users.length)
  for (let i = Math.max(0, n - HISTORY_MAX_MONTHS); i < n; i++) {
    const u = Math.round(num(users[i]))
    out.push({ partial: true, month: i, day: (i + 1) * DAYS_PER_MONTH, mrr: Math.round(num(mrr[i])), users: u, usersDelta: u - Math.round(num(users[i - 1])) })
  }
  return out
}

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
