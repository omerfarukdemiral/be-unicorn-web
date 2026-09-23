// Balance simulator (PLAN §8.3, §10): N seeds × 4 archetype bots + careless bots on the real engine and content.
// Usage: npm run sim -- [--seeds 8] [--days 4500] [--out sim/REPORT.md]
import { writeFileSync } from 'node:fs'
import { CONTENT } from '../src/content/index'
import { ARCHETYPES, SECONDS_PER_DAY } from '../src/engine/index'
import { DAYS_10_MIN, DAYS_5_MIN, playBot, type BotKind, type BotRun } from './bots'

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

function runMany(kind: BotKind): BotRun[] {
  const out: BotRun[] = []
  for (let seed = 1; seed <= SEEDS; seed++) out.push(playBot(kind, seed, CONTENT, DAYS))
  return out
}

const t0 = Date.now()
const byArch = new Map<BotKind, BotRun[]>()
for (const a of ARCHETYPES) byArch.set(a, runMany(a))
const idle = runMany('idle')
const random = runMany('random')

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
line()
line(`_Süre: ${((Date.now() - t0) / 1000).toFixed(1)} sn · \`npm run sim -- --seeds ${SEEDS} --days ${DAYS}\`_`)

const report = md.join('\n') + '\n'
writeFileSync(OUT, report)
console.log(report)
console.log(`→ ${OUT}`)
