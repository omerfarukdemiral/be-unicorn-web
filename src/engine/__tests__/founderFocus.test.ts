// Founder focus (fix round 1): one tap sets what the founder repeats every day; no click per unit of work.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { focusWait } from '../founder'
import { createEngine } from '../index'
import type { GameState } from '../types'
import { fakeContent } from './fixtures'

const api = createEngine(fakeContent())

function garage(seed = 1): GameState {
  return api.applyAction(api.createGame({ seed }), { type: 'startProject', category: 'web' }).state
}

const focus = (s: GameState, f: 'users' | 'talk' | 'build', targetId?: string): GameState => {
  const r = api.applyAction(s, { type: 'setFounderFocus', focus: f, ...(targetId ? { targetId } : {}) })
  expect(r.ok).toBe(true)
  return r.state
}

describe('founder focus', () => {
  it('a new game has none: the founder codes, nothing repeats', () => {
    const s = api.step(garage(), 10)
    expect(s.founder.focus).toBeUndefined()
    expect(focusWait(s)).toBe('build')
    expect(s.counters.manualFinds ?? 0).toBe(0)
  })

  it('rejects an unknown focus or a missing project', () => {
    const s = garage()
    expect(api.applyAction(s, { type: 'setFounderFocus', focus: 'nap' as 'users' }).ok).toBe(false)
    expect(api.applyAction(s, { type: 'setFounderFocus', focus: 'talk', targetId: 'nope' }).ok).toBe(false)
  })

  it('garage: users repeats "Elle kullanıcı bul" on its own, never under the energy floor, and rests on a spent circle', () => {
    let s = focus(garage(), 'users')
    s = api.step(s, 2)
    expect(s.counters.manualFinds ?? 0).toBeGreaterThanOrEqual(1)
    let low = 100
    for (let d = 0; d < 26; d++) {
      s = api.step(s, 1)
      low = Math.min(low, s.founder.energy)
    }
    expect(low).toBeGreaterThanOrEqual(B.FOCUS_ENERGY_FLOOR)
    // Within one month the circle halves twice: the focus stops below FOCUS_FIND_MIN_FACTOR and the founder codes.
    const finds = s.counters.manualFinds ?? 0
    expect(finds).toBeGreaterThanOrEqual(B.FIND_USERS_FULL_PER_MONTH)
    expect(finds).toBeLessThanOrEqual(B.FIND_USERS_FULL_PER_MONTH * 2)
  })

  it('talk repeats on the chosen project; build stops it', () => {
    let s = garage()
    const id = s.projects[0]!.id
    s = focus(s, 'talk', id)
    expect(s.founder.focusTarget).toBe(id)
    s = api.step(s, 12)
    const talks = s.counters.userTalks ?? 0
    expect(talks).toBeGreaterThanOrEqual(2)
    s = focus(s, 'build')
    expect(s.founder.focusTarget).toBeUndefined()
    s = api.step(s, 12)
    expect(s.counters.userTalks ?? 0).toBeLessThanOrEqual(talks + 1)
  })

  it('on the move budget it takes only the week’s leftover moves, at the week’s end, and keeps one in hand', () => {
    let s = focus(garage(), 'talk')
    s = { ...s, stage: 1, founder: { ...s.founder, moves: { left: 3, weekStart: 7 }, cooldowns: {} }, time: { ...s.time, day: 7.01 } }
    s = api.step(s, 0.5)
    expect(focusWait(s)).toBe('week')
    expect(s.founder.currentAction).toBeUndefined()
    // Day 10.1: three moves, four days to the refill on day 14: they would expire, so the focus starts.
    s = api.step(s, 2.6)
    expect(s.founder.currentAction?.kind).toBe('talkToUsers')
    s = api.step(s, 3.5)
    expect(s.founder.moves?.left).toBe(B.FOCUS_KEEP_MOVES)
  })
})
