// RightPanel head number (docs/GAMEPLAY_V2.md §10.3) and the CostPreview chip (§4.4), rendered to a string
// (node environment, no DOM: react-dom/server).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from '../engine'
import { CONCEPT_IDS } from '../engine/types'
import type { Panel, PanelKind } from '../store/types'
import { panelHeadline } from './panelHeadline'
import { CostPreview } from './primitives'

/** One panel of every kind: adding a Panel kind without a headline case fails to compile here. */
const PANELS = {
  shop: { kind: 'shop' },
  team: { kind: 'team' },
  projects: { kind: 'projects' },
  growth: { kind: 'growth' },
  metrics: { kind: 'metrics' },
  journal: { kind: 'journal' },
  detail: { kind: 'detail', selection: { kind: 'founder' } },
  decision: { kind: 'decision', cardId: 'any-card' as never },
  settings: { kind: 'settings' },
  roadmap: { kind: 'roadmap' },
  leaderboard: { kind: 'leaderboard' },
} satisfies { [K in PanelKind]: Extract<Panel, { kind: K }> }

function game(): GameState {
  return createGame({ seed: 7 })
}

describe('panelHeadline', () => {
  it('returns a finite primary number for all 11 panel kinds', () => {
    const s = game()
    expect(Object.keys(PANELS)).toHaveLength(11)
    for (const p of Object.values(PANELS)) {
      const h = panelHeadline(s, p)
      expect(h, p.kind).not.toBeNull()
      expect(Number.isFinite(h!.value), p.kind).toBe(true)
    }
  })

  it('only picks engine numbers', () => {
    const s = game()
    s.stats.cash = 12_345
    s.finance.mrr = 900
    s.finance.valuation = 2_000_000
    s.finance.burnBreakdown.salaries = 4200
    expect(panelHeadline(s, PANELS.shop)).toMatchObject({ value: 12_345, unit: 'money', danger: false })
    expect(panelHeadline(s, PANELS.growth)).toMatchObject({ value: 900, unit: 'money' })
    expect(panelHeadline(s, PANELS.leaderboard)).toMatchObject({ value: 2_000_000 })
    expect(panelHeadline(s, PANELS.team)).toMatchObject({ value: s.employees.length, unit: 'people', sub: { value: -4200, unit: 'perMonth' } })
    expect(panelHeadline(s, PANELS.journal)).toMatchObject({ value: s.concepts.learned.length, unit: 'count', of: CONCEPT_IDS.length })
    expect(panelHeadline(s, PANELS.detail)).toMatchObject({ value: s.founder.energy, unit: 'energy' })
    expect(panelHeadline(s, PANELS.projects)).toMatchObject({ value: s.derived.avgMaturity, unit: 'pct' })
    expect(panelHeadline(s, PANELS.roadmap)).toMatchObject({ value: s.derived.stageProgress, unit: 'pct' })
  })

  it('negative Kasa is the only red headline', () => {
    const s = game()
    s.stats.cash = -10
    expect(panelHeadline(s, PANELS.shop)?.danger).toBe(true)
    expect(panelHeadline(s, PANELS.team)?.danger).toBeFalsy()
  })

  it('a detail with nothing to count shows no number', () => {
    const s = game()
    expect(panelHeadline(s, { kind: 'detail', selection: { kind: 'employee', id: 'nobody' as never } })).toBeNull()
  })
})

describe('CostPreview', () => {
  it('draws cost + runway a → b from a previewSpend result', () => {
    const html = renderToStaticMarkup(
      createElement(CostPreview, { cost: '−$4.2K/ay', preview: { runwayNow: 9, runwayAfter: 7.04, deathDay: 400, paydayShort: false } }),
    )
    expect(html).toMatchInlineSnapshot(`"<span class="tabular inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[11px] font-semibold border-border text-ink-2"><span class="text-ink">−$4.2K/ay</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 3.5h10M7 20.5h10"></path><path d="M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5"></path></svg><span>9</span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"></path></svg><span>7 ay</span></span>"`)
    expect(html).not.toContain('data-danger')
  })

  it('turns red only in the danger band', () => {
    const low = renderToStaticMarkup(createElement(CostPreview, { preview: { runwayNow: 4, runwayAfter: 2.5, deathDay: 90, paydayShort: false } }))
    const short = renderToStaticMarkup(createElement(CostPreview, { preview: { runwayNow: 4, runwayAfter: 3.5, deathDay: 30, paydayShort: true } }))
    const profit = renderToStaticMarkup(createElement(CostPreview, { preview: { runwayNow: null, runwayAfter: null, deathDay: null, paydayShort: false } }))
    expect(low).toContain('data-danger')
    expect(short).toContain('data-danger')
    expect(profit).not.toContain('data-danger')
    expect(profit).toContain('∞')
  })
})
