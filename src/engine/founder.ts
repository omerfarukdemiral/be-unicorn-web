// Active founder actions (PLAN §4.4) and founder energy.
import { ENTERPRISE_NAMES } from '../content/index'
import * as B from './balance'
import { clamp } from './economy'
import type { Rng } from './rng'
import type { ActionErrorCode, FounderActionKind, GameState } from './types'
import { incCounter, newId, pushActivity, pushEvent } from './util'

export function founderActionError(s: GameState, kind: FounderActionKind): ActionErrorCode | null {
  const def = B.FOUNDER_ACTION_DEFS[kind]
  if (!def) return 'invalid'
  if (s.stage < def.stage) return 'notUnlocked'
  if (s.founder.currentAction) return 'founderBusy'
  const cd = s.founder.cooldowns[kind]
  if (cd !== undefined && s.time.day < cd) return 'cooldown'
  if (s.founder.energy < def.energy) return 'noEnergy'
  if (kind === 'talkToUsers' && !s.projects.some((p) => p.maturity < 1)) return 'notFound'
  return null
}

export function startFounderAction(s: GameState, kind: FounderActionKind, targetId?: string): ActionErrorCode | null {
  const err = founderActionError(s, kind)
  if (err) return err
  const def = B.FOUNDER_ACTION_DEFS[kind]
  let target = targetId
  if (kind === 'talkToUsers') {
    const p = s.projects.find((x) => x.id === targetId && x.maturity < 1) ?? s.projects.find((x) => x.maturity < 1)
    if (!p) return 'notFound'
    target = p.id
  }
  s.founder.energy -= def.energy
  s.founder.currentAction = { kind, startDay: s.time.day, endDay: s.time.day + def.durationDays, ...(target !== undefined ? { targetId: target } : {}) }
  pushActivity(s, 'founderActionStarted', { action: kind })
  pushEvent(s, { kind: 'founderActionStarted', refId: kind })
  return null
}

/** Called when the running action's endDay has passed. */
export function completeFounderAction(s: GameState, rng: Rng): void {
  const run = s.founder.currentAction
  if (!run) return
  const def = B.FOUNDER_ACTION_DEFS[run.kind]
  s.founder.currentAction = undefined
  s.founder.cooldowns[run.kind] = s.time.day + def.cooldownDays
  const params: Record<string, string | number> = { action: run.kind }
  switch (run.kind) {
    case 'findUsers': {
      const n = rng.int(B.FIND_USERS_MIN, B.FIND_USERS_MAX)
      s.stats.users += n
      s.flags['manualThisMonth'] = Number(s.flags['manualThisMonth'] ?? 0) + n
      incCounter(s, 'manualFinds')
      params.value = n
      break
    }
    case 'talkToUsers': {
      const p = s.projects.find((x) => x.id === run.targetId)
      if (p) p.maturity = clamp(0, 1, p.maturity + B.TALK_MATURITY)
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
      const seats = rng.int(B.SALES_CALL_SEATS_MIN, B.SALES_CALL_SEATS_MAX)
      const mrr = Math.round(Math.max(1, s.stats.arpu) * seats * (1 + s.stage * 0.5))
      const id = newId(s, 'ent')
      const won = s.counters.salesCalls ?? 0
      const name = ENTERPRISE_NAMES[won % Math.max(1, ENTERPRISE_NAMES.length)] ?? id
      s.finance.enterpriseCustomers.push({ id, name, mrr, sinceDay: s.time.day })
      incCounter(s, 'salesCalls')
      pushActivity(s, 'enterpriseWon', { customer: name, value: mrr })
      params.value = mrr
      break
    }
    case 'rest':
      break
  }
  pushActivity(s, 'founderActionDone', params)
  pushEvent(s, { kind: 'founderActionDone', refId: run.kind, ...(typeof params.value === 'number' ? { value: params.value } : {}) })
}

/** Continuous energy regen; rest regenerates faster. */
export function regenEnergy(s: GameState, dtDays: number): void {
  const rate = s.founder.currentAction?.kind === 'rest' ? B.REST_REGEN_PER_DAY : s.founder.currentAction ? 0 : B.ENERGY_REGEN_PER_DAY
  s.founder.energy = clamp(0, B.ENERGY_MAX, s.founder.energy + rate * dtDays)
}

export function dailyFounder(s: GameState): void {
  s.founder.lowEnergyDays = s.founder.energy < B.LOW_ENERGY ? s.founder.lowEnergyDays + 1 : 0
}
