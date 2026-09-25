// Online glue between the game store and the API client (api.ts): who is signed in, which save to continue
// (local or cloud), background cloud saves, leaderboard submissions and the live board.
// Everything here is best effort: without a backend the game runs exactly as before (local save only).
//
// Cloud save:  every payday, every 30 s and when the page hides (debounced, one write in flight; a failed write
//              stays dirty and goes out on the next trigger or when the browser comes back online).
// Submit:      stage change (with the replay for audit), payday, game over and every 60 s.
// Leaderboard: every 10 s while the Liderlik panel is open (each refresh sends my standing first, so my row matches
//              the HUD), every 60 s otherwise (top-bar rank badge).
// Backend down at start: a stored token is tried anyway; otherwise the backend is probed again every 30 s–2 min
//              and on the browser's 'online' event, and sign-in / cloud sync pick up when it answers.
import { create } from 'zustand'
import { deserialize, serialize } from '../engine'
import type { GameState } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { clearSave, readProfile, readSave, readSaveMeta, setSaveOwner, writeProfile, writeSave } from '../store/save'
import {
  backendStatus,
  currentSession,
  getLeaderboard,
  getSave,
  logout,
  putSave,
  resumeSession,
  submitScore,
  type AuthOk,
  type BackendStatus,
  type LeaderboardOk,
  type LeaderboardSubmitBody,
  type RunStatus,
  type SaveGetOk,
} from './api'
import { NET_RUN_REFUSED } from './netText'
import { patchSession } from './session'

export const CLOUD_SAVE_MS = 30_000
export const SUBMIT_MS = 60_000
export const BOARD_OPEN_MS = 10_000
export const BOARD_IDLE_MS = 60_000
/** Replays above this are not sent (the server caps them at 200 KB). */
const REPLAY_MAX_CHARS = 190_000

export type CloudPhase = 'boot' | 'login' | 'ready'
export type SyncState = 'idle' | 'saving' | 'offline' | 'conflict' | 'signedOut'

export interface Account {
  email: string
  companyName: string
}

export interface CloudState {
  /** boot: probing; login: sign-in card; ready: start screen / game. */
  phase: CloudPhase
  backend: BackendStatus | null
  /** Signed-in account (null = offline play). */
  account: Account | null
  sync: SyncState
  /** Date.now() of the last accepted cloud write. */
  lastSyncAt: number | null
  /** Another device wrote further progress: the player picks (Ayarlar › Hesap). */
  conflict: SaveGetOk | null
  /** Run index of the cloud save seen at sign-in (a new game must go past it, or the board calls it stale). */
  cloudRunIndex: number
  /** The start screen should say the cloud save was taken. */
  cloudLoaded: boolean
  board: LeaderboardOk | null
  /** Date.now() when `board` arrived. */
  boardAt: number | null
  boardError: string | null
  /** Last submit refused (Turkish message), null when fine. */
  submitError: string | null
  /** My rank (from the last submit or board). */
  rank: number | null
}

const initial: CloudState = {
  phase: 'boot',
  backend: null,
  account: null,
  sync: 'idle',
  lastSyncAt: null,
  conflict: null,
  cloudRunIndex: -1,
  cloudLoaded: false,
  board: null,
  boardAt: null,
  boardError: null,
  submitError: null,
  rank: null,
}

export const useCloud = create<CloudState>()(() => ({ ...initial }))

const setCloud = (p: Partial<CloudState>) => useCloud.setState(p)

// --- sign-in / which save -----------------------------------------------------------------------------------------

/** Set by the App while a run is on screen (a recovered backend must not swap the save under a running game). */
let runOnScreen = false
export function setRunOnScreen(on: boolean): void {
  runOnScreen = on
}

/** App start: backend up? token on this device? → ready (with the cloud save pulled) or the sign-in card. */
export async function bootCloud(): Promise<void> {
  let status = await backendStatus()
  // The health probe can fail on a cold start or a blip; a stored token gets its own chance before going offline.
  if (status === 'offline' && currentSession()) {
    const me = await resumeSession()
    if (me.ok) {
      setCloud({ backend: 'online' })
      return adoptAccount({ email: me.data.email, companyName: me.data.companyName })
    }
    if (me.error === 'unauthorized') status = await backendStatus(true)
  }
  if (status === 'offline') {
    setSaveOwner(null)
    setCloud({ backend: 'offline', phase: 'ready' })
    watchBackend()
    return
  }
  setCloud({ backend: 'online' })
  if (!currentSession()) {
    setCloud({ phase: 'login' })
    return
  }
  const me = await resumeSession()
  if (me.ok) return adoptAccount({ email: me.data.email, companyName: me.data.companyName })
  if (me.error === 'unauthorized') {
    setCloud({ phase: 'login' })
    return
  }
  // Token kept but the server did not answer: play on, the sync retries later.
  const s = currentSession()
  if (!s) {
    setCloud({ phase: 'login' })
    return
  }
  setSaveOwner(s.email)
  setCloud({ account: { email: s.email, companyName: s.companyName }, sync: 'offline', phase: 'ready' })
}

let watchStop: (() => void) | null = null
export const REPROBE_MIN_MS = 30_000
const REPROBE_MAX_MS = 120_000

/** Offline at start: probe again (30 s, doubling to 2 min, and on 'online') until the backend answers. */
function watchBackend(): void {
  if (watchStop || typeof window === 'undefined') return
  let wait = REPROBE_MIN_MS
  let timer: ReturnType<typeof setTimeout> | null = null
  const check = async () => {
    timer = null
    if ((await backendStatus(true)) === 'online') {
      watchStop?.()
      await backendBack()
      return
    }
    wait = Math.min(REPROBE_MAX_MS, wait * 2)
    timer = setTimeout(check, wait)
  }
  const onOnline = () => {
    if (timer) clearTimeout(timer)
    void check()
  }
  timer = setTimeout(check, wait)
  window.addEventListener('online', onOnline)
  watchStop = () => {
    if (timer) clearTimeout(timer)
    window.removeEventListener('online', onOnline)
    watchStop = null
  }
}

/** The backend answers again after an offline start. */
async function backendBack(): Promise<void> {
  setCloud({ backend: 'online' })
  if (!currentSession()) {
    // Still on the start card: offer sign-in. A running offline game just plays on.
    if (!runOnScreen && !useCloud.getState().account) setCloud({ phase: 'login' })
    return
  }
  const me = await resumeSession()
  if (!me.ok) {
    if (me.error === 'unauthorized' && !runOnScreen) setCloud({ phase: 'login' })
    return
  }
  const acc = { email: me.data.email, companyName: me.data.companyName }
  if (!runOnScreen) return adoptAccount(acc)
  // Mid-game: keep the run; the cloud sync that now starts settles who is further (409 path).
  setSaveOwner(acc.email)
  setCloud({ account: acc, sync: 'idle' })
}

/** After register / login on the sign-in card. */
export function afterAuth(a: AuthOk): Promise<void> {
  return adoptAccount({ email: a.email, companyName: a.companyName })
}

/** Sign-in card › "Çevrimdışı oyna": local save only, no board entry. */
export function playOffline(): void {
  setSaveOwner(null)
  setCloud({ account: null, phase: 'ready' })
}

async function adoptAccount(acc: Account): Promise<void> {
  setSaveOwner(acc.email)
  setCloud({ account: acc, sync: 'idle', conflict: null })
  await pullCloud(acc.email)
  setCloud({ phase: 'ready' })
}

function progressOf(s: GameState): [number, number] {
  return [s.meta.runIndex, s.time.day]
}

/** a is further than b (run first, then game day). */
function ahead(a: [number, number], b: [number, number]): boolean {
  return a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1]
}

/**
 * Picks the save to continue: the cloud copy when there is no local one, the local one belongs to another account,
 * the cloud run is newer, or (same run) the cloud is further in game days. Game progress decides, never the two
 * machines' clocks. The chosen copy lands in the local slot, so the start screen and store.load() see it.
 */
export async function pullCloud(email: string): Promise<void> {
  const r = await getSave()
  if (!r.ok) {
    setCloud({ sync: r.error === 'unauthorized' ? 'signedOut' : 'offline' })
    return
  }
  const local = readSave()
  const meta = readSaveMeta()
  const foreign = !!meta?.owner && meta.owner !== email
  const cloud = r.data.data ? safeDeserialize(r.data.data) : null
  setCloud({ cloudRunIndex: cloud ? cloud.meta.runIndex : -1 })
  const useCloudCopy = !!cloud && (!local || foreign || ahead(progressOf(cloud), progressOf(local)))
  if (cloud && useCloudCopy) {
    const prof = readProfile()
    const over = cloud.gameOver
    writeProfile({
      founderXp: Math.max(prof.founderXp, cloud.meta.founderXp + (over?.xpEarned ?? 0)),
      runIndex: Math.max(prof.runIndex, cloud.meta.runIndex + (over ? 1 : 0)),
    })
    if (over) clearSave()
    else writeSave(cloud)
    // "Buluttaki kayıt geldi" only when it is not what this device already had.
    setCloud({ cloudLoaded: !over && (!local || foreign || !sameProgress(cloud, local)) })
    return
  }
  // Another account's progress lives in its own cloud; this device starts clean for the new one.
  if (foreign) clearSave()
  // Offline progress made before signing in now belongs to this account.
  else if (local && !meta?.owner) writeSave(local)
}

function sameProgress(a: GameState, b: GameState): boolean {
  return a.meta.runIndex === b.meta.runIndex && Math.floor(a.time.day) === Math.floor(b.time.day)
}

function safeDeserialize(raw: string): GameState | null {
  try {
    return deserialize(raw)
  } catch {
    return null
  }
}

/** Ayarlar › Çıkış yap: last cloud write, drop the token, back to the sign-in card (page reload). `everywhere`
 * also ends the account's sessions on every other device. */
export async function signOut(opts: { everywhere?: boolean } = {}): Promise<void> {
  // Only a run on screen is saved (on the start card the store holds a placeholder game, never to be written).
  const playing = stopSync !== null
  stopCloudSync()
  if (playing && useCloud.getState().account && useCloud.getState().sync !== 'conflict') {
    useGameStore.getState().save()
    await saveNow()
  }
  await logout({ all: opts.everywhere })
  setSaveOwner(null)
  useCloud.setState({ ...initial, phase: 'login', backend: useCloud.getState().backend })
  if (typeof window !== 'undefined') window.location.reload()
}

// --- cloud save -------------------------------------------------------------------------------------------------

let inflight: Promise<void> | null = null
let pending = false
let lastSaved: GameState | null = null

/** One cloud write of the current state (skipped when unchanged). A second call while one is running queues one more. */
export function saveNow(opts: { force?: boolean } = {}): Promise<void> {
  const cs = useCloud.getState()
  if (!cs.account || cs.backend !== 'online') return Promise.resolve()
  if (cs.sync === 'conflict' && !opts.force) return Promise.resolve()
  if (inflight) {
    pending = true
    return inflight
  }
  const state = useGameStore.getState().state
  if (state === lastSaved && !opts.force) return Promise.resolve()
  inflight = (async () => {
    setCloud({ sync: 'saving' })
    const r = await putSave(serialize(state), opts)
    if (r.ok) {
      lastSaved = state
      setCloud({ sync: 'idle', lastSyncAt: Date.now(), conflict: null })
    } else if (r.error === 'conflict' && 'server' in r) {
      // An older device / tab wrote in between. Ours is at least as far: keep ours. Otherwise the player picks.
      const srv = r.server
      if (!ahead([srv.runIndex, srv.day], progressOf(state))) {
        const again = await putSave(serialize(state), { force: true })
        if (again.ok) {
          lastSaved = state
          setCloud({ sync: 'idle', lastSyncAt: Date.now(), conflict: null })
        } else setCloud({ sync: 'offline' })
      } else setCloud({ sync: 'conflict', conflict: srv })
    } else if (r.error === 'unauthorized') setCloud({ sync: 'signedOut' })
    else setCloud({ sync: 'offline' })
  })().finally(() => {
    inflight = null
    if (pending) {
      pending = false
      void saveNow()
    }
  })
  return inflight
}

/** Conflict › "Buluttakini yükle": the other device's progress replaces this one. */
export function takeCloudSave(): boolean {
  const c = useCloud.getState().conflict
  if (!c?.data) return false
  const cloud = safeDeserialize(c.data)
  if (!cloud) return false
  patchSession({ cloudRev: c.rev })
  if (cloud.gameOver) clearSave()
  else writeSave(cloud)
  const loaded = !cloud.gameOver && useGameStore.getState().load()
  lastSaved = loaded ? useGameStore.getState().state : null
  setCloud({ conflict: null, sync: 'idle' })
  return loaded
}

/** Conflict › "Bu cihazdakini tut": overwrite the cloud with this device's progress. */
export function keepLocalSave(): Promise<void> {
  setCloud({ conflict: null, sync: 'idle' })
  return saveNow({ force: true })
}

// --- leaderboard submit -----------------------------------------------------------------------------------------

let lastSubmitKey = ''
/** Refused key and how often (a finished run is retried a couple of times: it will never change again). */
let failedKey = ''
let failedTimes = 0
const TERMINAL_RETRIES = 3
/** A run the board will not take (it first showed up already past Pre-seed, e.g. played offline before sign-in). */
let refusedRun = -1

function runStatus(s: GameState): RunStatus {
  if (!s.gameOver) return 'playing'
  return s.gameOver.kind === 'unicorn' && s.stage === 6 ? 'unicorn' : 'bankrupt'
}

/** Leaderboard body for a state (team counts the founder). */
export function submissionOf(s: GameState): LeaderboardSubmitBody {
  return {
    stage: s.stage,
    valuation: Math.max(0, s.finance.valuation),
    cash: s.stats.cash,
    day: s.time.day,
    team: s.employees.length + 1,
    companyName: s.meta.companyName,
    runIndex: s.meta.runIndex,
    status: runStatus(s),
  }
}

/** Sends the current standing (skipped before day 1 and when nothing changed since the last one). */
export async function submitNow(opts: { withReplay?: boolean } = {}): Promise<void> {
  const cs = useCloud.getState()
  if (!cs.account || cs.backend !== 'online') return
  const store = useGameStore.getState()
  const s = store.state
  if (s.time.day < 1) return
  const body = submissionOf(s)
  if (body.runIndex === refusedRun) return
  const key = `${body.runIndex}:${body.stage}:${Math.floor(body.day)}:${body.status}:${Math.round(body.valuation)}:${Math.round(body.cash)}:${body.team}`
  if (key === lastSubmitKey) return
  if (opts.withReplay) {
    const replay = store.exportReplay()
    if (JSON.stringify(replay).length <= REPLAY_MAX_CHARS) body.replay = replay
  }
  const r = await submitScore(body)
  if (r.ok) {
    lastSubmitKey = key
    setCloud({ rank: r.data.rank, submitError: null })
  } else if (r.error !== 'offline' && r.error !== 'rateLimited') {
    if (r.error === 'invalidMetrics' && r.detail === 'newRunStage') {
      refusedRun = body.runIndex
      setCloud({ submitError: NET_RUN_REFUSED })
      return
    }
    failedTimes = failedKey === key ? failedTimes + 1 : 1
    failedKey = key
    // A refused standing is not retried until it changes; a finished run never changes, so it gets a few more tries.
    if (!s.gameOver || failedTimes >= TERMINAL_RETRIES) lastSubmitKey = key
    setCloud({ submitError: r.message })
  }
}

// --- background sync while playing ------------------------------------------------------------------------------

let stopSync: (() => void) | null = null

function hasNewPayday(prev: GameState, next: GameState): boolean {
  const since = prev.events[prev.events.length - 1]?.id ?? 0
  for (let i = next.events.length - 1; i >= 0; i--) {
    const e = next.events[i]!
    if (e.id <= since) break
    if (e.kind === 'payday') return true
  }
  return false
}

/** Starts the background cloud save + submit while a run is on screen. Idempotent; returns stop(). */
export function startCloudSync(): () => void {
  if (stopSync) return stopSync
  const unsub = useGameStore.subscribe((st, prev) => {
    if (st.state === prev.state) return
    const s = st.state
    const p = prev.state
    if (st.ui.generation !== prev.ui.generation) {
      // New game / load: push the fresh start right away.
      void saveNow()
      return
    }
    if (s.gameOver && !p.gameOver) {
      void saveNow()
      void submitNow({ withReplay: true })
      return
    }
    if (s.stage !== p.stage) {
      void saveNow()
      void submitNow({ withReplay: true })
      return
    }
    if (hasNewPayday(p, s)) {
      void saveNow()
      void submitNow()
    }
  })
  // The run on screen (new game / continue) goes up right away.
  void saveNow()
  const saveTimer = setInterval(() => void saveNow(), CLOUD_SAVE_MS)
  const submitTimer = setInterval(() => void submitNow(), SUBMIT_MS)
  const onHide = () => {
    if (document.hidden) void saveNow()
  }
  const onPageHide = () => void saveNow()
  const onOnline = () => {
    if (useCloud.getState().sync === 'offline') {
      void saveNow()
      void submitNow()
    }
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('online', onOnline)
  const stopBoard = startBoardPolling()
  stopSync = () => {
    unsub()
    clearInterval(saveTimer)
    clearInterval(submitTimer)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('online', onOnline)
    stopBoard()
    stopSync = null
  }
  return stopSync
}

export function stopCloudSync(): void {
  stopSync?.()
}

// --- live leaderboard -------------------------------------------------------------------------------------------

function boardOpen(): boolean {
  return useGameStore.getState().ui.panel?.kind === 'leaderboard'
}

/** Fetches the board once and stores it (keeps the last good board on errors). */
export async function refreshBoard(): Promise<void> {
  if (useCloud.getState().backend !== 'online') return
  const r = await getLeaderboard(50)
  if (r.ok) setCloud({ board: r.data, boardAt: Date.now(), boardError: null, ...(r.data.me ? { rank: r.data.me.rank } : {}) })
  else setCloud({ boardError: r.message })
}

/** 10 s while Liderlik is open, 60 s otherwise (only with an account: the rank badge); paused while hidden. */
function startBoardPolling(): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastRun = 0
  const schedule = () => {
    if (stopped) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(run, boardOpen() ? BOARD_OPEN_MS : BOARD_IDLE_MS)
  }
  const run = async () => {
    timer = null
    if (stopped) return
    if (typeof document !== 'undefined' && document.hidden) return schedule()
    if (boardOpen() || useCloud.getState().account) {
      lastRun = Date.now()
      // Liderlik open: my own row should say what the top bar says, so my standing goes up first.
      if (boardOpen()) await submitNow()
      await refreshBoard()
    }
    schedule()
  }
  // Opening the panel refreshes at once (unless the board is only a few seconds old).
  const unsub = useGameStore.subscribe((st, prev) => {
    if (st.ui.panel === prev.ui.panel) return
    const open = st.ui.panel?.kind === 'leaderboard'
    const was = prev.ui.panel?.kind === 'leaderboard'
    if (open && !was) {
      if (Date.now() - lastRun > 3000) void run()
      else schedule()
    }
  })
  const onVisible = () => {
    if (!document.hidden && Date.now() - lastRun > (boardOpen() ? BOARD_OPEN_MS : BOARD_IDLE_MS)) void run()
  }
  document.addEventListener('visibilitychange', onVisible)
  void run()
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    unsub()
    document.removeEventListener('visibilitychange', onVisible)
  }
}

/** Tests: forget module state. */
export function resetCloudForTests(): void {
  stopCloudSync()
  inflight = null
  pending = false
  lastSaved = null
  lastSubmitKey = ''
  failedKey = ''
  failedTimes = 0
  refusedRun = -1
  runOnScreen = false
  watchStop?.()
  useCloud.setState({ ...initial })
}
