import { describe, expect, it } from 'vitest'
import * as B from '../engine/balance'
import type { Employee, PersonEffort } from '../engine/types'
import { declutterPlates, plateWidths, CROWD_PX, LOW_MORALE, STACK_PX, crowdedIds, stackedIds, fatigueTone, hasOwnBubble, plateCompact, plateGlyph, plateSalary, plateShown, popScale, shortName } from './headPlate'

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

  it('stacking (grid step 6): of plates closer than STACK_PX the front one stays, the ones behind step aside', () => {
    // b is in front (lower on screen); a sits right behind it, c behind a but clear of b, d far away.
    const hide = stackedIds([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 12 }, { id: 'c', x: -20, y: -25 }, { id: 'd', x: 300, y: 0 }])
    expect([...hide].sort()).toEqual(['a'])
    expect(stackedIds([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: STACK_PX, y: 0 }]).size).toBe(0)
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

describe('declutterPlates (fix round 2 N5)', () => {
  const w = { full: 90, name: 60, icon: 30 }
  const box = (id: string, x: number, y: number, pinned = false) => ({ id, x, y, w, h: 28, pinned })
  it('never overlaps: the one behind drops its salary, then its name, then hides', () => {
    expect(declutterPlates([box('a', 0, 100), box('b', 400, 100)])).toEqual(new Map([['a', 'full'], ['b', 'full']]))
    // 80 px apart: two whole plates touch; with the salary gone (60 px) they clear.
    expect(declutterPlates([box('front', 0, 100), box('back', 80, 90)]).get('back')).toBe('name')
    expect(declutterPlates([box('front', 0, 100), box('back', 62, 90)]).get('back')).toBe('icon')
    expect(declutterPlates([box('front', 0, 100), box('back', 5, 95)]).get('back')).toBe('hidden')
    expect(declutterPlates([box('front', 0, 100), box('back', 5, 95)]).get('front')).toBe('full')
  })
  it('the hovered / selected plate always shows whole, even behind another one', () => {
    const m = declutterPlates([box('front', 0, 100), box('sel', 5, 95, true)])
    expect(m.get('sel')).toBe('full')
    expect(m.get('front')).toBe('hidden')
  })
  it('the farthest zoom is icons only', () => {
    expect(declutterPlates([box('a', 0, 100)], 'icon').get('a')).toBe('icon')
  })
  it('widths grow with the text', () => {
    const a = plateWidths({ name: 'Ali', salary: '$1K', lead: false, glyph: null })
    const b = plateWidths({ name: 'Nazlıcan', salary: '$12K', lead: true, glyph: 'tired' })
    expect(a.icon).toBeLessThan(a.name)
    expect(a.name).toBeLessThan(a.full)
    expect(b.full).toBeGreaterThan(a.full)
  })
})
