// Generic decision card engine (PLAN §6.3): pick (stage + condition + seeded RNG + cooldown, max 1 active),
// answer (effects + delayed queue), and fire due delayed effects. Also the crisis calendar (GAMEPLAY V2 §5.1), whose
// cards share the same card budget.
import type { CrisisDef, DecisionCard } from '../content/index'
import * as B from './balance'
import { clamp } from './economy'
import { applyEffects } from './effects'
import type { Rng } from './rng'
import type { CalendarEntry, DecisionCardId, GameState } from './types'
import { newId, pushActivity, pushEvent, type EngineContent } from './util'

function safeCondition(c: DecisionCard, s: GameState): boolean {
  if (!c.condition) return true
  try {
    return c.condition(s) === true
  } catch {
    return false
  }
}

/** `ignoreCooldown`: a newly missed payday brings the rescue card even inside its repeat cooldown (max still holds). */
export function isCardEligible(c: DecisionCard, s: GameState, opts: { ignoreCooldown?: boolean } = {}): boolean {
  if (c.stage > s.stage) return false
  if (c.maxStage !== undefined && c.maxStage < s.stage) return false
  const once = c.once ?? true
  if (once && (s.decisions.history.some((h) => h.cardId === c.id) || s.decisions.active?.cardId === c.id)) return false
  if (!once) {
    // A crisis card whose condition lingers must not come back every cooldown.
    const past = s.decisions.history.filter((h) => h.cardId === c.id)
    if (past.length >= B.REPEAT_CARD_MAX) return false
    const last = past[past.length - 1]
    if (!opts.ignoreCooldown && last && s.time.day - last.day < B.REPEAT_CARD_COOLDOWN_DAYS) return false
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
  if (crisisHoldsSlot(s, content)) return
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
      // Delayed effects land within the 6-week horizon (docs/CORE_LOOP.md §5 "Karar sıklığı").
      applyDay: s.time.day + Math.min(B.DECISION_DELAY_MAX_DAYS, opt.delayed.days),
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

/** The option an unanswered card falls back to (written on the card: "Cevapsız kalırsa: …"). */
export function defaultOptionOf(card: DecisionCard): number {
  const d = card.defaultOption
  return d !== undefined && Number.isInteger(d) && d >= 0 && d < card.options.length ? d : card.options.length - 1
}

/** Days an unanswered card waits before its default applies (the card's own, else DECISION_DEFAULT_AFTER_DAYS). */
export function defaultAfterDaysOf(card: DecisionCard | undefined): number {
  const d = card?.defaultAfterDays
  return d !== undefined && d > 0 ? d : B.DECISION_DEFAULT_AFTER_DAYS
}

/**
 * Daily: a card left unanswered for its default days applies its default option, so it never locks the other cards
 * forever (docs/CORE_LOOP.md §3.2 "Zamanlı kart yok": no timer is shown, the default is written up front).
 * Crisis cards wait less: the rescue card's default lands well before the 60-day bankruptcy clock.
 */
export function applyDefaultDecision(s: GameState, content: EngineContent): void {
  const a = s.decisions.active
  if (!a) return
  const card = content.decisions.find((c) => c.id === a.cardId)
  if (!card) {
    s.decisions.active = undefined
    return
  }
  if (s.time.day - a.shownDay < defaultAfterDaysOf(card)) return
  const i = defaultOptionOf(card)
  if (answerDecision(s, content, card.id, i) !== null) return
  pushActivity(s, 'decisionDefaulted', { option: card.options[i]?.label ?? '' })
  pushEvent(s, { kind: 'decisionDefaulted', refId: card.id, value: i })
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

/**
 * A crisis card that must come now (the rescue on a missed payday) takes the stage: an unanswered active card steps
 * back into the queue right behind it (its visitor leaves and comes back later), so it never blocks the way out.
 */
export function bringCardNow(s: GameState, cardId: DecisionCardId): void {
  const q = s.decisions.queue.filter((id) => id !== cardId)
  const a = s.decisions.active
  if (a && a.cardId !== cardId) {
    for (const v of s.visitors) if (v.id === a.visitorId) v.leaveDay = Math.min(v.leaveDay, s.time.day)
    q.unshift(a.cardId)
    s.decisions.active = undefined
  }
  if (s.decisions.active?.cardId !== cardId) q.unshift(cardId)
  s.decisions.queue = q
}

// ---------------------------------------------------------------------------
// Crisis calendar (GAMEPLAY V2 §5.1): a known storm. The date is tied to time, not to stages (a pending crisis
// survives a stage change); what it is gets drawn on the reveal day from the then-current stage's pool; on the day it
// hits, its effects land and its card comes first. Every rng draw comes from the step's Rng (never a local one).
// ---------------------------------------------------------------------------

/** The calendar; older saves default lazily to []. */
export function calendarOf(s: GameState): CalendarEntry[] {
  return (s.calendar ??= [])
}

/** The crisis that has not hit yet (at most one is ever scheduled). */
export function pendingCrisis(s: GameState): CalendarEntry | undefined {
  return (s.calendar ?? []).find((c) => !c.fired)
}

/** Severity = 0.7 + 0.6 × director pressure. The director lands in C2; until then the default pressure. */
export function crisisSeverity(s: GameState): number {
  const pressure = (s as GameState & { director?: { pressure?: number } }).director?.pressure ?? B.DIRECTOR_PRESSURE_DEFAULT
  return B.CRISIS_SEVERITY_BASE + B.CRISIS_SEVERITY_PER_PRESSURE * pressure
}

/** Days to the next crisis after one fired at `stage`: interval ± jitter, kept inside [GAP_MIN, GAP_MAX]. */
function crisisGap(stage: number, rng: Rng): number {
  const base = B.CRISIS_INTERVAL_DAYS[Math.min(B.CRISIS_INTERVAL_DAYS.length - 1, stage)]!
  return clamp(B.CRISIS_GAP_MIN, B.CRISIS_GAP_MAX, base + rng.int(-B.CRISIS_INTERVAL_JITTER, B.CRISIS_INTERVAL_JITTER))
}

/**
 * Schedules the next crisis unless one is pending (so a stage change never stacks two). The first one comes
 * CRISIS_FIRST_DAYS after arriving at Pre-seed; each later one a gap after the last that fired. An old save (or a
 * stage entered long ago) never gets a crisis without its telegraph: at least CRISIS_TELEGRAPH_DAYS ahead.
 */
export function scheduleCrisis(s: GameState, rng: Rng): void {
  if (s.stage < 1 || s.stage >= B.LAST_STAGE || s.gameOver || pendingCrisis(s)) return
  const cal = calendarOf(s)
  const now = Math.ceil(s.time.day)
  const last = cal[cal.length - 1]
  const planned = last ? last.day + crisisGap(s.stage, rng) : Math.ceil(s.stageStart?.day ?? s.time.day) + rng.int(B.CRISIS_FIRST_DAYS[0], B.CRISIS_FIRST_DAYS[1])
  const day = Math.max(planned, now + B.CRISIS_TELEGRAPH_DAYS)
  cal.push({ id: null, day, revealDay: day - B.CRISIS_TELEGRAPH_DAYS })
}

/**
 * Reveal day: a crisis of the current stage that has not come yet; the pool used up → the previous crisis again,
 * lighter (severity × CRISIS_LIGHT_SEVERITY); no previous one → an unused crisis of an earlier stage.
 */
function revealCrisis(s: GameState, content: EngineContent, rng: Rng, e: CalendarEntry): void {
  const pool = content.crises ?? []
  if (!pool.length) return
  const cal = calendarOf(s)
  const used = new Set(cal.map((c) => c.id).filter((id): id is string => id !== null))
  const fresh = pool.filter((c) => c.stage === s.stage && !used.has(c.id))
  let pick: CrisisDef | undefined = fresh.length > 1 ? rng.pick(fresh) : fresh[0]
  if (!pick) {
    const prev = [...cal].reverse().find((c) => c !== e && c.id !== null)
    pick = prev ? pool.find((c) => c.id === prev.id) : undefined
    if (pick) e.light = true
  }
  pick ??= pool.filter((c) => c.stage <= s.stage && !used.has(c.id)).sort((a, b) => b.stage - a.stage)[0]
  if (!pick) return
  e.id = pick.id
  pushEvent(s, { kind: 'crisisRevealed', refId: pick.id, value: e.day })
}

/**
 * The crisis card takes a rolled card's slot (§3 md.11): no roll in the CRISIS_CARD_RESERVE_DAYS before a crisis day
 * whose card the calendar will bring.
 */
function crisisHoldsSlot(s: GameState, content: EngineContent): boolean {
  if (!content.crises?.length) return false
  const e = pendingCrisis(s)
  return e !== undefined && e.day - s.time.day <= B.CRISIS_CARD_RESERVE_DAYS
}

/** A rescue (the bridge on a missed payday, category 'crisis' but not a calendar card): it never waits. */
function isRescue(content: EngineContent, id: DecisionCardId): boolean {
  if (content.crises?.some((c) => c.cardId === id)) return false
  return content.decisions.find((c) => c.id === id)?.category === 'crisis'
}

/**
 * The crisis card takes the day (§3 md.11: one card a day, the crisis first). An unanswered normal card steps out
 * and goes back to the pool: it can come again on a later roll, after the shared cooldown (it is not in the history).
 * A rescue on the desk or in the queue stays first (the bankruptcy clock runs); the crisis card comes right after.
 */
function bringCrisisCard(s: GameState, content: EngineContent, cardId: DecisionCardId): void {
  const a = s.decisions.active
  if (a?.cardId === cardId) return
  if (a && !isRescue(content, a.cardId)) {
    for (const v of s.visitors) if (v.id === a.visitorId) v.leaveDay = Math.min(v.leaveDay, s.time.day)
    s.decisions.active = undefined
  }
  const q = s.decisions.queue.filter((id) => id !== cardId)
  let i = 0
  while (i < q.length && isRescue(content, q[i]!)) i++
  q.splice(i, 0, cardId)
  s.decisions.queue = q
}

/**
 * Daily, before the card roll: lazily schedules (old saves), reveals on the reveal day, and on the crisis day applies
 * its effects, brings its card and schedules the next one.
 */
export function fireCalendar(s: GameState, content: EngineContent, rng: Rng): void {
  scheduleCrisis(s, rng)
  const e = pendingCrisis(s)
  if (!e || s.gameOver) return
  if (e.id === null && s.time.day >= e.revealDay) revealCrisis(s, content, rng, e)
  if (s.time.day < e.day) return
  e.fired = true
  const def = e.id === null ? undefined : content.crises?.find((c) => c.id === e.id)
  if (def) {
    const severity = crisisSeverity(s) * (e.light ? B.CRISIS_LIGHT_SEVERITY : 1)
    applyEffects(s, content, def.effects(s, severity), `crisis:${def.id}`)
    // The lighter repeat brings its card too: a crisis always comes with a way to soften it (§18 spiral). It costs no
    // extra card: the reserve window already kept a roll back (crisisHoldsSlot).
    if (content.decisions.some((c) => c.id === def.cardId)) bringCrisisCard(s, content, def.cardId)
    pushEvent(s, { kind: 'crisis', refId: def.id, value: severity })
  }
  scheduleCrisis(s, rng)
}
