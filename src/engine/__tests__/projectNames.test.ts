// Default project names (fix round F8): readable, from the content list, deterministic per seed; old slug saves heal.
import { describe, expect, it } from 'vitest'
import { PROJECT_NAMES } from '../../content/names'
import { applyAction, createGame, deserialize, serialize, type GameState } from '../index'
import { defaultProjectName, isSlugName } from '../projectNames'
import { PROJECT_CATEGORIES } from '../types'

function run(seed: number, n = 3): GameState {
  let s = createGame({ seed, companyName: 'Test' })
  for (let i = 0; i < n; i++) {
    const r = applyAction(s, { type: 'startProject', category: PROJECT_CATEGORIES[i % PROJECT_CATEGORIES.length]! })
    expect(r.ok).toBe(true)
    s = r.state
  }
  return s
}

describe('default project names', () => {
  it('an unnamed project gets a name from the list, never a slug, unique within the run', () => {
    const names = run(3, 6).projects.map((p) => p.name)
    for (const n of names) {
      expect(PROJECT_NAMES).toContain(n)
      expect(isSlugName(n)).toBe(false)
    }
    expect(new Set(names).size).toBe(names.length)
  })

  it('is deterministic per seed and differs between seeds', () => {
    expect(run(3).projects.map((p) => p.name)).toEqual(run(3).projects.map((p) => p.name))
    const firsts = new Set(Array.from({ length: 8 }, (_, i) => defaultProjectName(i + 1, 1, [])))
    expect(firsts.size).toBeGreaterThan(4)
  })

  it('does not draw from the rng (bot runs keep their numbers)', () => {
    const s = createGame({ seed: 5, companyName: 'Test' })
    const named = applyAction(s, { type: 'startProject', category: 'web', name: 'Pusula' }).state
    const unnamed = applyAction(s, { type: 'startProject', category: 'web' }).state
    expect(unnamed.rng).toEqual(named.rng)
  })

  it('a typed name still wins; a taken default is skipped', () => {
    const s = createGame({ seed: 9, companyName: 'Test' })
    const first = defaultProjectName(9, 1, [])
    const a = applyAction(s, { type: 'startProject', category: 'web', name: first }).state
    expect(a.projects[0]!.name).toBe(first)
    const b = applyAction(a, { type: 'startProject', category: 'api' }).state
    expect(b.projects[1]!.name).not.toBe(first)
    expect(PROJECT_NAMES).toContain(b.projects[1]!.name)
  })

  it('past the list it numbers the first pick', () => {
    expect(defaultProjectName(1, 1, PROJECT_NAMES)).toMatch(/ 2$/)
  })

  it('an old save with slug names loads with readable ones; releases and the feed follow', () => {
    const s = run(4, 2)
    s.projects[0]!.name = 'marketplace-1'
    s.projects[1]!.name = 'Benim Ürünüm'
    s.releases = [{ id: 'rel1', day: 10, projectId: s.projects[0]!.id, projectName: 'marketplace-1', level: 1, users: 5, mrr: 0 }]
    s.activity.push({ id: 999, day: 10, kind: 'projectStarted', params: { project: 'marketplace-1', id: s.projects[0]!.id, category: 'marketplace' } })
    const loaded = deserialize(serialize(s))!
    expect(loaded).not.toBeNull()
    const name = loaded.projects[0]!.name
    expect(isSlugName(name)).toBe(false)
    expect(PROJECT_NAMES).toContain(name)
    expect(loaded.projects[1]!.name).toBe('Benim Ürünüm')
    expect(loaded.releases?.[0]?.projectName).toBe(name)
    expect(loaded.activity.at(-1)?.params?.project).toBe(name)
    // Loading twice changes nothing more.
    expect(deserialize(serialize(loaded))!.projects.map((p) => p.name)).toEqual(loaded.projects.map((p) => p.name))
  })
})
