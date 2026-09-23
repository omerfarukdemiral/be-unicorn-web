// Fundraising rounds (PLAN §5.9): 4–8 weeks, shrink on falling metrics, close → cash, dilution, move.
import * as B from './balance'
import { clamp } from './economy'
import { applyMorale, unlockTool } from './effects'
import { relocateOffice } from './office'
import type { Rng } from './rng'
import type { ActionErrorCode, GameState, StageIndex } from './types'
import { incCounter, newId, pushActivity, pushEvent, type EngineContent } from './util'

const WEEK_ACC = 'roundWeekAcc'

export function startRound(s: GameState, rng: Rng): ActionErrorCode | null {
  if (s.round?.active) return 'roundActive'
  if (!s.derived.canStartRound) return 'roundNotReady'
  const target = (s.stage + 1) as StageIndex
  const amount = B.ROUND_AMOUNT[target]
  const equity = B.ROUND_EQUITY[target]
  if (amount == null || equity == null) return 'roundNotReady'
  const weeks = rng.int(B.ROUND_WEEKS_MIN, B.ROUND_WEEKS_MAX)
  s.round = {
    active: true,
    targetStage: target,
    startedDay: s.time.day,
    weeksTotal: weeks,
    weeksLeft: weeks,
    offer: { amount, equity, preMoney: amount / equity - amount },
    baseValuation: s.finance.valuation,
  }
  s.flags[WEEK_ACC] = 0
  s.flags['roundStartedOnce'] = true
  const vid = newId(s, 'v')
  const room = s.office.slots.find((x) => x.type === 'room' && x.itemId !== undefined && x.spanOf === undefined)
  s.visitors.push({ id: vid, role: 'investor', purpose: 'round', targetSlotId: room?.id ?? 'founder', arriveDay: s.time.day, leaveDay: s.time.day + weeks * 7, refId: `round-${target}` })
  pushActivity(s, 'roundStarted', { stage: target, weeks })
  pushEvent(s, { kind: 'roundStarted', value: target })
  pushEvent(s, { kind: 'visitorArrived', refId: vid })
  return null
}

/** Continuous: advance round weeks (roundSpeed modifiers make weeks pass faster). */
export function progressRound(s: GameState, content: EngineContent, dtDays: number, roundSpeed: number): void {
  const r = s.round
  if (!r?.active) return
  let acc = Number(s.flags[WEEK_ACC] ?? 0) + dtDays * roundSpeed
  while (acc >= 7 && r.weeksLeft > 0) {
    acc -= 7
    r.weeksLeft -= 1
    if (s.finance.valuation < r.baseValuation * B.ROUND_SHRINK_THRESHOLD) {
      const floor = (B.ROUND_AMOUNT[r.targetStage] ?? r.offer.amount) * B.ROUND_MIN_OFFER
      const next = Math.max(floor, r.offer.amount * B.ROUND_SHRINK_FACTOR)
      if (next < r.offer.amount) {
        r.offer.amount = next
        r.offer.preMoney = next / r.offer.equity - next
        pushActivity(s, 'roundShrunk', { amount: Math.round(next) })
      }
    }
    if (r.weeksLeft > 0) pushActivity(s, 'roundProgress', { done: r.weeksTotal - r.weeksLeft, total: r.weeksTotal })
  }
  s.flags[WEEK_ACC] = acc
  if (r.weeksLeft <= 0) closeRound(s, content)
}

/** Stage arrival side effects (office move, tools). */
export function enterStage(s: GameState, stage: StageIndex): void {
  s.stage = stage
  s.office = relocateOffice(s.office, stage)
  for (const t of B.STAGE_UNLOCK_TOOLS[stage] ?? []) unlockTool(s, t)
  pushActivity(s, 'stageUp', { stage })
  pushEvent(s, { kind: 'stageUp', value: stage })
}

export function closeRound(s: GameState, _content: EngineContent): void {
  const r = s.round
  if (!r?.active) return
  r.active = false
  const repay = Math.min(s.finance.debt, r.offer.amount)
  s.finance.debt -= repay
  s.stats.cash += r.offer.amount - repay
  s.stats.equity = clamp(0.01, 1, s.stats.equity * (1 - r.offer.equity))
  applyMorale(s, B.ROUND_CLOSE_MORALE)
  s.stats.reputation = clamp(0, 100, s.stats.reputation + B.ROUND_CLOSE_REPUTATION)
  incCounter(s, 'roundsClosed')
  for (const v of s.visitors) if (v.purpose === 'round') v.leaveDay = Math.min(v.leaveDay, s.time.day)
  pushActivity(s, 'roundClosed', { amount: Math.round(r.offer.amount), equity: r.offer.equity })
  pushEvent(s, { kind: 'roundClosed', value: r.offer.amount })
  enterStage(s, r.targetStage)
  s.round = undefined
}
