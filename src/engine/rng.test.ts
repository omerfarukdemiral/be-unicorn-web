import { describe, expect, it } from 'vitest'
import { Rng, createRngState, hashSeed, rngNext } from './rng'

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(createRngState(42))
    const b = new Rng(createRngState(42))
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true)
  })

  it('pure rngNext matches the cursor', () => {
    const s = createRngState(hashSeed('be-unicorn'))
    const r = new Rng(s)
    expect(rngNext(s).value).toBe(r.next())
    expect(rngNext(s).rng).toEqual(r.snapshot())
  })

  it('int stays in range', () => {
    const r = new Rng(createRngState(7))
    for (let i = 0; i < 500; i++) {
      const v = r.int(3, 6)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(6)
    }
  })
})
