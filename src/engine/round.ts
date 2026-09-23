// Fundraising rounds (PLAN §5.9, docs/CORE_LOOP.md §4.3 "Tur penceresi"):
// - the window opens early, at ROUND_EARLY_RATIO of the target valuation ("şimdi mi, biraz daha mı?");
// - the player picks a size: 12 / 18 / 24 months of runway on the NEW burn ↔ less / more equity;
// - the round runs ROUND_WEEKS_MIN–MAX weeks; every week the live offer moves with the metrics and a pitch is due
//   (show metrics / tell the story / bring a second investor) until the pitches reach their cap;
// - offer = amount × (clamp(price × due diligence, floor, ceiling) + pitch bonus), where half the price is locked
//   when the round starts (an early start is safe but cheap) and the amount follows the burn you actually run;
// - close → cash, dilution, move. The bridge loan card still comes when cash runs out mid-round (tick.ts).
import * as B from './balance'
import { clamp } from './economy'
import { applyMorale, unlockTool, unlockWidget } from './effects'
import { relocateOffice } from './office'
import type { Rng } from './rng'
import type { ActionErrorCode, DiligenceItem, GameState, PitchOption, RoundPitch, RoundSize, RoundSizeOption, RoundState, RoundView, StageIndex } from './types'
import { ROUND_PITCHES, ROUND_SIZES } from './types'
import { incCounter, newId, pushActivity, pushEvent, stageBaseline, type EngineContent } from './util'

const WEEK_ACC = 'roundWeekAcc'
/** Flag: the stage whose round window already announced itself (one roundWindow event per stage). */
const WINDOW_FLAG = 'roundWindowStage'

/** Valuation the round into `target` is priced against. */
function targetValuationOf(target: StageIndex): number | null {
  return B.STAGE_TARGET_VALUATION[target] ?? null
}

/**
 * Burn a round is sized on: salaries + rent + infra + founder living + ads, where ads count at most what the last
 * payday actually paid for them. A budget raised for an instant before "Turu başlat" (and dropped after) buys nothing,
 * and the live offer re-sizes every week, so hiring or firing around the start does not stick either.
 */
export function roundBurn(s: GameState): number {
  const bb = s.finance.burnBreakdown
  const paidAds = s.finance.lastReceipt?.ads ?? 0
  const ads = Math.min(Math.max(0, bb.ads), Math.max(0, paidAds))
  return Math.max(0, bb.salaries + bb.rent + bb.infra + (bb.founder ?? 0) + ads)
}

export type RoundAmountBy = 'floor' | 'burn' | 'ceiling'

/**
 * Amount at an offer factor of 1: `months` of the new burn (ROUND_NEW_BURN_MULT × today's round burn), between a
 * floor and a ceiling taken from the stage table. Both bounds scale with the months asked for (table = the 18-month
 * "target" size), so Küçük < Hedef < Büyük always: a smaller round never brings the same money for less equity.
 */
export function roundAmountParts(s: GameState, target: StageIndex, months: number): { amount: number; by: RoundAmountBy } {
  const table = B.ROUND_AMOUNT[target]
  if (table == null) return { amount: 0, by: 'floor' }
  const k = months / B.ROUND_RUNWAY_MONTHS.target
  const sized = roundBurn(s) * B.ROUND_NEW_BURN_MULT * months
  const floor = table * B.ROUND_AMOUNT_TABLE_MIN * k
  const ceil = table * B.ROUND_AMOUNT_TABLE_MAX * k
  const by: RoundAmountBy = sized <= floor ? 'floor' : sized >= ceil ? 'ceiling' : 'burn'
  return { amount: Math.round(clamp(floor, ceil, sized)), by }
}

export function roundAmountFor(s: GameState, target: StageIndex, months: number): number {
  return roundAmountParts(s, target, months).amount
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

/** Growth the investor looks at: the 3-month average MoM (one lucky month on a tiny base does not count). */
export function investorGrowth(s: GameState): number {
  return s.derived.momAvg ?? s.derived.momGrowth
}

/** What a pitch would do right now (the action applies exactly this; 'story' draws inside [min, max]). */
export function pitchOption(s: GameState, pitch: RoundPitch): PitchOption {
  switch (pitch) {
    case 'metrics':
      return { pitch, delta: investorGrowth(s) >= growthAsk(s) ? B.PITCH_METRICS_GOOD : B.PITCH_METRICS_BAD, weeks: 0, equity: 0, energy: 0, ok: true }
    case 'story': {
      const rep = (clamp(0, 100, s.stats.reputation) / 100) * B.PITCH_STORY_PER_REP
      const min = B.PITCH_STORY_MIN + rep
      const max = B.PITCH_STORY_MAX + rep
      return { pitch, delta: (min + max) / 2, min, max, weeks: 0, equity: 0, energy: B.PITCH_STORY_ENERGY, ok: s.founder.energy >= B.PITCH_STORY_ENERGY }
    }
    case 'coinvestor':
      return { pitch, delta: 0, weeks: B.PITCH_COINVESTOR_WEEKS, equity: B.PITCH_COINVESTOR_EQUITY, energy: 0, ok: true }
  }
}

/** The investor's due-diligence list with today's values (runway ≥ 3 months, MoM ≥ stage ask, morale ≥ 50). */
export function diligenceNow(s: GameState): DiligenceItem[] {
  const runway = s.finance.runway
  const mom = investorGrowth(s)
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

/** Price × diligence, in [ROUND_OFFER_FLOOR, ROUND_OFFER_CEIL]: what the numbers alone are worth. */
export function metricsFactor(price: number, diligence: readonly DiligenceItem[]): number {
  return clamp(B.ROUND_OFFER_FLOOR, B.ROUND_OFFER_CEIL, price * diligenceFactor(diligence))
}

/** Whole offer factor: metrics part + the pitch bonus (±PITCH_BONUS_CAP), never below ROUND_OFFER_FLOOR. */
export function offerFactor(price: number, diligence: readonly DiligenceItem[], pitchBonus: number): number {
  return Math.max(B.ROUND_OFFER_FLOOR, metricsFactor(price, diligence) + clamp(-B.PITCH_BONUS_CAP, B.PITCH_BONUS_CAP, pitchBonus))
}

/** Half the price is locked when the round starts: √(price at start × price now). */
export function lockedPrice(priceAtStart: number, priceNow: number): number {
  return Math.sqrt(Math.max(0, priceAtStart) * Math.max(0, priceNow))
}

/** Fills the live fields of a round from an older save (its fixed offer becomes the base). */
function live(r: RoundState): Required<Pick<RoundState, 'baseAmount' | 'targetValuation' | 'pitchBonus' | 'priceAtStart'>> {
  r.baseAmount ??= r.offer.amount
  r.targetValuation ??= targetValuationOf(r.targetStage) ?? r.baseValuation
  r.pitchBonus ??= clamp(-B.PITCH_BONUS_CAP, B.PITCH_BONUS_CAP, (r.pitchFactor ?? 1) - 1)
  r.priceAtStart ??= priceRatio(r.baseValuation, r.targetValuation)
  return { baseAmount: r.baseAmount, targetValuation: r.targetValuation, pitchBonus: r.pitchBonus, priceAtStart: r.priceAtStart }
}

/** Amount at factor 1 right now: re-sized on today's burn (older saves without `months` keep their fixed base). */
function liveBase(s: GameState, r: RoundState): number {
  return r.months !== undefined ? roundAmountFor(s, r.targetStage, r.months) : live(r).baseAmount
}

/** Offer factor of the running round with today's numbers. */
function liveFactor(s: GameState, r: RoundState, diligence: readonly DiligenceItem[]): number {
  const l = live(r)
  return offerFactor(lockedPrice(l.priceAtStart, priceRatio(s.finance.valuation, l.targetValuation)), diligence, l.pitchBonus)
}

/** Offer the running round would close at with today's numbers. */
function liveOffer(s: GameState, r: RoundState, diligence: readonly DiligenceItem[]): number {
  return Math.round(liveBase(s, r) * liveFactor(s, r, diligence))
}

/** Average pitch result over the weeks a pitch was due (skipped weeks count as 0), within ±PITCH_BONUS_CAP. */
export function pitchAverage(r: RoundState): number {
  const list = r.pitches ?? []
  const n = Math.max(1, r.pitchWeeks ?? list.length)
  return clamp(-B.PITCH_BONUS_CAP, B.PITCH_BONUS_CAP, list.reduce((a, p) => a + p.delta, 0) / n)
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
    factor: r ? liveFactor(s, r, diligence) : offerFactor(price, diligence, 0),
    ceiling: B.ROUND_OFFER_CEIL,
    pitchBonus: r ? live(r).pitchBonus : 0,
    pitchCap: B.PITCH_BONUS_CAP,
    weeksMin: B.ROUND_WEEKS_MIN,
    weeksMax: B.ROUND_WEEKS_MAX,
    diligence,
    growthAsk: growthAsk(s),
  }
  if (r) {
    view.priceAtStart = live(r).priceAtStart
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
    pitchBonus: 0,
    priceAtStart: priceRatio(s.finance.valuation, targetValuation),
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
  if (r.months !== undefined) r.amountBy = roundAmountParts(s, r.targetStage, r.months).by
  const to = liveOffer(s, r, r.diligence)
  setOfferAmount(r, to)
  r.lastMove = { week, from, to }
  // A pitch not made last week is gone; it counts as a quiet week (0) in the investor's average impression.
  if (r.weeksLeft > 0) {
    r.pitchDue = week
    r.pitchWeeks = (r.pitchWeeks ?? (r.pitches ?? []).length) + 1
    r.pitchBonus = pitchAverage(r)
  } else delete r.pitchDue
  pushActivity(s, 'roundOffer', { done: week, total: r.weeksTotal, from: Math.round(from), amount: Math.round(to) })
  pushEvent(s, { kind: 'roundWeek', value: to })
}

/** The week's pitch (docs/CORE_LOOP.md §4.3): changes the offer factor or the round length. */
export function roundPitch(s: GameState, pitch: RoundPitch, rng?: Rng): ActionErrorCode | null {
  const r = s.round
  if (!r?.active) return 'roundNotReady'
  if (r.pitchDue === undefined) return 'cooldown'
  if (!(ROUND_PITCHES as readonly string[]).includes(pitch)) return 'invalid'
  live(r)
  const o = pitchOption(s, pitch)
  if (!o.ok) return 'noEnergy'
  s.founder.energy -= o.energy
  if (o.weeks > 0) r.weeksLeft = Math.max(1, r.weeksLeft - o.weeks)
  if (o.equity > 0) r.offer.equity = Math.min(0.5, r.offer.equity + o.equity)
  // "Hikâye anlat" is a gamble between min and max (reputation lifts both); the others are known in advance.
  const delta = o.min !== undefined && o.max !== undefined && rng ? rng.range(o.min, o.max) : o.delta
  ;(r.pitches ??= []).push({ week: r.pitchDue, pitch, delta })
  r.pitchWeeks = Math.max(r.pitchWeeks ?? 0, r.pitches.length)
  r.pitchBonus = pitchAverage(r)
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
  s.stageStart = stageBaseline(s)
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
  if (r.months !== undefined) r.amountBy = roundAmountParts(s, r.targetStage, r.months).by
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
