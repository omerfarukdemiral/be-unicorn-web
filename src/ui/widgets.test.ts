// Registry ⇄ store rules: the widget registry (src/ui) and the pin rules (src/store/metricPins.ts, no UI import)
// must agree on what is pinnable and what is merged (docs/LAYOUT.md §5.2–5.3).
import { describe, expect, it } from 'vitest'
import { UI_TEXT } from '../content'
import { HUD_WIDGETS } from '../engine/types'
import { MERGED_INTO, PINNABLE } from '../store/metricPins'
import { cashFlow } from './cashflow'
import { METRIC_CARDS, visiblePins, WIDGETS } from './widgets'

describe('widget registry', () => {
  it('covers every HudWidget, with a label that exists', () => {
    for (const id of HUD_WIDGETS) {
      expect(WIDGETS[id]?.id).toBe(id)
      expect(UI_TEXT[WIDGETS[id].labelKey], `${id} label`).toBeTruthy()
    }
  })

  it('pinnable / mergedInto match the store rules', () => {
    for (const id of HUD_WIDGETS) {
      expect(WIDGETS[id].pinnable, id).toBe(PINNABLE.has(id))
      expect(WIDGETS[id].mergedInto, id).toBe(MERGED_INTO[id])
    }
  })

  it('Metrikler lists no top-bar gauge, no merged gauge and every pinnable card', () => {
    for (const id of ['cash', 'users', 'morale', 'runway', 'churn', 'equity', 'candidateQuality'] as const) expect(METRIC_CARDS).not.toContain(id)
    for (const id of PINNABLE) expect(METRIC_CARDS).toContain(id)
    // Pinnable cards are never merged away, merged gauges never pinnable.
    for (const id of Object.keys(MERGED_INTO)) expect(PINNABLE.has(id as never)).toBe(false)
  })

  it('the top bar draws the newest pins that fit', () => {
    expect(visiblePins(['burnBreakdown', 'arpu'], 2)).toEqual(['burnBreakdown', 'arpu'])
    expect(visiblePins(['burnBreakdown', 'arpu'], 1)).toEqual(['arpu'])
    expect(visiblePins(['burnBreakdown', 'arpu'], 0)).toEqual([])
  })
})

describe('cashFlow: one money vocabulary', () => {
  it('Kasa net/gün, Yakıt and Kâr tahmini come from the same fields', () => {
    const f = cashFlow({
      stats: { cash: 20_000 } as never,
      finance: { mrr: 5_800, burn: 13_900, net: -8_100, ledger: { revenue: 0, salaries: 1_000, rent: 200, infra: 50, ads: 0, founder: 300 } } as never,
    })
    expect(f.netMonth).toBe(f.mrr - f.burn)
    expect(f.netDay).toBeCloseTo(f.netMonth / 30)
    expect(f.owed).toBe(1_550)
    expect(f.usable).toBe(f.bank - f.owed)
  })
})
