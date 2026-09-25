// E-mail + 4-digit PIN accounts. PINs are scrypt-hashed with a per-user salt plus PIN_PEPPER (required in
// production). Every login attempt is counted per e-mail BEFORE the PIN is checked (5 per sliding 15 minutes, 30 a
// day), so parallel requests cannot slip past the lock. Sessions are random 32-byte tokens; only their SHA-256 is
// stored, with a 90-day TTL renewed on app start and a hard 180-day cap; an account keeps a list of its sessions so
// "sign out everywhere" can drop them all. Rate limits: per user on signed-in routes, per IP on the rest; a key
// already over its limit is answered from instance memory without touching Redis.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import type { ApiRequest } from './http.js'
import { ApiError, bearer, now } from './http.js'
import type { Kv } from './kv.js'
import { checkCompanyName } from '../../src/net/companyRules.js'

export const SESSION_TTL_S = 90 * 24 * 3600
/** A session dies this long after sign-in, however often it is used. */
export const SESSION_MAX_AGE_MS = 180 * 24 * 3600 * 1000
/** Sessions kept per account (the oldest is dropped past this). */
export const MAX_SESSIONS = 10
export const PIN_MAX_FAILS = 5
export const PIN_LOCK_S = 15 * 60
/** Login attempts per e-mail per day (right PINs included: the counter runs before the check). */
export const PIN_DAILY_MAX = 30
const DAY_S = 24 * 3600
export const COMPANY_MIN = 2
export const COMPANY_MAX = 32

export const keys = {
  user: (h: string) => `user:${h}`,
  save: (h: string) => `save:${h}`,
  session: (tokenHash: string) => `session:${tokenHash}`,
  sessions: (h: string) => `sessions:${h}`,
  pinFails: (h: string) => `rl:pin:${h}`,
  pinDay: (h: string) => `rl:pinday:${h}`,
  rate: (bucket: string, id: string, window: number) => `rl:${bucket}:${sha256(id).slice(0, 16)}:${window}`,
  lb: 'lb',
  lbRow: (h: string) => `lb:row:${h}`,
  lbReplay: (h: string) => `lb:replay:${h}`,
}

export interface UserRecord {
  email: string
  pinHash: string
  salt: string
  companyName: string
  createdAt: number
  /** Last company-name change made through a leaderboard submission (ms). */
  renamedAt?: number
}

interface SessionRecord {
  h: string
  createdAt: number
}

export interface AuthedUser {
  emailHash: string
  user: UserRecord
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

// --- input -------------------------------------------------------------------------------------------------------

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

/** Trimmed, lower-cased, validated e-mail; null when unusable. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  if (e.length < 6 || e.length > 254) return null
  const at = e.lastIndexOf('@')
  if (at < 1 || at > 64) return null
  if (!EMAIL_RE.test(e)) return null
  if (e.includes('..')) return null
  const tld = e.slice(e.lastIndexOf('.') + 1)
  if (!/^[a-z]{2,}$/.test(tld) && !/^xn--[a-z0-9-]+$/.test(tld)) return null
  return e
}

export function emailHash(email: string): string {
  return sha256(`be-unicorn:${email}`)
}

export function validPin(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d{4}$/.test(raw)
}

/** Visible company name: NFC, no control / zero-width / bidi characters or markup, collapsed spaces, 2–32 chars. */
export function sanitizeCompanyName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g, '')
    .replace(/[<>`"\\{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const len = Array.from(s).length
  if (len < COMPANY_MIN || len > COMPANY_MAX) return null
  if (!/[\p{L}\p{N}]/u.test(s)) return null
  return s
}

/** A name that may go on the public board: sanitized, then the same rules as the start screen (no links, no
 * swear words). null = refuse. */
export function acceptCompanyName(raw: unknown): string | null {
  const s = sanitizeCompanyName(raw)
  if (!s) return null
  const c = checkCompanyName(s)
  return c.ok ? c.value : null
}

/** om***@helio.studio — two leading characters (one for very short names) of the local part. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return '***'
  const local = email.slice(0, at)
  const keep = local.length <= 3 ? 1 : 2
  return `${local.slice(0, keep)}***${email.slice(at)}`
}

// --- PIN hashing -------------------------------------------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 }

function scrypt(pin: string, salt: Buffer): Promise<Buffer> {
  const pepper = process.env.PIN_PEPPER ?? ''
  return new Promise((resolve, reject) =>
    scryptCb(`${pin}:${pepper}`, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  )
}

export async function hashPin(pin: string): Promise<{ pinHash: string; salt: string }> {
  const salt = randomBytes(16)
  const key = await scrypt(pin, salt)
  return { pinHash: key.toString('base64'), salt: salt.toString('base64') }
}

export async function verifyPin(pin: string, rec: { pinHash: string; salt: string }): Promise<boolean> {
  const key = await scrypt(pin, Buffer.from(rec.salt, 'base64'))
  const want = Buffer.from(rec.pinHash, 'base64')
  return want.length === key.length && timingSafeEqual(want, key)
}

// --- rate limits -------------------------------------------------------------------------------------------------

/** Signed-in routes count per user (players behind one office / carrier NAT share an IP); the rest per IP. */
export const LIMITS = {
  /** login, per IP */
  auth: { max: 60, windowS: 600 },
  /** register, per IP */
  register: { max: 30, windowS: 3600 },
  /** /me GET, per IP (app start) */
  session: { max: 120, windowS: 60 },
  /** anonymous board, per IP */
  boardIp: { max: 120, windowS: 60 },
  /** per user */
  board: { max: 30, windowS: 60 },
  save: { max: 60, windowS: 60 },
  submit: { max: 30, windowS: 60 },
} as const
export type LimitBucket = keyof typeof LIMITS

/** Keys already over their limit in this instance, until their window ends: refused without a Redis command. */
const blocked = new Map<string, number>()

/** Fixed-window counter; throws 429 `rateLimited` past the limit. `id` is an IP or an e-mail hash. */
export async function limit(kv: Kv, bucket: LimitBucket, id: string): Promise<void> {
  const { max, windowS } = LIMITS[bucket]
  const ms = now()
  const t = Math.floor(ms / 1000)
  const window = Math.floor(t / windowS)
  const key = keys.rate(bucket, id, window)
  const until = blocked.get(key)
  if (until !== undefined) {
    if (until > ms) throw new ApiError(429, 'rateLimited', { retryAfter: Math.ceil((until - ms) / 1000) })
    blocked.delete(key)
  }
  const n = await kv.incr(key, windowS + 5)
  if (n > max) {
    if (blocked.size > 5000) blocked.clear()
    blocked.set(key, (window + 1) * windowS * 1000)
    throw new ApiError(429, 'rateLimited', { retryAfter: (window + 1) * windowS - t })
  }
}

/** Tests: forget the in-memory blocks. */
export function resetLimitsForTests(): void {
  blocked.clear()
}

/**
 * Counts one login attempt for this e-mail before anything else is checked: the 6th within 15 minutes (the window
 * restarts with every attempt) or the 31st of the day is refused without running scrypt, so parallel requests
 * cannot all pass a check-then-count gap. Returns the attempts left in the 15-minute window.
 */
async function countAttempt(kv: Kv, h: string): Promise<number> {
  const day = await kv.incr(keys.pinDay(h), DAY_S)
  if (day > PIN_DAILY_MAX) {
    const ttl = await kv.ttl(keys.pinDay(h))
    throw new ApiError(429, 'locked', { retryAfter: ttl > 0 ? ttl : DAY_S })
  }
  const n = await kv.incr(keys.pinFails(h), PIN_LOCK_S)
  await kv.expire(keys.pinFails(h), PIN_LOCK_S)
  if (n > PIN_MAX_FAILS) throw new ApiError(429, 'locked', { retryAfter: PIN_LOCK_S })
  return PIN_MAX_FAILS - n
}

// --- sessions ----------------------------------------------------------------------------------------------------

export async function readUser(kv: Kv, h: string): Promise<UserRecord | null> {
  const raw = await kv.get(keys.user(h))
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserRecord
  } catch {
    return null
  }
}

export async function writeUser(kv: Kv, h: string, u: UserRecord): Promise<void> {
  await kv.set(keys.user(h), JSON.stringify(u))
}

interface SessionRef {
  th: string
  at: number
}

async function readSessions(kv: Kv, h: string): Promise<SessionRef[]> {
  const raw = await kv.get(keys.sessions(h))
  if (!raw) return []
  try {
    const list = JSON.parse(raw) as SessionRef[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

async function createSession(kv: Kv, h: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const th = sha256(token)
  const t = now()
  const rec: SessionRecord = { h, createdAt: t }
  await kv.set(keys.session(th), JSON.stringify(rec), { ex: SESSION_TTL_S })
  const alive = (await readSessions(kv, h)).filter((s) => t - s.at < SESSION_MAX_AGE_MS)
  alive.push({ th, at: t })
  const dropped = alive.splice(0, Math.max(0, alive.length - MAX_SESSIONS))
  for (const d of dropped) await kv.del(keys.session(d.th))
  await kv.set(keys.sessions(h), JSON.stringify(alive), { ex: Math.ceil(SESSION_MAX_AGE_MS / 1000) })
  return token
}

/**
 * The caller's account from the Bearer token, or null. `renew` pushes the 90-day TTL out again (app start only, to
 * save a Redis command per call); a session older than 180 days is dead either way.
 */
export async function optionalUser(kv: Kv, req: ApiRequest, opts: { renew?: boolean } = {}): Promise<AuthedUser | null> {
  const token = bearer(req)
  if (!token) return null
  const key = keys.session(sha256(token))
  const raw = await kv.get(key)
  if (!raw) return null
  let rec: SessionRecord
  try {
    rec = JSON.parse(raw) as SessionRecord
  } catch {
    return null
  }
  if (now() - rec.createdAt > SESSION_MAX_AGE_MS) {
    await kv.del(key)
    return null
  }
  const user = await readUser(kv, rec.h)
  if (!user) return null
  if (opts.renew) await kv.expire(key, SESSION_TTL_S)
  return { emailHash: rec.h, user }
}

export async function requireUser(kv: Kv, req: ApiRequest, opts: { renew?: boolean } = {}): Promise<AuthedUser> {
  const u = await optionalUser(kv, req, opts)
  if (!u) throw new ApiError(401, 'unauthorized')
  return u
}

/** Log out: this token, or with `all` every session of the account (a PIN seen by someone else). */
export async function endSession(kv: Kv, req: ApiRequest, all = false): Promise<void> {
  const token = bearer(req)
  if (!token) return
  const th = sha256(token)
  const raw = await kv.get(keys.session(th))
  await kv.del(keys.session(th))
  if (!raw) return
  let h: string
  try {
    h = (JSON.parse(raw) as SessionRecord).h
  } catch {
    return
  }
  const list = await readSessions(kv, h)
  if (all) {
    for (const s of list) await kv.del(keys.session(s.th))
    await kv.del(keys.sessions(h))
    return
  }
  const rest = list.filter((s) => s.th !== th)
  if (rest.length !== list.length) await kv.set(keys.sessions(h), JSON.stringify(rest), { ex: Math.ceil(SESSION_MAX_AGE_MS / 1000) })
}

// --- register / login --------------------------------------------------------------------------------------------

export interface AuthResult {
  token: string
  email: string
  companyName: string
  expiresIn: number
}

export async function register(kv: Kv, body: Record<string, unknown>): Promise<AuthResult> {
  const email = normalizeEmail(body.email)
  if (!email) throw new ApiError(400, 'invalidEmail')
  if (!validPin(body.pin)) throw new ApiError(400, 'invalidPin')
  const companyName = acceptCompanyName(body.companyName)
  if (!companyName) throw new ApiError(400, 'invalidCompanyName')
  const h = emailHash(email)
  const { pinHash, salt } = await hashPin(body.pin)
  const user: UserRecord = { email, pinHash, salt, companyName, createdAt: now() }
  // NX: two tabs registering the same e-mail at once — only one wins.
  const created = await kv.set(keys.user(h), JSON.stringify(user), { nx: true })
  if (!created) throw new ApiError(409, 'emailTaken')
  await kv.del(keys.pinFails(h))
  const token = await createSession(kv, h)
  return { token, email, companyName, expiresIn: SESSION_TTL_S }
}

/** Same work as a real check, for e-mails without an account (the answer time does not tell them apart). */
const DUMMY = { pinHash: Buffer.alloc(SCRYPT.keylen).toString('base64'), salt: Buffer.alloc(16).toString('base64') }

export async function login(kv: Kv, body: Record<string, unknown>): Promise<AuthResult> {
  const email = normalizeEmail(body.email)
  if (!email) throw new ApiError(400, 'invalidEmail')
  if (!validPin(body.pin)) throw new ApiError(400, 'invalidPin')
  const h = emailHash(email)
  // Counted first (unknown e-mails too): the lock holds under parallel requests.
  const left = await countAttempt(kv, h)
  const user = await readUser(kv, h)
  if (!user) {
    await verifyPin(body.pin, DUMMY)
    throw new ApiError(404, 'unknownEmail')
  }
  if (!(await verifyPin(body.pin, user))) {
    if (left <= 0) {
      await kv.expire(keys.pinFails(h), PIN_LOCK_S)
      throw new ApiError(429, 'locked', { retryAfter: PIN_LOCK_S })
    }
    throw new ApiError(401, 'wrongCredentials', { attemptsLeft: left })
  }
  await kv.del(keys.pinFails(h))
  const token = await createSession(kv, h)
  return { token, email: user.email, companyName: user.companyName, expiresIn: SESSION_TTL_S }
}
