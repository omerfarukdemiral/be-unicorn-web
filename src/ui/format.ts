// Number formatting for the HUD (display only, no game formulas).

const SUFFIXES: [number, string][] = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
]

/** 1234 → "1.2K", 25000 → "25K", 3_400_000 → "3.4M". */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
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
  return n < 0 ? `-$${compact(-n)}` : `$${compact(n)}`
}

/** Signed money: "+$1.2K" / "-$800". */
export function signedMoney(n: number): string {
  if (n > 0) return `+${money(n)}`
  return money(n)
}

export function pct(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—'
  return `%${trimZero((fraction * 100).toFixed(digits))}`
}

export function num(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return Math.abs(n) >= 10_000 ? compact(n) : Math.round(n).toLocaleString('tr-TR')
}

export function fixed(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—'
  return trimZero(n.toFixed(digits))
}

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}
