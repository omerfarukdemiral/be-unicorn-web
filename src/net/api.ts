// Typed client for the Vercel functions (api/**). Every call resolves (never throws) to ApiResult<T>; errors carry
// a code and a Turkish message. Without a backend (plain `vite` dev, no Redis env, network down) `backendStatus()`
// says 'offline': the game then keeps its local save and hides the leaderboard.
import type {
  ApiErrorBody,
  ApiErrorCode,
  AuthOk,
  LeaderboardOk,
  LeaderboardSubmitBody,
  LeaderboardSubmitOk,
  MeOk,
  SaveGetOk,
  SavePutOk,
} from './contract'
import { errorMessage } from './netText'
import { clearSession, patchSession, readSession, writeSession, type Session } from './session'

export type * from './contract'

export interface ApiFailure {
  ok: false
  error: ApiErrorCode
  /** Turkish, ready to show. */
  message: string
  status: number
  retryAfter?: number
  attemptsLeft?: number
  /** Which check refused a leaderboard submission (invalidMetrics). */
  detail?: string
}
export type ApiResult<T> = { ok: true; data: T } | ApiFailure

export type BackendStatus = 'online' | 'offline'

const REQUEST_TIMEOUT_MS = 10_000
let status: BackendStatus | null = null
let probing: Promise<BackendStatus> | null = null
export const LEADERBOARD_POLL_MS = 10_000

function failure(error: ApiErrorCode, status: number, extra?: Partial<ApiErrorBody>): ApiFailure {
  return {
    ok: false,
    error,
    status,
    message: errorMessage(error, extra),
    ...(extra?.retryAfter !== undefined ? { retryAfter: extra.retryAfter } : {}),
    ...(extra?.attemptsLeft !== undefined ? { attemptsLeft: extra.attemptsLeft } : {}),
    ...(extra?.detail !== undefined ? { detail: extra.detail } : {}),
  }
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
}

/** Raw request: JSON in/out, timeout, error body → ApiFailure. Also returns the error body for callers that need it. */
async function request<T>(path: string, opts: RequestOpts = {}): Promise<{ res: ApiResult<T>; errorBody?: unknown }> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (opts.auth) {
    const s = readSession()
    if (!s) return { res: failure('unauthorized', 401) }
    headers.authorization = `Bearer ${s.token}`
  }
  const ctrl = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = ctrl ? setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS) : null
  let resp: Response
  try {
    resp = await fetch(path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctrl?.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    return { res: failure('offline', 0) }
  } finally {
    if (timer) clearTimeout(timer)
  }
  // The Vite dev server (no functions) answers /api/* with index.html or 404: that is "offline", not an error.
  const isJson = (resp.headers.get('content-type') ?? '').includes('application/json')
  let body: unknown = null
  if (isJson) {
    try {
      body = await resp.json()
    } catch {
      body = null
    }
  }
  if (!isJson) return { res: failure('offline', resp.status) }
  const eb = (body ?? {}) as Partial<ApiErrorBody>
  const code: ApiErrorCode = resp.ok ? 'server' : typeof eb.error === 'string' ? eb.error : 'server'
  // Any JSON answer from our functions means the backend is there (a failed boot probe is healed by the next call).
  status = !resp.ok && code === 'notConfigured' ? 'offline' : 'online'
  if (resp.ok) return { res: { ok: true, data: body as T } }
  if (code === 'unauthorized' && opts.auth) clearSession()
  return { res: failure(code, resp.status, eb), errorBody: body }
}

// --- backend status ---------------------------------------------------------------------------------------------

/** Wait before the second health probe when the first one could not reach the server (cold start, network blip). */
export const PROBE_RETRY_MS = 1500

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function probe(): Promise<BackendStatus> {
  let { res } = await request<{ ok: true }>('/api/health')
  // Unreachable or a platform error page (timeout, 5xx without our JSON): try once more before going offline.
  // A plain `vite` dev server answers 200/404 HTML at once: that is offline for sure, no retry.
  if (!res.ok && res.error === 'offline' && (res.status === 0 || res.status >= 500)) {
    await sleep(PROBE_RETRY_MS)
    res = (await request<{ ok: true }>('/api/health')).res
  }
  return res.ok ? 'online' : 'offline'
}

/** 'online' when the functions and Redis answer. Cached after the first probe; `recheck` probes again. */
export function backendStatus(recheck = false): Promise<BackendStatus> {
  if (import.meta.env?.VITE_OFFLINE === '1') return Promise.resolve('offline')
  if (status && !recheck) return Promise.resolve(status)
  if (probing && !recheck) return probing
  probing = probe().then((st) => {
    status = st
    probing = null
    return st
  })
  return probing
}

/** Last known status without probing (null = not probed yet). */
export function knownBackendStatus(): BackendStatus | null {
  return status
}

// --- auth -------------------------------------------------------------------------------------------------------

function remember(a: AuthOk): void {
  const prev = readSession()
  // Same account on this device keeps its cloud revision; another account starts from 0.
  const cloudRev = prev && prev.email === a.email ? prev.cloudRev : 0
  writeSession({ token: a.token, email: a.email, companyName: a.companyName, cloudRev })
}

/** New company: e-mail + a 4-digit PIN the player picks + company name. Stores the session on success. */
export async function register(email: string, pin: string, companyName: string): Promise<ApiResult<AuthOk>> {
  const { res } = await request<AuthOk>('/api/auth/register', { method: 'POST', body: { email, pin, companyName } })
  if (res.ok) remember(res.data)
  return res
}

/** Returning player: e-mail + PIN. `unknownEmail` ⇒ offer register. Stores the session on success. */
export async function login(email: string, pin: string): Promise<ApiResult<AuthOk>> {
  const { res } = await request<AuthOk>('/api/auth/login', { method: 'POST', body: { email, pin } })
  if (res.ok) remember(res.data)
  return res
}

/** Same device, no PIN: checks the stored token (and renews it). `unauthorized` ⇒ the session was cleared. */
export async function resumeSession(): Promise<ApiResult<MeOk>> {
  if (!readSession()) return failure('unauthorized', 401)
  const { res } = await request<MeOk>('/api/auth/me', { auth: true })
  if (res.ok) patchSession({ email: res.data.email, companyName: res.data.companyName })
  return res
}

/** Ends this device's session; `all` ends every session of the account (all devices). */
export async function logout(opts: { all?: boolean } = {}): Promise<void> {
  if (readSession()) await request(opts.all ? '/api/auth/me?all=1' : '/api/auth/me', { method: 'DELETE', auth: true })
  clearSession()
}

export function currentSession(): Session | null {
  return readSession()
}

// --- cloud save -------------------------------------------------------------------------------------------------

/** The cloud save (data null = none yet). Remembers its revision as this device's base for the next write. */
export async function getSave(): Promise<ApiResult<SaveGetOk>> {
  const { res } = await request<SaveGetOk>('/api/save', { auth: true })
  if (res.ok) patchSession({ cloudRev: res.data.rev })
  return res
}

export type PutSaveResult = ApiResult<SavePutOk> | (ApiFailure & { error: 'conflict'; server: SaveGetOk })

/**
 * Writes `data` (engine serialize output) over the revision this device last saw. Another device wrote in
 * between ⇒ `conflict` with the server copy: take it (getSave / its data) or keep this one (`force: true`).
 */
export async function putSave(data: string, opts: { force?: boolean } = {}): Promise<PutSaveResult> {
  const baseRev = readSession()?.cloudRev ?? 0
  const { res, errorBody } = await request<SavePutOk>('/api/save', {
    method: 'PUT',
    auth: true,
    body: { data, baseRev, ...(opts.force ? { force: true } : {}) },
  })
  if (res.ok) {
    patchSession({ cloudRev: res.data.rev })
    return res
  }
  const server = (errorBody as { server?: SaveGetOk } | undefined)?.server
  if (res.error === 'conflict' && server) return { ...res, error: 'conflict', server }
  return res
}

// --- leaderboard ------------------------------------------------------------------------------------------------

export async function submitScore(body: LeaderboardSubmitBody): Promise<ApiResult<LeaderboardSubmitOk>> {
  return (await request<LeaderboardSubmitOk>('/api/leaderboard/submit', { method: 'POST', auth: true, body })).res
}

/** Top `limit` rows; with a session also my row, the row above and the gap to it. */
export async function getLeaderboard(limit = 50): Promise<ApiResult<LeaderboardOk>> {
  const auth = readSession() !== null
  const { res } = await request<LeaderboardOk>(`/api/leaderboard?limit=${limit}`, { auth })
  // A dead token must not hide the public board.
  if (!res.ok && res.error === 'unauthorized' && auth) return (await request<LeaderboardOk>(`/api/leaderboard?limit=${limit}`)).res
  return res
}

/**
 * Live board: fetches now and every `intervalMs` (default 10 s) while the tab is visible; returns stop().
 * Offline backends never poll.
 */
export function pollLeaderboard(
  onResult: (r: ApiResult<LeaderboardOk>) => void,
  opts: { limit?: number; intervalMs?: number } = {},
): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const interval = opts.intervalMs ?? LEADERBOARD_POLL_MS
  const hidden = () => typeof document !== 'undefined' && document.hidden
  const schedule = () => {
    if (!stopped) timer = setTimeout(run, interval)
  }
  const run = async () => {
    timer = null
    if (stopped) return
    if (hidden()) return schedule()
    if ((await backendStatus()) === 'offline') return
    const r = await getLeaderboard(opts.limit)
    if (!stopped) onResult(r)
    schedule()
  }
  const onVisible = () => {
    if (!hidden() && timer) {
      clearTimeout(timer)
      void run()
    }
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
  void run()
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
  }
}

/** Tests: forget the probed backend status. */
export function resetNetForTests(): void {
  status = null
  probing = null
}
