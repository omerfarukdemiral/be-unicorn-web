// One decision at a time (2026-10-21 clarity & pace): "aynı anda birden fazla şey oluyor ve çoğunu kaçırıyorum".
// At most one thing waits on the player at any moment: a decision card (crisis, offer, rescue…), a round meeting, a
// resignation notice or the payday desk. Everything else queues; the next one comes DECISION_GAP_DAYS after the last
// one closed. Paydays are no decision, but no new one opens on a payday (its receipt has the screen).
import * as B from './balance'
import { DAYS_PER_MONTH, type GameState } from './types'

/** What waits on the player now. */
export type OpenDecision = 'card' | 'meeting' | 'payday' | 'leaver'

export function openDecision(s: GameState): OpenDecision | null {
  if (s.decisions.active) return 'card'
  if (s.finance.pendingPayday) return 'payday'
  if (s.round?.active && s.round.pitchDue !== undefined) return 'meeting'
  if (s.employees.some((e) => e.status === 'leaving')) return 'leaver'
  return null
}

/** The payday receipt's days (payday and the day after; the first payday is day 30): no new decision then. */
function paydayHolds(day: number): boolean {
  if (day < DAYS_PER_MONTH) return false
  const d = Math.floor(day) % DAYS_PER_MONTH
  return d === 0 || d === 1
}

/**
 * Daily, first thing: notes the day the last open decision closed (decisions.closedDay). A close inside a day is seen
 * on the next daily: the gap counts from there (at most a day late).
 */
export function trackDecisionSlot(s: GameState): void {
  const open = openDecision(s)
  if (open) s.decisions.openKind = open
  else if (s.decisions.openKind !== undefined) {
    delete s.decisions.openKind
    s.decisions.closedDay = s.time.day
  }
}

/** Nothing open, DECISION_GAP_DAYS since the last one closed, and not a payday: a new decision may open. */
export function decisionSlotFree(s: GameState): boolean {
  if (openDecision(s)) return false
  if (paydayHolds(s.time.day)) return false
  const closed = s.decisions.closedDay
  return closed === undefined || s.time.day - closed >= B.DECISION_GAP_DAYS
}
