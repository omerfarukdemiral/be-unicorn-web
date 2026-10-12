// Shared fixtures of the project-module tests (W2a): a live company at 1.0, and the pre-module derive formulas.
import * as B from '../balance'
import * as E from '../economy'
import { averageLaunchedMaturity, categoryMix, computeOutputs, payroll, recomputeDerived } from '../derive'
import { createEngine } from '../index'
import { openExtraRingCount } from '../office'
import { enterStage } from '../round'
import type { Action, GameState, ProjectCategory, ProjectModuleId, StageIndex } from '../types'
import { clone, modifierMult, policyMult } from '../util'
import { marketOf, marketUpkeep } from '../world'
import { fakeContent } from './fixtures'

export const content = fakeContent()
export const api = createEngine(content)

/** A company at `stage` with `cats` projects, all live and at 1.0, a small team on the first one, cash to spare. */
export function company(cats: readonly ProjectCategory[], stage: StageIndex = 2, seed = 11): GameState {
  let s = clone(api.createGame({ seed }))
  for (let st = 1; st <= stage; st++) enterStage(s, st as StageIndex)
  s.stats.cash = 2_000_000
  const act = (a: Action) => {
    const r = api.applyAction(s, a)
    if (r.ok) s = r.state
  }
  for (let i = 0; i < 5; i++) act({ type: 'placeItem', itemId: 'desk-basic' })
  for (let k = 0; k < 2; k++) {
    for (const c of [...s.candidates]) act({ type: 'hire', candidateId: c.id })
    act({ type: 'refreshCandidates' })
  }
  for (const category of cats) act({ type: 'startProject', category })
  s = clone(s)
  s.stats.users = 3_000
  s.finance.adBudget = 4_000
  for (const p of s.projects) {
    p.maturity = 1
    p.launched = true
    p.launchedDay = 0
    p.releaseLevel = 5
  }
  recomputeDerived(s, content)
  return s
}

export const build = (s: GameState, i: number, moduleId: ProjectModuleId) => api.applyAction(s, { type: 'buildModule', projectId: s.projects[i]!.id, moduleId })

/** Installs modules at `day` without the build (pure-math tests). */
export function withModules(s: GameState, i: number, ids: readonly ProjectModuleId[], day = s.time.day): GameState {
  const c = clone(s)
  c.projects[i]!.modules = ids.map((id) => ({ id, day }))
  recomputeDerived(c, content)
  return c
}

/** The pre-W2a formulas of recomputeDerived (derive.ts before modules), on the same state. */
export function legacy(s: GameState) {
  const o = computeOutputs(s, content)
  const avgMat = averageLaunchedMaturity(s)
  const cap = E.capacity(o.deptCounts.eng, o.fx.capacityMult * modifierMult(s, 'capacity') * policyMult(s, content, 'capacity'))
  const over = E.overload(s.stats.users, cap)
  const rivalShare = E.rivalShareTotal(s.rivals)
  const arpu = E.arpu(s.stage, s.finance.priceMultiplier, o.deptOutput.sales, avgMat, rivalShare) * modifierMult(s, 'arpu') * policyMult(s, content, 'arpu') * categoryMix(s, B.CATEGORY_ARPU)
  const enterpriseMrr = s.finance.enterpriseCustomers.reduce((a, c) => a + c.mrr, 0)
  const mrr = s.projects.some((p) => p.launched) ? E.mrr(s.stats.users, arpu, enterpriseMrr) : enterpriseMrr
  const tam = E.marketTam(marketOf(s).segments, s.time.day)
  const pen = E.penetration(s.stats.users, tam)
  const cac = E.cac(s.stage, avgMat, s.finance.adBudget, mrr, pen) * modifierMult(s, 'cac') * policyMult(s, content, 'cac')
  const organic = E.organicPerMonth(o.deptOutput.marketing, s.stats.reputation, avgMat, pen, rivalShare) * modifierMult(s, 'organic') * policyMult(s, content, 'organic') * categoryMix(s, B.CATEGORY_ORGANIC)
  const paid = E.paidPerMonth(s.finance.adBudget, cac, pen)
  const daysSincePrice = s.finance.priceChangeDay !== undefined ? s.time.day - s.finance.priceChangeDay : null
  const churn = E.churnPerMonth(o.deptOutput.ops, over, avgMat, pen, s.techDebt) * E.priceChurnFactor(s.finance.priceMultiplier, daysSincePrice) * modifierMult(s, 'churn') * policyMult(s, content, 'churn')
  const rent = E.rent(s.stage, openExtraRingCount(s.office)) * modifierMult(s, 'rent') * policyMult(s, content, 'rent')
  const infra = E.infra(s.stats.users, mrr, s.stage, o.fx.infraMult * policyMult(s, content, 'infra')) + o.fx.upkeep
  const burn = E.burn(payroll(s, content).paid, rent, infra, s.finance.adBudget, E.founderLiving(s.stage) * policyMult(s, content, 'founderPay'), marketUpkeep(s))
  const hist = s.finance.mrrHistory
  const bm = E.burnMultiple(s.finance.netHistory ?? [], hist)
  const penalty = E.bmPenalty(bm, s.stage) * E.idlePenalty(s.stage, s.stats.cash, burn, s.time.day, s.finance.lastRoundCloseDay ?? s.time.day) * (s.flags[B.BOARD_PENALTY_FLAG] ? B.BOARD_CAP_PENALTY : 1)
  const multiple = E.valuationMultiple(E.averageMom(hist), s.stage, penalty, modifierMult(s, 'multipleCap'), modifierMult(s, 'diligenceMom'))
  const pre = E.valuationPreRevenue(s.stats.users, s.projects.filter((p) => p.launched).length, Math.min(B.VAL_RELEASE_MAX, s.releaseCount ?? 0))
  return { arpu, churn, organic, paid, cac, tam, infra, burn, valuation: E.valuation(mrr, multiple, pre, s.stage) }
}

export function current(s: GameState) {
  return {
    arpu: s.stats.arpu,
    churn: s.stats.churn,
    organic: s.derived.channels.organic,
    paid: s.derived.channels.paid,
    cac: s.derived.cac,
    tam: s.derived.tam,
    infra: s.finance.burnBreakdown.infra,
    burn: s.finance.burn,
    valuation: s.finance.valuation,
  }
}
