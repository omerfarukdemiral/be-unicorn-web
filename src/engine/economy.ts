// PLAN §5.2–5.8 formulas. Each is a small pure function; names follow the PLAN.
import * as B from './balance'

export const clamp = (min: number, max: number, v: number): number => Math.min(max, Math.max(min, v))

// §5.2 Production -----------------------------------------------------------

/** moralÇarpanı = 0.5 + moral/100 (0.5–1.5). */
export function moraleMultiplier(morale: number): number {
  return 0.5 + clamp(0, 100, morale) / 100
}

/** verim(kişi) = temelÇıktı × masaKalitesi × moralÇarpanı × komşulukBonusu (× quality). */
export function personOutput(baseOutput: number, deskQuality: number, morale: number, adjacencyBonus: number, quality = 1): number {
  return baseOutput * deskQuality * moraleMultiplier(morale) * adjacencyBonus * quality
}

/** ekip > 10 → × (1 − 0.015 × (ekip − 10)), en fazla −%30; toplantı odası kaybı yarıya indirir (GAMEPLAY V2 §4.2). */
export function coordination(teamSize: number, hasMeetingRoom: boolean): number {
  if (teamSize <= B.COORDINATION_TEAM_FREE) return 1
  const loss = Math.min(1 - B.COORDINATION_MIN, B.COORDINATION_PER_PERSON * (teamSize - B.COORDINATION_TEAM_FREE))
  return 1 - loss * (hasMeetingRoom ? B.COORDINATION_ROOM_FACTOR : 1)
}

// §5.3 Product ----------------------------------------------------------------

/** Maturity gained per month: (müh×1.0 + ürün×0.5) × hız / projeBüyüklüğü. */
export function maturityPerMonth(engOutput: number, productOutput: number, speed: number, size: number): number {
  if (size <= 0) return 0
  return ((engOutput * B.MATURITY_ENG_WEIGHT + productOutput * B.MATURITY_PRODUCT_WEIGHT) * speed) / size
}

/** Garage–Seed: −20% speed on all projects per extra active project. */
export function parallelProjectSpeed(activeProjects: number, stage: number): number {
  if (stage > B.PARALLEL_PENALTY_MAX_STAGE || activeProjects <= 1) return 1
  return Math.max(B.PARALLEL_MIN_SPEED, 1 - B.PARALLEL_PENALTY * (activeProjects - 1))
}

export function isLaunched(maturity: number): boolean {
  return maturity >= B.MVP_MATURITY
}

/** hız = max(0.5, 1 − 0.02 × teknikBorç). */
export function techDebtSpeed(debt: number): number {
  return Math.max(B.TECH_DEBT_MIN_SPEED, 1 - B.TECH_DEBT_PER_POINT * Math.max(0, debt))
}

// §5.4 Users ------------------------------------------------------------------

/** kapasite = max(50, müh × 1500). */
export function capacity(eng: number, capacityMult = 1): number {
  return Math.max(B.CAPACITY_MIN, eng * B.CAPACITY_PER_ENG * capacityMult)
}

/** aşırıYük = max(0, users / kapasite − 1). */
export function overload(users: number, cap: number): number {
  return Math.max(0, users / Math.max(1, cap) - 1)
}

/** Market size at a stage (GAMEPLAY V2 §4.3): MARKET_FALLBACK_TAM until the segments of §8 land. */
export function marketTam(stage: number): number {
  return B.MARKET_FALLBACK_TAM[Math.min(B.MARKET_FALLBACK_TAM.length - 1, Math.max(0, stage))]!
}

/** pen = users / tam, 0–1. */
export function penetration(users: number, tam: number): number {
  return tam > 0 ? clamp(0, 1, users / tam) : 0
}

/** Σ rival share (GAMEPLAY V2 §8.2), capped at RIVAL_SHARE_TOTAL_MAX: what the rivals take from the channels. */
export function rivalShareTotal(rivals: readonly { share: number }[] | undefined): number {
  return clamp(0, B.RIVAL_SHARE_TOTAL_MAX, (rivals ?? []).reduce((a, r) => a + r.share, 0))
}

/** organik/ay = pazarlama × 42 × (0.5 + itibar/100) × ortOlgunluk × max(0.1, 1 − pen) × (1 − Σpay × 0.5). */
export function organicPerMonth(marketing: number, reputation: number, avgMaturity: number, pen = 0, rivalShare = 0): number {
  return marketing * B.ORGANIC_PER_MARKETING * (0.5 + reputation / 100) * avgMaturity * Math.max(B.ORGANIC_PEN_FLOOR, 1 - pen) * (1 - rivalShare * B.RIVAL_ORGANIC_SHARE)
}

/**
 * CAC = 45 × 1.7^aşama / (0.5 + ortOlgunluk) × harcamaDoygunluğu × pazarDoygunluğu (GAMEPLAY V2 §4.3).
 * harcama = 1 + K × (reklam / max(MRR, taban[aşama]))^1.5: super-linear, so paid users have a peak; pazar = 1 + 3 × pen².
 */
export function cac(stage: number, avgMaturity: number, adBudget = 0, mrrValue = 0, pen = 0): number {
  const base = (B.CAC_BASE * B.CAC_STAGE_GROWTH ** stage) / (0.5 + avgMaturity)
  const floor = B.CAC_SPEND_FLOOR[Math.min(B.CAC_SPEND_FLOOR.length - 1, Math.max(0, stage))]!
  const spend = 1 + B.CAC_SPEND_K * (Math.max(0, adBudget) / Math.max(mrrValue, floor)) ** B.CAC_SPEND_EXP
  return base * spend * (1 + B.CAC_SATURATION_K * pen * pen)
}

/** reklam/ay = reklamBütçesi / CAC × (1 − pen). */
export function paidPerMonth(adBudget: number, cacValue: number, pen = 0): number {
  return cacValue > 0 ? (adBudget / cacValue) * Math.max(0, 1 - pen) : 0
}

/**
 * churn/ay = max(0.025, 0.06 × (1 − min(0.6, ops × 0.02)) × (1 + aşırıYük) × (1.5 − ortOlgunluk))
 * × (1 + 0.5 × pen) × (1 + teknikBorç / 200) (GAMEPLAY V2 §4.3).
 */
export function churnPerMonth(ops: number, overloadValue: number, avgMaturity: number, pen = 0, techDebt = 0): number {
  const base = B.CHURN_BASE * (1 - Math.min(B.CHURN_OPS_MAX, ops * B.CHURN_OPS_PER)) * (1 + overloadValue) * (1.5 - avgMaturity)
  return Math.max(B.CHURN_MIN, base) * (1 + B.CHURN_SATURATION * pen) * (1 + Math.max(0, techDebt) / B.TECH_DEBT_CHURN_DIV)
}

/** Price increase → churn × (1 + (fiyatÇarpanı − 1) × 0.8) for one month. */
export function priceChurnFactor(priceMultiplier: number, daysSinceChange: number | null): number {
  if (daysSinceChange === null || daysSinceChange >= B.PRICE_CHURN_DAYS || priceMultiplier <= 1) return 1
  return 1 + (priceMultiplier - 1) * B.PRICE_CHURN_FACTOR
}

// §5.5 Revenue ----------------------------------------------------------------

/** arpu = 4 × 1.15^aşama × fiyat × (1 + min(0.8, satış × 0.04)) × (0.3 + 0.7 × ortOlgunluk) × (1 − Σpay × 0.2). */
export function arpu(stage: number, priceMultiplier: number, sales: number, avgMaturity: number, rivalShare = 0): number {
  return (
    B.ARPU_BASE *
    B.ARPU_STAGE_GROWTH ** stage *
    priceMultiplier *
    (1 + Math.min(B.ARPU_SALES_MAX, sales * B.ARPU_SALES_PER)) *
    (0.3 + 0.7 * avgMaturity) *
    (1 - rivalShare * B.RIVAL_ARPU_SHARE)
  )
}

/** MRR = users × arpu (+ enterprise contracts). */
export function mrr(users: number, arpuValue: number, enterpriseMrr = 0): number {
  return users * arpuValue + enterpriseMrr
}

// §5.6 Costs ------------------------------------------------------------------

/** maaş(kişi) = temelMaaş × 1.5^aşama. */
export function salary(baseSalary: number, stage: number): number {
  return baseSalary * B.SALARY_STAGE_GROWTH ** stage
}

/** kira = ofisTabanKirası[aşama] + açıkHalkaSayısı × halkaKirası[aşama]. */
export function rent(stage: number, openExtraRings: number): number {
  return (B.OFFICE_BASE_RENT[stage] ?? 0) + openExtraRings * (B.RING_RENT[stage] ?? 0)
}

/** altyapı = max(users / 1000 × birim[aşama], MRR × pay[aşama]) × (sunucuOdası ? 0.8 : 1) (GAMEPLAY V2 §4.2). */
export function infra(users: number, mrrValue: number, stage: number, infraMult = 1): number {
  const i = Math.min(B.INFRA_PER_1000_BY_STAGE.length - 1, Math.max(0, stage))
  return Math.max((users / 1000) * B.INFRA_PER_1000_BY_STAGE[i]!, Math.max(0, mrrValue) * B.INFRA_MRR_SHARE[i]!) * infraMult
}

/** burn = maaşlar + kira + altyapı + reklamBütçesi (+ kurucu yaşam gideri, Faz 3). */
export function burn(salaries: number, rentValue: number, infraValue: number, adBudget: number, founderLiving = 0): number {
  return salaries + rentValue + infraValue + adBudget + founderLiving
}

/** Costs in a payday ledger (salaries + rent + infra + ads + founder living). */
export function ledgerCosts(l: { salaries: number; rent: number; infra: number; ads: number; founder?: number }): number {
  return l.salaries + l.rent + l.infra + l.ads + (l.founder ?? 0)
}

/** Founder living cost per month at a stage (CORE_LOOP §5 "Garaj burn'ü"). */
export function founderLiving(stage: number): number {
  return B.FOUNDER_LIVING_COST[stage] ?? B.FOUNDER_LIVING_COST[B.FOUNDER_LIVING_COST.length - 1] ?? 0
}

/** runway (months) = net < 0 ? cash / −net : ∞ (null). */
export function runway(cash: number, net: number): number | null {
  if (net >= 0) return null
  return Math.max(0, cash) / -net
}

// §5.7 Morale -----------------------------------------------------------------

export interface MoraleTargetInput {
  auras: number
  decisionBonus: number
  bookshelf: number
  cashNegative: boolean
  overload: number
  coordinationPenalty: number
}

/** Unclamped target: sum every term first, clamp once at the end (PLAN §5.7). */
export function moraleTargetRaw(i: MoraleTargetInput): number {
  return (
    B.MORALE_BASE_TARGET +
    i.auras +
    i.decisionBonus +
    i.bookshelf -
    (i.cashNegative ? B.MORALE_NEGATIVE_CASH : 0) -
    B.MORALE_OVERLOAD * i.overload -
    i.coordinationPenalty
  )
}

/** hedef = 60 + auralar + kararlar + kitaplık − 40 (kasa<0) − 15 × aşırıYük − koordinasyonCezası, clamped to 0–100. */
export function moraleTarget(i: MoraleTargetInput): number {
  return clamp(0, 100, moraleTargetRaw(i))
}

/** Morale approaches target by 5%/day of the gap (continuous for fractional days). */
export function approachMorale(current: number, target: number, dtDays: number): number {
  const k = 1 - (1 - B.MORALE_APPROACH_PER_DAY) ** dtDays
  return current + (target - current) * k
}

// §5.8 Valuation --------------------------------------------------------------

/** gelir öncesi (GAMEPLAY V2 §4.1): 150K × yayındakiProje + 400 × users + 15K × min(5, sürüm). Head count is not traction. */
export function valuationPreRevenue(users: number, launchedProjects: number, releases: number): number {
  return B.VAL_PER_LAUNCHED * launchedProjects + B.VAL_PER_USER * users + B.VAL_PER_RELEASE * Math.min(B.VAL_RELEASE_MAX, Math.max(0, releases))
}

/** The stage's multiple floor (zero growth) and ceiling (MULTIPLE_MAX_BY_STAGE). */
export function multipleMin(stage: number): number {
  return B.MULTIPLE_MIN_BY_STAGE[Math.min(B.MULTIPLE_MIN_BY_STAGE.length - 1, Math.max(0, stage))]!
}

/** `capMult`: product of the 'multipleCap' modifiers (investor winter, GAMEPLAY V2 §5.1), never below the floor. */
export function multipleCap(stage: number, capMult = 1): number {
  const cap = B.MULTIPLE_MAX_BY_STAGE[stage] ?? B.MULTIPLE_MAX
  return capMult === 1 ? cap : Math.max(multipleMin(stage), cap * capMult)
}

/**
 * 0–1: the 3-month MoM against GROWTH_FULL_K × the stage's diligence ask (1 = the ceiling is earned). `askMult`:
 * product of the 'diligenceMom' modifiers (investor winter asks for more growth, GAMEPLAY V2 §5.1).
 */
export function growthScore(momAvg: number, stage: number, askMult = 1): number {
  const ask = B.DILIGENCE_MOM[Math.min(B.DILIGENCE_MOM.length - 1, Math.max(0, stage))]! * askMult
  return clamp(0, 1, momAvg / (B.GROWTH_FULL_K * ask))
}

/** Series A on: 1 − 0.1 per burn-multiple point above the diligence ask, at most 3 points. Seed and before: 1. */
export function bmPenalty(burnMultiple: number, stage: number): number {
  if (stage < B.BM_PENALTY_MIN_STAGE) return 1
  const ask = B.DILIGENCE_BM[Math.min(B.DILIGENCE_BM.length - 1, stage)]!
  return 1 - B.BM_PENALTY_PER_POINT * Math.min(B.BM_PENALTY_MAX_POINTS, Math.max(0, burnMultiple - ask))
}

/** Series A on: more than IDLE_CASH_MONTHS of gross burn in the bank, and no round closed in IDLE_GRACE_DAYS → 0.9. */
export function idlePenalty(stage: number, cash: number, grossBurn: number, day: number, lastRoundCloseDay: number): number {
  const idle = stage >= B.IDLE_PENALTY_MIN_STAGE && cash > B.IDLE_CASH_MONTHS * grossBurn && day - lastRoundCloseDay > B.IDLE_GRACE_DAYS
  return idle ? B.IDLE_PENALTY : 1
}

/**
 * çarpan = (MIN[aşama] + (MAX − MIN) × growthScore) × cezalar (GAMEPLAY V2 §4.1). `penalty` is
 * bmPenalty × idlePenalty × boardPenalty; zero growth gives MIN at every stage.
 */
export function valuationMultiple(momAvg: number, stage: number, penalty = 1, capMult = 1, askMult = 1): number {
  const min = multipleMin(stage)
  return (min + (Math.max(min, multipleCap(stage, capMult)) - min) * growthScore(momAvg, stage, askMult)) * penalty
}

/**
 * Burn multiple: Σ positive net burn of the last BURN_MULTIPLE_MONTHS month ends / max(1, (mrr[n] − mrr[n−3]) × 12).
 * Net ≥ 0 every month → 0; capped at BURN_MULTIPLE_MAX.
 */
export function burnMultiple(netHist: readonly number[], mrrHist: readonly number[], months: number = B.BURN_MULTIPLE_MONTHS): number {
  let burned = 0
  for (let i = Math.max(0, netHist.length - months); i < netHist.length; i++) burned += Math.max(0, -netHist[i]!)
  if (burned <= 0) return 0
  const n = mrrHist.length - 1
  // Growth over the same window the burn covers (an old save's netHistory starts short while mrrHistory is full).
  const span = Math.min(months, netHist.length)
  const gained = n >= 0 ? (mrrHist[n]! - (mrrHist[n - span] ?? 0)) * 12 : 0
  return Math.min(B.BURN_MULTIPLE_MAX, burned / Math.max(1, gained))
}

/** Rule of 40 (display only): annualised 3-month MoM % + net margin %. */
export function ruleOf40(momAvg: number, mrrValue: number, net: number): number {
  return momAvg * 12 * 100 + (mrrValue > 0 ? (net / mrrValue) * 100 : 0)
}

/**
 * Average MoM of the last `months` monthly snapshots (CORE_LOOP §5 "Değerleme çarpanı"): one lucky month no longer
 * pins the multiple to the ceiling, and one flat month does not crash it. Months before revenue (0) are skipped.
 */
export function averageMom(hist: readonly number[], months: number = B.MULTIPLE_MOM_MONTHS): number {
  const rates: number[] = []
  for (let i = hist.length - 1; i >= 1 && rates.length < months; i--) {
    const prev = hist[i - 1]!
    if (prev <= 0) break
    rates.push(momGrowth(prev, hist[i]))
  }
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
}

/** gelir sonrası: MRR × 12 × çarpan. */
export function valuationPostRevenue(mrrValue: number, multiple: number): number {
  return mrrValue * 12 * multiple
}

/** Share of the post-revenue formula counted: MRR / PRE_REVENUE_MRR, max 1 (blends in, no jump at $1K MRR). */
export function revenueBlend(mrrValue: number): number {
  return mrrValue <= 0 ? 0 : Math.min(1, mrrValue / B.PRE_REVENUE_MRR)
}

/**
 * Piecewise valuation: below PRE_REVENUE_MRR the revenue part blends in (× MRR / $1K), so crossing $1K does not jump
 * (review fix: 296K → 375K in one day). The pre-revenue floor holds only up to PRE_REVENUE_FLOOR_MAX_STAGE; from
 * Seed it fades out as revenue blends in, so a company at $1K+ MRR is worth its revenue multiple alone (GAMEPLAY V2 §4.1).
 */
export function valuation(mrrValue: number, multiple: number, pre: number, stage: number): number {
  const blend = revenueBlend(mrrValue)
  if (blend <= 0) return pre
  const post = valuationPostRevenue(mrrValue, multiple) * blend
  // Past the floor stage the floor fades out with the blend (pre × (1 − blend)): no cliff at $1K MRR, no floor above it.
  if (!B.VALUATION_KEEP_PRE_REVENUE_FLOOR || stage > B.PRE_REVENUE_FLOOR_MAX_STAGE) return post + pre * (1 - blend)
  return Math.max(pre, post)
}

/** MoM growth from two monthly MRR snapshots. */
export function momGrowth(prev: number | undefined, current: number | undefined): number {
  if (prev === undefined || current === undefined || prev <= 0) return 0
  return clamp(-1, B.MOM_CLAMP_MAX, (current - prev) / prev)
}

/** LTV = arpu / churn. */
export function ltv(arpuValue: number, churn: number): number {
  return churn > 0 ? arpuValue / churn : 0
}

/** Start cash with founder XP bonus: +10% × XP, max +40%. */
export function startCash(founderXp: number): number {
  return B.START_CASH * (1 + Math.min(B.XP_BONUS_CAP, B.XP_BONUS_PER_XP * Math.max(0, founderXp)))
}
