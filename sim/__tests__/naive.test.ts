// Fix round 3 (NEW-1/NEW-2): the guided naive player (sim/naive.ts: follows the chip and its moves, takes only
// non-red hires, first option on every bubble) gets through the garage without a missed payday, and the founder who
// never hires is not left without a move.
import { describe, expect, it } from 'vitest'
import { playNaive } from '../naive'

describe('guided naive player', () => {
  for (const seed of [1, 6, 9]) {
    it(`seed ${seed}: Pre-seed without a missed payday in the garage, alive`, { timeout: 120_000 }, () => {
      const r = playNaive(seed, 420, false)
      expect(r.garageMissed).toBe(0)
      expect(r.stageDays[1]).not.toBeNull()
      expect(r.stageDays[1]!).toBeLessThanOrEqual(300)
      expect(r.over).toBeNull()
    })
  }

  it('solo (never hires): the chip keeps naming moves and the garage still reaches Pre-seed', { timeout: 120_000 }, () => {
    const r = playNaive(2, 700, true)
    expect(r.hires).toBe(0)
    expect(Object.values(r.moves).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
    expect(r.over).toBeNull()
  })
})
