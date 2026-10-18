// Round 12 (test9: the lease hike took a thin Pre-seed under $0 before its card, and both options read "Kasa −$X
// olur"): every crisis, at any cash ≥ 0, leaves its card at least one option that keeps the cash at or above zero.
import { describe, expect, it } from 'vitest'
import { createGame } from '../../engine'
import type { EffectBundle, GameState } from '../../engine/types'
import { CRISES, CRISIS_CARDS } from '../crises'

function cashAfter(s: GameState, cash: number, fx: EffectBundle): number {
  let d = fx.cash ?? 0
  if (fx.cashPercent) d += Math.max(0, cash) * fx.cashPercent
  if (fx.cashBurnMonths) d += s.finance.burn * fx.cashBurnMonths
  if (fx.loan) d += Math.abs(s.finance.burn) // a loan pays in: never the red one
  return cash + d
}

describe('crisis cards keep a way out at low cash', () => {
  for (const def of CRISES) {
    it(`${def.id}: an option keeps the cash ≥ 0 after the hit`, () => {
      const card = CRISIS_CARDS.find((c) => c.id === def.cardId)
      expect(card, def.cardId).toBeDefined()
      for (const cash of [0, 300, 2_000, 8_000, 40_000]) {
        const base = createGame({ seed: 5 })
        const s: GameState = {
          ...base,
          stage: def.stage,
          stats: { ...base.stats, cash },
          finance: { ...base.finance, burn: 9_000, burnBreakdown: { ...base.finance.burnBreakdown, rent: 2_500 } },
        }
        for (const sev of [0.5, 1, 1.5]) {
          const hit = cashAfter(s, cash, def.effects(s, sev))
          const best = Math.max(...card!.options.map((o) => cashAfter(s, hit, o.effects)))
          expect(best, `${def.id} cash ${cash} severity ${sev}`).toBeGreaterThanOrEqual(0)
        }
      }
    })
  }
})
