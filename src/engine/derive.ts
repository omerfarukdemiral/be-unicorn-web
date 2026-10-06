// Recomputes stats/finance/derived from the raw state. Render/UI read these; they never compute formulas.
import * as B from './balance'
import * as E from './economy'
import { loanMonthlyService } from './effects'
import { findUsersPreview, movesView, renewalViews, salesCallPreview } from './founder'
import { heldWages, horizon, nextCrisis, nextStep, owedTotal } from './loopSelectors'
import { roundRetryIn, roundView, roundWindowOpen } from './round'
import { auraAt, bookshelfMorale, clusteredEmployees, deskQualityAt, findSlot, officeEffects, openExtraRingCount, type OfficeEffects } from './office'
import { DAYS_PER_MONTH, DEPTS, POLICY_IDS, type Dept, type Employee, type GameState, type PoliciesView, type PolicyId, type PolicyKind, type ProjectCategory, type ProjectId, type ValuationBreakdown } from './types'
import { adoptedPolicies, modifierMult, payLaterOpen, moraleModifierSum, policyMult, policySum, type EngineContent } from './util'
import { boardView, marketOf, marketUpkeep, marketView } from './world'

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
  const coord = E.coordination(s.employees.length, fx.hasMeetingRoom, policyMult(s, content, 'coordination'))
  const cluster = clusteredEmployees(s)
  const prodMod = modifierMult(s, 'production') * policyMult(s, content, 'production')
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
 * §5.3 maturity gained per DAY by each project: assigned builders (+ the idle founder on the oldest unfinished one,
 * or on the first project once all are done), slowed by parallel projects and tech debt. progressProjects applies it
 * (to maturity, or after 1.0 to the next update); the horizon uses it for release ETAs.
 */
export function maturityRates(s: GameState, o: Outputs): Record<ProjectId, number> {
  const rates: Record<ProjectId, number> = {}
  if (!s.projects.length) return rates
  const active = s.projects.filter((p) => p.maturity < 1)
  const speed =
    E.parallelProjectSpeed(active.length, s.stage) *
    E.techDebtSpeed(s.techDebt) *
    (1 + o.fx.maturityBonus)
  const founderProject = s.founder.currentAction ? undefined : (active[0] ?? s.projects[0])
  for (const p of s.projects) {
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

/** Costs still to be paid: accrued since the last payday, a month on the payday desk, deferrals (GAMEPLAY V2 §6.1). */
export function owedCosts(s: GameState): number {
  return owedTotal(s)
}

export function averageLaunchedMaturity(s: GameState): number {
  const launched = s.projects.filter((p) => p.launched)
  if (launched.length === 0) return 0
  return launched.reduce((a, p) => a + p.maturity, 0) / launched.length
}

/** Global morale target without per-desk auras. Unclamped: clamp only after adding the aura. */
export function globalMoraleTarget(s: GameState, content: EngineContent, o: Outputs, overload: number): number {
  return E.moraleTargetRaw({
    auras: 0,
    decisionBonus: moraleModifierSum(s),
    bookshelf: bookshelfMorale(s, o.fx),
    cashNegative: s.stats.cash < 0,
    overload,
    coordinationPenalty: (1 - o.coordination) * B.COORDINATION_MORALE_FACTOR,
    wagesOwed: s.flags['wagesOwed'] === true,
    policies: policySum(s, content, 'moraleTarget'),
  })
}

/**
 * Monthly payroll after the policies (GAMEPLAY V2 §7.2): 'salary' multipliers scale it; the part a payLater policy
 * (deferred-pay) holds back is not paid now but owed until the next round close (`later`).
 */
export function payroll(s: GameState, content: EngineContent): { paid: number; later: number } {
  const raw = s.employees.reduce((a, e) => a + e.salary, 0)
  let full = raw
  let held = 1
  const later = payLaterOpen(s)
  for (const p of adoptedPolicies(s, content)) {
    const m = p.effect.mult?.salary ?? 1
    if (p.effect.payLater) held *= later ? m : 1
    else full *= m
  }
  return { paid: full * held, later: full * (1 - held) }
}

/** The Kanun Kitabı now (state.derived.policies): what can be signed, and the totals content-free paths read. */
export function policiesView(s: GameState, content: EngineContent, later: number): PoliciesView {
  const st = s.policies
  const adopted: PolicyId[] = [...(st?.adopted ?? [])]
  const signed = adoptedPolicies(s, content)
  const nextSignDay = (st?.lastSignedDay ?? B.POLICY_NEVER_SIGNED) + B.POLICY_SIGN_COOLDOWN_DAYS
  const available: PolicyId[] = []
  if (s.stage >= B.POLICY_MIN_STAGE) {
    for (const p of content.policies ?? []) {
      if (adopted.includes(p.id) || p.excludes?.some((x) => adopted.includes(x)) || signed.some((q) => q.excludes?.includes(p.id))) continue
      if (p.effect.payLater && !payLaterOpen(s)) continue
      let ok = false
      try {
        ok = p.unlock(s) === true
      } catch {
        ok = false
      }
      if (ok) available.push(p.id)
    }
  }
  const mult: Partial<Record<PolicyKind, number>> = {}
  // A payLater salary cut with no round ahead holds nothing back (payroll), so the view's salary leaves it out too.
  for (const p of signed) {
    for (const [k, v] of Object.entries(p.effect.mult ?? {}) as [PolicyKind, number][]) {
      if (k === 'salary' && p.effect.payLater && !payLaterOpen(s)) continue
      mult[k] = (mult[k] ?? 1) * v
    }
  }
  // Content order is the lawbook's; keep the ids' canonical order for the view.
  available.sort((a, b) => POLICY_IDS.indexOf(a) - POLICY_IDS.indexOf(b))
  return { available, adopted, nextSignDay, mult, movesBonus: policySum(s, content, 'movesBonus'), burnAsk: policySum(s, content, 'burnAsk'), payLater: later }
}

export function employeeMoraleTarget(s: GameState, content: EngineContent, e: Employee, globalTarget: number): number {
  const slot = e.deskSlotId !== undefined ? findSlot(s.office, e.deskSlotId) : undefined
  const aura = slot ? auraAt(s, content, slot) : 0
  return E.clamp(0, 100, globalTarget + aura)
}

/** Mean of a per-category factor over the launched projects (1 before the first launch). */
export function categoryMix(s: GameState, table: Readonly<Record<ProjectCategory, number>>): number {
  const live = s.projects.filter((p) => p.launched)
  if (live.length === 0) return 1
  return live.reduce((a, p) => a + (table[p.category] ?? 1), 0) / live.length
}

/** Mutates `s`: stats.arpu/churn, finance.*, derived.*. */
export function recomputeDerived(s: GameState, content: EngineContent): Outputs {
  const o = computeOutputs(s, content)
  const avgMat = averageLaunchedMaturity(s)
  // GAMEPLAY V2 §6.1: deferred infra or an eviction leaves fewer servers for a while.
  const cap = E.capacity(o.deptCounts.eng, o.fx.capacityMult * modifierMult(s, 'capacity') * policyMult(s, content, 'capacity'))
  const over = E.overload(s.stats.users, cap)

  // GAMEPLAY V2 §8.2: the named rivals' share presses the price and takes from word of mouth (§4.3).
  const rivalShare = E.rivalShareTotal(s.rivals)
  const arpu = E.arpu(s.stage, s.finance.priceMultiplier, o.deptOutput.sales, avgMat, rivalShare) * modifierMult(s, 'arpu') * policyMult(s, content, 'arpu') * categoryMix(s, B.CATEGORY_ARPU)
  const enterpriseMrr = s.finance.enterpriseCustomers.reduce((a, c) => a + c.mrr, 0)
  // Before the first release users are "beta": they wait at the door and pay nothing (docs/CORE_LOOP.md §4.4 0:14).
  const anyLaunched = s.projects.some((p) => p.launched)
  const mrr = anyLaunched ? E.mrr(s.stats.users, arpu, enterpriseMrr) : enterpriseMrr

  // GAMEPLAY V2 §4.3, §8.1: a finite market (Σ open segments, each ramping in) saturates both channels and lifts
  // churn; ads past the MRR saturate on their own (super-linear CAC), so the paid channel has a peak.
  const tam = E.marketTam(marketOf(s).segments, s.time.day)
  const pen = E.penetration(s.stats.users, tam)
  const cacValue = E.cac(s.stage, avgMat, s.finance.adBudget, mrr, pen) * modifierMult(s, 'cac') * policyMult(s, content, 'cac')
  const organic = E.organicPerMonth(o.deptOutput.marketing, s.stats.reputation, avgMat, pen, rivalShare) * modifierMult(s, 'organic') * policyMult(s, content, 'organic') * categoryMix(s, B.CATEGORY_ORGANIC)
  const paid = E.paidPerMonth(s.finance.adBudget, cacValue, pen)
  const manualNow = Number(s.flags['manualThisMonth'] ?? 0)
  const manualLast = Number(s.flags['manualLastMonth'] ?? 0)

  const daysSincePrice = s.finance.priceChangeDay !== undefined ? s.time.day - s.finance.priceChangeDay : null
  const churn =
    E.churnPerMonth(o.deptOutput.ops, over, avgMat, pen, s.techDebt) *
    E.priceChurnFactor(s.finance.priceMultiplier, daysSincePrice) *
    modifierMult(s, 'churn') *
    policyMult(s, content, 'churn')

  // GAMEPLAY V2 §7.2: the policies scale payroll, rent, infra and the founder's pay; the ledger accrues what is left.
  const pay = payroll(s, content)
  const salaries = pay.paid
  const rent = E.rent(s.stage, openExtraRingCount(s.office)) * modifierMult(s, 'rent') * policyMult(s, content, 'rent')
  const infra = E.infra(s.stats.users, mrr, s.stage, o.fx.infraMult * policyMult(s, content, 'infra')) + o.fx.upkeep
  const living = E.founderLiving(s.stage) * policyMult(s, content, 'founderPay')
  const expansion = marketUpkeep(s)
  const burn = E.burn(salaries, rent, infra, s.finance.adBudget, living, expansion)
  const net = mrr - burn

  const hist = s.finance.mrrHistory
  const mom = E.momGrowth(hist[hist.length - 2], hist[hist.length - 1])
  // GAMEPLAY V2 §4.1: the multiple prices the 3-month average growth against the stage's ask, between the stage's
  // floor and ceiling, then burn efficiency, idle cash and the board's verdict.
  const momAvg = E.averageMom(hist)
  const bm = E.burnMultiple(s.finance.netHistory ?? [], hist)
  // No close day on record (old v4 save): no idle penalty until world.monthEnd stamps one.
  const penalty =
    E.bmPenalty(bm, s.stage) *
    E.idlePenalty(s.stage, s.stats.cash, burn, s.time.day, s.finance.lastRoundCloseDay ?? s.time.day) *
    (s.flags[B.BOARD_PENALTY_FLAG] ? B.BOARD_CAP_PENALTY : 1)
  // Investor winter (GAMEPLAY V2 §5.1): a lower ceiling and a higher growth ask while its modifiers last.
  const capMult = modifierMult(s, 'multipleCap')
  const multCap = E.multipleCap(s.stage, capMult)
  const multiple = E.valuationMultiple(momAvg, s.stage, penalty, capMult, modifierMult(s, 'diligenceMom'))
  const launched = s.projects.filter((p) => p.launched).length
  const releases = Math.min(B.VAL_RELEASE_MAX, s.releaseCount ?? 0)
  const pre = E.valuationPreRevenue(s.stats.users, launched, releases)
  const valuation = E.valuation(mrr, multiple, pre, s.stage)
  const blend = E.revenueBlend(mrr)
  const mode = blend > 0 && valuation !== pre ? 'post' : 'pre'
  const valuationParts: ValuationBreakdown = {
    mode,
    users: s.stats.users,
    launched,
    releases,
    usersValue: B.VAL_PER_USER * s.stats.users,
    launchedValue: B.VAL_PER_LAUNCHED * launched,
    releasesValue: B.VAL_PER_RELEASE * releases,
    mrr,
    multiple,
    momAvg,
    min: E.multipleMin(s.stage),
    cap: multCap,
    penalty,
    blend,
    // What the revenue part does not explain: the pre-revenue floor fading out from Seed (economy.valuation).
    preFade: mode === 'post' ? Math.max(0, valuation - E.valuationPostRevenue(mrr, multiple) * blend) : 0,
    total: valuation,
  }

  s.stats.arpu = arpu
  s.stats.churn = churn
  s.finance.mrr = mrr
  s.finance.burn = burn
  s.finance.burnBreakdown = { salaries, rent, infra, ads: s.finance.adBudget, founder: living, ...(expansion > 0 ? { expansion } : {}) }
  s.finance.net = net
  // Runway counts what payday will take: cash already earmarked for accrued costs is not runway, and the loan's
  // monthly service is a cost like any other (GAMEPLAY V2 §6.2); deferred-pay's held wages are owed too (§7.2).
  s.finance.runway = E.runway(s.stats.cash - owedCosts(s) - heldWages(s), net - loanMonthlyService(s))
  s.finance.valuation = valuation

  const gTarget = globalMoraleTarget(s, content, o, over)
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
    momAvg,
    multipleCap: multCap,
    valuationMultiple: multiple,
    burnMultiple: bm,
    ruleOf40: E.ruleOf40(momAvg, mrr, net),
    channels: { organic, paid, manual: Math.max(manualNow, manualLast), enterprise: s.finance.enterpriseCustomers.length },
    stageProgress: target ? valuation / target : 1,
    // Early window (docs/CORE_LOOP.md §4.3): the round can start at ROUND_EARLY_RATIO of the target.
    // GAMEPLAY V2 §6.3: a failed round closes the door for ROUND_RETRY_DAYS.
    canStartRound: s.gameOver === undefined && s.stage < B.LAST_STAGE - 1 && !(s.round?.active ?? false) && roundWindowOpen(valuation, target) && roundRetryIn(s) === 0,
  }
  // First: the move budget, the founder's energy and the round's burn ask read these totals (no content there).
  s.derived.policies = policiesView(s, content, pay.later)
  const goalsDone = s.goalsDone ?? []
  const stars = (content.goals ?? []).filter((g) => g.stage === s.stage && goalsDone.includes(g.id)).length
  const rv = roundView(s, stars)
  if (rv) s.derived.round = rv
  s.derived.findUsers = findUsersPreview(s)
  s.derived.salesCall = salesCallPreview(s)
  s.derived.tam = tam
  s.derived.penetration = pen
  // After tam and the multiple: the market map prices segments and rivals with them.
  s.derived.market = marketView(s)
  s.derived.valuationParts = valuationParts
  s.derived.maturityPerDay = maturityRates(s, o)
  s.derived.nextStep = nextStep(s)
  // GAMEPLAY V2 §8.3–8.4: the board's quarter and the contracts up for renewal (the horizon lists both).
  const board = boardView(s)
  if (board) s.derived.board = board
  const renewals = renewalViews(s)
  if (renewals.length) s.derived.renewals = renewals
  s.derived.horizon = horizon(s)
  const crisis = nextCrisis(s)
  if (crisis) s.derived.nextCrisis = crisis
  const moves = movesView(s)
  if (moves) s.derived.moves = moves
  return o
}
