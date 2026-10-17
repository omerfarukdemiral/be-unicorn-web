// MV2c: the module UI's numbers as chips and lines (design §2): the estimate chip unit, "Kira kazançtan büyük", "Şu an
// etkisi yok", the measured line's phases, the version line, release labels, the shared founder cost, the card's
// version badge and bar, the folded list's tier groups, and the version release as an important moment.
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { company } from '../../engine/__tests__/moduleFixtures'
import { MODULES, moduleEstimate, moduleOffers, type ModuleEstimate } from '../../engine/modules'
import { horizon } from '../../engine/loopSelectors'
import { recomputeDerived } from '../../engine/derive'
import { CONTENT } from '../../content'
import { hasImportantMoment, useGameStore } from '../../store/gameStore'
import type { GameState, ReleaseEntry } from '../../engine/types'
import { clone } from '../../engine/util'
import { t } from '../i18n'
import { releaseName } from '../loopUi'
import { momentText } from '../Moments'
import { TierGroups } from './ModulesSection'
import { ProjectsPanel } from './ProjectsPanel'
import { buildChips, exclusionChip, founderBuildCost, measuredLine, previewLine, rentChip, versionLine } from './moduleView'

const est = (over: Partial<ModuleEstimate>): ModuleEstimate => ({ users: 0, mrr: 0, infra: 0, tam: 0, wave: 0, upkeep: 0, net: 0, ...over })

describe('offer chips (estimate)', () => {
  it('the headline gain is a count a month or dollars a month, with the percent only in the title', () => {
    const s = company(['web'], 3)
    const p = s.projects[0]!
    const offer = moduleOffers(s, p).find((o) => o.id === 'paywall')!
    const chips = buildChips(s, p, offer)
    const gain = chips[0]!
    expect(gain.text).toMatch(/^≈ [+−]\S+ kullanıcı\/ay$|^≈ [+−]\$\S+\/ay$/)
    expect(gain.good).toBe(true)
    expect(gain.title).toContain('%')
    // cost chip: cash and days
    expect(chips.some((c) => c.icon === 'cash')).toBe(true)
  })

  it('"Kira kazançtan büyük" when the upkeep outweighs the gain; plain "Kira" otherwise', () => {
    const s = company(['web'], 2)
    s.stats.arpu = 1
    const big = rentChip(s, est({ users: 7, upkeep: 200 }), 'x')!
    expect(big.text).toBe(t('module.est.rentBig'))
    expect(big.tail).toContain('200')
    expect(big.good).toBe(false)
    const ok = rentChip(s, est({ mrr: 900, upkeep: 200 }), 'x')!
    expect(ok.text).toBe(t('module.est.rent', { v: '$200' }))
    expect(rentChip(s, est({ mrr: 900 }), 'x')).toBeNull()
  })

  it('a lever at zero reads "Şu an etkisi yok" with its reason', () => {
    const s = company(['web'], 3)
    s.finance.adBudget = 0
    recomputeDerived(s, CONTENT)
    const p = s.projects[0]!
    const cac = MODULES.find((m) => m.categories === undefined && Object.keys(m.gains).join() === 'cac') ?? MODULES.find((m) => m.gains.cac !== undefined && moduleEstimate(s, p, m.id, CONTENT).zero === 'noAds')
    expect(cac).toBeDefined()
    const offer = moduleOffers(s, p).find((o) => o.id === cac!.id)!
    const first = buildChips(s, p, offer)[0]!
    expect(first.text).toBe(t('module.est.none'))
    expect(first.tail).toBe(t('module.est.why.noAds'))
    expect(first.good).toBeNull()
  })

  it('the desk bubble leaves the synergy chip out (a fork is the only fourth)', () => {
    const s = company(['web'], 3)
    const p = s.projects[0]!
    for (const o of moduleOffers(s, p)) {
      if (o.refresh || o.error) continue
      const chips = buildChips(s, p, o, false)
      expect(chips.length).toBeLessThanOrEqual(exclusionChip(p, o.id) ? 4 : 3)
    }
  })

  it('a build that shuts a module says so before the build, on the card and in the bubble (B2 review)', () => {
    const s = company(['mobile'], 1)
    const p = s.projects[0]!
    const offer = moduleOffers(s, p).find((o) => o.id === 'paywall')!
    // Both sides of the fork open at v1: the category's own seller sits next to Paywall (it opened at v2 before).
    for (const [cat, seller] of [['mobile', 'inAppPurchase'], ['game', 'shop'], ['marketplace', 'promotedListings']] as const) {
      const c = company([cat], 1)
      const o = moduleOffers(c, c.projects[0]!).find((x) => x.id === seller)
      expect(o && !o.refresh && o.error === null, seller).toBe(true)
    }
    const fork = t('module.rel.excluded', { module: 'Freemium, Uygulama içi satın alma' })
    for (const withRelation of [true, false]) {
      const chip = buildChips(s, p, offer, withRelation).find((c) => c.icon === 'lock')!
      expect(chip.text).toBe(fork)
      expect(chip.good).toBe(false)
    }
    // Only the modules of this catalogue: a game Paywall names the Shop, never the mobile In-app purchase.
    const g = company(['game'], 1)
    expect(exclusionChip(g.projects[0]!, 'paywall')!.text).toBe(t('module.rel.excluded', { module: 'Freemium, Oyun içi mağaza' }))
    // The other side of the fork names Paywall; a module that shuts nothing has no fork chip.
    expect(exclusionChip(p, 'inAppPurchase')!.text).toBe(t('module.rel.excluded', { module: 'Paywall' }))
    expect(exclusionChip(p, 'aso')).toBeNull()
  })
})

describe('measured line', () => {
  const setup = (days: number, frozen: boolean, rate: boolean) => {
    const s = company(['web'], 3)
    s.time.day = 100
    const p = s.projects[0]!
    p.acq = 150
    const m = { id: 'referral' as const, day: 100 - days, base: { day: 100 - days, acq: 123, lost: 0, rev: 0, rate: rate ? { acq: 11, lost: 0, rev: 0 } : null }, ...(frozen ? { after: { acq: 150, lost: 0, rev: 0 } } : {}) }
    p.modules = [m]
    return { s, p, m }
  }
  it('three phases: nothing without a base, live "Son 12g", frozen "İlk 30g"', () => {
    const { s, p, m } = setup(12, false, true)
    expect(measuredLine(s, p, { id: m.id, day: m.day })).toBeNull()
    const live = measuredLine(s, p, m)!
    expect(live.text).toBe('Son 12g: +27 kullanıcı (öncesi +11/30g)')
    expect(live.good).toBe(true)
    const f = setup(40, true, true)
    expect(measuredLine(f.s, f.p, f.m)!.text).toBe('İlk 30g: +27 kullanıcı (öncesi +11)')
  })
  it('a product too young for a rate drops "öncesi" and stays grey', () => {
    const { s, p, m } = setup(12, false, false)
    const l = measuredLine(s, p, m)!
    expect(l.text).toBe('Son 12g: +27 kullanıcı')
    expect(l.good).toBeNull()
  })
  it('worse than before is red', () => {
    const { s, p, m } = setup(15, false, true)
    m.base.rate!.acq = 80
    expect(measuredLine(s, p, m)!.good).toBe(false)
  })
})

describe('version line, labels, cost', () => {
  it('v1 reads "v2 hazırlanıyor · %60" (one version on the card: the badge v1, the line the next); a running build names itself with its days', () => {
    const s = company(['web'], 2)
    s.projects[0]!.version = 1
    s.projects[0]!.lineUpdates = 0
    expect(versionLine(s, s.projects[0]!)).toBe('v2 hazırlanıyor · %60')
    s.projects[0]!.lineUpdates = 1
    expect(versionLine(s, s.projects[0]!)).toBe('v2 hazırlanıyor · %80')
    expect(previewLine({ ...s.projects[0]!, maturity: 0.83 })).toBe('v1 · 3 slot açılır · %83')
  })

  it('release labels: MVP, v0.4, v0.6, v0.8, v1, v1.1, v2', () => {
    expect([1, 2, 3, 4].map((l) => releaseName(l))).toEqual(['MVP', 'v0.4', 'v0.6', 'v0.8'])
    expect(releaseName(5, undefined, undefined, 1)).toBe('v1')
    expect(releaseName(5, 1, undefined, 1, 1)).toBe('v1.1')
    expect(releaseName(5, 2, undefined, 2)).toBe('v2')
    expect(releaseName(5, 3)).toBe('güncelleme 3')
  })

  it('a version release moment says the new slots', () => {
    const m = { key: 1, kind: 'release' as const, project: 'Foo', level: 5, update: 2, version: 2, users: 300, mrr: 900 }
    expect(momentText(m)).toContain('Foo v2 yayında · +3 slot')
  })

  it('the founder cost is one move, or energy in the garage: the panel button and the bubble read the same helper', () => {
    const garage = company(['web'], 0)
    expect(founderBuildCost(garage)).toEqual({ icon: 'bolt', text: '10' })
    const seed = company(['web'], 2)
    seed.derived.moves = { left: 3, max: 3 } as never
    expect(founderBuildCost(seed)).toEqual({ icon: 'flag', text: '1' })
  })
})

describe('project card and lists', () => {
  const initial = useGameStore.getState()
  // react-dom/server reads a store's initial state (useSyncExternalStore's server snapshot): read the live one instead.
  beforeEach(() => {
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())
    useGameStore.setState({ state: company(['web'], 2) })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    useGameStore.setState({ state: initial.state, ui: initial.ui })
  })

  it('a finished card wears its version badge and the version bar; an unfinished live one the preview', () => {
    const s = clone(useGameStore.getState().state)
    s.projects[0]!.version = 2
    s.projects[0]!.lineUpdates = 1
    useGameStore.setState({ state: s })
    const html = renderToStaticMarkup(createElement(ProjectsPanel))
    expect(html).toContain('data-version-badge=""')
    expect(html).toContain('>v2<')
    expect(html).toContain('data-version-bar=""')
    expect(html).toContain('v3 hazırlanıyor · %')
    expect(html).toContain('data-slot-count=""')
    expect(html).toContain('0/6')
    const u = clone(s)
    u.projects[0]!.maturity = 0.83
    useGameStore.setState({ state: u })
    const pre = renderToStaticMarkup(createElement(ProjectsPanel))
    expect(pre).toContain('data-version-preview=""')
    expect(pre).toContain('v1 · 3 slot açılır · %83')
  })

  it('the folded list groups modules by tier', () => {
    const s = clone(useGameStore.getState().state)
    useGameStore.setState({ state: s })
    const p = s.projects[0]!
    const rest = moduleOffers(s, p).filter((o) => !o.refresh && o.error !== 'invalid')
    const html = renderToStaticMarkup(createElement(TierGroups, { project: p, rest, onDone: () => {} }))
    expect(html).toContain('data-tier="1"')
    expect(html).toContain(t('module.allTier', { v: 1 }))
    expect(html).toContain('data-tier="2"')
  })
})

describe('important moments', () => {
  const rel = (over: Partial<ReleaseEntry>): ReleaseEntry => ({ id: 'r1', day: 5, projectId: 'p', projectName: 'P', level: 5, users: 10, mrr: 0, ...over })
  const next = (r: ReleaseEntry): GameState => ({ events: [{ id: 1, kind: 'release', refId: r.id, day: 5 }], releases: [r], finance: {} }) as unknown as GameState
  const prev = { events: [] } as unknown as GameState
  it('a version release slows 4x down, a minor update does not', () => {
    expect(hasImportantMoment(prev, next(rel({ update: 2, version: 2 })))).toBe(true)
    expect(hasImportantMoment(prev, next(rel({ update: 1, version: 1, minor: 1 })))).toBe(false)
    expect(hasImportantMoment(prev, next(rel({ module: 'feedback' })))).toBe(true)
  })
})

describe('horizon', () => {
  it('names the next update by its version and the line-filling one as the next version', () => {
    const s = company(['web'], 2)
    const p = s.projects[0]!
    p.version = 1
    p.lineUpdates = 0
    s.derived.maturityPerDay = { [p.id]: 5 }
    const items = horizon(s).filter((h) => h.kind === 'release')
    expect(items[0]).toMatchObject({ version: 1, minor: 1 })
    const last = items.find((h) => h.version === 2 && h.minor === undefined)
    expect(last).toBeDefined()
  })
})
