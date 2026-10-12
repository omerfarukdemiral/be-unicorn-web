// Project rename (W1): cleaned, capped, filtered with the company-name rules, unique, free, any time.
import { describe, expect, it } from 'vitest'
import { applyAction, createGame, type GameState } from '../index'
import { checkCompanyName } from '../names'
import { PROJECT_NAME_MAX } from '../balance'

function twoProjects(): GameState {
  let s = createGame({ seed: 7, companyName: 'Test' })
  for (const category of ['web', 'mobile'] as const) {
    const r = applyAction(s, { type: 'startProject', category })
    if (r.ok) s = r.state
  }
  return s
}

const rename = (s: GameState, i: number, name: string) => applyAction(s, { type: 'renameProject', projectId: s.projects[i]!.id, name })

describe('renameProject', () => {
  it('trims and collapses spaces', () => {
    const s = twoProjects()
    const r = rename(s, 0, '  Mavi   Kuş  ')
    expect(r.ok).toBe(true)
    expect(r.state.projects[0]!.name).toBe('Mavi Kuş')
  })

  it('truncates to 24 characters', () => {
    const s = twoProjects()
    const r = rename(s, 0, 'A'.repeat(30))
    expect(r.ok).toBe(true)
    expect(Array.from(r.state.projects[0]!.name)).toHaveLength(PROJECT_NAME_MAX)
  })

  it('rejects names that are too short, links or profanity (same table as the company name)', () => {
    const s = twoProjects()
    expect(checkCompanyName('a.com/x').ok).toBe(false)
    for (const bad of ['a', ' x ', 'a.com/x', 'siktir']) {
      const r = rename(s, 0, bad)
      expect(r.ok).toBe(false)
      expect(r.error).toBe('invalid')
      expect(r.state).toEqual(s)
    }
  })

  it("rejects another project's name in any case, and an unknown project", () => {
    const s = twoProjects()
    const other = s.projects[1]!.name
    const r = rename(s, 0, other.toLocaleUpperCase('tr'))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('invalid')
    expect(r.state).toEqual(s)
    expect(applyAction(s, { type: 'renameProject', projectId: 'nope', name: 'Zed' }).error).toBe('notFound')
  })

  it('treats Turkish dotted and dotless i as the same letter when comparing', () => {
    const s = twoProjects()
    const r = rename(s, 0, 'MOBİL-2')
    expect(rename(r.state, 1, 'mobıl-2').ok).toBe(false)
  })

  it('same name is a no-op without activity', () => {
    const s = twoProjects()
    const r = rename(s, 0, s.projects[0]!.name)
    expect(r.ok).toBe(true)
    expect(r.state.activity).toEqual(s.activity)
  })

  it('writes projectRenamed, costs nothing and keeps release history', () => {
    const s = twoProjects()
    s.releases = [{ ...(s.releases?.[0] ?? ({} as never)), projectId: s.projects[0]!.id, projectName: s.projects[0]!.name } as never]
    const old = s.projects[0]!.name
    const r = rename(s, 0, 'Yeni Ad')
    expect(r.ok).toBe(true)
    expect(r.state.activity.at(-1)).toMatchObject({ kind: 'projectRenamed', params: { from: old, to: 'Yeni Ad' } })
    expect(r.state.stats.cash).toBe(s.stats.cash)
    expect(r.state.releases?.[0]?.projectName).toBe(old)
  })
})
