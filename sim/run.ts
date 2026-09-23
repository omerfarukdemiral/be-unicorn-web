// Balance simulator (PLAN §8.3, §10): N seeds × 4 archetype bots + careless bots on the real engine and content.
// Usage: npm run sim -- [--seeds 8] [--days 4500] [--out sim/REPORT.md]
import { writeFileSync } from 'node:fs'
import { CONTENT } from '../src/content/index'
import { ARCHETYPES, SECONDS_PER_DAY } from '../src/engine/index'
import { DAYS_10_MIN, DAYS_5_MIN, playBot, type BotConfig, type BotKind, type BotRun, type DecisionPolicy } from './bots'

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

function runMany(kind: BotKind, policy: DecisionPolicy = 'best', overrides: Partial<BotConfig> = {}): BotRun[] {
  const out: BotRun[] = []
  for (let seed = 1; seed <= SEEDS; seed++) out.push(playBot(kind, seed, CONTENT, DAYS, undefined, policy, overrides))
  return out
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
const byArch = new Map<BotKind, BotRun[]>()
for (const a of ARCHETYPES) byArch.set(a, runMany(a))
/** --quick 1: archetypes (+ careless) only, for tuning loops; the extra comparisons reuse the archetype runs. */
const QUICK = arg('quick', 0) > 0
const extra = (kind: BotKind, policy: DecisionPolicy = 'best', overrides: Partial<BotConfig> = {}): BotRun[] => (QUICK ? byArch.get(kind === 'idle' || kind === 'random' || kind === 'careless' ? 'bootstrap' : kind)! : runMany(kind, policy, overrides))
const idle = extra('idle')
const random = extra('random')
const careless = runMany('careless')
const policyRuns: [DecisionPolicy, BotRun[]][] = [['best', byArch.get(POLICY_ARCH)!], ['worst', extra(POLICY_ARCH, 'worst')], ['first', extra(POLICY_ARCH, 'first')]]
/** Round size policy (docs/CORE_LOOP.md §4.3, S5-a): the same bots forced to Küçük / Hedef / Büyük. */
const SIZE_ARCHS: BotKind[] = ['bootstrap', 'vcRocket']
const sizeRuns = SIZE_ARCHS.map((a) => {
  const cfgSize = a === 'vcRocket' ? 'large' : 'target'
  const bySize = (['small', 'target', 'large'] as const).map((size) => [size, size === cfgSize ? byArch.get(a)! : extra(a, 'best', { roundSize: size })] as const)
  return [a, bySize] as const
})
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
line('| Arketip | Küçük (12 ay) | Hedef (18 ay) | Büyük (24 ay) | Süre farkı | Baskın büyüklük |')
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
line('| Aşama | Maaş günü sayısı | Runway medyanı | p90 | > 24 ay payı |')
line('|---|---|---|---|---|')
const paydays = goodRunsAll().flatMap((r) => r.paydayRunway)
let richShareMid = 0
for (let st = 0; st <= 5; st++) {
  const rs = paydays.filter((p) => p.stage === st).map((p) => p.runway)
  if (!rs.length) continue
  const rich = rs.filter((x) => x > 24).length
  if (st >= 1 && st <= 4) richShareMid = Math.max(richShareMid, rich / rs.length)
  line(`| ${STAGES[st]} | ${rs.length} | ${(median(rs) ?? 0).toFixed(1)} | ${(quantile(rs, 0.9) ?? 0).toFixed(1)} | ${pct(rich, rs.length)} |`)
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
line(`- İflas (ayrı ayrı): iyi botlar ${pct(goodRuns.filter(failedRun).length, goodRuns.length)} (hedef ≤ %3): **${goodFail <= 0.03 ? 'EVET' : 'HAYIR'}** · dikkatsiz (bootstrap planı, runway’e bakmadan işe alır, kartlara rastgele cevap) ${pct(careless.filter(failedRun).length, careless.length)} (hedef %10–25): **${carelessFail >= 0.1 && carelessFail <= 0.25 ? 'EVET' : 'HAYIR'}** · idle ${pct(idle.filter(failedRun).length, idle.length)} ve kaos (random) ${pct(random.filter(failedRun).length, random.length)}: sonunda batabilir, 4 dk’dan önce batan ${carelessEarly}: **${carelessEarly === 0 ? 'EVET' : 'HAYIR'}**`)
line(`- İyi botlarda ödenemeyen maaş günü (koşu başına medyan): ${median(goodRuns.map((r) => r.payrollMissed))} (hedef 0–1): **${(median(goodRuns.map((r) => r.payrollMissed)) ?? 0) <= 1 ? 'EVET' : 'HAYIR'}**`)
line(`- Tur büyüklüğü: hiçbiri hem süre hem hissede baskın değil ya da süre farkı ≥ %15: **${sizeOk ? 'EVET' : 'HAYIR'}** · erken tur (0.6) baskın değil: **${eagerDominant ? 'HAYIR' : 'EVET'}**`)
line(`- Tur kapanışlarının ≤ %30’u metrik + pitch tavanında: **${closes.length && bothCap / closes.length <= 0.3 ? 'EVET' : 'HAYIR'}** (${pct(bothCap, closes.length)})`)
line(`- Pre-seed–Series B maaş günlerinde runway > 24 ay payı (en kötü aşama): ${pct(richShareMid, 1)} (hedef ≤ %30): **${richShareMid <= 0.3 ? 'EVET' : 'HAYIR'}**`)
line(`- Garaj sonrası her aşamada en az 1 sürüm/güncelleme (medyan, her arketip): **${releasesEveryStage ? 'EVET' : 'HAYIR'}**`)
const policyEq = policyRuns.map(([, runs]) => median(runs.map((r) => r.equity)) ?? 0)
const eqSpread = Math.max(...policyEq) - Math.min(...policyEq)
line(`- Karar politikaları arası Unicorn süresi farkı (en hızlı ↔ en yavaş): %${Math.round(policySpread * 100)} (hedef ≥ %15): **${policySpread >= 0.15 ? 'EVET' : 'HAYIR'}** · kurucu hissesi farkı ${Math.round(eqSpread * 100)} puan`)
line()
line(`_Süre: ${((Date.now() - t0) / 1000).toFixed(1)} sn · \`npm run sim -- --seeds ${SEEDS} --days ${DAYS}\`_`)

const report = md.join('\n') + '\n'
writeFileSync(OUT, report)
console.log(report)
console.log(`→ ${OUT}`)
