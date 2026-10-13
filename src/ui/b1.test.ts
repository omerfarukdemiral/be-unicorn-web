// Playtest bugs (round 3, B1): the person label, the post-mortem formats, the two-step tap, the bubble hit test.
import { describe, expect, it } from 'vitest'
import * as B from '../engine/balance'
import { company } from '../engine/__tests__/moduleFixtures'
import { fromBubble } from '../render/bubbleHit'
import { nextTap } from './hooks'
import { personLabel } from './effort'
import { PM_FORMAT } from './overlays/Overlays'

describe('personLabel', () => {
  it('a bored person with fatigue 0 is Sıkılıyor, not Yorgun', () => {
    const s = company(['web'], 2)
    const e = s.employees[0]!
    Object.assign(e, { status: 'tired', fatigue: 0, morale: 34, loadAvg: 0.3, boredDays: 40 })
    expect(personLabel(s, e).key).toBe('bored')
    expect(personLabel(s, e).text).toBe('Sıkılıyor')
  })
  it('order: fatigue first, then boredom, then low morale', () => {
    const s = company(['web'], 2)
    const e = s.employees[0]!
    Object.assign(e, { status: 'working', fatigue: B.FATIGUE_TIRED, morale: 34, loadAvg: 0.3, boredDays: 40 })
    expect(personLabel(s, e).key).toBe('tired')
    Object.assign(e, { fatigue: B.FATIGUE_BURNOUT })
    expect(personLabel(s, e).key).toBe('burnout')
    Object.assign(e, { fatigue: 0, boredDays: 0, loadAvg: 1 })
    expect(personLabel(s, e).key).toBe('lowMorale')
  })
})

describe('post-mortem formats', () => {
  it('no code prints a raw big number with a % sign', () => {
    for (const code of Object.keys(PM_FORMAT) as (keyof typeof PM_FORMAT)[]) {
      // Percent codes carry 0..1 shares; the unbounded ones (overload, weeks, burn…) carry big raw numbers.
      const out = PM_FORMAT[code](code === 'scaledWithoutPmf' || code === 'highChurn' ? 0.35 : 15.94)
      expect(out, code).not.toMatch(/%\s*\d{3,}|\d{3,}\s*%/)
    }
    expect(PM_FORMAT.overload(15.94)).toBe('16.9×')
    expect(PM_FORMAT.lateFundraise(3)).toBe('3 hafta')
  })
})

describe('two-step tap and bubble hit', () => {
  it('the first tap only arms, the second on the same key commits', () => {
    expect(nextTap(null, 'c1')).toBe('arm')
    expect(nextTap('c1', 'c1')).toBe('commit')
    expect(nextTap('c1', 'c2')).toBe('arm')
  })
  it('a target outside the DOM is not a bubble', () => {
    expect(fromBubble(undefined)).toBe(false)
    expect(fromBubble({ target: null })).toBe(false)
  })
})
