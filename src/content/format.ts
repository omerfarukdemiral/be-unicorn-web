// Number formatting for player-facing text. Turkish wording, compact "$1.2M / 4.2K" style (PLAN §2 example).
// Pure functions, no Intl dependency so node (sim/tests) and browser print the same thing.

const MINUS = '−'

function trimDecimal(n: number, digits: number): string {
  const s = n.toFixed(digits)
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

/** 950 → "950", 4200 → "4.2K", 1_250_000 → "1.3M", 2_000_000_000 → "2B". */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '∞'
  const sign = value < 0 ? MINUS : ''
  const v = Math.abs(value)
  // Past a thousand trillion the number means nothing on a HUD (and toFixed turns exponential ≥ 1e21).
  if (v >= 1e15) return sign + '∞'
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]
  for (const [base, suffix] of units) {
    // Round first so 999_950 prints "1M", not "1000K".
    if (v >= base * 0.9995) {
      const scaled = v / base
      return sign + trimDecimal(scaled, scaled >= 100 ? 0 : 1) + suffix
    }
  }
  return sign + String(Math.round(v))
}

/** Dollars: 1200 → "$1.2K", −4200 → "−$4.2K". */
export function formatMoney(value: number): string {
  if (value < 0) return MINUS + '$' + formatCompact(-value)
  return '$' + formatCompact(value)
}

/** Signed dollars for deltas: "+$1.2K" / "−$300". */
export function formatMoneyDelta(value: number): string {
  return (value >= 0 ? '+' : '') + formatMoney(value)
}

/** Plain counts: 4200 → "4.2K". */
export function formatNumber(value: number): string {
  return formatCompact(value)
}

/** Fraction → Turkish percent: 0.06 → "%6", 0.125 → "%12.5". */
export function formatPercent(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return '%∞'
  const pct = fraction * 100
  const abs = Math.abs(pct)
  const body = trimDecimal(abs, abs >= 10 ? 0 : digits)
  return (pct < 0 ? MINUS : '') + '%' + body
}

/** Signed percent for growth: 0.12 → "+%12". */
export function formatPercentDelta(fraction: number): string {
  return (fraction >= 0 ? '+' : '') + formatPercent(fraction)
}

/** Runway months: null → "sonsuz", 2.63 → "2.6 ay". */
export function formatMonths(months: number | null): string {
  if (months === null || !Number.isFinite(months)) return 'sonsuz'
  if (months >= 24) return `${Math.round(months)} ay`
  return `${trimDecimal(months, 1)} ay`
}

export function formatDays(days: number): string {
  return `${Math.max(0, Math.round(days))} gün`
}

/** Multiplier / ratio: 3.24 → "3.2×" (same sign as the HUD). */
export function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${trimDecimal(value, 1)}×`
}

/** Fills "{name} ekibe katıldı." style templates. Unknown keys stay visible as {key}. */
export function fillTemplate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m, key: string) => {
    const v = params[key]
    return v === undefined ? m : String(v)
  })
}

/** Word count used by text-rule tests (≤ 12 for bubbles, ≤ 50 for cards). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// Turkish case endings after a name (A1 chips: "Tılsım'a +40 kullanıcı", "Series A'da reklam pahalı"). The ending follows
// the last vowel heard: a single capital letter reads as its name ("A" = a, "B" = be), other words as written.
const LETTER_NAME: Readonly<Record<string, string>> = {
  A: 'a', B: 'be', C: 'ce', Ç: 'çe', D: 'de', E: 'e', F: 'fe', G: 'ge', Ğ: 'yumuşak ge', H: 'he', I: 'ı', İ: 'i', J: 'je', K: 'ke', L: 'le',
  M: 'me', N: 'ne', O: 'o', Ö: 'ö', P: 'pe', Q: 'ku', R: 're', S: 'se', Ş: 'şe', T: 'te', U: 'u', Ü: 'ü', V: 've', W: 've', X: 'iks', Y: 'ye', Z: 'ze',
}
// A name ending in a number reads its last spoken word: "Pano 2" = iki, "Kasa 10" = on, "Ajans 300" = yüz.
const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']
function spokenNumber(digits: string): string {
  const n = digits.replace(/^0+/, '')
  if (!n) return 'sıfır'
  const r = n.split('').reverse()
  if (r[0] !== '0') return ONES[+r[0]!]!
  if (r[1] && r[1] !== '0') return TENS[+r[1]]!
  if (r[2] && r[2] !== '0') return 'yüz'
  return n.length <= 6 ? 'bin' : n.length <= 9 ? 'milyon' : 'milyar'
}
const BACK = 'aıou'
const VOWELS = 'aıoueiöü'
const VOICELESS = 'fstkçşhp'

/** "Tılsım" dat → "Tılsım'a", "Pano" dat → "Pano'ya", "Seed" loc → "Seed'de", "Series A" loc → "Series A'da", "Kasa" loc → "Kasa'da". */
export function withCase(name: string, kind: 'dat' | 'loc'): string {
  const last0 = name.trim().split(/\s+/).pop() ?? ''
  const digits = /\d+$/.exec(last0)?.[0]
  const word = digits ? spokenNumber(digits) : last0
  const spoken = (LETTER_NAME[word] ?? word.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase()).replace(/[^a-zçğıöşü]/g, '')
  let vowel = 'e'
  for (let i = spoken.length - 1; i >= 0; i--) {
    if (VOWELS.includes(spoken[i]!)) {
      vowel = spoken[i]!
      break
    }
  }
  const v = BACK.includes(vowel) ? 'a' : 'e'
  const last = spoken[spoken.length - 1] ?? ''
  if (kind === 'dat') return `${name}'${VOWELS.includes(last) ? 'y' : ''}${v}`
  return `${name}'${VOICELESS.includes(last) ? 't' : 'd'}${v}`
}
