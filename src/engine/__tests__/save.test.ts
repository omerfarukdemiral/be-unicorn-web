// Saves and project modules (W2a): no version bump, the new fields round-trip, a v4 save without them loads as before.
import { describe, expect, it } from 'vitest'
import { recomputeDerived } from '../derive'
import { projectSlots } from '../modules'
import { deserialize, serialize } from '../save'
import { SAVE_VERSION, type GameState } from '../types'
import { clone } from '../util'
import { api, build, company, content, current, legacy, withModules } from './moduleFixtures'

describe('save and modules', () => {
  it('SAVE_VERSION stays 4 (every module field is optional)', () => {
    expect(SAVE_VERSION).toBe(4)
  })

  it('modules and a running build round-trip', () => {
    const s = build(withModules(company(['web', 'mobile'], 3), 1, ['paywall', 'analytics'], 12), 0, 'feedback').state
    s.projects[0]!.build!.progress = 0.03
    const back = deserialize(serialize(s))!
    expect(back).toEqual(s)
    expect(back.projects[0]!.build).toEqual({ id: 'feedback', progress: 0.03, startDay: s.time.day })
    expect(back.projects[1]!.modules).toEqual([{ id: 'paywall', day: 12 }, { id: 'analytics', day: 12 }])
  })

  it('a game saved mid-build and loaded reaches the same state as one never saved', () => {
    const s = build(company(['web'], 2), 0, 'paywall').state
    let a = api.step(s, 3)
    let b = deserialize(serialize(a))!
    for (let i = 0; i < 40; i++) {
      a = api.step(a, 1)
      b = api.step(b, 1)
    }
    expect(a.projects[0]!.modules?.map((m) => m.id)).toEqual(['paywall'])
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })

  it('an older v4 save (finished projects, no module fields) loads, steps, has free slots and the old economy', () => {
    const s = api.step(company(['web', 'game'], 2), 30)
    const raw = JSON.parse(serialize(s)) as { version: number; state: GameState }
    for (const p of raw.state.projects) {
      delete p.modules
      delete p.build
      // Nor the A1 per-product users (an older save never had them).
      delete p.users
      delete p.acq
      delete p.lost
      delete p.rev
      delete p.snaps
    }
    delete raw.state.derived.projectMix
    const loaded = deserialize(JSON.stringify(raw))!
    expect(loaded).not.toBeNull()
    expect(loaded.projects.every((p) => p.maturity === 1 && p.modules === undefined)).toBe(true)
    for (const p of loaded.projects) expect(projectSlots(loaded, p)).toEqual({ used: 0, total: 2 })
    const fresh = clone(loaded)
    recomputeDerived(fresh, content)
    expect(current(fresh)).toEqual(legacy(clone(loaded)))
    const later = api.step(loaded, 30)
    expect(later.gameOver).toBeUndefined()
    expect(later.projects.every((p) => p.modules === undefined)).toBe(true)
    // A1 (rule change on purpose): the mix view is written once a product is live, its weights are the user shares.
    expect(Object.values(later.derived.projectMix!).every((x) => Object.keys(x.mult).length === 0 && x.upkeep === 0)).toBe(true)
    const withOne = withModules(later, 0, ['paywall'])
    const total = later.projects.reduce((a, p) => a + p.users!, 0)
    expect(Object.values(withOne.derived.projectMix!).map((x) => x.weight)).toEqual(later.projects.map((p) => expect.closeTo(p.users! / total, 12)))
  })
})
