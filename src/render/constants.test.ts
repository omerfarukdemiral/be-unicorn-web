import { describe, expect, it } from 'vitest'
import { lowPowerFrom } from './constants'

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
