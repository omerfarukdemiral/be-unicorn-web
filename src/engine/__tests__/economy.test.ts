import { describe, expect, it } from 'vitest'
import * as B from '../balance'
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
  it('coordination: free up to COORDINATION_TEAM_FREE, −PER_PERSON after, floor 0.7; the meeting room only softens it', () => {
    const free = B.COORDINATION_TEAM_FREE
    expect(E.coordination(free, false)).toBe(1)
    expect(E.coordination(free + 4, false)).toBeCloseTo(1 - 4 * B.COORDINATION_PER_PERSON)
    expect(E.coordination(free + 4, true)).toBeCloseTo(1 - 4 * B.COORDINATION_PER_PERSON * B.COORDINATION_ROOM_FACTOR)
    expect(E.coordination(200, false)).toBeCloseTo(B.COORDINATION_MIN)
    // GAMEPLAY V2 §4.2: the room reduces the penalty, it no longer zeroes it.
    expect(E.coordination(200, true)).toBeLessThan(1)
    expect(E.coordination(200, true)).toBeGreaterThan(E.coordination(200, false))
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
  it('capacity = max(50, eng × CAPACITY_PER_ENG)', () => {
    expect(E.capacity(0)).toBe(50)
    expect(E.capacity(2)).toBe(2 * B.CAPACITY_PER_ENG)
  })
  it('overload', () => {
    expect(E.overload(100, 50)).toBe(1)
    expect(E.overload(10, 50)).toBe(0)
  })
  it('organic = marketing × ORGANIC_PER_MARKETING × (0.5 + rep/100) × maturity', () => {
    expect(E.organicPerMonth(2, 50, 0.5)).toBeCloseTo(2 * B.ORGANIC_PER_MARKETING * 1 * 0.5)
  })
  it('CAC = CAC_BASE × CAC_STAGE_GROWTH^stage / (0.5 + maturity)', () => {
    expect(E.cac(0, 0.5)).toBeCloseTo(B.CAC_BASE)
    expect(E.cac(2, 0)).toBeCloseTo((B.CAC_BASE * B.CAC_STAGE_GROWTH ** 2) / 0.5)
    expect(E.paidPerMonth(800, 8)).toBe(100)
  })
  it('churn = 0.06 × (1 − min(0.6, ops×0.02)) × (1 + overload) × (1.5 − maturity)', () => {
    expect(E.churnPerMonth(0, 0, 0.5)).toBeCloseTo(0.06)
    expect(E.churnPerMonth(50, 1, 0)).toBeCloseTo(0.06 * 0.4 * 2 * 1.5)
  })
  it('churn floor CHURN_MIN, then × (1 + 0.5 × pen) × (1 + techDebt / 200) (GAMEPLAY V2 §4.3)', () => {
    // 30 ops at maturity 1: 0.06 × 0.4 × 0.5 = 0.012 → the floor.
    expect(E.churnPerMonth(30, 0, 1)).toBeCloseTo(B.CHURN_MIN)
    expect(E.churnPerMonth(0, 0, 0.5, 0.6)).toBeCloseTo(0.06 * (1 + B.CHURN_SATURATION * 0.6))
    expect(E.churnPerMonth(0, 0, 0.5, 0, 40)).toBeCloseTo(0.06 * (1 + 40 / B.TECH_DEBT_CHURN_DIV))
    expect(E.churnPerMonth(30, 0, 1, 0, 40)).toBeCloseTo(B.CHURN_MIN * 1.2)
  })
  it('tech debt speed: 1 − 0.02 × debt, floor 0.5', () => {
    expect(E.techDebtSpeed(0)).toBe(1)
    expect(E.techDebtSpeed(15)).toBeCloseTo(1 - 15 * B.TECH_DEBT_PER_POINT)
    expect(E.techDebtSpeed(500)).toBe(B.TECH_DEBT_MIN_SPEED)
  })
  it('market: tam = Σ open segment × ramp; penetration = users / tam, clamped 0–1', () => {
    const segs = [{ size: 1000, openedDay: 0 }, { size: 600, openedDay: 30 }]
    expect(E.marketTam(segs, 60)).toBe(1300)
    expect(E.marketTam(segs, 90)).toBe(1600)
    expect(E.penetration(800, 1600)).toBeCloseTo(0.5)
    expect(E.penetration(1e9, 1600)).toBe(1)
    expect(E.penetration(10, 0)).toBe(0)
  })
  it('CAC saturates with spend (super-linear) and with the market (1 + 3 × pen²)', () => {
    const base = E.cac(3, 0.5)
    const mrr = 200_000
    expect(E.cac(3, 0.5, mrr, mrr)).toBeCloseTo(base * (1 + B.CAC_SPEND_K))
    expect(E.cac(3, 0.5, 0, mrr, 0.5)).toBeCloseTo(base * (1 + B.CAC_SATURATION_K * 0.25))
    // Below the stage floor the spend is measured against the floor, not a tiny MRR.
    const floor = B.CAC_SPEND_FLOOR[3]!
    expect(E.cac(3, 0.5, floor, 100)).toBeCloseTo(base * (1 + B.CAC_SPEND_K))
  })
  it('paid users peak below 2 × MRR: at 2 × MRR the channel is already past its top and falling', () => {
    const mrr = 400_000
    const paid = (x: number) => E.paidPerMonth(x * mrr, E.cac(4, 0.8, x * mrr, mrr))
    // d/dx [x / (1 + K x^1.5)] = 0 at K x^1.5 = 2.
    const peak = (2 / B.CAC_SPEND_K) ** (1 / B.CAC_SPEND_EXP)
    expect(peak).toBeLessThan(2)
    expect(paid(1)).toBeGreaterThan(paid(0.5))
    expect(paid(peak)).toBeGreaterThan(paid(peak - 0.1))
    expect(paid(peak)).toBeGreaterThan(paid(2))
    expect(paid(2)).toBeGreaterThan(paid(2.2))
    expect(paid(2.2)).toBeGreaterThan(paid(3))
  })
  it('a full market shuts the paid channel and floors organic at 10%', () => {
    expect(E.paidPerMonth(1000, 10, 0.25)).toBeCloseTo(75)
    expect(E.paidPerMonth(1000, 10, 1)).toBe(0)
    expect(E.organicPerMonth(2, 50, 0.5, 0.95)).toBeCloseTo(2 * B.ORGANIC_PER_MARKETING * 0.5 * B.ORGANIC_PEN_FLOOR)
    expect(E.organicPerMonth(2, 50, 0.5, 0.5)).toBeCloseTo(2 * B.ORGANIC_PER_MARKETING * 0.5 * 0.5)
  })
})

describe('§5.5 revenue', () => {
  it('arpu formula', () => {
    expect(E.arpu(0, 1, 0, 1)).toBeCloseTo(B.ARPU_BASE)
    expect(E.arpu(1, 1.5, 5, 0)).toBeCloseTo(B.ARPU_BASE * B.ARPU_STAGE_GROWTH * 1.5 * (1 + 5 * B.ARPU_SALES_PER) * 0.3)
    expect(E.arpu(0, 1, 100, 1)).toBeCloseTo(B.ARPU_BASE * (1 + B.ARPU_SALES_MAX))
  })
  it('MRR = users × arpu + enterprise', () => {
    expect(E.mrr(100, 3, 50)).toBe(350)
  })
  it('price increase churn penalty while PRICE_CHURN_DAYS last (Faz 3: a lasting cost of a high price)', () => {
    expect(E.priceChurnFactor(1.5, 10)).toBeCloseTo(1 + 0.5 * B.PRICE_CHURN_FACTOR)
    expect(E.priceChurnFactor(1.5, B.PRICE_CHURN_DAYS)).toBe(1)
    expect(E.priceChurnFactor(0.8, 1)).toBe(1)
  })
})

describe('§5.6 costs', () => {
  it('salary × SALARY_STAGE_GROWTH^stage', () => {
    expect(E.salary(1000, 2)).toBeCloseTo(1000 * B.SALARY_STAGE_GROWTH ** 2)
  })
  it('infra = max(users/1000 × per-1000[stage], MRR × share[stage]) × server room', () => {
    expect(E.infra(5000, 0, 0)).toBeCloseTo(5 * B.INFRA_PER_1000_BY_STAGE[0]!)
    expect(E.infra(5000, 0, 0, 0.8)).toBeCloseTo(5 * B.INFRA_PER_1000_BY_STAGE[0]! * 0.8)
    // Series B: the MRR share wins once revenue per user is high.
    expect(E.infra(10_000, 1_000_000, 4)).toBeCloseTo(1_000_000 * B.INFRA_MRR_SHARE[4]!)
    expect(E.infra(10_000, 1_000, 4)).toBeCloseTo(10 * B.INFRA_PER_1000_BY_STAGE[4]!)
    expect(E.infra(10_000, 1_000_000, 4, 0.8)).toBeCloseTo(1_000_000 * B.INFRA_MRR_SHARE[4]! * 0.8)
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
  it('clamps once, after every term (auras cannot cancel a floored penalty)', () => {
    // 60 + 20 − 40 − 15×2 = 10 (not clamp(−10) = 0, then + 20).
    expect(E.moraleTarget({ auras: 20, decisionBonus: 0, bookshelf: 0, cashNegative: true, overload: 2, coordinationPenalty: 0 })).toBe(10)
    expect(E.moraleTargetRaw({ auras: 0, decisionBonus: 0, bookshelf: 0, cashNegative: true, overload: 2, coordinationPenalty: 0 })).toBe(-10)
  })
  it('approaches target by 5% of the gap per day', () => {
    expect(E.approachMorale(40, 60, 1)).toBeCloseTo(41)
    const quarterSteps = [0, 1, 2, 3].reduce((m) => E.approachMorale(m, 60, 0.25), 40)
    expect(quarterSteps).toBeCloseTo(41)
  })
})

describe('§5.8 valuation', () => {
  it('pre-revenue prices traction, not head count (GAMEPLAY V2 §4.1)', () => {
    expect(E.valuationPreRevenue(100, 1, 3)).toBe(B.VAL_PER_LAUNCHED + 100 * B.VAL_PER_USER + 3 * B.VAL_PER_RELEASE)
    // Releases count up to 5; the Pre-seed window (300K) opens at 1 launch + 5 releases + ~190 users.
    expect(E.valuationPreRevenue(0, 0, 9)).toBe(B.VAL_RELEASE_MAX * B.VAL_PER_RELEASE)
    expect(E.valuationPreRevenue(190, 1, 5)).toBeGreaterThanOrEqual(0.6 * 500_000)
  })
  it('zero growth gives MIN[stage] at every stage; GROWTH_FULL_K (≤ 2) × the diligence MoM gives MAX', () => {
    for (let st = 0; st <= 6; st++) {
      expect(E.valuationMultiple(0, st)).toBe(B.MULTIPLE_MIN_BY_STAGE[st])
      expect(E.valuationMultiple(-0.2, st)).toBe(B.MULTIPLE_MIN_BY_STAGE[st])
      expect(E.valuationMultiple(B.GROWTH_FULL_K * B.DILIGENCE_MOM[st]!, st)).toBeCloseTo(B.MULTIPLE_MAX_BY_STAGE[st]!, 9)
      expect(E.valuationMultiple(2 * B.DILIGENCE_MOM[st]!, st)).toBeCloseTo(B.MULTIPLE_MAX_BY_STAGE[st]!, 9)
      expect(E.valuationMultiple(1, st)).toBeCloseTo(B.MULTIPLE_MAX_BY_STAGE[st]!, 9)
    }
    // Halfway: MIN + half the span (Series B: 2 + 5 × 0.5).
    expect(E.valuationMultiple((B.GROWTH_FULL_K * B.DILIGENCE_MOM[4]!) / 2, 4)).toBeCloseTo(4.5, 9)
    expect(B.GROWTH_FULL_K).toBeLessThanOrEqual(2)
    expect(B.MULTIPLE_MAX_BY_STAGE).toEqual([30, 30, 15, 10, 7, 5.15, 5.15])
    expect(E.multipleCap(5)).toBeLessThan(E.multipleCap(2))
    expect(E.multipleCap(99)).toBe(B.MULTIPLE_MAX)
    // Penalties multiply the whole multiple.
    expect(E.valuationMultiple(0, 3, 0.9)).toBeCloseTo(B.MULTIPLE_MIN_BY_STAGE[3]! * 0.9, 9)
  })
  it('burn multiple = 3 months of net burn / (MRR gained × 12); not burning = 0, no growth = capped', () => {
    // Burned 30K over 3 months while MRR grew 10K → 20K: 30K / 120K = 0.25.
    expect(E.burnMultiple([-10_000, -10_000, -10_000], [10_000, 12_000, 15_000, 20_000])).toBeCloseTo(0.25, 9)
    // Profitable months do not count as burn; only the last 3 months are read.
    expect(E.burnMultiple([-99_000, 5_000, -6_000, 1_000], [0, 10_000, 12_000, 15_000, 11_000])).toBeCloseTo(6_000 / 12_000, 9)
    expect(E.burnMultiple([1_000, 2_000, 3_000], [1, 2, 3, 4])).toBe(0)
    expect(E.burnMultiple([], [])).toBe(0)
    // Short net history (old save): growth is read over the same 1 month the burn covers.
    expect(E.burnMultiple([-12_000], [0, 5_000, 9_000, 10_000])).toBeCloseTo(12_000 / 12_000, 9)
    expect(E.burnMultiple([-50_000, -50_000, -50_000], [20_000, 20_000, 20_000, 20_000])).toBe(B.BURN_MULTIPLE_MAX)
  })
  it('bmPenalty only from Series A, at most 3 points; the idle-cash penalty spares a fresh round', () => {
    expect(E.bmPenalty(20, 2)).toBe(1)
    expect(E.bmPenalty(B.DILIGENCE_BM[3]!, 3)).toBe(1)
    // Series A, BM 5 vs ask 2.5: 2.5 points → 0.75.
    expect(E.bmPenalty(5, 3)).toBeCloseTo(0.75, 9)
    // Bounded: 3 points at most → 0.7.
    expect(E.bmPenalty(50, 3)).toBeCloseTo(1 - B.BM_PENALTY_PER_POINT * B.BM_PENALTY_MAX_POINTS, 9)
    const burn = 100_000
    const rich = B.IDLE_CASH_MONTHS * burn + 1
    expect(E.idlePenalty(3, rich, burn, 1_100, 1_000)).toBe(1)
    expect(E.idlePenalty(3, rich, burn, 1_000 + B.IDLE_GRACE_DAYS + 1, 1_000)).toBe(B.IDLE_PENALTY)
    expect(E.idlePenalty(2, rich, burn, 5_000, 1_000)).toBe(1)
    expect(E.idlePenalty(3, B.IDLE_CASH_MONTHS * burn, burn, 5_000, -Infinity)).toBe(1)
  })
  it('the multiple prices the average MoM of the last 3 months, not one lucky month', () => {
    expect(E.averageMom([100, 110, 121, 133.1])).toBeCloseTo(0.1)
    // One spike month is averaged out.
    expect(E.averageMom([100, 100, 100, 200])).toBeCloseTo(1 / 3)
    // Months before revenue (0) are skipped; no history → 0.
    expect(E.averageMom([0, 0, 100, 120])).toBeCloseTo(0.2)
    expect(E.averageMom([])).toBe(0)
    expect(E.averageMom([100])).toBe(0)
  })
  it('founder living cost: $1.2K/month in the garage, rising by stage', () => {
    expect(E.founderLiving(0)).toBe(1_200)
    expect(E.founderLiving(1)).toBe(1_200)
    expect(E.founderLiving(99)).toBe(B.FOUNDER_LIVING_COST[B.FOUNDER_LIVING_COST.length - 1])
    expect(E.burn(1000, 500, 20, 100, 1200)).toBe(2820)
  })
  it('post-revenue = MRR × 12 × multiple; growth is priced; the pre-revenue floor holds only up to Pre-seed', () => {
    expect(E.valuationPostRevenue(10_000, 10)).toBe(1_200_000)
    expect(E.valuation(50_000, E.valuationMultiple(0.1, 2), 0, 2)).toBeGreaterThan(E.valuation(50_000, E.valuationMultiple(0, 2), 0, 2))
    expect(E.valuation(2_000, 4, 1_000_000, 1)).toBe(1_000_000)
    expect(E.valuation(2_000, 3, 1_000_000, 2)).toBe(2_000 * 12 * 3)
  })
  it('from Seed the floor fades with the blend: no cliff at $1K MRR (review fix)', () => {
    const pre = 1_575_000
    const at999 = E.valuation(999, 3, pre, 2)
    const at1000 = E.valuation(1_000, 3, pre, 2)
    expect(at1000).toBe(1_000 * 12 * 3)
    expect(at999 - at1000).toBeLessThan(pre * 0.01)
    expect(E.valuation(500, 3, pre, 2)).toBeCloseTo(pre * 0.5 + 500 * 12 * 3 * 0.5, 6)
    expect(E.valuation(0, 3, pre, 2)).toBe(pre)
  })
  it('MoM growth', () => {
    expect(E.momGrowth(100, 120)).toBeCloseTo(0.2)
    expect(E.momGrowth(0, 120)).toBe(0)
  })
})

describe('§5.10 founder XP', () => {
  it('+10% per XP, max +40%', () => {
    expect(E.startCash(0)).toBe(15_000)
    expect(E.startCash(2)).toBeCloseTo(18_000)
    expect(E.startCash(10)).toBeCloseTo(21_000)
  })
})
