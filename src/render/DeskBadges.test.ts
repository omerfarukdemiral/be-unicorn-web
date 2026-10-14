import { describe, expect, it } from 'vitest'
import type { Employee } from '../engine/types'
import type { PersonEffort } from '../engine/types'
import { TECH_DEBT_BADGE, deskBadges, popPhase } from './DeskBadges'

const emp = (over: Partial<Employee>): Employee =>
  ({ id: 'e1', name: 'A', dept: 'eng', quality: 1, salary: 1, status: 'working', statusSinceDay: 0, hiredDay: 0, deskSlotId: 'd1', projectId: 'p1', morale: 70, ...over }) as Employee

describe('desk badges (T20)', () => {
  it('a seated builder on a project pops production; engineers pop bugs only with tech debt', () => {
    expect(deskBadges([emp({})], 0)[0]?.kinds).toEqual(['production'])
    expect(deskBadges([emp({})], TECH_DEBT_BADGE)[0]?.kinds).toEqual(['production', 'bug'])
    expect(deskBadges([emp({ dept: 'sales' })], 50)[0]?.kinds).toEqual(['production'])
  })

  it('more debt, more frequent bugs (never under 5 s)', () => {
    const lo = deskBadges([emp({})], TECH_DEBT_BADGE)[0]!.bugPeriod
    const hi = deskBadges([emp({})], TECH_DEBT_BADGE * 3)[0]!.bugPeriod
    expect(hi).toBeLessThan(lo)
    expect(deskBadges([emp({})], 1e6)[0]!.bugPeriod).toBe(5)
  })

  it('no desk, no badge; a seated person with nothing to pop shows none (the state glyphs moved to the head plate, H1)', () => {
    expect(deskBadges([emp({ deskSlotId: undefined })], 0)).toEqual([])
    expect(deskBadges([emp({ morale: 5, fatigue: 90, projectId: undefined })], 0)).toEqual([])
  })

  it('a pop is on for 1.5 s of each period, at a phase of its own per desk', () => {
    let on = 0
    for (let t = 0; t < 90; t += 0.05) if (popPhase(t, 9, 'x') !== null) on++
    expect(on * 0.05).toBeCloseTo(15, 0)
    const a = [...Array(200).keys()].map((i) => popPhase(i * 0.05, 9, 'a') !== null)
    const b = [...Array(200).keys()].map((i) => popPhase(i * 0.05, 9, 'b') !== null)
    expect(a).not.toEqual(b)
  })
})

describe('effort badges (E3)', () => {
  const view = (over: Partial<PersonEffort> = {}): PersonEffort => ({ load: 1, fatigueFactor: 1, pace: 'normal', fit: false, flow: false, ...over })
  const fx = (over: Partial<PersonEffort> = {}, day = 10): { day: number; people: Record<string, PersonEffort> } => ({ day, people: { e1: view(over) } })
  const kinds = (e: Partial<Employee>, f?: ReturnType<typeof fx>) => deskBadges([emp(e)], 0, f)[0]?.kinds

  it('only pops are left on a desk: tired / bored / low morale never become badges any more', () => {
    const worn = { fatigue: 70, morale: 10, loadAvg: 0.2, projectId: undefined }
    expect(kinds(worn, fx())).toBeUndefined()
    expect(kinds({ ...worn, projectId: 'p1' }, fx())).toEqual(['production'])
  })

  it('flow pops gold, a sprint pops red (every 5 s); both replace the plain production pop', () => {
    expect(kinds({}, fx({ flow: true }))).toEqual(['flow'])
    expect(kinds({}, fx({ pace: 'sprint' }))).toEqual(['sprint'])
    expect(kinds({}, fx())).toEqual(['production'])
  })

  it('without the effort view (the Garage) nothing changes', () => {
    expect(kinds({ fatigue: 90, loadAvg: 0.1, projectId: undefined })).toBeUndefined()
    expect(kinds({ fatigue: 90, loadAvg: 0.1 }, { day: 1, people: {} })).toEqual(['production'])
  })
})

