// F6 ("para gidiyor, kişi gelmiyor"): a panel hire with no free desk was refused, the guidance sent the player to buy
// a desk, and the hire was never retried. The panel hire now carries the desk price and buys it in the same action.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { createGame, hireDeskCost } from '../../engine'
import { CONTENT } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { clone } from '../../engine/util'
import { money } from '../format'
import { t } from '../i18n'
import { TeamPanel } from './TeamPanel'

import TEAM_SRC from './TeamPanel.tsx?raw'

const store = () => useGameStore.getState()

/** Server render of the CURRENT store (zustand's server snapshot reads the initial state, so it is swapped in). */
function html(): string {
  const initial = useGameStore.getInitialState()
  const keep = { state: initial.state, ui: initial.ui }
  Object.assign(initial, { state: store().state, ui: store().ui })
  try {
    return renderToStaticMarkup(createElement(TeamPanel))
  } finally {
    Object.assign(initial, keep)
  }
}

const deskPrice = CONTENT.furniture.find((f) => f.id === 'desk-basic')!.price

describe('Team panel hire with no free desk (F6)', () => {
  beforeEach(() => useGameStore.setState({ state: createGame({ seed: 3 }) }))

  it('the hire button names the desk it will buy', () => {
    expect(hireDeskCost(store().state, CONTENT)).toBe(deskPrice)
    const out = html()
    expect(out).toContain(t('team.deskCost', { v: money(deskPrice) }))
    expect(out).toContain(t('team.needDeskItem'))
    expect(out).not.toContain('disabled=""')
  })

  it('the panel action hires and seats: one employee, cash down by the desk price, no stray desk', () => {
    const before = store().state
    const c = before.candidates[0]!
    const res = store().dispatch({ type: 'hire', candidateId: c.id, autoDesk: true })
    expect(res.ok).toBe(true)
    const s = store().state
    expect(s.employees).toHaveLength(1)
    expect(s.stats.cash).toBe(before.stats.cash - deskPrice)
    expect(s.office.slots.filter((x) => x.itemId !== undefined && x.type === 'desk' && x.id !== 'founder' && x.occupantId === undefined)).toHaveLength(0)
  })

  it('no desk slot left: the button is disabled and says why', () => {
    const s = clone(store().state)
    const open = new Set(s.office.rings.filter((r) => r.unlocked).map((r) => r.index))
    for (const x of s.office.slots) {
      if (x.type === 'desk' && x.id !== 'founder' && (x.ring === 0 || open.has(x.ring))) Object.assign(x, { itemId: 'desk-basic', occupantId: 'someone' })
    }
    useGameStore.setState({ state: s })
    const out = html()
    const hireButtons = out.match(/<button[^>]*data-cue="confirm"[^>]*>/g) ?? []
    expect(hireButtons.length).toBeGreaterThan(0)
    for (const b of hireButtons) {
      expect(b).toContain('disabled=""')
      expect(b).toContain(`title="${t('team.noSlot')}"`)
    }
  })

  it('the panel never dispatches a hire without autoDesk', () => {
    const hires = [...TEAM_SRC.matchAll(/type: 'hire'[^}]*}/g)].map((m) => m[0])
    expect(hires.length).toBeGreaterThan(0)
    for (const h of hires) expect(h).toContain('autoDesk: true')
  })
})
