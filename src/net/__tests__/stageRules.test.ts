import { describe, expect, it } from 'vitest'
import { STAGES } from '../../content/stages'
import { SECONDS_PER_DAY as ENGINE_SPD } from '../../engine/types'
import { MAX_SPEED, SECONDS_PER_DAY, STAGE_COUNT, STAGE_SLOTS, STAGE_TARGET, UNICORN_STAGE } from '../stageRules'

describe('stageRules mirrors the game', () => {
  it('matches content/stages.ts', () => {
    expect(STAGE_COUNT).toBe(STAGES.length)
    expect(STAGES[UNICORN_STAGE]!.key).toBe('unicorn')
    STAGES.forEach((s, i) => {
      expect(STAGE_TARGET[i]).toBe(s.targetValuation ?? 0)
      if (s.totalSlots > 0) expect(STAGE_SLOTS[i]).toBe(s.totalSlots)
    })
  })
  it('matches the engine clock', () => {
    expect(SECONDS_PER_DAY).toBe(ENGINE_SPD)
    const speeds: number[] = [0, 1, 2, 4] satisfies import('../../engine/types').GameSpeed[]
    expect(MAX_SPEED).toBe(Math.max(...speeds))
  })
})
