import { describe, expect, it } from 'vitest'
import type { Employee } from '../engine/types'
import { LOW_MORALE, TECH_DEBT_BADGE, deskBadges, popPhase } from './DeskBadges'

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

  it('low morale shows unless the head already says leaving / burnout; no desk, no badge', () => {
    expect(deskBadges([emp({ morale: LOW_MORALE - 1, projectId: undefined })], 0)[0]?.kinds).toEqual(['morale'])
    expect(deskBadges([emp({ morale: 5, status: 'leaving', projectId: undefined })], 0)).toEqual([])
    expect(deskBadges([emp({ deskSlotId: undefined })], 0)).toEqual([])
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
