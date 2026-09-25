// Cloud save: one versioned SaveFile per account. Optimistic concurrency by revision: a device that writes with
// a rev older than the server's gets 409 + the server copy, so an old tab/device never silently overwrites newer
// progress. `force` lets the player keep this device's progress after seeing the choice.
import type { SaveGetOk, SaveMeta } from '../../src/net/contract.js'
import { ApiError, now } from './http.js'
import type { Kv } from './kv.js'
import { keys } from './auth.js'

export const SAVE_MAX_BYTES = 512 * 1024
const WRITE_LOCK_S = 5

interface StoredSave extends SaveMeta {
  data: string
}

const EMPTY: SaveGetOk = { rev: 0, updatedAt: 0, day: 0, stage: 0, runIndex: 0, data: null }

export async function readSave(kv: Kv, h: string): Promise<SaveGetOk> {
  const raw = await kv.get(keys.save(h))
  if (!raw) return { ...EMPTY }
  try {
    const s = JSON.parse(raw) as StoredSave
    return { rev: s.rev, updatedAt: s.updatedAt, day: s.day, stage: s.stage, runIndex: s.runIndex, data: s.data }
  } catch {
    return { ...EMPTY }
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Checks the shape of an engine SaveFile ({version, state}) and reads its summary. */
export function summarizeSave(data: string): { day: number; stage: number; runIndex: number } {
  if (Buffer.byteLength(data, 'utf8') > SAVE_MAX_BYTES) throw new ApiError(413, 'tooLarge')
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    throw new ApiError(400, 'invalidSave')
  }
  const file = parsed as { version?: unknown; state?: Record<string, unknown> } | null
  const st = file?.state
  if (!file || num(file.version) === null || !st || typeof st !== 'object') throw new ApiError(400, 'invalidSave')
  const time = st.time as { day?: unknown } | undefined
  const meta = st.meta as { runIndex?: unknown } | undefined
  const day = num(time?.day)
  const stage = num(st.stage)
  if (day === null || day < 0 || stage === null || !Number.isInteger(stage) || stage < 0 || stage > 6 || !st.stats)
    throw new ApiError(400, 'invalidSave')
  return { day, stage, runIndex: Math.max(0, Math.floor(num(meta?.runIndex) ?? 0)) }
}

export async function writeSave(
  kv: Kv,
  h: string,
  body: Record<string, unknown>,
): Promise<SaveMeta> {
  const data = body.data
  const baseRev = body.baseRev
  if (typeof data !== 'string' || typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 0)
    throw new ApiError(400, 'badRequest')
  const summary = summarizeSave(data)
  const lockKey = `lock:${keys.save(h)}`
  // Two writes racing between read and write: the loser answers `conflict` and retries with the fresh rev.
  if (!(await kv.set(lockKey, '1', { nx: true, ex: WRITE_LOCK_S }))) {
    throw new ApiError(409, 'conflict', { server: await readSave(kv, h) })
  }
  try {
    const current = await readSave(kv, h)
    if (baseRev !== current.rev && body.force !== true) {
      throw new ApiError(409, 'conflict', { server: current })
    }
    const next: StoredSave = { rev: current.rev + 1, updatedAt: now(), ...summary, data }
    await kv.set(keys.save(h), JSON.stringify(next))
    return { rev: next.rev, updatedAt: next.updatedAt, day: next.day, stage: next.stage, runIndex: next.runIndex }
  } finally {
    await kv.del(lockKey)
  }
}
