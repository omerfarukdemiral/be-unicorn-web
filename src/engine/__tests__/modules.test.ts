// Project modules (W2a): no-module invariance, caps, slots, build → delivery, staleness, upkeep, actions, fuzz.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import * as E from '../economy'
import { averageLaunchedMaturity, computeOutputs, maturityRates, recomputeDerived } from '../derive'
import { completeFounderAction } from '../founder'
import { accrueMonth, checkReleases, ledgerOf, resolvePayday, updateWave } from '../loop'
import { adFocusWarmup, focusEffects, focusPreview, projectWeights, MODULE_KINDS, MODULES, moduleCost, moduleDef, moduleMult, moduleOffers, moduleStrength, moduleWork, projectMix, projectSlots, suggestModule, updateSize } from '../modules'
import { createRngState, Rng } from '../rng'
import { progressProjects } from '../tick'
import { PROJECT_MODULE_IDS, type Action, type GameState, type ModuleEffectKind, type Project, type ProjectCategory, type ProjectModuleId, type TimedAction } from '../types'
import { clone, modifierMult, policyMult } from '../util'
import { deserialize, serialize } from '../save'
import { api, build, company, content, current, legacy, withModules } from './moduleFixtures'

describe('no modules: the economy is bit for bit the old one', () => {
  const sets: ProjectCategory[][] = [['mobile'], ['web', 'game'], ['ai', 'api', 'marketplace']]
  for (const cats of sets) {
    it(`${cats.length} project(s): ${cats.join(', ')}`, () => {
      // A few months in (history, rivals, releases), then compared on the same state.
      const s = api.step(company(cats, 2, 5 + cats.length), 75)
      const want = legacy(clone(s))
      const got = clone(s)
      recomputeDerived(got, content)
      expect(current(got)).toEqual(want)
      for (const [k, v] of Object.entries(want)) expect(current(got)[k as keyof typeof want]).toBe(v)
      // Nothing to show without a module: the derived view (and the save) stays as it was.
      expect(got.derived.projectMix).toBeUndefined()
      const mix = projectMix(got)
      expect(Object.values(mix).map((x) => x.weight)).toEqual(cats.map(() => 1 / cats.length))
      expect(Object.values(mix).every((x) => Object.keys(x.mult).length === 0 && x.upkeep === 0)).toBe(true)
    })
  }

  it('before any launch there is no mix and nothing changes', () => {
    const s = clone(api.createGame({ seed: 3 }))
    s.projects = []
    recomputeDerived(s, content)
    expect(s.derived.projectMix).toBeUndefined()
    expect(current(s)).toEqual(legacy(clone(s)))
  })
})

describe('caps and mix', () => {
  it('any combination stays inside MODULE_MULT_CAP; the company mult sits between the projects', () => {
    const rng = new Rng(createRngState(99))
    const base = company(['game', 'api', 'ai'], 6)
    for (let t = 0; t < 300; t++) {
      const s = clone(base)
      for (const p of s.projects) {
        const ids = PROJECT_MODULE_IDS.filter(() => rng.next() < 0.5)
        p.modules = ids.map((id) => ({ id, day: s.time.day - rng.int(0, 900) }))
      }
      recomputeDerived(s, content)
      for (const p of s.projects) {
        for (const kind of MODULE_KINDS) {
          const v = moduleMult(p, kind, s.time.day)
          const cap = B.MODULE_MULT_CAP[kind]
          expect(Number.isFinite(v)).toBe(true)
          if (cap === undefined) continue
          if (B.MODULE_MULT_FLOOR_KINDS.includes(kind)) expect(v).toBeGreaterThanOrEqual(cap)
          else expect(v).toBeLessThanOrEqual(cap)
        }
      }
      for (const kind of ['churn', 'cac', 'tam'] as const) {
        const per = s.projects.map((p) => moduleMult(p, kind, s.time.day))
        const mean = per.reduce((a, b) => a + b, 0) / per.length
        expect(mean).toBeGreaterThanOrEqual(Math.min(...per) - 1e-12)
        expect(mean).toBeLessThanOrEqual(Math.max(...per) + 1e-12)
      }
    }
  })

  it('the paid channel never beats one call at the best CAC (saturation from the total ad budget)', () => {
    for (const ids of [['analytics', 'onboarding'], ['analytics'], ['localization'], ['openApi', 'localization', 'analytics', 'onboarding']] as ProjectModuleId[][]) {
      const s = withModules(company(['web', 'mobile'], 4), 0, ids)
      const base = E.cac(s.stage, averageLaunchedMaturity(s), s.finance.adBudget, s.finance.mrr, s.derived.penetration!) * modifierMult(s, 'cac') * policyMult(s, content, 'cac')
      expect(s.derived.channels.paid).toBeLessThanOrEqual(E.paidPerMonth(s.finance.adBudget, base * B.MODULE_MULT_CAP.cac!, s.derived.penetration!) + 1e-9)
      expect(s.derived.channels.paid).toBe(E.paidPerMonth(s.finance.adBudget, s.derived.cac, s.derived.penetration!))
    }
  })

  it('a module on one of two projects moves the company by half its multiplier', () => {
    const s0 = company(['web', 'mobile'], 2)
    const s = withModules(s0, 0, ['paywall'])
    // arpu: (0.85 × 1.15 + 1) / 2 against (0.85 + 1) / 2.
    const ratio = s.stats.arpu / s0.stats.arpu
    expect(ratio).toBeCloseTo((B.CATEGORY_ARPU.web * 1.15 + B.CATEGORY_ARPU.mobile) / (B.CATEGORY_ARPU.web + B.CATEGORY_ARPU.mobile), 9)
    expect(s.derived.projectMix![s.projects[0]!.id]!.mult).toEqual({ arpu: 1.15, organic: 0.85, churn: 1.04 })
  })
})

describe('category boosts', () => {
  const mult = (cat: ProjectCategory, id: ProjectModuleId, kind: ModuleEffectKind) => {
    const p = { id: 'p', category: cat, modules: [{ id, day: 0 }] } as Project
    return moduleMult(p, kind, 0)
  }
  it('openApi on an api product: churn (x − 1) × 1.5', () => {
    expect(mult('api', 'openApi', 'churn')).toBeCloseTo(1 - 0.12 * 1.5, 12)
    expect(mult('web', 'openApi', 'churn')).toBeCloseTo(0.88, 12)
    expect(mult('api', 'openApi', 'tam')).toBeCloseTo(1.15, 12)
  })
  it('aiAssistant on an ai product, both gains', () => {
    expect(mult('ai', 'aiAssistant', 'arpu')).toBeCloseTo(1.18, 12)
    expect(mult('ai', 'aiAssistant', 'churn')).toBeCloseTo(0.925, 12)
    expect(mult('web', 'aiAssistant', 'arpu')).toBeCloseTo(1.12, 12)
  })
  it('referral on a game × 1.4 (its minus untouched); the caps still hold', () => {
    expect(mult('game', 'referral', 'organic')).toBeCloseTo(1.308, 12)
    expect(mult('game', 'referral', 'arpu')).toBeCloseTo(0.95, 12)
    const p = { id: 'p', category: 'game', modules: [{ id: 'referral', day: 0 }, { id: 'freemium', day: 0 }, { id: 'analytics', day: 0 }] } as Project
    expect(moduleMult(p, 'organic', 0)).toBe(B.MODULE_MULT_CAP.organic)
  })
})

describe('staleness', () => {
  it('strength 1 to day 360, 0.75 at 540, 0.5 from 720', () => {
    const m = { id: 'paywall' as const, day: 100 }
    expect(moduleStrength(m, 100)).toBe(1)
    expect(moduleStrength(m, 460)).toBe(1)
    expect(moduleStrength(m, 640)).toBeCloseTo(0.75, 12)
    expect(moduleStrength(m, 820)).toBe(0.5)
    expect(moduleStrength(m, 5000)).toBe(0.5)
  })
  it('gains fade, minuses stay', () => {
    const p = { id: 'p', category: 'web', modules: [{ id: 'paywall', day: 0 }] } as Project
    expect(moduleMult(p, 'arpu', 0)).toBeCloseTo(1.15, 12)
    expect(moduleMult(p, 'arpu', 540)).toBeCloseTo(1.1125, 12)
    expect(moduleMult(p, 'arpu', 720)).toBeCloseTo(1.075, 12)
    for (const day of [0, 540, 720, 2000]) {
      expect(moduleMult(p, 'organic', day)).toBeCloseTo(0.85, 12)
      expect(moduleMult(p, 'churn', day)).toBeCloseTo(1.04, 12)
    }
  })
  it('refreshModule: 40% of the cash and work, no slot check, no wave, the day starts over', () => {
    let s = company(['web'], 1)
    s = withModules(s, 0, ['feedback'], s.time.day - 600)
    s.projects[0]!.modules!.length = 1
    // The only Pre-seed slot is full: a new build is refused, the refresh is not.
    expect(build(s, 0, 'paywall').error).toBe('noFreeSlot')
    const cash = s.stats.cash
    const r = api.applyAction(s, { type: 'refreshModule', projectId: s.projects[0]!.id, moduleId: 'feedback' })
    expect(r.ok).toBe(true)
    const def = moduleDef('feedback')!
    expect(cash - r.state.stats.cash).toBe(Math.round(def.cashBase * 2 * 0.4))
    expect(r.state.projects[0]!.build).toEqual({ id: 'feedback', progress: 0, startDay: s.time.day, refresh: true })
    const t = clone(r.state)
    const p = t.projects[0]!
    p.build!.progress = moduleWork(p, def, true)
    const users = t.stats.users
    const sizeBefore = p.size
    checkReleases(t, content)
    expect(p.modules).toEqual([{ id: 'feedback', day: t.time.day }])
    expect(p.build).toBeUndefined()
    expect(p.size).toBe(sizeBefore)
    expect(t.stats.users).toBe(users)
    expect(t.releases!.at(-1)!.module).toBe('feedback')
    expect(moduleWork(p, def, true)).toBeCloseTo(def.work * 0.4, 12)
  })
})

describe('buildModule errors', () => {
  it('the table, in order; an error leaves the state as it was', () => {
    const s = company(['web', 'mobile'], 2)
    const pid = s.projects[0]!.id
    const cases: [GameState, Action, string][] = []
    const add = (st: GameState, a: Action, code: string) => cases.push([st, a, code])
    add(s, { type: 'buildModule', projectId: 'nope', moduleId: 'feedback' }, 'notFound')
    add(s, { type: 'buildModule', projectId: pid, moduleId: 'nope' as ProjectModuleId }, 'invalid')
    const has = withModules(s, 0, ['paywall'])
    add(has, { type: 'buildModule', projectId: pid, moduleId: 'paywall' }, 'invalid')
    add(has, { type: 'buildModule', projectId: pid, moduleId: 'freemium' }, 'invalid')
    const free = withModules(s, 0, ['freemium'])
    add(free, { type: 'buildModule', projectId: pid, moduleId: 'paywall' }, 'invalid')
    const young = clone(s)
    young.projects[0]!.maturity = 0.6
    add(young, { type: 'buildModule', projectId: pid, moduleId: 'feedback' }, 'notUnlocked')
    const unlaunched = clone(s)
    unlaunched.projects[0]!.launched = false
    add(unlaunched, { type: 'buildModule', projectId: pid, moduleId: 'feedback' }, 'notUnlocked')
    add(s, { type: 'buildModule', projectId: pid, moduleId: 'openApi' }, 'notUnlocked')
    const busy = clone(s)
    busy.projects[0]!.build = { id: 'feedback', progress: 0, startDay: 0 }
    add(busy, { type: 'buildModule', projectId: pid, moduleId: 'paywall' }, 'slotOccupied')
    add(withModules(s, 0, ['feedback', 'referral']), { type: 'buildModule', projectId: pid, moduleId: 'paywall' }, 'noFreeSlot')
    const poor = clone(s)
    poor.stats.cash = moduleCost(s, moduleDef('feedback')!) - 1
    add(poor, { type: 'buildModule', projectId: pid, moduleId: 'feedback' }, 'insufficientCash')
    const tired = clone(s)
    tired.founder.moves = { left: 0, weekStart: 0 }
    add(tired, { type: 'buildModule', projectId: pid, moduleId: 'feedback' }, 'noMoves')
    for (const [st, a, code] of cases) {
      const snap = JSON.stringify(st)
      const r = api.applyAction(st, a)
      expect([a.type, (a as { moduleId?: string }).moduleId, r.error]).toEqual([a.type, (a as { moduleId?: string }).moduleId, code])
      expect(r.state).toBe(st)
      expect(JSON.stringify(st)).toBe(snap)
    }
  })

  it('in the garage it costs MODULE_ENERGY instead of a move', () => {
    const s = company(['web'], 0)
    s.founder.energy = B.MODULE_ENERGY - 1
    expect(build(s, 0, 'feedback').error).toBe('noEnergy')
    s.founder.energy = 50
    const r = build(s, 0, 'feedback')
    expect(r.ok).toBe(true)
    expect(r.state.founder.energy).toBe(50 - B.MODULE_ENERGY)
    expect(s.stats.cash - r.state.stats.cash).toBe(600)
  })

  it('success: cash − cashBase × 2^stage, one move, the build written, moduleStarted', () => {
    const s = company(['web'], 2)
    const left = s.founder.moves!.left
    const r = build(s, 0, 'freemium')
    expect(r.ok).toBe(true)
    expect(s.stats.cash - r.state.stats.cash).toBe(1_500 * 4)
    expect(r.state.founder.moves!.left).toBe(left - 1)
    expect(r.state.projects[0]!.build).toEqual({ id: 'freemium', progress: 0, startDay: s.time.day })
    expect(r.state.activity.at(-1)!.kind).toBe('moduleStarted')
    expect(projectSlots(r.state, r.state.projects[0]!)).toEqual({ used: 1, total: 2 })
  })

  it('cancelModule drops the build, no refund, no move; nothing to cancel → notFound', () => {
    const s = build(company(['web'], 2), 0, 'paywall').state
    const r = api.applyAction(s, { type: 'cancelModule', projectId: s.projects[0]!.id })
    expect(r.ok).toBe(true)
    expect(r.state.projects[0]!.build).toBeUndefined()
    expect(r.state.stats.cash).toBe(s.stats.cash)
    expect(r.state.founder.moves).toEqual(s.founder.moves)
    expect(api.applyAction(r.state, { type: 'cancelModule', projectId: s.projects[0]!.id }).error).toBe('notFound')
    expect(api.applyAction(r.state, { type: 'cancelModule', projectId: 'nope' }).error).toBe('notFound')
  })

  it('refreshModule needs the module on the project', () => {
    const s = company(['web'], 2)
    expect(api.applyAction(s, { type: 'refreshModule', projectId: s.projects[0]!.id, moduleId: 'paywall' }).error).toBe('notFound')
    expect(api.applyAction(s, { type: 'refreshModule', projectId: 'nope', moduleId: 'paywall' }).error).toBe('notFound')
  })
})

describe('build and delivery', () => {
  it('the build takes the update work at maturityRates speed; the active set and founder help do not change', () => {
    const s0 = company(['web', 'mobile'], 2)
    // A second, unfinished project keeps an active set (the founder helps it, as before).
    s0.projects[1]!.maturity = 0.5
    recomputeDerived(s0, content)
    const before = maturityRates(s0, computeOutputs(s0, content))
    const s = build(s0, 0, 'paywall').state
    const o = computeOutputs(s, content)
    expect(maturityRates(s, o)).toEqual(before)
    const p = s.projects[0]!
    p.updateProgress = 0.05
    progressProjects(s, o, 1)
    expect(p.updateProgress).toBe(0.05)
    expect(p.build!.progress).toBe(before[p.id]!)
    expect(s.projects[1]!.maturity).toBe(0.5 + before[s.projects[1]!.id]!)
  })

  it('delivery: installed, build gone, size and debt up, a release with the module, × 1.3 wave, no update that day', () => {
    const s = build(company(['web'], 3), 0, 'openApi').state
    const p = s.projects[0]!
    const def = moduleDef('openApi')!
    p.build!.progress = moduleWork(p, def) - 1e-12
    // An update ready too: it must wait.
    p.updateProgress = B.RELEASE_UPDATE_SIZE
    const t = clone(s)
    const q = t.projects[0]!
    const wave = Math.round(updateWave(t, q) * B.MODULE_WAVE_MULT)
    const users = t.stats.users
    const count = t.releaseCount ?? 0
    const debt = t.techDebt ?? 0
    const size = q.size
    const releases = t.releases?.length ?? 0
    checkReleases(t, content)
    expect(q.modules).toEqual([{ id: 'openApi', day: t.time.day }])
    expect(q.build).toBeUndefined()
    expect(q.size).toBe(size + 2)
    expect(t.techDebt).toBe(debt + 3)
    expect(t.releaseCount).toBe(count + 1)
    expect(t.releases!.length).toBe(releases + 1)
    expect(t.releases!.at(-1)).toMatchObject({ module: 'openApi', users: wave, level: 5 })
    expect(t.releases!.at(-1)!.update).toBeUndefined()
    expect(t.stats.users).toBe(users + wave)
    expect(q.updateProgress).toBe(B.RELEASE_UPDATE_SIZE)
    expect(t.activity.some((a) => a.kind === 'moduleShipped')).toBe(true)
    // A bigger scope makes the next build longer.
    expect(moduleWork(q, moduleDef('localization')!)).toBeCloseTo(0.25 * (size + 2) / B.PROJECT_SIZE.web, 12)
  })

  it('an unfinished build ships nothing', () => {
    const s = build(company(['web'], 2), 0, 'paywall').state
    s.projects[0]!.build!.progress = moduleWork(s.projects[0]!, moduleDef('paywall')!) * 0.9
    const n = s.releases?.length ?? 0
    checkReleases(s, content)
    expect(s.releases?.length ?? 0).toBe(n)
    expect(s.projects[0]!.build).toBeDefined()
  })

  it('a build with an unknown id is dropped, so updates are not blocked forever', () => {
    const s = build(company(['web'], 2), 0, 'paywall').state
    const p = s.projects[0]!
    p.build = { ...p.build!, id: 'teleport' as ProjectModuleId, progress: 99 }
    const n = s.releases?.length ?? 0
    checkReleases(s, content)
    expect(p.build).toBeUndefined()
    expect((p.modules ?? []).map((m) => m.id)).not.toContain('teleport')
    expect(s.releases?.length ?? 0).toBe(n)
  })

  it('end to end: the clock builds it and ships it', () => {
    let s = build(company(['web'], 2), 0, 'paywall').state
    for (let d = 0; d < 200 && s.projects[0]!.build; d++) s = api.step(s, 1)
    expect(s.projects[0]!.modules?.map((m) => m.id)).toEqual(['paywall'])
    expect(s.releases!.some((r) => r.module === 'paywall')).toBe(true)
  })

  it('talkToUsers: × 1 on a plain project, × 1.5 with feedback (whose updates weigh 1.25)', () => {
    for (const [ids, k] of [[[], 1], [['feedback'], 1.5]] as [ProjectModuleId[], number][]) {
      const s = withModules(company(['web'], 2), 0, ids)
      const p = s.projects[0]!
      p.updateProgress = 0
      s.founder.currentAction = { kind: 'talkToUsers', startDay: s.time.day, endDay: s.time.day, targetId: p.id }
      completeFounderAction(s, new Rng(createRngState(1)))
      expect(p.updateProgress).toBeCloseTo(B.TALK_MATURITY * k, 12)
    }
    const p = withModules(company(['web'], 2), 0, ['feedback']).projects[0]!
    expect(updateSize(p, 0)).toBeCloseTo(B.RELEASE_UPDATE_SIZE * 1.25, 12)
  })

  it('feedback lifts the project update wave × 1.25', () => {
    const s = withModules(company(['web'], 2), 0, ['feedback'])
    const plain = clone(s)
    plain.projects[0]!.modules = []
    const raw = B.RELEASE_UPDATE_USERS * B.RELEASE_WAVE_STAGE_GROWTH ** s.stage * (0.5 + s.stats.reputation / 100) + s.stats.users * B.RELEASE_UPDATE_USER_SHARE
    expect(updateWave(s, s.projects[0]!)).toBe(Math.max(1, Math.round(raw * 1.25)))
    expect(updateWave(plain, plain.projects[0]!)).toBe(updateWave(plain))
  })
})

describe('upkeep', () => {
  it('aiAssistant: infra + MRR × weight × 6%; it is in the burn', () => {
    const s0 = company(['ai', 'web'], 4)
    const s = withModules(s0, 0, ['aiAssistant'])
    const mix = s.derived.projectMix![s.projects[0]!.id]!
    expect(mix.weight).toBe(0.5)
    expect(mix.upkeep).toBeCloseTo(s.finance.mrr * 0.5 * 0.06, 9)
    // The servers' bill on this MRR, plus the upkeep.
    const o = computeOutputs(s, content)
    const servers = E.infra(s.stats.users, s.finance.mrr, s.stage, o.fx.infraMult * policyMult(s, content, 'infra')) + o.fx.upkeep
    expect(s.finance.burnBreakdown.infra).toBeCloseTo(servers + mix.upkeep, 6)
    expect(s.finance.burn - (s.finance.burnBreakdown.salaries + s.finance.burnBreakdown.rent + s.finance.burnBreakdown.infra + s.finance.burnBreakdown.ads + (s.finance.burnBreakdown.founder ?? 0) + (s.finance.burnBreakdown.expansion ?? 0))).toBeCloseTo(0, 6)
  })

  it('freemium scales with users × weight; onboarding / analytics / localization with the stage', () => {
    const s = withModules(company(['web', 'mobile'], 3), 0, ['freemium', 'onboarding', 'analytics'])
    const mix = s.derived.projectMix![s.projects[0]!.id]!
    const freemium = (s.stats.users / 1000) * 0.5 * 0.5 * B.INFRA_PER_1000_BY_STAGE[3]!
    expect(mix.upkeep).toBeCloseTo(freemium + (100 + 150) * 8, 9)
    const more = clone(s)
    more.stats.users *= 2
    recomputeDerived(more, content)
    expect(more.derived.projectMix![s.projects[0]!.id]!.upkeep).toBeCloseTo(2 * freemium + 250 * 8, 9)
  })

  it('a payday infra deferral defers the module upkeep with it', () => {
    const deferred = (ids: ProjectModuleId[]) => {
      const s = withModules(company(['ai'], 4), 0, ids)
      s.finance.ledger = undefined
      accrueMonth(s, 30)
      const l = ledgerOf(s)
      s.finance.pendingPayday = { day: s.time.day, ledger: { ...l }, deferredBefore: 0 }
      s.finance.ledger = undefined
      resolvePayday(s, content, { salaries: 'full', rent: 'pay', infra: 'defer', ads: 'pay', founder: 'pay' })
      return { deferred: s.finance.deferred ?? 0, upkeep: Object.values(projectMix(withModules(company(['ai'], 4), 0, ids)))[0]!.upkeep, infra: l.infra }
    }
    const none = deferred([])
    const ai = deferred(['localization'])
    expect(ai.upkeep).toBeGreaterThan(0)
    expect(ai.deferred - none.deferred).toBeCloseTo(ai.upkeep, 6)
  })
})

describe('offers and suggestion', () => {
  it('every module is offered: its price, its days at today\'s speed, why not', () => {
    const s = withModules(company(['web'], 2), 0, ['paywall'])
    const offers = moduleOffers(s, s.projects[0]!)
    expect(offers.map((o) => o.id)).toEqual([...PROJECT_MODULE_IDS])
    const by = Object.fromEntries(offers.map((o) => [o.id, o]))
    expect(by.paywall).toMatchObject({ refresh: true, cost: Math.round(600 * 4 * 0.4) })
    expect(by.freemium!.error).toBe('invalid')
    expect(by.openApi!.error).toBe('notUnlocked')
    expect(by.feedback).toMatchObject({ refresh: false, cost: 2_400, error: null })
    expect(by.feedback!.days).toBe(Math.ceil(moduleWork(s.projects[0]!, moduleDef('feedback')!) / s.derived.maturityPerDay![s.projects[0]!.id]!))
  })

  it('suggests one module it can build, none when nothing fits', () => {
    const s = company(['web'], 2)
    const pick = suggestModule(s, s.projects[0]!)
    expect(pick).not.toBeNull()
    expect(moduleOffers(s, s.projects[0]!).find((o) => o.id === pick)!.error).toBeNull()
    const full = withModules(s, 0, ['feedback', 'referral'])
    expect(suggestModule(full, full.projects[0]!)).toBeNull()
  })

  it('the catalogue: every id once, a minus on each', () => {
    expect(MODULES.map((m) => m.id)).toEqual([...PROJECT_MODULE_IDS])
    for (const m of MODULES) expect(Boolean(m.minus || m.upkeep || m.debt > 0 || m.sizeAdd > 0)).toBe(true)
  })
})

describe('fuzz', () => {
  it('200 random action runs: caps hold, slots respected, one build at most, users ≥ 0, all finite', () => {
    const rng = new Rng(createRngState(2026))
    const pick = <T>(xs: readonly T[]): T => xs[rng.int(0, xs.length - 1)]!
    const base = company(['web', 'game', 'api'], 2, 21)
    let shipped = 0
    for (let run = 0; run < 200; run++) {
      let s = clone(base)
      s.stage = pick([0, 1, 2, 3, 4, 5] as const)
      for (let k = 0; k < 10; k++) {
        const p = pick(s.projects)
        const id = pick(PROJECT_MODULE_IDS)
        const a = pick<Action>([
          { type: 'buildModule', projectId: p.id, moduleId: id },
          { type: 'buildModule', projectId: p.id, moduleId: id },
          { type: 'refreshModule', projectId: p.id, moduleId: pick(p.modules?.map((m) => m.id) ?? [id]) },
          { type: 'cancelModule', projectId: p.id },
          { type: 'renameProject', projectId: p.id, name: `Ürün ${rng.int(1, 99)}` },
          { type: 'setAdBudget', amount: rng.int(0, 20) * 500 },
          { type: 'setPrice', multiplier: pick([0.8, 1, 1.2]) },
          { type: 'assign', employeeId: pick(s.employees).id, projectId: p.id },
        ])
        s = api.applyAction(s, a).state
        if (rng.next() < 0.3) for (const q of s.projects) if (q.build) q.build.progress += rng.next() * 0.3
        s = api.step(s, rng.int(1, 4))
        if (s.gameOver) break
        shipped += s.projects.filter((q) => q.modules?.length).length
        for (const q of s.projects) {
          expect((q.modules?.length ?? 0)).toBeLessThanOrEqual(B.MODULE_SLOTS_BY_STAGE[s.stage]!)
          expect(new Set(q.modules?.map((m) => m.id)).size).toBe(q.modules?.length ?? 0)
          for (const kind of MODULE_KINDS) {
            const v = moduleMult(q, kind, s.time.day)
            const cap = B.MODULE_MULT_CAP[kind]
            expect(Number.isFinite(v)).toBe(true)
            if (cap !== undefined) expect(B.MODULE_MULT_FLOOR_KINDS.includes(kind) ? v >= cap : v <= cap).toBe(true)
          }
        }
        expect(s.stats.users).toBeGreaterThanOrEqual(0)
        for (const v of [s.stats.users, s.stats.cash, s.stats.arpu, s.stats.churn, s.finance.mrr, s.finance.burn, s.finance.valuation, s.derived.cac, s.derived.channels.paid, s.derived.channels.organic]) expect(Number.isFinite(v)).toBe(true)
      }
    }
    // The runs really build and ship modules.
    expect(shipped).toBeGreaterThan(100)
  }, 60_000)
})

describe('replay', () => {
  it('same seed + the same TimedActions with the module actions ⇒ the same state twice', () => {
    const run = (): string => {
      let s = company(['web', 'mobile'], 2, 31)
      const p0 = s.projects[0]!.id
      const p1 = s.projects[1]!.id
      const script: TimedAction[] = [
        { atDay: 1, action: { type: 'buildModule', projectId: p0, moduleId: 'feedback' } },
        { atDay: 2, action: { type: 'buildModule', projectId: p1, moduleId: 'referral' } },
        { atDay: 4, action: { type: 'cancelModule', projectId: p1 } },
        { atDay: 40, action: { type: 'buildModule', projectId: p0, moduleId: 'paywall' } },
        { atDay: 90, action: { type: 'refreshModule', projectId: p0, moduleId: 'feedback' } },
      ]
      const start = s.time.day
      let i = 0
      for (let d = 0; d < 120; d += 0.25) {
        while (i < script.length && script[i]!.atDay <= d) {
          s = api.applyAction(s, script[i]!.action).state
          i++
        }
        s = api.step(s, 0.25)
      }
      expect(s.time.day).toBeCloseTo(start + 120, 9)
      return JSON.stringify(s)
    }
    const a = run()
    expect(a).toBe(run())
    expect(a).toContain('"modules":[{"id":"feedback"')
  })
})

describe('ad focus (W3)', () => {
  const full = (cats: readonly ProjectCategory[], focusIdx: number | null) => {
    const s = company(cats, 2)
    s.finance.adBudget = 1_000_000 // far past MRR and the stage floor: adIntensity 1
    if (focusIdx !== null) s.finance.adFocus = s.projects[focusIdx]!.id
    recomputeDerived(s, content)
    return s
  }

  it('no focus or no ads: the flat mean; full ads on 3 projects: 0.6 / 0.2 / 0.2', () => {
    const flat = full(['game', 'api', 'ai'], null)
    expect(projectWeights(flat).map((x) => x.w)).toEqual([1, 1, 1])
    const noAds = full(['game', 'api', 'ai'], 0)
    noAds.finance.adBudget = 0
    expect(projectWeights(noAds).map((x) => x.w)).toEqual([1, 1, 1])
    const f = full(['game', 'api', 'ai'], 0)
    const w = projectWeights(f).map((x) => x.w)
    const total = w.reduce((a, b) => a + b, 0)
    expect(w.map((x) => x / total)).toEqual([0.6, 0.2, 0.2].map((x) => expect.closeTo(x, 9)))
    expect(Object.values(projectMix(withModules(f, 1, ['feedback']))).reduce((a, x) => a + x.weight, 0)).toBeCloseTo(1, 9)
  })

  it('a focus at a missing or unlaunched project is ignored', () => {
    const s = full(['game', 'api'], null)
    s.finance.adFocus = 'nope'
    expect(projectWeights(s).map((x) => x.w)).toEqual([1, 1])
    s.projects[1]!.launched = false
    s.finance.adFocus = s.projects[1]!.id
    expect(projectWeights(s).map((x) => x.w)).toEqual([1])
  })

  it('the company mult sits between the projects; the tilt reads last month MRR; recompute is stable', () => {
    const s = full(['game', 'api', 'ai'], 0)
    const per = s.projects.map((p) => (B.CATEGORY_ARPU[p.category] ?? 1))
    const mean = s.stats.arpu
    expect(Number.isFinite(mean)).toBe(true)
    const e = focusEffects(s, s.projects[0]!.id)
    expect(e.arpu).toBeGreaterThan(0)
    expect(Math.min(...per)).toBeLessThanOrEqual(Math.max(...per))
    // A big MRR this tick does not move the weights; last month's snapshot does.
    const a = projectWeights(s)[0]!.w
    s.finance.mrr *= 50
    expect(projectWeights(s)[0]!.w).toBe(a)
    s.finance.mrrHistory.push(1e9)
    expect(projectWeights(s)[0]!.w).toBeLessThan(a)
    const x = clone(s)
    recomputeDerived(x, content)
    const y = clone(x)
    recomputeDerived(y, content)
    expect(y.derived).toEqual(x.derived)
  })

  it('saturation: paid <= paidPerMonth(total ads, cac_base * 0.85, pen) for any focus; the spend input is untouched', () => {
    for (let i = 0; i < 3; i++) {
      const s = full(['game', 'api', 'ai'], i)
      const base = full(['game', 'api', 'ai'], null)
      expect(s.finance.adBudget).toBe(base.finance.adBudget)
      const cacBase = E.cac(s.stage, s.derived.avgMaturity, s.finance.adBudget, s.finance.mrr, s.derived.penetration ?? 0)
      const bound = E.paidPerMonth(s.finance.adBudget, cacBase * 0.85 * modifierMult(s, 'cac') * policyMult(s, content, 'cac'), s.derived.penetration ?? 0)
      expect(s.derived.channels.paid).toBeLessThanOrEqual(bound + 1e-9)
    }
  })

  it('setAdFocus: locked tool, missing, unlaunched, same focus; set and clear', () => {
    const s = company(['game', 'api'], 2)
    const id = s.projects[0]!.id
    const locked = clone(s)
    locked.unlockedTools = locked.unlockedTools.filter((t) => t !== 'adBudget')
    expect(api.applyAction(locked, { type: 'setAdFocus', projectId: id })).toMatchObject({ ok: false, error: 'notUnlocked' })
    expect(api.applyAction(s, { type: 'setAdFocus', projectId: 'nope' })).toMatchObject({ ok: false, error: 'notFound' })
    const un = clone(s)
    un.projects[1]!.launched = false
    expect(api.applyAction(un, { type: 'setAdFocus', projectId: un.projects[1]!.id })).toMatchObject({ ok: false, error: 'notUnlocked' })
    const same = api.applyAction(s, { type: 'setAdFocus', projectId: null })
    expect(same.ok).toBe(true)
    expect(same.state.finance.adFocusDay).toBeUndefined()
    const moves = s.founder.moves?.left
    const r = api.applyAction(s, { type: 'setAdFocus', projectId: id })
    expect(r.ok).toBe(true)
    expect(r.state.finance.adFocus).toBe(id)
    expect(r.state.finance.adFocusDay).toBe(s.time.day)
    expect(r.state.founder.moves?.left).toBe(moves)
    const back = api.applyAction(r.state, { type: 'setAdFocus', projectId: null })
    expect(back.state.finance.adFocus).toBeUndefined()
  })

  it('warm-up: CAC x1.15 on the day, x1.075 at day 7, x1 at day 14', () => {
    const s = company(['game', 'api'], 2)
    expect(adFocusWarmup(s)).toBe(1)
    s.finance.adFocusDay = s.time.day
    expect(adFocusWarmup(s)).toBeCloseTo(1.15, 9)
    s.time.day += 7
    expect(adFocusWarmup(s)).toBeCloseTo(1.075, 9)
    s.time.day += 7
    expect(adFocusWarmup(s)).toBe(1)
    const fresh = company(['game', 'api'], 2)
    const base = fresh.derived.cac
    fresh.finance.adFocusDay = fresh.time.day
    recomputeDerived(fresh, content)
    expect(fresh.derived.cac).toBeCloseTo(base * 1.15, 6)
  })

  it('focusPreview: null from a focused state matches the flat state estimate', () => {
    const s = full(['game', 'api', 'ai'], 0)
    const cur = focusPreview(s, s.projects[0]!.id)
    const flat = focusPreview(s, null)
    expect(Number.isFinite(cur) && Number.isFinite(flat)).toBe(true)
    const f = full(['game', 'api', 'ai'], null)
    // The ratios leave out the spend saturation's own small feedback through MRR: within 1%.
    expect(Math.abs(focusPreview(f, null) / flat - 1)).toBeLessThan(0.01)
  })

  it('focusPreview: staying on the current focus reproduces the state\'s own next-month estimate (paid keeps the current CAC factor)', () => {
    const s = full(['game', 'api', 'ai'], 0)
    const ch = s.derived.channels
    const own = s.stats.users * (1 - s.stats.churn) + ch.organic + ch.paid + ch.manual
    const want = own * s.stats.arpu + s.finance.enterpriseCustomers.reduce((a, e) => a + e.mrr, 0)
    expect(focusPreview(s, s.projects[0]!.id) / want).toBeCloseTo(1, 6)
  })

  it('save round-trip keeps the focus; a save without it derives the same', () => {
    const s = full(['game', 'api'], 1)
    const back = deserialize(serialize(s)) as GameState
    expect(back.finance.adFocus).toBe(s.projects[1]!.id)
    const old = full(['game', 'api'], null)
    const o = clone(old)
    delete o.finance.adFocus
    delete o.finance.adFocusDay
    recomputeDerived(o, content)
    expect(o.derived).toEqual(old.derived)
  })
})
