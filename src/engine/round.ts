// Fundraising rounds (PLAN §5.9, docs/CORE_LOOP.md §4.3 "Tur penceresi"):
// - the window opens early, at ROUND_EARLY_RATIO of the target valuation ("şimdi mi, biraz daha mı?");
// - the player picks a size: 12 / 18 / 24 months of runway on the NEW burn ↔ less / more equity;
// - the round runs 4–8 weeks; every week the live offer moves with the metrics (price × due diligence × pitches)
//   and a pitch is due (show metrics / tell the story / bring a second investor);
// - close → cash, dilution, move. The bridge loan card still comes when cash runs out mid-round (tick.ts).
import * as B from './balance'
import { clamp } from './economy'
import { applyMorale, unlockTool, unlockWidget } from './effects'
import { relocateOffice } from './office'
import type { Rng } from './rng'
import type { ActionErrorCode, DiligenceItem, GameState, PitchOption, RoundPitch, RoundSize, RoundSizeOption, RoundState, RoundView, StageIndex } from './types'
import { ROUND_PITCHES, ROUND_SIZES } from './types'
import { incCounter, newId, pushActivity, pushEvent, type EngineContent } from './util'

const WEEK_ACC = 'roundWeekAcc'
/** Flag: the stage whose round window already announced itself (one roundWindow event per stage). */
const WINDOW_FLAG = 'roundWindowStage'

/** Valuation the round into `target` is priced against. */
function targetValuationOf(target: StageIndex): number | null {
  return B.STAGE_TARGET_VALUATION[target] ?? null
}

/** Amount at an offer factor of 1: `months` of the new burn, clamped to the stage table. */
export function roundAmountFor(s: GameState, target: StageIndex, months: number): number {
  const table = B.ROUND_AMOUNT[target]
  if (table == null) return 0
  const sized = Math.max(0, s.finance.burn) * B.ROUND_NEW_BURN_MULT * months
  // The floor scales with the months asked for (table = the 18-month "target" size): a small round on a small burn
  // must not bring the same money as a target round for less equity.
  const floor = table * B.ROUND_AMOUNT_TABLE_MIN * (months / B.ROUND_RUNWAY_MONTHS.target)
  return Math.round(clamp(Math.min(floor, table * B.ROUND_AMOUNT_TABLE_MAX), table * B.ROUND_AMOUNT_TABLE_MAX, sized))
}

/** Equity sold for a size; each ☆ stage goal takes GOAL_STAR_EQUITY_DISCOUNT off. */
export function roundEquityFor(target: StageIndex, size: RoundSize, stars: number): number {
  const base = B.ROUND_EQUITY[target]
  if (base == null) return 0
  return Math.max(0.02, base * B.ROUND_SIZE_EQUITY[size] - Math.max(0, stars) * B.GOAL_STAR_EQUITY_DISCOUNT)
}

/** MoM growth the investor asks for at the current stage. */
export function growthAsk(s: GameState): number {
  return B.DILIGENCE_MOM[s.stage] ?? B.DILIGENCE_MOM[B.DILIGENCE_MOM.length - 1]!
}

/** What a pitch would do right now (the action applies exactly this). */
export function pitchOption(s: GameState, pitch: RoundPitch): PitchOption {
  switch (pitch) {
    case 'metrics':
      return { pitch, delta: s.derived.momGrowth >= growthAsk(s) ? B.PITCH_METRICS_GOOD : B.PITCH_METRICS_BAD, weeks: 0, equity: 0, energy: 0, ok: true }
    case 'story':
      return {
        pitch,
        delta: B.PITCH_STORY_BASE + (clamp(0, 100, s.stats.reputation) / 100) * B.PITCH_STORY_PER_REP,
        weeks: 0,
        equity: 0,
        energy: B.PITCH_STORY_ENERGY,
        ok: s.founder.energy >= B.PITCH_STORY_ENERGY,
      }
    case 'coinvestor':
      return { pitch, delta: 0, weeks: B.PITCH_COINVESTOR_WEEKS, equity: B.PITCH_COINVESTOR_EQUITY, energy: 0, ok: true }
  }
}

/** The investor's due-diligence list with today's values (runway ≥ 3 months, MoM ≥ stage ask, morale ≥ 50). */
export function diligenceNow(s: GameState): DiligenceItem[] {
  const runway = s.finance.runway
  const mom = s.derived.momGrowth
  const ask = growthAsk(s)
  return [
    { id: 'runway', target: B.DILIGENCE_RUNWAY_MONTHS, value: runway ?? B.DILIGENCE_RUNWAY_MONTHS, met: runway === null || runway >= B.DILIGENCE_RUNWAY_MONTHS },
    { id: 'growth', target: ask, value: mom, met: mom >= ask },
    { id: 'morale', target: B.DILIGENCE_MORALE, value: s.stats.morale, met: s.stats.morale >= B.DILIGENCE_MORALE },
  ]
}

/** 1 + Σ (met +5%, unmet −10%). */
export function diligenceFactor(items: readonly DiligenceItem[]): number {
  return items.reduce((f, d) => f + (d.met ? B.DILIGENCE_MET : B.DILIGENCE_UNMET), 1)
}

/** Price part of the offer: valuation / target in ROUND_OFFER_CLAMP. */
export function priceRatio(valuation: number, target: number): number {
  const [lo, hi] = B.ROUND_OFFER_CLAMP
  return target > 0 ? clamp(lo, hi, valuation / target) : 1
}

/** Whole offer factor: price × diligence × pitches, in [ROUND_OFFER_FLOOR, ROUND_OFFER_CEIL]. */
export function offerFactor(price: number, diligence: readonly DiligenceItem[], pitchFactor: number): number {
  return clamp(B.ROUND_OFFER_FLOOR, B.ROUND_OFFER_CEIL, price * diligenceFactor(diligence) * pitchFactor)
}

/** Fills the live fields of a round from an older save (its fixed offer becomes the base). */
function live(r: RoundState): Required<Pick<RoundState, 'baseAmount' | 'targetValuation' | 'pitchFactor'>> {
  r.baseAmount ??= r.offer.amount
  r.targetValuation ??= targetValuationOf(r.targetStage) ?? r.baseValuation
  r.pitchFactor ??= 1
  return { baseAmount: r.baseAmount, targetValuation: r.targetValuation, pitchFactor: r.pitchFactor }
}

/** Offer the running round would close at with today's numbers. */
function liveOffer(s: GameState, r: RoundState, diligence: readonly DiligenceItem[]): number {
  const l = live(r)
  return Math.round(l.baseAmount * offerFactor(priceRatio(s.finance.valuation, l.targetValuation), diligence, l.pitchFactor))
}

function setOfferAmount(r: RoundState, amount: number): void {
  r.offer.amount = amount
  r.offer.preMoney = r.offer.equity > 0 ? amount / r.offer.equity - amount : 0
}

/** Round numbers for the UI (state.derived.round). `stars` = ☆ goals of this stage. */
export function roundView(s: GameState, stars: number): RoundView | undefined {
  const r = s.round?.active ? s.round : undefined
  const targetStage = r ? r.targetStage : ((s.stage + 1) as StageIndex)
  if (!r && (s.stage >= B.LAST_STAGE - 1 || B.ROUND_AMOUNT[targetStage] == null)) return undefined
  const target = r ? live(r).targetValuation : targetValuationOf(targetStage)
  if (target == null) return undefined
  const diligence = diligenceNow(s)
  const price = priceRatio(s.finance.valuation, target)
  const view: RoundView = {
    target,
    windowAt: target * B.ROUND_EARLY_RATIO,
    priceRatio: price,
    factor: offerFactor(price, diligence, r?.pitchFactor ?? 1),
    diligence,
    growthAsk: growthAsk(s),
  }
  if (r) {
    view.projected = liveOffer(s, r, diligence)
    if (r.pitchDue !== undefined) view.pitchOptions = ROUND_PITCHES.map((p) => pitchOption(s, p))
  } else {
    view.sizes = ROUND_SIZES.map((size): RoundSizeOption => {
      const amount = roundAmountFor(s, targetStage, B.ROUND_RUNWAY_MONTHS[size])
      return { size, months: B.ROUND_RUNWAY_MONTHS[size], amount, offer: Math.round(amount * view.factor), equity: roundEquityFor(targetStage, size, stars) }
    })
  }
  return view
}

/** True once valuation reaches the early window (target × ROUND_EARLY_RATIO). */
export function roundWindowOpen(valuation: number, target: number | null): boolean {
  return target !== null && valuation >= target * B.ROUND_EARLY_RATIO
}

/** Daily: announce the early window once per stage (roundWindow event: the "tur teklifi" moment). */
export function checkRoundWindow(s: GameState): void {
  if (!s.derived.canStartRound || Number(s.flags[WINDOW_FLAG] ?? -1) === s.stage) return
  s.flags[WINDOW_FLAG] = s.stage
  pushActivity(s, 'roundWindow', { stage: s.stage + 1 })
  pushEvent(s, { kind: 'roundWindow', value: s.stage + 1 })
}

/** `stars`: ☆ stage goals reached this stage; each takes GOAL_STAR_EQUITY_DISCOUNT off the equity sold. */
export function startRound(s: GameState, rng: Rng, stars = 0, size: RoundSize = 'target'): ActionErrorCode | null {
  if (s.round?.active) return 'roundActive'
  if (!s.derived.canStartRound) return 'roundNotReady'
  if (!(ROUND_SIZES as readonly string[]).includes(size)) return 'invalid'
  const target = (s.stage + 1) as StageIndex
  const targetValuation = targetValuationOf(target)
  if (B.ROUND_AMOUNT[target] == null || B.ROUND_EQUITY[target] == null || targetValuation == null) return 'roundNotReady'
  const months = B.ROUND_RUNWAY_MONTHS[size]
  const baseAmount = roundAmountFor(s, target, months)
  const equity = roundEquityFor(target, size, stars)
  const weeks = rng.int(B.ROUND_WEEKS_MIN, B.ROUND_WEEKS_MAX)
  const diligence = diligenceNow(s)
  const r: RoundState = {
    active: true,
    targetStage: target,
    startedDay: s.time.day,
    weeksTotal: weeks,
    weeksLeft: weeks,
    offer: { amount: baseAmount, equity, preMoney: 0 },
    baseValuation: s.finance.valuation,
    size,
    months,
    baseAmount,
    targetValuation,
    pitchFactor: 1,
    pitches: [],
    diligence,
  }
  setOfferAmount(r, liveOffer(s, r, diligence))
  s.round = r
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

/** Continuous: advance round weeks (roundSpeed modifiers make weeks pass faster). Weekly: live offer + pitch due. */
export function progressRound(s: GameState, content: EngineContent, dtDays: number, roundSpeed: number): void {
  const r = s.round
  if (!r?.active) return
  let acc = Number(s.flags[WEEK_ACC] ?? 0) + dtDays * roundSpeed
  while (acc >= 7 && r.weeksLeft > 0) {
    acc -= 7
    r.weeksLeft -= 1
    weekPassed(s, r)
  }
  s.flags[WEEK_ACC] = acc
  if (r.weeksLeft <= 0) closeRound(s, content)
}

/** One round week: diligence values refresh, the offer follows the metrics, the next pitch is due. */
function weekPassed(s: GameState, r: RoundState): void {
  const week = r.weeksTotal - r.weeksLeft
  r.diligence = diligenceNow(s)
  const from = r.offer.amount
  const to = liveOffer(s, r, r.diligence)
  setOfferAmount(r, to)
  r.lastMove = { week, from, to }
  // A pitch not made last week is simply gone (no penalty); the next one replaces it.
  if (r.weeksLeft > 0) r.pitchDue = week
  else delete r.pitchDue
  pushActivity(s, 'roundOffer', { done: week, total: r.weeksTotal, from: Math.round(from), amount: Math.round(to) })
  pushEvent(s, { kind: 'roundWeek', value: to })
}

/** The week's pitch (docs/CORE_LOOP.md §4.3): changes the offer factor or the round length. */
export function roundPitch(s: GameState, pitch: RoundPitch): ActionErrorCode | null {
  const r = s.round
  if (!r?.active) return 'roundNotReady'
  if (r.pitchDue === undefined) return 'cooldown'
  if (!(ROUND_PITCHES as readonly string[]).includes(pitch)) return 'invalid'
  const l = live(r)
  const o = pitchOption(s, pitch)
  if (!o.ok) return 'noEnergy'
  s.founder.energy -= o.energy
  if (o.weeks > 0) r.weeksLeft = Math.max(1, r.weeksLeft - o.weeks)
  if (o.equity > 0) r.offer.equity = Math.min(0.5, r.offer.equity + o.equity)
  const delta = o.delta
  r.pitchFactor = l.pitchFactor * (1 + delta)
  ;(r.pitches ??= []).push({ week: r.pitchDue, pitch, delta })
  delete r.pitchDue
  r.diligence = diligenceNow(s)
  setOfferAmount(r, liveOffer(s, r, r.diligence))
  pushActivity(s, 'roundPitch', { pitch, amount: Math.round(r.offer.amount) })
  pushEvent(s, { kind: 'roundPitched', refId: pitch, value: delta })
  return null
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
  // The close prices today's numbers (canlı teklif).
  r.diligence = diligenceNow(s)
  setOfferAmount(r, liveOffer(s, r, r.diligence))
  r.active = false
  const repay = Math.min(s.finance.debt, r.offer.amount)
  s.finance.debt -= repay
  s.stats.cash += r.offer.amount - repay
  s.stats.equity = clamp(0.01, 1, s.stats.equity * (1 - r.offer.equity))
  applyMorale(s, B.ROUND_CLOSE_MORALE)
  s.stats.reputation = clamp(0, 100, s.stats.reputation + B.ROUND_CLOSE_REPUTATION)
  unlockWidget(s, 'reputation')
  incCounter(s, 'roundsClosed')
  for (const v of s.visitors) if (v.purpose === 'round') v.leaveDay = Math.min(v.leaveDay, s.time.day)
  pushActivity(s, 'roundClosed', { amount: Math.round(r.offer.amount), equity: r.offer.equity })
  pushEvent(s, { kind: 'roundClosed', value: r.offer.amount })
  enterStage(s, r.targetStage)
  s.round = undefined
}
