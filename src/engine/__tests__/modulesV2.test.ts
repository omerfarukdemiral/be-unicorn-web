// Modules v2 (MV2a): the catalogue, the version cycle, tiers / prerequisites / forks, synergies, caps, negative debt,
// the infra kind, the offer estimate, the measured effect and the loading of a round-2 save.
import { describe, expect, it, vi } from 'vitest'
import * as B from '../balance'
import { computeOutputs, recomputeDerived } from '../derive'
import { checkReleases, finishModule, freezeModuleMeasures, updateWave } from '../loop'
import {
  categoryModules,
  displayMaturity,
  MODULE_KINDS,
  MODULES,
  moduleDef,
  moduleError,
  moduleEstimate,
  moduleLock,
  moduleMeasured,
  moduleMult,
  moduleWork,
  projectSlots,
  projectVersion,
  updateSize,
  versionProgress,
  versionUpdates,
} from '../modules'
import { createRngState, Rng } from '../rng'
import { deserialize, serialize } from '../save'
import { PROJECT_CATEGORIES, PROJECT_MODULE_IDS, type GameState, type Project, type ProjectCategory, type ProjectModuleId } from '../types'
import { clone } from '../util'
import { api, build, company, content, withModules } from './moduleFixtures'

const OLD_IDS = ['feedback', 'referral', 'paywall', 'onboarding', 'analytics', 'freemium', 'openApi', 'localization', 'aiAssistant']

// MV2d tuned the module caps and the module wave tighter (see balance.ts); these tests check the formulas (boost,
// synergy, staleness, mix), so they run on the wide MV2a caps. The real caps have their own test (modulesCaps.test.ts).
vi.mock('../balance', async (orig) => ({
  ...(await orig<typeof import('../balance')>()),
  MODULE_MULT_CAP: { churn: 0.72, arpu: 1.3, organic: 1.45, cac: 0.8, tam: 1.4, wave: 1.8, updateWork: 0.7, talk: 2, infra: 0.75 },
}))

describe('catalogue', () => {
  it('65 ids: the 9 round-2 ids first, every id once, in PROJECT_MODULE_IDS order', () => {
    expect(PROJECT_MODULE_IDS).toHaveLength(65)
    expect(PROJECT_MODULE_IDS.slice(0, 9)).toEqual(OLD_IDS)
    expect(MODULES.map((m) => m.id)).toEqual([...PROJECT_MODULE_IDS])
  })

  it('a project sees 22–24 modules; every version up to the tier max has room to choose', () => {
    const want: Record<ProjectCategory, number> = { mobile: 22, web: 23, ai: 23, api: 24, game: 23, marketplace: 24 }
    for (const cat of PROJECT_CATEGORIES) {
      const list = categoryModules(cat)
      expect(list.length, cat).toBe(want[cat])
      // Cumulative options at v ≥ the slots v opens (3 × v), so a version is a choice, never a forced fill.
      for (let v = 1; v <= B.MODULE_TIER_MAX; v++) {
        expect(list.filter((m) => m.tier <= v).length, `${cat} v${v}`).toBeGreaterThan(B.MODULE_SLOTS_PER_VERSION * v)
      }
    }
  })

  it('relations point at real modules a project of that category can hold; prerequisites open no later; forks both ways', () => {
    for (const m of MODULES) {
      const cats = m.categories ?? PROJECT_CATEGORIES
      for (const r of m.requires ?? []) {
        const d = moduleDef(r)!
        expect(d, `${m.id} requires ${r}`).toBeDefined()
        expect(d.tier, `${m.id} requires ${r}`).toBeLessThanOrEqual(m.tier)
        for (const c of cats) expect(!d.categories || d.categories.includes(c), `${m.id} on ${c} needs ${r}`).toBe(true)
      }
      for (const x of m.synergies ?? []) {
        expect(moduleDef(x.with), `${m.id} synergy ${x.with}`).toBeDefined()
        // The synergy kind is one of its gains (else it would do nothing).
        expect(m.gains[x.kind], `${m.id} synergy kind ${x.kind}`).toBeDefined()
      }
      for (const e of m.excludes ?? []) expect(moduleDef(e)!.excludes, `${e} excludes ${m.id}`).toContain(m.id)
      expect(m.tier).toBeGreaterThanOrEqual(1)
      expect(m.tier).toBeLessThanOrEqual(B.MODULE_TIER_MAX)
    }
  })

  it('no free lunch: every module has a minus, upkeep, debt, size or a prerequisite', () => {
    for (const m of MODULES) expect(Boolean(m.minus || m.upkeep || m.debt > 0 || m.sizeAdd > 0 || m.requires?.length), m.id).toBe(true)
  })

  it('the round-2 nine keep their effects (onboarding upkeep 100 → 60 on purpose)', () => {
    expect(moduleDef('paywall')).toMatchObject({ gains: { arpu: 1.15 }, minus: { organic: 0.85, churn: 1.04 }, cashBase: 600, work: 0.1 })
    expect(moduleDef('openApi')).toMatchObject({ gains: { churn: 0.88, tam: 1.1 }, catBoost: { api: 1.5 }, debt: 3, sizeAdd: 2 })
    const s = company(['web'], 3)
    expect(moduleDef('onboarding')!.upkeep!(s, 1, 0)).toBe(60 * 8)
  })
})

describe('version cycle', () => {
  /** A web product just before its 1.0 ships. */
  const beforeOne = () => {
    const s = company(['web'], 2)
    const p = s.projects[0]!
    p.releaseLevel = 4
    delete p.version
    delete p.lineUpdates
    return s
  }
  /** One update ready and the gap passed, then the release check. */
  const shipUpdate = (s: GameState) => {
    const p = s.projects[0]!
    s.time.day += B.RELEASE_UPDATE_MIN_DAYS + 1
    p.updateProgress = updateSize(p, s.time.day)
    checkReleases(s, content)
    return s.releases!.at(-1)!
  }

  it('versionUpdates doubles from 2 and stops at 32', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(versionUpdates)).toEqual([2, 4, 8, 16, 32, 32, 32])
  })

  it('1.0 ships v1 with 3 slots; 2 updates make v2: bar back to 60%, 6 slots, modules fresh, a 2.5× wave', () => {
    const s = beforeOne()
    const p = s.projects[0]!
    expect(projectVersion({ ...p, maturity: 0.8 })).toBe(0)
    checkReleases(s, content)
    expect(p.version).toBe(1)
    expect(p.lineUpdates).toBe(0)
    expect(s.releases!.at(-1)).toMatchObject({ level: 5, version: 1 })
    expect(s.releases!.at(-1)!.minor).toBeUndefined()
    expect(s.activity.at(-1)!.kind).toBe('release')
    expect(projectSlots(s, p)).toEqual({ used: 0, total: 3 })
    expect(displayMaturity(s, p)).toBeCloseTo(B.VERSION_FLOOR, 12)

    // A stale module on it: the version release restamps it, and keeps its measurement.
    p.modules = [{ id: 'feedback', day: s.time.day - 600, base: { day: 3, acq: 1, lost: 0, rev: 0, rate: null } }]
    const minor = shipUpdate(s)
    expect(minor).toMatchObject({ version: 1, minor: 1, update: 1 })
    expect(p.version).toBe(1)
    expect(p.lineUpdates).toBe(1)
    expect(versionProgress(s, p)).toBeCloseTo(0.5, 12)
    expect(displayMaturity(s, p)).toBeCloseTo(0.8, 12)

    const users = s.stats.users
    s.time.day += B.RELEASE_UPDATE_MIN_DAYS + 1
    p.updateProgress = updateSize(p, s.time.day)
    const wave = Math.round(updateWave(s, p) * B.VERSION_WAVE_MULT)
    checkReleases(s, content)
    const major = s.releases!.at(-1)!
    expect(major).toMatchObject({ version: 2, update: 2, users: wave })
    expect(major.minor).toBeUndefined()
    expect(s.stats.users).toBe(users + wave)
    expect(p.version).toBe(2)
    expect(p.lineUpdates).toBe(0)
    expect(p.maturity).toBe(1)
    expect(displayMaturity(s, p)).toBeCloseTo(B.VERSION_FLOOR, 12)
    expect(projectSlots(s, p)).toEqual({ used: 1, total: 6 })
    expect(p.modules![0]!.day).toBe(s.time.day)
    expect(p.modules![0]!.base).toEqual({ day: 3, acq: 1, lost: 0, rev: 0, rate: null })
    expect(s.activity.at(-1)).toMatchObject({ kind: 'versionShipped', params: expect.objectContaining({ version: 2, users: wave }) })
    expect(s.events.at(-1)!.kind).toBe('release')

    // v2 → v3 takes 4 updates.
    for (let i = 1; i <= 3; i++) expect(shipUpdate(s)).toMatchObject({ version: 2, minor: i })
    expect(shipUpdate(s)).toMatchObject({ version: 3 })
    expect(projectSlots(s, p).total).toBe(9)
  })

  it('the gap and the work still gate updates; a module build pauses the line', () => {
    const s = beforeOne()
    checkReleases(s, content)
    const p = s.projects[0]!
    const n = s.releases!.length
    p.updateProgress = updateSize(p, s.time.day)
    checkReleases(s, content)
    expect(s.releases!.length).toBe(n)
    s.time.day += B.RELEASE_UPDATE_MIN_DAYS + 1
    p.updateProgress = updateSize(p, s.time.day) * 0.5
    checkReleases(s, content)
    expect(s.releases!.length).toBe(n)
    expect(p.lineUpdates).toBe(0)
  })

  it('an old save at 1.0 reads max(1, ceil(modules / 3)) and the first check stores it', () => {
    const s = company(['web'], 4)
    const p = s.projects[0]!
    delete p.version
    expect(projectVersion(p)).toBe(1)
    p.modules = (['feedback', 'referral', 'analytics', 'onboarding'] as ProjectModuleId[]).map((id) => ({ id, day: 0 }))
    expect(projectVersion(p)).toBe(2)
    checkReleases(s, content)
    expect(p.version).toBe(2)
    expect(p.lineUpdates).toBe(0)
  })
})

describe('unlocks: tier, prerequisites, forks', () => {
  const at = (cat: ProjectCategory, v: number, ids: ProjectModuleId[] = []) => {
    const s = withModules(company([cat], 3), 0, ids)
    s.projects[0]!.version = v
    return s
  }
  const err = (s: GameState, id: ProjectModuleId) => moduleError(s, s.projects[0], id)

  it('a tier opens at its version', () => {
    const s = at('web', 1)
    expect(err(s, 'onboarding')).toBe('notUnlocked')
    expect(moduleLock(s, s.projects[0]!, 'onboarding')).toEqual({ kind: 'version', v: 2 })
    s.projects[0]!.version = 2
    expect(err(s, 'onboarding')).toBeNull()
    expect(moduleLock(s, s.projects[0]!, 'onboarding')).toBeNull()
  })

  it('a prerequisite must be installed: A/B testi needs Analitik; Turnuva needs both', () => {
    const s = at('web', 3)
    expect(err(s, 'abTest')).toBe('notUnlocked')
    expect(moduleLock(s, s.projects[0]!, 'abTest')).toEqual({ kind: 'requires', ids: ['analytics'] })
    expect(err(at('web', 3, ['analytics']), 'abTest')).toBeNull()
    const g = at('game', 5, ['leaderboard'])
    expect(moduleLock(g, g.projects[0]!, 'esports')).toEqual({ kind: 'requires', ids: ['guilds'] })
    expect(err(at('game', 5, ['leaderboard', 'guilds']), 'esports')).toBeNull()
  })

  it('forks: paywall ↔ freemium, paywall ↔ usagePricing (invalid, named by moduleLock)', () => {
    const s = at('api', 3, ['paywall'])
    expect(err(s, 'usagePricing')).toBe('invalid')
    expect(moduleLock(s, s.projects[0]!, 'usagePricing')).toEqual({ kind: 'excluded', by: 'paywall' })
    const u = at('ai', 3, ['usagePricing'])
    expect(err(u, 'paywall')).toBe('invalid')
    expect(moduleLock(u, u.projects[0]!, 'paywall')).toEqual({ kind: 'excluded', by: 'usagePricing' })
  })

  it('other categories\' modules are invalid (SSO is not for games), and the order stays: invalid before notUnlocked', () => {
    expect(err(at('web', 5), 'watchApp')).toBe('invalid')
    expect(err(at('game', 5, ['security']), 'sso')).toBe('invalid')
    expect(err(at('web', 5, ['security']), 'sso')).toBeNull()
    expect(err(at('web', 1, ['paywall']), 'freemium')).toBe('invalid')
  })

  it('an installed module above the version still refreshes (old saves)', () => {
    const s = at('ai', 1, ['aiAssistant'])
    expect(moduleError(s, s.projects[0], 'aiAssistant', true)).toBeNull()
  })
})

describe('synergies', () => {
  const p = (cat: ProjectCategory, ids: ProjectModuleId[], day = 0): Project => ({ id: 'p', category: cat, modules: ids.map((id) => ({ id, day })) }) as Project

  it('the gain of the module that lists it: 1 + (x − 1)(1 + k); the partner itself does not change', () => {
    expect(moduleMult(p('web', ['referral']), 'organic', 0)).toBeCloseTo(1.22, 12)
    expect(moduleMult(p('web', ['referral', 'onboarding']), 'organic', 0)).toBeCloseTo(1 + 0.22 * 1.5, 12)
    // onboarding lists referral (churn +0.3); referral has no churn gain.
    expect(moduleMult(p('web', ['onboarding']), 'churn', 0)).toBeCloseTo(0.9, 12)
    expect(moduleMult(p('web', ['referral', 'onboarding']), 'churn', 0)).toBeCloseTo(1 - 0.1 * 1.3, 12)
  })

  it('two partners add their k; the category boost comes first; staleness fades the boosted gain', () => {
    // openApi on web with integrations: churn 1 − 0.12 × 1.5, integrations' own churn 1 − 0.08 × 1.5.
    expect(moduleMult(p('web', ['openApi', 'integrations']), 'churn', 0)).toBeCloseTo((1 - 0.12 * 1.5) * (1 - 0.08 * 1.5), 12)
    // referral on a game: (1.308 − 1) × 1.5 = 1.462, held at the organic cap; half of the gain at full staleness.
    const g = p('game', ['referral', 'onboarding'])
    expect(moduleMult(g, 'organic', 0)).toBe(B.MODULE_MULT_CAP.organic)
    g.modules![0]!.day = -B.MODULE_STALE_DAYS
    expect(moduleMult(g, 'organic', 0)).toBeCloseTo(1 + 0.308 * 1.5 * B.MODULE_STALE_FLOOR, 12)
  })

  it('updateWork synergy (Otomatik test + Geri bildirim): a floor kind, cicd .85 → .775', () => {
    expect(moduleMult(p('web', ['cicd']), 'updateWork', 0)).toBeCloseTo(0.85, 12)
    // feedback's own minus 1.25 stays.
    expect(moduleMult(p('web', ['cicd', 'feedback']), 'updateWork', 0)).toBeCloseTo((1 - 0.15 * 1.5) * 1.25, 12)
  })
})

describe('caps', () => {
  it('any set of a category\'s modules stays inside MODULE_MULT_CAP (all nine kinds), finite', () => {
    const rng = new Rng(createRngState(7))
    for (const cat of PROJECT_CATEGORIES) {
      const ids = categoryModules(cat).map((m) => m.id)
      for (let t = 0; t < 200; t++) {
        const q = { id: 'p', category: cat, modules: ids.filter(() => rng.next() < 0.6).map((id) => ({ id, day: -rng.int(0, 900) })) } as Project
        for (const kind of MODULE_KINDS) {
          const v = moduleMult(q, kind, 0)
          const cap = B.MODULE_MULT_CAP[kind]!
          expect(Number.isFinite(v)).toBe(true)
          if (B.MODULE_MULT_FLOOR_KINDS.includes(kind)) expect(v).toBeGreaterThanOrEqual(cap)
          else expect(v).toBeLessThanOrEqual(cap)
        }
      }
    }
  })

  it('every kind has a cap; updateWork and infra are floors', () => {
    for (const kind of MODULE_KINDS) expect(B.MODULE_MULT_CAP[kind], kind).toBeDefined()
    expect(B.MODULE_MULT_FLOOR_KINDS).toEqual(['churn', 'cac', 'updateWork', 'infra'])
  })
})

describe('negative debt and infra', () => {
  it('Güvenlik denetimi pays 4 debt off, never under 0; Otomatik test 1', () => {
    for (const [id, before, after] of [['security', 2, 0], ['security', 9, 5], ['cicd', 3, 2], ['cicd', 0, 0], ['openApi', 1, 4]] as [ProjectModuleId, number, number][]) {
      const s = company(['web'], 3)
      s.techDebt = before
      finishModule(s, s.projects[0]!, { id, progress: 1, startDay: 0 })
      expect(s.techDebt, id).toBe(after)
    }
  })

  it('an infra module scales the servers (not the upkeep) through the share-weighted mix', () => {
    const one = company(['ai'], 4)
    const o = computeOutputs(one, content)
    const servers = one.finance.burnBreakdown.infra - o.fx.upkeep
    const routed = withModules(one, 0, ['modelRouter'])
    expect(routed.finance.burnBreakdown.infra - o.fx.upkeep).toBeCloseTo(servers * 0.85, 6)
    // Two products with equal users: half the effect.
    const two = company(['ai', 'web'], 4)
    for (const q of two.projects) q.users = two.stats.users / 2
    recomputeDerived(two, content)
    const o2 = computeOutputs(two, content)
    const servers2 = two.finance.burnBreakdown.infra - o2.fx.upkeep
    const half = withModules(two, 0, ['modelRouter'])
    expect(half.finance.burnBreakdown.infra - o2.fx.upkeep).toBeCloseTo(servers2 * (0.85 + 1) / 2, 6)
  })
})

describe('moduleEstimate', () => {
  const est = (s: GameState, id: ProjectModuleId, i = 0) => moduleEstimate(s, s.projects[i]!, id, content)

  it('signs: paywall earns MRR and costs users; analytics brings paid users and a bill; a router saves infra; localization widens the market', () => {
    const web = company(['web'], 3)
    const pay = est(web, 'paywall')
    expect(pay.mrr).toBeGreaterThan(0)
    expect(pay.users).toBeLessThan(0)
    const an = est(web, 'analytics')
    expect(an.users).toBeGreaterThan(0)
    expect(an.upkeep).toBe(150 * 8)
    expect(an.net).toBeCloseTo(an.users * web.stats.arpu + an.mrr + an.infra - an.upkeep, 9)
    const ai = company(['ai'], 3)
    expect(est(ai, 'modelRouter').infra).toBeGreaterThan(0)
    expect(est(ai, 'voiceMode').infra).toBeLessThan(0)
    expect(est(web, 'localization').tam).toBeGreaterThan(0)
    expect(est(web, 'feedback').wave).toBeGreaterThan(0)
  })

  it('pure and memoized: the state is untouched, the same call gives the same object', () => {
    const s = company(['web', 'game'], 3)
    const snap = JSON.stringify(s)
    const a = est(s, 'analytics', 1)
    expect(JSON.stringify(s)).toBe(snap)
    expect(est(s, 'analytics', 1)).toBe(a)
    // A changed state (a new budget) is not served from the memo.
    s.finance.adBudget *= 2
    expect(est(s, 'analytics', 1)).not.toBe(a)
  })

  it('an installed module reads as what it does now (the slot\'s infra line)', () => {
    const ai = withModules(company(['ai'], 3), 0, ['modelRouter'])
    const now = est(ai, 'modelRouter')
    expect(now.infra).toBeGreaterThan(0)
    expect(now.infra).toBeCloseTo(est(company(['ai'], 3), 'modelRouter').infra, 6)
  })

  it('zero: no ads for a CAC module, a capped kind, a product with no users', () => {
    const s = company(['web'], 3)
    s.finance.adBudget = 0
    recomputeDerived(s, content)
    expect(est(s, 'landingPages').zero).toBe('noAds')
    // organic at its cap on a mobile product: the store page adds nothing.
    const m = withModules(company(['mobile'], 3), 0, ['referral', 'freemium'])
    expect(moduleMult(m.projects[0]!, 'organic', m.time.day)).toBe(B.MODULE_MULT_CAP.organic)
    const aso = est(m, 'aso')
    expect(aso.zero).toBe('capped')
    expect(Math.abs(aso.users)).toBeLessThan(0.5)
    // Two products, the second holds no users.
    const two = company(['web', 'mobile'], 3)
    two.projects[0]!.users = two.stats.users
    two.projects[1]!.users = 0
    two.finance.adBudget = 0
    recomputeDerived(two, content)
    expect(est(two, 'paywall', 1).zero).toBe('noUsers')
    expect(est(company(['web'], 3), 'paywall').zero).toBeUndefined()
  })

  it('synergy chip: the partner and the extra points ("Onboarding ile +%11"), an installed partner first', () => {
    const s = company(['web'], 3)
    expect(est(s, 'referral').synergy).toEqual({ with: 'onboarding', pct: 11 })
    // openApi lists webhooks (api only) and integrations (web): on web only integrations is offered.
    expect(est(s, 'openApi').synergy).toEqual({ with: 'integrations', pct: 6 })
    const both = company(['api'], 3)
    expect(est(both, 'openApi').synergy?.with).toBe('webhooks')
    expect(est(s, 'security').synergy).toBeUndefined()
  })
})

describe('measured effect', () => {
  const live = () => {
    const s = company(['web'], 3)
    const p = s.projects[0]!
    const day = Math.floor(s.time.day)
    p.acq = 100
    p.lost = 10
    p.rev = 500
    p.snaps = [
      { day: day - 40, acq: 60, lost: 6, rev: 300 },
      { day: day - 10, acq: 90, lost: 9, rev: 450 },
    ]
    return { s, p, day }
  }

  it('the base: counters now and the 30-day rate from the oldest snapshot ≥ 20 days old', () => {
    const { s, p, day } = live()
    finishModule(s, p, { id: 'seo', progress: 1, startDay: 0 })
    expect(p.modules![0]!.base).toEqual({ day, acq: 100, lost: 10, rev: 500, rate: { acq: 30, lost: 3, rev: 150 } })
    // Only a young snapshot: no rate.
    const young = live()
    young.p.snaps = [young.p.snaps![1]!]
    finishModule(young.s, young.p, { id: 'seo', progress: 1, startDay: 0 })
    expect(young.p.modules![0]!.base!.rate).toBeNull()
  })

  it('live for 30 days, then frozen; a refresh keeps the base', () => {
    const { s, p, day } = live()
    finishModule(s, p, { id: 'seo', progress: 1, startDay: 0 })
    const m = p.modules![0]!
    expect(moduleMeasured(s, p, m)).toEqual({ phase: 'live', days: 0, delta: { acq: 0, lost: 0, rev: 0 }, before: { acq: 30, lost: 3, rev: 150 } })
    s.time.day = day + 12
    p.acq = 127
    p.lost = 12
    p.rev = 800
    freezeModuleMeasures(s)
    expect(m.after).toBeUndefined()
    expect(moduleMeasured(s, p, m)).toMatchObject({ phase: 'live', days: 12, delta: { acq: 27, lost: 2, rev: 300 } })
    s.time.day = day + 30
    freezeModuleMeasures(s)
    expect(m.after).toEqual({ acq: 127, lost: 12, rev: 800 })
    p.acq = 400
    s.time.day = day + 90
    expect(moduleMeasured(s, p, m)).toMatchObject({ phase: 'frozen', days: 30, delta: { acq: 27, lost: 2, rev: 300 } })
    finishModule(s, p, { id: 'seo', progress: 1, startDay: 0, refresh: true })
    expect(m.base!.day).toBe(day)
    expect(m.after).toEqual({ acq: 127, lost: 12, rev: 800 })
    // A module from before MV2a has nothing to show.
    expect(moduleMeasured(s, p, { id: 'paywall', day: 0 })).toBeNull()
  })

  it('end to end: a build delivered by the clock carries a base, and 30 days later an after', () => {
    let s = build(company(['web'], 2), 0, 'paywall').state
    for (let d = 0; d < 200 && s.projects[0]!.build; d++) s = api.step(s, 1)
    const m = s.projects[0]!.modules!.find((x) => x.id === 'paywall')!
    expect(m.base).toBeDefined()
    expect(m.after).toBeUndefined()
    s = api.step(s, 31)
    const m2 = s.projects[0]!.modules!.find((x) => x.id === 'paywall')!
    expect(m2.after).toBeDefined()
    expect(m2.after!.acq).toBeGreaterThanOrEqual(m2.base!.acq)
  })
})

describe('a round-2 save (§1.6)', () => {
  /** A Series B company saved before MV2a: 4 modules, no version fields, no measurement, the old prompt flag. */
  const roundTwo = (buildId?: ProjectModuleId) => {
    const s = withModules(company(['web', 'mobile'], 4), 0, ['feedback', 'referral', 'analytics', 'onboarding'], 10)
    const raw = JSON.parse(serialize(s)) as { version: number; state: GameState }
    for (const p of raw.state.projects) {
      delete p.version
      delete p.lineUpdates
      p.updateProgress = 0
    }
    raw.state.flags[`modulePrompt:${raw.state.projects[0]!.id}`] = 4
    if (buildId) raw.state.projects[1]!.build = { id: buildId, progress: 0, startDay: 5 }
    return deserialize(JSON.stringify(raw))!
  }

  it('4 modules at Series B read as v2 with 4/6 slots and the bar at 60%; 30 days step cleanly', () => {
    const s = roundTwo()
    const p = s.projects[0]!
    expect(projectVersion(p)).toBe(2)
    expect(projectSlots(s, p)).toEqual({ used: 4, total: 6 })
    expect(displayMaturity(s, p)).toBeCloseTo(0.6, 12)
    expect(projectVersion(s.projects[1]!)).toBe(1)
    const later = api.step(s, 30)
    expect(later.gameOver).toBeUndefined()
    expect(later.projects[0]!.version).toBe(2)
    expect(later.projects[0]!.modules!.map((m) => m.id)).toEqual(['feedback', 'referral', 'analytics', 'onboarding'])
    for (const v of [later.stats.users, later.stats.cash, later.finance.mrr, later.finance.burn]) expect(Number.isFinite(v)).toBe(true)
  })

  it('a running build of an old id above the version still delivers', () => {
    const s = roundTwo('aiAssistant')
    const q = s.projects[1]!
    expect(projectVersion(q)).toBe(1)
    q.build!.progress = moduleWork(q, moduleDef('aiAssistant')!)
    const later = api.step(s, 2)
    expect(later.projects[1]!.build).toBeUndefined()
    expect(later.projects[1]!.modules!.map((m) => m.id)).toEqual(['aiAssistant'])
    expect(later.releases!.some((r) => r.module === 'aiAssistant')).toBe(true)
  })

  it('3 modules and a running 4th build (legal at stage 5–6 before MV2a) read as v2, so the build fits once it lands', () => {
    const s0 = withModules(company(['web'], 5), 0, ['feedback', 'referral', 'analytics'], 10)
    const raw = JSON.parse(serialize(s0)) as { version: number; state: GameState }
    const rp = raw.state.projects[0]!
    delete rp.version
    delete rp.lineUpdates
    rp.updateProgress = 0
    rp.build = { id: 'onboarding', progress: 0, startDay: 5 }
    const s = deserialize(JSON.stringify(raw))!
    const p = s.projects[0]!
    expect(projectVersion(p)).toBe(2)
    expect(projectSlots(s, p)).toEqual({ used: 4, total: 6 })
    let later = api.step(s, 1)
    expect(later.projects[0]!.version).toBe(2)
    later.projects[0]!.build!.progress = moduleWork(later.projects[0]!, moduleDef('onboarding')!)
    later = api.step(later, 2)
    const q = later.projects[0]!
    expect(q.build).toBeUndefined()
    expect(q.modules!.map((m) => m.id)).toEqual(['feedback', 'referral', 'analytics', 'onboarding'])
    expect(projectSlots(later, q)).toEqual({ used: 4, total: 6 })
  })

  it('serialize round-trips the new fields', () => {
    const s = roundTwo()
    s.projects[0]!.version = 3
    s.projects[0]!.lineUpdates = 2
    s.projects[0]!.modules![0]!.base = { day: 4, acq: 10, lost: 1, rev: 20, rate: { acq: 1.5, lost: 0, rev: 2 } }
    s.projects[0]!.modules![0]!.after = { acq: 30, lost: 2, rev: 60 }
    expect(deserialize(serialize(s))).toEqual(clone(s))
  })
})
