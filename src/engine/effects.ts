// Applies an EffectBundle (cards, actions, furniture) with anti-farm clamps.
import type { Concept } from '../content/index'
import * as B from './balance'
import { clamp } from './economy'
import { HUD_WIDGETS, TOOL_IDS, type ConceptId, type EffectBundle, type GameState, type HudWidget, type ToolId } from './types'
import { incCounter, newId, pushEvent, uniquePush, type EngineContent } from './util'

/** Flags that also bump a counter (content sets them via `setFlag`). */
const FLAG_COUNTERS: Record<string, keyof GameState['counters']> = { crunch: 'crunches' }

export function cappedCashPercent(s: GameState, pct: number): number {
  const p = clamp(-B.CASH_PERCENT_CAP, B.CASH_PERCENT_CAP, pct)
  const base = Math.max(0, s.stats.cash)
  const cap = B.CASH_PERCENT_ABS_CAP[s.stage] ?? Infinity
  return clamp(-cap, cap, base * p)
}

export function unlockWidget(s: GameState, w: HudWidget): void {
  uniquePush(s.unlockedWidgets, w)
}

export function unlockTool(s: GameState, t: ToolId): void {
  uniquePush(s.unlockedTools, t)
}

/** Unlock a concept's `unlocks` value(s) (widget or tool). */
export function unlockAny(s: GameState, id: string | readonly string[] | undefined): void {
  if (id === undefined) return
  if (typeof id !== 'string') {
    for (const x of id) unlockAny(s, x)
    return
  }
  if ((HUD_WIDGETS as readonly string[]).includes(id)) unlockWidget(s, id as HudWidget)
  else if ((TOOL_IDS as readonly string[]).includes(id)) unlockTool(s, id as ToolId)
}

/** Stores the card's "where" line with the numbers of the moment the concept fired. */
export function snapshotWhere(s: GameState, c: Concept): void {
  let text: string
  try {
    text = c.card.where(s)
  } catch {
    return
  }
  s.concepts.where = { ...(s.concepts.where ?? {}), [c.id]: text }
}

/** Triggers a concept out of band (effects, bankruptcy). */
export function queueConcept(s: GameState, content: EngineContent, id: ConceptId): boolean {
  if (s.concepts.triggered.includes(id)) return false
  const c = content.concepts.find((x) => x.id === id)
  if (!c) return false
  snapshotWhere(s, c)
  s.concepts.triggered.push(id)
  s.concepts.queue.push(id)
  pushEvent(s, { kind: 'conceptQueued', refId: id })
  return true
}

export function applyMorale(s: GameState, delta: number): void {
  s.stats.morale = clamp(0, 100, s.stats.morale + delta)
  for (const e of s.employees) e.morale = clamp(0, 100, e.morale + delta)
}

export function applyEffects(s: GameState, content: EngineContent, fx: EffectBundle, source: string): void {
  if (fx.cash !== undefined) s.stats.cash += fx.cash
  if (fx.cashPercent !== undefined) s.stats.cash += cappedCashPercent(s, fx.cashPercent)
  if (fx.users !== undefined) s.stats.users = Math.max(0, s.stats.users + fx.users)
  if (fx.usersPercent !== undefined) s.stats.users = Math.max(0, s.stats.users * (1 + clamp(-B.USERS_PERCENT_CAP, B.USERS_PERCENT_CAP, fx.usersPercent)))
  if (fx.morale !== undefined) applyMorale(s, fx.morale)
  if (fx.reputation !== undefined) {
    s.stats.reputation = clamp(0, 100, s.stats.reputation + fx.reputation)
    // İtibar göstergesi: the first choice that moves reputation makes it visible (PLAN §5.1).
    if (fx.reputation !== 0) unlockWidget(s, 'reputation')
  }
  if (fx.equity !== undefined) s.stats.equity = clamp(0.01, 1, s.stats.equity + fx.equity)
  if (fx.energy !== undefined) s.founder.energy = clamp(0, B.ENERGY_MAX, s.founder.energy + fx.energy)
  if (fx.maturity !== undefined) {
    for (const p of s.projects) if (p.maturity < 1) p.maturity = clamp(0, 1, p.maturity + fx.maturity)
  }
  if (fx.techDebt !== undefined) s.techDebt = Math.max(0, s.techDebt + fx.techDebt)
  for (const m of fx.modifiers ?? []) {
    s.modifiers.push({ id: newId(s, 'mod'), kind: m.kind, value: m.value, untilDay: s.time.day + m.days, source })
  }
  if (fx.roundWeeks !== undefined && s.round?.active) {
    s.round.weeksLeft = Math.max(1, s.round.weeksLeft + fx.roundWeeks)
    s.round.weeksTotal = Math.max(s.round.weeksTotal, s.round.weeksLeft)
  }
  if (fx.unlockTool !== undefined) unlockTool(s, fx.unlockTool)
  if (fx.unlockWidget !== undefined) unlockWidget(s, fx.unlockWidget)
  if (fx.queueConcept !== undefined) queueConcept(s, content, fx.queueConcept)
  if (fx.queueCard !== undefined && content.decisions.some((d) => d.id === fx.queueCard)) s.decisions.queue.push(fx.queueCard)
  for (const flag of fx.setFlag === undefined ? [] : typeof fx.setFlag === 'string' ? [fx.setFlag] : fx.setFlag) {
    s.flags[flag] = true
    const counter = FLAG_COUNTERS[flag]
    if (counter) incCounter(s, counter)
  }
}
