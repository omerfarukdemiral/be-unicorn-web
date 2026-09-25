// Dev only: the real API handlers over an in-memory Redis, for `MOCK_API=1 npm run dev` (vite.config.ts mounts it
// as middleware). Lets the sign-in, cloud save and leaderboard run locally and in Playwright without `vercel dev` or
// Upstash. Never deployed (Vercel skips `_` folders) and never imported by the app.
import type { ApiRequest, ApiResult } from '../_lib/http.js'
import { setKvForTests } from '../_lib/kv.js'
import { MemoryKv } from '../_lib/memoryKv.js'
import { handler as health } from '../health.js'
import { handler as register } from '../auth/register.js'
import { handler as login } from '../auth/login.js'
import { handler as me } from '../auth/me.js'
import { handler as save } from '../save.js'
import { handler as board } from '../leaderboard/index.js'
import { handler as submit } from '../leaderboard/submit.js'
import { emailHash, keys, normalizeEmail } from '../_lib/auth.js'
import { lbScore } from '../_lib/leaderboard.js'

const ROUTES: Record<string, (req: ApiRequest) => Promise<ApiResult>> = {
  '/api/health': health,
  '/api/auth/register': register,
  '/api/auth/login': login,
  '/api/auth/me': me,
  '/api/save': save,
  '/api/leaderboard': board,
  '/api/leaderboard/submit': submit,
}

let kv: MemoryKv | null = null

interface SeedRow {
  email: string
  companyName: string
  stage: number
  valuation: number
  cash: number
  day: number
  team: number
  status?: 'playing' | 'bankrupt' | 'unicorn'
}

/** POST /api/dev/seed {rows}: puts rows straight on the board (screenshots / manual testing; skips the checks). */
async function seed(req: ApiRequest): Promise<ApiResult> {
  const rows = ((req.body as { rows?: SeedRow[] } | null)?.rows ?? []).slice(0, 100)
  for (const r of rows) {
    const email = normalizeEmail(r.email)
    if (!email || !kv) continue
    const h = emailHash(email)
    const row = { ...r, email, status: r.status ?? (r.stage === 6 ? 'unicorn' : 'playing'), runIndex: 0, updatedAt: Date.now() }
    await kv.zadd(keys.lb, lbScore(r.stage, r.valuation, r.day), h)
    await kv.set(keys.lbRow(h), JSON.stringify(row))
  }
  return { status: 200, body: { ok: true, seeded: rows.length } }
}

/** Handles one request; null = not an API route (404 by the caller). */
export async function devApi(req: ApiRequest & { path: string }): Promise<ApiResult | null> {
  if (!kv) {
    kv = new MemoryKv()
    setKvForTests(kv)
  }
  if (req.path === '/api/dev/seed' && req.method === 'POST') return seed(req)
  const h = ROUTES[req.path]
  return h ? h(req) : null
}
