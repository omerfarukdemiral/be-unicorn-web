// Fix round 1: the find / talk slots are the founder's focus switch; the focused one is pressed and marked.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { applyAction, createGame, type GameState } from '../engine'
import { useGameStore } from '../store/gameStore'
import { FounderBar } from './layout/FounderBar'
import { t } from './i18n'

function garage(focus?: 'users' | 'talk' | 'build'): GameState {
  let s = applyAction(createGame({ seed: 1 }), { type: 'startProject', category: 'web' }).state
  if (focus) s = applyAction(s, { type: 'setFounderFocus', focus }).state
  return s
}

/** Server render of the CURRENT store: zustand's server snapshot reads the initial state, so it is swapped in. */
function render(state: GameState): string {
  useGameStore.setState({ state })
  const initial = useGameStore.getInitialState()
  const keep = initial.state
  Object.assign(initial, { state })
  try {
    return renderToStaticMarkup(createElement(FounderBar, { variant: 'bar' }))
  } finally {
    Object.assign(initial, { state: keep })
  }
}

const slot = (html: string, kind: string): string => html.match(new RegExp(`<button[^>]*data-slot="${kind}"[^>]*>`))?.[0] ?? ''

describe('founder focus switch', () => {
  it('no focus: both slots offer the switch, none is pressed', () => {
    const html = render(garage())
    expect(slot(html, 'findUsers')).toContain('aria-pressed="false"')
    expect(slot(html, 'findUsers')).toContain(t('focus.off'))
    expect(html).not.toContain('data-focus-mark')
  })

  it('users focus: the find slot is pressed, marked and says it runs by itself', () => {
    const html = render(garage('users'))
    expect(slot(html, 'findUsers')).toContain('aria-pressed="true"')
    expect(slot(html, 'findUsers')).toContain(t('focus.on'))
    expect(slot(html, 'talkToUsers')).toContain('aria-pressed="false"')
    expect(html.match(/data-focus-mark/g)).toHaveLength(1)
  })
})
