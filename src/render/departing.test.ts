import { describe, expect, it } from 'vitest'
import { diffDeparting, fadeScale, mergeGhosts, pruneGhosts, type Seen } from './departing'

const seen = (id: string, kind: 'employee' | 'visitor', leaving = false): Seen<null> => ({ id, kind, leaving, data: null })

describe('departing ghosts', () => {
  it('only people missing from the next state become ghosts', () => {
    const g = diffDeparting([seen('a', 'employee'), seen('b', 'employee'), seen('v', 'visitor')], new Set(['a']), 100)
    expect(g.map((x) => x.id)).toEqual(['b', 'v'])
    expect(g.every((x) => x.since === 100)).toBe(true)
  })

  it('leavers and visitors walk out, anyone else (a firing) fades in place', () => {
    const g = diffDeparting([seen('fired', 'employee'), seen('quit', 'employee', true), seen('v', 'visitor')], new Set<string>(), 0)
    expect(Object.fromEntries(g.map((x) => [x.id, x.mode]))).toEqual({ fired: 'fade', quit: 'walk', v: 'walk' })
  })

  it('merge keeps one ghost per id and drops anyone back in state', () => {
    const a = diffDeparting([seen('a', 'employee'), seen('b', 'visitor')], new Set<string>(), 0)
    const again = diffDeparting([seen('a', 'employee', true)], new Set<string>(), 5)
    const merged = mergeGhosts(a, again, new Set(['b']))
    expect(merged.map((x) => [x.id, x.mode, x.since])).toEqual([['a', 'walk', 5]])
  })

  it('prune drops finished and overstaying ghosts', () => {
    const g = diffDeparting([seen('a', 'employee'), seen('b', 'visitor'), seen('c', 'visitor')], new Set<string>(), 0)
    expect(pruneGhosts(g, new Set(['a']), 10).map((x) => x.id)).toEqual(['b', 'c'])
    expect(pruneGhosts(g, new Set<string>(), 30000, 20000)).toEqual([])
  })

  it('a fade shrinks from 1 to 0 and stays there', () => {
    expect(fadeScale(0)).toBe(1)
    expect(fadeScale(125)).toBeGreaterThan(0)
    expect(fadeScale(125)).toBeLessThan(1)
    expect(fadeScale(250)).toBe(0)
    expect(fadeScale(9999)).toBe(0)
  })
})
