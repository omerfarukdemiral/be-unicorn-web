import { describe, expect, it } from 'vitest'
import { computeLayout, lPath } from './layout'
import { createMockState } from './mockState'

describe('render layout', () => {
  it('mock states are JSON-serializable for every stage', () => {
    for (const st of [0, 1, 2, 3, 4, 5, 6] as const) {
      const s = createMockState(st)
      expect(JSON.parse(JSON.stringify(s))).toEqual(JSON.parse(JSON.stringify(s)))
      expect(s.office.slots.some((x) => x.id === 'founder')).toBe(true)
    }
  })

  it('ring bands nest outward and lock state follows rings[]', () => {
    const s = createMockState(3)
    const L = computeLayout(s.office.slots, s.office.rings, 3)
    for (let i = 1; i < L.bands.length; i++) {
      const a = L.bands[i - 1]!.box
      const b = L.bands[i]!.box
      expect(b.minX).toBeLessThanOrEqual(a.minX)
      expect(b.maxZ).toBeGreaterThanOrEqual(a.maxZ)
    }
    expect(L.bands[L.bands.length - 1]!.unlocked).toBe(false)
    expect(L.lounge.length).toBeGreaterThan(0)
  })

  it('handles an empty office', () => {
    const L = computeLayout([], [], 6)
    expect(L.bands).toHaveLength(0)
    expect(L.bounds.maxX).toBeGreaterThan(L.bounds.minX)
  })

  it('L paths end at the target', () => {
    const p = lPath([0, 0], [2, 3])
    expect(p[p.length - 1]).toEqual([2, 3])
  })
})
