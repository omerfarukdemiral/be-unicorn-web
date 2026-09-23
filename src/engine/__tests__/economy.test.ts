import { describe, expect, it } from 'vitest'
import * as E from '../economy'

describe('§5.2 production', () => {
  it('morale multiplier spans 0.5–1.5', () => {
    expect(E.moraleMultiplier(0)).toBe(0.5)
    expect(E.moraleMultiplier(100)).toBe(1.5)
    expect(E.moraleMultiplier(50)).toBe(1)
  })
  it('person output multiplies all factors', () => {
    expect(E.personOutput(2, 1.15, 50, 1.1)).toBeCloseTo(2 * 1.15 * 1 * 1.1)
  })
  it('coordination: −3%/person over 6, floor 0.7, meeting room fixes', () => {
    expect(E.coordination(6, false)).toBe(1)
    expect(E.coordination(10, false)).toBeCloseTo(0.88)
    expect(E.coordination(40, false)).toBe(0.7)
    expect(E.coordination(40, true)).toBe(1)
  })
})

describe('§5.3 product', () => {
  it('maturity per month = (eng + 0.5 product) × speed / size', () => {
    expect(E.maturityPerMonth(2, 2, 1, 10)).toBeCloseTo(0.3)
  })
  it('parallel penalty −20% per extra project until Seed', () => {
    expect(E.parallelProjectSpeed(1, 0)).toBe(1)
    expect(E.parallelProjectSpeed(3, 1)).toBeCloseTo(0.6)
    expect(E.parallelProjectSpeed(3, 3)).toBe(1)
  })
  it('MVP at 0.2', () => {
    expect(E.isLaunched(0.19)).toBe(false)
    expect(E.isLaunched(0.2)).toBe(true)
  })
})

describe('§5.4 users', () => {
  it('capacity = max(50, eng × 1500)', () => {
    expect(E.capacity(0)).toBe(50)
    expect(E.capacity(2)).toBe(3000)
  })
  it('overload', () => {
    expect(E.overload(100, 50)).toBe(1)
    expect(E.overload(10, 50)).toBe(0)
  })
  it('organic = marketing × 25 × (0.5 + rep/100) × maturity', () => {
    expect(E.organicPerMonth(2, 50, 0.5)).toBeCloseTo(2 * 25 * 1 * 0.5)
  })
  it('CAC = 8 × 1.3^stage / (0.5 + maturity)', () => {
    expect(E.cac(0, 0.5)).toBeCloseTo(8)
    expect(E.cac(2, 0)).toBeCloseTo((8 * 1.69) / 0.5)
    expect(E.paidPerMonth(800, 8)).toBe(100)
  })
  it('churn = 0.06 × (1 − min(0.6, ops×0.02)) × (1 + overload) × (1.5 − maturity)', () => {
    expect(E.churnPerMonth(0, 0, 0.5)).toBeCloseTo(0.06)
    expect(E.churnPerMonth(50, 1, 0)).toBeCloseTo(0.06 * 0.4 * 2 * 1.5)
  })
})

describe('§5.5 revenue', () => {
  it('arpu formula', () => {
    expect(E.arpu(0, 1, 0, 1)).toBeCloseTo(4)
    expect(E.arpu(1, 1.5, 5, 0)).toBeCloseTo(4 * 1.15 * 1.5 * 1.2 * 0.3)
    expect(E.arpu(0, 1, 100, 1)).toBeCloseTo(4 * 1.8)
  })
  it('MRR = users × arpu + enterprise', () => {
    expect(E.mrr(100, 3, 50)).toBe(350)
  })
  it('price increase churn penalty for one month', () => {
    expect(E.priceChurnFactor(1.5, 10)).toBeCloseTo(1.4)
    expect(E.priceChurnFactor(1.5, 31)).toBe(1)
    expect(E.priceChurnFactor(0.8, 1)).toBe(1)
  })
})

describe('§5.6 costs', () => {
  it('salary × 1.5^stage', () => {
    expect(E.salary(1000, 2)).toBeCloseTo(2250)
  })
  it('infra with server room', () => {
    expect(E.infra(5000)).toBeCloseTo(50)
    expect(E.infra(5000, 0.8)).toBeCloseTo(40)
  })
  it('burn and runway', () => {
    expect(E.burn(1000, 500, 20, 100)).toBe(1620)
    expect(E.runway(10_000, -2_000)).toBe(5)
    expect(E.runway(10_000, 0)).toBeNull()
  })
})

describe('§5.7 morale', () => {
  it('target combines bonuses and penalties', () => {
    expect(E.moraleTarget({ auras: 5, decisionBonus: 0, bookshelf: 2, cashNegative: false, overload: 0, coordinationPenalty: 0 })).toBe(67)
    expect(E.moraleTarget({ auras: 0, decisionBonus: 0, bookshelf: 0, cashNegative: true, overload: 1, coordinationPenalty: 5 })).toBe(0)
  })
  it('approaches target by 5% of the gap per day', () => {
    expect(E.approachMorale(40, 60, 1)).toBeCloseTo(41)
    const quarterSteps = [0, 1, 2, 3].reduce((m) => E.approachMorale(m, 60, 0.25), 40)
    expect(quarterSteps).toBeCloseTo(41)
  })
})

describe('§5.8 valuation', () => {
  it('pre-revenue', () => {
    expect(E.valuationPreRevenue(3, 100, 1)).toBe(180_000 + 15_000 + 200_000)
  })
  it('multiple clamps 4–30', () => {
    expect(E.valuationMultiple(0)).toBe(6)
    expect(E.valuationMultiple(1)).toBe(30)
    expect(E.valuationMultiple(-0.5)).toBe(4)
  })
  it('post-revenue = MRR × 12 × multiple; growth is priced', () => {
    expect(E.valuationPostRevenue(10_000, 10)).toBe(1_200_000)
    expect(E.valuation(50_000, 0.1, 0, 0, 0)).toBeGreaterThan(E.valuation(50_000, 0, 0, 0, 0))
  })
  it('MoM growth', () => {
    expect(E.momGrowth(100, 120)).toBeCloseTo(0.2)
    expect(E.momGrowth(0, 120)).toBe(0)
  })
})

describe('§5.10 founder XP', () => {
  it('+10% per XP, max +40%', () => {
    expect(E.startCash(0)).toBe(30_000)
    expect(E.startCash(2)).toBeCloseTo(36_000)
    expect(E.startCash(10)).toBeCloseTo(42_000)
  })
})
