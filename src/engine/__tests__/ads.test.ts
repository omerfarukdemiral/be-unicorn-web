// A1 (round 3 §3): per-product users, the focus that routes paid users, what a budget step buys, why the CAC rose,
// the runway warning on the ad steps, the receipt's ad users, the month-end snapshots.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import * as E from '../economy'
import { adPreview, adStepWarning, cacFactors, cacReason } from '../ads'
import { recomputeDerived } from '../derive'
import { applyEffects } from '../effects'
import { completeFounderAction } from '../founder'
import { checkReleases } from '../loop'
import { previewSpend } from '../loopSelectors'
import { flowSplit, projectWeights, syncProjectUsers } from '../modules'
import { Rng, createRngState } from '../rng'
import { deserialize, serialize } from '../save'
import type { GameState } from '../types'
import { clone } from '../util'
import { monthEnd } from '../world'
import { api, company, content, withModules } from './moduleFixtures'

const sumUsers = (s: GameState) => s.projects.filter((p) => p.launched).reduce((a, p) => a + (p.users ?? 0), 0)
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(b)))

describe('per-product users: Σ p.users = stats.users', () => {
  it('after days of flow, a card effect (+users, usersPercent), a release wave and a manual find', () => {
    let s = api.step(company(['web', 'mobile'], 2), 20)
    close(sumUsers(s), s.stats.users)
    s = clone(s)
    applyEffects(s, content, { users: 500 }, 'test')
    applyEffects(s, content, { usersPercent: -0.2 }, 'test')
    const before = s.projects.map((p) => p.users!)
    syncProjectUsers(s)
    close(sumUsers(s), s.stats.users)
    // The direct change lands in proportion: both products scale by the same factor.
    expect(s.projects[0]!.users! / before[0]!).toBeCloseTo(s.projects[1]!.users! / before[1]!, 9)
    s = api.step(s, 3)
    close(sumUsers(s), s.stats.users)
    // A release wave: the shipping product takes it all.
    s = clone(s)
    const p = s.projects[1]!
    p.updateProgress = 1
    s.releases = []
    const users = s.projects.map((x) => x.users!)
    const company0 = s.stats.users
    checkReleases(s, content)
    const wave = s.stats.users - company0
    expect(wave).toBeGreaterThan(0)
    close(p.users! - users[1]!, wave)
    expect(s.projects[0]!.users).toBe(users[0])
    close(sumUsers(s), s.stats.users)
    // findUsers: the founder's product (the first one here) takes them.
    s.founder.currentAction = { kind: 'findUsers', startDay: s.time.day - 7, endDay: s.time.day }
    const own = s.projects[0]!.users!
    const total0 = s.stats.users
    completeFounderAction(s, new Rng(createRngState(1)))
    close(s.projects[0]!.users! - own, s.stats.users - total0)
    close(sumUsers(s), s.stats.users)
  })

  it('an old save without p.users loads and splits the users equally on the first tick', () => {
    const s = api.step(company(['web', 'game', 'ai'], 2), 10)
    const raw = JSON.parse(serialize(s)) as { state: GameState }
    for (const p of raw.state.projects) {
      delete p.users
      delete p.acq
      delete p.lost
      delete p.rev
      delete p.snaps
    }
    const loaded = deserialize(JSON.stringify(raw))!
    expect(loaded.projects.every((p) => p.users === undefined)).toBe(true)
    const x = clone(loaded)
    syncProjectUsers(x)
    for (const p of x.projects) expect(p.users).toBeCloseTo(loaded.stats.users / 3, 9)
    const later = api.step(loaded, 1)
    close(sumUsers(later), later.stats.users)
    expect(later.projects.every((p) => (p.acq ?? 0) > 0)).toBe(true)
  })

  it('unlaunched projects hold no users; the first launch takes the users waiting at the door', () => {
    const s = company(['web', 'mobile'], 2)
    s.projects[1]!.launched = false
    s.projects[1]!.maturity = 0.1
    syncProjectUsers(s)
    expect(s.projects[1]!.users).toBeUndefined()
    expect(s.projects[0]!.users).toBeCloseTo(s.stats.users, 9)
  })
})

describe('the flows split by product', () => {
  it('derived.projectMix: Σ paid / organic a month = the channels; users rounded; shares sum to 1', () => {
    const s = api.step(company(['web', 'mobile', 'game'], 2), 15)
    const mix = Object.values(s.derived.projectMix!)
    close(mix.reduce((a, m) => a + m.paidPerMonth!, 0), s.derived.channels.paid)
    close(mix.reduce((a, m) => a + m.organicPerMonth!, 0), s.derived.channels.organic)
    expect(mix.reduce((a, m) => a + m.share!, 0)).toBeCloseTo(1, 12)
    expect(mix.every((m) => Number.isInteger(m.users))).toBe(true)
  })

  it('paid users: 50 / 50 without a focus, 75 / 25 on the focus; three products 60 / 20 / 20', () => {
    const s = company(['web', 'mobile'], 2)
    expect(flowSplit(s).map((x) => x.paid)).toEqual([0.5, 0.5])
    s.finance.adFocus = s.projects[1]!.id
    expect(flowSplit(s).map((x) => x.paid)).toEqual([0.25, 0.75])
    const t = company(['web', 'mobile', 'game'], 2)
    t.finance.adFocus = t.projects[0]!.id
    expect(flowSplit(t).map((x) => x.paid)).toEqual([0.6, 0.2, 0.2].map((v) => expect.closeTo(v, 12)))
  })

  it('organic: (share + ORGANIC_SHARE_FLOOR) × category organic, so a new product still draws some', () => {
    const s = company(['web', 'game'], 2)
    s.projects[0]!.users = s.stats.users
    s.projects[1]!.users = 0
    const [a, b] = flowSplit(s).map((x) => x.organic)
    const wa = (1 + B.ORGANIC_SHARE_FLOOR) * B.CATEGORY_ORGANIC.web
    const wb = B.ORGANIC_SHARE_FLOOR * B.CATEGORY_ORGANIC.game
    expect(a).toBeCloseTo(wa / (wa + wb), 12)
    expect(b).toBeCloseTo(wb / (wa + wb), 12)
  })

  it('the focus moves ≥ 12% of the month\'s acquired users (ads 0.5 × MRR, organic ≈ paid)', () => {
    const s = company(['web', 'mobile'], 2)
    // One marketer less: the organic channel comes down to about the paid one.
    const m = s.employees.findIndex((e) => e.dept === 'marketing')
    s.employees.splice(m, 1)
    for (let i = 0; i < 2; i++) {
      s.finance.adBudget = 0.5 * s.finance.mrr
      recomputeDerived(s, content)
    }
    const ch = s.derived.channels
    expect(ch.organic / ch.paid).toBeGreaterThan(0.9)
    expect(ch.organic / ch.paid).toBeLessThan(1.1)
    const shareA = (x: GameState) => {
      const [a, b] = Object.values(x.derived.projectMix!).map((v) => v.paidPerMonth! + v.organicPerMonth!)
      return a! / (a! + b!)
    }
    const f = clone(s)
    f.finance.adFocus = f.projects[0]!.id
    recomputeDerived(f, content)
    expect(shareA(f) - shareA(s)).toBeGreaterThanOrEqual(0.12)
    // Over a real month from the switch (warm-up CAC included, waves left out: nobody builds), still ≥ 10%.
    const quiet = (x: GameState) => {
      const y = clone(x)
      for (const p of y.projects) p.assignedIds = []
      y.employees = y.employees.filter((e) => e.dept === 'marketing')
      return y
    }
    const run = (x: GameState, focus: string | null) => {
      const y = quiet(x)
      if (focus) {
        y.finance.adFocus = focus
        y.finance.adFocusDay = y.time.day
      }
      recomputeDerived(y, content)
      const a0 = y.projects.map((p) => p.acq ?? 0)
      const z = api.step(y, 30)
      const d = z.projects.map((p, i) => (p.acq ?? 0) - a0[i]!)
      return d[0]! / (d[0]! + d[1]!)
    }
    expect(run(s, s.projects[0]!.id) - run(s, null)).toBeGreaterThanOrEqual(0.1)
  })

  it('churn and revenue follow each product: Σ = the company, the churn module\'s product loses fewer', () => {
    let s = company(['web', 'mobile'], 2)
    s.projects[0]!.users = 1500
    s.projects[1]!.users = 1500
    s = withModules(s, 0, ['onboarding'])
    const lost0 = s.projects.map((p) => p.lost ?? 0)
    const rev0 = s.projects.map((p) => p.rev ?? 0)
    const next = api.step(s, 1)
    const lost = next.projects.map((p, i) => (p.lost ?? 0) - lost0[i]!)
    const rev = next.projects.map((p, i) => (p.rev ?? 0) - rev0[i]!)
    expect(lost[0]!).toBeLessThan(lost[1]!)
    expect(rev[0]! + rev[1]!).toBeGreaterThan(0)
  })
})

describe('the mixes weigh the products by their users', () => {
  it('ARPU: a product with 90% of the users sets 90% of the category factor', () => {
    const s = company(['game', 'ai'], 2)
    const flat = s.stats.arpu
    s.projects[0]!.users = 2700
    s.projects[1]!.users = 300
    recomputeDerived(s, content)
    const b = B.MIX_SHARE_BLEND
    const w = [(1 - b) / 2 + b * 0.9, (1 - b) / 2 + b * 0.1]
    const want = (w[0]! * B.CATEGORY_ARPU.game + w[1]! * B.CATEGORY_ARPU.ai) / (B.CATEGORY_ARPU.game / 2 + B.CATEGORY_ARPU.ai / 2)
    expect(s.stats.arpu / flat).toBeCloseTo(want, 9)
    expect(projectWeights(s).map((x) => x.w)).toEqual(w.map((v) => expect.closeTo(v, 12)))
  })

  it('CAC: the module mix weighs by the ads, so a CAC module on the focused product lowers it more', () => {
    const s = withModules(company(['web', 'mobile'], 2), 0, ['analytics'])
    const on = clone(s)
    on.finance.adFocus = on.projects[0]!.id
    recomputeDerived(on, content)
    const off = clone(s)
    off.finance.adFocus = off.projects[1]!.id
    recomputeDerived(off, content)
    expect(on.derived.cac).toBeLessThan(s.derived.cac)
    expect(s.derived.cac).toBeLessThan(off.derived.cac)
  })
})

describe('adPreview and the runway warning', () => {
  it('at today\'s budget it is today: paid, CAC and the runway preview', () => {
    const s = company(['web', 'mobile'], 2)
    const p = adPreview(s, s.finance.adBudget)
    expect(p.paid).toBeCloseTo(s.derived.channels.paid, 9)
    expect(p.cac).toBeCloseTo(s.derived.cac, 9)
    expect(p.runwayAfter).toBe(previewSpend(s).runwayAfter)
    const more = adPreview(s, s.finance.adBudget * 3)
    expect(more.paid).toBeGreaterThan(p.paid)
    expect(more.cac).toBeGreaterThan(p.cac)
    // The ratio is the spend saturation alone.
    const pen = s.derived.penetration ?? 0
    expect(more.cac / p.cac).toBeCloseTo(E.cac(s.stage, s.derived.avgMaturity, s.finance.adBudget * 3, s.finance.mrr, pen) / E.cac(s.stage, s.derived.avgMaturity, s.finance.adBudget, s.finance.mrr, pen), 9)
  })

  it('a step up warns when it leaves under a month of runway; every step up once it is already under a month; never when profitable', () => {
    const s = company(['web', 'mobile'], 2)
    s.stats.users = 100
    for (const p of s.projects) p.users = 50
    s.finance.adBudget = 1_000
    s.stats.cash = 40_000
    recomputeDerived(s, content)
    const now = s.finance.runway!
    expect(now).toBeGreaterThan(1)
    expect(adStepWarning(s, s.finance.adBudget)).toBe(false)
    expect(adStepWarning(s, 500)).toBe(false)
    // Find a step that keeps more than a month and one that leaves less.
    const burn = -s.finance.net
    const free = now * burn
    const keep = s.finance.adBudget + Math.max(0, free / 1.5 - burn)
    const end = s.finance.adBudget + free
    expect(adPreview(s, keep).runwayAfter!).toBeGreaterThan(1)
    expect(adStepWarning(s, keep)).toBe(false)
    expect(adPreview(s, end).runwayAfter!).toBeLessThan(1)
    expect(adStepWarning(s, end)).toBe(true)
    // Already under a month: any step up.
    s.stats.cash = 0.5 * burn + (s.stats.cash - free)
    recomputeDerived(s, content)
    expect(s.finance.runway!).toBeLessThan(1)
    expect(adStepWarning(s, s.finance.adBudget + 1)).toBe(true)
    expect(adStepWarning(s, s.finance.adBudget)).toBe(false)
    // Profitable after the step: no warning.
    const rich = company(['web', 'mobile'], 2)
    expect(rich.finance.net).toBeGreaterThan(0)
    expect(adPreview(rich, rich.finance.adBudget + 100).runwayAfter).toBeNull()
    expect(adStepWarning(rich, rich.finance.adBudget + 100)).toBe(false)
  })
})

describe('cacFactors and the reason line', () => {
  const base = (s: GameState) => (B.CAC_BASE * B.CAC_STAGE_GROWTH ** s.stage) / 1.5

  it('every factor but the stage multiplies back to derived.cac (crisis, focus warm-up, a module on the focus)', () => {
    let s = company(['web', 'mobile'], 3)
    s = withModules(s, 1, ['localization'])
    s.modifiers.push({ id: 'm1', kind: 'cac', value: 4, untilDay: s.time.day + 30, source: 'crisis:cac-war' })
    s.finance.adFocus = s.projects[1]!.id
    s.finance.adFocusDay = s.time.day - 3
    recomputeDerived(s, content)
    const f = cacFactors(s)
    expect(f.map((x) => x.key)).toEqual(['crisis', 'spend', 'market', 'focus', 'maturity', 'stage', 'modules', 'policy'])
    const prod = f.filter((x) => x.key !== 'stage').reduce((a, x) => a * x.value, 1)
    expect(prod * base(s)).toBeCloseTo(s.derived.cac, 6)
    expect(f.find((x) => x.key === 'crisis')).toMatchObject({ value: 4, source: 'crisis:cac-war' })
    expect(f.find((x) => x.key === 'focus')!.days).toBe(Math.ceil(B.AD_FOCUS_WARMUP_DAYS - 3))
    expect(f.find((x) => x.key === 'modules')).toMatchObject({ module: 'localization' })
    expect(cacReason(s)).toMatchObject({ key: 'crisis', value: 4 })
  })

  it('the stage factor counts for CAC_STAGE_REASON_DAYS after a stage-up', () => {
    const s = company(['web'], 2)
    s.stageStart = { ...s.stageStart!, stage: 2, day: s.time.day - 10 }
    expect(cacFactors(s).find((x) => x.key === 'stage')!.value).toBe(B.CAC_STAGE_GROWTH)
    s.stageStart.day = s.time.day - B.CAC_STAGE_REASON_DAYS
    expect(cacFactors(s).find((x) => x.key === 'stage')!.value).toBe(1)
  })

  it('the biggest factor ≥ CAC_REASON_MIN wins; a tie goes to the earlier one in the order; nothing big = null', () => {
    const s = company(['web', 'mobile'], 2)
    s.stageStart = { ...s.stageStart!, day: s.time.day - 365 }
    s.finance.adBudget = 0
    s.derived.avgMaturity = 1
    s.derived.penetration = 0
    expect(cacReason(s)).toBeNull()
    s.finance.adBudget = 1.5 * Math.max(s.finance.mrr, B.CAC_SPEND_FLOOR[s.stage]!)
    const spend = cacFactors(s).find((x) => x.key === 'spend')!.value
    expect(spend).toBeGreaterThan(B.CAC_REASON_MIN)
    expect(cacReason(s)!.key).toBe('spend')
    // The same value from a crisis: crisis first.
    s.modifiers.push({ id: 'm1', kind: 'cac', value: spend, untilDay: s.time.day + 30, source: 'crisis:cac-war' })
    expect(cacReason(s)!.key).toBe('crisis')
    s.modifiers[s.modifiers.length - 1]!.value = spend - 0.01
    expect(cacReason(s)!.key).toBe('spend')
    // Market: 1 + 3 × 0.9² = 3.43 beats both (spend 1 + 0.75 × 1.5^1.5 ≈ 2.38).
    s.derived.penetration = 0.9
    expect(cacReason(s)).toMatchObject({ key: 'market', pen: 0.9 })
  })
})

describe('receipts and month-end snapshots', () => {
  it('the receipt carries the users the ads brought this month (rounded in the history)', () => {
    let s = company(['web', 'mobile'], 2)
    s.time.day = 31
    s.finance.ledger = undefined
    s = api.step(s, 30)
    const r = s.finance.lastReceipt!
    expect(r.adUsers).toBeGreaterThan(0)
    // About a month of the paid channel.
    expect(r.adUsers! / s.derived.channels.paid).toBeGreaterThan(0.5)
    expect(r.adUsers! / s.derived.channels.paid).toBeLessThan(2)
    expect(Number.isInteger((s.finance.receipts!.at(-1) as { adUsers?: number }).adUsers)).toBe(true)
    // No ads, no line.
    let t = company(['web', 'mobile'], 2)
    t.finance.adBudget = 0
    t.time.day = 31
    t = api.step(t, 30)
    expect(t.finance.lastReceipt!.adUsers).toBeUndefined()
  })

  it('monthEnd keeps the last PROJECT_SNAPS_MAX snapshots of each live product, whole numbers', () => {
    let s = api.step(company(['web', 'mobile'], 2), 5)
    s = clone(s)
    for (let i = 0; i < 3; i++) {
      s.time.day += 30
      for (const p of s.projects) p.acq = (p.acq ?? 0) + 10.4
      monthEnd(s)
    }
    for (const p of s.projects) {
      expect(p.snaps).toHaveLength(B.PROJECT_SNAPS_MAX)
      expect(p.snaps!.at(-1)!.day).toBe(Math.floor(s.time.day))
      expect(p.snaps!.every((x) => Number.isInteger(x.acq) && Number.isInteger(x.lost) && Number.isInteger(x.rev))).toBe(true)
      expect(p.snaps![1]!.acq - p.snaps![0]!.acq).toBe(Math.round(p.acq!) - Math.round(p.acq! - 10.4))
    }
  })
})
