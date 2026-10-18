// Panel contents in the HUD grammar (docs/GAMEPLAY_V2.md §10.5), the payday desk (§6.1, §10.6), and the center
// screens of H5b (Kanun Kitabı, Pazar haritası: §7.2, §8.1) with the Büyüme rows that lead there, and the sale screen.
// Source greps (no DOM): no slider left in any panel, at most one Inter paragraph per panel file, no economy maths in
// the panels (rounding for display only). The desk and its horizon countdown are rendered to a string
// (react-dom/server, node environment).
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyAction, createGame, step, type GameState, type StageIndex } from '../../engine'
import { daysLeft } from '../center/centerData'
import { horizon } from '../../engine/loopSelectors'
import { enterStage } from '../../engine/round'
import { SECONDS_PER_DAY } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { HorizonDue, HorizonMini } from '../Horizon'
import { PaydayOverlay } from '../overlays/PaydayOverlay'
import { PostMortemOverlay } from '../overlays/Overlays'
import { CenterFrame } from '../stats/CenterFrame'
import { WIDGETS } from '../widgets'
import { GrowthPanel } from './GrowthPanel'
import { MultipleCap } from './RoundSection'
import { launchGain, priceGate, releaseGain, releaseName } from '../loopUi'
import { DetailBody } from '../DetailPanel'
import { AssignList, ProjectsPanel } from './ProjectsPanel'
import { Suggestions } from './ModulesSection'
import { momentText } from '../Moments'
import { company } from '../../engine/__tests__/moduleFixtures'
import { openConceptCard } from '../uiActions'
import { t } from '../i18n'
import { CONCEPTS } from '../../content'
import type { ValuationBreakdown } from '../../engine/types'

const SOURCES = import.meta.glob<string>('./*.tsx', { query: '?raw', import: 'default', eager: true })
const UI_SOURCES = import.meta.glob<string>('../**/*.tsx', { query: '?raw', import: 'default', eager: true })
const CENTER_SOURCES = import.meta.glob<string>('../center/*.tsx', { query: '?raw', import: 'default', eager: true })

/** The panels this wave rebuilt (§10.5 H5a). */
const REBUILT = ['TeamPanel', 'GrowthPanel', 'ShopPanel', 'RoadmapPanel', 'MetricsPanel', 'RoundSection', 'GoalsCard']

/**
 * Panels outside H5a that still carry more than one Inter paragraph (§10.5 "<p> ≤ 1" is not met there yet).
 * TODO(H5b/H6b): bring each to one sentence and drop it from this list; the test fails once a file is fixed, so the
 * list only shrinks.
 */
const NOT_REBUILT_YET = ['AccountSection', 'LeaderboardPanel']

const src = (name: string): string => {
  const s = SOURCES[`./${name}.tsx`] ?? CENTER_SOURCES[`../center/${name}.tsx`]
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

  it('commit buttons carry a CostPreview (hire, buy, ad step, down round, renewal, sign, open segment, buy a rival)', () => {
    for (const name of ['ShopPanel', 'GrowthPanel', 'RoundSection', 'RenewalSection', 'LawbookScreen', 'MarketScreen']) expect(src(name), name).toMatch(/<CostPreview\b/)
    // N1: the hire offer says the runway it leaves in words ("Kasa 2 ay taşır").
    expect(src('TeamPanel')).toMatch(/<HireRunway\b/)
    expect(src('RoundSection')).toMatch(/down: true/)
    // Two commits per renewal (the hold also shows its failure), two kinds of commit on the map: each its own preview.
    expect(src('RenewalSection').match(/<CostPreview\b/g)).toHaveLength(3)
    expect(src('MarketScreen').match(/<CostPreview\b/g)).toHaveLength(2)
  })

  it('center screens: at most one <p>, no slider, no economy maths; every gate is the engine’s', () => {
    expect(Object.keys(CENTER_SOURCES).length).toBeGreaterThanOrEqual(2)
    for (const [path, s] of Object.entries(CENTER_SOURCES)) {
      expect((s.match(/<p[\s>]/g) ?? []).length, path).toBeLessThanOrEqual(1)
      expect(s, path).not.toMatch(/type=["']range["']/)
      expect([...s.matchAll(/Math\.(\w+)/g)].map((m) => m[1]).filter((c) => c !== 'round' && c !== 'floor' && c !== 'ceil'), path).toEqual([])
    }
    expect(src('LawbookScreen')).toMatch(/policyError\(/)
    expect(src('LawbookScreen')).toMatch(/signBurnDelta\(/)
    expect(src('MarketScreen')).toMatch(/derived\.market/)
    expect(src('BoardRow')).toMatch(/derived\.board/)
    expect(src('RenewalSection')).toMatch(/derived\.renewals/)
    expect(src('DecisionPanel')).toMatch(/effects\.loan/)
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

  it('the size picker lives in Büyüme › Tur only: the hub shows a summary row that opens it (UI2, the offer pause)', () => {
    expect(src('GrowthPanel')).toMatch(/<RoundSection setup=\{section === 'round'\} \/>/)
    expect(src('RoundSection')).toMatch(/!summary && \(s\.canStart \|\| view\.downRound\) && view\.sizes/)
    expect(src('RoundSection')).toMatch(/openPanel\(\{ kind: 'growth', section: 'round' \}/)
  })

  it('no hairline lists in the rebuilt panels (4px gaps instead of divide-y)', () => {
    for (const name of REBUILT) expect(src(name), name).not.toMatch(/divide-y/)
  })

  it('the widget registry still covers its cards', () => {
    expect(Object.keys(WIDGETS).length).toBeGreaterThan(10)
  })
})

describe('price lock (playtest LD5)', () => {
  it('priceGate mirrors the pricing trigger: the same bars, met = the trigger would fire (price still at 1×)', () => {
    const s = createGame({ seed: 3 })
    enterStage(s, 1)
    enterStage(s, 2)
    const pricing = CONCEPTS.find((c) => c.id === 'pricing')!
    const set = (users: number, maturity: number, churn: number) => {
      s.stats.users = users
      s.derived.avgMaturity = maturity
      s.stats.churn = churn
      const g = priceGate(s)
      return [g.stage && g.users.ok && g.maturity.ok && g.churn.ok, pricing.trigger(s)]
    }
    expect(set(501, 0.5, 0.079)).toEqual([true, true])
    expect(set(500, 0.9, 0.02)).toEqual([false, false])
    expect(set(900, 0.49, 0.02)).toEqual([false, false])
    expect(set(900, 0.9, 0.08)).toEqual([false, false])
    expect(priceGate(s).waiting).toBe(false)
  })
})

describe('valuation levers (playtest LD2, LD4)', () => {
  const parts = (over: Partial<ValuationBreakdown>): ValuationBreakdown => ({
    mode: 'pre', users: 300, launched: 1, releases: 2, usersValue: 120_000, launchedValue: 150_000, releasesValue: 30_000,
    mrr: 0, multiple: 15, momAvg: 0, min: 3, cap: 15, penalty: 1, blend: 0, preFade: 0, total: 300_000, ...over,
  })

  it('a launch is worth $150K before revenue and ~0 once revenue has replaced the floor (Seed, blend 1)', () => {
    expect(launchGain(parts({}), 1)).toBeCloseTo(150_000, 6)
    expect(releaseGain(parts({}), 1)).toBeCloseTo(15_000, 6)
    expect(releaseGain(parts({ releases: 5 }), 1)).toBe(0)
    expect(launchGain(parts({ mode: 'post', mrr: 50_000, blend: 1, total: 9_000_000 }), 2)).toBeLessThan(1)
    expect(launchGain(undefined, 0)).toBe(0)
  })

  it('the multiple at its ceiling carries the Tavan pill', () => {
    const o = { multiple: 15, cap: 15, in30: 1, trend: 'flat' as const, factorIn30: 1 }
    const at = renderToStaticMarkup(createElement(MultipleCap, { outlook: { ...o, atCap: true } }))
    expect(at).toContain('data-mult-cap="cap"')
    expect(at).toContain('Tavan')
    const below = renderToStaticMarkup(createElement(MultipleCap, { outlook: { ...o, multiple: 9, atCap: false } }))
    expect(below).not.toContain('Tavan')
  })
})

/** A fresh company walked up to `stage` (tools, segments, rivals, the board), rich enough for every commit. */
function lateState(stage: StageIndex, cash = 50_000_000): GameState {
  let s = createGame({ seed: 1 })
  for (let i = 1; i <= stage; i++) enterStage(s, i as StageIndex)
  s = { ...s, stats: { ...s.stats, cash } }
  return step(s, 0.25)
}

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

describe('center screens (H5b)', () => {
  beforeEach(() => {
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    useGameStore.setState({ state: initial.state, ui: initial.ui })
  })
  const sentences = (html: string) => (html.match(/<p[\s>]/g) ?? []).length

  it('Kanun Kitabı: tree columns, silhouettes with their lock number, one sentence, İmzala with its preview', () => {
    useGameStore.setState({ state: lateState(2), ui: { ...initial.ui, overlay: { kind: 'lawbook' } } })
    const html = renderToStaticMarkup(createElement(CenterFrame, { kind: 'lawbook', onClose: () => {} }))
    expect([...html.matchAll(/data-tree="(\w+)"/g)].map((m) => m[1])).toEqual(['survival', 'growth', 'craft', 'org'])
    expect(html).toContain('data-law="salary-freeze" data-status="locked"')
    expect(html).toContain('runway &lt; 8')
    expect(html).toContain('data-sign-bar=')
    expect(html).toContain('İmzala')
    expect(html).toContain('Geri alınamaz')
    expect((html.match(/data-cue="confirm"/g) ?? []).length).toBe(1)
    expect(sentences(html)).toBe(1)
    expect(html).not.toMatch(/type="range"/)
  })

  it('Kanun Kitabı after a signature: the bar keeps the countdown (days on the cards, the commit and a ring), never "Yasa seç"', () => {
    const r = applyAction(lateState(2), { type: 'adoptPolicy', policyId: 'crunch-culture' })
    expect(r.ok).toBe(true)
    const left = daysLeft(r.state.derived.policies!.nextSignDay, r.state.time.day)
    expect(left).toBeGreaterThan(0)
    useGameStore.setState({ state: r.state, ui: { ...initial.ui, overlay: { kind: 'lawbook' } } })
    const html = renderToStaticMarkup(createElement(CenterFrame, { kind: 'lawbook', onClose: () => {} }))
    expect(html).not.toContain('Yasa seç')
    expect(html).toContain('data-law="hire-fast" data-status="wait"')
    expect(html).toContain('data-sign-wait')
    // Header ring, each waiting card and the commit chip all carry the same day count.
    const waiting = (html.match(/data-status="wait"/g) ?? []).length
    expect((html.match(new RegExp(`>${left}g<`, 'g')) ?? []).length).toBe(waiting + 2)
    expect(html).not.toContain('Bekle.')
    expect(sentences(html)).toBe(1)
  })

  it('Pazar haritası: fill ring, segment tiles, "Aç" with its price, rival rows; at most one sentence', () => {
    useGameStore.setState({ state: lateState(4), ui: { ...initial.ui, overlay: { kind: 'market' } } })
    const html = renderToStaticMarkup(createElement(CenterFrame, { kind: 'market', onClose: () => {} }))
    expect([...html.matchAll(/data-segment="(\w+)" data-status="(\w+)"/g)].map((m) => `${m[1]}:${m[2]}`)).toEqual([
      'early:open',
      'smb:open',
      'midmarket:ready',
      'enterprise:ready',
      'global:locked',
    ])
    expect(html).toContain('data-pen')
    expect(html).toContain('$250K')
    expect(html).toContain('data-rival=')
    expect(html).toContain('Satın al')
    expect(sentences(html)).toBeLessThanOrEqual(1)
  })

  it('Büyüme: one-line rows with real numbers (Pazarlama tab), the Kurul row from Series A (Tur tab)', () => {
    useGameStore.setState({ state: lateState(3), ui: { ...initial.ui } })
    const html = renderToStaticMarkup(createElement(GrowthPanel, {}))
    expect(html).toMatch(/%\d+ · 2 segment/)
    expect(html).toContain('0 politika')
    expect(html).not.toContain('data-board-row')
    expect(renderToStaticMarkup(createElement(GrowthPanel, { section: 'round' }))).toContain('data-board-row')
    useGameStore.setState({ state: lateState(2) })
    expect(renderToStaticMarkup(createElement(GrowthPanel, { section: 'round' }))).not.toContain('data-board-row')
  })

  it('Büyüme: tabs, nothing that has a home elsewhere (MRR, maturity, capacity, valuation parts)', () => {
    useGameStore.setState({ state: lateState(3), ui: { ...initial.ui } })
    const html = renderToStaticMarkup(createElement(GrowthPanel, {}))
    for (const k of ['round', 'market'] as const) expect(html).toContain(t(`growth.tab.${k}`))
    // Müşteri waits for Series B's enterprise sales (or a renewal due).
    expect(html).not.toContain(`>${t('growth.tab.customers')}<`)
    expect(html).not.toContain(t('growth.avgMaturity'))
    expect(src('GrowthPanel')).not.toMatch(/ValuationParts|DecisionOutcomes/)
  })

  it('Büyüme price lock (LD5): the trigger checks with live numbers; a shelved pricing card becomes the way in', () => {
    const s = lateState(2)
    s.unlockedTools = s.unlockedTools.filter((x) => x !== 'priceControl')
    s.concepts.triggered = s.concepts.triggered.filter((x) => x !== 'pricing')
    s.concepts.learned = s.concepts.learned.filter((x) => x !== 'pricing')
    useGameStore.setState({ state: s, ui: { ...initial.ui } })
    let html = renderToStaticMarkup(createElement(GrowthPanel, {}))
    expect(html).toContain('/500 kullanıcı')
    expect(html).toContain('Olgunluk ')
    expect(html).toContain('Churn ')
    expect(html).not.toContain(t('growth.priceWaiting'))
    // The customer came and the bubble went to the shelf unopened: the lock points at the card.
    useGameStore.setState({ state: { ...s, concepts: { ...s.concepts, triggered: [...s.concepts.triggered, 'pricing'], minimized: [...s.concepts.minimized, 'pricing'] } } })
    html = renderToStaticMarkup(createElement(GrowthPanel, {}))
    expect(html).toContain(t('growth.priceWaiting'))
    expect(html).not.toContain('/500 kullanıcı')
    openConceptCard('pricing')
    expect(useGameStore.getState().state.unlockedTools).toContain('priceControl')
    expect(renderToStaticMarkup(createElement(GrowthPanel, {}))).not.toContain(t('growth.priceWaiting'))
  })

  it('lawbook / market open: the tick moves on; a decision card closes them', () => {
    const store = () => useGameStore.getState()
    for (const kind of ['lawbook', 'market'] as const) {
      store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
      store().dispatch({ type: 'setSpeed', speed: 4 })
      store().openOverlay({ kind })
      const day = store().state.time.day
      store().tick(SECONDS_PER_DAY)
      expect(store().state.time.day).toBeGreaterThan(day)
      expect(store().ui.overlay).toEqual({ kind })
      for (let i = 0; i < 800 && !store().state.decisions.active; i++) store().tick(SECONDS_PER_DAY / 8)
      expect(store().state.decisions.active).toBeDefined()
      expect(store().ui.overlay).toBeNull()
      // A card never drops the chosen 4× (F1).
      expect(store().state.time.speed).toBe(4)
    }
  })

  it('the sale: three numbers, the XP on "Yeniden", no sentence', () => {
    const s = lateState(5)
    s.gameOver = { kind: 'acquired', day: s.time.day, reasons: [], xpEarned: 6 }
    useGameStore.setState({ state: s, ui: { ...initial.ui, overlay: { kind: 'postMortem' } } })
    const html = renderToStaticMarkup(createElement(PostMortemOverlay))
    expect(html).toContain('data-acquired')
    expect(html).toContain('Şirket satıldı')
    expect(html).toContain('Satış değeri')
    expect(html).toContain('Payın')
    expect(html).toMatch(/\+6[.,]?0? Kurucu XP/)
    expect(html).toContain('Yeniden kur')
    expect(sentences(html)).toBe(0)
  })
})

describe('project rename input (W1)', () => {
  it('is capped at the engine limit, 16px (no iOS zoom) and a 44px target', () => {
    const src = Object.entries(UI_SOURCES).find(([k]) => k.endsWith('/DetailPanel.tsx'))![1]
    expect(src).toContain('maxLength={PROJECT_NAME_MAX}')
    expect(src).toContain('fontSize: 16')
    expect(src.match(/min-h-11/g)!.length).toBeGreaterThanOrEqual(2)
  })
})

describe('project modules (W2c)', () => {
  beforeEach(() => {
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    useGameStore.setState({ state: initial.state, ui: initial.ui })
  })
  const detail = (s: GameState) => {
    useGameStore.setState({ state: s })
    return renderToStaticMarkup(createElement(DetailBody, { selection: { kind: 'project', id: s.projects[0]!.id } }))
  }

  it('ad focus (W3): the chip row needs 2 launched projects and ads; the focused product is marked, the other offers the switch', () => {
    const two = company(['web', 'game'], 2)
    two.unlockedTools = [...new Set([...two.unlockedTools, 'adBudget' as const])]
    const grow = (st: GameState) => {
      useGameStore.setState({ state: st })
      return renderToStaticMarkup(createElement(GrowthPanel, {}))
    }
    expect(grow(two)).toContain('data-ad-focus')
    const noAds = { ...two, finance: { ...two.finance, adBudget: 0 } }
    expect(grow(noAds)).not.toContain('data-ad-focus')
    const one = company(['web'], 2)
    one.unlockedTools = two.unlockedTools
    expect(grow(one)).not.toContain('data-ad-focus')
    // Detail: the other product offers the switch, the focused one wears the chip.
    expect(detail(two)).toContain(t('ads.focusThis'))
    const focused = { ...two, finance: { ...two.finance, adFocus: two.projects[0]!.id } }
    const html = detail(focused)
    expect(html).toContain(t('ads.focusOn'))
    expect(html).not.toContain(t('ads.focusThis'))
    // Switching back to the company still shows the warm-up chip.
    const back = { ...two, finance: { ...two.finance, adFocus: undefined, adFocusDay: two.time.day } }
    expect(grow(back)).toContain(t('ads.warmup', { d: 14 }))
  })

  it('a finished product: "Modüller" with n/max, slots as 56px squares, the percent text gone, "Kapsam" for the old "Büyüklük"', () => {
    const s = company(['web'], 2)
    s.projects[0]!.modules = [{ id: 'feedback', day: s.time.day }]
    const html = detail(s)
    expect(html).toContain('Modüller')
    // MV2a (rule change on purpose): slots come by version, v1 opens 3 (was 2 at Seed).
    expect(html).toContain('1/3')
    expect(html).toContain('Yayında')
    expect(html).toContain('Kapsam')
    expect(html).not.toContain('Büyüklük')
    expect(html).not.toContain('%100')
    expect(html).not.toContain('MVP')
    // Three slots: the installed icon and two "+" (≥ 56px squares).
    expect((html.match(/size-14/g) ?? []).length).toBe(3)
    expect(html).toContain('aria-label="Modül ekle"')
  })

  it('the "+" list: 3 suggested rows (≤ 3 chips, one Ekle each), the rest folded behind "Tüm modüller", locked ones not in the three', () => {
    const s = company(['web'], 2)
    useGameStore.setState({ state: s })
    const html = renderToStaticMarkup(createElement(Suggestions, { project: s.projects[0]!, onDone: () => {} }))
    const rows = html.split('<li').slice(1)
    expect(rows).toHaveLength(3)
    for (const r of rows) {
      // MV2c (rule changed on purpose): gain, minus / rent, cost, plus the optional synergy chip.
      expect((r.match(/data-chip=""/g) ?? []).length).toBeLessThanOrEqual(4)
      expect(r).toContain('>Ekle<')
    }
    expect(html).toContain('Tüm modüller')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Public API')
  })

  it('a poor company still lists the rows, disabled, with the engine reason', () => {
    const s = company(['web'], 2)
    s.stats.cash = 5
    useGameStore.setState({ state: s })
    const html = renderToStaticMarkup(createElement(Suggestions, { project: s.projects[0]!, onDone: () => {} }))
    expect(html).toContain('Kasa yetmiyor.')
    expect((html.match(/disabled=""/g) ?? []).length).toBe(3)
  })

  it('before 1.0 the bar and the percent stay and there is no module section', () => {
    const s = company(['web'], 2)
    s.projects[0]!.maturity = 0.6
    const html = detail(s)
    expect(html).toContain('%60')
    expect(html).toContain('MVP')
    expect(html).not.toContain('Modüller')
  })

  it('a running build shows its ring and days in the slot (a slot is spent), no "+" for it', () => {
    const s = company(['web'], 2)
    const r = applyAction(s, { type: 'buildModule', projectId: s.projects[0]!.id, moduleId: 'feedback' })
    if (!r.ok) throw new Error('build')
    const html = detail(r.state)
    // MV2a: 3 slots at v1 (was 2 at Seed).
    expect(html).toContain('1/3')
    expect(html).toContain('aria-label="Geliştiriliyor"')
    expect(html).toMatch(/≈\d+g/)
    expect((html.match(/aria-label="Modül ekle"/g) ?? []).length).toBe(2)
  })

  it('the card: modules replace the percent bar at 1.0', () => {
    const s = company(['web'], 2)
    s.projects[0]!.modules = [{ id: 'feedback', day: s.time.day }]
    useGameStore.setState({ state: s })
    const html = renderToStaticMarkup(createElement(ProjectsPanel))
    expect(html).toContain('aria-label="Modüller"')
    expect(html).not.toContain('MVP')
    expect(html).not.toContain('%100')
  })

  it('the release moment of a module reads "{project}: {module} yayında", with a wave chip only when users came', () => {
    expect(releaseName(5, undefined, 'Davet sistemi')).toBe('Davet sistemi yayında')
    const m = { key: 1, kind: 'release' as const, project: 'Foo', level: 5, module: 'Davet sistemi', users: 120, mrr: 900 }
    expect(momentText(m)).toContain('Foo: Davet sistemi yayında')
    expect(momentText(m)).toContain('+120')
    expect(momentText({ ...m, users: 0 })).toBe('Foo: Davet sistemi yayında')
  })
})


describe('Projeler > Ata with no one to assign (F4)', () => {
  beforeEach(() => {
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    useGameStore.setState({ state: initial.state, ui: initial.ui })
  })
  const assign = (s: GameState): string => {
    useGameStore.setState({ state: s })
    return renderToStaticMarkup(createElement(AssignList, { project: s.projects[0]! }))
  }
  const solo = (): GameState => {
    const s = company(['web'], 0)
    s.employees = []
    for (const p of s.projects) {
      p.assignedIds = []
      delete p.leadId
    }
    return s
  }

  it('a solo founder sees themself coding on the project, one line and "İşe al", not a dead "Ekip yok"', () => {
    const html = assign(solo())
    expect(html).toContain('data-founder-row')
    expect(html).toContain(t('founder.you'))
    expect(html).toContain(t('projects.founderHere'))
    expect(html).toContain(t('projects.assignEmpty'))
    expect(html).toContain(t('team.hire'))
    expect(html).not.toContain(t('team.empty'))
    expect(html).not.toContain('aria-pressed')
  })

  it('the founder busy on an action reads "Şu an: …" instead of coding', () => {
    const s = solo()
    s.founder.currentAction = { kind: 'findUsers', startDay: s.time.day, endDay: s.time.day + 3 }
    const html = assign(s)
    expect(html).toContain(t('founder.busy', { action: t('founder.findUsers') }))
    expect(html).not.toContain(t('projects.founderHere'))
  })

  it('the card swaps "Ata" for "İşe al" while there is no builder', () => {
    useGameStore.setState({ state: solo() })
    const html = renderToStaticMarkup(createElement(ProjectsPanel))
    expect(html).toContain(t('team.hire'))
    expect(html).not.toContain(`>${t('projects.assign')}<`)
  })

  it('marketing / sales / ops are not listed: they add nothing to a project, so the hire line shows', () => {
    const s = company(['web'], 2)
    s.employees = s.employees.filter((e) => e.dept !== 'eng' && e.dept !== 'product')
    expect(s.employees.length).toBeGreaterThan(0)
    const html = assign(s)
    expect(html).not.toContain('aria-pressed')
    expect(html).toContain(t('projects.assignEmpty'))
  })

  it('a marketer already on the project (old save, bubble) stays listed so they can be taken off', () => {
    const s = company(['web'], 2)
    s.employees = s.employees.filter((e) => e.dept !== 'eng' && e.dept !== 'product')
    const m = s.employees[0]!
    for (const p of s.projects) p.assignedIds = []
    s.projects[0]!.assignedIds = [m.id]
    m.projectId = s.projects[0]!.id
    const html = assign(s)
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1)
    expect(html).toContain(m.name)
    const card = renderToStaticMarkup(createElement(ProjectsPanel))
    expect(card).toContain(`>${t('projects.assign')}<`)
  })

  it('a non-builder\'s detail offers no project to join, only the one they are on', () => {
    const s = company(['web', 'game'], 2)
    const m = s.employees.find((e) => e.dept !== 'eng' && e.dept !== 'product')!
    delete m.projectId
    for (const p of s.projects) p.assignedIds = p.assignedIds.filter((x) => x !== m.id)
    useGameStore.setState({ state: s })
    const detail = () => renderToStaticMarkup(createElement(DetailBody, { selection: { kind: 'employee', id: m.id } }))
    expect(detail()).not.toContain(t('detail.project'))
    m.projectId = s.projects[0]!.id
    s.projects[0]!.assignedIds.push(m.id)
    useGameStore.setState({ state: { ...s } })
    const html = detail()
    expect(html).toContain(s.projects[0]!.name)
    expect(html).not.toContain(s.projects[1]!.name)
  })

  it('a normal team still lists its builders under the founder, and the card keeps "Ata"', () => {
    const s = company(['web'], 2)
    const builders = s.employees.filter((e) => e.dept === 'eng' || e.dept === 'product').length
    expect(builders).toBeGreaterThan(0)
    const html = assign(s)
    expect((html.match(/aria-pressed/g) ?? []).length).toBe(builders)
    expect(html).not.toContain(t('projects.assignEmpty'))
    const card = renderToStaticMarkup(createElement(ProjectsPanel))
    expect(card).toContain(`>${t('projects.assign')}<`)
  })
})
