import { describe, expect, it } from 'vitest'
import { fromBubble } from './bubbleHit'

describe('fromBubble', () => {
  it('a target outside the DOM is not a bubble', () => {
    expect(fromBubble(undefined)).toBe(false)
    expect(fromBubble({ target: null })).toBe(false)
  })
})
