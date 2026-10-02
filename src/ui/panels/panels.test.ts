// Panel contents in the HUD grammar (docs/GAMEPLAY_V2.md §10.5) and the payday desk (§6.1, §10.6).
// Source greps (no DOM): no slider left in any panel, at most one Inter paragraph per panel file, no economy maths in
// the panels (rounding for display only). The desk and its horizon countdown are rendered to a string
// (react-dom/server, node environment).
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGame, type GameState } from '../../engine'
import { horizon } from '../../engine/loopSelectors'
import { useGameStore } from '../../store/gameStore'
import { HorizonDue, HorizonMini } from '../Horizon'
import { PaydayOverlay } from '../overlays/PaydayOverlay'
import { WIDGETS } from '../widgets'

const SOURCES = import.meta.glob<string>('./*.tsx', { query: '?raw', import: 'default', eager: true })
const UI_SOURCES = import.meta.glob<string>('../**/*.tsx', { query: '?raw', import: 'default', eager: true })

/** The panels this wave rebuilt (§10.5 H5a). */
const REBUILT = ['TeamPanel', 'GrowthPanel', 'ShopPanel', 'RoadmapPanel', 'MetricsPanel', 'RoundSection', 'GoalsCard']

/**
 * Panels outside H5a that still carry more than one Inter paragraph (§10.5 "<p> ≤ 1" is not met there yet).
 * TODO(H5b/H6b): bring each to one sentence and drop it from this list; the test fails once a file is fixed, so the
 * list only shrinks.
 */
const NOT_REBUILT_YET = ['AccountSection', 'DecisionPanel', 'LeaderboardPanel']

const src = (name: string): string => {
  const s = SOURCES[`./${name}.tsx`]
  if (s === undefined) throw new Error(`missing ${name}`)
  return s
}

describe('panel sources', () => {
  it('no slider anywhere in the UI: type="range" = 0', () => {
    const hits = Object.entries(UI_SOURCES).filter(([, s]) => /type=["']range["']/.test(s)).map(([p]) => p)
    expect(hits).toEqual([])
  })

  it('every panel file has at most one <p> (one sentence per panel), bar the known ones not rebuilt yet', () => {
    const paragraphs = (s: string) => (s.match(/<p[\s>]/g) ?? []).length
    const over = Object.entries(SOURCES)
      .filter(([, s]) => paragraphs(s) > 1)
      .map(([p]) => p.replace(/^\.\/|\.tsx$/g, ''))
      .sort()
    expect(over).toEqual([...NOT_REBUILT_YET].sort())
  })

  it('rebuilt panels do no economy maths: Math.* only rounds for display', () => {
    for (const name of REBUILT) {
      const calls = [...src(name).matchAll(/Math\.(\w+)/g)].map((m) => m[1])
      expect(calls.filter((c) => c !== 'round' && c !== 'ceil' && c !== 'floor'), name).toEqual([])
    }
  })

  it('commit buttons carry a CostPreview (hire, buy, ad step, down round)', () => {
    for (const name of ['TeamPanel', 'ShopPanel', 'GrowthPanel', 'RoundSection']) expect(src(name), name).toMatch(/<CostPreview\b/)
    expect(src('RoundSection')).toMatch(/down: true/)
  })

  it('the strike pips read roundView.risk / strikes, the loan row reads finance.loan', () => {
    expect(src('RoundSection')).toMatch(/view\?\.risk/)
    expect(src('RoundSection')).toMatch(/view\?\.strikes/)
    expect(src('MetricsPanel')).toMatch(/finance\.loan/)
  })

  it('the covenant light warns before a breach, the price steps use the engine range, no guessed board shape', () => {
    // The light comes from the engine's covenantState (same test as checkCovenant), not a UI comparison.
    expect(src('MetricsPanel')).toMatch(/covenantState\(/)
    expect(src('MetricsPanel')).not.toMatch(/covenantRunway/)
    expect(src('MetricsPanel')).toMatch(/loan\.risk/)
    // Price and ad steps are engine selectors; the round-end runway too (the UI computes no formula).
    expect(src('GrowthPanel')).toMatch(/PRICE_STEPS/)
    expect(src('GrowthPanel')).toMatch(/adBudgetSteps\(/)
    expect(src('GrowthPanel')).not.toMatch(/\bbase \* /)
    expect(src('RoundSection')).toMatch(/roundEndRunway\(/)
    expect(src('RoundSection')).not.toMatch(/DAYS_PER_(MONTH|WEEK)/)
    expect(src('GrowthPanel')).not.toMatch(/board\?\./)
  })

  it('no hairline lists in the rebuilt panels (4px gaps instead of divide-y)', () => {
    for (const name of REBUILT) expect(src(name), name).not.toMatch(/divide-y/)
  })

  it('the widget registry still covers its cards', () => {
    expect(Object.keys(WIDGETS).length).toBeGreaterThan(10)
  })
})

/** A month of $4.4K waiting on the desk since day 30, with $1K in the till, as the store holds it. */
function deskState(): GameState {
  const s = createGame({ seed: 7 })
  s.time.day = 31
  s.stats.cash = 1_000
  s.finance.pendingPayday = { day: 30, ledger: { revenue: 0, salaries: 3_000, rent: 500, infra: 200, ads: 300, founder: 400 }, deferredBefore: 0 }
  s.derived.horizon = horizon(s)
  return s
}

const initial = useGameStore.getState()

describe('payday desk (§6.1)', () => {
  // react-dom/server reads a store's initial state (useSyncExternalStore's server snapshot): read the live one instead.
  beforeEach(() => {
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    useGameStore.setState({ state: initial.state, ui: initial.ui })
  })

  it('renders the receipt lines with their answers, cash after, one commit and one routine, no countdown', () => {
    useGameStore.setState({ state: deskState(), ui: { ...initial.ui, overlay: { kind: 'payday' } } })
    const html = renderToStaticMarkup(createElement(PaydayOverlay, { onClose: () => {} }))
    const lines = [...html.matchAll(/data-line="(\w+)"/g)].map((m) => m[1])
    expect(lines).toEqual(['salaries', 'infra', 'rent', 'founder', 'ads'])
    // Answers: öde / yarı / ertele on salaries, öde / kes on ads; the default order is the starting pick.
    expect(html).toContain('Yarı')
    expect(html).toContain('Kes')
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(5)
    expect(html).toContain('Kasa sonra')
    expect(html).toContain('Onayla')
    expect(html).toContain('Sonra')
    expect((html.match(/data-cue="confirm"/g) ?? []).length).toBe(1)
    expect((html.match(/<p[\s>]/g) ?? []).length).toBe(1)
    // Time stands still while the desk is open: no countdown on it.
    expect(html).not.toContain('data-payday-due')
    expect(html).not.toMatch(/>\d+g</)
  })

  it('the horizon shows the red 3g only while the desk is closed', () => {
    const s = deskState()
    useGameStore.setState({ state: s, ui: { ...initial.ui, overlay: null } })
    const closed = renderToStaticMarkup(createElement(HorizonDue))
    expect(closed).toMatch(/^<button[^>]*data-payday-due/)
    expect(closed).toMatch(/text-negative-ink[^>]*>.*2g<\/button>/)
    // The countdown is its own button, never nested inside the strip's horizon button.
    expect(renderToStaticMarkup(createElement(HorizonMini, { max: 2 }))).not.toContain('data-payday-due')
    useGameStore.setState({ ui: { ...initial.ui, overlay: { kind: 'payday' } } })
    expect(renderToStaticMarkup(createElement(HorizonDue))).toBe('')
  })
})
