// Source floats (P5 "kim ne için yapıyor, neye faydası oldu"): when Kasa or Kullanıcı jumps by a meaningful amount, the
// gauge shows a tiny float naming the source ("Reklam +40", "Maaş günü −$12K", "Alım −$2K"). One at a time,
// FLOAT_SHOW_MS each, queued (the oldest drop past FLOAT_QUEUE_MAX). Detection is pure (detectFloats, tested); the
// store wiring below runs in the browser only and never replays a loaded run's past.
import { useSyncExternalStore } from 'react'
import { freeCash } from '../engine/loopSelectors'
import type { Action, GameEvent, GameState } from '../engine/types'
import { onAction, useGameStore } from '../store/gameStore'
import { money, signedMoney, signedNum } from './format'
import { t } from './i18n'

export const FLOAT_SHOW_MS = 2500
export const FLOAT_QUEUE_MAX = 3
/** Game days the slow user flow (ads, organic) is summed over before it may float. */
export const USERS_WINDOW_DAYS = 7

export type FloatGauge = 'cash' | 'users'

export interface SourceFloat {
  id: number
  gauge: FloatGauge
  text: string
  good: boolean
}

/** What the slow user flow has summed since its last float. */
export interface FlowAcc {
  users: number
  days: number
}

export const emptyAcc = (): FlowAcc => ({ users: 0, days: 0 })

const ACTION_KEY: Partial<Record<Action['type'], string>> = {
  placeItem: 'float.src.buy',
  upgradeItem: 'float.src.buy',
  sellItem: 'float.src.sellItem',
  openRing: 'float.src.ring',
  hire: 'float.src.hire',
  fire: 'float.src.fire',
  buildModule: 'float.src.module',
  refreshModule: 'float.src.module',
  answerDecision: 'float.src.decision',
  resolvePayday: 'float.src.payday',
  openSegment: 'float.src.segment',
  acquireRival: 'float.src.acquire',
  adoptPolicy: 'float.src.policy',
  renewContract: 'float.src.contract',
  startProject: 'float.src.project',
  founderAction: 'float.src.founder',
  respondResignation: 'float.src.decision',
}

const EVENT_KEY: Partial<Record<GameEvent['kind'], string>> = {
  roundClosed: 'float.src.round',
  loanTaken: 'float.src.loan',
  loanCalled: 'float.src.loanCalled',
  crisis: 'float.src.crisis',
  eviction: 'float.src.eviction',
  decisionDefaulted: 'float.src.decision',
  delayedEffect: 'float.src.later',
  paydayAutoResolved: 'float.src.payday',
  rivalAcquired: 'float.src.acquire',
}

const CHANNEL_KEY = { organic: 'float.src.organic', paid: 'float.src.ads', manual: 'float.src.manual', enterprise: 'float.src.enterprise' } as const

function freshEvents(prev: GameState, next: GameState): GameEvent[] {
  const since = prev.events.length ? prev.events[prev.events.length - 1]!.id : 0
  return next.events.filter((e) => e.id > since)
}

/** A cash jump worth a float: $300, or 3% of the money (whichever is more). */
export function cashThreshold(usable: number): number {
  return Math.max(300, 0.03 * Math.abs(usable))
}

/** A user swing worth a float: 10, or 3% of the users. */
export function usersThreshold(users: number): number {
  return Math.max(10, 0.03 * users)
}

/**
 * The floats one state change brings (pure). `action` = the player's action that made it (null for a tick).
 * Cash: the change in usable money beyond the steady daily net (a purchase, a round, a crisis), plus the payday lump.
 * Users: a release floats at once; the slow flow (ads, organic, churn) sums over USERS_WINDOW_DAYS. A founder's own
 * find already rises over its slot (FloatingNumber), so it is not repeated here.
 */
export function detectFloats(prev: GameState, next: GameState, action: Action | null, acc: FlowAcc): { floats: Omit<SourceFloat, 'id'>[]; acc: FlowAcc } {
  const out: Omit<SourceFloat, 'id'>[] = []
  const events = freshEvents(prev, next)
  const days = Math.max(0, next.time.day - prev.time.day)

  // Cash.
  const before = freeCash(prev)
  const after = freeCash(next)
  const jump = after - before - (next.finance.net / 30) * days
  if (Math.abs(jump) >= cashThreshold(before)) {
    const evKey = events.map((e) => EVENT_KEY[e.kind]).find(Boolean)
    const key = (action && ACTION_KEY[action.type]) || evKey || 'float.src.cash'
    out.push({ gauge: 'cash', text: `${t(key)} ${signedMoney(Math.round(jump))}`, good: jump > 0 })
  }
  const pay = events.find((e) => e.kind === 'payday')
  if (pay && (pay.value ?? 0) >= 1) out.push({ gauge: 'cash', text: `${t('float.src.payday')} ${money(-(pay.value ?? 0))}`, good: false })

  // Users.
  const du = next.stats.users - prev.stats.users
  const release = events.some((e) => e.kind === 'release')
  const found = events.some((e) => e.kind === 'founderActionDone' && e.refId === 'findUsers')
  let a = acc
  if (release && du >= usersThreshold(prev.stats.users) / 2) out.push({ gauge: 'users', text: `${t('float.src.release')} ${signedNum(Math.round(du))}`, good: true })
  else if (action !== null && ACTION_KEY[action.type] && Math.abs(du) >= usersThreshold(prev.stats.users)) out.push({ gauge: 'users', text: `${t(ACTION_KEY[action.type]!)} ${signedNum(Math.round(du))}`, good: du > 0 })
  else if (!found && action === null) a = { users: acc.users + du, days: acc.days + days }
  if (a.days >= USERS_WINDOW_DAYS) {
    const n = Math.round(a.users)
    if (Math.abs(n) >= usersThreshold(next.stats.users)) {
      const ch = next.derived.channels
      const top = ch ? (Object.keys(CHANNEL_KEY) as (keyof typeof CHANNEL_KEY)[]).reduce((b, k) => (ch[k] > ch[b] ? k : b), 'organic') : 'organic'
      out.push({ gauge: 'users', text: `${t(n > 0 ? CHANNEL_KEY[top] : 'float.src.churn')} ${signedNum(n)}`, good: n > 0 })
    }
    a = emptyAcc()
  }
  return { floats: out, acc: a }
}

// ---------------------------------------------------------------------------
// The queue (one float at a time) + the store wiring
// ---------------------------------------------------------------------------

let queue: SourceFloat[] = []
let current: SourceFloat | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((f) => f())

function advance(): void {
  current = queue.shift() ?? null
  emit()
  if (current) timer = setTimeout(advance, FLOAT_SHOW_MS)
  else timer = undefined
}

export function pushFloats(items: Omit<SourceFloat, 'id'>[]): void {
  if (!items.length) return
  queue = [...queue, ...items.map((x) => ({ ...x, id: nextId++ }))].slice(-FLOAT_QUEUE_MAX)
  if (!timer) advance()
}

/** A float is on screen now (first-run hints wait for it: they would cover it). */
export const floatShowing = (): boolean => current !== null

/** Drops everything (a new run, a load). */
export function clearFloats(): void {
  if (timer) clearTimeout(timer)
  timer = undefined
  queue = []
  current = null
  emit()
}

/** The float on screen now for `gauge` (null = none, or the other gauge's turn). */
export function useSourceFloat(gauge: FloatGauge): SourceFloat | null {
  const f = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => null,
  )
  return f && f.gauge === gauge ? f : null
}

if (typeof window !== 'undefined') {
  let acc = emptyAcc()
  let lastAction: Action | null = null
  onAction((a) => {
    if (a.type !== 'setSpeed') lastAction = a
  })
  useGameStore.subscribe((st, prev) => {
    if (st.ui.generation !== prev.ui.generation) {
      acc = emptyAcc()
      lastAction = null
      clearFloats()
      return
    }
    if (st.state === prev.state) return
    const action = lastAction
    lastAction = null
    // Only a running game: nothing floats before the first Başlat or after the end.
    if (!st.ui.runStarted || st.state.gameOver) return
    const r = detectFloats(prev.state, st.state, action, acc)
    acc = r.acc
    pushFloats(r.floats)
  })
}
