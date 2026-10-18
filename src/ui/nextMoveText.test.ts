// Fix round 3: the chip speaks the move, one sentence with the number the tap spends.
import { describe, expect, it } from 'vitest'
import { applyAction, createGame } from '../engine'
import { t } from './i18n'
import { moveText, stepText } from './loopUi'

describe('move text', () => {
  const s = applyAction(createGame({ seed: 1 }), { type: 'startProject', category: 'web' }).state
  it('cash moves are plain sentences, the ad move carries its budget', () => {
    expect(moveText('salesCall', s)).toBe(t('move.salesCall'))
    expect(moveText('adsCut', s)).toBe(t('move.adsCut'))
    expect(moveText('ads', s)).toMatch(/\$500/)
    for (const m of ['salesCall', 'adsCut', 'price', 'focusUsers', 'ads'] as const) expect(moveText(m, s)).not.toMatch(/—/)
  })
  it('a step with a move shows the move, not the goal', () => {
    const st = { id: 'traction' as const, index: 5, total: 6, move: 'salesCall' as const }
    expect(stepText(st, s)).toBe(t('move.salesCall'))
  })
})
