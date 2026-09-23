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

/** ekip > 6 ve toplantı odası yok → × (1 − 0.03 × (ekip − 6)), en fazla −%30. */
export function coordination(teamSize: number, hasMeetingRoom: boolean): number {
  if (hasMeetingRoom || teamSize <= B.COORDINATION_TEAM_FREE) return 1
  return Math.max(B.COORDINATION_MIN, 1 - B.COORDINATION_PER_PERSON * (teamSize - B.COORDINATION_TEAM_FREE))
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

// §5.4 Users ------------------------------------------------------------------

/** kapasite = max(50, müh × 1500). */
export function capacity(eng: number, capacityMult = 1): number {
  return Math.max(B.CAPACITY_MIN, eng * B.CAPACITY_PER_ENG * capacityMult)
}

/** aşırıYük = max(0, users / kapasite − 1). */
export function overload(users: number, cap: number): number {
  return Math.max(0, users / Math.max(1, cap) - 1)
}

/** organik/ay = pazarlama × 25 × (0.5 + itibar/100) × ortOlgunluk. */
export function organicPerMonth(marketing: number, reputation: number, avgMaturity: number): number {
  return marketing * B.ORGANIC_PER_MARKETING * (0.5 + reputation / 100) * avgMaturity
}

/** CAC = 8 × 1.3^aşama / kalite, kalite = 0.5 + ortOlgunluk. */
export function cac(stage: number, avgMaturity: number): number {
  return (B.CAC_BASE * B.CAC_STAGE_GROWTH ** stage) / (0.5 + avgMaturity)
}

/** reklam/ay = reklamBütçesi / CAC. */
export function paidPerMonth(adBudget: number, cacValue: number): number {
  return cacValue > 0 ? adBudget / cacValue : 0
}

/** churn/ay = 0.06 × (1 − min(0.6, ops × 0.02)) × (1 + aşırıYük) × (1.5 − ortOlgunluk). */
export function churnPerMonth(ops: number, overloadValue: number, avgMaturity: number): number {
  return B.CHURN_BASE * (1 - Math.min(B.CHURN_OPS_MAX, ops * B.CHURN_OPS_PER)) * (1 + overloadValue) * (1.5 - avgMaturity)
}

/** Price increase → churn × (1 + (fiyatÇarpanı − 1) × 0.8) for one month. */
export function priceChurnFactor(priceMultiplier: number, daysSinceChange: number | null): number {
  if (daysSinceChange === null || daysSinceChange >= B.PRICE_CHURN_DAYS || priceMultiplier <= 1) return 1
  return 1 + (priceMultiplier - 1) * B.PRICE_CHURN_FACTOR
}

// §5.5 Revenue ----------------------------------------------------------------

/** arpu = 4 × 1.15^aşama × fiyat × (1 + min(0.8, satış × 0.04)) × (0.3 + 0.7 × ortOlgunluk). */
export function arpu(stage: number, priceMultiplier: number, sales: number, avgMaturity: number): number {
  return (
    B.ARPU_BASE *
    B.ARPU_STAGE_GROWTH ** stage *
    priceMultiplier *
    (1 + Math.min(B.ARPU_SALES_MAX, sales * B.ARPU_SALES_PER)) *
    (0.3 + 0.7 * avgMaturity)
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

/** altyapı = users / 1000 × 10 × (sunucuOdası ? 0.8 : 1). */
export function infra(users: number, infraMult = 1): number {
  return (users / 1000) * B.INFRA_PER_1000_USERS * infraMult
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

/** gelir öncesi: 60K × ekip + 150 × users + 200K × yayındakiProje. */
export function valuationPreRevenue(team: number, users: number, launchedProjects: number): number {
  return B.VAL_PER_TEAM * team + B.VAL_PER_USER * users + B.VAL_PER_LAUNCHED * launchedProjects
}

/** çarpan = clamp(4, tavan, 6 + 150 × aylıkBüyüme); tavan = MULTIPLE_MAX, or the stage's MULTIPLE_MAX_BY_STAGE (Faz 3). */
export function valuationMultiple(momGrowth: number, cap: number = B.MULTIPLE_MAX): number {
  return clamp(B.MULTIPLE_MIN, Math.max(B.MULTIPLE_MIN, cap), B.MULTIPLE_BASE + B.MULTIPLE_GROWTH * momGrowth)
}

/** The stage's multiple ceiling: 30 → 25 → 20 → 15 → 12 → 10. */
export function multipleCap(stage: number): number {
  return B.MULTIPLE_MAX_BY_STAGE[stage] ?? B.MULTIPLE_MAX
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

/** PLAN piecewise valuation (+ optional pre-revenue floor for continuity, see balance). */
export function valuation(mrrValue: number, momGrowth: number, team: number, users: number, launched: number, cap: number = B.MULTIPLE_MAX): number {
  const pre = valuationPreRevenue(team, users, launched)
  if (mrrValue < B.PRE_REVENUE_MRR) return pre
  const post = valuationPostRevenue(mrrValue, valuationMultiple(momGrowth, cap))
  return B.VALUATION_KEEP_PRE_REVENUE_FLOOR ? Math.max(pre, post) : post
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
