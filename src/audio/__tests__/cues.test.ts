import { describe, expect, it } from 'vitest'
import type { GameEvent, GameEventKind } from '../../engine/types'
import { cueForEvents } from '../index'

const ev = (kind: GameEventKind, id = 1): GameEvent => ({ id, day: 0, kind })

describe('sound cues', () => {
  it('stays quiet for silent kinds and empty batches', () => {
    expect(cueForEvents([])).toBeNull()
    expect(cueForEvents([ev('visitorLeft')])).toBeNull()
  })

  it('maps engine events to cues', () => {
    expect(cueForEvents([ev('hired')])).toBe('hired')
    expect(cueForEvents([ev('resigned')])).toBe('left')
    expect(cueForEvents([ev('itemPlaced')])).toBe('itemPlaced')
  })

  it('plays only the most important cue of a batch', () => {
    expect(cueForEvents([ev('visitorArrived', 1), ev('stageUp', 2), ev('hired', 3)])).toBe('stageUp')
    expect(cueForEvents([ev('founderActionDone', 1), ev('milestone', 2)])).toBe('milestone')
  })
})
