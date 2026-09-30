// Stats screen data (docs/GAMEPLAY_V2.md §14.5): receipts → series, lock states, the memo that keeps the series
// still while time flows, and the screen's text budget (one sentence) on the server render.
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cashProjection, companyProfile, targetProfile } from '../../engine/loopSelectors'
import { SECONDS_PER_DAY, type MonthReceipt, type PartialReceipt, type ReceiptEntry } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { CenterFrame } from './CenterFrame'
import { STATS_TABS, StatsScreen } from './StatsScreen'
import {
  BAR_MONTHS,
  costSplit,
  deptBars,
  growthView,
  moneyView,
  profileView,
  projectionMonths,
  resetStatsDataCalls,
  runwayAt,
  statsData,
  statsDataCalls,
  statsLocks,
  statsMemo,
  teamView,
  type LiveTip,
} from './statsData'

const store = () => useGameStore.getState()

function receipt(month: number, over: Partial<MonthReceipt> = {}): MonthReceipt {
  return {
    month,
    day: (month + 1) * 30,
    revenue: 1_000 * month,
    salaries: 4_000,
    rent: 500,
    infra: 100,
    ads: 0,
    founder: 1_500,
    paid: 6_100,
    net: 1_000 * month - 6_100,
    cashAfter: 50_000 - 5_000 * month,
    runwayBefore: null,
    runwayAfter: 8 - month * 0.5,
    mom: 0.1,
    multiple: 3,
    mrr: 1_000 * month,
    users: 100 * month,
    team: 2 + month,
    morale: 70,
    valuation: 100_000 * (month + 1),
    equity: 0.9,
    usersDelta: 100,
    ...over,
  }
}

const partial = (month: number): PartialReceipt => ({ partial: true, month, day: (month + 1) * 30, mrr: 10 * month, users: 5 * month, usersDelta: 5 })

const live: LiveTip = { day: 100, cash: 30_000, mrr: 3_200, users: 320, valuation: 450_000, team: 5, morale: 66, runway: 6.5 }

describe('statsData: receipts → series', () => {
  const receipts: ReceiptEntry[] = [partial(0), receipt(1), receipt(2)]

  it('one row per month; a rebuilt pre-v4 month has no money on record', () => {
    const s = statsData(receipts)
    expect(s.n).toBe(3)
    expect(s.lastDay).toBe(90)
    expect(s.rows.map((r) => r.x)).toEqual([30, 60, 90])
    expect(s.rows[0]).toMatchObject({ cash: null, revenue: null, costs: null, mrr: 0, newUsers: 5 })
    expect(s.rows[1]).toMatchObject({ cash: 45_000, revenue: 1_000, costs: [4_000, 500, 1_500, 100, 0], team: 3 })
  })

  it('Para: cash line + live end, dashed projection, death point, paydays as marks, 12-month flow', () => {
    const s = statsData(receipts)
    const proj = { points: [{ day: 120, cash: 12_000 }, { day: 150, cash: -2_000 }], deathDay: 150 }
    const v = moneyView(s, live, proj, { crisis: [140] })
    expect(v.cash.map((p) => p.y)).toEqual([null, 45_000, 40_000, 30_000])
    expect(v.cash.at(-1)).toEqual({ x: 100, y: 30_000 })
    expect(v.projection).toEqual([{ x: 120, y: 12_000 }, { x: 150, y: -2_000 }])
    expect(v.death).toEqual({ x: 150, y: -2_000 })
    expect(v.marks).toEqual([
      { x: 120, kind: 'payday' },
      { x: 150, kind: 'payday' },
      { x: 140, kind: 'crisis' },
    ])
    // The rebuilt month has no revenue / cost split: no bar for it.
    expect(v.flow.map((g) => g.x)).toEqual([60, 90])
    expect(v.flow[0]!.values).toEqual([[1_000], [4_000, 500, 1_500, 100, 0]])
    // Profitable: no death, no red point.
    expect(moneyView(s, live, { points: [], deathDay: null }).death).toBeNull()
  })

  it('runway header: today when nothing is selected, ∞ only for a real null, — for a month not on record', () => {
    const s = statsData(receipts)
    expect(runwayAt(s, live, null)).toEqual({ y: 6.5, x: null })
    expect(runwayAt(s, { ...live, runway: null }, null)).toEqual({ y: null, x: null })
    expect(runwayAt(statsData([]), live, null)).toEqual({ y: 6.5, x: null })
    expect(runwayAt(s, live, 30)).toEqual({ y: undefined, x: 30 })
    expect(runwayAt(s, live, 60)).toEqual({ y: 7.5, x: 60 })
    expect(runwayAt(s, live, 100)).toEqual({ y: 6.5, x: 100 })
    expect(moneyView(s, live, { points: [], deathDay: null }).runway.at(-1)).toEqual({ x: 100, y: 6.5 })
  })

  it('a death day past the 12 paydays stretches the projection (capped); the death point takes its cash', () => {
    const twelve = { points: Array.from({ length: 12 }, (_, k) => ({ day: 120 + k * 30, cash: 90_000 - k * 5_000 })), deathDay: 120 + 18 * 30 }
    expect(projectionMonths(twelve)).toBe(19)
    expect(projectionMonths({ ...twelve, deathDay: 120 + 99 * 30 })).toBe(36)
    expect(projectionMonths({ ...twelve, deathDay: 150 })).toBe(12)
    expect(projectionMonths({ ...twelve, deathDay: null })).toBe(12)
    const s = statsData(receipts)
    const long = { points: Array.from({ length: 19 }, (_, k) => ({ day: 120 + k * 30, cash: 90_000 - k * 5_100 })), deathDay: 120 + 18 * 30 }
    const v = moneyView(s, live, long)
    expect(v.death).toEqual({ x: 660, y: 90_000 - 18 * 5_100 })
    // Payday marks stay a year long however far the dashed line runs.
    expect(v.marks).toHaveLength(BAR_MONTHS)
  })

  it('the bars keep the last 12 months only', () => {
    const many = Array.from({ length: 30 }, (_, i) => receipt(i))
    const s = statsData(many)
    expect(moneyView(s, { ...live, day: 999 }, { points: [], deathDay: null }).flow).toHaveLength(BAR_MONTHS)
    expect(growthView(s, { ...live, day: 999 }, null).newUsers).toHaveLength(BAR_MONTHS)
  })

  it('Büyüme: target + window lines from the round view, market fill once on record', () => {
    const s = statsData([receipt(1), receipt(2, { penetration: 0.12 })])
    const v = growthView(s, live, { target: 500_000, windowAt: 300_000 })
    expect(v.target).toEqual({ value: 500_000, window: 300_000 })
    expect(v.mrr.at(-1)).toEqual({ x: 100, y: 3_200 })
    expect(v.penetration).toBe(0.12)
    expect(v.rival).toEqual([])
    expect(growthView(statsData([receipt(1)]), live, undefined).penetration).toBeNull()
  })

  it('Ekip / Profil / split: engine numbers in chart order', () => {
    const s = statsData([receipt(1)])
    expect(teamView(s, live).team).toEqual([{ x: 60, y: 3 }, { x: 100, y: 5 }])
    expect(costSplit({ salaries: 9, rent: 2, infra: 1, ads: 0 })).toEqual([9, 2, 0, 1, 0])
    const counts = { eng: 2, product: 1, marketing: 0, sales: 0, ops: 1 }
    const out = { eng: 1.8, product: 0.9, marketing: 0, sales: 0, ops: 1 }
    expect(deptBars(['eng', 'ops'], counts, out)).toEqual([
      { x: 0, values: [[2], [1.8]] },
      { x: 1, values: [[1], [1]] },
    ])
    store().newGame({ seed: 3, founderXp: 0, runIndex: 0 })
    const p = profileView(companyProfile(store().state), targetProfile(0))
    expect(p.values).toHaveLength(6)
    expect(p.target).toHaveLength(6)
  })

  it('lock states: a chart stays a locked tile until its gauge / tool is learned', () => {
    expect(statsLocks([], [], null)).toEqual({ burn: true, channels: true, capTable: true, market: true })
    expect(statsLocks(['burnBreakdown', 'channelBreakdown'], ['capTableView'], 0.2)).toEqual({ burn: false, channels: false, capTable: false, market: false })
  })
})

describe('statsMemo: the series only move on payday', () => {
  beforeEach(() => {
    store().newGame({ seed: 11, founderXp: 0, runIndex: 0 })
    store().dispatch({ type: 'setSpeed', speed: 4 })
    store().openOverlay({ kind: 'stats' })
  })

  it('at 4× with the screen open, one game month rebuilds at most months + 1 times', () => {
    resetStatsDataCalls()
    const memo = statsMemo()
    const startDay = store().state.time.day
    const startN = store().state.finance.receipts?.length ?? 0
    let frames = 0
    // 60 fps frames until 31 game days passed; the screen re-renders (and asks the memo) on every frame.
    while (store().state.time.day < startDay + 31 && !store().state.gameOver && frames < 20_000) {
      store().tick(1 / 60)
      memo(store().state.finance.receipts)
      frames++
    }
    const months = (store().state.finance.receipts?.length ?? 0) - startN
    expect(store().state.time.day).toBeGreaterThanOrEqual(startDay + 31)
    expect(frames).toBeGreaterThan(100)
    expect(months).toBeGreaterThanOrEqual(1)
    expect(statsDataCalls()).toBeLessThanOrEqual(months + 1)
  })

  it('stats open: the tick moves the day on, the screen stays open', () => {
    const day = store().state.time.day
    store().tick(SECONDS_PER_DAY)
    expect(store().state.time.day).toBeGreaterThan(day)
    expect(store().ui.overlay).toEqual({ kind: 'stats' })
  })
})

describe('StatsScreen render', () => {
  // A server render reads zustand's initial snapshot (getServerSnapshot); read the live store instead, so the
  // screen under test is the ticked game, not a mix of the initial one and today's receipts.
  beforeEach(() => {
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_sub, get) => get())
    store().newGame({ seed: 5, founderXp: 0, runIndex: 0 })
    store().dispatch({ type: 'setSpeed', speed: 4 })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const ticked = () => {
    // Three months on record, so every chart has data.
    for (let i = 0; i < 95 * 8 && !store().state.gameOver; i++) store().tick(SECONDS_PER_DAY / 8)
  }
  const sentences = (html: string) => html.match(/<p[\s>]/g)?.length ?? 0

  it('every tab: at most one sentence (<p>), charts drawn as SVG', () => {
    ticked()
    expect(store().state.finance.receipts?.length ?? 0).toBeGreaterThanOrEqual(2)
    for (const tab of STATS_TABS) {
      const html = renderToStaticMarkup(createElement(CenterFrame, { kind: 'stats', tab, onClose: () => {} }))
      expect(html, tab).toContain(`data-stats-n="${store().state.finance.receipts!.length}"`)
      expect(sentences(html), tab).toBeLessThanOrEqual(1)
      expect(html, tab).toContain('<svg')
      expect(html, tab).toContain(`data-stats-tab="${tab}"`)
    }
  })

  it('Para prints the death day as its one sentence while cash runs out', () => {
    ticked()
    const death = cashProjection(store().state).deathDay
    const html = renderToStaticMarkup(createElement(StatsScreen, { tab: 'money' }))
    if (death === null) expect(sentences(html)).toBe(0)
    else {
      expect(html).toContain(`Kasa biter · Gün ${death}`)
      expect(sentences(html)).toBe(1)
    }
  })

  it('first month, nothing on record: empty bar tiles are icons only, the death day stays the one sentence', () => {
    expect(store().state.finance.receipts?.length ?? 0).toBe(0)
    for (const tab of STATS_TABS) {
      const html = renderToStaticMarkup(createElement(StatsScreen, { tab }))
      expect(sentences(html), tab).toBeLessThanOrEqual(1)
    }
    // The runway header is today's, not a stale ∞ while cash burns.
    const rw = store().state.finance.runway
    const html = renderToStaticMarkup(createElement(StatsScreen, { tab: 'money' }))
    if (rw !== null) expect(html).not.toContain('∞')
  })

  it('Kanun Kitabı / Pazar haritası: empty placeholders, no sentence', () => {
    for (const kind of ['lawbook', 'market'] as const) {
      const html = renderToStaticMarkup(createElement(CenterFrame, { kind, onClose: () => {} }))
      expect(html).toContain(`data-center-frame="${kind}"`)
      expect(html.match(/<p[\s>]/g)?.length ?? 0).toBe(0)
    }
  })
})
