// The desk's module question (W2c): when it asks, once per stage / per age, oldest project first; the panel's rows.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { buildStatus, moduleAsk, projectSlots, moduleHeadlines, moduleOffers, modulePromptFlag, moduleStaleFlag, suggestModule, suggestModules } from '../modules'
import { clone } from '../util'
import { api, build, company, withModules } from './moduleFixtures'

describe('moduleAsk: new module', () => {
  it('asks about the first finished product with room, an affordable module and nothing running', () => {
    const s = company(['web', 'mobile'])
    const a = moduleAsk(s)
    expect(a).toEqual({ projectId: s.projects[0]!.id, moduleId: suggestModule(s, s.projects[0]!), stale: false })
  })

  it('stays quiet below 1.0, unlaunched, with no free slot, while a build runs and when nothing is affordable', () => {
    const base = company(['web'])
    const young = clone(base)
    young.projects[0]!.maturity = 0.8
    expect(moduleAsk(young)).toBeNull()
    const idea = clone(base)
    idea.projects[0]!.launched = false
    expect(moduleAsk(idea)).toBeNull()
    const full = withModules(base, 0, ['feedback', 'referral', 'analytics'])
    expect(projectSlotsFull(full)).toBe(true)
    expect(moduleAsk(full)).toBeNull()
    const busy = build(base, 0, 'feedback')
    expect(busy.ok).toBe(true)
    if (busy.ok) expect(moduleAsk(busy.state)).toBeNull()
    const broke = clone(base)
    broke.stats.cash = 10
    expect(moduleAsk(broke)).toBeNull()
  })

  // MV2a (rule change on purpose): once per version, no longer once per stage.
  it('asks once per version: a build marks the version, a stage-up does not ask again, the next version does', () => {
    const s = company(['web'], 2)
    const r = build(s, 0, 'feedback')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.flags[modulePromptFlag(s.projects[0]!.id)]).toBe(1)
    // Built and shipped; free slots are left (3 at v1) but this version has been asked.
    const done = clone(r.state)
    delete done.projects[0]!.build
    done.projects[0]!.modules = [{ id: 'feedback', day: done.time.day }]
    expect(moduleAsk(done)).toBeNull()
    done.stage = 3
    expect(moduleAsk(done)).toBeNull()
    done.projects[0]!.version = 2
    expect(moduleAsk(done)?.stale).toBe(false)
  })

  it('a round-2 save\'s stage-valued prompt flag does not silence the version question', () => {
    const s = company(['web'], 4)
    s.flags[`modulePrompt:${s.projects[0]!.id}`] = 4
    expect(moduleAsk(s)?.projectId).toBe(s.projects[0]!.id)
  })

  it('oldest project first: the second project is asked only once the first is settled', () => {
    const s = company(['web', 'mobile'])
    const first = s.projects[0]!.id
    expect(moduleAsk(s)?.projectId).toBe(first)
    s.flags[modulePromptFlag(first)] = s.stage
    expect(moduleAsk(s)?.projectId).toBe(s.projects[1]!.id)
  })
})

describe('moduleAsk: stale module', () => {
  const staleDay = (s: ReturnType<typeof company>) => s.time.day - (B.MODULE_FRESH_DAYS + (B.MODULE_STALE_DAYS - B.MODULE_FRESH_DAYS) * 0.6)

  it('asks for a refresh below 75% strength, before a new module, and only once for that age', () => {
    let s = company(['web'], 2)
    s = withModules(s, 0, ['feedback'], staleDay(s))
    const a = moduleAsk(s)
    expect(a).toEqual({ projectId: s.projects[0]!.id, moduleId: 'feedback', stale: true })
    const r = api.applyAction(s, { type: 'refreshModule', projectId: s.projects[0]!.id, moduleId: 'feedback' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.flags[moduleStaleFlag(s.projects[0]!.id, 'feedback')]).toBe(s.projects[0]!.modules![0]!.day)
    // A cancelled refresh is an answer too: the same age is not asked about again.
    const cancelled = clone(r.state)
    delete cancelled.projects[0]!.build
    cancelled.flags[modulePromptFlag(s.projects[0]!.id)] = cancelled.stage
    expect(moduleAsk(cancelled)).toBeNull()
  })

  it('a fresh-enough module does not ask', () => {
    let s = company(['web'], 2)
    s = withModules(s, 0, ['feedback'], s.time.day - 100)
    s.flags[modulePromptFlag(s.projects[0]!.id)] = s.stage
    expect(moduleAsk(s)).toBeNull()
  })
})

describe('panel rows', () => {
  it('suggestModules gives at most 3, best first, and keeps a module the till cannot pay yet (with its reason)', () => {
    const s = company(['web'], 4)
    const rows = suggestModules(s, s.projects[0]!, 3)
    expect(rows).toHaveLength(3)
    expect(rows[0]!.id).toBe(suggestModule(s, s.projects[0]!))
    const poor = clone(s)
    poor.stats.cash = 10
    const sad = suggestModules(poor, poor.projects[0]!, 3)
    expect(sad).toHaveLength(3)
    expect(sad.every((o) => o.error === 'insufficientCash')).toBe(true)
  })

  // MV2a (rule change on purpose): tiers by version replace the stage gate; the web catalogue has 6 tier-1 modules.
  it('tier-locked modules stay out of the suggestions', () => {
    const s = company(['web'], 0)
    const ids = suggestModules(s, s.projects[0]!, 30).map((o) => o.id)
    expect(ids.sort()).toEqual(['analytics', 'feedback', 'landingPages', 'paywall', 'referral', 'seo'])
    expect(moduleOffers(s, s.projects[0]!).filter((o) => o.error === 'notUnlocked').length).toBeGreaterThan(0)
  })

  it('headlines: the biggest gain and the biggest minus; a category boost counts', () => {
    expect(moduleHeadlines('feedback', 'web')).toEqual({ gain: { kind: 'talk', mult: 1.5, good: true }, minus: { kind: 'updateWork', mult: 1.25, good: false } })
    expect(moduleHeadlines('onboarding', 'web').minus).toBeUndefined()
    // openApi on an api product: churn 0.88 → 1 − 0.12 × 1.5.
    expect(moduleHeadlines('openApi', 'api').gain!.mult).toBeCloseTo(0.82, 6)
  })

  it('buildStatus: fraction and days left follow the running build', () => {
    const s = company(['web'], 2)
    expect(buildStatus(s, s.projects[0]!)).toBeNull()
    const r = build(s, 0, 'feedback')
    if (!r.ok) throw new Error('build')
    const st = buildStatus(r.state, r.state.projects[0]!)!
    expect(st).toMatchObject({ id: 'feedback', refresh: false, fraction: 0 })
    expect(st.days === null || st.days > 0).toBe(true)
  })
})

function projectSlotsFull(s: ReturnType<typeof company>): boolean {
  const { used, total } = projectSlots(s, s.projects[0]!)
  return used >= total
}
