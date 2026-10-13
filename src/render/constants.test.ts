import { describe, expect, it } from 'vitest'
import { lowPowerFrom, renderBudget } from './constants'

describe('lowPowerFrom', () => {
  it('touch with 4 GB or less is low power', () => {
    expect(lowPowerFrom({ coarse: true, memory: 4, cores: 8 })).toBe(true)
    expect(lowPowerFrom({ coarse: true, memory: 8, cores: 4 })).toBe(true)
  })
  it('touch with 8 GB and 8 cores, or unknown memory on a many-core phone, keeps the full look', () => {
    expect(lowPowerFrom({ coarse: true, memory: 8, cores: 8 })).toBe(false)
    expect(lowPowerFrom({ coarse: true, cores: 6 })).toBe(false)
  })
  it('a fine pointer is low power only with few cores', () => {
    expect(lowPowerFrom({ coarse: false, memory: 2, cores: 8 })).toBe(false)
    expect(lowPowerFrom({ coarse: false, cores: 4 })).toBe(true)
    expect(lowPowerFrom({ coarse: false })).toBe(false)
  })
})

describe('renderBudget', () => {
  it('full power keeps shadows, MSAA, DPR 2 and all traffic at every stage', () => {
    for (const stage of [0, 3, 6]) expect(renderBudget(false, stage)).toEqual({ dpr: [1, 2], antialias: true, shadows: true, shadowMapSize: 2048, traffic: 'full' })
  })
  it('lowPower drops the shadow pass and MSAA, clamps DPR, thins the street and empties it from stage 4', () => {
    const early = renderBudget(true, 3)
    expect(early.shadows).toBe(false)
    expect(early.antialias).toBe(false)
    expect(early.dpr[1]).toBeLessThan(2)
    expect(early.traffic).toBe('thin')
    expect(renderBudget(true, 4).traffic).toBe('none')
  })
})
