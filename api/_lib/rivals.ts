// House rivals: a few made-up companies on the live board so an early player has someone to chase. They have no
// account (member `rival:{id}`, never an e-mail hash), write straight into `lb` / `lb:row:*`, and move with real
// time: each one plays a run at its own pace up to its own stage and valuation ceiling, then holds there (or, with
// `rest`, goes bankrupt and starts over). The current roster is a staircase from ~$1M up to ~$300M, no Unicorn; a
// peak-6 rival would finish once and keep its row, like a player's kept Unicorn.
//
// Everything is a pure function of the clock (no stored state), refreshed at most every TICK_S from the board read.
// LB_RIVALS=1 turns them on; LB_RIVALS=0 takes their rows off the board; unset leaves the board alone.
import type { RunStatus } from '../../src/net/contract.js'
import type { Kv } from './kv.js'
import { keys } from './auth.js'
import { lbScore } from './leaderboard.js'
import { MEASURED_FASTEST_DAYS, MIN_DAY_FOR_STAGE, STAGE_SLOTS, STAGE_TARGET, UNICORN_STAGE as UNICORN } from '../../src/net/stageRules.js'

const DAY_MS = 24 * 3600 * 1000
/** Real-time origin of every rival's schedule. */
export const RIVAL_EPOCH = Date.UTC(2026, 9, 1)
const TICK_KEY = 'lb:rivals:tick'
const TICK_S = 300
/** Valuation a run shows on day 0 (Garaj has no target). */
const GARAGE_VALUATION = 60_000
/** Game days a rival keeps growing at its top stage before it goes bankrupt. */
const PLATEAU_DAYS = 140
/** Share of `pace` a holding rival keeps playing at once it has topped out. */
const HOLD_PACE = 0.25

export interface Rival {
  id: string
  companyName: string
  email: string
  /** Highest stage a run reaches (6 = finishes as Unicorn and stays). */
  peak: number
  /** Where growth at the top stage stalls, as a share of the next stage's target (default 0.7). */
  top?: number
  /** Multiplier on the fastest measured stage days (≥ 1: never faster than the best bot run). */
  slow: number
  /** Game days played per real day. */
  pace: number
  /** Real days spent bankrupt on the board before a new run; absent = never goes bankrupt, holds at the top. */
  rest?: number
  /** Real days already played at RIVAL_EPOCH. */
  head: number
}

export const RIVALS: readonly Rival[] = [
  { id: 'filika', companyName: 'Filika Labs', email: 'cagri.yildiz@gmail.com', peak: 5, top: 0.31, slow: 1.1, pace: 40, head: 34 },
  { id: 'kumbara', companyName: 'Kumbara Pay', email: 'mert.aydogan@icloud.com', peak: 4, top: 0.55, slow: 1.22, pace: 45, head: 24 },
  { id: 'sarnic', companyName: 'Sarnıç.io', email: 'elif.durmaz@outlook.com', peak: 4, top: 0.3, slow: 1.18, pace: 45, head: 20 },
  { id: 'rota', companyName: 'Rota Go', email: 'b.ozkan@hotmail.com', peak: 3, top: 0.5, slow: 1.3, pace: 35, head: 18 },
  { id: 'defne', companyName: 'Defne AI', email: 'defne.kocak@gmail.com', peak: 3, top: 0.25, slow: 1.45, pace: 35, head: 15 },
  { id: 'karinca', companyName: 'Karınca Works', email: 'onur.tas@yandex.com', peak: 2, top: 0.6, slow: 1.35, pace: 30, head: 9 },
  { id: 'tava', companyName: 'Tava Games', email: 'selin.ak@gmail.com', peak: 2, top: 0.22, slow: 1.5, pace: 30, head: 7 },
  { id: 'bereket', companyName: 'Bereket Cloud', email: 'hakan.e@outlook.com', peak: 1, top: 0.4, slow: 1.6, pace: 25, head: 4 },
]

export interface RivalRow {
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

export const rivalMember = (r: Rival) => `rival:${r.id}`

/** Deterministic noise in [-1, 1) from a few integers. */
function noise(...xs: number[]): number {
  let h = 2166136261
  for (const x of xs) h = Math.imul(h ^ (x | 0), 16777619) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
  return ((h ^ (h >>> 13)) >>> 0) / 2 ** 31 - 1
}

/** Game day each stage is reached in this rival's runs (never earlier than the server would believe). */
export function stageDays(r: Rival): number[] {
  return MEASURED_FASTEST_DAYS.map((d, s) => Math.max(MIN_DAY_FOR_STAGE[s]!, Math.round(d * r.slow)))
}

const lerpLog = (a: number, b: number, f: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * Math.min(1, Math.max(0, f)))

/** Where a rival stands at real time `t` (null before it has played a day). */
export function rivalRow(r: Rival, t: number): RivalRow | null {
  const sd = stageDays(r)
  const runGameDays = r.peak >= UNICORN ? sd[UNICORN]! : sd[r.peak]! + PLATEAU_DAYS
  const active = runGameDays / r.pace
  // Without `rest` a rival never goes bankrupt: it holds at its top stage and keeps playing there, slower.
  const holds = r.peak < UNICORN && !r.rest
  const cycle = active + (r.rest ?? 0)
  const played = (t - RIVAL_EPOCH) / DAY_MS + r.head
  if (played <= 0) return null

  let runIndex = holds ? 0 : Math.floor(played / cycle)
  let inRun = played - runIndex * cycle
  if (r.peak >= UNICORN && runIndex >= 1) {
    // Finished as Unicorn on its first run: the row stays where it won.
    runIndex = 0
    inRun = active
  }
  const day = holds && inRun > active ? runGameDays + (inRun - active) * r.pace * HOLD_PACE : Math.min(runGameDays, inRun * r.pace)
  if (day < 1) return null
  const done = !holds && inRun >= active

  let stage = 0
  while (stage < r.peak && day >= sd[stage + 1]!) stage++
  const seed = [...r.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)
  const lo = stage === 0 ? GARAGE_VALUATION : STAGE_TARGET[stage]!
  let valuation: number
  if (stage >= UNICORN) {
    valuation = STAGE_TARGET[UNICORN]! * (1.08 + 0.25 * (noise(runIndex, 7, seed) + 1) / 2)
  } else if (stage < r.peak) {
    valuation = lerpLog(lo, STAGE_TARGET[stage + 1]! * 0.92, (day - sd[stage]!) / (sd[stage + 1]! - sd[stage]!))
  } else {
    // Top stage: growth slows and stalls short of the next round.
    const f = (day - sd[stage]!) / PLATEAU_DAYS
    valuation = lerpLog(lo, STAGE_TARGET[stage + 1]! * (r.top ?? 0.7), Math.sqrt(f))
  }
  const dayKey = Math.floor(day / 5)
  if (stage < UNICORN) valuation *= 1 + 0.04 * noise(dayKey, runIndex, seed)
  const status: RunStatus = stage >= UNICORN ? 'unicorn' : done ? 'bankrupt' : 'playing'
  const cash =
    status === 'bankrupt' ? -Math.round(valuation * (0.01 + 0.02 * (noise(runIndex, 3) + 1)))
    : Math.round(valuation * (0.05 + 0.04 * (noise(dayKey, 11, runIndex) + 1)))
  const fill = stage < r.peak ? (day - sd[stage]!) / Math.max(1, (sd[stage + 1] ?? day + 1) - sd[stage]!) : 0.8
  const team = Math.max(1, Math.round(STAGE_SLOTS[stage]! * (0.35 + 0.5 * Math.min(1, fill))) + 1)
  // The row last changed when the rival last played (rounded to whole game days).
  const finishedAt = RIVAL_EPOCH + (runIndex * cycle + Math.min(inRun, active) - r.head) * DAY_MS
  const updatedAt = Math.min(t, Math.floor(finishedAt / 60_000) * 60_000)
  return {
    email: r.email,
    companyName: r.companyName,
    stage,
    valuation: Math.round(valuation),
    cash,
    day: Math.floor(day),
    team,
    status,
    runIndex,
    updatedAt,
  }
}

/** Puts every rival where the clock says (or removes them with LB_RIVALS=0). At most once per TICK_S. */
export async function tickRivals(kv: Kv, t: number, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const mode = env.LB_RIVALS
  if (mode !== '1' && mode !== '0') return false
  if (!(await kv.set(TICK_KEY, String(t), { nx: true, ex: TICK_S }))) return false
  for (const r of RIVALS) {
    const m = rivalMember(r)
    const row = mode === '1' ? rivalRow(r, t) : null
    if (!row) {
      await kv.zrem(keys.lb, m)
      await kv.del(keys.lbRow(m))
      continue
    }
    await kv.set(keys.lbRow(m), JSON.stringify(row))
    await kv.zadd(keys.lb, lbScore(row.stage, row.valuation, row.day), m)
  }
  return true
}
