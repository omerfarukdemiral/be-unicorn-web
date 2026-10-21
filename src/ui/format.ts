// Number formatting for the HUD (display only, no game formulas).
// One convention everywhere (PLAN §2 example "4.2K yaktın, 2.6 ay"): compact K/M/B with a '.' decimal,
// never a locale thousands separator, so '.' always means a decimal point. Same as content/format.ts.

const SUFFIXES: [number, string][] = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
]

/** 1234 → "1.2K", 25000 → "25K", 3_400_000 → "3.4M". */
/** The real minus sign (U+2212): a hyphen reads as a dash next to "$" (P5 sign audit). */
export const MINUS = '−'

export function compact(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? MINUS : ''
  const a = Math.abs(n)
  for (const [v, s] of SUFFIXES) {
    if (a >= v) {
      const x = a / v
      const digits = x >= 100 ? 0 : x >= 10 ? (Number.isInteger(Math.round(x * 10) / 10) ? 0 : 1) : 1
      return `${sign}${trimZero(x.toFixed(digits))}${s}`
    }
  }
  return `${sign}${Math.round(a)}`
}

function trimZero(s: string): string {
  return s.includes('.') ? s.replace(/\.0+$/, '') : s
}

export function money(n: number): string {
  if (!Number.isFinite(n)) return '—'
  // U+2060 (word joiner) keeps the sign on the number's line when a tooltip wraps.
  return n < 0 ? `${MINUS}\u2060$${compact(-n)}` : `$${compact(n)}`
}

/** Signed money: "+$1.2K" / "−$800". */
export function signedMoney(n: number): string {
  if (n > 0) return `+\u2060${money(n)}`
  return money(n)
}

/** Signed count: "+40" / "−12" (0 → "0"). */
export function signedNum(n: number): string {
  if (n > 0) return `+${compact(n)}`
  return compact(n)
}

/** Tailwind ink class of a delta's sign: green up, red down, neutral at 0 (P5: every delta wears its sign and colour). */
export function deltaInk(n: number): string {
  return n > 0 ? 'text-positive-ink' : n < 0 ? 'text-negative-ink' : 'text-ink-2'
}

export function pct(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—'
  return `%${trimZero((fraction * 100).toFixed(digits))}`
}

/** Counts: 950 → "950", 1234 → "1.2K", 10500 → "10.5K". */
export function num(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return compact(n)
}

export function fixed(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—'
  return trimZero(n.toFixed(digits))
}

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}
