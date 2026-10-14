import { describe, expect, it } from 'vitest'
import * as B from '../engine/balance'
import type { Employee, PersonEffort } from '../engine/types'
import { CROWD_PX, LOW_MORALE, crowdedIds, fatigueTone, hasOwnBubble, plateCompact, plateGlyph, plateSalary, plateShown, popScale, shortName } from './headPlate'

const emp = (over: Partial<Employee>): Employee =>
  ({ id: 'e1', name: 'Ebru Kaya', dept: 'eng', quality: 1, salary: 1700, status: 'working', statusSinceDay: 0, hiredDay: 0, deskSlotId: 'd1', projectId: 'p1', morale: 70, ...over }) as Employee
const view: PersonEffort = { load: 1, fatigueFactor: 1, pace: 'normal', fit: false, flow: false }
const fx = (day = 10) => ({ day, people: { e1: view } })

describe('head plate (H1): state glyph', () => {
  it('one glyph: tired over low morale over bored (moved here from the desk badges)', () => {
    const worn = { fatigue: 70, morale: 10, loadAvg: 0.2 }
    expect(plateGlyph(emp(worn), fx())).toBe('tired')
    expect(plateGlyph(emp({ ...worn, fatigue: 10 }), fx())).toBe('morale')
    expect(plateGlyph(emp({ ...worn, fatigue: 10, morale: 70 }), fx())).toBe('bored')
    expect(plateGlyph(emp({ ...worn, fatigue: 10, morale: 70, loadAvg: 1 }), fx())).toBeNull()
    expect(plateGlyph(emp({ morale: LOW_MORALE - 1 }))).toBe('morale')
  })

  it('leaving / burnout speak for themselves; on leave nothing is tired or bored; sales is never bored', () => {
    expect(plateGlyph(emp({ fatigue: 90, status: 'burnout' }), fx())).toBeNull()
    expect(plateGlyph(emp({ fatigue: 70, offUntil: 20, status: 'break' }), fx())).toBeNull()
    expect(plateGlyph(emp({ dept: 'sales', loadAvg: 0.1 }), fx())).toBeNull()
  })

  it('without the effort view (the garage) there is no tired / bored glyph', () => {
    expect(plateGlyph(emp({ fatigue: 90, loadAvg: 0.1 }))).toBeNull()
  })
})

describe('head plate (H1): text and bar', () => {
  it('fatigue tone: green under 40, amber 40-59, red from FATIGUE_TIRED', () => {
    expect(fatigueTone(0)).toBe('ok')
    expect(fatigueTone(39)).toBe('ok')
    expect(fatigueTone(40)).toBe('warn')
    expect(fatigueTone(B.FATIGUE_TIRED - 1)).toBe('warn')
    expect(fatigueTone(B.FATIGUE_TIRED)).toBe('bad')
  })

  it('first name, cut at 8 characters; salary as $1.7K', () => {
    expect(shortName('Ebru Kaya')).toBe('Ebru')
    expect(shortName('Büşra Nur Aksoy')).toBe('Büşra')
    expect(shortName('Mehmetcan Yıldız')).toBe('Mehmetc…')
    expect(plateSalary(1700)).toBe('$1.7K')
    expect(plateSalary(800)).toBe('$800')
    expect(plateSalary(12400)).toBe('$12K')
    expect(plateSalary(2000)).toBe('$2K')
  })
})

describe('head plate (H1): when it shows', () => {
  const ok = { seated: true, covered: false, ownBubble: false, overlapsBubble: false }
  it('only while seated; hidden walking, away, covered, with an own bubble or touching one', () => {
    expect(plateShown(ok)).toBe(true)
    expect(plateShown({ ...ok, seated: false })).toBe(false)
    expect(plateShown({ ...ok, covered: true })).toBe(false)
    expect(plateShown({ ...ok, ownBubble: true })).toBe(false)
    expect(plateShown({ ...ok, overlapsBubble: true })).toBe(false)
  })

  it('compact at the farthest zoom or when crowded', () => {
    expect(plateCompact(0, false)).toBe(true)
    expect(plateCompact(1, false)).toBe(false)
    expect(plateCompact(2, true)).toBe(true)
  })

  it('crowding: both plates of a pair closer than CROWD_PX, nobody else', () => {
    const set = crowdedIds([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: CROWD_PX - 1, y: 0 }, { id: 'c', x: 300, y: 0 }])
    expect([...set].sort()).toEqual(['a', 'b'])
    expect(crowdedIds([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: CROWD_PX, y: 0 }]).size).toBe(0)
  })
})

describe('pop sprite size (H1)', () => {
  it('never under 20 CSS px: scale = max(base, 20 / pxPerWorldUnit)', () => {
    expect(popScale(0.4, 25)).toBeCloseTo(0.8)
    expect(popScale(0.4, 100)).toBe(0.4)
    expect(popScale(0.4, 0)).toBe(0.4)
  })
})

describe('head plate (H1): own bubble', () => {
  it('matches the speaker id exactly, not as a substring', () => {
    expect(hasOwnBubble('e1', ['e12', 'desk', undefined])).toBe(false)
    expect(hasOwnBubble('e12', ['e12'])).toBe(true)
  })
})
