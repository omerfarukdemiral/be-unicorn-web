// Chart geometry (docs/GAMEPLAY_V2.md §14.4): pure helpers shared by the hand-drawn SVG charts. No store, no engine,
// no DOM: numbers in, numbers out (scale.test.ts).

/** Linear map from `domain` to `range`; a flat domain maps everything to the middle of the range. */
export function linear(domain: readonly [number, number], range: readonly [number, number]): (v: number) => number {
  const [d0, d1] = domain
  const [r0, r1] = range
  if (d1 === d0) return () => (r0 + r1) / 2
  const k = (r1 - r0) / (d1 - d0)
  return (v) => r0 + (v - d0) * k
}

const NICE = [1, 2, 2.5, 5] as const

/**
 * At most `count` (≤ 4 by default) round ticks that cover [min, max]: step 1 / 2 / 2.5 / 5 × 10^k, first tick ≤ min,
 * last ≥ max. The chart uses the first and last tick as its domain, so the grid always lands on round numbers.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const n = Math.max(2, count)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min > max) [min, max] = [max, min]
  if (max === min) {
    // A flat series: pad around it without crossing zero (a flat $0 line sits on the floor).
    const v = min
    const pad = v === 0 ? 1 : Math.abs(v) * 0.5
    min = v >= 0 ? Math.max(0, v - pad) : v - pad
    max = v === 0 ? 1 : v > 0 ? v + pad : Math.min(0, v + pad)
  }
  let exp = Math.floor(Math.log10((max - min) / n)) - 1
  for (;;) {
    const base = 10 ** exp
    for (const m of NICE) {
      const step = m * base
      const lo = Math.floor(min / step + 1e-9) * step
      const hi = Math.ceil(max / step - 1e-9) * step
      const k = Math.round((hi - lo) / step) + 1
      if (k <= n) return Array.from({ length: k }, (_, i) => clean(lo + i * step))
    }
    exp++
  }
}

/** Float noise off a tick (0.1 + 0.2): 12 significant digits are plenty for an axis. */
function clean(v: number): number {
  const r = Number(v.toPrecision(12))
  return r === 0 ? 0 : r
}

/**
 * Point `i` of `n` radar axes at radius `r` around (cx, cy): axis 0 points up, the rest follow clockwise at equal
 * angles (the radar's fixed axis order).
 */
export function polar(cx: number, cy: number, r: number, i: number, n: number): { x: number; y: number } {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n
  return { x: clean(cx + r * Math.cos(a)), y: clean(cy + r * Math.sin(a)) }
}

/** Stacked bar parts: each value's [y0, y1] on top of the previous ones (negatives count as 0). Last y1 = total. */
export function stackParts(values: readonly number[]): { y0: number; y1: number }[] {
  let acc = 0
  return values.map((v) => {
    const y0 = acc
    acc += Math.max(0, v)
    return { y0, y1: acc }
  })
}

/**
 * Pie slices under `min` of the total fold into one trailing "other" slice (index -1 in `from`), so no wedge is a
 * hairline. Returns the kept slices' indices and values in order.
 */
export function foldSmall(values: readonly number[], min = 0.03): { from: number; value: number }[] {
  const total = values.reduce((a, v) => a + Math.max(0, v), 0)
  if (total <= 0) return []
  const out: { from: number; value: number }[] = []
  let other = 0
  values.forEach((v, i) => {
    const x = Math.max(0, v)
    if (x <= 0) return
    if (x / total < min) other += x
    else out.push({ from: i, value: x })
  })
  if (other > 0) out.push({ from: -1, value: other })
  return out
}

/** SVG path of a ring slice between angles a0 → a1 (radians, 0 = up, clockwise), outer radius r, inner radius ri. */
export function arcPath(cx: number, cy: number, r: number, ri: number, a0: number, a1: number): string {
  const full = a1 - a0 >= 2 * Math.PI - 1e-6
  if (full) a1 = a0 + 2 * Math.PI - 1e-4
  const p = (rad: number, a: number) => `${clean(cx + rad * Math.sin(a))} ${clean(cy - rad * Math.cos(a))}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(r, a0)}A${r} ${r} 0 ${large} 1 ${p(r, a1)}L${p(ri, a1)}A${ri} ${ri} 0 ${large} 0 ${p(ri, a0)}Z`
}
