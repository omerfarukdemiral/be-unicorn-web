// Jev: an OpenRouter model plays a whole Be Unicorn run in a visible Chrome window while you watch.
//   npm run jev                       # model from OPENROUTER_MODEL, 1×, a look every 7 game days
//   npm run jev -- --speed 2 --every 10 --model openai/gpt-4o-mini
//   npm run jev -- --dry --headless --max-minutes 3   # no model: follows the game's own chip (testing)
// Flags: --model --speed 1|2|4 --every <days> --name <company> --max-minutes <n> --env <file> --chrome <path>
//        --dry --headless --look <name> (adds ?look=<name>) --port <n> --pw <playwright-core dir> --max-tokens <n>
//        --shot <png> (screenshot after the first move, for tests)
// The API key is read in this Node process only (OPENROUTER_API_KEY from --env, default ../06_Be-Unicorn-Web/.env.local)
// and goes only into the Authorization header. The page never sees it; nothing logs it.
import { spawn, type ChildProcess } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import { ask, type LlmConfig } from './llm'
import type { JevBridge, JevSnapshot, JevStatus } from './page'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const FORBIDDEN_PORT = 5199

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2)
function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  if (i < 0) return undefined
  const v = argv[i + 1]
  return v === undefined || v.startsWith('--') ? '' : v
}
const has = (name: string) => argv.includes(`--${name}`)
const num = (name: string, fallback: number) => {
  const v = Number(flag(name))
  return flag(name) !== undefined && Number.isFinite(v) ? v : fallback
}

const ENV_FILE = resolve(ROOT, flag('env') || '../06_Be-Unicorn-Web/.env.local')
const DRY = has('dry')
const HEADLESS = has('headless')
const SPEED = ([1, 2, 4] as const).find((s) => s === num('speed', 1)) ?? 1
const EVERY = Math.max(1, num('every', 7))
const NAME = flag('name') || 'Jev Labs'
const MAX_MINUTES = num('max-minutes', 0)
const LOOK = flag('look')
const SHOT = flag('shot')
const MAX_TOKENS = num('max-tokens', 300)
const SYSTEM_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BUNDLED_CHROME = `${process.env.HOME ?? ''}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
const CHROME = flag('chrome') || (existsSync(SYSTEM_CHROME) ? SYSTEM_CHROME : BUNDLED_CHROME)

if (!DRY) {
  if (existsSync(ENV_FILE)) loadEnvFile(ENV_FILE)
  else console.log(`[jev] env file not found (${ENV_FILE}); using the shell environment`)
}
const MODEL = flag('model') || process.env.OPENROUTER_MODEL || ''
const BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
if (!DRY && (!process.env.OPENROUTER_API_KEY || !MODEL)) {
  console.error('[jev] OPENROUTER_API_KEY and OPENROUTER_MODEL (or --model) are needed; or run with --dry')
  process.exit(2)
}
const llm: LlmConfig = { baseUrl: BASE_URL, model: MODEL, apiKey: process.env.OPENROUTER_API_KEY ?? '', maxTokens: MAX_TOKENS, timeoutMs: 45_000 }

// ---------------------------------------------------------------------------
// Playwright (playwright-core: a devDependency; --pw or JEV_PW points at another install)
// ---------------------------------------------------------------------------

interface PwPage {
  goto(url: string, o?: { waitUntil?: string; timeout?: number }): Promise<unknown>
  evaluate<R>(fn: string | ((arg: never) => R), arg?: unknown): Promise<R>
  waitForFunction(fn: string, arg?: unknown, o?: { timeout?: number }): Promise<unknown>
  getByRole(role: string, o: { name: string | RegExp }): PwLocator
  locator(sel: string): PwLocator
  screenshot(o: { path: string }): Promise<unknown>
  on(ev: 'pageerror', cb: (e: Error) => void): void
}
interface PwLocator {
  first(): PwLocator
  click(o?: { timeout?: number }): Promise<void>
  fill(v: string, o?: { timeout?: number }): Promise<void>
  isVisible(): Promise<boolean>
}
interface PwBrowser {
  newContext(o: Record<string, unknown>): Promise<{ newPage(): Promise<PwPage> }>
  close(): Promise<void>
}
interface PwChromium {
  launch(o: Record<string, unknown>): Promise<PwBrowser>
}

async function loadPlaywright(): Promise<PwChromium> {
  const dirs = [flag('pw'), process.env.JEV_PW, ROOT].filter((d): d is string => !!d)
  for (const d of dirs) {
    try {
      const req = createRequire(join(resolve(d), 'package.json'))
      return (req('playwright-core') as { chromium: PwChromium }).chromium
    } catch {
      // next
    }
  }
  throw new Error('playwright-core not found: run npm install (it is a devDependency), or pass --pw <dir with node_modules/playwright-core>')
}

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const srv = createServer()
    srv.once('error', fail)
    srv.listen(0, '127.0.0.1', () => {
      const a = srv.address()
      const p = typeof a === 'object' && a ? a.port : 0
      srv.close(() => (p && p !== FORBIDDEN_PORT ? ok(p) : freePort().then(ok, fail)))
    })
  })
}

async function startVite(port: number): Promise<ChildProcess> {
  const env: NodeJS.ProcessEnv = { ...process.env, MOCK_API: '' }
  // The model key stays in this process: the dev server never needs it.
  delete env.OPENROUTER_API_KEY
  const child = spawn(join(ROOT, 'node_modules/.bin/vite'), ['--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stderr?.on('data', (d: Buffer) => {
    const t = d.toString()
    if (/error/i.test(t)) process.stderr.write(`[vite] ${t}`)
  })
  const until = Date.now() + 60_000
  while (Date.now() < until) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`)
      if (r.ok) return child
    } catch {
      // not up yet
    }
    if (child.exitCode !== null) throw new Error(`vite exited (${child.exitCode})`)
    await sleep(300)
  }
  child.kill()
  throw new Error('vite did not start in 60 s')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

interface Totals {
  moves: number
  llmCalls: number
  promptTokens: number
  completionTokens: number
  invalid: number
  fallbacks: number
  refused: number
}

const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUNS = join(HERE, 'runs')
mkdirSync(RUNS, { recursive: true })
const LOG = join(RUNS, `${STAMP}.jsonl`)
const log = (o: Record<string, unknown>) => appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...o }) + '\n')

const bridge = <K extends keyof JevBridge>(page: PwPage, k: K, ...args: Parameters<JevBridge[K]>): Promise<ReturnType<JevBridge[K]>> =>
  page.evaluate(`window.__jev.${k}(...${JSON.stringify(args)})`)

const money = (v: number) => {
  const a = Math.abs(v)
  return `${v < 0 ? '-' : ''}$${a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : Math.round(a)}`
}

function prompt(snap: JevSnapshot, history: string[], note?: string): string {
  const moves = snap.moves.map((m) => `${m.id}: ${m.label}${m.chip ? ' [öneri]' : ''}`).join('\n')
  return [
    `obs=${JSON.stringify(snap.obs)}`,
    history.length ? `son hamlelerin: ${history.slice(-6).join(' | ')}` : '',
    `moves:\n${moves}`,
    note ?? '',
    'JSON cevap: {"action":"<id>","why":"<tek kısa Türkçe cümle>"}',
  ]
    .filter(Boolean)
    .join('\n')
}

async function choose(snap: JevSnapshot, history: string[], totals: Totals): Promise<{ id: string; why: string; source: 'llm' | 'dry' | 'fallback'; raw?: string; error?: string }> {
  const ids = new Set(snap.moves.map((m) => m.id))
  if (DRY) {
    const chip = snap.moves.find((m) => m.chip)
    if (snap.obs.open) return { id: snap.fallback, why: 'Kararın varsayılanını seçiyorum.', source: 'dry' }
    return { id: chip?.id ?? snap.fallback, why: chip ? 'Oyunun önerisini izliyorum.' : 'Şimdilik bekliyorum.', source: 'dry' }
  }
  let note: string | undefined
  let lastErr = ''
  let raw = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await ask(llm, prompt(snap, history, note))
    totals.llmCalls++
    totals.promptTokens += r.promptTokens ?? 0
    totals.completionTokens += r.completionTokens ?? 0
    raw = r.raw
    if (r.answer && ids.has(r.answer.action)) return { id: r.answer.action, why: r.answer.why || '-', source: 'llm', raw }
    totals.invalid++
    lastErr = r.error ?? (r.answer ? `bilinmeyen id: ${r.answer.action}` : 'JSON okunamadı')
    note = `Önceki cevabın geçersizdi (${lastErr}). Yalnızca listedeki bir id ile, yalnızca JSON cevap ver.`
  }
  totals.fallbacks++
  return { id: snap.fallback, why: 'Cevap geçersizdi, varsayılan hamle.', source: 'fallback', raw, error: lastErr }
}

async function main(): Promise<void> {
  const port = flag('port') ? num('port', 0) : await freePort()
  if (port === FORBIDDEN_PORT) throw new Error(`port ${FORBIDDEN_PORT} is reserved`)
  console.log(`[jev] ${DRY ? 'dry run (chip)' : `model ${MODEL}`} · speed ${SPEED}× · every ${EVERY}d · log ${LOG}`)
  const vite = await startVite(port)
  const chromium = await loadPlaywright()
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: HEADLESS,
    // Headed: the real GPU (Metal through ANGLE), never SwiftShader.
    args: HEADLESS ? [] : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal', '--window-size=1440,900'],
  })
  const totals: Totals = { moves: 0, llmCalls: 0, promptTokens: 0, completionTokens: 0, invalid: 0, fallbacks: 0, refused: 0 }
  const t0 = Date.now()
  let result = 'stopped'
  let lastStatus: JevStatus | null = null
  const finish = async () => {
    const mins = (Date.now() - t0) / 60_000
    const summary = {
      result,
      gameDays: lastStatus ? Math.floor(lastStatus.day) : 0,
      stage: lastStatus?.stage ?? 0,
      valuation: lastStatus?.valuation ?? 0,
      realMinutes: Number(mins.toFixed(1)),
      moves: totals.moves,
      llmCalls: totals.llmCalls,
      promptTokens: totals.promptTokens,
      completionTokens: totals.completionTokens,
      invalidAnswers: totals.invalid,
      fallbacks: totals.fallbacks,
      refusedByEngine: totals.refused,
    }
    log({ kind: 'summary', ...summary })
    console.log(
      `\n[jev] ${summary.result} · ${summary.gameDays} oyun günü · aşama ${summary.stage} · değerleme ${money(summary.valuation)} · ${summary.realMinutes} dk · ${summary.moves} hamle · ${summary.llmCalls} LLM çağrısı · token ${summary.promptTokens}+${summary.completionTokens} · geçersiz ${summary.invalidAnswers} · varsayılana düşen ${summary.fallbacks} · motorun reddettiği ${summary.refusedByEngine}`,
    )
    console.log(`[jev] log: ${LOG}`)
    await browser.close().catch(() => undefined)
    vite.kill()
  }
  let stopping = false
  process.on('SIGINT', () => {
    if (stopping) process.exit(130)
    stopping = true
    result = 'stopped (Ctrl+C)'
  })

  try {
    const ctx = await browser.newContext(HEADLESS ? { viewport: { width: 1440, height: 900 } } : { viewport: null })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => log({ kind: 'pageerror', msg: String(e.message).slice(0, 300) }))
    const url = `http://127.0.0.1:${port}/${LOOK ? `?look=${encodeURIComponent(LOOK)}` : ''}`
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForFunction('!!window.__store', undefined, { timeout: 60_000 })

    // Start card: offline, the company name, "Garajı aç".
    const offline = page.getByRole('button', { name: /Çevrimdışı oyna/ }).first()
    for (let i = 0; i < 20; i++) {
      if (await offline.isVisible().catch(() => false)) {
        await offline.click()
        break
      }
      if (await page.getByRole('button', { name: /Garajı aç/ }).first().isVisible().catch(() => false)) break
      await sleep(300)
    }
    await page.locator('input[type="text"], input:not([type])').first().fill(NAME, { timeout: 15_000 })
    await page.getByRole('button', { name: /Garajı aç/ }).first().click({ timeout: 15_000 })
    await page.waitForFunction("![...document.querySelectorAll('button')].some((b) => /Garajı aç/.test(b.textContent || ''))", undefined, { timeout: 15_000 })
    await page.evaluate("import('/tools/jev/page.ts').then((m) => m.install())")
    await bridge(page, 'overlay', { line: 'Jev: masaya oturdu', why: DRY ? 'Kuru koşu: oyunun önerisini izler.' : `Model: ${MODEL}`, meta: `${NAME} · Gün 0` })
    await bridge(page, 'setSpeed', SPEED)
    log({ kind: 'start', model: DRY ? 'dry' : MODEL, speed: SPEED, every: EVERY, name: NAME, url })

    let lastDecideDay = -Infinity
    let handledKey: string | null = null
    const history: string[] = []
    let shotTaken = false
    while (!stopping) {
      if (MAX_MINUTES > 0 && Date.now() - t0 > MAX_MINUTES * 60_000) {
        result = `max-minutes (${MAX_MINUTES})`
        break
      }
      const did = await bridge(page, 'housekeep')
      if (did.length) log({ kind: 'housekeep', did })
      const st = await bridge(page, 'status')
      lastStatus = st
      if (st.gameOver) {
        result = st.gameOver.kind === 'unicorn' ? 'UNICORN' : st.gameOver.kind
        break
      }
      const due = (st.openKey !== null && st.openKey !== handledKey) || st.day - lastDecideDay >= EVERY
      if (!due) {
        if (st.speed === 0) await bridge(page, 'setSpeed', SPEED)
        await sleep(250)
        continue
      }
      await bridge(page, 'setSpeed', 0)
      const snap = await bridge(page, 'snapshot')
      const pick = await choose(snap, history, totals)
      let applied = await bridge(page, 'apply', pick.id)
      let id = pick.id
      if (!applied.ok) {
        // The state moved between snapshot and apply (it is paused, so rarely): the default instead.
        totals.refused++
        log({ kind: 'refused', id, error: applied.error })
        id = snap.fallback
        applied = await bridge(page, 'apply', id)
      }
      totals.moves++
      const label = applied.label ?? id
      const day = Math.floor(snap.obs.day)
      history.push(`g${day} ${id}`)
      handledKey = st.openKey
      lastDecideDay = st.day
      await bridge(page, 'overlay', { line: `Jev: ${label}`, why: pick.why, meta: `Gün ${day} · ${snap.obs.stage} · ${money(snap.obs.valuation)} · ${SPEED}×` })
      log({ kind: 'move', day, stage: snap.obs.stage, open: snap.obs.open, id, label, why: pick.why, source: pick.source, ok: applied.ok, raw: pick.raw, error: pick.error, obs: snap.obs, legal: snap.moves.length })
      console.log(`g${day} ${snap.obs.stage} · kasa ${money(snap.obs.cash)} · değer ${money(snap.obs.valuation)} · Jev: ${label} · ${pick.why}${pick.source === 'fallback' ? ' (varsayılan)' : ''}`)
      if (SHOT && !shotTaken && totals.moves >= 3) {
        shotTaken = true
        await page.screenshot({ path: SHOT })
      }
      await bridge(page, 'setSpeed', SPEED)
      await sleep(150)
    }
    if (SHOT && !shotTaken) await page.screenshot({ path: SHOT })
  } catch (e) {
    result = `error: ${(e as Error).message.split('\n')[0]}`
    log({ kind: 'error', msg: String((e as Error).stack ?? e).slice(0, 1000) })
  } finally {
    await finish()
  }
}

void main().then(() => process.exit(0))
