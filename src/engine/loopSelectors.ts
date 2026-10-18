// Pure core-loop selectors (docs/CORE_LOOP.md §5): the next link of the main chain and the horizon ahead.
// recomputeDerived stores both in state.derived (render/ui read them there); sim may call them directly.
import * as B from './balance'
import { growthScore, ledgerCosts, runway, valuation, valuationPreRevenue } from './economy'
import { effortOn, ledMember, onLeave } from './effort'
import { projectVersion, updateSize, versionUpdates } from './modules'
import { diligenceNow, offerFactor, priceRatio } from './round'
import { founderActionError, salesCallPreview } from './founder'
import { moduleOffers } from './modules'
import { modifierMult } from './util'
import { rivalOut } from './world'
import {
  DAYS_PER_MONTH,
  DAYS_PER_WEEK,
  type CashProjection,
  type CompanyProfile,
  type EmployeeId,
  type GameState,
  type HorizonItem,
  type NextCrisis,
  type Action,
  type NextMove,
  type ProjectModuleId,
  type NextStep,
  type NextStepId,
  type SpendPreview,
} from './types'

/**
 * Chain order; round / roundWait / grow share the last link. Goals, not moves (playtest 2026-10-08, "tek yol
 * dayatılmasın"): the old findUsers → desk → hire links told everyone to open the same way; how the player gets to
 * the MVP and the users (alone, with a hire, with ads, with sales) is theirs. The ids stay in NEXT_STEP_IDS for saves.
 * Fix round 2 (playtest 2026-10-17: 106 solo garage days, no hire, nothing happening): a solo founder before the MVP
 * is offered the first hire once (a suggestion, skipped by launching alone): one builder halves the road to the MVP.
 */
const CHAIN: readonly NextStepId[] = ['idea', 'hire', 'launch', 'users', 'traction', 'round']
const CHAIN_TOTAL = CHAIN.length

function step(id: NextStepId, extra: Omit<NextStep, 'id' | 'index' | 'total'> = {}): NextStep {
  const i = CHAIN.indexOf(id)
  return { id, index: (i < 0 ? CHAIN_TOTAL - 1 : i) + 1, total: CHAIN_TOTAL, ...extra }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** The cheapest hire still leaves HIRE_RUNWAY_MIN months of runway (derived.hireRunway; unknown = yes). */
export function hireAffordable(s: Pick<GameState, 'derived'>): boolean {
  const r = s.derived.hireRunway
  return r === undefined || r === null || r >= B.HIRE_RUNWAY_MIN
}

/** Runway after hiring the cheapest candidate (salary + the auto desk when none stands free); see derived.hireRunway. */
export function cheapestHireRunway(s: GameState, deskCost: number | null): number | null | undefined {
  if (!s.candidates.length || deskCost === null) return undefined
  const salary = Math.min(...s.candidates.map((c) => c.salary))
  return previewSpend(s, { cashDelta: -deskCost, burnDelta: policyCost(s, 'salary', salary) }).runwayAfter
}

/**
 * What a tap on the chip does when it is one engine verb (the UI's followStep and sim/naive.ts share it), or null when
 * the chip only opens a place. 'hire': the cheapest candidate with its desk; 'users' / 'traction': the users focus.
 */
export function stepAction(s: GameState, st: NextStep): Action | null {
  if (st.move) return moveAction(s, st.move)
  switch (st.id) {
    case 'hire': {
      // The MVP needs a builder: the cheapest engineer / product person, else the cheapest anyone.
      const bySalary = [...s.candidates].sort((a, b) => a.salary - b.salary)
      const c = bySalary.find((x) => x.dept === 'eng' || x.dept === 'product') ?? bySalary[0]
      return c ? { type: 'hire', candidateId: c.id, autoDesk: true } : null
    }
    case 'findUsers':
    case 'users':
    case 'traction':
      return s.founder.focus === 'users' ? null : { type: 'setFounderFocus', focus: 'users' }
    default:
      return null
  }
}

/** The engine verb of a chip move (null when it is no longer possible). */
export function moveAction(s: GameState, move: NextMove): Action | null {
  switch (move) {
    case 'salesCall':
      return { type: 'founderAction', kind: 'salesCall' }
    case 'adsCut':
      return { type: 'setAdBudget', amount: 0 }
    case 'price': {
      const up = PRICE_STEPS.find((p) => p > s.finance.priceMultiplier + 1e-9)
      return up !== undefined ? { type: 'setPrice', multiplier: up } : null
    }
    case 'focusUsers':
      return { type: 'setFounderFocus', focus: 'users' }
    case 'ads':
      return { type: 'setAdBudget', amount: firstAdBudget(s) }
    case 'module': {
      const pick = moduleToBuild(s)
      return pick ? { type: 'buildModule', projectId: pick.projectId, moduleId: pick.moduleId } : null
    }
  }
}

/** A first ad budget: half the MRR, at least the garage's paid floor, at most this stage's (no 2× MRR spend at Seed). */
function firstAdBudget(s: GameState): number {
  const lo = B.CAC_SPEND_FLOOR[0] ?? 0
  return Math.round(Math.min(B.CAC_SPEND_FLOOR[s.stage] ?? lo, Math.max(lo, s.finance.mrr * NEXT_MOVE_AD_MRR)))
}
/** The first ad budget as a share of MRR. */
const NEXT_MOVE_AD_MRR = 0.5

/** A finished product not building anything, and its cheapest module that can start now. */
function moduleToBuild(s: GameState): { projectId: string; moduleId: ProjectModuleId } | null {
  for (const p of s.projects) {
    if (p.maturity < 1 || p.build) continue
    const offer = moduleOffers(s, p)
      .filter((o) => !o.refresh && o.error === null && o.cost <= freeCash(s))
      .sort((a, b) => a.cost - b.cost)[0]
    if (offer) return { projectId: p.id, moduleId: offer.id }
  }
  return null
}

/**
 * Fix round 3: the one concrete move a guided player needs now, garage and Pre-seed, no round running. Cash first
 * (runway under HIRE_RUNWAY_MIN: a sales call, else stop the ads, else a price step up), then growth (users flat
 * against last month: the users focus, else a first ad budget the runway carries), then the product (a finished one
 * idle: its cheapest module). undefined = the goal itself is the move.
 */
export function nextMove(s: GameState): NextMove | undefined {
  if (s.stage > NEXT_MOVE_MAX_STAGE || s.round?.active || !s.projects.some((p) => p.launched)) return undefined
  const rw = s.finance.runway
  const sales = founderActionError(s, 'salesCall') === null && salesCallPreview(s).factor >= NEXT_MOVE_SALES_FACTOR
  if (rw !== null && rw < B.HIRE_RUNWAY_MIN) {
    if (sales) return 'salesCall'
    if (s.finance.adBudget > 0) return 'adsCut'
    if (s.finance.priceMultiplier < NEXT_MOVE_PRICE_CAP - 1e-9) return 'price'
  }
  const last = s.finance.usersHistory[s.finance.usersHistory.length - 1]
  const flat = last !== undefined && s.stats.users <= last * (1 + NEXT_MOVE_FLAT_GROWTH)
  if (flat) {
    if (s.founder.focus !== 'users' && (s.derived.findUsers?.factor ?? 1) >= B.FOCUS_FIND_MIN_FACTOR) return 'focusUsers'
    if (s.finance.adBudget <= 0) {
      // Only an ad budget the runway carries (no ads on / ads cut loop).
      const after = previewSpend(s, { burnDelta: firstAdBudget(s) }).runwayAfter
      if (after === null || after >= B.HIRE_RUNWAY_MIN) return 'ads'
    }
  }
  if (moduleToBuild(s)) return 'module'
  return undefined
}
/** Moves are named up to Seed (a guided player must reach Series A; the chip closes from A on). */
const NEXT_MOVE_MAX_STAGE = 2
/** A sales call is named while the month's deals still pay at least half. */
const NEXT_MOVE_SALES_FACTOR = 0.5
/** The price move stops here (the chip never walks the price to the top). */
const NEXT_MOVE_PRICE_CAP = 1.3
/** Users within this of last month's count read as flat. */
const NEXT_MOVE_FLAT_GROWTH = 0.02

/** Day of a project's last update or 1.0 release (−∞ = none on record). */
export function lastUpdateDay(s: GameState, projectId: string): number {
  const list = s.releases ?? []
  for (let i = list.length - 1; i >= 0; i--) if (list[i]!.projectId === projectId && list[i]!.level >= B.RELEASE_THRESHOLDS.length) return list[i]!.day
  return -Infinity
}

/**
 * First unmet link of: idea → (solo garage: first hire) → release (MVP) → users → traction → round.
 * 'traction' is the garage / pre-seed valuation link before revenue: valuation there is launched × $150K + users ×
 * $400 + releases (max 5) × $15K (economy.valuationPreRevenue, GAMEPLAY V2 §4.1): users and releases, not hires.
 * Links that are done stay done (a later stage never sends the player back to "pick an idea" once a project runs).
 */
export function nextStep(s: GameState): NextStep {
  const st = chainStep(s)
  const move = st.id === 'idea' || st.id === 'hire' || st.id === 'round' || st.id === 'roundWait' ? undefined : nextMove(s)
  return move ? { ...st, move } : st
}

function chainStep(s: GameState): NextStep {
  if (s.projects.length === 0) return step('idea')
  if (!s.projects.some((p) => p.launched)) {
    if (s.stage === 0 && s.employees.length === 0 && s.candidates.length > 0 && hireAffordable(s)) return step('hire')
    const best = s.projects.reduce((m, p) => Math.max(m, p.maturity), 0)
    return step('launch', { progress: clamp01(best / B.MVP_MATURITY), target: B.MVP_MATURITY })
  }
  if (s.stats.users < B.NEXT_STEP_USERS && s.stage === 0) return step('users', { progress: clamp01(s.stats.users / B.NEXT_STEP_USERS), target: B.NEXT_STEP_USERS })
  const target = B.STAGE_TARGET_VALUATION[s.stage + 1] ?? null
  if (s.finance.mrr < B.PRE_REVENUE_MRR && s.stage <= 1 && !s.round?.active && !s.derived.canStartRound && target !== null) {
    const windowAt = target * B.ROUND_EARLY_RATIO
    return step('traction', { progress: clamp01(s.finance.valuation / windowAt), target: windowAt })
  }
  if (s.round?.active) {
    const r = s.round
    return step('roundWait', { progress: r.weeksTotal > 0 ? clamp01(1 - r.weeksLeft / r.weeksTotal) : 0 })
  }
  if (s.derived.canStartRound) return step('round')
  return step('grow', { progress: clamp01(s.derived.stageProgress), ...(target !== null ? { target } : {}) })
}

/**
 * Builders with nothing to build (playtest LD1): eng/product people on no project. Extra builders on a finished
 * project are not idle: their output still fills its updates. `withOnboarding` also returns fresh hires still
 * onboarding (startProject takes them; the scene marker and Team pill wait until they are in).
 * Read by startProject (who moves), the scene's idle marker, the Team row and the Projects tab.
 */
export function idleBuilders(s: Pick<GameState, 'employees'>, withOnboarding = false): EmployeeId[] {
  const out: EmployeeId[] = []
  for (const e of s.employees) {
    if (e.dept !== 'eng' && e.dept !== 'product') continue
    if (e.status === 'leaving' || (e.status === 'onboarding' && !withOnboarding)) continue
    if (e.projectId === undefined) out.push(e.id)
  }
  return out
}

/** Why someone asks the player in the scene (E1 adds the effort needs to leaving / idle). */
export type StaffAttention = 'leaving' | 'burnout' | 'tired' | 'bored' | 'calmBack' | 'idle'

/**
 * Who needs the player, in order leaving > burnout > tired > bored > calmBack > idle, one need per person (ids in
 * numeric order within a need; burnout and tired by fatigue, bored by bored days). From Pre-seed only: burnout (fatigue
 * ≥ FATIGUE_BURNOUT, all of them: the scene pins those bubbles), tired (≥ FATIGUE_TIRED and not already calm, so
 * "Yavaşlat" answers it: F2), bored (BORED_BUBBLE_DAYS+ under UNDERLOAD) and calmBack (a calm pace the player set, fatigue under CALM_BACK_AT: "Normale dön?") together at
 * most STAFF_TIRED_BORED_MAX; a led project's members and anyone acked in the last STAFF_ACK_DAYS are spared those
 * three. Nobody on leave, onboarding or in sales asks for effort.
 */
export function staffAttention(s: GameState): [EmployeeId, StaffAttention][] {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true })
  const out: [EmployeeId, StaffAttention][] = []
  const taken = new Set<EmployeeId>()
  const push = (id: EmployeeId, need: StaffAttention) => {
    taken.add(id)
    out.push([id, need])
  }
  for (const e of [...s.employees].sort(byId)) if (e.status === 'leaving') push(e.id, 'leaving')
  if (effortOn(s)) {
    const day = s.time.day
    const projects = new Map(s.projects.map((p) => [p.id, p]))
    const askers = s.employees.filter((e) => !taken.has(e.id) && e.status !== 'onboarding' && e.dept !== 'sales' && !onLeave(e, day)).sort(byId)
    const fatigue = (e: { fatigue?: number }) => e.fatigue ?? 0
    const quiet = (e: (typeof askers)[number]) =>
      (e.ackDay !== undefined && day < e.ackDay + B.STAFF_ACK_DAYS) || ledMember(e.projectId !== undefined ? projects.get(e.projectId) : undefined, e)
    const burnt = askers.filter((e) => fatigue(e) >= B.FATIGUE_BURNOUT).sort((a, b) => fatigue(b) - fatigue(a))
    for (const e of burnt) push(e.id, 'burnout')
    const tired = askers
      .filter((e) => fatigue(e) >= B.FATIGUE_TIRED && fatigue(e) < B.FATIGUE_BURNOUT && (e.pace ?? 'normal') !== 'calm' && !quiet(e))
      .sort((a, b) => fatigue(b) - fatigue(a))
    const bored = askers
      .filter((e) => !taken.has(e.id) && (e.boredDays ?? 0) >= B.BORED_BUBBLE_DAYS && (e.loadAvg ?? 1) < B.UNDERLOAD && !quiet(e))
      .sort((a, b) => (b.boredDays ?? 0) - (a.boredDays ?? 0))
    const rested = askers
      .filter((e) => !taken.has(e.id) && e.pace === 'calm' && !e.autoCalm && fatigue(e) < B.CALM_BACK_AT && !quiet(e))
      .sort((a, b) => fatigue(a) - fatigue(b))
    const tb: [EmployeeId, StaffAttention][] = [
      ...tired.map((e): [EmployeeId, StaffAttention] => [e.id, 'tired']),
      ...bored.map((e): [EmployeeId, StaffAttention] => [e.id, 'bored']),
      ...rested.map((e): [EmployeeId, StaffAttention] => [e.id, 'calmBack']),
    ]
    for (const [id, need] of tb.slice(0, B.STAFF_TIRED_BORED_MAX)) push(id, need)
  }
  for (const id of [...idleBuilders(s)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) if (!taken.has(id)) push(id, 'idle')
  return out
}

/** Where the round's numbers are heading if the player waits (playtest LD4): read-only, nothing stored. */
export interface RoundOutlook {
  /** Growth has earned the stage's whole multiple ceiling (penalties aside): more growth no longer lifts it. */
  atCap: boolean
  multiple: number
  cap: number
  /** Valuation in ~30 days at today's multiple, MRR grown by the 3-month average MoM. */
  in30: number
  trend: 'up' | 'flat' | 'down'
  /** The pre-round offer factor at `in30` with today's due diligence. */
  factorIn30: number
}

/** Below this 30-day valuation gain the wait reads as flat (UI telegraph only, not a balance number). */
const OUTLOOK_FLAT = 0.05

export function roundOutlook(s: GameState): RoundOutlook | null {
  const target = B.STAGE_TARGET_VALUATION[s.stage + 1]
  if (!target) return null
  const d = s.derived
  const multiple = d.valuationMultiple
  const cap = d.multipleCap ?? multiple
  const momAvg = d.momAvg ?? d.momGrowth
  // Pre-revenue (users × rate drives the price) the MRR outlook and the multiple say nothing: no outlook.
  if (d.valuationParts?.mode === 'pre') return null
  const pre = valuationPreRevenue(s.stats.users, s.projects.filter((p) => p.launched).length, Math.min(B.VAL_RELEASE_MAX, s.releaseCount ?? 0))
  const now = s.finance.valuation
  const in30 = s.finance.mrr > 0 ? valuation(s.finance.mrr * (1 + momAvg), multiple, pre, s.stage) : now
  const gain = now > 0 ? in30 / now - 1 : 0
  return {
    // Growth has earned the whole ceiling (burn / idle-cash / board penalties do not hide it: more growth adds nothing).
    atCap: growthScore(momAvg, s.stage, modifierMult(s, 'diligenceMom')) >= 0.99,
    multiple,
    cap,
    in30,
    trend: gain >= OUTLOOK_FLAT ? 'up' : gain <= -OUTLOOK_FLAT ? 'down' : 'flat',
    factorIn30: offerFactor(priceRatio(in30, target), diligenceNow(s), 0),
  }
}

/**
 * Costs owed right now: the month's ledger, a month waiting on the payday desk and what the desk deferred
 * (GAMEPLAY V2 §6.1). Runway and the cash projection count all of it: runway does not lie about deferrals.
 */
export function owedTotal(s: Pick<GameState, 'finance'>): number {
  const l = s.finance.ledger
  const p = s.finance.pendingPayday
  return (l ? ledgerCosts(l) : 0) + (p ? ledgerCosts(p.ledger) : 0) + (s.finance.deferred ?? 0)
}

/** Cash left after everything owed: the one "Kasa" the HUD chip and the end conditions share. */
export function freeCash(s: Pick<GameState, 'stats' | 'finance'>): number {
  return s.stats.cash - owedTotal(s)
}

/**
 * Wages deferred-pay holds back until the next round close (GAMEPLAY V2 §7.2). Not due on payday (so neither the
 * payday lump nor the bankruptcy clock counts them), but spoken for: runway and the cash projection subtract them.
 */
export function heldWages(s: GameState): number {
  return s.policies?.owed ?? 0
}

/** Days until the next payday (1..30) from `day`. */
export function daysToPayday(day: number): number {
  const next = (Math.floor(day / B.PAYDAY_EVERY_DAYS) + 1) * B.PAYDAY_EVERY_DAYS
  return next - day
}

/** The crisis that has not hit yet: its date, and its id once revealed (GAMEPLAY V2 §5.1). */
export function nextCrisis(s: GameState): NextCrisis | undefined {
  const e = (s.calendar ?? []).find((c) => !c.fired)
  if (!e) return undefined
  return e.id === null ? { day: e.day, hidden: true } : { day: e.day, id: e.id, hidden: false }
}

/**
 * The next HORIZON_DAYS: paydays with their projected lump, delayed decision effects (with the source card),
 * release ETAs at today's build speed, the round close and a ready round, the payday desk's last day, a saturated market. Sorted by day. The next crisis looks
 * further (CRISIS_HORIZON_DAYS): "?" until its reveal, then its id. Known exams (GAMEPLAY V2 §8.3–8.4) show however far:
 * the board's quarter end with its target MRR, and every contract up for renewal on its last day.
 */
export function horizon(s: GameState): HorizonItem[] {
  const now = s.time.day
  const end = now + B.HORIZON_DAYS
  const out: HorizonItem[] = []
  const burn = s.finance.burn
  const owed = owedTotal(s)
  let pay = now + daysToPayday(now)
  let first = true
  while (pay <= end + 1e-9) {
    const amount = first ? owed + (burn * (pay - now)) / B.PAYDAY_EVERY_DAYS : burn
    out.push({ kind: 'payday', day: pay, amount })
    first = false
    pay += B.PAYDAY_EVERY_DAYS
  }
  for (const p of s.decisions.pending) {
    if (p.applyDay > end) continue
    out.push({
      kind: 'delayed',
      day: p.applyDay,
      ...(p.sourceCardId !== undefined ? { cardId: p.sourceCardId } : {}),
      ...(p.sourceOption !== undefined ? { optionIndex: p.sourceOption } : {}),
      ...(p.noteKey !== undefined ? { noteKey: p.noteKey } : {}),
    })
  }
  const rates = s.derived.maturityPerDay ?? {}
  for (const p of s.projects) {
    const rate = rates[p.id] ?? 0
    if (rate <= 0) continue
    if (p.maturity >= 1) {
      // A module build holds the updates (W2a).
      if (p.build) continue
      // The next update: its work left at today's speed, but not before the update cool-down ends.
      const eta = Math.max(now + Math.max(0, updateSize(p, now) - (p.updateProgress ?? 0)) / rate, lastUpdateDay(s, p.id) + B.RELEASE_UPDATE_MIN_DAYS * (s.derived.policies?.mult.releaseGap ?? 1))
      // MV2c: the update names its version ("v2.1"), and the one that fills the line is the next version ("v3").
      const v = projectVersion(p)
      const left = Math.max(1, versionUpdates(v) - (p.lineUpdates ?? 0))
      const per = Math.max(updateSize(p, now) / rate, B.RELEASE_UPDATE_MIN_DAYS * (s.derived.policies?.mult.releaseGap ?? 1))
      const base = { kind: 'release' as const, projectId: p.id, level: B.RELEASE_THRESHOLDS.length }
      if (eta <= end) out.push({ ...base, day: eta, update: (p.updates ?? 0) + 1, ...(left === 1 ? { version: v + 1 } : { version: v, minor: (p.lineUpdates ?? 0) + 1 }) })
      const versionEta = eta + (left - 1) * per
      if (left > 1 && versionEta <= end) out.push({ ...base, day: versionEta, update: (p.updates ?? 0) + left, version: v + 1 })
      continue
    }
    const lvl = B.RELEASE_THRESHOLDS.findIndex((t) => p.maturity < t - 1e-9)
    if (lvl < 0) continue
    const eta = now + (B.RELEASE_THRESHOLDS[lvl]! - p.maturity) / rate
    if (eta <= end) out.push({ kind: 'release', day: eta, projectId: p.id, level: lvl + 1 })
  }
  const r = s.round
  if (r?.active) {
    out.push({ kind: 'roundClose', day: roundCloseDay(s) })
  } else if (s.derived.canStartRound) {
    out.push({ kind: 'roundReady', day: now })
  }
  // §6.1: the desk's countdown (the UI shows it only while the desk is closed).
  const desk = s.finance.pendingPayday
  if (desk) out.push({ kind: 'payday', due: true, day: desk.day + B.PAYDAY_DECIDE_DAYS, amount: Math.max(0, owedTotal(s) - s.stats.cash) })
  // GAMEPLAY V2 §8.1: a market ≥ 70% full is a storm already here (ads go to waste): today, until a segment opens.
  if ((s.derived.penetration ?? 0) >= B.MARKET_SATURATION_PEN) out.push({ kind: 'saturation', day: now })
  const board = s.derived.board
  if (board) out.push({ kind: 'board', day: board.endDay, amount: board.targetMrr })
  for (const r of s.derived.renewals ?? []) out.push({ kind: 'renewal', day: r.untilDay, amount: r.mrr, contractId: r.id, contractName: r.name })
  const crisis = nextCrisis(s)
  if (crisis && crisis.day <= now + B.CRISIS_HORIZON_DAYS) {
    out.push({ kind: 'crisis', day: crisis.day, hidden: crisis.hidden, ...(crisis.id !== undefined ? { crisisId: crisis.id } : {}) })
  }
  return out.sort((a, b) => a.day - b.day)
}

// ---------------------------------------------------------------------------
// GAMEPLAY V2 (§4.4, §14.2): spend preview, cash projection, company profile. Not stored in derived: the UI calls
// them (useMemo) and draws what they return.
// ---------------------------------------------------------------------------

/** Cash after payday at today's net: `free` is cash − owed, `net` the monthly net, `first` the next payday. */
interface CashCore {
  now: number
  first: number
  free: number
  net: number
}

function cashCore(s: GameState, cashDelta: number, burnDelta: number): CashCore {
  const now = s.time.day
  return {
    now,
    first: now + daysToPayday(now),
    free: s.stats.cash - owedTotal(s) - heldWages(s) + cashDelta,
    net: s.finance.net - burnDelta,
  }
}

/** Cash left right after the payday on `day` (revenue flows in daily, costs leave on payday: same totals). */
const cashAfterPayday = (c: CashCore, day: number): number => c.free + (c.net * (day - c.now)) / B.PAYDAY_EVERY_DAYS

/** First payday whose cash goes below zero; null if none ever does (net ≥ 0 and the next one is paid). */
function deathDayOf(c: CashCore): number | null {
  const a = cashAfterPayday(c, c.first)
  if (a < 0) return c.first
  if (c.net >= 0) return null
  return c.first + B.PAYDAY_EVERY_DAYS * (Math.floor(a / -c.net) + 1)
}

/** Cash an item upgrade takes: the new price less the old piece's refund (upgradeItem pays exactly this). */
export function upgradeCost(cur: { price: number }, next: { price: number }): number {
  return Math.max(0, next.price - cur.price * B.SELL_REFUND)
}

/**
 * What a commit button would do to the money (§4.4): `cashDelta` is paid now (a purchase: negative), `burnDelta` is
 * added to the monthly burn (a hire: its salary). Death day at payday granularity.
 */
export function previewSpend(s: GameState, delta: { cashDelta?: number; burnDelta?: number } = {}): SpendPreview {
  const c = cashCore(s, delta.cashDelta ?? 0, delta.burnDelta ?? 0)
  const deathDay = deathDayOf(c)
  return { runwayNow: s.finance.runway, runwayAfter: runway(c.free, c.net), deathDay, paydayShort: deathDay === c.first }
}

/**
 * A cost line as the month will burn it after the signed policies (GAMEPLAY V2 §7.2): the UI's previews (a ring's
 * rent, a hire's salary) pass the raw amount here, so CostPreview and the payday ledger agree after a signature.
 */
export function policyCost(s: GameState, kind: 'rent' | 'salary', amount: number): number {
  return amount * (s.derived.policies?.mult[kind] ?? 1)
}

/** Cash after each of the next `months` paydays at today's net, and the death day (same core as previewSpend). */
export function cashProjection(s: GameState, months = 12): CashProjection {
  const c = cashCore(s, 0, 0)
  const points: CashProjection['points'] = []
  for (let k = 0; k < months; k++) {
    const day = c.first + k * B.PAYDAY_EVERY_DAYS
    points.push({ day, cash: cashAfterPayday(c, day) })
  }
  return { points, deathDay: deathDayOf(c) }
}

const profileAxis = (v: number): number => (v < 0 ? 0 : v > B.PROFILE_MAX ? B.PROFILE_MAX : v)
const stageValue = (list: readonly number[], stage: number): number => list[Math.min(list.length - 1, stage)] ?? 1

/**
 * Company radar (§14.2), each axis 0–PROFILE_MAX where 1 = what the stage expects: product (average maturity),
 * growth (3-month MoM vs the diligence ask; null before revenue), efficiency (burn multiple vs the diligence ask;
 * null before revenue and before Seed, where it is not asked; not burning = full),
 * team (head count, less the survival policies' mark), morale (vs the diligence floor), cash (runway months; profitable = full).
 */
export function companyProfile(s: GameState): CompanyProfile {
  const st = s.stage
  const rw = s.finance.runway
  return {
    product: s.projects.length ? profileAxis(s.derived.avgMaturity / stageValue(B.PROFILE_PRODUCT_EXPECT, st)) : null,
    growth: s.finance.mrr >= B.PRE_REVENUE_MRR ? profileAxis((s.derived.momAvg ?? s.derived.momGrowth) / stageValue(B.DILIGENCE_MOM, st)) : null,
    efficiency: efficiencyAxis(s),
    // Creeping normality (§7.2): every survival policy signed takes POLICY_SURVIVAL_TEAM off for good.
    team: profileAxis(s.employees.length / stageValue(B.PROFILE_TEAM_EXPECT, st) - (s.policies?.survival ?? 0) * B.POLICY_SURVIVAL_TEAM),
    morale: profileAxis(s.stats.morale / B.DILIGENCE_MORALE),
    cash: rw === null ? B.PROFILE_MAX : profileAxis(rw / B.PROFILE_RUNWAY_MONTHS),
  }
}

/** The stage asks for a burn multiple (DILIGENCE_BM below the cap: Seed on). */
const asksBurn = (stage: number): boolean => stageValue(B.DILIGENCE_BM, stage) < B.BURN_MULTIPLE_MAX

/** Efficiency axis: DILIGENCE_BM / burn multiple (1 = at the ask); null while the stage does not ask for it. */
function efficiencyAxis(s: GameState): number | null {
  if (s.finance.mrr < B.PRE_REVENUE_MRR || !asksBurn(s.stage)) return null
  const bm = s.derived.burnMultiple ?? 0
  return bm <= 0 ? B.PROFILE_MAX : profileAxis(stageValue(B.DILIGENCE_BM, s.stage) / bm)
}

/** The investor's expectation on the same axes (due diligence): the second polygon of the radar. */
export function targetProfile(stage: number): CompanyProfile {
  return {
    product: 1,
    growth: 1,
    efficiency: asksBurn(stage) ? 1 : null,
    team: 1,
    morale: 1,
    cash: profileAxis(B.DILIGENCE_RUNWAY_MONTHS / B.PROFILE_RUNWAY_MONTHS),
  }
}

/** The loan covenant light (GAMEPLAY V2 §6.2): grace, clean, at risk (the next payday counts a breach), breached. */
export type CovenantLight = 'grace' | 'ok' | 'atRisk' | 'breached'
export interface CovenantState {
  light: CovenantLight
  breaches: number
  /** Days left of the grace window (> 0 only while light = grace). */
  graceDays: number
  /** Days to the next payday, where checkCovenant runs. */
  checkDays: number
}

/** The covenant as loop.checkCovenant will judge it on the next payday (runway < covenantRunway; null = profitable). */
export function covenantState(s: GameState): CovenantState | null {
  const loan = s.finance.loan
  if (!loan) return null
  const day = s.time.day
  const graceDays = Math.max(0, loan.covenantFromDay - day)
  const r = s.finance.runway
  const light: CovenantLight =
    graceDays > 0 ? 'grace' : loan.breaches > 0 ? 'breached' : r !== null && r < loan.covenantRunway ? 'atRisk' : 'ok'
  return { light, breaches: loan.breaches, graceDays, checkDays: daysToPayday(day) }
}

/** Months of runway left on `day` at today's net (null = never runs out); 0 once past the death day. */
export function runwayAt(s: GameState, day: number): number | null {
  const death = previewSpend(s).deathDay
  return death === null ? null : Math.max(0, (death - day) / DAYS_PER_MONTH)
}

/** Day the open round closes (its weeks left, less the week already under way); today when none runs. */
function roundCloseDay(s: GameState): number {
  const r = s.round
  if (!r?.active) return s.time.day
  const acc = Number(s.flags['roundWeekAcc'] ?? 0)
  return s.time.day + Math.max(0, r.weeksLeft * DAYS_PER_WEEK - acc)
}

/** Runway when the round ends: the open round's close day, or the latest end of one started today (ROUND_WEEKS_MAX weeks). */
export function roundEndRunway(s: GameState): number | null {
  return runwayAt(s, s.round?.active ? roundCloseDay(s) : s.time.day + B.ROUND_WEEKS_MAX * DAYS_PER_WEEK)
}

/** Ad budget steps (off / half / keep / double) around today's budget, or the stage's paid floor when there is none. */
export const AD_STEP_KEYS = ['off', 'half', 'same', 'double'] as const
export type AdStepKey = (typeof AD_STEP_KEYS)[number]
const AD_STEP_MULT: Record<AdStepKey, number> = { off: 0, half: 0.5, same: 1, double: 2 }

/** The steps as amounts setAdBudget accepts (≤ AD_BUDGET_MAX); a step the cap folds onto the one before it is dropped. */
export function adBudgetSteps(budget: number, stage: number): { key: AdStepKey; amount: number }[] {
  const base = budget > 0 ? budget : (B.CAC_SPEND_FLOOR[stage] ?? 0)
  const out: { key: AdStepKey; amount: number }[] = []
  for (const key of AD_STEP_KEYS) {
    const amount = Math.min(B.AD_BUDGET_MAX, base * AD_STEP_MULT[key])
    if (!out.some((o) => o.amount === amount)) out.push({ key, amount })
  }
  return out
}

/** Price multiplier steps (setPrice): seven even steps over PRICE_MIN..PRICE_MAX, ends included. */
const PRICE_STEP_COUNT = 7
export const PRICE_STEPS: readonly number[] = Array.from({ length: PRICE_STEP_COUNT }, (_, i) =>
  i === PRICE_STEP_COUNT - 1 ? B.PRICE_MAX : Number((B.PRICE_MIN + ((B.PRICE_MAX - B.PRICE_MIN) * i) / (PRICE_STEP_COUNT - 1)).toFixed(2)),
)

/** The price step closest to a multiplier (a save from the slider days may sit between two). */
export function nearestPriceStep(v: number): number {
  let best = PRICE_STEPS[0]!
  for (const p of PRICE_STEPS) if (Math.abs(p - v) < Math.abs(best - v)) best = p
  return best
}

/** The lead rival's notch on the current stage link (§9.4), on the scale of derived.stageProgress. Null before a rival, once it is out (bought/closed) and at the last stage. Kept on the side of the fill its `ahead` (MRR race) says. */
export function rivalNotch(s: GameState): { at: number; ahead: boolean; valuation: number; name: string } | null {
  const lead = s.rivals?.[0]
  const target = B.STAGE_TARGET_VALUATION[s.stage + 1]
  if (!lead || rivalOut(lead) || !target) return null
  const raw = lead.valuation / target
  const own = s.derived.stageProgress
  const ahead = !!lead.ahead
  return { at: ahead ? Math.max(raw, own) : Math.min(raw, own), ahead, valuation: lead.valuation, name: lead.name }
}
