// Payday warning parity: module builds / refreshes, opening a ring, an item upgrade and the office edit mode's Bitti
// line show the same CostPreview the Shop, Market and hires do. Red when the spend would short the next payday
// (cash minus the owed month), never a block: the button stays live while the cash covers the price.
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyAction, createGame, type GameState } from '../engine'
import { buildOffice } from '../engine/office'
import { moduleOffers, suggestModules } from '../engine/modules'
import { useGameStore } from '../store/gameStore'
import { reduceLayoutEdit, startEdit } from '../store/layoutEdit'
import { company } from '../engine/__tests__/moduleFixtures'
import { DetailBody } from './DetailPanel'
import { InstalledRow, Suggestions } from './panels/ModulesSection'
import { SpendLine } from './panels/LayoutPanel'
import { t } from './i18n'
import { money } from './format'

const initial = useGameStore.getState()

/** Cash covers `cost`, but `cost` eats into the owed month: free cash before = cost / 2, after = −cost / 2. */
function owing(s: GameState, cost: number): GameState {
  return { ...s, stats: { ...s.stats, cash: cost * 10 }, finance: { ...s.finance, net: 0, ledger: undefined, pendingPayday: undefined, deferred: cost * 10 - cost / 2 } }
}

/** Plenty of cash, nothing owed: the same line in its quiet colour. */
function flush(s: GameState): GameState {
  return { ...s, stats: { ...s.stats, cash: 1e8 }, finance: { ...s.finance, net: 0, ledger: undefined, pendingPayday: undefined, deferred: 0 } }
}

/** The CostPreview chips in the markup (the hourglass line) and how many of them are red. */
const previews = (html: string) => (html.match(/<span[^>]*tabular inline-flex items-center gap-1 rounded-lg[^>]*>/g) ?? [])
const red = (html: string) => previews(html).filter((x) => x.includes('data-danger')).length

function office(rings = 2): GameState {
  let s = createGame({ seed: 1 })
  s = { ...s, stage: 1, office: buildOffice(1, rings), stats: { ...s.stats, cash: 1e9 } }
  for (const id of ['r1-s0', 'r1-s1']) s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: id }).state
  return s
}

describe('payday warning parity', () => {
  beforeEach(() => {
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    useGameStore.setState({ state: initial.state, ui: initial.ui })
  })

  it('module rows: each Ekle carries the preview, red when the build shorts the payday, the button still live', () => {
    const base = company(['web'], 2)
    const cost = Math.min(...suggestModules(base, base.projects[0]!, 3).map((o) => o.cost))
    const render = (s: GameState) => {
      useGameStore.setState({ state: s })
      return renderToStaticMarkup(createElement(Suggestions, { project: s.projects[0]!, onDone: () => {} }))
    }
    const calm = render(flush(base))
    expect(previews(calm)).toHaveLength(3)
    expect(red(calm)).toBe(0)
    const short = render(owing(base, cost))
    expect(red(short)).toBe(3)
    expect(short).not.toContain('disabled=""')
  })

  it('module refresh: the stale row carries the same preview, red when the refresh shorts the payday', () => {
    const base = company(['web'], 2)
    base.projects[0]!.modules = [{ id: 'feedback', day: base.time.day - 2000 }]
    const offer = moduleOffers(base, base.projects[0]!).find((o) => o.id === 'feedback' && o.refresh)!
    const render = (s: GameState) => {
      useGameStore.setState({ state: s })
      return renderToStaticMarkup(createElement(InstalledRow, { project: s.projects[0]!, id: 'feedback', onDone: () => {} }))
    }
    const calm = render(flush(base))
    expect(calm).toContain(t('module.refresh'))
    expect(previews(calm)).toHaveLength(1)
    expect(red(calm)).toBe(0)
    const short = render(owing(base, offer.cost))
    expect(red(short)).toBe(1)
    expect(short).not.toContain('disabled=""')
  })

  it('a locked ring: the open button keeps working and the preview goes red when the ring shorts the payday', () => {
    const base = office(1)
    const ring = base.office.rings.filter((r) => !r.unlocked).sort((a, b) => a.index - b.index)[0]!
    const slot = base.office.slots.find((x) => x.ring === ring.index)!
    const render = (s: GameState) => {
      useGameStore.setState({ state: s })
      return renderToStaticMarkup(createElement(DetailBody, { selection: { kind: 'slot', id: slot.id } }))
    }
    expect(red(render(flush(base)))).toBe(0)
    const html = render(owing(base, ring.openCost))
    expect(previews(html)).toHaveLength(1)
    expect(red(html)).toBe(1)
    expect(html).not.toContain('disabled=""')
  })

  it('an item upgrade: priced at what upgradeItem takes (new price less the refund), preview red when short', () => {
    const base = office()
    const cost = 1200 - 300 * 0.5
    const render = (s: GameState) => {
      useGameStore.setState({ state: s })
      return renderToStaticMarkup(createElement(DetailBody, { selection: { kind: 'slot', id: 'r1-s0' } }))
    }
    const calm = render(flush(base))
    expect(calm).toContain(t('detail.upgrade', { item: 'Ergonomik Masa', v: money(cost) }))
    expect(red(calm)).toBe(0)
    const html = render(owing(base, cost))
    expect(previews(html)).toHaveLength(1)
    expect(red(html)).toBe(1)
    expect(html).not.toMatch(/arrowUp[\s\S]*disabled=""/)
  })

  it('office edit Bitti line: red against the owed month, not the raw cash; "Kasa yetmiyor" only when cash itself is short', () => {
    const base = office()
    const e = reduceLayoutEdit(base.office, reduceLayoutEdit(base.office, startEdit(base.office), { kind: 'arm', armed: { kind: 'plantRow' } }, 1), { kind: 'addDecor', x: -3, z: 0 }, 1)
    const render = (s: GameState) => {
      useGameStore.setState({ state: s, ui: { ...initial.ui, layoutEdit: e } })
      return renderToStaticMarkup(createElement(SpendLine))
    }
    const calm = render(flush(base))
    expect(calm).toContain(t('layout.spend', { v: '' }).split('{v}')[0]!.slice(0, 5))
    expect(red(calm)).toBe(0)
    expect(calm).not.toMatch(/data-layout-spend=""[^>]*data-danger/)
    // Cash 6000 covers the 600 bill, but 5700 of it is owed: the old raw-cash check stayed black here.
    const short = render(owing(base, 600))
    expect(red(short)).toBe(1)
    expect(short).toMatch(/data-layout-spend=""[^>]*data-danger/)
    expect(short).not.toContain(t('layout.spendShort', { v: '' }).slice(0, 10))
  })
})
