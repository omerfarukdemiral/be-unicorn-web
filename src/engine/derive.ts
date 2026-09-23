// Recomputes stats/finance/derived from the raw state. Render/UI read these; they never compute formulas.
import * as B from './balance'
import * as E from './economy'
import { horizon, nextStep } from './loopSelectors'
import { auraAt, bookshelfMorale, clusteredEmployees, deskQualityAt, findSlot, officeEffects, openExtraRingCount, type OfficeEffects } from './office'
import { DAYS_PER_MONTH, DEPTS, type Dept, type Employee, type GameState, type ProjectId } from './types'
import { modifierMult, moraleModifierSum, type EngineContent } from './util'

export interface Outputs {
  perEmployee: Record<string, number>
  deptOutput: Record<Dept, number>
  deptCounts: Record<Dept, number>
  coordination: number
  fx: OfficeEffects
}

function perDept(v: number): Record<Dept, number> {
  const o = {} as Record<Dept, number>
  for (const d of DEPTS) o[d] = v
  return o
}

export function employeeStatusFactor(e: Employee): number {
  return e.status === 'onboarding' ? B.ONBOARDING_OUTPUT : 1
}

/** §5.2 per-person output with desk, morale, cluster, coordination and modifiers. */
export function computeOutputs(s: GameState, content: EngineContent): Outputs {
  const fx = officeEffects(s, content)
  const deptCounts = perDept(0)
  for (const e of s.employees) deptCounts[e.dept] += 1
  const coord = E.coordination(s.employees.length, fx.hasMeetingRoom)
  const cluster = clusteredEmployees(s)
  const prodMod = modifierMult(s, 'production')
  const perEmployee: Record<string, number> = {}
  const deptOutput = perDept(0)
  for (const e of s.employees) {
    const slot = e.deskSlotId !== undefined ? findSlot(s.office, e.deskSlotId) : undefined
    const adjacency = (cluster.has(e.id) ? 1 + B.DEPT_CLUSTER_BONUS : 1) + fx.deptBonus[e.dept]
    const out =
      E.personOutput(B.BASE_OUTPUT[e.dept], deskQualityAt(content, slot), e.morale, adjacency, e.quality) *
      employeeStatusFactor(e) *
      coord *
      prodMod
    perEmployee[e.id] = out
    deptOutput[e.dept] += out
  }
  return { perEmployee, deptOutput, deptCounts, coordination: coord, fx }
}

/**
 * §5.3 maturity gained per DAY by each unfinished project: assigned builders (+ the idle founder on the oldest one),
 * slowed by parallel projects and tech debt. progressProjects applies it; the horizon uses it for release ETAs.
 */
export function maturityRates(s: GameState, o: Outputs): Record<ProjectId, number> {
  const rates: Record<ProjectId, number> = {}
  const active = s.projects.filter((p) => p.maturity < 1)
  if (!active.length) return rates
  const speed =
    E.parallelProjectSpeed(active.length, s.stage) *
    Math.max(B.TECH_DEBT_MIN_SPEED, 1 - B.TECH_DEBT_PER_POINT * s.techDebt) *
    (1 + o.fx.maturityBonus)
  const founderProject = s.founder.currentAction ? undefined : active[0]
  for (const p of active) {
    let eng = p === founderProject ? B.FOUNDER_PROJECT_OUTPUT : 0
    let prod = 0
    for (const id of p.assignedIds) {
      const e = s.employees.find((x) => x.id === id)
      if (!e) continue
      if (e.dept === 'eng') eng += o.perEmployee[id] ?? 0
      else if (e.dept === 'product') prod += o.perEmployee[id] ?? 0
    }
    rates[p.id] = E.maturityPerMonth(eng, prod, speed, p.size) / DAYS_PER_MONTH
  }
  return rates
}

/** Costs accrued since the last payday (still to be paid). */
export function owedCosts(s: GameState): number {
  const l = s.finance.ledger
  return l ? l.salaries + l.rent + l.infra + l.ads : 0
}

export function averageLaunchedMaturity(s: GameState): number {
  const launched = s.projects.filter((p) => p.launched)
  if (launched.length === 0) return 0
  return launched.reduce((a, p) => a + p.maturity, 0) / launched.length
}

/** Global morale target without per-desk auras. Unclamped: clamp only after adding the aura. */
export function globalMoraleTarget(s: GameState, o: Outputs, overload: number): number {
  return E.moraleTargetRaw({
    auras: 0,
    decisionBonus: moraleModifierSum(s),
    bookshelf: bookshelfMorale(s, o.fx),
    cashNegative: s.stats.cash < 0,
    overload,
    coordinationPenalty: (1 - o.coordination) * B.COORDINATION_MORALE_FACTOR,
  })
}

export function employeeMoraleTarget(s: GameState, content: EngineContent, e: Employee, globalTarget: number): number {
  const slot = e.deskSlotId !== undefined ? findSlot(s.office, e.deskSlotId) : undefined
  const aura = slot ? auraAt(s, content, slot) : 0
  return E.clamp(0, 100, globalTarget + aura)
}

/** Mutates `s`: stats.arpu/churn, finance.*, derived.*. */
export function recomputeDerived(s: GameState, content: EngineContent): Outputs {
  const o = computeOutputs(s, content)
  const avgMat = averageLaunchedMaturity(s)
  const cap = E.capacity(o.deptCounts.eng, o.fx.capacityMult)
  const over = E.overload(s.stats.users, cap)

  const cacValue = E.cac(s.stage, avgMat) * modifierMult(s, 'cac')
  const organic = E.organicPerMonth(o.deptOutput.marketing, s.stats.reputation, avgMat) * modifierMult(s, 'organic')
  const paid = E.paidPerMonth(s.finance.adBudget, cacValue)
  const manualNow = Number(s.flags['manualThisMonth'] ?? 0)
  const manualLast = Number(s.flags['manualLastMonth'] ?? 0)

  const daysSincePrice = s.finance.priceChangeDay !== undefined ? s.time.day - s.finance.priceChangeDay : null
  const churn =
    E.churnPerMonth(o.deptOutput.ops, over, avgMat) * E.priceChurnFactor(s.finance.priceMultiplier, daysSincePrice) * modifierMult(s, 'churn')
  const arpu = E.arpu(s.stage, s.finance.priceMultiplier, o.deptOutput.sales, avgMat) * modifierMult(s, 'arpu')
  const enterpriseMrr = s.finance.enterpriseCustomers.reduce((a, c) => a + c.mrr, 0)
  const mrr = E.mrr(s.stats.users, arpu, enterpriseMrr)

  const salaries = s.employees.reduce((a, e) => a + e.salary, 0)
  const rent = E.rent(s.stage, openExtraRingCount(s.office))
  const infra = E.infra(s.stats.users, o.fx.infraMult) + o.fx.upkeep
  const burn = E.burn(salaries, rent, infra, s.finance.adBudget)
  const net = mrr - burn

  const hist = s.finance.mrrHistory
  const mom = E.momGrowth(hist[hist.length - 2], hist[hist.length - 1])
  const multiple = E.valuationMultiple(mom)
  const launched = s.projects.filter((p) => p.launched).length
  const valuation = E.valuation(mrr, mom, s.employees.length, s.stats.users, launched)

  s.stats.arpu = arpu
  s.stats.churn = churn
  s.finance.mrr = mrr
  s.finance.burn = burn
  s.finance.burnBreakdown = { salaries, rent, infra, ads: s.finance.adBudget }
  s.finance.net = net
  // Runway counts what payday will take: cash already earmarked for accrued costs is not runway.
  s.finance.runway = E.runway(s.stats.cash - owedCosts(s), net)
  s.finance.valuation = valuation

  const gTarget = globalMoraleTarget(s, o, over)
  const targets = s.employees.map((e) => employeeMoraleTarget(s, content, e, gTarget))
  const moraleTarget = targets.length ? targets.reduce((a, b) => a + b, 0) / targets.length : E.clamp(0, 100, gTarget)

  const next = (s.stage + 1) as number
  const target = next <= B.LAST_STAGE ? B.STAGE_TARGET_VALUATION[next] ?? null : null
  const ltvValue = E.ltv(arpu, churn)

  s.derived = {
    teamSize: s.employees.length,
    deptCounts: o.deptCounts,
    deptOutput: o.deptOutput,
    avgMaturity: avgMat,
    capacity: cap,
    overload: over,
    coordination: o.coordination,
    moraleTarget,
    cac: cacValue,
    ltv: ltvValue,
    ltvCac: arpu > 0 && churn > 0 && cacValue > 0 ? ltvValue / cacValue : null,
    momGrowth: mom,
    valuationMultiple: multiple,
    channels: { organic, paid, manual: Math.max(manualNow, manualLast), enterprise: s.finance.enterpriseCustomers.length },
    stageProgress: target ? valuation / target : 1,
    canStartRound:
      s.gameOver === undefined && s.stage < B.LAST_STAGE - 1 && !(s.round?.active ?? false) && target !== null && valuation >= target,
  }
  s.derived.maturityPerDay = maturityRates(s, o)
  s.derived.nextStep = nextStep(s)
  s.derived.horizon = horizon(s)
  return o
}
