// The effort controls' rules (E3): who is offered pace / leave / lead / sprint, and the chips' numbers. Pure over a
// stage 2 company, no DOM.
import { describe, expect, it } from 'vitest'
import * as B from '../engine/balance'
import { company } from '../engine/__tests__/moduleFixtures'
import { buildersOf } from '../engine/effort'
import { calmChips, candidateFit, fatigueGood, leaveChips, loadChip, loadGood, personControls, projectEffort, sprintChips } from './effort'

function team() {
  const s = company(['web'], 2)
  const p = s.projects[0]!
  p.maturity = 0.5
  p.launched = false
  for (const e of s.employees) {
    e.status = 'working'
    if (e.dept === 'eng' || e.dept === 'product') {
      e.projectId = p.id
      if (!p.assignedIds.includes(e.id)) p.assignedIds.push(e.id)
    }
  }
  // At least LEAD_MIN_TEAM builders, whatever the fixture hired.
  for (let i = 0; buildersOf(s, p).length < B.LEAD_MIN_TEAM; i++) {
    const copy = { ...s.employees.find((x) => x.dept === 'eng')!, id: `x${i}`, projectId: p.id }
    s.employees.push(copy)
    p.assignedIds.push(copy.id)
  }
  return { s, p, e: buildersOf(s, p)[0]! }
}

describe('effort controls', () => {
  it('tones: fatigue red from 60, green under 40; load red over 1.2, green 0.8-1.2, grey under', () => {
    expect([30, 50, 60].map(fatigueGood)).toEqual([true, null, false])
    expect([1.5, 1.2, 0.8, 0.75, 0.3].map(loadGood)).toEqual([false, true, true, null, null])
    expect(loadChip(1.44).text).toBe('1.4×')
  })

  it('chips carry the balance numbers', () => {
    expect(calmChips().map((c) => c.text)).toEqual(['−%15', '−3.5'])
    expect(leaveChips().map((c) => c.text)).toEqual(['0', `−${B.LEAVE_DAYS * B.LEAVE_RECOVERY_PER_DAY}`])
    expect(sprintChips({ stage: 1 }, 2).map((c) => c.text)).toEqual(['+%20', '+3'])
    expect(sprintChips({ stage: B.TECH_DEBT_MIN_STAGE }, 2).at(-1)?.text).toBe('+0.2')
  })

  it('pace for everyone but sales; leave only when worn out; none of it in the Garage', () => {
    const { s, e } = team()
    expect(personControls(s, e)).toMatchObject({ pace: 'normal', leave: null })
    e.fatigue = 39
    expect(personControls(s, e).leave).toBeNull()
    e.fatigue = 40
    expect(personControls(s, e).leave).toBe('ready')
    e.leaveReadyDay = s.time.day + 12
    expect(personControls(s, e).leave).toBe(12)
    s.stage = 0
    expect(personControls(s, e)).toEqual({ pace: null, leave: null, lead: null, leadLock: null, leadTeam: 0, leadFirst: false })
  })

  it('lead: from Seed, on a project of 3+ builders; the lead can step down', () => {
    const { s, p, e } = team()
    expect(buildersOf(s, p).length).toBeGreaterThanOrEqual(B.LEAD_MIN_TEAM)
    expect(personControls(s, e).lead).toBe('make')
    p.leadId = e.id
    expect(personControls(s, e).lead).toBe('unlead')
    p.leadId = undefined
    // E1 round 3: the row never hides, it says what is missing (Seed, then the builders).
    s.stage = 1
    expect(personControls(s, e)).toMatchObject({ lead: 'locked', leadLock: 'stage' })
    s.stage = 2
    p.assignedIds = p.assignedIds.slice(0, 2)
    expect(personControls(s, e)).toMatchObject({ lead: 'locked', leadLock: 'team', leadTeam: 2 })
  })

  it('a project: supply against demand, the sprint ready, running, then cooling down', () => {
    const { s, p } = team()
    const fx = projectEffort(s, p)
    expect(fx.supply).toBeGreaterThan(0)
    expect(fx.demand).toBeGreaterThan(0)
    expect(fx.canSprint).toBe(true)
    p.sprintUntil = s.time.day + 5
    p.sprintReadyDay = s.time.day + 35
    expect(projectEffort(s, p)).toMatchObject({ sprinting: true, sprintLeft: 5, canSprint: false })
    p.sprintUntil = s.time.day - 1
    expect(projectEffort(s, p)).toMatchObject({ sprinting: false, cooldown: 35, canSprint: false })
  })

  it('a candidate: one skill, a fit when the company builds it', () => {
    const { s } = team()
    const c = { ...s.candidates[0]!, skills: ['web' as const] }
    expect(candidateFit(s, c)).toEqual({ category: 'web', fit: true })
    expect(candidateFit(s, { ...c, skills: ['ai'] })).toEqual({ category: 'ai', fit: false })
    expect(candidateFit(s, { ...c, skills: undefined })).toBeNull()
    expect(candidateFit({ ...s, stage: 0 }, c)).toBeNull()
  })
})
