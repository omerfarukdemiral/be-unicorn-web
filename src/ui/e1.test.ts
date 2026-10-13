// Effort UX (E1 round 3): the load word, the "Projeye ata" pick, the lead row's reason and the hidden-loss chip.
import { describe, expect, it } from 'vitest'
import * as B from '../engine/balance'
import { company } from '../engine/__tests__/moduleFixtures'
import { assignSuggestion, bestProjectFor, hiddenLossChip, loadChip, loadWord } from './effort'

describe('load word', () => {
  it('az under 0.7, iyi to 1.2, ağır to 1.6, aşırı beyond', () => {
    expect([0.3, 0.69, 0.7, 1.2, 1.21, 1.6, 1.61, 2].map(loadWord)).toEqual(['az', 'az', 'iyi', 'iyi', 'ağır', 'ağır', 'aşırı', 'aşırı'])
    expect(loadChip(1.44)).toMatchObject({ text: '1.4×', tail: 'ağır' })
  })
  it('the hidden loss shows only for a worn-out person', () => {
    expect(hiddenLossChip(1)).toEqual([])
    expect(hiddenLossChip(B.TIRED_OUTPUT)[0]!.text).toBe('−%20')
  })
})

describe('bestProjectFor', () => {
  it('picks a fluent project that stays within 1.2 after joining, else null when no project has work', () => {
    const s = company(['web', 'ai'], 2)
    const [a, b] = s.projects
    a!.maturity = 0.5
    b!.maturity = 0.5
    const e = s.employees.find((x) => x.dept === 'eng')!
    e.projectId = undefined
    for (const p of s.projects) p.assignedIds = p.assignedIds.filter((id) => id !== e.id)
    e.skills = [b!.category]
    // b has its own builders, so e joining stays within 1.2; a has none and would stay at the cap.
    for (let i = 0; i < 14; i++) {
      const mate = { ...e, id: `m${i}`, projectId: b!.id, skills: [] }
      s.employees.push(mate)
      b!.assignedIds.push(mate.id)
    }
    const pick = bestProjectFor(s, e)!
    expect(pick.project.id).toBe(b!.id)
    expect(pick.fit).toBe(true)
    expect(pick.after).toBeLessThanOrEqual(1.2)
    s.projects.forEach((p) => {
      p.maturity = 1
      p.build = undefined
    })
    expect(bestProjectFor(s, e)).toBeNull()
  })

  it('suggests for an idle or bored builder only', () => {
    const s = company(['web'], 2)
    s.projects[0]!.maturity = 0.5
    const e = s.employees.find((x) => x.dept === 'eng')!
    s.stage = Math.max(s.stage, 1) as typeof s.stage
    e.status = 'working'
    e.projectId = s.projects[0]!.id
    Object.assign(e, { fatigue: 0, loadAvg: 1, boredDays: 0, morale: 70 })
    expect(assignSuggestion(s, e)).toBeNull()
    e.projectId = undefined
    expect(assignSuggestion(s, e)).not.toBeNull()
    e.projectId = s.projects[0]!.id
    Object.assign(e, { loadAvg: 0.3, boredDays: 40 })
    expect(assignSuggestion(s, e)).not.toBeNull()
  })
})
