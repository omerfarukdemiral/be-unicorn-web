// Focus rules on the engine side (docs/CORE_LOOP.md §3.2): paused start, no timed decision cards.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { createEngine } from '../index'
import { fakeCard, fakeContent } from './fixtures'

const api = createEngine(fakeContent({ decisions: [fakeCard('c1')] }))

describe('focus: engine side', () => {
  it('createGame starts paused (speed 0): game and sim agree, the player presses Başlat', () => {
    expect(api.createGame({ seed: 1 }).time.speed).toBe(0)
    // step() does not care about the speed: the sim steps a paused game directly.
    expect(api.step(api.createGame({ seed: 1 }), 1).time.day).toBeCloseTo(1, 6)
  })

  it('a decision visitor waits for the answer: card and visitor outlive the old 20-day timer', () => {
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    const active = s.decisions.active!
    expect(active.cardId).toBe('c1')
    const vid = active.visitorId!
    s = api.step(s, 90)
    expect(s.decisions.active?.cardId).toBe('c1')
    const v = s.visitors.find((x) => x.id === vid)!
    expect(v).toBeDefined()
    // Render walks a visitor out at leaveDay: it must stay far in the future while the card is open.
    expect(v.leaveDay).toBeGreaterThan(s.time.day + 1000)
    expect(Number.isFinite(v.leaveDay)).toBe(true)
    // Answering sends the visitor off.
    s = api.applyAction(s, { type: 'answerDecision', cardId: 'c1', optionIndex: 0 }).state
    expect(s.visitors.find((x) => x.id === vid)!.leaveDay).toBeLessThanOrEqual(s.time.day)
    s = api.step(s, 1)
    expect(s.visitors.some((x) => x.id === vid)).toBe(false)
  })

  it('an old save with a 20-day decision visitor gets its leaveDay pushed out', () => {
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    const vid = s.decisions.active!.visitorId!
    const old = structuredClone(s)
    const ov = old.visitors.find((x) => x.id === vid)!
    ov.leaveDay = ov.arriveDay + 20
    const next = api.step(old, 25)
    const nv = next.visitors.find((x) => x.id === vid)!
    expect(nv.leaveDay).toBe(nv.arriveDay + B.DECISION_VISITOR_WAIT_DAYS)
  })
})
