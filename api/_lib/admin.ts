// Admin panel backend. Sign-in is one password from the ADMIN_PASSWORD env (≥ 16 chars), never a player account: a
// 4-digit PIN must not open every account. Admin sessions are random tokens, only their SHA-256 stored, 8 hours.
//
// Accounts have no index, so the list walks `user:*` with SCAN. An account's key is its e-mail hash, so changing the
// e-mail moves every keyed record and signs the player out (PIN stays, new e-mail + same PIN logs in).
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { AdminActionOk, AdminLoginOk, AdminUser, AdminUserDetail, AdminUsersOk } from '../../src/net/contract.js'
import type { ApiRequest } from './http.js'
import { ApiError, bearer, now } from './http.js'
import type { Kv } from './kv.js'
import {
  acceptCompanyName,
  dropSessions,
  emailHash,
  hashPin,
  keys,
  normalizeEmail,
  readSessions,
  readUser,
  sha256,
  validPin,
  writeUser,
  type UserRecord,
} from './auth.js'
import { dropTopCache, lbScore, readJson, trackKey, type StoredRow } from './leaderboard.js'
import { readSave } from './save.js'

export const ADMIN_SESSION_TTL_S = 8 * 3600
const ADMIN_PASSWORD_MIN = 16
const BAN_REASON_MAX = 200
const MGET_CHUNK = 200
const USER_PREFIX = 'user:'

/** The admin password, or null when unset / too short (the admin API then answers 503 `notConfigured`). */
export function adminPassword(env: Record<string, string | undefined> = process.env): string | null {
  const p = env.ADMIN_PASSWORD
  return p && p.length >= ADMIN_PASSWORD_MIN ? p : null
}

function configured(): string {
  const p = adminPassword()
  if (!p) throw new ApiError(503, 'notConfigured')
  return p
}

export async function adminLogin(kv: Kv, body: Record<string, unknown>): Promise<AdminLoginOk> {
  const want = configured()
  const given = body.password
  if (typeof given !== 'string') throw new ApiError(400, 'badRequest')
  // Hashed first so the compare runs on equal lengths.
  if (!timingSafeEqual(Buffer.from(sha256(given), 'hex'), Buffer.from(sha256(want), 'hex'))) throw new ApiError(401, 'wrongCredentials')
  const token = randomBytes(32).toString('base64url')
  await kv.set(keys.adminSession(sha256(token)), '1', { ex: ADMIN_SESSION_TTL_S })
  return { token, expiresIn: ADMIN_SESSION_TTL_S }
}

export async function adminLogout(kv: Kv, req: ApiRequest): Promise<void> {
  const token = bearer(req)
  if (token) await kv.del(keys.adminSession(sha256(token)))
}

export async function requireAdmin(kv: Kv, req: ApiRequest): Promise<void> {
  configured()
  const token = bearer(req)
  if (!token || !(await kv.get(keys.adminSession(sha256(token))))) throw new ApiError(401, 'unauthorized')
}

function parse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function toAdminUser(id: string, u: UserRecord, row: StoredRow | null, rank: number | null): AdminUser {
  return {
    id,
    email: u.email,
    companyName: u.companyName,
    createdAt: u.createdAt,
    bannedAt: u.bannedAt ?? null,
    banReason: u.banReason ?? null,
    nameLocked: u.nameLocked === true,
    board: row
      ? { rank, stage: row.stage, valuation: row.valuation, cash: row.cash, day: row.day, team: row.team, status: row.status, updatedAt: row.updatedAt }
      : null,
  }
}

async function mgetChunked(kv: Kv, list: string[]): Promise<(string | null)[]> {
  const out: (string | null)[] = []
  for (let i = 0; i < list.length; i += MGET_CHUNK) out.push(...(await kv.mget(list.slice(i, i + MGET_CHUNK))))
  return out
}

/** Every account, with its board row and rank. Saves are not read here (160 KB each); the detail view does that. */
export async function listUsers(kv: Kv): Promise<AdminUsersOk> {
  const ids = (await kv.scan(USER_PREFIX)).map((k) => k.slice(USER_PREFIX.length))
  const records = await mgetChunked(kv, ids.map(keys.user))
  const rows = await mgetChunked(kv, ids.map(keys.lbRow))
  const ranks = new Map((await kv.zrevrange(keys.lb, 0, -1)).map((m, i) => [m.member, i + 1]))
  const users: AdminUser[] = []
  ids.forEach((id, i) => {
    const u = parse<UserRecord>(records[i])
    if (u) users.push(toAdminUser(id, u, parse<StoredRow>(rows[i]), ranks.get(id) ?? null))
  })
  return { users }
}

export async function userDetail(kv: Kv, id: string): Promise<AdminUserDetail> {
  const u = await readUser(kv, id)
  if (!u) throw new ApiError(404, 'notFound')
  const row = await readJson<StoredRow>(kv, keys.lbRow(id))
  const rank = row ? await kv.zrevrank(keys.lb, id) : null
  const sessions = (await kv.mget((await readSessions(kv, id)).map((s) => keys.session(s.th)))).filter(Boolean).length
  const { data, ...meta } = await readSave(kv, id)
  return { ...toAdminUser(id, u, row, rank === null ? null : rank + 1), sessions, save: data === null ? null : meta }
}

async function takeOffBoard(kv: Kv, id: string): Promise<void> {
  await kv.zrem(keys.lb, id)
  await kv.del(keys.lbRow(id))
  dropTopCache()
}

async function rename(kv: Kv, id: string, u: UserRecord, value: unknown): Promise<void> {
  const name = acceptCompanyName(value)
  if (!name) throw new ApiError(400, 'invalidCompanyName')
  await writeUser(kv, id, { ...u, companyName: name, nameLocked: true })
  const row = await readJson<StoredRow>(kv, keys.lbRow(id))
  if (row) await kv.set(keys.lbRow(id), JSON.stringify({ ...row, companyName: name }))
  dropTopCache()
}

/** Moves the account to the new e-mail's key. Returns the new id. */
async function changeEmail(kv: Kv, id: string, u: UserRecord, value: unknown): Promise<string> {
  const email = normalizeEmail(value)
  if (!email) throw new ApiError(400, 'invalidEmail')
  const next = emailHash(email)
  if (next === id) return id
  if (await kv.get(keys.ban(next))) throw new ApiError(403, 'banned')
  // NX: the claim on the new e-mail comes first; a taken one changes nothing.
  if (!(await kv.set(keys.user(next), JSON.stringify({ ...u, email }), { nx: true }))) throw new ApiError(409, 'emailTaken')
  for (const key of [keys.save, trackKey]) {
    const raw = await kv.get(key(id))
    if (raw) await kv.set(key(next), raw)
  }
  const replay = await kv.get(keys.lbReplay(id))
  if (replay) {
    const ttl = await kv.ttl(keys.lbReplay(id))
    await kv.set(keys.lbReplay(next), replay, ttl > 0 ? { ex: ttl } : undefined)
  }
  const row = await readJson<StoredRow>(kv, keys.lbRow(id))
  if (row) {
    await kv.set(keys.lbRow(next), JSON.stringify({ ...row, email }))
    await kv.zadd(keys.lb, lbScore(row.stage, row.valuation, row.day), next)
  }
  await removeAccount(kv, id)
  return next
}

/** Every record of the account. The e-mail may register again unless it carries a ban mark. */
async function removeAccount(kv: Kv, id: string): Promise<void> {
  await dropSessions(kv, id)
  await takeOffBoard(kv, id)
  for (const key of [keys.user, keys.save, trackKey, keys.lbReplay, keys.pinFails, keys.pinDay]) await kv.del(key(id))
}

async function changePin(kv: Kv, id: string, u: UserRecord, value: unknown): Promise<void> {
  if (!validPin(value)) throw new ApiError(400, 'invalidPin')
  await writeUser(kv, id, { ...u, ...(await hashPin(value)) })
  await dropSessions(kv, id)
  await kv.del(keys.pinFails(id))
  await kv.del(keys.pinDay(id))
}

async function ban(kv: Kv, id: string, u: UserRecord, value: unknown): Promise<void> {
  const reason = typeof value === 'string' ? value.trim().slice(0, BAN_REASON_MAX) : ''
  await writeUser(kv, id, { ...u, bannedAt: now(), ...(reason ? { banReason: reason } : {}) })
  await dropSessions(kv, id)
  await takeOffBoard(kv, id)
}

async function unban(kv: Kv, id: string, u: UserRecord): Promise<void> {
  const { bannedAt: _bannedAt, banReason: _banReason, ...rest } = u
  await writeUser(kv, id, rest)
}

export async function adminAction(kv: Kv, body: Record<string, unknown>): Promise<AdminActionOk> {
  const id = body.id
  if (typeof id !== 'string' || !isUserId(id)) throw new ApiError(400, 'badRequest')
  const u = await readUser(kv, id)
  if (!u) throw new ApiError(404, 'notFound')
  let current = id
  switch (body.action) {
    case 'rename':
      await rename(kv, id, u, body.value)
      break
    case 'email':
      current = await changeEmail(kv, id, u, body.value)
      break
    case 'pin':
      await changePin(kv, id, u, body.value)
      break
    case 'logout':
      await dropSessions(kv, id)
      break
    case 'ban':
      await ban(kv, id, u, body.value)
      break
    case 'unban':
      await unban(kv, id, u)
      break
    case 'delete':
      // Deleting must not be the way around a ban: the e-mail stays blocked, like api/_dev/ban.ts leaves it.
      if (u.bannedAt) await kv.set(keys.ban(id), JSON.stringify({ at: now(), note: u.banReason ?? 'admin' }))
      await removeAccount(kv, id)
      return { user: null }
    default:
      throw new ApiError(400, 'badRequest')
  }
  return { user: await userDetail(kv, current) }
}

/** Ids go into Redis keys: only a real e-mail hash passes. */
export function isUserId(id: string): boolean {
  return /^[0-9a-f]{64}$/.test(id)
}
