// Framework-free request/response shapes: handlers are plain async functions (tested directly), and `toVercel`
// adapts one to a Vercel Node function. Same-origin only: no CORS headers are ever sent, and a request whose
// Origin differs from its Host is refused.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ApiErrorBody, ApiErrorCode } from '../../src/net/contract.js'
import { getKv, type Kv } from './kv.js'

export interface ApiRequest {
  method: string
  /** Lower-case header names. */
  headers: Record<string, string | undefined>
  query: Record<string, string | undefined>
  body: unknown
  ip: string
}

export interface ApiResult {
  status: number
  body: unknown
  headers?: Record<string, string>
}

export type Handler = (req: ApiRequest, kv: Kv) => Promise<ApiResult>

/** Largest request body accepted anywhere (the save cap is checked separately, on the save string). */
export const MAX_BODY_BYTES = 800 * 1024

/** Error body extras: the typed fields plus endpoint-specific payloads (the save conflict's `server` copy). */
export type ErrorExtra = Partial<Omit<ApiErrorBody, 'error'>> & Record<string, unknown>

export class ApiError extends Error {
  status: number
  code: ApiErrorCode
  extra?: ErrorExtra
  constructor(status: number, code: ApiErrorCode, extra?: ErrorExtra) {
    super(code)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

export function ok(body: unknown, status = 200): ApiResult {
  return { status, body }
}

export function fail(status: number, code: ApiErrorCode, extra?: ErrorExtra): ApiResult {
  const body: ApiErrorBody = { ...extra, error: code }
  const headers: Record<string, string> = {}
  if (extra?.retryAfter) headers['retry-after'] = String(extra.retryAfter)
  return { status, body, headers }
}

let clock: () => number = () => Date.now()
export function now(): number {
  return clock()
}
/** Tests: fake time (lockouts, TTLs, wall-clock plausibility). */
export function setClockForTests(fn: (() => number) | null): void {
  clock = fn ?? (() => Date.now())
}

function host(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return null
  }
}

/** Same-origin check: a browser request from another site carries a foreign Origin. No Origin = not a browser
 * cross-site request (same-origin GETs may omit it), which is allowed. ALLOWED_ORIGINS (comma list) adds hosts. */
export function originAllowed(req: ApiRequest, env: Record<string, string | undefined> = process.env): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  const o = host(origin)
  if (!o) return false
  const self = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0]!.trim().toLowerCase()
  if (o === self) return true
  const extra = (env.ALLOWED_ORIGINS || '').split(',').map((s) => host(s.trim()) ?? s.trim().toLowerCase()).filter(Boolean)
  return extra.includes(o)
}

/** Bearer token from the Authorization header. */
export function bearer(req: ApiRequest): string | null {
  const h = req.headers.authorization
  if (!h) return null
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(h.trim())
  return m ? m[1]! : null
}

export function bodyObject(req: ApiRequest): Record<string, unknown> {
  let b = req.body
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b)
    } catch {
      throw new ApiError(400, 'badRequest')
    }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ApiError(400, 'badRequest')
  return b as Record<string, unknown>
}

/** Routes by method; wraps errors, the origin check and the "not configured" answer. */
export function route(methods: Partial<Record<string, Handler>>): (req: ApiRequest) => Promise<ApiResult> {
  return async (req) => {
    const method = req.method.toUpperCase()
    const base: Record<string, string> = { 'cache-control': 'no-store' }
    const withBase = (r: ApiResult): ApiResult => ({ ...r, headers: { ...base, ...r.headers } })
    if (!originAllowed(req)) return withBase(fail(403, 'forbiddenOrigin'))
    const h = methods[method]
    if (!h) return withBase({ ...fail(405, 'methodNotAllowed'), headers: { allow: Object.keys(methods).join(', ') } })
    const len = Number(req.headers['content-length'] ?? 0)
    if (len > MAX_BODY_BYTES) return withBase(fail(413, 'tooLarge'))
    const kv = getKv()
    if (!kv) return withBase(fail(503, 'notConfigured'))
    try {
      return withBase(await h(req, kv))
    } catch (e) {
      if (e instanceof ApiError) return withBase(fail(e.status, e.code, e.extra))
      console.error('[api]', e)
      return withBase(fail(500, 'server'))
    }
  }
}

function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for']
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim()
  const real = req.headers['x-real-ip']
  return first || (Array.isArray(real) ? real[0] : real) || req.socket?.remoteAddress || 'unknown'
}

/** Vercel Node function adapter. */
export function toVercel(fn: (req: ApiRequest) => Promise<ApiResult>) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const headers: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : v
    const query: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(req.query ?? {})) query[k] = Array.isArray(v) ? v[0] : v
    let body: unknown = null
    try {
      body = req.body // Vercel parses JSON lazily; a malformed body throws here
    } catch {
      body = undefined
    }
    const out = await fn({ method: req.method ?? 'GET', headers, query, body, ip: clientIp(req) })
    for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v)
    res.status(out.status).json(out.body)
  }
}
