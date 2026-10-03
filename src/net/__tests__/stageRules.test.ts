import { describe, expect, it } from 'vitest'
import { STAGES } from '../../content/stages'
import { SECONDS_PER_DAY as ENGINE_SPD } from '../../engine/types'
import { MAX_SPEED, MEASURED_FASTEST_DAYS, MIN_DAY_FOR_STAGE, SECONDS_PER_DAY, STAGE_COUNT, STAGE_SLOTS, STAGE_TARGET, UNICORN_STAGE, minDayTable } from '../stageRules'

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
  it('earliest believable days grow stage by stage', () => {
    expect(MIN_DAY_FOR_STAGE).toHaveLength(STAGE_COUNT)
    expect(MIN_DAY_FOR_STAGE[0]).toBe(0)
    for (let i = 1; i < STAGE_COUNT; i++) expect(MIN_DAY_FOR_STAGE[i]!).toBeGreaterThan(MIN_DAY_FOR_STAGE[i - 1]!)
  })
  it('MIN_DAY_FOR_STAGE is the ~65% rule of the measured fastest days (sim/minStageDays.ts, DECISIONS #20)', () => {
    expect(MEASURED_FASTEST_DAYS).toHaveLength(STAGE_COUNT)
    expect(MIN_DAY_FOR_STAGE).toEqual(minDayTable(MEASURED_FASTEST_DAYS))
    // Never above the measurement: an honest fastest run is never refused.
    MIN_DAY_FOR_STAGE.forEach((d, i) => expect(d).toBeLessThanOrEqual(MEASURED_FASTEST_DAYS[i]!))
  })
})
