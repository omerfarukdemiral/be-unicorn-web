import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AuthOk, LeaderboardOk, LeaderboardSubmitOk, SaveConflictBody, SaveGetOk, SavePutOk } from '../../src/net/contract.js'
import { handler as health } from '../health.js'
import { handler as register } from '../auth/register.js'
import { handler as login } from '../auth/login.js'
import { handler as me } from '../auth/me.js'
import { handler as save } from '../save.js'
import { handler as board } from '../leaderboard/index.js'
import { handler as submitLb } from '../leaderboard/submit.js'
import { setClockForTests, type ApiRequest, type ApiResult } from '../_lib/http.js'
import { setKvForTests } from '../_lib/kv.js'
import { MemoryKv } from '../_lib/memoryKv.js'
import { lbScore } from '../_lib/leaderboard.js'
import { acceptCompanyName, maskEmail, normalizeEmail, resetLimitsForTests, sanitizeCompanyName } from '../_lib/auth.js'
import { pepperMissing } from '../_lib/kv.js'

let t = 1_800_000_000_000
let kv: MemoryKv
let ipSeq = 0

beforeEach(() => {
  t = 1_800_000_000_000
  kv = new MemoryKv(() => t)
  setKvForTests(kv)
  setClockForTests(() => t)
  resetLimitsForTests()
})
afterEach(() => {
  setKvForTests(undefined)
  setClockForTests(null)
})

interface Opts {
  body?: unknown
  token?: string
  query?: Record<string, string>
  ip?: string
  headers?: Record<string, string>
}
function req(method: string, o: Opts = {}): ApiRequest {
  const headers: Record<string, string> = { host: 'game.test', ...o.headers }
  if (o.token) headers.authorization = `Bearer ${o.token}`
  return { method, headers, query: o.query ?? {}, body: o.body, ip: o.ip ?? `10.0.0.${++ipSeq % 250}` }
}
async function call<T>(h: (r: ApiRequest) => Promise<ApiResult>, method: string, o?: Opts): Promise<{ status: number; body: T }> {
  const r = await h(req(method, o))
  return { status: r.status, body: r.body as T }
}
async function signUp(email = 'omer@helio.studio', companyName = 'Helio Studio', pin = '1234'): Promise<string> {
  const r = await call<AuthOk>(register, 'POST', { body: { email, pin, companyName } })
  expect(r.status).toBe(201)
  return r.body.token
}
function saveData(day: number, stage = 0, runIndex = 0): string {
  return JSON.stringify({ version: 2, state: { meta: { runIndex }, time: { day }, stage, stats: { cash: 1 } } })
}
const metrics = (o: Partial<Record<string, unknown>> = {}) => ({
  stage: 0, valuation: 50_000, cash: 12_000, day: 10, team: 1, companyName: 'Helio Studio', runIndex: 0, ...o,
})
/** Advances wall time enough for `days` game days at 4× (2 s per day ⇒ 0.5 s real per day). */
function playDays(days: number): void {
  t += days * 500
}
type Step = Partial<Record<string, unknown>> & { day: number }
/** Submits a run step by step, with the wall time a 4× player needs between steps; every step must pass. */
async function climb(token: string, steps: Step[]): Promise<LeaderboardSubmitOk> {
  let last: { status: number; body: LeaderboardSubmitOk } | null = null
  let prevDay = 0
  for (const st of steps) {
    playDays(Math.max(0, st.day - prevDay) + 1)
    prevDay = st.day
    last = await call<LeaderboardSubmitOk>(submitLb, 'POST', { token, body: metrics(st) })
    expect(last.status, JSON.stringify(last.body)).toBe(200)
  }
  return last!.body
}
/** A believable path to a stage (one submission per stage, at its earliest day + `extra`). */
function pathTo(stage: number, last: Step, extra = 20): Step[] {
  const MIN = [0, 65, 120, 210, 380, 560, 1000]
  const VAL = [50_000, 600_000, 3_500_000, 16_000_000, 80_000_000, 320_000_000]
  const out: Step[] = []
  for (let s = 0; s < stage; s++) out.push({ stage: s, valuation: VAL[s], day: MIN[s]! + extra, team: 2 + s * 4 })
  out.push(last)
  return out
}

describe('health / config', () => {
  it('answers ok with Redis and 503 notConfigured without', async () => {
    expect((await call(health, 'GET')).status).toBe(200)
    setKvForTests(null)
    const r = await call<{ error: string }>(health, 'GET')
    expect(r.status).toBe(503)
    expect(r.body.error).toBe('notConfigured')
  })
  it('production without PIN_PEPPER stays off', async () => {
    expect(pepperMissing({ VERCEL_ENV: 'production' })).toBe(true)
    expect(pepperMissing({ VERCEL_ENV: 'production', PIN_PEPPER: 'short' })).toBe(true)
    expect(pepperMissing({ VERCEL_ENV: 'production', PIN_PEPPER: 'x'.repeat(32) })).toBe(false)
    expect(pepperMissing({ VERCEL_ENV: 'preview' })).toBe(false)
    const prev = process.env.VERCEL_ENV
    process.env.VERCEL_ENV = 'production'
    try {
      expect((await call(health, 'GET')).status).toBe(503)
    } finally {
      if (prev === undefined) delete process.env.VERCEL_ENV
      else process.env.VERCEL_ENV = prev
    }
  })

  it('refuses a foreign Origin and wrong methods', async () => {
    expect((await call(health, 'GET', { headers: { origin: 'https://evil.test' } })).status).toBe(403)
    expect((await call(health, 'GET', { headers: { origin: 'https://game.test' } })).status).toBe(200)
    expect((await call(health, 'POST')).status).toBe(405)
  })
})

describe('input rules', () => {
  it('normalizes e-mail and company names, masks e-mail', () => {
    expect(normalizeEmail('  Omer@Helio.Studio ')).toBe('omer@helio.studio')
    expect(normalizeEmail('nope')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('a..b@x.com')).toBeNull()
    expect(sanitizeCompanyName('  <b>Helio</b>‮  Studio ')).toBe('bHelio/b Studio')
    expect(sanitizeCompanyName('x')).toBeNull()
    expect(sanitizeCompanyName('💸💸')).toBeNull()
    expect(sanitizeCompanyName('a'.repeat(33))).toBeNull()
    expect(maskEmail('omer@helio.studio')).toBe('om***@helio.studio')
    expect(maskEmail('al@x.io')).toBe('a***@x.io')
  })
})

describe('auth', () => {
  it('registers, rejects duplicates and bad input', async () => {
    const token = await signUp()
    expect(token.length).toBeGreaterThan(30)
    expect((await call(register, 'POST', { body: { email: 'OMER@helio.studio', pin: '9999', companyName: 'X Co' } })).status).toBe(409)
    expect((await call<{ error: string }>(register, 'POST', { body: { email: 'bad', pin: '1234', companyName: 'Co' } })).body.error).toBe('invalidEmail')
    expect((await call<{ error: string }>(register, 'POST', { body: { email: 'a@b.co', pin: '12a4', companyName: 'Co' } })).body.error).toBe('invalidPin')
    expect((await call<{ error: string }>(register, 'POST', { body: { email: 'a@b.co', pin: '1234', companyName: ' ' } })).body.error).toBe('invalidCompanyName')
    expect((await call(register, 'POST', { body: 'not json' })).status).toBe(400)
  })

  it('never stores the PIN or the token in clear', async () => {
    const token = await signUp('pin@t.co', 'Pin Co', '4321')
    const dump = (await Promise.all(kv.keys().map((k) => kv.get(k)))).join('\n') + kv.keys().join('\n')
    expect(dump).not.toContain('4321')
    expect(dump).not.toContain(token)
  })

  it('logs in, and the token works for /me until logout', async () => {
    await signUp()
    const r = await call<AuthOk>(login, 'POST', { body: { email: ' Omer@Helio.studio', pin: '1234' } })
    expect(r.status).toBe(200)
    expect(r.body.companyName).toBe('Helio Studio')
    const m = await call<{ email: string }>(me, 'GET', { token: r.body.token })
    expect(m.body.email).toBe('omer@helio.studio')
    expect((await call(me, 'DELETE', { token: r.body.token })).status).toBe(200)
    expect((await call(me, 'GET', { token: r.body.token })).status).toBe(401)
    expect((await call(me, 'GET')).status).toBe(401)
    expect((await call(me, 'GET', { token: 'x'.repeat(43) })).status).toBe(401)
  })

  it('unknown e-mail says so', async () => {
    const r = await call<{ error: string }>(login, 'POST', { body: { email: 'new@helio.studio', pin: '1234' } })
    expect(r.status).toBe(404)
    expect(r.body.error).toBe('unknownEmail')
  })

  it('locks the e-mail for 15 minutes after 5 wrong PINs', async () => {
    await signUp()
    const wrong = () => call<{ error: string; attemptsLeft?: number; retryAfter?: number }>(login, 'POST', { body: { email: 'omer@helio.studio', pin: '0000' } })
    for (let i = 1; i <= 4; i++) {
      const r = await wrong()
      expect(r.status).toBe(401)
      expect(r.body.attemptsLeft).toBe(5 - i)
    }
    const fifth = await wrong()
    expect(fifth.status).toBe(429)
    expect(fifth.body.error).toBe('locked')
    // Even the right PIN is refused while locked.
    const right = await call<{ error: string; retryAfter: number }>(login, 'POST', { body: { email: 'omer@helio.studio', pin: '1234' } })
    expect(right.body.error).toBe('locked')
    expect(right.body.retryAfter).toBeGreaterThan(800)
    t += 15 * 60 * 1000 + 1000
    expect((await call(login, 'POST', { body: { email: 'omer@helio.studio', pin: '1234' } })).status).toBe(200)
  })

  it('parallel guesses cannot get past the lock', async () => {
    await signUp('race@x.co', 'Race', '7351')
    const pins = Array.from({ length: 29 }, (_, i) => String(7330 + i))
    const out = await Promise.all(pins.map((pin, i) => call<{ error?: string }>(login, 'POST', { ip: `9.9.9.${i}`, body: { email: 'race@x.co', pin } })))
    // Only the first five attempts are checked at all; the right PIN (7351, the 22nd) is not among them.
    expect(out.filter((r) => r.status === 200)).toHaveLength(0)
    expect(out.filter((r) => r.status === 401 || (r.status === 429 && r.body.error === 'locked'))).toHaveLength(29)
    expect(out.filter((r) => r.status === 401).length).toBeLessThanOrEqual(4)
  })

  it('caps login attempts per e-mail per day', async () => {
    await signUp('day@x.co', 'Day', '1234')
    let last = 0
    for (let i = 0; i < 31; i++) {
      t += 16 * 60 * 1000 // past each 15-minute lock
      last = (await call(login, 'POST', { body: { email: 'day@x.co', pin: '0000' } })).status
    }
    expect(last).toBe(429)
    expect((await call(login, 'POST', { body: { email: 'day@x.co', pin: '1234' } })).status).toBe(429)
  })

  it('unknown e-mails count as attempts too', async () => {
    for (let i = 0; i < 5; i++) expect((await call(login, 'POST', { body: { email: 'ghost@x.co', pin: '1234' } })).status).toBe(404)
    expect((await call(login, 'POST', { body: { email: 'ghost@x.co', pin: '1234' } })).status).toBe(429)
  })

  it('sign out everywhere ends every session; sessions die after 180 days however used', async () => {
    const a = await signUp()
    const b = (await call<AuthOk>(login, 'POST', { body: { email: 'omer@helio.studio', pin: '1234' } })).body.token
    expect((await call(me, 'DELETE', { token: a, query: { all: '1' } })).status).toBe(200)
    expect((await call(me, 'GET', { token: b })).status).toBe(401)
    const c = (await call<AuthOk>(login, 'POST', { body: { email: 'omer@helio.studio', pin: '1234' } })).body.token
    for (let i = 0; i < 3; i++) {
      t += 60 * 86_400_000
      expect((await call(me, 'GET', { token: c })).status).toBe(200)
    }
    t += 5 * 86_400_000
    expect((await call(me, 'GET', { token: c })).status).toBe(401)
  })

  it('a right PIN resets the wrong-PIN counter', async () => {
    await signUp()
    for (let i = 0; i < 4; i++) await call(login, 'POST', { body: { email: 'omer@helio.studio', pin: '0000' } })
    expect((await call(login, 'POST', { body: { email: 'omer@helio.studio', pin: '1234' } })).status).toBe(200)
    expect((await call(login, 'POST', { body: { email: 'omer@helio.studio', pin: '0000' } })).status).toBe(401)
  })

  it('rate limits auth calls per IP', async () => {
    let last = 0
    for (let i = 0; i < 61; i++) last = (await call(login, 'POST', { ip: '1.2.3.4', body: { email: `u${i}@x.co`, pin: '1234' } })).status
    expect(last).toBe(429)
    // Over the limit: answered from memory, no Redis command.
    const before = kv.keys().length
    expect((await call(login, 'POST', { ip: '1.2.3.4', body: { email: 'z@x.co', pin: '1234' } })).status).toBe(429)
    expect(kv.keys().length).toBe(before)
    expect((await call(login, 'POST', { ip: '5.6.7.8', body: { email: 'u@x.co', pin: '1234' } })).status).toBe(404)
    t += 11 * 60 * 1000
    expect((await call(login, 'POST', { ip: '1.2.3.4', body: { email: 'u@x.co', pin: '1234' } })).status).toBe(404)
  })

  it('sessions slide: used within 90 days they stay alive', async () => {
    const token = await signUp()
    t += 80 * 86_400_000
    expect((await call(me, 'GET', { token })).status).toBe(200)
    t += 80 * 86_400_000
    expect((await call(me, 'GET', { token })).status).toBe(200)
    t += 91 * 86_400_000
    expect((await call(me, 'GET', { token })).status).toBe(401)
  })
})

describe('cloud save', () => {
  it('starts empty, then stores revisions', async () => {
    const token = await signUp()
    const empty = await call<SaveGetOk>(save, 'GET', { token })
    expect(empty.body).toMatchObject({ rev: 0, data: null })
    const put = await call<SavePutOk>(save, 'PUT', { token, body: { data: saveData(12, 1), baseRev: 0 } })
    expect(put.status).toBe(200)
    expect(put.body).toMatchObject({ rev: 1, day: 12, stage: 1 })
    const got = await call<SaveGetOk>(save, 'GET', { token })
    expect(got.body.data).toBe(saveData(12, 1))
    expect(got.body.rev).toBe(1)
  })

  it('an old device cannot overwrite newer progress (409 + server copy), unless forced', async () => {
    const tokenA = await signUp()
    const tokenB = (await call<AuthOk>(login, 'POST', { body: { email: 'omer@helio.studio', pin: '1234' } })).body.token
    await call(save, 'PUT', { token: tokenA, body: { data: saveData(5), baseRev: 0 } }) // rev 1
    await call(save, 'PUT', { token: tokenB, body: { data: saveData(40), baseRev: 1 } }) // rev 2 (B)
    const stale = await call<SaveConflictBody>(save, 'PUT', { token: tokenA, body: { data: saveData(6), baseRev: 1 } })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('conflict')
    expect(stale.body.server.rev).toBe(2)
    expect(stale.body.server.day).toBe(40)
    const forced = await call<SavePutOk>(save, 'PUT', { token: tokenA, body: { data: saveData(6), baseRev: 1, force: true } })
    expect(forced.body.rev).toBe(3)
  })

  it('validates the save shape and size and requires a token', async () => {
    const token = await signUp()
    expect((await call(save, 'GET')).status).toBe(401)
    expect((await call<{ error: string }>(save, 'PUT', { token, body: { data: '{"x":1}', baseRev: 0 } })).body.error).toBe('invalidSave')
    expect((await call(save, 'PUT', { token, body: { data: 'nope', baseRev: 0 } })).status).toBe(400)
    expect((await call(save, 'PUT', { token, body: { data: saveData(1) } })).status).toBe(400)
    const big = JSON.stringify({ version: 2, state: { meta: {}, time: { day: 1 }, stage: 0, stats: {}, pad: 'x'.repeat(170 * 1024) } })
    expect((await call(save, 'PUT', { token, body: { data: big, baseRev: 0 } })).status).toBe(413)
    expect((await call(save, 'PUT', { token, body: { data: saveData(1), baseRev: 0 }, headers: { 'content-length': String(500 * 1024) } })).status).toBe(413)
  })
})

describe('leaderboard', () => {
  it('score orders stage first, then valuation; Unicorns by fewer days', () => {
    expect(lbScore(2, 1, 100)).toBeGreaterThan(lbScore(1, 9e11, 100))
    expect(lbScore(1, 600_000, 100)).toBeGreaterThan(lbScore(1, 500_000, 100))
    expect(lbScore(6, 1e9, 200)).toBeGreaterThan(lbScore(6, 5e9, 201))
    expect(lbScore(6, 1e9, 999)).toBeGreaterThan(lbScore(5, 9e11, 1))
  })

  it('ranks players, masks other e-mails, shows my row + the gap above', async () => {
    const a = await signUp('omer@helio.studio', 'Helio Studio')
    const b = await signUp('zeynep@kod.io', 'Kod Atölyesi')
    const c = await signUp('can@x.co', 'Can Co')
    playDays(400)
    await climb(a, [{ stage: 1, valuation: 400_000, day: 70, team: 3 }])
    await climb(b, [
      { stage: 1, valuation: 600_000, day: 70, team: 5, companyName: 'Kod Atölyesi' },
      { stage: 2, valuation: 1_000_000, day: 130, team: 7, companyName: 'Kod Atölyesi' },
    ])
    const r = await climb(c, [{ stage: 1, valuation: 300_000, day: 66, team: 2, companyName: 'Can Co' }])
    expect(r).toMatchObject({ rank: 3, total: 3 })

    const anon = await call<LeaderboardOk>(board, 'GET')
    expect(anon.body.rows.map((x) => x.companyName)).toEqual(['Kod Atölyesi', 'Helio Studio', 'Can Co'])
    expect(anon.body.rows.map((x) => x.email)).toEqual(['ze***@kod.io', 'om***@helio.studio', 'c***@x.co'])
    expect(anon.body.me).toBeUndefined()

    const mine = await call<LeaderboardOk>(board, 'GET', { token: a })
    const own = mine.body.rows.find((x) => x.me)!
    expect(own.email).toBe('omer@helio.studio')
    expect(mine.body.rows.filter((x) => x.email.includes('***'))).toHaveLength(2)
    expect(mine.body.me).toMatchObject({ rank: 2, companyName: 'Helio Studio', day: 70, team: 3 })
    expect(mine.body.above?.companyName).toBe('Kod Atölyesi')
    expect(mine.body.above?.email).toBe('ze***@kod.io')
    expect(mine.body.gap).toEqual({ stages: 1, valuation: 0, days: 0 })

    const low = await call<LeaderboardOk>(board, 'GET', { token: c })
    expect(low.body.gap).toEqual({ stages: 0, valuation: 100_000, days: 0 })

    const top = await call<LeaderboardOk>(board, 'GET', { token: b })
    expect(top.body.me?.rank).toBe(1)
    expect(top.body.above).toBeUndefined()

    expect((await call<LeaderboardOk>(board, 'GET', { query: { limit: '2' } })).body.rows).toHaveLength(2)
  })

  it('the caller sees their own row even outside the top limit', async () => {
    const a = await signUp('a1@x.co', 'Aaa')
    const b = await signUp('b1@x.co', 'Bbb')
    playDays(100)
    await call(submitLb, 'POST', { token: a, body: metrics({ valuation: 90_000 }) })
    await call(submitLb, 'POST', { token: b, body: metrics({ valuation: 10_000 }) })
    const r = await call<LeaderboardOk>(board, 'GET', { token: b, query: { limit: '1' } })
    expect(r.body.rows).toHaveLength(1)
    expect(r.body.me).toMatchObject({ rank: 2, email: 'b1@x.co' })
  })

  it('Unicorns: fewer days ranks higher', async () => {
    const a = await signUp('fast@x.co', 'Fast')
    const b = await signUp('slow@x.co', 'Slow')
    await climb(b, pathTo(6, { stage: 6, valuation: 3e9, cash: 1e8, day: 1300, team: 60, companyName: 'Slow' }).map((x) => ({ companyName: 'Slow', ...x })))
    await climb(a, pathTo(6, { stage: 6, valuation: 1.1e9, cash: 1e8, day: 1100, team: 50, companyName: 'Fast' }).map((x) => ({ companyName: 'Fast', ...x })))
    const r = await call<LeaderboardOk>(board, 'GET', { token: b })
    expect(r.body.rows[0]!.companyName).toBe('Fast')
    expect(r.body.rows[0]!.status).toBe('unicorn')
    expect(r.body.gap).toEqual({ stages: 0, valuation: 0, days: 200 })
  })

  it('a Unicorn right after a payday submission is accepted (5 → 6 has no round)', async () => {
    const a = await signUp()
    await climb(a, pathTo(5, { stage: 5, valuation: 9e8, cash: 5e7, day: 1200, team: 50 }))
    playDays(2)
    const win = await call<LeaderboardSubmitOk>(submitLb, 'POST', { token: a, body: metrics({ stage: 6, valuation: 1.05e9, cash: 5e7, day: 1201, team: 50, status: 'unicorn' }) })
    expect(win.status).toBe(200)
    expect(win.body.row.status).toBe('unicorn')
  })

  it('a brand-new account cannot post a 29-day Unicorn, nor a new run that starts already funded', async () => {
    const a = await signUp()
    const cheat = { stage: 6, valuation: 1e11, cash: 2e11, day: 29, team: 125, runIndex: 1, status: 'unicorn' }
    expect((await call<{ detail: string }>(submitLb, 'POST', { token: a, body: metrics(cheat) })).body.detail).toBe('stageTooFast')
    playDays(5000)
    const late = { stage: 6, valuation: 1.5e9, cash: 1e8, day: 1100, team: 60, runIndex: 2, status: 'unicorn' }
    expect((await call<{ detail: string }>(submitLb, 'POST', { token: a, body: metrics(late) })).body.detail).toBe('newRunStage')
    // Seen from Garaj, the run still has to take its time in wall-clock terms.
    expect((await call(submitLb, 'POST', { token: a, body: metrics({ runIndex: 3, day: 10 }) })).status).toBe(200)
    t += 1000
    expect((await call<{ detail: string }>(submitLb, 'POST', { token: a, body: metrics({ ...late, runIndex: 3 }) })).body.detail).toBe('dayVsClock')
  })

  it('requires a token to submit', async () => {
    expect((await call(submitLb, 'POST', { body: metrics() })).status).toBe(401)
  })

  it('rejects impossible numbers', async () => {
    const a = await signUp()
    playDays(3000)
    const bad = async (o: Record<string, unknown>) => (await call<{ error: string; detail: string }>(submitLb, 'POST', { token: a, body: metrics(o) })).body
    expect((await bad({ stage: 7 })).detail).toBe('stage')
    expect((await bad({ stage: 1.5 })).detail).toBe('stage')
    expect((await bad({ valuation: -1 })).detail).toBe('valuation')
    expect((await bad({ stage: 0, valuation: 5e9 })).detail).toBe('valuation')
    expect((await bad({ stage: 6, valuation: 1e6, day: 1200 })).detail).toBe('unicornValuation')
    expect((await bad({ stage: 3, valuation: 5e6, day: 150 })).detail).toBe('stageTooFast')
    expect((await bad({ stage: 6, valuation: 1.2e9, day: 900 })).detail).toBe('stageTooFast')
    expect((await bad({ team: 500 })).detail).toBe('team')
    expect((await bad({ cash: 9e9 })).detail).toBe('cash')
    expect((await bad({ status: 'unicorn' })).detail).toBe('status')
    expect((await call(submitLb, 'POST', { token: a, body: metrics({ day: 'x' }) })).status).toBe(400)
    expect((await call(submitLb, 'POST', { token: a, body: metrics({ valuation: Number.NaN }) })).status).toBe(400)
  })

  it('checks progress against the previous submission and the wall clock', async () => {
    const a = await signUp()
    // A brand-new account cannot already be on day 900.
    expect((await call<{ detail: string }>(submitLb, 'POST', { token: a, body: metrics({ day: 900 }) })).body.detail).toBe('dayVsClock')
    playDays(70)
    expect((await call(submitLb, 'POST', { token: a, body: metrics({ stage: 1, valuation: 400_000, day: 70 }) })).status).toBe(200)
    // No time passed: the game cannot be 100 days further.
    expect((await call<{ detail: string }>(submitLb, 'POST', { token: a, body: metrics({ stage: 1, valuation: 400_000, day: 170 }) })).body.detail).toBe('dayVsClock')
    playDays(100)
    expect((await call<{ detail: string }>(submitLb, 'POST', { token: a, body: metrics({ stage: 1, valuation: 400_000, day: 66 }) })).body.detail).toBe('dayBackwards')
    expect((await call<{ detail: string }>(submitLb, 'POST', { token: a, body: metrics({ stage: 0, valuation: 400_000, day: 80 }) })).body.detail).toBe('stageBackwards')
    expect((await call<{ detail: string }>(submitLb, 'POST', { token: a, body: metrics({ stage: 5, valuation: 2e8, day: 80 }) })).body.detail).toBe('stageTooFast')
    expect((await call<{ detail: string }>(submitLb, 'POST', { token: a, body: metrics({ stage: 1, valuation: 5e7, day: 71 }) })).body.detail).toBe('valuationJump')
    expect((await call(submitLb, 'POST', { token: a, body: metrics({ stage: 2, valuation: 2_000_000, day: 150 }) })).status).toBe(200)
  })

  it('a new run replaces the row; an older run is refused; a Unicorn finish is kept until beaten', async () => {
    const a = await signUp()
    await climb(a, [{ stage: 1, valuation: 7e5, day: 80, runIndex: 0 }, { stage: 2, valuation: 2e6, day: 200, runIndex: 0, status: 'bankrupt' }])
    const next = await call<LeaderboardSubmitOk>(submitLb, 'POST', { token: a, body: metrics({ stage: 0, valuation: 20_000, day: 3, runIndex: 1 }) })
    expect(next.body.row).toMatchObject({ stage: 0, day: 3, status: 'playing' })
    expect((await call<{ error: string }>(submitLb, 'POST', { token: a, body: metrics({ runIndex: 0, day: 300 }) })).body.error).toBe('staleRun')

    await climb(a, pathTo(6, { stage: 6, valuation: 1.2e9, cash: 5e7, day: 1100, team: 55, runIndex: 1, companyName: 'Helio Studio' }).map((x) => ({ runIndex: 1, ...x })))
    const third = await call<LeaderboardSubmitOk>(submitLb, 'POST', { token: a, body: metrics({ stage: 1, valuation: 600_000, day: 70, runIndex: 2, companyName: 'Finly' }) })
    expect(third.status).toBe(200)
    // The kept Unicorn keeps the name it won with, even though the new run is called Finly.
    expect(third.body.row).toMatchObject({ stage: 6, status: 'unicorn', day: 1100, companyName: 'Helio Studio' })
    // The new run keeps being tracked: its next step is judged against run 2, not the kept Unicorn.
    playDays(40)
    expect((await call(submitLb, 'POST', { token: a, body: metrics({ stage: 1, valuation: 700_000, day: 100, runIndex: 2, companyName: 'Finly' }) })).status).toBe(200)
  })

  it('keeps the company name sanitized and in sync; refuses links and swear words; one rename a day', async () => {
    const a = await signUp()
    playDays(50)
    const r = await call<LeaderboardSubmitOk>(submitLb, 'POST', { token: a, body: metrics({ companyName: '  Helio <Labs>  ' }) })
    expect(r.body.row.companyName).toBe('Helio Labs')
    expect((await call<{ companyName: string }>(me, 'GET', { token: a })).body.companyName).toBe('Helio Labs')
    // Same run, a second rename the same day is ignored (the submission itself still counts).
    playDays(10)
    const again = await call<LeaderboardSubmitOk>(submitLb, 'POST', { token: a, body: metrics({ day: 20, companyName: 'Başka Ad' }) })
    expect(again.status).toBe(200)
    expect(again.body.row.companyName).toBe('Helio Labs')
    // A new run may be renamed at once, but never to a banned name.
    const bad = await call<LeaderboardSubmitOk>(submitLb, 'POST', { token: a, body: metrics({ day: 5, runIndex: 1, companyName: 'Fuck Labs' }) })
    expect(bad.body.row.companyName).toBe('Helio Labs')
    expect((await call<{ error: string }>(register, 'POST', { body: { email: 'x@y.co', pin: '1234', companyName: 'www.spam.com' } })).body.error).toBe('invalidCompanyName')
    expect(acceptCompanyName('Klasik Labs')).toBe('Klasik Labs')
    expect(acceptCompanyName('s1kt1r ltd')).toBeNull()
  })

  it('stores a replay for audit when the stage changes, and caps its size', async () => {
    const a = await signUp()
    playDays(50)
    await call(submitLb, 'POST', { token: a, body: metrics({ replay: { seed: 7, actions: [] } }) })
    expect(kv.keys().some((k) => k.startsWith('lb:replay:'))).toBe(true)
    playDays(5)
    const huge = { seed: 1, actions: ['x'.repeat(210 * 1024)] }
    expect((await call(submitLb, 'POST', { token: a, body: metrics({ day: 12, replay: huge }) })).status).toBe(413)
  })
})
