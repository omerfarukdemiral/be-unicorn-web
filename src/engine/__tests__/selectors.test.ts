// Read-only selectors from the hand playtest (LD1 idle builders, LD4 round outlook): pure, nothing stored.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../content/index'
import * as B from '../balance'
import { createEngine } from '../index'
import { idleBuilders, roundOutlook } from '../loopSelectors'
import type { GameState } from '../types'

const api = createEngine(CONTENT)

/** A desk, one web project and one eng hire already at work. */
function withBuilder(): GameState {
  let s = api.createGame({ seed: 4 })
  s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
  s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
  const eng = s.candidates.find((c) => c.dept === 'eng')!
  s = api.applyAction(s, { type: 'hire', candidateId: eng.id }).state
  s.employees[0]!.status = 'working'
  return s
}

/** withBuilder plus a second eng hire on the same project. */
function withTwoBuilders(): GameState {
  let s = withBuilder()
  s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
  const eng = s.candidates.find((c) => c.dept === 'eng' || c.dept === 'product')!
  const r = api.applyAction(s, { type: 'hire', candidateId: eng.id })
  expect(r.ok, r.error).toBe(true)
  s = r.state
  s.employees[1]!.status = 'working'
  return s
}

describe('idleBuilders (LD1)', () => {
  it('reports builders on no project only; extra builders on a finished project still fill its updates', () => {
    const s = withTwoBuilders()
    const first = s.employees[0]!.id
    expect(s.employees[1]!.projectId).toBe(s.projects[0]!.id)
    expect(idleBuilders(s)).toEqual([])
    s.projects[0]!.maturity = 1
    expect(idleBuilders(s)).toEqual([])
    // No project at all: idle.
    s.employees[0]!.projectId = undefined
    expect(idleBuilders(s)).toEqual([first])
    // Onboarding counts only for startProject; leaving never counts.
    s.employees[0]!.status = 'onboarding'
    expect(idleBuilders(s)).toEqual([])
    expect(idleBuilders(s, true)).toEqual([first])
    s.employees[0]!.status = 'leaving'
    expect(idleBuilders(s, true)).toEqual([])
  })

  it('a new project takes builders on no project, onboarding hires included, and leaves finished projects staffed', () => {
    let s = withTwoBuilders()
    s.projects[0]!.maturity = 1
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    const eng = s.candidates[0]!
    eng.dept = 'eng'
    const r = api.applyAction(s, { type: 'hire', candidateId: eng.id })
    expect(r.ok, r.error).toBe(true)
    s = r.state
    const hire = s.employees.at(-1)!
    expect(hire.status).toBe('onboarding')
    expect(hire.projectId).toBeUndefined()
    s = api.applyAction(s, { type: 'startProject', category: 'api' }).state
    const fresh = s.projects[1]!
    expect(fresh.assignedIds).toEqual([hire.id])
    expect(s.projects[0]!.assignedIds).toEqual([s.employees[0]!.id, s.employees[1]!.id])
  })

  it('a hire joins the least mature unfinished project', () => {
    let s = withBuilder()
    s = api.applyAction(s, { type: 'startProject', category: 'api' }).state
    s.projects[0]!.maturity = 0.6
    s.projects[1]!.maturity = 0.1
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    const eng = s.candidates.find((c) => c.dept === 'eng' || c.dept === 'product')!
    const r = api.applyAction(s, { type: 'hire', candidateId: eng.id })
    expect(r.ok, r.error).toBe(true)
    expect(r.state.employees.at(-1)!.projectId).toBe(s.projects[1]!.id)
  })
})

describe('roundOutlook (LD4)', () => {
  it('at the multiple ceiling the 30-day valuation only grows with MRR', () => {
    const s = api.createGame({ seed: 4 })
    s.stage = 2
    const mrr = 50_000
    const momAvg = B.GROWTH_FULL_K * B.DILIGENCE_MOM[2]! * 1.5
    const cap = B.MULTIPLE_MAX_BY_STAGE[2]!
    s.finance.mrr = mrr
    s.finance.valuation = mrr * 12 * cap
    s.derived = { ...s.derived, valuationMultiple: cap, multipleCap: cap, momAvg, momGrowth: momAvg, valuationParts: { ...s.derived.valuationParts!, mode: 'post' } }
    const o = roundOutlook(s)!
    expect(o.atCap).toBe(true)
    expect(o.in30).toBeCloseTo(s.finance.valuation * (1 + momAvg), 0)
    expect(o.trend).toBe('flat')
    expect(o.factorIn30).toBeGreaterThan(0)
    // A burn / idle-cash / board penalty lowers the multiple, not the ceiling growth has earned.
    s.derived = { ...s.derived, valuationMultiple: cap * 0.9 }
    expect(roundOutlook(s)!.atCap).toBe(true)
    // Growth below the ceiling: not at it.
    s.derived = { ...s.derived, momAvg: momAvg / 3, momGrowth: momAvg / 3 }
    expect(roundOutlook(s)!.atCap).toBe(false)
  })

  it('says nothing pre-revenue (users drive the price there, not MRR × multiple)', () => {
    const s = api.createGame({ seed: 4 })
    s.stage = 1
    s.derived = { ...s.derived, valuationParts: { ...s.derived.valuationParts!, mode: 'pre' } }
    expect(roundOutlook(s)).toBeNull()
  })
})
