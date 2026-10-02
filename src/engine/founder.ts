// Active founder actions (PLAN §4.4) and founder energy.
import { ENTERPRISE_NAMES } from '../content/index'
import * as B from './balance'
import { clamp } from './economy'
import type { Rng } from './rng'
import { DAYS_PER_WEEK, type ActionErrorCode, type FindUsersPreview, type FounderActionKind, type FounderMoves, type GameState, type MovesView, type SalesCallPreview } from './types'
import { incCounter, newId, pushActivity, pushEvent } from './util'

/** Flag: "Elle kullanıcı bul" uses this month (reset on month end). */
export const FIND_USES_FLAG = 'findUsesThisMonth'

/**
 * Return of the next "Elle kullanıcı bul" (docs/CORE_LOOP.md §5): the month's first FIND_USERS_FULL_PER_MONTH
 * finds are full, every further block halves; a company past FIND_USERS_BIG_AT users gets half.
 * Pure: the button preview and the action use the same numbers.
 */
export function findUsersPreview(s: GameState): FindUsersPreview {
  const used = Number(s.flags[FIND_USES_FLAG] ?? 0)
  const blocks = Math.floor(used / B.FIND_USERS_FULL_PER_MONTH)
  const reasons: FindUsersPreview['reasons'] = []
  let factor = B.FIND_USERS_SATURATION ** blocks
  if (blocks > 0) reasons.push('circle')
  if (s.stats.users > B.FIND_USERS_BIG_AT) {
    factor *= B.FIND_USERS_BIG_FACTOR
    reasons.push('big')
  }
  return {
    min: Math.max(1, Math.round(B.FIND_USERS_MIN * factor)),
    max: Math.max(1, Math.round(B.FIND_USERS_MAX * factor)),
    fullLeft: Math.max(0, B.FIND_USERS_FULL_PER_MONTH - used),
    factor,
    reasons,
  }
}

/** Flag: "Satış görüşmesi" deals closed this month (reset on month end). */
export const SALES_CALLS_FLAG = 'salesCallsThisMonth'

/**
 * Return of the next "Satış görüşmesi" (review fix: 200+ calls per run, customers never left): the month's first
 * SALES_CALL_FULL_PER_MONTH deals are full size, each further deal halves again; every contract runs
 * SALES_CONTRACT_DAYS and then leaves. Pure: the button preview and the action use the same numbers.
 */
export function salesCallPreview(s: GameState): SalesCallPreview {
  const used = Number(s.flags[SALES_CALLS_FLAG] ?? 0)
  const extra = Math.max(0, used - B.SALES_CALL_FULL_PER_MONTH + 1)
  const factor = used < B.SALES_CALL_FULL_PER_MONTH ? 1 : B.SALES_CALL_SATURATION ** extra
  const per = Math.max(1, s.stats.arpu) * (1 + s.stage * 0.5) * factor
  return {
    min: Math.round(per * B.SALES_CALL_SEATS_MIN),
    max: Math.round(per * B.SALES_CALL_SEATS_MAX),
    factor,
    fullLeft: Math.max(0, B.SALES_CALL_FULL_PER_MONTH - used),
    contractDays: B.SALES_CONTRACT_DAYS,
  }
}

/** Daily: contracts past their end leave (their MRR goes with them). */
export function expireContracts(s: GameState): void {
  const list = s.finance.enterpriseCustomers
  if (!list.some((c) => c.untilDay !== undefined && c.untilDay <= s.time.day)) return
  s.finance.enterpriseCustomers = list.filter((c) => {
    if (c.untilDay === undefined || c.untilDay > s.time.day) return true
    pushActivity(s, 'enterpriseLost', { customer: c.name })
    return false
  })
}

/** Tech debt one "Refactor sprinti" pays back: REFACTOR_DEBT_BASE + one point per engineer, at most the debt there is. */
export function refactorDebtCut(s: GameState): number {
  return Math.min(Math.max(0, s.techDebt), B.REFACTOR_DEBT_BASE + s.employees.filter((e) => e.dept === 'eng').length)
}

// ---------------------------------------------------------------------------
// Weekly move budget (GAMEPLAY V2 §7.1)
// ---------------------------------------------------------------------------

/** Flag: energy ran dry under the move budget (the founder-burnout thread reads it); cleared by a finished rest. */
export const FOUNDER_EXHAUSTED_FLAG = 'founderExhausted'

/** From Pre-seed on the move budget is the founder's one constraint (the garage keeps energy and cooldowns). */
export function onMoveBudget(s: GameState): boolean {
  return s.stage >= B.MOVES_FROM_STAGE
}

/** This week's moves at the current stage (the garage counts as Pre-seed: arriving there mid-week finds a full week). */
export function movesPerWeek(s: GameState): number {
  const table = B.MOVES_PER_WEEK
  return table[Math.max(B.MOVES_FROM_STAGE, s.stage)] ?? table[table.length - 1]!
}

/** The budget, defaulted lazily for older saves (a full week from today). Mutates: engine paths only. */
export function movesOf(s: GameState): FounderMoves {
  return (s.founder.moves ??= { left: movesPerWeek(s), weekStart: Math.floor(s.time.day) })
}

/** Read-only view of the moves left (UI-safe: no lazy write). */
export function movesLeft(s: GameState): number {
  return s.founder.moves?.left ?? movesPerWeek(s)
}

/** 'noMoves' when a verb costing `cost` moves does not fit this week (never in the garage). */
export function movesError(s: GameState, cost: number): ActionErrorCode | null {
  if (!onMoveBudget(s) || cost <= 0) return null
  return movesLeft(s) < cost ? 'noMoves' : null
}

/** Takes `cost` moves off the week (call after movesError passed). */
export function spendMoves(s: GameState, cost: number): void {
  if (!onMoveBudget(s) || cost <= 0) return
  const m = movesOf(s)
  m.left = Math.max(0, m.left - cost)
}

/** Energy an action really costs: its price in the garage, nothing once the move budget runs the founder. */
export function actionEnergy(s: GameState, energy: number): number {
  return onMoveBudget(s) ? 0 : energy
}

/** Daily: a new week refills the budget (and older saves get theirs). */
export function refillMoves(s: GameState, day: number): void {
  if (day % DAYS_PER_WEEK === 0) s.founder.moves = { left: movesPerWeek(s), weekStart: day }
  else movesOf(s)
}

/**
 * Arriving on the budget (Pre-seed): the garage's leftovers do not follow the founder in. Energy, frozen from now on
 * between rests, starts full (else a garage spent to 0 would raise the exhaustion flag on day one) and the garage
 * cooldowns are cleared (the budget ignores them; refactorSprint does not exist yet).
 */
export function enterMoveBudget(s: GameState): void {
  s.founder.energy = B.ENERGY_MAX
  s.founder.lowEnergyDays = 0
  s.founder.cooldowns = {}
  s.founder.moves = { left: movesPerWeek(s), weekStart: Math.floor(s.time.day) }
}

/** derived.moves: left / total / the day it refills; none in the garage. */
export function movesView(s: GameState): MovesView | undefined {
  if (!onMoveBudget(s)) return undefined
  return { left: movesLeft(s), total: movesPerWeek(s), resetDay: (Math.floor(s.time.day / DAYS_PER_WEEK) + 1) * DAYS_PER_WEEK }
}

/** Cooldown after an action: the garage's own, none on the budget (refactorSprint keeps its month-long one). */
function cooldownDays(s: GameState, kind: FounderActionKind): number {
  const def = B.FOUNDER_ACTION_DEFS[kind]
  return onMoveBudget(s) && kind !== 'refactorSprint' ? 0 : def.cooldownDays
}

/** A project the founder can talk to users about: the least mature one (after 1.0 talks feed the next update). */
function talkTarget(s: GameState, targetId?: string) {
  return s.projects.find((x) => x.id === targetId) ?? s.projects.find((x) => x.maturity < 1) ?? s.projects[0]
}

export function founderActionError(s: GameState, kind: FounderActionKind): ActionErrorCode | null {
  const def = B.FOUNDER_ACTION_DEFS[kind]
  if (!def) return 'invalid'
  if (s.stage < def.stage) return 'notUnlocked'
  if (s.founder.currentAction) return 'founderBusy'
  const cd = s.founder.cooldowns[kind]
  // On the move budget a cooldown left over from the garage no longer holds (refactorSprint's month still does).
  if (cd !== undefined && s.time.day < cd && (!onMoveBudget(s) || kind === 'refactorSprint')) return 'cooldown'
  if (s.founder.energy < actionEnergy(s, def.energy)) return 'noEnergy'
  const moves = movesError(s, def.moves)
  if (moves) return moves
  if (kind === 'talkToUsers' && s.projects.length === 0) return 'notFound'
  // No debt to pay back: the sprint would only cost the month.
  if (kind === 'refactorSprint' && s.techDebt < 1) return 'notFound'
  return null
}

export function startFounderAction(s: GameState, kind: FounderActionKind, targetId?: string): ActionErrorCode | null {
  const err = founderActionError(s, kind)
  if (err) return err
  const def = B.FOUNDER_ACTION_DEFS[kind]
  let target = targetId
  if (kind === 'talkToUsers') {
    const p = talkTarget(s, targetId)
    if (!p) return 'notFound'
    target = p.id
  }
  s.founder.energy -= actionEnergy(s, def.energy)
  spendMoves(s, def.moves)
  s.founder.currentAction = { kind, startDay: s.time.day, endDay: s.time.day + def.durationDays, ...(target !== undefined ? { targetId: target } : {}) }
  pushActivity(s, 'founderActionStarted', { action: kind })
  pushEvent(s, { kind: 'founderActionStarted', refId: kind })
  return null
}

/** Called when the running action's endDay has passed. */
export function completeFounderAction(s: GameState, rng: Rng): void {
  const run = s.founder.currentAction
  if (!run) return
  s.founder.currentAction = undefined
  s.founder.cooldowns[run.kind] = s.time.day + cooldownDays(s, run.kind)
  const params: Record<string, string | number> = { action: run.kind }
  switch (run.kind) {
    case 'findUsers': {
      const pv = findUsersPreview(s)
      const n = Math.max(1, Math.round(rng.int(B.FIND_USERS_MIN, B.FIND_USERS_MAX) * pv.factor))
      s.flags[FIND_USES_FLAG] = Number(s.flags[FIND_USES_FLAG] ?? 0) + 1
      s.stats.users += n
      s.flags['manualThisMonth'] = Number(s.flags['manualThisMonth'] ?? 0) + n
      incCounter(s, 'manualFinds')
      params.value = n
      break
    }
    case 'talkToUsers': {
      const p = s.projects.find((x) => x.id === run.targetId)
      if (p && p.maturity < 1) p.maturity = clamp(0, 1, p.maturity + B.TALK_MATURITY)
      else if (p) p.updateProgress = Math.min(B.RELEASE_UPDATE_SIZE, (p.updateProgress ?? 0) + B.TALK_MATURITY)
      incCounter(s, 'userTalks')
      params.project = p?.name ?? ''
      break
    }
    case 'motivateTeam':
      s.modifiers.push({ id: newId(s, 'mod'), kind: 'morale', value: B.MOTIVATE_MORALE, untilDay: s.time.day + B.MOTIVATE_DAYS, source: 'motivateTeam' })
      incCounter(s, 'motivates')
      break
    case 'investorCoffee':
      if (s.round?.active) s.round.weeksLeft = Math.max(1, s.round.weeksLeft - B.COFFEE_ROUND_WEEKS)
      else s.stats.reputation = clamp(0, 100, s.stats.reputation + B.COFFEE_REPUTATION)
      incCounter(s, 'investorCoffees')
      break
    case 'salesCall': {
      const pv = salesCallPreview(s)
      const seats = rng.int(B.SALES_CALL_SEATS_MIN, B.SALES_CALL_SEATS_MAX)
      const mrr = Math.max(1, Math.round(Math.max(1, s.stats.arpu) * seats * (1 + s.stage * 0.5) * pv.factor))
      const id = newId(s, 'ent')
      const won = s.counters.salesCalls ?? 0
      const name = ENTERPRISE_NAMES[won % Math.max(1, ENTERPRISE_NAMES.length)] ?? id
      s.flags[SALES_CALLS_FLAG] = Number(s.flags[SALES_CALLS_FLAG] ?? 0) + 1
      s.finance.enterpriseCustomers.push({ id, name, mrr, sinceDay: s.time.day, untilDay: s.time.day + B.SALES_CONTRACT_DAYS })
      incCounter(s, 'salesCalls')
      pushActivity(s, 'enterpriseWon', { customer: name, value: mrr })
      params.value = mrr
      break
    }
    case 'refactorSprint': {
      // GAMEPLAY V2 §4.2 sink: the team stops shipping features for a month and pays the debt down.
      const cut = refactorDebtCut(s)
      s.techDebt = Math.max(0, s.techDebt - cut)
      s.modifiers.push({ id: newId(s, 'mod'), kind: 'production', value: B.REFACTOR_PRODUCTION, untilDay: s.time.day + B.REFACTOR_DAYS, source: 'refactorSprint' })
      incCounter(s, 'refactors')
      params.value = Math.round(cut)
      break
    }
    case 'rest':
      delete s.flags[FOUNDER_EXHAUSTED_FLAG]
      break
  }
  pushActivity(s, 'founderActionDone', params)
  pushEvent(s, { kind: 'founderActionDone', refId: run.kind, ...(typeof params.value === 'number' ? { value: params.value } : {}) })
}

/** Continuous energy regen; rest regenerates faster. On the move budget only rest refills it (a health gauge). */
export function regenEnergy(s: GameState, dtDays: number): void {
  const idle = onMoveBudget(s) ? 0 : B.ENERGY_REGEN_PER_DAY
  const rate = s.founder.currentAction?.kind === 'rest' ? B.REST_REGEN_PER_DAY : s.founder.currentAction ? 0 : idle
  s.founder.energy = clamp(0, B.ENERGY_MAX, s.founder.energy + rate * dtDays)
}

export function dailyFounder(s: GameState, day: number): void {
  s.founder.lowEnergyDays = s.founder.energy < B.LOW_ENERGY ? s.founder.lowEnergyDays + 1 : 0
  if (onMoveBudget(s) && s.founder.energy <= 0) s.flags[FOUNDER_EXHAUSTED_FLAG] = true
  refillMoves(s, day)
}
