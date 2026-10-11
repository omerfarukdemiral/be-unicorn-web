import { describe, expect, it } from 'vitest'
import { freeOffset } from './yieldToBubbles'

const bounds = { left: 0, top: 0, right: 800, bottom: 600 }
const banner = { left: 300, top: 280, right: 500, bottom: 320 }

describe('freeOffset', () => {
  it('stays put when nothing covers it', () => {
    expect(freeOffset(banner, [], bounds)).toBe(0)
  })

  it('steps to the nearest free height around a bubble', () => {
    expect(freeOffset(banner, [{ left: 320, top: 270, right: 480, bottom: 310 }], bounds)).toBe(44)
  })

  it('keeps its current height while that one is still free (no hopping)', () => {
    expect(freeOffset(banner, [{ left: 320, top: 270, right: 480, bottom: 310 }], bounds, 88)).toBe(88)
  })

  it('gives up (null: fade out) when every height is covered', () => {
    expect(freeOffset(banner, [{ left: 0, top: 0, right: 800, bottom: 600 }], bounds)).toBeNull()
  })
})
