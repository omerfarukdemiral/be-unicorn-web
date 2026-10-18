// Speed colour constants (docs/GAMEPLAY_V2.md §13): paused red, running green at every speed.
import { describe, expect, it } from 'vitest'
import { pauseVeilShown, SPEED_COLOR, SPEED_FILL } from './time'
import timeSource from './time.tsx?raw'
import chipSource from './NextStepChip.tsx?raw'

describe('speed colours', () => {
  it('pause differs from running; 1×, 2× and 4× share one colour', () => {
    expect(SPEED_COLOR[0]).not.toBe(SPEED_COLOR[1])
    expect(SPEED_COLOR[1]).toBe(SPEED_COLOR[2])
    expect(SPEED_COLOR[2]).toBe(SPEED_COLOR[4])
    expect(SPEED_COLOR[0]).toBe('var(--color-speed-pause)')
    expect(SPEED_COLOR[1]).toBe('var(--color-speed-run)')
  })

  it('the pause red is its own token, never the danger red', () => {
    expect(SPEED_COLOR[0]).not.toContain('negative')
  })

  it('faster speeds fill denser', () => {
    expect(SPEED_FILL[1]).toBeLessThan(SPEED_FILL[2])
    expect(SPEED_FILL[2]).toBeLessThan(SPEED_FILL[4])
  })
})

describe('pause veil', () => {
  it('shows on a still world with nothing open', () => {
    expect(pauseVeilShown(0, false, { overlay: null })).toBe(true)
    expect(pauseVeilShown(1, false, { overlay: null })).toBe(false)
    expect(pauseVeilShown(0, true, { overlay: null })).toBe(false)
  })

  it('hides under a center screen and under a blocking modal', () => {
    expect(pauseVeilShown(0, false, { overlay: { kind: 'stats' } })).toBe(false)
    expect(pauseVeilShown(0, false, { overlay: { kind: 'lawbook' } })).toBe(false)
    expect(pauseVeilShown(0, false, { overlay: { kind: 'market' } })).toBe(false)
    expect(pauseVeilShown(0, false, { overlay: { kind: 'moveScene' } })).toBe(false)
  })
})

describe('round 8: the start call resumes the player speed', () => {
  it('Başlat and the paused chip never hard-code 1×', () => {
    expect(timeSource).not.toContain("speed: 1 })")
    expect(chipSource).not.toContain("speed: 1 })")
    expect(timeSource).toContain('resumeSpeed(useGameStore.getState())')
  })
})
