// Fix round 1: the find / talk slots are the founder's focus switch; the focused one is pressed and marked.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { applyAction, createGame, type GameState } from '../engine'
import { useGameStore } from '../store/gameStore'
import { FounderBar } from './layout/FounderBar'
import { focusTap } from './FounderActions'
import { DeskBubble } from './bubbles/DeskBubble'
import { openBubble } from './bubbles/Expandable'
import { t } from './i18n'

function garage(focus?: 'users' | 'talk' | 'build'): GameState {
  let s = applyAction(createGame({ seed: 1 }), { type: 'startProject', category: 'web' }).state
  if (focus) s = applyAction(s, { type: 'setFounderFocus', focus }).state
  return s
}

/** Server render of the CURRENT store: zustand's server snapshot reads the initial state, so it is swapped in. */
function render(state: GameState, el: Parameters<typeof renderToStaticMarkup>[0] = createElement(FounderBar, { variant: 'bar' })): string {
  useGameStore.setState({ state })
  const initial = useGameStore.getInitialState()
  const keep = { state: initial.state, ui: initial.ui }
  Object.assign(initial, { state, ui: useGameStore.getState().ui })
  try {
    return renderToStaticMarkup(el)
  } finally {
    Object.assign(initial, keep)
  }
}

const desk = (state: GameState): string => {
  openBubble('desk:actions')
  return render(state, createElement(DeskBubble, { bubbleKey: 'desk:actions', topic: 'actions' }))
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

  it('N3: a tap on the slot already in focus keeps it; another slot switches', () => {
    expect(focusTap('users', 'users')).toBeNull()
    expect(focusTap('users', 'talk')).toBe('talk')
    expect(focusTap('build', 'users')).toBe('users')
  })

  it('N3: the desk bubble shows the three foci, the active one marked; Kod yaz is there to go back', () => {
    const html = desk(garage('users'))
    for (const k of ['users', 'talk', 'build'] as const) expect(html).toContain(t(`focus.row.${k}`))
    const row = (label: string) => html.match(new RegExp(`<button[^>]*aria-pressed="(true|false)"[^>]*>(?:(?!</button>).)*${label}`))?.[1]
    expect(row(t('focus.row.users'))).toBe('true')
    expect(row(t('focus.row.build'))).toBe('false')
    expect(html).toContain(t('focus.tag'))
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    // Back on build: the Kod yaz row is the marked one.
    const built = desk(garage('build'))
    expect(built.match(new RegExp(`<button[^>]*aria-pressed="true"[^>]*>(?:(?!</button>).)*${t('focus.row.build')}`))).not.toBeNull()
  })
})
