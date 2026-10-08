// Garage levers and the play style (playtest 2026-10-08): ads / price / sales from day 0, the style read from the
// levers, style cards only for a matching player, old saves get the levers on load.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { createEngine } from '../index'
import { serialize, deserialize } from '../save'
import { isCardEligible } from '../decisions'
import { playStyle } from '../style'
import { CONTENT, STYLE_CARDS } from '../../content/index'
import type { GameState } from '../types'

const api = createEngine(CONTENT)

/** A garage with one live project and `users`, one day stepped so derived numbers are fresh. */
function live(seed = 3, users = 400): GameState {
  let s = api.createGame({ seed })
  s = api.applyAction(s, { type: 'startProject', category: 'mobile' }).state
  return api.step({ ...s, projects: s.projects.map((p) => ({ ...p, maturity: 0.3, launched: true, releaseLevel: 1 })), stats: { ...s.stats, users } }, 1)
}

describe('garage levers', () => {
  it('ads and price are open on day 0; a sales call waits for a live product', () => {
    const s = api.createGame({ seed: 1 })
    for (const t of B.INITIAL_TOOLS) expect(s.unlockedTools).toContain(t)
    expect(api.applyAction(s, { type: 'setAdBudget', amount: 500 }).ok).toBe(true)
    expect(api.applyAction(s, { type: 'setPrice', multiplier: 1.3 }).ok).toBe(true)
    expect(api.applyAction(s, { type: 'founderAction', kind: 'salesCall' })).toMatchObject({ ok: false, error: 'notFound' })
    expect(api.applyAction(live(), { type: 'founderAction', kind: 'salesCall' }).ok).toBe(true)
  })

  it('a save from before the change gets the garage levers on load', () => {
    const s = api.createGame({ seed: 2 })
    const old = deserialize(serialize({ ...s, unlockedTools: [] }))
    expect(old?.unlockedTools).toEqual(expect.arrayContaining([...B.INITIAL_TOOLS]))
  })
})

describe('play style', () => {
  it('reads the lever the player leans on: ads, price, contracts, products', () => {
    const base = live()
    expect(playStyle(base)).toBeNull()
    const ads = api.step(api.applyAction(base, { type: 'setAdBudget', amount: 2000 }).state, 1)
    expect(playStyle(ads)).toBe('vcRocket')
    const price = api.step(api.applyAction(base, { type: 'setPrice', multiplier: 1.6 }).state, 1)
    expect(playStyle(price)).toBe('bootstrap')
    const deal = api.step({ ...base, finance: { ...base.finance, enterpriseCustomers: [{ id: 'c1', name: 'X', mrr: 5000, sinceDay: 0, untilDay: 400 }] } }, 1)
    expect(playStyle(deal)).toBe('niche')
    const two = api.step(api.applyAction(base, { type: 'startProject', category: 'web' }).state, 1)
    expect(playStyle(two)).toBe('platform')
  })

  it('a style card is only eligible for a player of that style', () => {
    const card = STYLE_CARDS.find((c) => c.style === 'vcRocket' && c.stage === 0)!
    const base = live()
    expect(isCardEligible(card, base)).toBe(false)
    const ads = api.step(api.applyAction(base, { type: 'setAdBudget', amount: 2000 }).state, 1)
    expect(isCardEligible(card, ads)).toBe(true)
  })
})
