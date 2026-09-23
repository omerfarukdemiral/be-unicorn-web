// Core loop UI helpers (docs/CORE_LOOP.md): fresh engine events, effect summaries, next-step navigation.
// Presentation only: every number comes from the engine (state.derived / finance / releases / outcomes).
import { useEffect, useRef } from 'react'
import type { EffectBundle, GameEvent, GameState, NextStep } from '../engine/types'
import { DECISIONS } from '../content'
import { useGameStore } from '../store/gameStore'
import { t } from './i18n'
import { fixed, money, num, pct, signedMoney } from './format'

/**
 * Calls `onEvents` with engine events newer than the last call. The first sight of a run (mount, new game,
 * loaded save) skips the history, so a reload never replays old moments.
 */
export function useFreshEvents(onEvents: (events: GameEvent[], state: GameState) => void): void {
  const events = useGameStore((s) => s.state.events)
  const generation = useGameStore((s) => s.ui.generation)
  const cursor = useRef<{ generation: number; id: number } | null>(null)
  const cb = useRef(onEvents)
  cb.current = onEvents
  useEffect(() => {
    const maxId = events[events.length - 1]?.id ?? 0
    const c = cursor.current
    if (!c || c.generation !== generation || maxId < c.id) {
      cursor.current = { generation, id: maxId }
      return
    }
    const fresh = events.filter((e) => e.id > c.id)
    c.id = maxId
    if (fresh.length) cb.current(fresh, useGameStore.getState().state)
  }, [events, generation])
}

const signed = (v: number, f: (x: number) => string = num): string => (v > 0 ? `+${f(v)}` : v < 0 ? `−${f(-v)}` : f(0))

/** "+$1.5K, +50 kullanıcı, moral +5": the visible parts of an effect bundle. */
export function effectSummary(fx: EffectBundle): string {
  const parts: string[] = []
  if (fx.cash) parts.push(signedMoney(fx.cash).replace('-', '−'))
  if (fx.cashPercent) parts.push(t('fx.cashPercent', { v: signed(fx.cashPercent, (x) => pct(x)) }))
  if (fx.users) parts.push(t('fx.users', { v: signed(fx.users) }))
  if (fx.usersPercent) parts.push(t('fx.users', { v: signed(fx.usersPercent, (x) => pct(x)) }))
  if (fx.morale) parts.push(t('fx.morale', { v: signed(fx.morale, (x) => fixed(x, 0)) }))
  if (fx.reputation) parts.push(t('fx.reputation', { v: signed(fx.reputation, (x) => fixed(x, 0)) }))
  if (fx.maturity) parts.push(t('fx.maturity', { v: signed(fx.maturity, (x) => pct(x)) }))
  if (fx.techDebt) parts.push(t('fx.techDebt', { v: signed(fx.techDebt, (x) => fixed(x, 0)) }))
  if (fx.energy) parts.push(t('fx.energy', { v: signed(fx.energy, (x) => fixed(x, 0)) }))
  if (fx.equity) parts.push(t('fx.equity', { v: signed(fx.equity, (x) => pct(x, 1)) }))
  if (fx.roundWeeks) parts.push(t('fx.roundWeeks', { v: signed(fx.roundWeeks) }))
  if (fx.modifiers?.length) parts.push(t('fx.modifier'))
  return parts.length ? parts.join(', ') : t('fx.other')
}

/** Short label of a card option ("Yan iş al"), for "Kararın → sonucu" lines. */
export function optionLabel(cardId: string | undefined, optionIndex: number | undefined): string | null {
  if (cardId === undefined) return null
  const card = DECISIONS.find((c) => c.id === cardId)
  const opt = card?.options[optionIndex ?? 0]
  return opt?.label ?? null
}

export function releaseLevelName(level: number): string {
  return t(`release.level.${Math.max(1, Math.min(5, Math.round(level)))}`)
}

/** Chip text for a step (money / % filled from the engine's progress + target). */
export function stepText(step: NextStep, s: Pick<GameState, 'stats' | 'finance'>): string {
  switch (step.id) {
    case 'launch':
      return t('step.launch', { v: pct(step.progress ?? 0) })
    case 'users':
      return t('step.users', { v: num(s.stats.users), t: num(step.target ?? 0) })
    case 'revenue':
      return t('step.revenue', { v: money(s.finance.mrr), t: money(step.target ?? 0) })
    case 'grow':
      return t('step.grow', { v: money(s.finance.valuation), t: money(step.target ?? 0) })
    default:
      return t(`step.${step.id}`)
  }
}

export type StepGo = 'projects' | 'shop' | 'team' | 'growth' | 'act'

export function stepGo(step: NextStep): StepGo {
  switch (step.id) {
    case 'idea':
    case 'launch':
      return 'projects'
    case 'desk':
      return 'shop'
    case 'hire':
      return 'team'
    case 'findUsers':
    case 'users':
      return 'act'
    default:
      return 'growth'
  }
}

/** Chip click: opens the panel of the step (the targeted shop highlights the empty desk slot in the scene). */
export function followStep(step: NextStep): void {
  const { openPanel, dispatch, state } = useGameStore.getState()
  switch (stepGo(step)) {
    case 'projects':
      return openPanel({ kind: 'projects' }, { root: true })
    case 'shop':
      return openPanel(step.slotId ? { kind: 'shop', slotTarget: step.slotId } : { kind: 'shop' }, { root: true })
    case 'team':
      return openPanel({ kind: 'team' }, { root: true })
    case 'act': {
      // "Elle kullanıcı bul" right away when the founder is free; otherwise show the growth numbers.
      const free = !state.founder.currentAction
      if (free && dispatch({ type: 'founderAction', kind: 'findUsers' }).ok) return
      return openPanel({ kind: 'growth' }, { root: true })
    }
    case 'growth':
      return openPanel(step.id === 'round' || step.id === 'roundWait' ? { kind: 'growth', section: 'round' } : { kind: 'growth' }, { root: true })
  }
}
