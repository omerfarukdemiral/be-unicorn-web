// Chart geometry is pure: ticks, radar points, stacks and ring slices (docs/GAMEPLAY_V2.md §14.4).
import { describe, expect, it } from 'vitest'
import { arcPath, foldSmall, linear, niceTicks, polar, stackParts } from './scale'

describe('linear', () => {
  it('maps the domain ends to the range ends (inverted y too)', () => {
    const y = linear([0, 100], [200, 0])
    expect(y(0)).toBe(200)
    expect(y(100)).toBe(0)
    expect(y(25)).toBe(150)
  })
  it('a flat domain lands in the middle', () => {
    expect(linear([5, 5], [0, 10])(5)).toBe(5)
  })
})

describe('niceTicks', () => {
  const cases: [number, number][] = [
    [0, 1],
    [0, 7],
    [0, 13_900],
    [-8_100, 42_000],
    [1_234, 1_290],
    [0.02, 0.37],
    [0, 1_000_000_000],
    [-3, -1],
    [0, 0],
    [120, 120],
    [-50, -50],
  ]
  it('at most 4 round ticks that cover the range', () => {
    for (const [lo, hi] of cases) {
      const ticks = niceTicks(lo, hi)
      expect(ticks.length, `${lo}..${hi}`).toBeLessThanOrEqual(4)
      expect(ticks.length, `${lo}..${hi}`).toBeGreaterThanOrEqual(2)
      expect(ticks[0]!, `${lo}..${hi}`).toBeLessThanOrEqual(lo)
      expect(ticks.at(-1)!, `${lo}..${hi}`).toBeGreaterThanOrEqual(hi)
      // Evenly spaced.
      const step = ticks[1]! - ticks[0]!
      for (let i = 1; i < ticks.length; i++) expect(ticks[i]! - ticks[i - 1]!).toBeCloseTo(step, 9)
    }
  })
  it('steps are 1 / 2 / 2.5 / 5 × 10^k', () => {
    for (const [lo, hi] of cases) {
      const t = niceTicks(lo, hi)
      const step = t[1]! - t[0]!
      const m = step / 10 ** Math.floor(Math.log10(step))
      expect([1, 2, 2.5, 5].some((x) => Math.abs(x - m) < 1e-9), `${lo}..${hi} step ${step}`).toBe(true)
    }
  })
  it('a flat zero series sits on the floor', () => {
    expect(niceTicks(0, 0)[0]).toBe(0)
    expect(niceTicks(120, 120)[0]).toBeGreaterThanOrEqual(0)
  })
})

describe('polar', () => {
  it('6 axes: first straight up, equal angles, clockwise', () => {
    const pts = Array.from({ length: 6 }, (_, i) => polar(100, 100, 50, i, 6))
    expect(pts[0]).toEqual({ x: 100, y: 50 })
    expect(pts[3]!.x).toBeCloseTo(100, 9)
    expect(pts[3]!.y).toBeCloseTo(150, 9)
    // Clockwise on screen: the second axis is right of the centre.
    expect(pts[1]!.x).toBeGreaterThan(100)
    for (const p of pts) expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(50, 6)
  })
})

describe('stackParts', () => {
  it('stacks on top of each other; the last top is the total', () => {
    const vals = [1_000, 200, 0, 350, 50]
    const parts = stackParts(vals)
    expect(parts[0]).toEqual({ y0: 0, y1: 1_000 })
    for (let i = 1; i < parts.length; i++) expect(parts[i]!.y0).toBe(parts[i - 1]!.y1)
    expect(parts.at(-1)!.y1).toBe(vals.reduce((a, v) => a + v, 0))
  })
  it('negatives count as 0', () => {
    expect(stackParts([5, -3, 2]).at(-1)!.y1).toBe(7)
  })
})

describe('foldSmall / arcPath', () => {
  it('slices under 3% fold into one trailing other slice', () => {
    const out = foldSmall([90, 2, 5, 1, 0])
    expect(out).toEqual([
      { from: 0, value: 90 },
      { from: 2, value: 5 },
      { from: -1, value: 3 },
    ])
    expect(foldSmall([0, 0])).toEqual([])
  })
  it('a full ring stays a closed path', () => {
    expect(arcPath(50, 50, 40, 28, 0, 2 * Math.PI)).toMatch(/^M.*Z$/)
  })
})

describe('chart files stay pure', () => {
  it('no src/ui/charts file imports the store or the engine', () => {
    const files = import.meta.glob<string>('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(7)
    for (const [f, src] of Object.entries(files)) expect(src, f).not.toMatch(/from ['"][./]*\/(store|engine)(\/|['"])/)
  })
})
