import { describe, expect, it } from 'vitest'
import { runDevPlay } from '../devPlay'
import { fakeContent } from './fixtures'

describe('M0: Garage → Pre-seed in the console', () => {
  it('scripted run reaches Pre-seed with the real content', () => {
    const r = runDevPlay({ seed: 1 })
    expect(r.state.gameOver).toBeUndefined()
    expect(r.reachedStage).toBeGreaterThanOrEqual(1)
    expect(r.state.unlockedTools).toContain('capTableView')
    expect(r.state.events.some((e) => e.kind === 'stageUp')).toBe(true)
  })
  it('reaches Pre-seed without any cards/concepts, across seeds', () => {
    for (const seed of [1, 2, 3, 42]) {
      const r = runDevPlay({ seed, content: fakeContent() })
      expect(r.reachedStage, `seed ${seed}`).toBe(1)
    }
  })
})
