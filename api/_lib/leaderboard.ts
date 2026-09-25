// Live leaderboard. One sorted set `lb` (member = e-mail hash) ordered by stage first, then valuation; among
// Unicorns fewer game days wins. Visible fields live in `lb:row:{h}`; the per-run plausibility track (what the
// last accepted submission said, and when) lives in `lb:track:{h}` so a kept Unicorn row never blocks a new run.
import type { LeaderboardGap, LeaderboardOk, LeaderboardRow, LeaderboardSubmitOk, RunStatus } from '../../src/net/contract.js'
import { ApiError, now } from './http.js'
import type { Kv } from './kv.js'
import { keys, maskEmail, sanitizeCompanyName, writeUser, type AuthedUser } from './auth.js'
import { MAX_SPEED, SECONDS_PER_DAY, STAGE_COUNT, STAGE_SLOTS, STAGE_TARGET, UNICORN_STAGE as UNICORN } from '../../src/net/stageRules.js'

// Plausibility limits (lenient: they stop edited numbers, not good play).
export const MIN_DAYS_PER_STAGE = 5
const CLOCK_SLACK = 1.25
const DAY_SLACK = 3
const FIRST_SUBMIT_GRACE_DAYS = 30
const MAX_DAY = 36_500
const REPLAY_MAX_BYTES = 256 * 1024
const REPLAY_TTL_S = 30 * 24 * 3600
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

interface StoredRow {
  email: string
  companyName: string
  stage: number
  valuation: number
  cash: number
  day: number
  team: number
  status: RunStatus
  runIndex: number
  updatedAt: number
}

interface Track {
  runIndex: number
  stage: number
  day: number
  valuation: number
  at: number
}

const trackKey = (h: string) => `lb:track:${h}`

/** Stage first; within Unicorn fewer days first; then valuation. Always < 7e12, exact in a double. */
export function lbScore(stage: number, valuation: number, day: number): number {
  const v = Math.max(0, valuation)
  if (stage >= UNICORN) {
    const d = Math.min(999_999, Math.max(0, Math.round(day)))
    return UNICORN * 1e12 + (1_000_000 - d) * 100_000 + Math.min(99_999, Math.floor(v / 1e5))
  }
  return stage * 1e12 + Math.min(1e12 - 1, Math.floor(v))
}

function maxValuation(stage: number): number {
  return stage >= UNICORN ? 1e11 : (STAGE_TARGET[stage + 1] ?? 1e9) * 20
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function bad(detail: string): never {
  throw new ApiError(422, 'invalidMetrics', { detail })
}

export interface Submission {
  stage: number
  valuation: number
  cash: number
  day: number
  team: number
  runIndex: number
  status: RunStatus
  companyName: string | null
}

/** Shape and absolute limits of one submission (no history needed). */
export function parseSubmission(body: Record<string, unknown>): Submission {
  const stage = finite(body.stage)
  const valuation = finite(body.valuation)
  const cash = finite(body.cash)
  const day = finite(body.day)
  const team = finite(body.team)
  const runIndex = finite(body.runIndex ?? 0)
  if (stage === null || valuation === null || cash === null || day === null || team === null || runIndex === null)
    throw new ApiError(400, 'badRequest')
  if (!Number.isInteger(stage) || stage < 0 || stage >= STAGE_COUNT) bad('stage')
  if (!Number.isInteger(runIndex) || runIndex < 0 || runIndex > 100_000) bad('runIndex')
  if (day < 0 || day > MAX_DAY) bad('day')
  if (!Number.isInteger(team) || team < 0 || team > STAGE_SLOTS[stage]! * 2 + 5) bad('team')
  if (valuation < 0 || valuation > maxValuation(stage)) bad('valuation')
  if (stage === UNICORN && valuation < STAGE_TARGET[UNICORN]! * 0.5) bad('unicornValuation')
  if (cash < -1e9 || cash > Math.max(2_000_000, valuation * 3)) bad('cash')
  if (stage * MIN_DAYS_PER_STAGE > day + 1) bad('stageTooFast')
  const rawStatus = body.status
  let status: RunStatus = stage === UNICORN ? 'unicorn' : 'playing'
  if (rawStatus !== undefined) {
    if (rawStatus !== 'playing' && rawStatus !== 'bankrupt' && rawStatus !== 'unicorn') throw new ApiError(400, 'badRequest')
    if ((rawStatus === 'unicorn') !== (stage === UNICORN)) bad('status')
    status = rawStatus
  }
  const companyName = body.companyName === undefined ? null : sanitizeCompanyName(body.companyName)
  return { stage, valuation, cash, day, team, runIndex, status, companyName }
}

/** Game days that fit in `ms` of wall time at the fastest speed (+ slack). */
function daysPossible(ms: number, extra: number): number {
  return (Math.max(0, ms) / 1000 / SECONDS_PER_DAY) * MAX_SPEED * CLOCK_SLACK + extra
}

/** Checks a submission against the previous one of the same run (or the account age for a run's first). */
export function checkProgress(s: Submission, prev: Track | null, createdAt: number, t: number): void {
  if (!prev || s.runIndex > prev.runIndex) {
    if (s.day > daysPossible(t - createdAt, FIRST_SUBMIT_GRACE_DAYS)) bad('dayVsClock')
    return
  }
  if (s.runIndex < prev.runIndex) throw new ApiError(409, 'staleRun')
  if (s.day < prev.day - 0.01) bad('dayBackwards')
  if (s.stage < prev.stage) bad('stageBackwards')
  const dDay = s.day - prev.day
  if (dDay > daysPossible(t - prev.at, DAY_SLACK)) bad('dayVsClock')
  if ((s.stage - prev.stage) * MIN_DAYS_PER_STAGE > dDay + 1) bad('stageJump')
  const cap = Math.max(prev.valuation, 1_000_000) * 10 ** (1 + dDay / 60)
  if (s.valuation > cap) bad('valuationJump')
}

async function readJson<T>(kv: Kv, key: string): Promise<T | null> {
  const raw = await kv.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function toRow(r: StoredRow, rank: number, mine: boolean): LeaderboardRow {
  const row: LeaderboardRow = {
    rank,
    companyName: r.companyName,
    email: mine ? r.email : maskEmail(r.email),
    stage: r.stage,
    valuation: r.valuation,
    cash: r.cash,
    day: Math.floor(r.day),
    team: r.team,
    status: r.status,
    updatedAt: r.updatedAt,
  }
  if (mine) row.me = true
  return row
}

export async function submit(kv: Kv, me: AuthedUser, body: Record<string, unknown>): Promise<LeaderboardSubmitOk> {
  const s = parseSubmission(body)
  const t = now()
  const h = me.emailHash
  const prev = await readJson<Track>(kv, trackKey(h))
  checkProgress(s, prev, me.user.createdAt, t)

  let replayJson: string | null = null
  if (body.replay !== undefined) {
    replayJson = JSON.stringify(body.replay)
    if (Buffer.byteLength(replayJson, 'utf8') > REPLAY_MAX_BYTES) throw new ApiError(413, 'tooLarge')
  }

  if (s.companyName && s.companyName !== me.user.companyName) {
    me.user.companyName = s.companyName
    await writeUser(kv, h, me.user)
  }
  const track: Track = { runIndex: s.runIndex, stage: s.stage, day: s.day, valuation: s.valuation, at: t }
  await kv.set(trackKey(h), JSON.stringify(track))
  // The replay is kept for audit when the stage changes (a full server-side re-simulation is not run here).
  if (replayJson && (!prev || prev.runIndex !== s.runIndex || prev.stage !== s.stage))
    await kv.set(keys.lbReplay(h), replayJson, { ex: REPLAY_TTL_S })

  const score = lbScore(s.stage, s.valuation, s.day)
  const shown = await readJson<StoredRow>(kv, keys.lbRow(h))
  // A finished Unicorn from an earlier run stays on the board until a better run replaces it.
  const keepShown =
    shown !== null && shown.status === 'unicorn' && shown.runIndex !== s.runIndex && lbScore(shown.stage, shown.valuation, shown.day) >= score
  let rowData: StoredRow
  if (keepShown) {
    rowData = { ...shown, companyName: me.user.companyName }
  } else {
    rowData = {
      email: me.user.email,
      companyName: me.user.companyName,
      stage: s.stage,
      valuation: Math.round(s.valuation),
      cash: Math.round(s.cash),
      day: s.day,
      team: s.team,
      status: s.status,
      runIndex: s.runIndex,
      updatedAt: t,
    }
    await kv.zadd(keys.lb, score, h)
  }
  await kv.set(keys.lbRow(h), JSON.stringify(rowData))
  topCache = null
  const rank = ((await kv.zrevrank(keys.lb, h)) ?? 0) + 1
  const total = await kv.zcard(keys.lb)
  return { rank, total, row: toRow(rowData, rank, true) }
}

export function gapTo(me: LeaderboardRow, above: LeaderboardRow): LeaderboardGap {
  const stages = Math.max(0, above.stage - me.stage)
  const sameUnicorn = me.stage >= UNICORN && above.stage >= UNICORN
  return {
    stages,
    valuation: stages === 0 && !sameUnicorn ? Math.max(0, above.valuation - me.valuation) : 0,
    days: sameUnicorn ? Math.max(0, me.day - above.day) : 0,
  }
}

export function parseLimit(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? Math.min(MAX_LIMIT, n) : DEFAULT_LIMIT
}

/** Warm function instances share the top list for a few seconds (every player polls every 10 s). */
const TOP_CACHE_MS = 4000
let topCache: { kv: Kv; limit: number; at: number; top: { member: string; row: StoredRow }[]; total: number } | null = null

async function readTop(kv: Kv, limit: number): Promise<{ top: { member: string; row: StoredRow }[]; total: number }> {
  const t = now()
  if (topCache && topCache.kv === kv && topCache.limit === limit && t - topCache.at < TOP_CACHE_MS) return topCache
  const members = await kv.zrevrange(keys.lb, 0, limit - 1)
  const raws = await kv.mget(members.map((m) => keys.lbRow(m.member)))
  const top: { member: string; row: StoredRow }[] = []
  members.forEach((m, i) => {
    const raw = raws[i]
    if (!raw) return
    try {
      top.push({ member: m.member, row: JSON.parse(raw) as StoredRow })
    } catch {
      /* skip a corrupt row */
    }
  })
  const total = await kv.zcard(keys.lb)
  topCache = { kv, limit, at: t, top, total }
  return topCache
}

export async function list(kv: Kv, caller: AuthedUser | null, limit: number): Promise<LeaderboardOk> {
  const { top, total } = await readTop(kv, limit)
  const rows = top.map((x, i) => toRow(x.row, i + 1, caller?.emailHash === x.member))
  const out: LeaderboardOk = { rows, total, now: now() }
  if (!caller) return out
  const r = await kv.zrevrank(keys.lb, caller.emailHash)
  if (r === null) return out
  const mine = await readJson<StoredRow>(kv, keys.lbRow(caller.emailHash))
  if (!mine) return out
  out.me = toRow(mine, r + 1, true)
  if (r > 0) {
    const [aboveMember] = await kv.zrevrange(keys.lb, r - 1, r - 1)
    const aboveRow = aboveMember ? await readJson<StoredRow>(kv, keys.lbRow(aboveMember.member)) : null
    if (aboveRow) {
      out.above = toRow(aboveRow, r, false)
      out.gap = gapTo(out.me, out.above)
    }
  }
  return out
}
