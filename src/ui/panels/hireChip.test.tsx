// Round 9: a chip hire move opens Ekip on the department it names, its pick first and marked.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { createGame, type GameState } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { markChipTarget } from '../chipTarget'
import { TeamPanel } from './TeamPanel'

function render(state: GameState): string {
  useGameStore.setState({ state })
  const initial = useGameStore.getInitialState()
  const keep = initial.state
  Object.assign(initial, { state })
  try {
    return renderToStaticMarkup(createElement(TeamPanel))
  } finally {
    Object.assign(initial, { state: keep })
  }
}

afterEach(() => markChipTarget(null))

describe('chip hire move in Ekip', () => {
  it('filters to the named department and puts the pick first, marked', () => {
    const s = createGame({ seed: 5 })
    const mk = (id: string, dept: 'eng' | 'marketing' | 'sales', salary: number) => ({ id, name: id.toUpperCase(), dept, quality: 1, salary, expiresDay: 60 }) as GameState['candidates'][number]
    // A cheaper marketer first in the pool: the old view led with it.
    s.candidates = [mk('m1', 'marketing', 800), mk('e1', 'eng', 1500), mk('e2', 'eng', 1200), mk('s1', 'sales', 900)]
    markChipTarget('candidate:e1')
    const html = render(s)
    // Only engineers, e1 before e2, and e1 marked.
    expect(html).not.toContain('>M1<')
    expect(html).not.toContain('>S1<')
    expect(html.indexOf('>E1<')).toBeGreaterThan(-1)
    expect(html.indexOf('>E1<')).toBeLessThan(html.indexOf('>E2<'))
    expect(html).toContain('ring-brand')
  })

  it('without a chip mark the view lists everyone', () => {
    const s = createGame({ seed: 5 })
    const html = render(s)
    for (const c of s.candidates) expect(html).toContain(c.name)
  })
})
