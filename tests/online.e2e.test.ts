// End to end, in one process: the client (src/net/api.ts + src/net/cloud.ts + the real game store) talks to the real
// API handlers (api/**) over an in-memory Redis through a stubbed fetch. Covers:
// register → play → cloud save → submit → live leaderboard (rank, masked e-mails, gap) → second device picks the cloud
// save → an old device gets the conflict and takes the cloud copy; and offline mode without a backend.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler as health } from '../api/health.js'
import { handler as registerH } from '../api/auth/register.js'
import { handler as loginH } from '../api/auth/login.js'
import { handler as meH } from '../api/auth/me.js'
import { handler as saveH } from '../api/save.js'
import { handler as boardH } from '../api/leaderboard/index.js'
import { handler as submitH } from '../api/leaderboard/submit.js'
import type { ApiRequest, ApiResult } from '../api/_lib/http.js'
import { setClockForTests } from '../api/_lib/http.js'
import { setKvForTests } from '../api/_lib/kv.js'
import { resetLimitsForTests } from '../api/_lib/auth.js'
import { MemoryKv } from '../api/_lib/memoryKv.js'
import { login, register, resetNetForTests } from '../src/net/api'
import { afterAuth, bootCloud, refreshBoard, resetCloudForTests, saveNow, submitNow, submissionOf, takeCloudSave, useCloud } from '../src/net/cloud'
import { runLengthText, teamText } from '../src/net/netText'
import { readSession } from '../src/net/session'
import { useGameStore } from '../src/store/gameStore'
import { readSave, readSaveMeta } from '../src/store/save'

class MemStorage {
  m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}

const ROUTES: Record<string, (r: ApiRequest) => Promise<ApiResult>> = {
  '/api/health': health,
  '/api/auth/register': registerH,
  '/api/auth/login': loginH,
  '/api/auth/me': meH,
  '/api/save': saveH,
  '/api/leaderboard': boardH,
  '/api/leaderboard/submit': submitH,
}

/** fetch → handler, the way Vercel would call it (same origin, JSON). */
async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), 'https://game.test')
  const h = ROUTES[url.pathname]
  if (!h) return new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })
  const headers: Record<string, string> = { host: 'game.test' }
  new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
  const out = await h({
    method: init?.method ?? 'GET',
    headers,
    query: Object.fromEntries(url.searchParams),
    body: init?.body ? JSON.parse(String(init.body)) : null,
    ip: '10.1.1.1',
  })
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'content-type': 'application/json', ...out.headers } })
}

let clock = 1_800_000_000_000
const store = () => useGameStore.getState()

/** Plays `days` game days at 4× through the store, and moves the server clock as a real player would. */
function play(days: number) {
  const s = store()
  s.dispatch({ type: 'setSpeed', speed: 4 })
  const target = s.state.time.day + days
  let guard = 0
  while (store().state.time.day < target && !store().state.gameOver && guard++ < 100_000) {
    const active = store().state.concepts.active
    if (active) store().dispatch({ type: 'openConcept', conceptId: active.id })
    const card = store().state.decisions.active
    if (card) store().dispatch({ type: 'answerDecision', cardId: card.cardId, optionIndex: 0 })
    store().tick(1 / 30)
  }
  clock += days * 600 // 4× = 0.5 s per day; a little slower than the fastest player
}

beforeEach(() => {
  clock = 1_800_000_000_000
  vi.stubGlobal('localStorage', new MemStorage())
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  setKvForTests(new MemoryKv(() => clock))
  setClockForTests(() => clock)
  resetNetForTests()
  resetCloudForTests()
  resetLimitsForTests()
})
afterEach(() => {
  vi.unstubAllGlobals()
  setKvForTests(undefined)
  setClockForTests(null)
})

describe('online e2e (in-memory Redis)', () => {
  it('register → save → submit → leaderboard → another device → conflict', async () => {
    // First visit: backend up, no token → sign-in card.
    await bootCloud()
    expect(useCloud.getState()).toMatchObject({ backend: 'online', phase: 'login', account: null })

    const reg = await register('Omer@Helio.Studio', '1234', 'Helio Studio')
    expect(reg.ok).toBe(true)
    if (!reg.ok) return
    await afterAuth(reg.data)
    expect(useCloud.getState()).toMatchObject({ phase: 'ready', account: { email: 'omer@helio.studio', companyName: 'Helio Studio' } })

    store().newGame({ seed: 11, companyName: 'Helio Studio', runIndex: 0 })
    play(40)
    const day = store().state.time.day
    expect(day).toBeGreaterThanOrEqual(40)
    expect(readSaveMeta()?.owner).toBe('omer@helio.studio')

    // Cloud save.
    await saveNow()
    expect(useCloud.getState().sync).toBe('idle')
    expect(readSession()?.cloudRev).toBe(1)

    // Leaderboard submit: team counts the founder.
    const body = submissionOf(store().state)
    expect(body.team).toBe(store().state.employees.length + 1)
    await submitNow({ withReplay: true })
    expect(useCloud.getState().submitError).toBeNull()
    expect(useCloud.getState().rank).toBe(1)

    // A rival (raw API, another browser) passes us at the same stage.
    clock += 60_000
    const rival = await registerH({ method: 'POST', headers: { host: 'game.test' }, query: {}, body: { email: 'deniz@rakip.io', pin: '9999', companyName: 'Rakip AI' }, ip: '10.2.2.2' })
    const rivalToken = (rival.body as { token: string }).token
    const sub = await submitH({
      method: 'POST',
      headers: { host: 'game.test', authorization: `Bearer ${rivalToken}` },
      query: {},
      body: { stage: 0, valuation: body.valuation + 250_000, cash: 20_000, day: 20, team: 3, companyName: 'Rakip AI', runIndex: 0 },
      ip: '10.2.2.2',
    })
    expect(sub.status).toBe(200)

    await refreshBoard()
    const board = useCloud.getState().board!
    expect(board.total).toBe(2)
    expect(board.rows[0]).toMatchObject({ rank: 1, companyName: 'Rakip AI', email: 'de***@rakip.io' })
    expect(board.rows[0]!.me).toBeUndefined()
    expect(board.rows[1]).toMatchObject({ rank: 2, companyName: 'Helio Studio', email: 'omer@helio.studio', me: true })
    expect(board.me?.rank).toBe(2)
    expect(board.above?.companyName).toBe('Rakip AI')
    expect(board.gap).toMatchObject({ stages: 0, days: 0 })
    expect(board.gap!.valuation).toBeGreaterThanOrEqual(249_000)
    expect(useCloud.getState().rank).toBe(2)
    expect(runLengthText(209.4)).toBe('7 ay (210 gün)')
    expect(teamText(18)).toBe('18 kişilik ekip')

    // Device A keeps its storage; device B is a fresh browser.
    const deviceA = localStorage
    const stateA = store().state
    vi.stubGlobal('localStorage', new MemStorage())
    resetNetForTests()
    resetCloudForTests()
    await bootCloud()
    expect(useCloud.getState().phase).toBe('login')
    const unknown = await login('nobody@helio.studio', '1234')
    expect(!unknown.ok && unknown.error).toBe('unknownEmail')
    const wrong = await login('omer@helio.studio', '0000')
    expect(!wrong.ok && wrong.error).toBe('wrongCredentials')
    const lg = await login('omer@helio.studio', '1234')
    expect(lg.ok).toBe(true)
    if (!lg.ok) return
    await afterAuth(lg.data)
    // The cloud copy landed in B's local slot: "Devam et" continues where A left.
    const onB = readSave()
    expect(onB?.meta.companyName).toBe('Helio Studio')
    expect(onB?.time.day).toBeCloseTo(day, 5)
    expect(useCloud.getState().cloudLoaded).toBe(true)
    expect(store().load()).toBe(true)
    play(10)
    await saveNow()
    expect(readSession()?.cloudRev).toBe(2)
    const dayB = store().state.time.day

    // Back on A (older revision, behind B): its write is refused, the player takes the cloud copy.
    vi.stubGlobal('localStorage', deviceA)
    resetNetForTests()
    resetCloudForTests()
    await bootCloud() // token on A still valid → resumes without a PIN
    expect(useCloud.getState()).toMatchObject({ phase: 'ready', account: { email: 'omer@helio.studio' } })
    // A had an open tab: its in-memory state is the old one and it writes with its old base revision.
    useGameStore.setState({ state: stateA })
    const sess = readSession()!
    localStorage.setItem('be-unicorn:session', JSON.stringify({ ...sess, cloudRev: 1 }))
    await saveNow()
    expect(useCloud.getState().sync).toBe('conflict')
    expect(useCloud.getState().conflict?.day).toBeCloseTo(dayB, 5)
    expect(takeCloudSave()).toBe(true)
    expect(store().state.time.day).toBeCloseTo(dayB, 5)
    expect(useCloud.getState().sync).toBe('idle')
  }, 60_000)

  it('without a backend the game stays local: no sign-in, no cloud writes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })))
    await bootCloud()
    expect(useCloud.getState()).toMatchObject({ backend: 'offline', phase: 'ready', account: null })
    store().newGame({ seed: 3, companyName: 'Garaj Labs' })
    await saveNow()
    await submitNow()
    expect(readSave()?.meta.companyName).toBe('Garaj Labs')
    expect(readSaveMeta()?.owner).toBeNull()
    expect(vi.mocked(fetch).mock.calls.length).toBe(1) // only the health probe
  })

  it('a local offline save is adopted by the account that signs in; another account never sees it', async () => {
    store().newGame({ seed: 5, companyName: 'Offline Co' })
    await bootCloud()
    const reg = await register('a@helio.studio', '1111', 'Offline Co')
    if (!reg.ok) throw new Error(reg.message)
    await afterAuth(reg.data)
    expect(readSaveMeta()?.owner).toBe('a@helio.studio')
    expect(readSave()?.meta.companyName).toBe('Offline Co')

    // Someone else signs in on this device: A's save lives in A's cloud, B starts clean.
    await saveNow()
    const regB = await register('b@helio.studio', '2222', 'Bee Corp')
    if (!regB.ok) throw new Error(regB.message)
    await afterAuth(regB.data)
    expect(readSave()).toBeNull()
  })

  it('same run on both sides: game progress picks the save, not the device clock', async () => {
    await bootCloud()
    const reg = await register('clock@helio.studio', '1234', 'Saat Labs')
    if (!reg.ok) throw new Error(reg.message)
    await afterAuth(reg.data)
    store().newGame({ seed: 21, companyName: 'Saat Labs', runIndex: 0 })
    play(40)
    await saveNow()
    // This device plays on (its clock far behind the server's), the cloud keeps day ~40.
    play(20)
    store().save()
    const localDay = store().state.time.day
    const meta = JSON.parse(localStorage.getItem('be-unicorn:save-meta')!)
    localStorage.setItem('be-unicorn:save-meta', JSON.stringify({ ...meta, at: 1 }))
    resetNetForTests()
    resetCloudForTests()
    await bootCloud()
    expect(readSave()?.time.day).toBeCloseTo(localDay, 5)
    expect(useCloud.getState().cloudLoaded).toBe(false)
    // A plain reload with both copies equal does not claim the cloud copy "arrived".
    expect(store().load()).toBe(true)
    await saveNow()
    resetNetForTests()
    resetCloudForTests()
    await bootCloud()
    expect(useCloud.getState().cloudLoaded).toBe(false)
  }, 60_000)

  it('a failed health probe at start does not strand a signed-in player offline', async () => {
    await bootCloud()
    const reg = await register('cold@helio.studio', '1234', 'Soğuk Start')
    if (!reg.ok) throw new Error(reg.message)
    resetNetForTests()
    resetCloudForTests()
    // Cold start: /api/health times out (twice), everything else answers.
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('/api/health')) throw new TypeError('network')
      return fakeFetch(input, init)
    }))
    await bootCloud()
    expect(useCloud.getState()).toMatchObject({ backend: 'online', phase: 'ready', account: { email: 'cold@helio.studio' } })
  }, 20_000)
})
