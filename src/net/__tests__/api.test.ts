import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backendStatus, getLeaderboard, login, putSave, register, resetNetForTests, resumeSession } from '../api'
import { runLengthText, teamText } from '../netText'
import { readSession, writeSession } from '../session'

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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubGlobal('localStorage', new MemStorage())
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  resetNetForTests()
})
afterEach(() => vi.unstubAllGlobals())

describe('net/api', () => {
  it('treats the Vite dev fallback (HTML) and 503 notConfigured as offline', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    expect(await backendStatus()).toBe('offline')
    fetchMock.mockResolvedValueOnce(json(503, { error: 'notConfigured' }))
    expect(await backendStatus(true)).toBe('offline')
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))
    expect(await backendStatus(true)).toBe('online')
    fetchMock.mockRejectedValueOnce(new TypeError('network'))
    fetchMock.mockRejectedValueOnce(new TypeError('network'))
    expect(await backendStatus(true)).toBe('offline')
  })

  it('an unreachable first probe (cold start, blip) is tried once more before going offline', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network'))
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))
    expect(await backendStatus(true)).toBe('online')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('register stores the session; errors come back with Turkish messages', async () => {
    fetchMock.mockResolvedValueOnce(json(201, { token: 't'.repeat(43), email: 'omer@helio.studio', companyName: 'Helio', expiresIn: 1 }))
    const r = await register('omer@helio.studio', '1234', 'Helio')
    expect(r.ok).toBe(true)
    expect(readSession()).toMatchObject({ email: 'omer@helio.studio', companyName: 'Helio', cloudRev: 0 })
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(body).toEqual({ email: 'omer@helio.studio', pin: '1234', companyName: 'Helio' })

    fetchMock.mockResolvedValueOnce(json(401, { error: 'wrongCredentials', attemptsLeft: 2 }))
    const bad = await login('omer@helio.studio', '0000')
    expect(bad.ok).toBe(false)
    if (!bad.ok) {
      expect(bad.error).toBe('wrongCredentials')
      expect(bad.message).toContain('2 hakkın kaldı')
    }
    fetchMock.mockResolvedValueOnce(json(429, { error: 'locked', retryAfter: 900 }))
    const locked = await login('omer@helio.studio', '0000')
    if (!locked.ok) expect(locked.message).toContain('15 dk')
  })

  it('an expired token clears the session', async () => {
    writeSession({ token: 'x'.repeat(43), email: 'a@b.co', companyName: 'A', cloudRev: 3 })
    fetchMock.mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
    const r = await resumeSession()
    expect(r.ok).toBe(false)
    expect(readSession()).toBeNull()
    expect(fetchMock.mock.calls[0]![1].headers.authorization).toBe(`Bearer ${'x'.repeat(43)}`)
  })

  it('putSave sends this device\'s revision and surfaces conflicts with the server copy', async () => {
    writeSession({ token: 'x'.repeat(43), email: 'a@b.co', companyName: 'A', cloudRev: 4 })
    fetchMock.mockResolvedValueOnce(json(200, { rev: 5, updatedAt: 1, day: 3, stage: 0, runIndex: 0 }))
    expect((await putSave('{}')).ok).toBe(true)
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string).baseRev).toBe(4)
    expect(readSession()?.cloudRev).toBe(5)
    const server = { rev: 9, updatedAt: 2, day: 90, stage: 2, runIndex: 0, data: '{}' }
    fetchMock.mockResolvedValueOnce(json(409, { error: 'conflict', server }))
    const c = await putSave('{}')
    expect(c.ok).toBe(false)
    if (!c.ok && 'server' in c) expect(c.server.day).toBe(90)
  })

  it('a dead token still shows the public board', async () => {
    writeSession({ token: 'x'.repeat(43), email: 'a@b.co', companyName: 'A', cloudRev: 0 })
    fetchMock.mockResolvedValueOnce(json(401, { error: 'unauthorized' }))
    fetchMock.mockResolvedValueOnce(json(200, { rows: [], total: 0, now: 1 }))
    const r = await getLeaderboard()
    expect(r.ok).toBe(true)
    expect(fetchMock.mock.calls[1]![1].headers.authorization).toBeUndefined()
  })

  it('formats leaderboard pieces', () => {
    expect(runLengthText(209.4)).toBe('7 ay (210 gün)')
    expect(runLengthText(11.7)).toBe('12 gün')
    expect(teamText(18)).toBe('18 kişilik ekip')
    expect(teamText(1)).toBe('Tek kişilik ekip')
  })
})
