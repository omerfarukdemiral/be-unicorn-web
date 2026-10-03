// Balance simulator (PLAN §8.3, §10): N seeds × 4 archetype bots + careless bots on the real engine and content.
// Usage: npm run sim -- [--seeds 8] [--days 4500] [--out sim/REPORT.md] [--quick 1]
// Delivery gate (docs/GAMEPLAY_V2.md §3 md.8): npm run sim -- --seeds 12 --quick 1 --days 3000
// Batches run in child processes, one per core (prefetch): the full 24-seed gate takes ~12 min, the quick one ~4.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { CONTENT } from '../src/content/index'
import { ARCHETYPES, POLICY_IDS, SECONDS_PER_DAY, balance } from '../src/engine/index'
import { CRISIS_WINDOW_DAYS, DAYS_10_MIN, DEATH_TRACE_DAYS, DAYS_5_MIN, LOAN_SURVIVE_DAYS, RIVAL_EARLY_DAYS, V2_BOT_KINDS, playBot, type BotConfig, type BotKind, type BotRun, type DecisionPolicy, type V2BotKind } from './bots'

function arg(name: string, fallback: number): number
function arg(name: string, fallback: string): string
function arg(name: string, fallback: number | string): number | string {
  const i = process.argv.indexOf(`--${name}`)
  const raw = i >= 0 ? process.argv[i + 1] : undefined
  if (raw === undefined) return fallback
  return typeof fallback === 'number' ? Math.max(1, Math.floor(Number(raw)) || fallback) : raw
}

const SEEDS = arg('seeds', 8)
const DAYS = arg('days', 4500)
const OUT = arg('out', 'sim/REPORT.md')
const STAGES = ['Garaj', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Unicorn']
const CARELESS_LIMIT_DAYS = (4 * 60) / SECONDS_PER_DAY // 4 min at 1x
const TARGET_MIN = [60, 90] as const

const toMin = (days: number): number => (days * SECONDS_PER_DAY) / 60
const fmtMin = (days: number | null): string => (days === null ? '—' : `${toMin(days).toFixed(1)} dk`)
const pct = (a: number, b: number): string => `${b ? Math.round((a / b) * 100) : 0}%`

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const a = [...xs].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2
}

/** One batch of bot runs: the same bot, policy, overrides and content over every seed. 'calm' = no crisis content. */
type RunSpec = { kind: BotKind; policy: DecisionPolicy; overrides: Partial<BotConfig>; content: 'full' | 'calm' }
const { crises: _crises, ...NO_CRISES } = CONTENT
const contentOf = (c: RunSpec['content']) => (c === 'calm' ? NO_CRISES : CONTENT)
const specKey = (sp: RunSpec) => JSON.stringify([sp.kind, sp.policy, sp.overrides, sp.content])
const playSeeds = (sp: RunSpec, from: number, to: number): BotRun[] =>
  Array.from({ length: to - from + 1 }, (_, i) => playBot(sp.kind, from + i, contentOf(sp.content), DAYS, undefined, sp.policy, sp.overrides))

// --worker '<json>': a child process of the gate plays one seed chunk and prints the runs (the parent reads stdout).
const WORKER = process.argv.indexOf('--worker')
if (WORKER >= 0) {
  const job = JSON.parse(process.argv[WORKER + 1]!) as { spec: RunSpec; from: number; to: number }
  // Let the pipe drain before exiting (a large write to a pipe is async).
  await new Promise<void>((resolve) => process.stdout.write(JSON.stringify(playSeeds(job.spec, job.from, job.to)), () => resolve()))
  process.exit(0)
}

/** Runs prefetched in parallel (prefetch); runMany falls back to playing in-process for anything not listed. */
const cache = new Map<string, BotRun[]>()
function runMany(kind: BotKind, policy: DecisionPolicy = 'best', overrides: Partial<BotConfig> = {}, content: RunSpec['content'] = 'full'): BotRun[] {
  const sp: RunSpec = { kind, policy, overrides, content }
  return cache.get(specKey(sp)) ?? playSeeds(sp, 1, SEEDS)
}

/**
 * Plays every listed batch in child processes (SEED_CHUNK seeds a job, one job a core). The engine is deterministic,
 * so the report is the same as a serial run; only the gate's wall time drops (GAMEPLAY V2 §3 md.8, ~15–20 min).
 */
const SEED_CHUNK = 3
async function prefetch(specs: RunSpec[]): Promise<void> {
  const jobs = specs.flatMap((spec) => Array.from({ length: Math.ceil(SEEDS / SEED_CHUNK) }, (_, i) => ({ spec, from: i * SEED_CHUNK + 1, to: Math.min(SEEDS, (i + 1) * SEED_CHUNK) })))
  const parts = new Map<string, BotRun[][]>()
  const one = (job: (typeof jobs)[number]) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, ...process.argv.slice(2), '--worker', JSON.stringify(job)], { stdio: ['ignore', 'pipe', 'inherit'] })
      let out = ''
      child.stdout.on('data', (d: Buffer) => (out += d.toString()))
      child.on('error', reject)
      child.on('close', (code) => {
        if (code !== 0) return reject(new Error(`sim worker ${specKey(job.spec)} ${job.from}-${job.to}: exit ${code}`))
        const key = specKey(job.spec)
        const list = parts.get(key) ?? []
        list[job.from] = JSON.parse(out) as BotRun[]
        parts.set(key, list)
        resolve()
      })
    })
  let next = 0
  const lane = async () => {
    while (next < jobs.length) await one(jobs[next++]!)
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs.length, cpus().length - 1)) }, lane))
  for (const [key, list] of parts) cache.set(key, list.flat())
}

function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null
  const a = [...xs].sort((x, y) => x - y)
  return a[Math.min(a.length - 1, Math.floor(q * a.length))]!
}
const sec = (days: number | null): string => (days === null ? '—' : `${(days * SECONDS_PER_DAY).toFixed(1)} sn`)
const failedRun = (r: BotRun) => r.end === 'bankrupt' || r.end === 'teamLost'
/** Decision-policy comparison runs on this archetype (docs/CORE_LOOP.md §10 Faz 3: kararlar sonucu değiştirmeli). */
const POLICY_ARCH: BotKind = 'bootstrap'

const t0 = Date.now()
/**
 * --quick 1: archetypes, careless and the GAMEPLAY V2 bots (§15) only, for tuning loops; the extra comparisons
 * (idle / random / policy / size / timing) reuse the archetype runs.
 */
const QUICK = arg('quick', 0) > 0
{
  const sp = (kind: BotKind, policy: DecisionPolicy = 'best', overrides: Partial<BotConfig> = {}, content: RunSpec['content'] = 'full'): RunSpec => ({ kind, policy, overrides, content })
  const always: RunSpec[] = [
    ...ARCHETYPES.map((a) => sp(a)),
    sp('careless'),
    ...V2_BOT_KINDS.map((k) => sp(k)),
    sp('burner', 'best', { minRunwayToHire: 0, ignoreRunway: true }),
    sp('bootstrap', 'best', { prepareCrisis: false }),
    sp('vcRocket', 'best', { prepareCrisis: false }),
    ...ARCHETYPES.map((a) => sp(a, 'best', {}, 'calm')),
  ]
  const full: RunSpec[] = QUICK
    ? []
    : [
        sp('idle'), sp('random'), sp('bootstrap', 'worst'), sp('bootstrap', 'first'), sp('vcRocket', 'worst'),
        sp('bootstrap', 'best', { roundSize: 'small' }), sp('bootstrap', 'best', { roundSize: 'large' }),
        sp('vcRocket', 'best', { roundSize: 'small' }), sp('vcRocket', 'best', { roundSize: 'target' }),
        sp('bootstrap', 'best', { roundEagerness: 0.6 }), sp('platform', 'best', { roundEagerness: 0.6 }),
      ]
  await prefetch([...always, ...full])
}
const byArch = new Map<BotKind, BotRun[]>()
for (const a of ARCHETYPES) byArch.set(a, runMany(a))
const extra = (kind: BotKind, policy: DecisionPolicy = 'best', overrides: Partial<BotConfig> = {}): BotRun[] => (QUICK ? byArch.get(kind === 'idle' || kind === 'random' || kind === 'careless' ? 'bootstrap' : kind)! : runMany(kind, policy, overrides))
const idle = extra('idle')
const random = extra('random')
const careless = runMany('careless')
/** GAMEPLAY V2 §15 bots always run (quick too): autopilot and difficulty probes. */
const v2Runs = new Map<V2BotKind, BotRun[]>(V2_BOT_KINDS.map((k) => [k, runMany(k)]))
/** "Careless burner": the burner plan without looking at runway (§4.2 kabul d). */
const carelessBurner = runMany('burner', 'best', { minRunwayToHire: 0, ignoreRunway: true })
const policyRuns: [DecisionPolicy, BotRun[]][] = [['best', byArch.get(POLICY_ARCH)!], ['worst', extra(POLICY_ARCH, 'worst')], ['first', extra(POLICY_ARCH, 'first')]]
/** GAMEPLAY V2 §15: the bad-decision policy is compared on bootstrap AND vcRocket (the bankruptcy gap, ≥ +25 points). */
const WORST_ARCHS: BotKind[] = ['bootstrap', 'vcRocket']
const worstRuns = WORST_ARCHS.map((a) => [a, a === POLICY_ARCH ? policyRuns[1]![1] : extra(a, 'worst')] as const)
/** Round size policy (docs/CORE_LOOP.md §4.3, S5-a): the same bots forced to Küçük / Hedef / Büyük. */
const SIZE_ARCHS: BotKind[] = ['bootstrap', 'vcRocket']
const sizeRuns = SIZE_ARCHS.map((a) => {
  const cfgSize = a === 'vcRocket' ? 'large' : 'target'
  const bySize = (['small', 'target', 'large'] as const).map((size) => [size, size === cfgSize ? byArch.get(a)! : extra(a, 'best', { roundSize: size })] as const)
  return [a, bySize] as const
})
/** Crisis preparation (§5.1): the same archetypes on the same seeds with preparation mode off (always run, quick too). */
const PREP_ARCHS: BotKind[] = ['bootstrap', 'vcRocket']
const unprepRuns = PREP_ARCHS.map((a) => [a, runMany(a, 'best', { prepareCrisis: false })] as const)
/**
 * §3 md.11 card budget: the good archetypes on the same seeds without crisis content (the calendar's dates pass
 * quietly), measured in this run so the baseline follows the balance. The calendar must not raise cards per run.
 */
const calmRuns = ARCHETYPES.flatMap((a) => runMany(a, 'best', {}, 'calm'))
/** Round timing: take the window as soon as it opens (eagerness 0.6) vs wait for the target (1.0). */
const EAGER_ARCHS: BotKind[] = ['bootstrap', 'platform']
const eagerRuns = EAGER_ARCHS.map((a) => [a, extra(a, 'best', { roundEagerness: 0.6 }), byArch.get(a)!] as const)

const md: string[] = []
const line = (s = '') => md.push(s)
line('# Be Unicorn — Denge Simülasyonu Raporu')
line()
line(`${SEEDS} seed × 4 arketip, en fazla ${DAYS} oyun günü (${toMin(DAYS).toFixed(0)} dk @1x). 1 gün = ${SECONDS_PER_DAY} sn, 5 dk = ${DAYS_5_MIN} gün, 10 dk = ${DAYS_10_MIN} gün.`)
line('Botlar yalnızca engine’in `createGame / applyAction / step` API’siyle oynar (oyunla aynı `step()`).')
line()

line('## Aşamaya varış (medyan, 1x gerçek dakika · oyun günü · ulaşan/toplam)')
line()
line(`| Arketip | ${STAGES.slice(1).join(' | ')} |`)
line(`|---|${STAGES.slice(1).map(() => '---').join('|')}|`)
const unicornMedians: number[] = []
for (const [kind, runs] of byArch) {
  const cells = STAGES.slice(1).map((_, k) => {
    const i = k + 1
    const days = runs.map((r) => r.stageDays[i]).filter((d): d is number => d !== null && d !== undefined)
    const m = median(days)
    if (i === 6 && m !== null && days.length * 2 > runs.length) unicornMedians.push(m)
    return m === null ? `— (0/${runs.length})` : `${fmtMin(m)} · g${Math.round(m)} (${days.length}/${runs.length})`
  })
  line(`| ${kind} | ${cells.join(' | ')} |`)
}
line()

line('## Sonuç, iflas, kavramlar')
line()
line('| Arketip | İflas oranı | Bitiş dağılımı | Kavram @5 dk (medyan/min) | Kavram @10 dk (medyan/min) | Kurucu hissesi (medyan) | Tepe ekip (medyan) |')
line('|---|---|---|---|---|---|---|')
const all: BotRun[] = []
for (const [kind, runs] of byArch) {
  all.push(...runs)
  const failed = runs.filter((r) => r.end === 'bankrupt' || r.end === 'teamLost').length
  const ends = Object.entries(runs.reduce<Record<string, number>>((acc, r) => ((acc[r.end] = (acc[r.end] ?? 0) + 1), acc), {}))
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')
  const c5 = runs.map((r) => r.conceptsBy5Min)
  const c10 = runs.map((r) => r.conceptsBy10Min)
  line(`| ${kind} | ${pct(failed, runs.length)} | ${ends} | ${median(c5)} / ${Math.min(...c5)} | ${median(c10)} / ${Math.min(...c10)} | %${Math.round(median(runs.map((r) => r.equity))! * 100)} | ${median(runs.map((r) => r.peakTeam))} |`)
}
const failedAll = all.filter((r) => r.end === 'bankrupt' || r.end === 'teamLost').length
line()
line(`Toplam iflas oranı: **${pct(failedAll, all.length)}** (${failedAll}/${all.length}).`)
line()

line('## Dikkatsiz oyuncu (§10: 4 dakikadan önce batmamalı)')
line()
line('| Bot | Batan | En erken batış | 4 dk’dan önce batan | Kavram @5 dk (medyan) |')
line('|---|---|---|---|---|')
for (const [name, runs] of [['idle (hiçbir şey yapmaz)', idle], ['random (rastgele aksiyon)', random]] as const) {
  const dead = runs.filter((r) => r.end === 'bankrupt' || r.end === 'teamLost')
  const first = dead.length ? Math.min(...dead.map((r) => r.endDay)) : null
  const early = dead.filter((r) => r.endDay < CARELESS_LIMIT_DAYS).length
  line(`| ${name} | ${dead.length}/${runs.length} | ${first === null ? '—' : `${fmtMin(first)} · g${first}`} | ${early} | ${median(runs.map((r) => r.conceptsBy5Min))} |`)
}
line()

line('## Tur penceresi ve aksiyonlar (docs/CORE_LOOP.md §10 Faz 2)')
line()
line('| Arketip | En sık aksiyon (koşu başına medyan) | Elle kullanıcı bul (medyan) | Turda en uzun boşluk (medyan / en kötü) | Tur tutarı / eski tablo (medyan) |')
line('|---|---|---|---|---|')
let findUsersTop = false
let worstGapSec = 0
for (const [kind, runs] of byArch) {
  const keys = new Set(runs.flatMap((r) => Object.keys(r.actionCounts)))
  const med = (k: string) => median(runs.map((r) => r.actionCounts[k] ?? 0)) ?? 0
  const ranked = [...keys].map((k) => [k, med(k)] as const).sort((a, b) => b[1] - a[1])
  const top = ranked[0]
  if (top?.[0] === 'founderAction:findUsers') findUsersTop = true
  const gaps = runs.map((r) => r.roundGapMaxDays * SECONDS_PER_DAY)
  worstGapSec = Math.max(worstGapSec, ...gaps)
  const ratios = runs.flatMap((r) => r.rounds.map((x) => (x.table > 0 ? x.amount / x.table : 1)))
  line(`| ${kind} | ${top ? `${top[0]} ${top[1]}` : '—'} | ${med('founderAction:findUsers')} | ${(median(gaps) ?? 0).toFixed(0)} sn / ${Math.max(...gaps).toFixed(0)} sn | ${(median(ratios) ?? 0).toFixed(2)}× |`)
}
line()
line(`- findUsers hiçbir arketipte en sık aksiyon değil: **${findUsersTop ? 'HAYIR' : 'EVET'}**`)
line(`- Tur penceresinde en uzun boşluk ≤ 20 sn: **${worstGapSec <= 20 ? 'EVET' : `HAYIR (${worstGapSec.toFixed(0)} sn)`}**`)
line()

line('## Para kısıtı ve ölü süre (docs/CORE_LOOP.md §10 Faz 3)')
line()
line('Ölü süre = iki anlamlı an arası (dünya vuruşu: maaş günü, sürüm, karar, kavram, tur haftası, kurucu hamlesinin sonucu, işe alım, ziyaretçi; ya da botun anlamlı hamlesi). 1x saniye.')
line()
line('| Arketip | İlk 5 dk aralık medyanı | İlk 5 dk p90 / en uzun | Tüm koşu medyanı / p90 | Ödenemeyen maaş günü (koşu başına medyan) | Cevapsız → varsayılan (medyan) |')
line('|---|---|---|---|---|---|')
let gap5Worst = 0
for (const [kind, runs] of byArch) {
  const g5 = runs.flatMap((r) => r.gaps5)
  const ga = runs.flatMap((r) => r.gapsAll)
  const med5 = median(g5) ?? 0
  gap5Worst = Math.max(gap5Worst, med5)
  line(`| ${kind} | ${sec(med5)} | ${sec(quantile(g5, 0.9))} / ${sec(g5.length ? Math.max(...g5) : null)} | ${sec(median(ga))} / ${sec(quantile(ga, 0.9))} | ${median(runs.map((r) => r.payrollMissed))} | ${median(runs.map((r) => r.decisionsDefaulted))} |`)
}
line()
line('| Bot | İflas oranı | En erken batış | Ödenemeyen maaş günü (medyan) |')
line('|---|---|---|---|')
const goodRuns = [...byArch.values()].flat()
for (const [name, runs] of [['iyi (4 arketip)', goodRuns], ['dikkatsiz (bootstrap planı, özensiz)', careless], ['kaos (random)', random], ['idle', idle]] as const) {
  const dead = runs.filter(failedRun)
  const first = dead.length ? Math.min(...dead.map((r) => r.endDay)) : null
  line(`| ${name} | ${pct(dead.length, runs.length)} (${dead.length}/${runs.length}) | ${first === null ? '—' : `${fmtMin(first)} · g${first}`} | ${median(runs.map((r) => r.payrollMissed))} |`)
}
line()
line(`Karar politikası (${POLICY_ARCH}, aynı seed’ler): kartlara en iyi / en kötü / hep ilk seçenekle cevap veren bot.`)
line()
line('| Politika | Unicorn medyanı | Unicorn’a ulaşan | İflas | Kurucu hissesi (medyan) |')
line('|---|---|---|---|---|')
const policyUni: number[] = []
for (const [policy, runs] of policyRuns) {
  const uni = runs.map((r) => r.stageDays[6]).filter((d): d is number => d !== null && d !== undefined)
  const m = median(uni)
  if (m !== null) policyUni.push(m)
  line(`| ${policy} | ${fmtMin(m)} | ${uni.length}/${runs.length} | ${pct(runs.filter(failedRun).length, runs.length)} | %${Math.round((median(runs.map((r) => r.equity)) ?? 0) * 100)} |`)
}
const policySpread = policyUni.length > 1 ? Math.max(...policyUni) / Math.min(...policyUni) - 1 : 0
line()

function goodRunsAll(): BotRun[] {
  return [...byArch.values()].flat()
}
const uniOf = (runs: BotRun[]) => median(runs.map((r) => r.stageDays[6]).filter((d): d is number => d !== null && d !== undefined))
const eqOf = (runs: BotRun[]) => median(runs.map((r) => r.equity)) ?? 0

line('## İnceleme düzeltmeleri: tur büyüklüğü, tur zamanlaması, teklif, para, sürüm')
line()
line('Tur büyüklüğü politikası (aynı seed’ler, bot yalnızca büyüklüğü zorla seçer). Kriter: hiçbir büyüklük hem süre hem hissede baskın değil, ya da süre farkı ≥ %15.')
line()
const RM = balance.ROUND_RUNWAY_MONTHS
line(`| Arketip | Küçük (${RM.small} ay) | Hedef (${RM.target} ay) | Büyük (${RM.large} ay) | Süre farkı | Baskın büyüklük |`)
line('|---|---|---|---|---|---|')
let sizeOk = true
for (const [a, bySize] of sizeRuns) {
  const cells = bySize.map(([, runs]) => ({ t: uniOf(runs), e: eqOf(runs), n: runs.filter((r) => r.stageDays[6] != null).length, f: runs.filter(failedRun).length, len: runs.length }))
  const ts = cells.map((c) => c.t ?? Infinity)
  const spread = Math.max(...ts) / Math.min(...ts) - 1
  // A size dominates when it is at least as fast AND keeps at least as much equity as every other size.
  const dom = cells.findIndex((c, i) => cells.every((o, j) => i === j || ((c.t ?? Infinity) <= (o.t ?? Infinity) && c.e >= o.e && c.f <= o.f)))
  const domName = dom >= 0 ? bySize[dom]![0] : '—'
  if (dom >= 0 && spread < 0.15) sizeOk = false
  line(`| ${a} | ${cells.map((c) => `${fmtMin(c.t)} · %${Math.round(c.e * 100)} · ${c.n}/${c.len}${c.f ? ` · iflas ${c.f}` : ''}`).join(' | ')} | %${Math.round((Number.isFinite(spread) ? spread : 0) * 100)} | ${domName} |`)
}
line()
line('Tur zamanlaması: pencere açılır açılmaz başla (0.6) ↔ hedefe kadar bekle (1.0).')
line()
line('| Arketip | Erken 0.6: Unicorn · hisse | Bekle 1.0: Unicorn · hisse | Erken baskın mı |')
line('|---|---|---|---|')
let eagerDominant = false
for (const [a, early, wait] of eagerRuns) {
  const te = uniOf(early) ?? Infinity
  const tw = uniOf(wait) ?? Infinity
  const dom = te < tw * 0.97 && eqOf(early) >= eqOf(wait)
  if (dom) eagerDominant = true
  line(`| ${a} | ${fmtMin(uniOf(early))} · %${Math.round(eqOf(early) * 100)} | ${fmtMin(uniOf(wait))} · %${Math.round(eqOf(wait) * 100)} | ${dom ? 'EVET' : 'hayır'} |`)
}
line()
const closes = goodRunsAll().flatMap((r) => r.roundCloses)
const atCeil = closes.filter((c) => c.metricsAtCeil).length
const bothCap = closes.filter((c) => c.metricsAtCeil && c.pitchAtCap).length
const byBurn = closes.filter((c) => c.by === 'burn').length
const byCeil = closes.filter((c) => c.by === 'ceiling').length
line(`Tur kapanışları (iyi botlar, ${closes.length} tur): metrik kısmı tavanda ${pct(atCeil, closes.length)} · metrik tavanda **ve** pitch tavanda ${pct(bothCap, closes.length)} (hedef ≤ %30) · tutarı burn × ay belirledi ${pct(byBurn, closes.length)} · tablo tavanı ${pct(byCeil, closes.length)} · tablo tabanı ${pct(closes.length - byBurn - byCeil, closes.length)}.`)
line()
line('Para kısıtı: maaş günündeki runway (ay, kâr = 99), aşamaya göre, iyi botlar.')
line()
line('| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı | Aşama min-runway p50 | p90 |')
line('|---|---|---|---|---|---|---|')
const paydays = goodRunsAll().flatMap((r) => r.paydayRunway)
let richShareMid = 0
for (let st = 0; st <= 5; st++) {
  const rs = paydays.filter((p) => p.stage === st).map((p) => p.runway)
  if (!rs.length) continue
  const rich = rs.filter((x) => x > 24).length
  if (st >= 1 && st <= 4) richShareMid = Math.max(richShareMid, rich / rs.length)
  // GAMEPLAY V2 §15: the stage × min-runway p50/p90 of the runs that paid a payday in the stage.
  const mins = goodRunsAll().filter((r) => r.techDebtByStage[st] !== null).map((r) => r.stageMinRunway[st] ?? 99)
  line(`| ${STAGES[st]} | ${rs.length} | ${(median(rs) ?? 0).toFixed(1)} | ${(quantile(rs, 0.9) ?? 0).toFixed(1)} | ${pct(rich, rs.length)} | ${(median(mins) ?? 0).toFixed(1)} | ${(quantile(mins, 0.9) ?? 0).toFixed(1)} |`)
}
line()
line('Aşama sonu (GAMEPLAY V2 §15): o aşamada maaş günü ödemiş koşular, iyi botlar; min-runway p50/p90 yukarıdaki Para kısıtı tablosunda (hedef medyan Seed 3–6 / A 4–8 / B 5–9 / C 6–10).')
line()
line('| Aşama | Koşu | Runway < 2 maaş günü (koşu başına medyan) | Penetrasyon (aşama sonu medyan) | Teknik borç (aşama sonu medyan) |')
line('|---|---|---|---|---|')
/** Stage min-runway medians of the good bots (index = stage; null = no run paid a payday there). */
const stageMinMed: (number | null)[] = []
for (let st = 0; st <= 5; st++) {
  const runs = goodRunsAll().filter((r) => r.techDebtByStage[st] !== null)
  const mins = runs.map((r) => r.stageMinRunway[st] ?? 99)
  stageMinMed[st] = median(mins)
  if (!runs.length) continue
  line(`| ${STAGES[st]} | ${runs.length} | ${median(runs.map((r) => r.nearDeathPaydays[st] ?? 0))} | ${pct(median(runs.map((r) => r.penetrationByStage[st] ?? 0)) ?? 0, 1)} | ${(median(runs.map((r) => r.techDebtByStage[st] ?? 0)) ?? 0).toFixed(1)} |`)
}
line()
line('Sürüm anı her aşamada: aşama başına sürüm + güncelleme (koşu başına medyan, iyi botlar).')
line()
line(`| Arketip | ${STAGES.slice(0, 6).join(' | ')} |`)
line(`|---|${STAGES.slice(0, 6).map(() => '---').join('|')}|`)
let releasesEveryStage = true
for (const [kind, runs] of byArch) {
  const cells = STAGES.slice(0, 6).map((_, st) => median(runs.map((r) => r.releasesByStage[st] ?? 0)) ?? 0)
  if (cells.slice(1).some((c) => c < 1)) releasesEveryStage = false
  line(`| ${kind} | ${cells.join(' | ')} |`)
}
line()
const topShares = goodRunsAll().map((r) => r.topActionShare)
line(`En sık aksiyonun tüm aksiyonlara payı (iyi botlar): medyan ${pct(median(topShares) ?? 0, 1)}, en kötü ${pct(Math.max(...topShares), 1)} (hedef ≤ %35).`)
line()

line('## GAMEPLAY V2 botları (docs/GAMEPLAY_V2.md §15)')
line()
line('coaster / idleAfterProfit: bootstrap, kâra geçince otopilot. greedyGood: riskli ama akıllı. burner / frugal: aynı plan, farklı yakış. Kârda = maaş gününde net ≥ 0.')
line()
line('| Bot | Unicorn’a ulaşan | Unicorn medyanı | İflas | Kârda maaş günü payı (medyan) | Tepe sonrası değerleme düşüşü (medyan) | Runway < 3 gün payı (medyan) |')
line('|---|---|---|---|---|---|---|')
const profitShare = (r: BotRun) => r.profitMonthsShare
const v2Rows: [string, BotRun[]][] = [...[...v2Runs].map(([k, runs]) => [k, runs] as [string, BotRun[]]), ['burner (dikkatsiz)', carelessBurner]]
for (const [name, runs] of v2Rows) {
  const uni = runs.filter((r) => r.stageDays[6] != null).length
  line(`| ${name} | ${uni}/${runs.length} | ${fmtMin(uniOf(runs))} | ${runs.filter(failedRun).length}/${runs.length} | ${pct(median(runs.map(profitShare)) ?? 0, 1)} | ${pct(median(runs.map((r) => r.valuationDropAfterPeak)) ?? 0, 1)} | ${pct(median(runs.map((r) => r.daysRunwayBelow3 / Math.max(1, r.endDay))) ?? 0, 1)} |`)
}
line()
const allRuns = [...goodRunsAll(), ...careless, ...[...v2Runs.values()].flat(), ...carelessBurner]
const saveKb = allRuns.map((r) => r.saveBytes / 1024)
const saveMed = median(saveKb) ?? 0
const saveMax = Math.max(0, ...saveKb)
line(`Kayıt boyutu (koşu sonu, ${allRuns.length} koşu): medyan ${saveMed.toFixed(1)} KB · maks ${saveMax.toFixed(1)} KB (bulut sınırı 160 KB).`)
line()

line('## §9 / §10 kriterleri')
line()
const preseedAll = [...byArch.values()].every((runs) => runs.every((r) => r.stageDays[1] !== null))
const c5ok = [...byArch.values()].every((runs) => (median(runs.map((r) => r.conceptsBy5Min)) ?? 0) >= 3)
const carelessOk = [...idle, ...random].every((r) => !(r.end === 'bankrupt' || r.end === 'teamLost') || r.endDay >= CARELESS_LIMIT_DAYS)
line(`- M1: 4 bot da Pre-seed’e ulaşıyor (tüm seed’ler): **${preseedAll ? 'EVET' : 'HAYIR'}**`)
line(`- İlk 5 dakikada ≥3 kavram (her arketipte medyan): **${c5ok ? 'EVET' : 'HAYIR'}**`)
line(`- Dikkatsiz oyuncu 4 dk’dan önce batmıyor: **${carelessOk ? 'EVET' : 'HAYIR'}**`)
if (unicornMedians.length) {
  const mins = unicornMedians.map(toMin)
  const lo = Math.min(...mins)
  const hi = Math.max(...mins)
  const ratio = hi / lo
  const dist = lo < TARGET_MIN[0] ? `hedefin ${(TARGET_MIN[0] - lo).toFixed(0)} dk altında (en hızlı)` : hi > TARGET_MIN[1] ? `hedefin ${(hi - TARGET_MIN[1]).toFixed(0)} dk üstünde (en yavaş)` : 'hedef aralıkta'
  line(`- Unicorn’a varış 60–90 dk: medyanlar ${mins.map((m) => m.toFixed(1)).join(' / ')} dk → **${dist}**; arketip farkı ${ratio.toFixed(2)}× (hedef ≤ 1.3×) — yalnızca çoğunluğu Unicorn’a ulaşan ${unicornMedians.length}/4 arketip sayıldı`)
} else {
  line(`- Unicorn’a varış 60–90 dk: hiçbir arketipte seed’lerin çoğu ${toMin(DAYS).toFixed(0)} dk içinde Unicorn’a ulaşmadı → **hedefin gerisinde**`)
}
const goodFail = goodRuns.filter(failedRun).length / goodRuns.length
line(`- İlk 5 dk’da iki anlamlı an arası medyan ≤ 10 sn (her arketip): **${gap5Worst * SECONDS_PER_DAY <= 10 ? 'EVET' : 'HAYIR'}** (en kötü arketip ${sec(gap5Worst)})`)
const carelessRuns = [...random, ...idle]
const carelessEarly = carelessRuns.filter((r) => failedRun(r) && r.endDay < CARELESS_LIMIT_DAYS).length
const carelessFail = careless.filter(failedRun).length / careless.length
line(`- İflas (ayrı ayrı; GAMEPLAY V2 §15 değerleri): iyi botlar ${pct(goodRuns.filter(failedRun).length, goodRuns.length)} (hedef ≤ %5): **${goodFail <= 0.05 ? 'EVET' : 'HAYIR'}** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) ${pct(careless.filter(failedRun).length, careless.length)} (hedef %40–60): **${carelessFail >= 0.4 && carelessFail <= 0.6 ? 'EVET' : 'HAYIR'}** · idle ${pct(idle.filter(failedRun).length, idle.length)} ve kaos (random) ${pct(random.filter(failedRun).length, random.length)}: sonunda batabilir, 4 dk’dan önce batan ${carelessEarly}: **${carelessEarly === 0 ? 'EVET' : 'HAYIR'}**`)
line(`- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): ${median(goodRuns.map((r) => r.payrollMissed))} (hedef 0–1): **${(median(goodRuns.map((r) => r.payrollMissed)) ?? 0) <= 1 ? 'EVET' : 'HAYIR'}**`)
line(`- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **${sizeOk ? 'EVET' : 'HAYIR'}** · erken tur (0.6) baskın değil: **${eagerDominant ? 'HAYIR' : 'EVET'}**`)
line(`- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **${closes.length && bothCap / closes.length <= 0.3 ? 'EVET' : 'HAYIR'}** (${pct(bothCap, closes.length)})`)
line(`- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): ${pct(richShareMid, 1)} (hedef ≤ %30): **${richShareMid <= 0.3 ? 'EVET' : 'HAYIR'}**`)
line(`- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **${releasesEveryStage ? 'EVET' : 'HAYIR'}**`)
const policyEq = policyRuns.map(([, runs]) => median(runs.map((r) => r.equity)) ?? 0)
const eqSpread = Math.max(...policyEq) - Math.min(...policyEq)
line(`- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %${Math.round(policySpread * 100)} (hedef ≥ %15): **${policySpread >= 0.15 ? 'EVET' : 'HAYIR'}** · kurucu hissesi farkı ${Math.round(eqSpread * 100)} puan`)
line()
line('## §15 kriterleri (koşu sayısı · tolerans)')
line()
/** "n/N (hedef %lo–%hi → a–b/N)": a rate criterion as run counts, so 12 seeds of noise stays visible. */
function band(n: number, total: number, lo: number, hi: number): [string, boolean] {
  const a = Math.ceil(lo * total - 1e-9)
  const b = Math.floor(hi * total + 1e-9)
  const range = lo === 0 ? `≤ %${Math.round(hi * 100)} → 0–${b}/${total}` : hi >= 1 ? `≥ %${Math.round(lo * 100)} → ${a}–${total}/${total}` : `%${Math.round(lo * 100)}–${Math.round(hi * 100)} → ${a}–${b}/${total}`
  return [`${n}/${total} (hedef ${range})`, n >= a && n <= b]
}
const yes = (ok: boolean) => (ok ? 'EVET' : 'HAYIR')
const crit = (label: string, [text, ok]: [string, boolean], note = '') => line(`- ${label}: ${text}: **${yes(ok)}**${note}`)
const v2 = (k: V2BotKind) => v2Runs.get(k)!
const uniCount = (runs: BotRun[]) => runs.filter((r) => r.stageDays[6] != null).length
crit('İyi bot iflas', band(goodRuns.filter(failedRun).length, goodRuns.length, 0, 0.05))
{
  // §15 / §16 Faz I iz kriteri: every good-bot death shows a defined bad decision in its last DEATH_TRACE_DAYS.
  const deaths = [...goodRuns, ...v2('greedyGood')].filter(failedRun)
  const traced = deaths.filter((r) => r.badDecisions.some((b) => b.day >= r.endDay - DEATH_TRACE_DAYS))
  const ex = deaths.slice(0, 3).map((r) => `${r.kind}#${r.seed} g${r.endDay}: ${r.badDecisions.filter((b) => b.day >= r.endDay - DEATH_TRACE_DAYS).map((b) => b.what).join(', ') || 'yok'}`)
  const label = `İz: iyi bot + greedyGood iflaslarında son ${DEATH_TRACE_DAYS} günde tanımlı kötü karar`
  // No death to trace: like the near-death line, a criterion that measured nothing is not a pass.
  if (deaths.length === 0) line(`- ${label}: n = 0, ölçülmedi: **HAYIR**`)
  else line(`- ${label} ${traced.length}/${deaths.length} (hedef %100) · ${ex.join(' · ')}: **${yes(traced.length === deaths.length)}**`)
}
crit('Careless iflas', band(careless.filter(failedRun).length, careless.length, 0.4, 0.6))
crit('greedyGood iflas', band(v2('greedyGood').filter(failedRun).length, SEEDS, 0.15, 0.3))
crit('coaster Unicorn (E1 nihai)', band(uniCount(v2('coaster')), SEEDS, 0, 0))
{
  // §15: the bad-decision policy must cost lives, not only minutes (bootstrap + vcRocket, same seeds).
  const gaps = worstRuns.map(([a, runs]) => {
    const best = byArch.get(a)!
    const gap = runs.filter(failedRun).length / runs.length - best.filter(failedRun).length / best.length
    return { a, gap, text: `${a} ${runs.filter(failedRun).length}/${runs.length} ↔ ${best.filter(failedRun).length}/${best.length}` }
  })
  const note = QUICK ? ' (quick: en kötü politika koşulmadı, ölçülmedi)' : ''
  line(`- Kötü karar politikası iflas farkı (en kötü ↔ en iyi kart cevabı): ${gaps.map((g) => `${g.text} (+${Math.round(g.gap * 100)} puan)`).join(' · ')} (hedef ≥ +25 puan)${note}: **${yes(!QUICK && gaps.every((g) => g.gap >= 0.25))}**`)
}
{
  // B1 (§4.1): the autopilot must not reach Unicorn AND its valuation must fall after the peak (growth stopped).
  const runs = v2('idleAfterProfit')
  const drop = median(runs.map((r) => r.valuationDropAfterPeak)) ?? 0
  const [text, ok] = band(uniCount(runs), SEEDS, 0, 0)
  line(`- idleAfterProfit Unicorn: ${text} · tepe sonrası düşüş medyanı ${pct(drop, 1)} (hedef ≥ %30): **${yes(ok && drop >= 0.3)}**`)
}
{
  // Good-bot Unicorn time (55–95 min tolerance) and how much longer the coaster takes (B1 info line: ≥ 25%).
  const good = uniOf(goodRuns)
  const gm = good === null ? null : toMin(good)
  line(`- İyi bot Unicorn medyanı: ${fmtMin(good)} (tolerans 55–95 dk): **${yes(gm !== null && gm >= 55 && gm <= 95)}**`)
  const coaster = v2('coaster')
  const cDays = coaster.map((r) => r.stageDays[6] ?? DAYS)
  const cMed = median(cDays)
  const longer = good !== null && cMed !== null ? cMed / good - 1 : null
  line(`- coaster Unicorn süresi iyi bottan ≥ %25 uzun (bilgi; ulaşmayan = ${toMin(DAYS).toFixed(0)} dk): ${fmtMin(cMed)} ↔ ${fmtMin(good)} (${longer === null ? '—' : `%${Math.round(longer * 100)}`}): **${yes(longer !== null && longer >= 0.25)}**`)
}
crit('Dikkatsiz burner iflas', band(carelessBurner.filter(failedRun).length, carelessBurner.length, 0.4, 1))
{
  // Non-arrivals count as DAYS (like the coaster line), so a frugal that never reaches Unicorn still compares.
  const uniOrDays = (runs: BotRun[]) => median(runs.map((r) => r.stageDays[6] ?? DAYS))
  const tb = uniOrDays(v2('burner'))
  const tf = uniOrDays(v2('frugal'))
  const faster = tb !== null && tf !== null ? 1 - tb / tf : null
  line(`- burner Unicorn’a frugal’dan ≥ %15 hızlı (ulaşmayan = ${toMin(DAYS).toFixed(0)} dk): ${fmtMin(tb)} ↔ ${fmtMin(tf)} (${faster === null ? '—' : `%${Math.round(faster * 100)}`}): **${yes(faster !== null && faster >= 0.15)}**`)
}
{
  const share = median(goodRuns.map(profitShare)) ?? 0
  line(`- Kârda geçirilen maaş günü payı, iyi botlar (medyan): ${pct(share, 1)} (hedef ≤ %35): **${yes(share <= 0.35)}** · B’den önce kâra geçen koşu ${goodRuns.filter((r) => r.profitBeforeB).length}/${goodRuns.length} (bilgi)`)
  const boot = median(byArch.get('bootstrap')!.map(profitShare)) ?? 0
  line(`- Kârda geçirilen maaş günü payı, bootstrap (medyan): ${pct(boot, 1)} (hedef ≤ %50): **${yes(boot <= 0.5)}**`)
}
{
  // GAMEPLAY V2 §4.2 / §15 cash-constraint bands (good bots).
  const bands: [string, number, number][] = [['Seed', 3, 6], ['Series A', 4, 8], ['Series B', 5, 9], ['Series C', 6, 10]]
  const cells = bands.map(([name, lo, hi], i) => {
    const m = stageMinMed[i + 2] ?? null
    return { text: `${name} ${m === null ? '—' : m.toFixed(1)} (${lo}–${hi})`, ok: m !== null && m >= lo && m <= hi }
  })
  line(`- Aşama min-runway medyanı: ${cells.map((c) => c.text).join(' · ')}: **${yes(cells.every((c) => c.ok))}** (${cells.filter((c) => c.ok).length}/4 bantta)`)
  const below3 = median(goodRuns.map((r) => r.daysRunwayBelow3 / Math.max(1, r.endDay))) ?? 0
  line(`- Oyun süresinin runway < 3 ay payı, iyi botlar (medyan): ${pct(below3, 1)} (hedef %15–25): **${yes(below3 >= 0.15 && below3 <= 0.25)}**`)
  const rich = goodRuns.flatMap((r) => r.paydayRunway)
  const richShare = rich.length ? rich.filter((p) => p.runway > 24).length / rich.length : 0
  line(`- Maaş günlerinde runway > 24 ay payı, iyi botlar (tüm aşamalar): ${pct(richShare, 1)} (hedef ≤ %30): **${yes(richShare <= 0.3)}**`)
  const reachedC = goodRuns.filter((r) => r.techDebtByStage[5] !== null)
  const debtC = median(reachedC.map((r) => r.techDebtByStage[5]!))
  const speedC = debtC === null ? null : Math.max(balance.TECH_DEBT_MIN_SPEED, 1 - balance.TECH_DEBT_PER_POINT * debtC)
  line(`- Teknik borç Series C sonu medyanı (iyi botlar, ${reachedC.length} koşu): ${debtC === null ? '—' : debtC.toFixed(1)} (hedef 20–40) · hız çarpanı ${speedC === null ? '—' : speedC.toFixed(2)} (hedef ≥ 0.7): **${yes(debtC !== null && debtC >= 20 && debtC <= 40 && speedC! >= 0.7)}**`)
  const refactors = median(goodRuns.map((r) => r.refactors)) ?? 0
  line(`- refactorSprint koşu başına (iyi botlar, medyan): ${refactors} (hedef 3–8): **${yes(refactors >= 3 && refactors <= 8)}**`)
  const penA = median(goodRuns.filter((r) => r.techDebtByStage[3] !== null).map((r) => r.penetrationByStage[3]!)) ?? 0
  const penB = median(goodRuns.filter((r) => r.techDebtByStage[4] !== null).map((r) => r.penetrationByStage[4]!)) ?? 0
  line(`- Penetrasyon aşama sonu A / B (iyi botlar, medyan; hedef 0.5–0.9): ${pct(penA, 1)} / ${pct(penB, 1)}: **${yes(penA >= 0.5 && penA <= 0.9 && penB >= 0.5 && penB <= 0.9)}**`)
  // GAMEPLAY V2 §8.1–8.2 market verbs (good bots, per run).
  const segs = median(goodRuns.map((r) => r.segmentsOpened)) ?? 0
  const buys = median(goodRuns.map((r) => r.rivalsAcquired)) ?? 0
  line(`- Unicorn öncesi segmentsOpened / rivalsAcquired (iyi botlar, medyan): ${segs} / ${buys} (hedef ≥ 2 / ≥ 1): **${yes(segs >= 2 && buys >= 1)}** · satın alan koşu ${goodRuns.filter((r) => r.rivalsAcquired > 0).length}/${goodRuns.length}`)
  const sat = median(goodRuns.map((r) => r.saturationSeen)) ?? 0
  line(`- Ufukta 'saturation' koşu başına (iyi botlar, medyan): ${sat} (hedef ≥ 1): **${yes(sat >= 1)}** · hiç görmeyen koşu ${goodRuns.filter((r) => r.saturationSeen === 0).length}/${goodRuns.length}`)
  if (unicornMedians.length) {
    const mins = unicornMedians.map(toMin)
    const spread = Math.max(...mins) / Math.min(...mins)
    const inBand = mins.every((m) => m >= 55 && m <= 95)
    line(`- Unicorn medyanı (arketip) 55–95 dk ve fark ≤ 1.3×: ${mins.map((m) => m.toFixed(1)).join(' / ')} dk · ${spread.toFixed(2)}×: **${yes(inBand && spread <= 1.3 && unicornMedians.length === 4)}**`)
  }
}
line(`- Kayıt boyutu medyan ${saveMed.toFixed(1)} KB (hedef < 70) · maks ${saveMax.toFixed(1)} KB (hedef < 120): **${yes(saveMed < 70 && saveMax < 120)}**`)
{
  // GAMEPLAY V2 §5.1 crisis calendar.
  const withCrises = [...goodRuns, ...careless, ...[...v2Runs.values()].flat(), ...unprepRuns.flatMap(([, runs]) => runs)]
  const gaps = withCrises.flatMap((r) => r.crises.slice(1).map((k, i) => k.day - r.crises[i]!.day))
  const gapOk = gaps.length > 0 && Math.min(...gaps) >= balance.CRISIS_GAP_MIN && Math.max(...gaps) <= balance.CRISIS_GAP_MAX
  line(`- Krizler arası boşluk (${gaps.length} aralık): ${gaps.length ? `${Math.min(...gaps)}–${Math.max(...gaps)}` : '—'} gün (hedef 150–300): **${yes(gapOk)}**`)
  // Series C crises over every good run that reached C (§5.1 as written, no length filter).
  const reachedC = goodRuns.filter((r) => r.stageDays[5] != null).map((r) => r.crises.filter((k) => k.stage === 5).length)
  line(`- C'de kriz, iyi botlar (C'ye ulaşan ${reachedC.length} koşu, medyan): ${median(reachedC) ?? '—'} (hedef ≥ 2): **${yes((median(reachedC) ?? 0) >= 2)}** · ≥ 2 krizli koşu ${reachedC.filter((n) => n >= 2).length}/${reachedC.length}`)
  const prepared = PREP_ARCHS.flatMap((a) => byArch.get(a)!.flatMap((r) => r.crises))
  const unprepared = unprepRuns.flatMap(([, runs]) => runs.flatMap((r) => r.crises))
  const pMed = median(prepared.map((k) => k.minRunway))
  const uMed = median(unprepared.map((k) => k.minRunway))
  line(`- Kriz hazırlığı (${PREP_ARCHS.join(' + ')}, aynı seed'ler): kriz sonrası ${CRISIS_WINDOW_DAYS} gün min runway medyanı hazırlanan ${pMed?.toFixed(1) ?? '—'} ↔ hazırlanmayan ${uMed?.toFixed(1) ?? '—'} ay (hedef ≥ +2): **${yes(pMed !== null && uMed !== null && pMed - uMed >= 2)}** · hazırlık modunda gelen kriz ${prepared.filter((k) => k.prepared).length}/${prepared.length}`)
  const noPrep = [...unprepared, ...careless.flatMap((r) => r.crises), ...v2('greedyGood').flatMap((r) => r.crises)]
  const near = noPrep.filter((k) => k.minRunway < 2).length
  line(`- Hazırlanmayanlarda kriz sonrası maaş günü runway < 2 (hazırlıksız A/B + careless + greedyGood, ${noPrep.length} kriz): ${pct(near, noPrep.length)} (hedef ≥ %40): **${yes(noPrep.length > 0 && near / noPrep.length >= 0.4)}**`)
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
  const cardsMean = mean(goodRuns.map((r) => r.cardsShown))
  const calmMean = mean(calmRuns.map((r) => r.cardsShown))
  const per1000 = (runs: BotRun[]) => (1000 * runs.reduce((a, r) => a + r.cardsShown, 0)) / Math.max(1, runs.reduce((a, r) => a + r.endDay, 0))
  line(`- Kart / koşu, iyi botlar (ortalama): ${cardsMean.toFixed(1)} ↔ kriz içeriği olmadan aynı seed'ler ${calmMean.toFixed(1)} (hedef artış ≤ 0, mutlak ≤ 45): **${yes(cardsMean <= calmMean && cardsMean <= 45)}** · 1000 günde ${per1000(goodRuns).toFixed(1)} ↔ ${per1000(calmRuns).toFixed(1)} · kriz / koşu medyanı ${median(goodRuns.map((r) => r.crisesFired))}`)
  // Unicorn with and without the calendar; runs that never arrive count as DAYS (censored, no survivor bias).
  const uniCensored = (runs: BotRun[]) => median(runs.map((r) => r.stageDays[6] ?? DAYS))
  const uc = uniCensored(goodRuns)
  const ucm = uc === null ? null : toMin(uc)
  line(`- İyi bot Unicorn medyanı, ulaşmayan = ${toMin(DAYS).toFixed(0)} dk (${goodRuns.filter((r) => r.stageDays[6] != null).length}/${goodRuns.length} ulaştı): ${fmtMin(uc)} (tolerans 55–95 dk): **${yes(ucm !== null && ucm >= 55 && ucm <= 95)}** · kriz içeriği olmadan ${fmtMin(uniCensored(calmRuns))} (${calmRuns.filter((r) => r.stageDays[6] != null).length}/${calmRuns.length})`)
}
{
  // GAMEPLAY V2 §8.2 named rivals: the lead paces the valuation, the share presses the channels.
  const reachedSeed = (runs: BotRun[]) => runs.filter((r) => r.stageDays[2] != null)
  const passed = (runs: BotRun[]) => runs.filter((r) => r.rivalPassed > 0).length
  const goodSeed = reachedSeed(goodRuns)
  const carelessSeed = reachedSeed(careless)
  crit("Rakip oyuncuyu geçen koşu, iyi botlar (Seed'e ulaşan)", band(passed(goodSeed), goodSeed.length, 0.1, 0.3), ` · geçili gün medyanı ${median(goodSeed.map((r) => r.rivalPassedDays)) ?? '—'}`)
  crit("Rakip oyuncuyu geçen koşu, careless (Seed'e ulaşan)", band(passed(carelessSeed), carelessSeed.length, 0.5, 1))
  const early = goodRuns.reduce((a, r) => a + r.rivalPassedSeedEarly, 0)
  line(`- İyi bot Seed'in ilk ${RIVAL_EARLY_DAYS} gününde rivalPassed: ${early} (hedef 0): **${yes(early === 0)}**`)
  const inB = goodRuns.filter((r) => r.techDebtByStage[4] !== null).map((r) => r.rivalShareByStage[4]!)
  const shareB = median(inB)
  line(`- Rakip Σpay Series B sonu medyanı (iyi botlar, ${inB.length} koşu): ${shareB === null ? '—' : shareB.toFixed(2)} (hedef 0.15–0.35): **${yes(shareB !== null && shareB >= 0.15 && shareB <= 0.35)}** · Seed / A / C ${[2, 3, 5].map((st) => (median(goodRuns.filter((r) => r.techDebtByStage[st] !== null).map((r) => r.rivalShareByStage[st]!)) ?? 0).toFixed(2)).join(' / ')}`)
}
{
  // GAMEPLAY V2 §8.3 board, §8.4 renewals, §8.2 the sale (Series B / C).
  const quarters = (runs: BotRun[]) => runs.reduce((a, r) => a + r.boardQuarters.hit + r.boardQuarters.missed, 0)
  const missed = (runs: BotRun[]) => runs.reduce((a, r) => a + r.boardQuarters.missed, 0)
  crit('Kurul çeyrek kaçırma B/C, iyi botlar (çeyrek)', band(missed(goodRuns), quarters(goodRuns), 0.3, 0.5))
  // The coaster stalls before Series B: its quarters are read from A on (all its board quarters).
  const all = v2('coaster').map((r) => r.boardQuartersAll)
  const coasterQ = all.reduce((a, q) => a + q.hit + q.missed, 0)
  const coasterReachedA = v2('coaster').filter((r) => r.stageDays[3] != null).length
  // No quarter closed (the coaster never reached Series A): the line measures nothing, so it is not a pass.
  if (coasterQ === 0) line(`- Kurul çeyrek kaçırma, coaster (A–C): n = 0, ölçülmedi (A'ya ulaşan coaster ${coasterReachedA}/${SEEDS}): **HAYIR**`)
  else crit('Kurul çeyrek kaçırma, coaster (A–C, çeyrek)', band(all.reduce((a, q) => a + q.missed, 0), coasterQ, 0.8, 1), ` · A'ya ulaşan ${coasterReachedA}/${SEEDS}`)
  // Per run over §15's population: every good bot that reached Series B. Only bootstrap / niche call on enterprises
  // (useSalesCalls), so the sellers' own rate is shown beside it, never in its place.
  const inBC = goodRuns.filter((r) => r.stageDays[4] != null)
  const offered = inBC.map((r) => r.renewals.offered)
  const total = offered.reduce((a, n) => a + n, 0)
  const perRun = total / Math.max(1, offered.length)
  const kept = inBC.reduce((a, r) => a + r.renewals.kept, 0)
  const sellers = inBC.filter((r) => r.kind === 'bootstrap' || r.kind === 'niche')
  const sellerRate = sellers.reduce((a, r) => a + r.renewals.offered, 0) / Math.max(1, sellers.length)
  line(`- Yenileme kararı B/C koşu başına (iyi botlar, B'ye ulaşan ${inBC.length} koşu, ortalama): ${perRun.toFixed(1)} (hedef 4–10) · yenilenen ${pct(kept, total)} (hedef ≥ %60): **${yes(inBC.length > 0 && perRun >= 4 && perRun <= 10 && total > 0 && kept / total >= 0.6)}** · koşu başına ${offered.length ? `${Math.min(...offered)}–${Math.max(...offered)}` : '—'} · satıcılar (bootstrap + niche, ${sellers.length} koşu) ${sellerRate.toFixed(1)}`)
  const acquired = (runs: BotRun[]) => runs.filter((r) => r.end === 'acquired').length
  crit("'acquired' bitişi, iyi botlar", band(acquired(goodRuns), goodRuns.length, 0, 0))
  // The offer only comes in Series C: with no careless run there the line measures nothing, so it is not a pass.
  const carelessC = careless.filter((r) => r.stageDays[5] != null).length
  if (carelessC === 0) line(`- 'acquired' bitişi, careless: C'ye ulaşan careless 0/${careless.length}, ölçülmedi: **HAYIR**`)
  else crit("'acquired' bitişi, careless", band(acquired(careless), careless.length, 0.1, 0.3), ` · C'ye ulaşan careless ${carelessC}/${careless.length}`)
}
{
  // GAMEPLAY V2 §6.2 loan and §6.3 failed rounds (good bots = the 4 archetypes).
  const took = goodRuns.filter((r) => r.loansTaken > 0)
  crit('İyi botlarda kredi alan koşu', band(took.length, goodRuns.length, 0, 0.3))
  const alive = took.filter((r) => r.loanSurvived12m === true).length
  crit(`Kredi alan iyi botların ${LOAN_SURVIVE_DAYS / 30} ay sonra hayatta olanı`, band(alive, took.length, 0.5, 1), took.length ? '' : ' (kredi alan yok)')
  const failedRounds = goodRuns.reduce((a, r) => a + r.roundsFailed, 0)
  const attempts = failedRounds + goodRuns.reduce((a, r) => a + r.roundsClosed, 0)
  crit('Düşen tur payı, iyi botlar (tur denemesi)', band(failedRounds, attempts, 0.1, 0.2), ` · down round ${goodRuns.reduce((a, r) => a + r.downRounds, 0)} · kredi çağrısı ${goodRuns.reduce((a, r) => a + r.loanCalled, 0)}`)
  const info = (name: string, runs: BotRun[]) =>
    `${name}: kredi ${runs.filter((r) => r.loansTaken > 0).length}/${runs.length} · çağrı ${runs.reduce((a, r) => a + r.loanCalled, 0)} · düşen tur ${runs.reduce((a, r) => a + r.roundsFailed, 0)} · down round ${runs.reduce((a, r) => a + r.downRounds, 0)}`
  line(`- Bilgi: ${info('careless', careless)} · ${info('greedyGood', v2('greedyGood'))} · iplik adımı / koşu (iyi, medyan) ${median(goodRuns.map((r) => r.threadSteps)) ?? 0}`)
}
{
  // GAMEPLAY V2 §6.1 payday desk (D1): near death is common, rarely fatal for a good policy; careless dies of it.
  const reachedSeed = (runs: BotRun[]) => runs.filter((r) => r.stageDays[2] != null)
  const nearIn = (r: BotRun, key: 'nearDeathPaydays' | 'nearDeathPaydays3') => [2, 3, 4].some((st) => (r[key][st] ?? 0) > 0)
  const goodSeed = reachedSeed(goodRuns)
  crit('Yakın ölüm iyi bot (maaş günü runway < 3, Seed/A/B)', band(goodSeed.filter((r) => nearIn(r, 'nearDeathPaydays3')).length, goodSeed.length, 0.4, 1))
  const carelessSeed = reachedSeed(careless)
  crit('Yakın ölüm careless (maaş günü runway < 2, Seed/A/B)', band(carelessSeed.filter((r) => nearIn(r, 'nearDeathPaydays')).length, carelessSeed.length, 0.5, 1))
  const near = goodRuns.filter((r) => r.survivedNearDeath3 !== null)
  // No good run came near death: the line measures nothing, so it is not a pass (n shown either way).
  const label = 'Yakın ölüm yaşayan iyi botların 180 gün sonra hayatta olanı (runway < 3)'
  if (near.length === 0) line(`- ${label}: n = 0, ölçülmedi: **HAYIR**`)
  else crit(label, band(near.filter((r) => r.survivedNearDeath3).length, near.length, 0.6, 1), ` · n = ${near.length}`)
  const shorts = (runs: BotRun[]) => runs.reduce((a, r) => a + r.paydaysShort, 0)
  const defers = (runs: BotRun[]) => runs.reduce((a, r) => a + r.paydayDeferrals, 0)
  line(`- Bilgi (maaş masası): iyi botlar masa ${shorts(goodRuns)} · erteleme ${defers(goodRuns)} · careless masa ${shorts(careless)} · erteleme ${defers(careless)} · greedyGood masa ${shorts(v2('greedyGood'))} · erteleme ${defers(v2('greedyGood'))}`)
}
{
  // GAMEPLAY V2 §7.1 weekly move budget (F1): the garage untouched, from Pre-seed on the budget is the one constraint.
  const preseed = median(goodRuns.map((r) => r.stageDays[1] ?? DAYS))
  const pm = preseed === null ? null : toMin(preseed)
  const c5 = median(goodRuns.map((r) => r.conceptsBy5Min)) ?? 0
  line(`- Pre-seed varış medyanı, iyi botlar: ${fmtMin(preseed)} (hedef ≤ 5 dk) · 5 dk'da kavram medyanı ${c5} (hedef ≥ 3): **${yes(pm !== null && pm <= 5 && c5 >= 3)}**`)
  const sales = goodRuns.map((r) => r.actionCounts['founderAction:salesCall'] ?? 0)
  // The worst run counts (no monthly cap in the bot: deals compete for the budget); the late verbs (T15/T17/T19) are
  // what the budget is meant to compete with, so a miss here stays an open item until they land.
  const salesMax = Math.max(0, ...sales)
  line(`- salesCall / koşu, iyi botlar (en çok): ${salesMax} (hedef ≤ 80): **${yes(salesMax <= 80)}** · medyan ${median(sales) ?? 0} · 80'i aşan ${sales.filter((n) => n > 80).length}/${sales.length}`)
  const top = median(goodRuns.map((r) => r.topActionShare)) ?? 0
  line(`- topActionShare, iyi botlar (medyan): ${pct(top, 1)} (hedef ≤ %30): **${yes(top <= 0.3)}**`)
  const shareAt = (st: number) => median(goodRuns.filter((r) => (r.movesUsedShare[st] ?? 0) > 0).map((r) => r.movesUsedShare[st]!))
  const inC = shareAt(5)
  line(`- Series C'de hamle kullanım payı, iyi botlar (medyan): ${inC === null ? '—' : pct(inC, 1)} (hedef ≥ %70): **${yes(inC !== null && inC >= 0.7)}** · Pre-seed → C ${[1, 2, 3, 4, 5].map((st) => { const v = shareAt(st); return v === null ? '—' : pct(v, 1) }).join(' / ')}`)
}
{
  // GAMEPLAY V2 §7.2 company policies (F2): survival keeps the near-dead alive; no single law dominates.
  const signed = new Set(goodRuns.flatMap((r) => r.policiesSigned))
  line(`- Baskın strateji (bilgi): iyi botların en az bir koşuda imzaladığı politika ${signed.size}/${POLICY_IDS.length} (hedef ≥ 8): **${yes(signed.size >= 8)}** · hiç imzalanmayan: ${POLICY_IDS.filter((id) => !signed.has(id)).join(', ') || '—'}`)
  const per = (runs: BotRun[]) => median(runs.map((r) => r.policiesAdopted)) ?? 0
  const count = (id: string) => goodRuns.filter((r) => r.policiesSigned.includes(id as BotRun['policiesSigned'][number])).length
  line(`- Politika / koşu (medyan): iyi ${per(goodRuns)} · greedyGood ${per(v2('greedyGood'))} · careless ${per(careless)} (hedef 0) · imzalayan koşu: ${POLICY_IDS.map((id) => `${id} ${count(id)}`).join(' · ')}`)
  // §7.2 meant no law to be mandatory: one every good run signs is a balance warning (T20).
  const always = POLICY_IDS.filter((id) => goodRuns.length > 0 && count(id) === goodRuns.length)
  line(`- Zorunlu politika yok (bilgi): her iyi koşunun imzaladığı ${always.join(', ') || '—'}: **${yes(always.length === 0)}**`)
}
{
  // GAMEPLAY V2 §9.2 threads and secret cards; §3 md.11 the card pool.
  const done = (runs: BotRun[]) => runs.filter((r) => r.threadsDone >= 3).length
  crit('İplik tamamlama threadsDone ≥ 3/5, iyi botlar', band(done(goodRuns), goodRuns.length, 0.6, 1))
  crit('İplik tamamlama threadsDone ≥ 3/5, careless', band(done(careless), careless.length, 0.2, 1))
  const pop = [...goodRuns, ...careless]
  const secrets = CONTENT.decisions.filter((d) => d.secret).map((d) => [d.id, pop.filter((r) => r.secretIds.includes(d.id)).length] as const)
  const secretsOk = secrets.every(([, n]) => n >= 2 && n <= 12)
  line(`- Her gizli kart 2–12 koşuda (iyi botlar + careless, ${pop.length} koşu): ${secrets.map(([id, n]) => `${id} ${n}`).join(' · ')}: **${yes(secretsOk)}**`)
  line(`- Kart havuzu CONTENT.decisions ≤ 65: ${CONTENT.decisions.length}: **${yes(CONTENT.decisions.length <= 65)}**`)
}
line()
line(`_Süre: ${((Date.now() - t0) / 1000).toFixed(1)} sn · \`npm run sim -- --seeds ${SEEDS} --days ${DAYS}\`_`)

const report = md.join('\n') + '\n'
writeFileSync(OUT, report)
console.log(report)
console.log(`→ ${OUT}`)
