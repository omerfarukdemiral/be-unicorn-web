import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AdminActionOk, AdminLoginOk, AdminUserDetail, AdminUsersOk, AuthOk, LeaderboardOk, LeaderboardSubmitOk, SaveGetOk } from '../../src/net/contract.js'
import { handler as adminLogin } from '../admin/login.js'
import { handler as adminUsers } from '../admin/users.js'
import { handler as register } from '../auth/register.js'
import { handler as login } from '../auth/login.js'
import { handler as me } from '../auth/me.js'
import { handler as save } from '../save.js'
import { handler as board } from '../leaderboard/index.js'
import { handler as submitLb } from '../leaderboard/submit.js'
import { setClockForTests, type ApiRequest, type ApiResult } from '../_lib/http.js'
import { setKvForTests } from '../_lib/kv.js'
import { MemoryKv } from '../_lib/memoryKv.js'
import { adminPassword } from '../_lib/admin.js'
import { emailHash, resetLimitsForTests } from '../_lib/auth.js'

const PASSWORD = 'correct-horse-battery'
let t = 1_800_000_000_000
let kv: MemoryKv
let ipSeq = 0
let savedPassword: string | undefined

beforeEach(() => {
  t = 1_800_000_000_000
  kv = new MemoryKv(() => t)
  setKvForTests(kv)
  setClockForTests(() => t)
  resetLimitsForTests()
  savedPassword = process.env.ADMIN_PASSWORD
  process.env.ADMIN_PASSWORD = PASSWORD
})
afterEach(() => {
  setKvForTests(undefined)
  setClockForTests(null)
  if (savedPassword === undefined) delete process.env.ADMIN_PASSWORD
  else process.env.ADMIN_PASSWORD = savedPassword
})

interface Opts {
  body?: unknown
  token?: string
  query?: Record<string, string>
  ip?: string
}
async function call<T>(h: (r: ApiRequest) => Promise<ApiResult>, method: string, o: Opts = {}): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { host: 'game.test' }
  if (o.token) headers.authorization = `Bearer ${o.token}`
  const r = await h({ method, headers, query: o.query ?? {}, body: o.body, ip: o.ip ?? `10.0.0.${++ipSeq % 250}` })
  return { status: r.status, body: r.body as T }
}
const signIn = async () => (await call<AdminLoginOk>(adminLogin, 'POST', { body: { password: PASSWORD } })).body.token
const signUp = async (email = 'omer@helio.studio', companyName = 'Helio Studio') =>
  (await call<AuthOk>(register, 'POST', { body: { email, pin: '1234', companyName } })).body.token
const act = (token: string, id: string, action: string, value?: string) =>
  call<AdminActionOk & { error?: string }>(adminUsers, 'POST', { token, body: { id, action, value } })
const playerLogin = (email: string, pin = '1234') => call<AuthOk & { error?: string }>(login, 'POST', { body: { email, pin } })
const saveData = JSON.stringify({ version: 2, state: { meta: { runIndex: 0 }, time: { day: 12 }, stage: 0, stats: { cash: 1 } } })
/** A save and a board row, like a real player has. */
async function playALittle(token: string): Promise<void> {
  await call(save, 'PUT', { token, body: { data: saveData, baseRev: 0 } })
  t += 60_000
  const r = await call<LeaderboardSubmitOk>(submitLb, 'POST', { token, body: { stage: 0, valuation: 50_000, cash: 12_000, day: 10, team: 1, runIndex: 0, replay: { seed: 1 } } })
  expect(r.status).toBe(200)
}

describe('admin sign-in', () => {
  it('needs the password, and stays off without a long enough one', async () => {
    expect(adminPassword({})).toBeNull()
    expect(adminPassword({ ADMIN_PASSWORD: 'short' })).toBeNull()
    expect((await call(adminLogin, 'POST', { body: { password: 'nope' } })).status).toBe(401)
    expect((await call(adminUsers, 'GET')).status).toBe(401)
    expect((await call(adminUsers, 'GET', { token: 'x'.repeat(43) })).status).toBe(401)
    const token = await signIn()
    expect((await call(adminUsers, 'GET', { token })).status).toBe(200)
    delete process.env.ADMIN_PASSWORD
    expect((await call(adminUsers, 'GET', { token })).status).toBe(503)
    expect((await call(adminLogin, 'POST', { body: { password: '' } })).status).toBe(503)
  })

  it('a player token opens nothing; the admin session ends on logout and after 8 hours', async () => {
    expect((await call(adminUsers, 'GET', { token: await signUp() })).status).toBe(401)
    const a = await signIn()
    expect((await call(adminLogin, 'DELETE', { token: a })).status).toBe(200)
    expect((await call(adminUsers, 'GET', { token: a })).status).toBe(401)
    const b = await signIn()
    t += 8 * 3600 * 1000 + 1000
    expect((await call(adminUsers, 'GET', { token: b })).status).toBe(401)
  })

  it('limits password tries per IP', async () => {
    let last = 0
    for (let i = 0; i < 11; i++) last = (await call(adminLogin, 'POST', { ip: '1.2.3.4', body: { password: 'nope' } })).status
    expect(last).toBe(429)
  })
})

describe('admin list and detail', () => {
  it('lists accounts with their board row, never the PIN hash', async () => {
    const admin = await signIn()
    await playALittle(await signUp())
    await signUp('can@x.co', 'Can Co')
    const r = await call<AdminUsersOk>(adminUsers, 'GET', { token: admin })
    expect(r.body.users).toHaveLength(2)
    const omer = r.body.users.find((u) => u.email === 'omer@helio.studio')!
    expect(omer.board).toMatchObject({ rank: 1, day: 10, stage: 0 })
    expect(r.body.users.find((u) => u.email === 'can@x.co')!.board).toBeNull()
    expect(JSON.stringify(r.body)).not.toMatch(/pinHash|salt/)
  })

  it('shows sessions and the save summary, without the save itself', async () => {
    const admin = await signIn()
    await playALittle(await signUp())
    const d = await call<AdminUserDetail>(adminUsers, 'GET', { token: admin, query: { id: emailHash('omer@helio.studio') } })
    expect(d.body.sessions).toBe(1)
    expect(d.body.save).toMatchObject({ rev: 1, day: 12 })
    expect(d.body.save).not.toHaveProperty('data')
    expect((await call(adminUsers, 'GET', { token: admin, query: { id: 'user:*' } })).status).toBe(400)
    expect((await call(adminUsers, 'GET', { token: admin, query: { id: 'f'.repeat(64) } })).status).toBe(404)
  })
})

describe('admin actions', () => {
  const id = emailHash('omer@helio.studio')

  it('ban: sessions end, login refuses, the board row goes; unban lets the player back', async () => {
    const admin = await signIn()
    const player = await signUp()
    await playALittle(player)
    const banned = await act(admin, id, 'ban', 'hile')
    expect(banned.body.user).toMatchObject({ banReason: 'hile', board: null, sessions: 0 })
    expect((await call(me, 'GET', { token: player })).status).toBe(401)
    expect((await call<LeaderboardOk>(board, 'GET')).body.rows).toHaveLength(0)

    const wrong = await playerLogin('omer@helio.studio', '0000')
    expect(wrong.status).toBe(401) // the ban shows only behind the right PIN
    const right = await playerLogin('omer@helio.studio')
    expect(right.status).toBe(403)
    expect(right.body.error).toBe('banned')
    expect((await call(register, 'POST', { body: { email: 'omer@helio.studio', pin: '9999', companyName: 'Yeni' } })).status).toBe(409)

    expect((await act(admin, id, 'unban')).body.user).toMatchObject({ bannedAt: null, banReason: null })
    expect((await playerLogin('omer@helio.studio')).status).toBe(200)
  })

  it('a banned session cannot come back through a leftover token', async () => {
    const admin = await signIn()
    const player = await signUp()
    // Session key survives (e.g. the list was already full): the account check still refuses it.
    await kv.del(`sessions:${id}`)
    await act(admin, id, 'ban')
    expect((await call(save, 'GET', { token: player })).status).toBe(401)
  })

  it('rename shows on the board at once and survives the name the game keeps sending', async () => {
    const admin = await signIn()
    const player = await signUp()
    await playALittle(player)
    expect((await act(admin, id, 'rename', 'Temiz Ad')).body.user).toMatchObject({ companyName: 'Temiz Ad', nameLocked: true })
    expect((await call<LeaderboardOk>(board, 'GET')).body.rows[0]!.companyName).toBe('Temiz Ad')
    expect((await act(admin, id, 'rename', 'www.spam.com')).status).toBe(400)
    t += 2 * 86_400_000
    const r = await call<LeaderboardSubmitOk>(submitLb, 'POST', {
      token: player,
      body: { stage: 0, valuation: 60_000, cash: 12_000, day: 20, team: 1, runIndex: 1, companyName: 'Helio Studio' },
    })
    expect(r.body.row.companyName).toBe('Temiz Ad')
  })

  it('e-mail change moves everything, signs out, and the same PIN logs in', async () => {
    const admin = await signIn()
    const player = await signUp()
    await playALittle(player)
    const moved = await act(admin, id, 'email', ' Yeni@Helio.Studio ')
    expect(moved.body.user).toMatchObject({ email: 'yeni@helio.studio', id: emailHash('yeni@helio.studio'), sessions: 0 })
    expect(moved.body.user!.save).toMatchObject({ rev: 1, day: 12 })
    expect(kv.keys().filter((k) => k.includes(id))).toEqual([])
    expect((await call(me, 'GET', { token: player })).status).toBe(401)
    expect((await playerLogin('omer@helio.studio')).status).toBe(404)
    const back = await playerLogin('yeni@helio.studio')
    expect(back.status).toBe(200)
    expect((await call<SaveGetOk>(save, 'GET', { token: back.body.token })).body.data).toBe(saveData)
    const rows = (await call<LeaderboardOk>(board, 'GET', { token: back.body.token })).body.rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ email: 'yeni@helio.studio', me: true })
  })

  it('a taken or bad e-mail changes nothing', async () => {
    const admin = await signIn()
    await signUp()
    await signUp('can@x.co', 'Can Co')
    expect((await act(admin, id, 'email', 'can@x.co')).status).toBe(409)
    expect((await act(admin, id, 'email', 'nope')).status).toBe(400)
    expect((await playerLogin('omer@helio.studio')).status).toBe(200)
    expect((await playerLogin('can@x.co')).status).toBe(200)
  })

  it('an e-mail on the ban list takes no account', async () => {
    const admin = await signIn()
    await signUp()
    await kv.set(`ban:${emailHash('kara@x.co')}`, '{}')
    expect((await act(admin, id, 'email', 'kara@x.co')).status).toBe(403)
    expect((await playerLogin('omer@helio.studio')).status).toBe(200)
  })

  it('deleting a banned account keeps the e-mail from registering again', async () => {
    const admin = await signIn()
    await signUp()
    await act(admin, id, 'ban', 'hile')
    await act(admin, id, 'delete')
    const again = await call<{ error: string }>(register, 'POST', { body: { email: 'omer@helio.studio', pin: '1234', companyName: 'Yeni' } })
    expect(again.status).toBe(403)
    expect(again.body.error).toBe('banned')
  })

  it('new PIN: old one stops working, sessions end, the lock lifts', async () => {
    const admin = await signIn()
    const player = await signUp()
    for (let i = 0; i < 6; i++) await playerLogin('omer@helio.studio', '0000')
    expect((await playerLogin('omer@helio.studio')).status).toBe(429)
    expect((await act(admin, id, 'pin', '12a4')).status).toBe(400)
    expect((await act(admin, id, 'pin', '4321')).status).toBe(200)
    expect((await call(me, 'GET', { token: player })).status).toBe(401)
    expect((await playerLogin('omer@helio.studio', '1234')).status).toBe(401)
    expect((await playerLogin('omer@helio.studio', '4321')).status).toBe(200)
  })

  it('logout ends every device without touching the account', async () => {
    const admin = await signIn()
    const player = await signUp()
    expect((await act(admin, id, 'logout')).body.user?.sessions).toBe(0)
    expect((await call(me, 'GET', { token: player })).status).toBe(401)
    expect((await playerLogin('omer@helio.studio')).status).toBe(200)
  })

  it('delete wipes every record, and the e-mail may register again', async () => {
    const admin = await signIn()
    const other = await signUp('can@x.co', 'Can Co')
    await playALittle(await signUp())
    expect((await act(admin, id, 'delete')).body.user).toBeNull()
    expect(kv.keys().filter((k) => k.includes(id))).toEqual([])
    expect((await call<LeaderboardOk>(board, 'GET')).body.rows).toHaveLength(0)
    expect((await act(admin, id, 'ban')).status).toBe(404)
    expect((await call(me, 'GET', { token: other })).status).toBe(200)
    await signUp()
  })

  it('refuses unknown actions and malformed ids', async () => {
    const admin = await signIn()
    await signUp()
    expect((await act(admin, id, 'explode')).status).toBe(400)
    expect((await act(admin, 'user:x', 'ban')).status).toBe(400)
  })
})
