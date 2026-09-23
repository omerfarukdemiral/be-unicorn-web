// Generic decision card engine (PLAN §6.3): pick (stage + condition + seeded RNG + cooldown, max 1 active),
// answer (effects + delayed queue), and fire due delayed effects.
import type { DecisionCard } from '../content/index'
import * as B from './balance'
import { applyEffects } from './effects'
import type { Rng } from './rng'
import type { DecisionCardId, GameState } from './types'
import { newId, pushActivity, pushEvent, type EngineContent } from './util'

function safeCondition(c: DecisionCard, s: GameState): boolean {
  if (!c.condition) return true
  try {
    return c.condition(s) === true
  } catch {
    return false
  }
}

export function isCardEligible(c: DecisionCard, s: GameState): boolean {
  if (c.stage > s.stage) return false
  if (c.maxStage !== undefined && c.maxStage < s.stage) return false
  const once = c.once ?? true
  if (once && (s.decisions.history.some((h) => h.cardId === c.id) || s.decisions.active?.cardId === c.id)) return false
  if (!once) {
    // A crisis card whose condition lingers must not come back every cooldown.
    const past = s.decisions.history.filter((h) => h.cardId === c.id)
    if (past.length >= B.REPEAT_CARD_MAX) return false
    const last = past[past.length - 1]
    if (last && s.time.day - last.day < B.REPEAT_CARD_COOLDOWN_DAYS) return false
  }
  return safeCondition(c, s)
}

export function eligibleCards(s: GameState, cards: readonly DecisionCard[]): DecisionCard[] {
  return cards.filter((c) => isCardEligible(c, s))
}

function showCard(s: GameState, card: DecisionCard): void {
  const vid = newId(s, 'v')
  s.visitors.push({ id: vid, role: card.speaker, purpose: 'decision', targetSlotId: 'founder', arriveDay: s.time.day, leaveDay: s.time.day + B.DECISION_VISITOR_WAIT_DAYS, refId: card.id })
  s.decisions.active = { cardId: card.id, shownDay: s.time.day, visitorId: vid }
  s.decisions.lastCardDay = s.time.day
  pushEvent(s, { kind: 'visitorArrived', refId: vid })
  pushEvent(s, { kind: 'decisionShown', refId: card.id })
}

/** Daily: show a queued card, or roll for a new one after the cooldown. */
export function maybeShowDecision(s: GameState, content: EngineContent, rng: Rng): void {
  if (s.decisions.active || s.gameOver) return
  while (s.decisions.queue.length) {
    const id = s.decisions.queue.shift()!
    const card = content.decisions.find((c) => c.id === id)
    if (card && (card.once === false || !s.decisions.history.some((h) => h.cardId === id))) {
      showCard(s, card)
      return
    }
  }
  if (s.time.day < B.FIRST_CARD_DAY) return
  if (s.decisions.history.length > 0 && s.time.day - s.decisions.lastCardDay < B.CARD_COOLDOWN_DAYS) return
  if (!rng.chance(B.CARD_DAILY_CHANCE)) return
  const pick = rng.weighted(eligibleCards(s, content.decisions), (c) => c.weight ?? 1)
  if (pick) showCard(s, pick)
}

export type AnswerError = 'notFound' | 'invalid'

export function answerDecision(s: GameState, content: EngineContent, cardId: DecisionCardId, optionIndex: number): AnswerError | null {
  if (s.decisions.active?.cardId !== cardId) return 'notFound'
  const card = content.decisions.find((c) => c.id === cardId)
  if (!card) return 'notFound'
  const opt = card.options[optionIndex]
  if (!opt || !Number.isInteger(optionIndex)) return 'invalid'
  applyEffects(s, content, opt.effects, cardId)
  if (opt.delayed) {
    s.decisions.pending.push({
      id: newId(s, 'd'),
      applyDay: s.time.day + opt.delayed.days,
      effects: opt.delayed.effects,
      sourceCardId: cardId,
      sourceOption: optionIndex,
      ...(opt.delayed.note !== undefined ? { noteKey: opt.delayed.note } : {}),
    })
  }
  const entry = { cardId, optionIndex, day: s.time.day }
  s.decisions.history.push(entry)
  s.decisions.lastAnswer = entry
  const vid = s.decisions.active.visitorId
  for (const v of s.visitors) if (v.id === vid) v.leaveDay = Math.min(v.leaveDay, s.time.day)
  s.decisions.active = undefined
  pushEvent(s, { kind: 'decisionAnswered', refId: cardId, value: optionIndex })
  return null
}

/** Daily: apply delayed effects whose day has come. */
export function applyDueEffects(s: GameState, content: EngineContent): void {
  const due = s.decisions.pending.filter((p) => p.applyDay <= s.time.day)
  if (!due.length) return
  s.decisions.pending = s.decisions.pending.filter((p) => p.applyDay > s.time.day)
  for (const p of due) {
    applyEffects(s, content, p.effects, p.sourceCardId ?? p.id)
    pushActivity(s, 'delayedEffect', { note: p.noteKey ?? '', card: p.sourceCardId ?? '' })
    if (p.sourceCardId === undefined) continue
    // "Kararın → sonucu": which card and option this came from, and what it did (docs/CORE_LOOP.md §6).
    const answer = [...s.decisions.history].reverse().find((h) => h.cardId === p.sourceCardId && h.day <= p.applyDay)
    const optionIndex = p.sourceOption ?? answer?.optionIndex ?? 0
    const list = (s.decisions.outcomes ??= [])
    list.push({
      cardId: p.sourceCardId,
      optionIndex,
      answeredDay: answer?.day ?? p.applyDay,
      day: s.time.day,
      effects: p.effects,
      ...(p.noteKey !== undefined ? { noteKey: p.noteKey } : {}),
    })
    if (list.length > B.OUTCOMES_MAX) list.splice(0, list.length - B.OUTCOMES_MAX)
    pushEvent(s, { kind: 'delayedEffect', refId: p.sourceCardId, value: optionIndex })
  }
}
