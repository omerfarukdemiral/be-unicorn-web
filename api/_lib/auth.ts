// E-mail + 4-digit PIN accounts. PINs are scrypt-hashed with a per-user salt (plus optional PIN_PEPPER), wrong
// PINs lock an e-mail for 15 minutes after 5 tries, and every IP is rate limited. Sessions are random 32-byte
// tokens; only their SHA-256 is stored, with a sliding 90-day TTL.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import type { ApiRequest } from './http.js'
import { ApiError, bearer, now } from './http.js'
import type { Kv } from './kv.js'

export const SESSION_TTL_S = 90 * 24 * 3600
export const PIN_MAX_FAILS = 5
export const PIN_LOCK_S = 15 * 60
export const COMPANY_MIN = 2
export const COMPANY_MAX = 32

export const keys = {
  user: (h: string) => `user:${h}`,
  save: (h: string) => `save:${h}`,
  session: (tokenHash: string) => `session:${tokenHash}`,
  pinFails: (h: string) => `rl:pin:${h}`,
  ip: (bucket: string, ip: string, window: number) => `rl:ip:${bucket}:${sha256(ip).slice(0, 16)}:${window}`,
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

export const IP_LIMITS = {
  auth: { max: 30, windowS: 600 },
  save: { max: 120, windowS: 60 },
  submit: { max: 30, windowS: 60 },
  board: { max: 60, windowS: 60 },
} as const

/** Fixed-window per-IP counter; throws 429 `rateLimited` past the limit. */
export async function limitIp(kv: Kv, bucket: keyof typeof IP_LIMITS, ip: string): Promise<void> {
  const { max, windowS } = IP_LIMITS[bucket]
  const t = Math.floor(now() / 1000)
  const window = Math.floor(t / windowS)
  const n = await kv.incr(keys.ip(bucket, ip, window), windowS + 5)
  if (n > max) throw new ApiError(429, 'rateLimited', { retryAfter: (window + 1) * windowS - t })
}

async function assertNotLocked(kv: Kv, h: string): Promise<void> {
  const fails = Number((await kv.get(keys.pinFails(h))) ?? 0)
  if (fails >= PIN_MAX_FAILS) {
    const ttl = await kv.ttl(keys.pinFails(h))
    throw new ApiError(429, 'locked', { retryAfter: ttl > 0 ? ttl : PIN_LOCK_S })
  }
}

/** Counts a wrong PIN; the 5th starts a full 15-minute lock. */
async function recordFail(kv: Kv, h: string): Promise<never> {
  const n = await kv.incr(keys.pinFails(h), PIN_LOCK_S)
  if (n >= PIN_MAX_FAILS) {
    await kv.expire(keys.pinFails(h), PIN_LOCK_S)
    throw new ApiError(429, 'locked', { retryAfter: PIN_LOCK_S })
  }
  throw new ApiError(401, 'wrongCredentials', { attemptsLeft: PIN_MAX_FAILS - n })
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

async function createSession(kv: Kv, h: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const rec: SessionRecord = { h, createdAt: now() }
  await kv.set(keys.session(sha256(token)), JSON.stringify(rec), { ex: SESSION_TTL_S })
  return token
}

/** The caller's account from the Bearer token (TTL renewed), or null. */
export async function optionalUser(kv: Kv, req: ApiRequest): Promise<AuthedUser | null> {
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
  const user = await readUser(kv, rec.h)
  if (!user) return null
  await kv.expire(key, SESSION_TTL_S)
  return { emailHash: rec.h, user }
}

export async function requireUser(kv: Kv, req: ApiRequest): Promise<AuthedUser> {
  const u = await optionalUser(kv, req)
  if (!u) throw new ApiError(401, 'unauthorized')
  return u
}

export async function endSession(kv: Kv, req: ApiRequest): Promise<void> {
  const token = bearer(req)
  if (token) await kv.del(keys.session(sha256(token)))
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
  const companyName = sanitizeCompanyName(body.companyName)
  if (!companyName) throw new ApiError(400, 'invalidCompanyName')
  const h = emailHash(email)
  const { pinHash, salt } = await hashPin(body.pin)
  const user: UserRecord = { email, pinHash, salt, companyName, createdAt: now() }
  // NX: two tabs registering the same e-mail at once — only one wins.
  const created = await kv.set(keys.user(h), JSON.stringify(user), { nx: true })
  if (!created) throw new ApiError(409, 'emailTaken')
  const token = await createSession(kv, h)
  return { token, email, companyName, expiresIn: SESSION_TTL_S }
}

export async function login(kv: Kv, body: Record<string, unknown>): Promise<AuthResult> {
  const email = normalizeEmail(body.email)
  if (!email) throw new ApiError(400, 'invalidEmail')
  if (!validPin(body.pin)) throw new ApiError(400, 'invalidPin')
  const h = emailHash(email)
  await assertNotLocked(kv, h)
  const user = await readUser(kv, h)
  if (!user) throw new ApiError(404, 'unknownEmail')
  if (!(await verifyPin(body.pin, user))) await recordFail(kv, h)
  await kv.del(keys.pinFails(h))
  const token = await createSession(kv, h)
  return { token, email: user.email, companyName: user.companyName, expiresIn: SESSION_TTL_S }
}
