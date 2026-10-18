// N9: the phone goal chip is a short word over its number; the number always shows, the word fits one ~85px line.
import { describe, expect, it } from 'vitest'
import { UI_TEXT } from '../content'
import { NEXT_MOVES, NEXT_STEP_IDS, type NextStep } from '../engine/types'
import { stepShort } from './loopUi'

const s = { stats: { users: 1240 }, finance: { mrr: 1200, valuation: 280_000 } } as never

describe('stepShort', () => {
  it('every step has a short word of at most 14 letters', () => {
    for (const id of NEXT_STEP_IDS) {
      const text = UI_TEXT[`step.short.${id}`]
      expect(text, id).toBeDefined()
      expect(Array.from(text!).length, id).toBeLessThanOrEqual(14)
    }
  })

  it('every chip move has a short word of at most 14 letters too', () => {
    for (const m of NEXT_MOVES) {
      const text = UI_TEXT[`move.short.${m}`]
      expect(text, m).toBeDefined()
      expect(Array.from(text!).length, m).toBeLessThanOrEqual(14)
    }
  })

  it('the target number is its own line: users, revenue, valuation, launch %', () => {
    const step = (id: NextStep['id'], target?: number, progress?: number): NextStep => ({ id, index: 5, total: 6, ...(target !== undefined ? { target } : {}), ...(progress !== undefined ? { progress } : {}) })
    expect(stepShort(step('traction', 300_000), s)).toEqual({ label: 'Değerleme', value: '$280K/$300K' })
    expect(stepShort(step('users', 2000), s).value).toMatch(/\/2/)
    expect(stepShort(step('revenue', 5000), s).value).toContain('/$5')
    expect(stepShort(step('launch', undefined, 0.18), s).value).toContain('18')
    expect(stepShort(step('idea'), s)).toEqual({ label: 'Ürün fikri seç' })
  })
})
