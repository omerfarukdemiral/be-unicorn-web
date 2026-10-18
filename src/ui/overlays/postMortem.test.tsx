// N-E: a run that ends with nobody left names the cash, not "1 kişi".
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createGame, type GameState } from '../../engine'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { PostMortemOverlay } from './Overlays'

function render(state: GameState): string {
  useGameStore.setState({ state })
  const initial = useGameStore.getInitialState()
  const keep = initial.state
  Object.assign(initial, { state })
  try {
    return renderToStaticMarkup(createElement(PostMortemOverlay))
  } finally {
    Object.assign(initial, { state: keep })
  }
}

describe('post-mortem cause', () => {
  it('team lost: the cause line is the cash that could not hire again', () => {
    const s = createGame({ seed: 1 })
    s.stats.cash = -92
    s.gameOver = { kind: 'teamLost', day: 345, reasons: [{ code: 'teamLost', value: 1 }, { code: 'runwayIgnored', value: 0, conceptId: 'runway' }], xpEarned: 1 }
    const html = render(s)
    expect(html).toContain(t('pm.teamLostCash'))
    expect(html).toContain('Kasa')
    expect(html).not.toContain(t('unit.people', { v: 1 }))
  })

  it('bankrupt: the first reason as before', () => {
    const s = createGame({ seed: 1 })
    s.gameOver = { kind: 'bankrupt', day: 200, reasons: [{ code: 'burnTooHigh', value: 3000 }], xpEarned: 1 }
    expect(render(s)).toContain(t('postMortem.burnTooHigh'))
  })
})
