// Source floats (P5): which jump floats, what it is called, one at a time.
import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import type { GameEvent, GameState } from '../engine/types'
import { detectFloats, emptyAcc, USERS_WINDOW_DAYS } from './sourceFloats'

const base = (): GameState => createGame({ seed: 3 })
const clone = (s: GameState): GameState => structuredClone(s)
const withEvent = (s: GameState, e: Omit<GameEvent, 'id' | 'day'>): GameState => {
  const id = (s.events[s.events.length - 1]?.id ?? 0) + 1
  return { ...s, events: [...s.events, { id, day: s.time.day, ...e }] }
}

describe('source floats', () => {
  it('a purchase floats with its name, red and with a real minus', () => {
    const a = base()
    const b = clone(a)
    b.stats.cash -= 2000
    const r = detectFloats(a, b, { type: 'placeItem', itemId: 'desk-basic' as never }, emptyAcc())
    expect(r.floats).toEqual([{ gauge: 'cash', text: 'Alım −⁠$2K', good: false }])
  })

  it('a round close floats green under its own name; small drift does not float', () => {
    const a = base()
    const b = withEvent(clone(a), { kind: 'roundClosed', value: 500_000 })
    b.stats.cash += 500_000
    expect(detectFloats(a, b, null, emptyAcc()).floats[0]).toMatchObject({ gauge: 'cash', good: true, text: 'Yatırım +⁠$500K' })
    const c = clone(a)
    c.stats.cash -= 40
    expect(detectFloats(a, c, null, emptyAcc()).floats).toEqual([])
  })

  it('payday floats its lump', () => {
    const a = base()
    const b = withEvent(clone(a), { kind: 'payday', value: 7300 })
    expect(detectFloats(a, b, null, emptyAcc()).floats).toEqual([{ gauge: 'cash', text: 'Maaş günü −⁠$7.3K', good: false }])
  })

  it('the slow user flow sums over a week and names its biggest channel', () => {
    const a = base()
    a.derived.channels = { organic: 10, paid: 120, manual: 0, enterprise: 0 }
    let acc = emptyAcc()
    let prev = a
    const out: string[] = []
    for (let d = 1; d <= USERS_WINDOW_DAYS; d++) {
      const next = clone(prev)
      next.time.day += 1
      next.stats.users += 4
      const r = detectFloats(prev, next, null, acc)
      acc = r.acc
      out.push(...r.floats.map((f) => f.text))
      prev = next
    }
    expect(out).toEqual(['Reklam +28'])
    expect(acc).toEqual(emptyAcc())
  })

  it('a release floats at once', () => {
    const a = base()
    const b = withEvent(clone(a), { kind: 'release', value: 1 })
    b.stats.users += 60
    expect(detectFloats(a, b, null, emptyAcc()).floats).toEqual([{ gauge: 'users', text: 'Sürüm +60', good: true }])
  })
})

describe('first-run hints (P5)', async () => {
  const { hintBase, hintDue } = await import('./firstHints')
  it('each of the five fires on its own meaningful move only', () => {
    const a = base()
    const b0 = hintBase(a)
    const b = clone(a)
    expect(['cash', 'users', 'energy', 'morale', 'runway'].map((id) => hintDue(id as never, b0, b))).toEqual([false, false, false, false, false])
    b.stats.cash -= 1000
    b.stats.users += 3
    b.founder.energy -= 15
    b.stats.morale += 2
    expect(hintDue('cash', b0, b)).toBe(true)
    expect(hintDue('users', b0, b)).toBe(true)
    expect(hintDue('energy', b0, b)).toBe(true)
    expect(hintDue('morale', b0, b)).toBe(false)
    b.unlockedWidgets = [...b.unlockedWidgets, 'runway']
    expect(hintDue('runway', b0, b)).toBe(true)
  })
})
