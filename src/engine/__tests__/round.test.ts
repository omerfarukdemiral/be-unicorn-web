// Core loop, phase 2 (docs/CORE_LOOP.md §4.3, §5): the live round window (early start at 60%, size choice,
// due diligence, weekly live offer + pitch, bridge loan kept) and "Elle kullanıcı bul" saturation.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { findUsersPreview } from '../founder'
import { createEngine } from '../index'
import { closeRound, diligenceFactor, diligenceNow, lockedPrice, offerFactor, priceRatio, roundAmountFor, roundEquityFor } from '../round'
import { Rng, createRngState } from '../rng'
import type { DiligenceItem, GameState } from '../types'
import { fakeCard, fakeContent } from './fixtures'

const api = createEngine(fakeContent())

/** Recompute derived numbers without advancing time. */
const refresh = (s: GameState): GameState => api.applyAction(s, { type: 'setSpeed', speed: 0 }).state

/** Garage with one engineer and a launched MVP: pre-revenue valuation = 150K + users × 400 (no releases on record). */
function launched(users: number, seed = 1): GameState {
  let s = api.createGame({ seed })
  s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
  s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
  const eng = s.candidates.find((c) => c.dept === 'eng') ?? s.candidates[0]!
  s = api.applyAction(s, { type: 'hire', candidateId: eng.id }).state
  s = { ...s, projects: s.projects.map((p) => ({ ...p, maturity: 0.25, launched: true, launchedDay: 0 })), stats: { ...s.stats, users, morale: 70 }, releases: [] }
  // Keep users under the pre-revenue MRR line so valuation is the simple pre-revenue formula.
  return refresh({ ...s, finance: { ...s.finance, priceMultiplier: B.PRICE_MIN } })
}

const target = B.STAGE_TARGET_VALUATION[1]!

/** The same state with a round burn of `b` a month (all salaries; round.ts sizes on burnBreakdown). */
const withBurn = (s: GameState, b: number): GameState => ({ ...s, finance: { ...s.finance, burn: b, burnBreakdown: { salaries: b, rent: 0, infra: 0, ads: 0, founder: 0 } } })

/** Users that put the garage valuation at `v`. */
const usersFor = (v: number) => Math.ceil((v - B.VAL_PER_LAUNCHED) / B.VAL_PER_USER)

const dd = (met: boolean[]): DiligenceItem[] => met.map((m, i) => ({ id: (['runway', 'growth', 'morale'] as const)[i]!, target: 1, value: 1, met: m }))

describe('round window (erken tur penceresi)', () => {

  it('opens at 60% of the target valuation, not before', () => {
    const below = launched(usersFor(target * B.ROUND_EARLY_RATIO) - 40)
    expect(below.finance.valuation).toBeLessThan(target * B.ROUND_EARLY_RATIO)
    expect(below.derived.canStartRound).toBe(false)
    expect(api.applyAction(below, { type: 'startRound' }).error).toBe('roundNotReady')
    const at = launched(usersFor(target * B.ROUND_EARLY_RATIO) + 1)
    expect(at.finance.valuation).toBeGreaterThanOrEqual(target * B.ROUND_EARLY_RATIO)
    expect(at.finance.valuation).toBeLessThan(target)
    expect(at.derived.canStartRound).toBe(true)
    expect(at.derived.round!.windowAt).toBeCloseTo(target * B.ROUND_EARLY_RATIO, 6)
  })

  it('announces the window once per stage (roundWindow event)', () => {
    let s = launched(usersFor(target * 0.7))
    s = api.step(s, 3)
    expect(s.events.filter((e) => e.kind === 'roundWindow')).toHaveLength(1)
    s = api.step(s, 3)
    expect(s.events.filter((e) => e.kind === 'roundWindow')).toHaveLength(1)
  })

  it('an early start is priced at valuation / target (offer smaller than waiting)', () => {
    const early = api.applyAction(launched(usersFor(target * 0.65)), { type: 'startRound' }).state
    const late = api.applyAction(launched(usersFor(target * 1.0)), { type: 'startRound' }).state
    expect(early.round!.offer.amount).toBeLessThan(late.round!.offer.amount)
  })
})

describe('round size (8 / 12 / 16 months ↔ equity)', () => {
  it('more months = more money and more equity; the amount follows the new burn inside the table band', () => {
    const s = launched(usersFor(400_000))
    const sizes = s.derived.round!.sizes!
    expect(sizes.map((x) => x.months)).toEqual([B.ROUND_RUNWAY_MONTHS.small, B.ROUND_RUNWAY_MONTHS.target, B.ROUND_RUNWAY_MONTHS.large])
    expect(sizes[0]!.equity).toBeLessThan(sizes[1]!.equity)
    expect(sizes[1]!.equity).toBeLessThan(sizes[2]!.equity)
    expect(sizes[1]!.equity).toBeCloseTo(B.ROUND_EQUITY[1]!, 6)
    for (const o of sizes) {
      expect(o.amount).toBeGreaterThanOrEqual(B.ROUND_AMOUNT[1]! * B.ROUND_AMOUNT_TABLE_MIN * (o.months / B.ROUND_RUNWAY_MONTHS.target) - 1)
      expect(o.amount).toBeLessThanOrEqual(B.ROUND_AMOUNT[1]! * B.ROUND_AMOUNT_TABLE_MAX * (o.months / B.ROUND_RUNWAY_MONTHS.target) + 1)
    }
    // A bigger burn buys a bigger round (until the table cap).
    const low = withBurn(s, 1_000)
    const high = withBurn(s, 6_000)
    expect(roundAmountFor(high, 1, 12)).toBeGreaterThan(roundAmountFor(low, 1, 12))
    // The floor scales with the months asked for: a small round on a small burn brings less than a target one.
    expect(roundAmountFor(low, 1, 8)).toBe(Math.round(B.ROUND_AMOUNT[1]! * B.ROUND_AMOUNT_TABLE_MIN * (8 / 12)))
    expect(roundAmountFor(low, 1, 12)).toBe(B.ROUND_AMOUNT[1]! * B.ROUND_AMOUNT_TABLE_MIN)
    expect(roundAmountFor(low, 1, 8)).toBeLessThan(roundAmountFor(low, 1, 12))
    expect(roundAmountFor(low, 1, 12)).toBeLessThan(roundAmountFor(low, 1, 16))
    // The ceiling scales too: a huge burn still buys Küçük < Hedef < Büyük.
    const huge = withBurn(s, 1e9)
    expect(roundAmountFor(huge, 1, 12)).toBe(B.ROUND_AMOUNT[1]! * B.ROUND_AMOUNT_TABLE_MAX)
    expect(roundAmountFor(huge, 1, 8)).toBeLessThan(roundAmountFor(huge, 1, 12))
    expect(roundAmountFor(huge, 1, 12)).toBeLessThan(roundAmountFor(huge, 1, 16))
  })

  it('small burn where burn × months passes the ceiling for every size: amounts still rise with size (review #3)', () => {
    // Pre-seed playtest: burn $5.2K, all three sizes clipped to the same $120K while equity differed.
    const s = refresh(withBurn(launched(usersFor(330_000)), 5_200))
    const sizes = s.derived.round!.sizes!
    expect(sizes[0]!.amount).toBeLessThan(sizes[1]!.amount)
    expect(sizes[1]!.amount).toBeLessThan(sizes[2]!.amount)
    for (const o of sizes) expect(o.amount / o.equity).toBeGreaterThan(0)
  })

  it('an ad spike right before startRound does not change the amount (review #18)', () => {
    const base = launched(usersFor(450_000))
    const calm = api.applyAction(base, { type: 'startRound', size: 'small' }).state
    // Ads count at most what the last payday paid for them (none yet): a 50M budget for an instant buys nothing.
    const spiked = refresh({ ...base, finance: { ...base.finance, adBudget: 50_000_000 } })
    const r = api.applyAction(spiked, { type: 'startRound', size: 'small' }).state
    expect(r.round!.baseAmount).toBe(calm.round!.baseAmount)
    // And the live offer re-sizes on the burn actually run: dropping the ads after the start changes nothing either.
    const after = api.step(refresh({ ...r, finance: { ...r.finance, adBudget: 0 } }), 7)
    expect(after.round!.offer.amount).toBeLessThanOrEqual(api.step(calm, 7).round!.offer.amount + 1)
  })

  it('startRound takes the size; the round remembers months and equity (☆ discounts still apply)', () => {
    const s = launched(usersFor(450_000))
    const r = api.applyAction(s, { type: 'startRound', size: 'large' })
    expect(r.ok).toBe(true)
    expect(r.state.round!.size).toBe('large')
    expect(r.state.round!.months).toBe(B.ROUND_RUNWAY_MONTHS.large)
    expect(r.state.round!.offer.equity).toBeCloseTo(roundEquityFor(1, 'large', 0), 6)
    expect(api.applyAction(s, { type: 'startRound', size: 'huge' as never }).error).toBe('invalid')
  })

  it('GAMEPLAY V2 §8.3: each board quarter hit takes BOARD_HIT_EQUITY off the next round, priced once', () => {
    expect(roundEquityFor(4, 'target', 0, 0, 2 * B.BOARD_HIT_EQUITY)).toBeCloseTo(roundEquityFor(4, 'target', 0) - 2 * B.BOARD_HIT_EQUITY, 9)
    const base = launched(usersFor(450_000))
    const s = refresh({ ...base, board: { quarterStart: 0, targetMrr: 0, missed: 0, streak: 2, credit: 2 } })
    expect(s.derived.round!.sizes!.find((x) => x.size === 'large')!.equity).toBeCloseTo(roundEquityFor(1, 'large', 0, 0, 2 * B.BOARD_HIT_EQUITY), 9)
    const r = api.applyAction(s, { type: 'startRound', size: 'large' })
    expect(r.state.round!.offer.equity).toBeCloseTo(roundEquityFor(1, 'large', 0) - 2 * B.BOARD_HIT_EQUITY, 6)
    // Spent only at the close (a failed round keeps it); a quarter hit while the round runs stays for the next one.
    expect(r.state.board!.credit).toBe(2)
    const closing = structuredClone({ ...r.state, board: { ...r.state.board!, credit: 3 } })
    closeRound(closing, fakeContent(), new Rng(createRngState(1)))
    expect(closing.board!.credit).toBe(1)
  })
})

describe('live offer: clamp and due diligence', () => {
  it('price ratio is clamped to 0.6–1.2', () => {
    expect(priceRatio(100, 1000)).toBe(B.ROUND_OFFER_CLAMP[0])
    expect(priceRatio(800, 1000)).toBeCloseTo(0.8, 9)
    expect(priceRatio(5000, 1000)).toBe(B.ROUND_OFFER_CLAMP[1])
  })

  it('each met diligence item is +5%, each unmet −10%; the whole factor stays in 50%–130%', () => {
    expect(diligenceFactor(dd([true, true, true]))).toBeCloseTo(1.15, 9)
    expect(diligenceFactor(dd([true, false, true]))).toBeCloseTo(1.0, 9)
    expect(diligenceFactor(dd([false, false, false]))).toBeCloseTo(0.7, 9)
    expect(offerFactor(1, dd([true, true, false]), 0)).toBeCloseTo(1.0, 9)
    expect(offerFactor(0.6, dd([false, false, false]), 0)).toBe(B.ROUND_OFFER_FLOOR)
    // The ceiling holds price × diligence only; the pitch bonus (±cap) is added on top (review #17).
    expect(offerFactor(1.2, dd([true, true, true]), 0)).toBe(B.ROUND_OFFER_CEIL)
    expect(offerFactor(1.2, dd([true, true, true]), 0.1)).toBeCloseTo(B.ROUND_OFFER_CEIL + 0.1, 9)
    expect(offerFactor(1.2, dd([true, true, true]), 1)).toBeCloseTo(B.ROUND_OFFER_CEIL + B.PITCH_BONUS_CAP, 9)
  })

  it('half the price is locked at the start: an early start closes cheaper than a late one at the same close (review #16)', () => {
    expect(lockedPrice(0.6, 1.2)).toBeCloseTo(Math.sqrt(0.72), 9)
    const early = api.applyAction(launched(usersFor(target * 0.62)), { type: 'startRound' }).state
    const late = api.applyAction(launched(usersFor(target * 1.0)), { type: 'startRound' }).state
    // Same numbers at the close (valuation at target): the early round still carries its cheap start.
    const closeAt = (s: GameState) => refresh({ ...s, stats: { ...s.stats, users: usersFor(target) } })
    expect(closeAt(early).derived.round!.projected!).toBeLessThan(closeAt(late).derived.round!.projected!)
  })

  it('the round carries the investor’s checklist with live values', () => {
    const s = api.applyAction(launched(usersFor(450_000)), { type: 'startRound' }).state
    const ids = s.round!.diligence!.map((d) => d.id)
    expect(ids).toEqual(['runway', 'growth', 'morale', 'burn'])
    const morale = s.round!.diligence!.find((d) => d.id === 'morale')!
    expect(morale.target).toBe(B.DILIGENCE_MORALE)
    expect(morale.met).toBe(true)
    // Garage / Pre-seed: the burn multiple is not asked (99), so no growth yet does not fail it.
    const burn = s.round!.diligence!.find((d) => d.id === 'burn')!
    expect(burn.target).toBe(99)
    expect(burn.met).toBe(true)
    // Not asked = neutral: it adds nothing to the offer (no free +5% before Seed).
    expect(burn.asked).toBe(false)
    const asked = s.round!.diligence!.filter((d) => d.id !== 'burn')
    expect(diligenceFactor(s.round!.diligence!)).toBeCloseTo(diligenceFactor(asked), 9)
  })

  it('from Seed the investor asks for a burn multiple ≤ 3 (GAMEPLAY V2 §4.1)', () => {
    const seed = launched(usersFor(450_000))
    const at = (bm: number) => diligenceNow({ ...seed, stage: 2, derived: { ...seed.derived, burnMultiple: bm } }).find((d) => d.id === 'burn')!
    expect(at(2).target).toBe(3)
    expect(at(2).met).toBe(true)
    expect(at(3.5).met).toBe(false)
    expect(at(2).asked).toBe(true)
    expect(B.DILIGENCE_BM).toEqual([99, 99, 3, 2.5, 2, 1.5, 1.5])
  })
})

describe('round weeks: live offer + weekly pitch', () => {
  function running(users = usersFor(450_000)): GameState {
    const s = api.applyAction(launched(users), { type: 'startRound' }).state
    return { ...s, round: { ...s.round!, weeksTotal: 6, weeksLeft: 6 } }
  }

  it('every week the offer follows the metrics, and a pitch falls due', () => {
    let s = running()
    expect(s.round!.pitchDue).toBeUndefined()
    s = api.step(s, 7)
    expect(s.round!.weeksLeft).toBe(5)
    expect(s.round!.pitchDue).toBe(1)
    expect(s.round!.lastMove!.week).toBe(1)
    expect(s.events.some((e) => e.kind === 'roundWeek')).toBe(true)
    // More users → higher valuation → next week's offer moves up.
    const before = s.round!.offer.amount
    s = api.step({ ...s, stats: { ...s.stats, users: s.stats.users + 400 } }, 7)
    expect(s.round!.lastMove!.from).toBe(before)
    expect(s.round!.offer.amount).toBeGreaterThan(before)
  })

  it('pitches: metrics pays only with growth, story costs energy, a co-investor is faster but takes equity', () => {
    let s = api.step(running(), 7)
    expect(s.round!.pitchDue).toBe(1)
    // Pre-revenue: MoM 0 < ask → "Metrik göster" backfires.
    const m = api.applyAction(s, { type: 'roundPitch', pitch: 'metrics' })
    expect(m.ok).toBe(true)
    expect(m.state.round!.pitches![0]!.delta).toBe(B.PITCH_METRICS_BAD)
    expect(m.state.round!.pitchDue).toBeUndefined()
    expect(api.applyAction(m.state, { type: 'roundPitch', pitch: 'story' }).error).toBe('cooldown')
    const good = refresh({ ...s, finance: { ...s.finance, mrrHistory: [1_000, 1_200] } })
    expect(good.derived.round!.pitchOptions!.find((o) => o.pitch === 'metrics')!.delta).toBe(B.PITCH_METRICS_GOOD)

    const st = api.applyAction(s, { type: 'roundPitch', pitch: 'story' })
    expect(st.state.founder.energy).toBeCloseTo(s.founder.energy - B.PITCH_STORY_ENERGY, 6)
    // "Hikâye anlat" is a gamble inside the previewed range.
    const so = s.derived.round!.pitchOptions!.find((o) => o.pitch === 'story')!
    expect(st.state.round!.pitchBonus!).toBeGreaterThanOrEqual(so.min! - 1e-9)
    expect(st.state.round!.pitchBonus!).toBeLessThanOrEqual(so.max! + 1e-9)
    expect(api.applyAction({ ...s, founder: { ...s.founder, energy: 1 } }, { type: 'roundPitch', pitch: 'story' }).error).toBe('noEnergy')

    const co = api.applyAction(s, { type: 'roundPitch', pitch: 'coinvestor' })
    expect(co.state.round!.weeksLeft).toBe(s.round!.weeksLeft - B.PITCH_COINVESTOR_WEEKS)
    expect(co.state.round!.offer.equity).toBeCloseTo(s.round!.offer.equity + B.PITCH_COINVESTOR_EQUITY, 9)

    s = api.step(s, 7)
    expect(s.round!.pitchDue).toBe(2)
  })

  it('no pitch outside a round; the close pays the live offer and moves on', () => {
    expect(api.applyAction(launched(10), { type: 'roundPitch', pitch: 'metrics' }).error).toBe('roundNotReady')
    const s = running()
    const cash0 = s.stats.cash
    const end = api.step(s, 6 * 7 + 1)
    expect(end.round).toBeUndefined()
    expect(end.stage).toBe(1)
    const closed = end.events.find((e) => e.kind === 'roundClosed')!
    expect(closed.value!).toBeGreaterThan(0)
    expect(end.stats.cash).toBeGreaterThan(cash0)
  })

  it('a round from an older save (no live fields) still runs and closes', () => {
    const s = running()
    const old: GameState = {
      ...s,
      round: { active: true, targetStage: 1, startedDay: s.time.day, weeksTotal: 2, weeksLeft: 2, offer: { amount: 150_000, equity: 0.1, preMoney: 1_350_000 }, baseValuation: s.finance.valuation },
    }
    let n = api.step(old, 7)
    expect(n.round!.baseAmount).toBe(150_000)
    expect(n.round!.pitchDue).toBe(1)
    n = api.step(n, 8)
    expect(n.stage).toBe(1)
  })

  it('the bridge loan card still comes when cash runs out mid-round', () => {
    const bridge = createEngine(fakeContent({ decisions: [fakeCard(B.BRIDGE_CARD_ID, { category: 'crisis' })] }))
    let s = running()
    s = { ...s, stats: { ...s.stats, cash: -50_000 } }
    s = bridge.step(s, 1)
    expect(s.decisions.active?.cardId === B.BRIDGE_CARD_ID || s.decisions.queue.includes(B.BRIDGE_CARD_ID)).toBe(true)
  })
})

describe('a round can fail (GAMEPLAY V2 §6.3)', () => {
  /** A garage round started with morale met and a 3-month MoM above the ask (both on the investor's checklist). */
  function strong(): GameState {
    const base = launched(usersFor(450_000))
    const s0 = refresh({ ...base, stats: { ...base.stats, morale: 70 }, employees: base.employees.map((e) => ({ ...e, morale: 70 })), finance: { ...base.finance, mrrHistory: [1_000, 1_200] } })
    const s = api.applyAction(s0, { type: 'startRound' }).state
    return { ...s, round: { ...s.round!, weeksTotal: 10, weeksLeft: 10 } }
  }
  /** Morale and MoM broken (kept down every week: morale drifts back toward its target). */
  const broken = (s: GameState): GameState => ({
    ...s,
    stats: { ...s.stats, morale: 40 },
    employees: s.employees.map((e) => ({ ...e, morale: 40 })),
    finance: { ...s.finance, mrrHistory: [1_200, 1_000] },
  })

  it('morale and MoM met at the start break for 3 weeks → roundFailed; the stage stays, 14 days shut, the down round opens', () => {
    let s = strong()
    const met = s.round!.ddStart!
    expect(met).toContain('morale')
    expect(met).toContain('growth')
    const rep = s.stats.reputation
    for (let w = 1; w <= 2; w++) {
      s = api.step(broken(s), 7)
      expect(s.round!.strikes).toBe(w)
      expect(s.derived.round!.risk).toBeCloseTo(w / B.ROUND_FAIL_STRIKES, 9)
    }
    s = api.step(broken(s), 7)
    expect(s.round).toBeUndefined()
    expect(s.stage).toBe(0)
    expect(s.events.some((e) => e.kind === 'roundFailed' && e.value === 1)).toBe(true)
    expect(s.events.some((e) => e.kind === 'roundClosed')).toBe(false)
    expect(s.stats.reputation).toBeCloseTo(Math.max(0, rep + B.ROUND_FAIL_REPUTATION), 6)
    expect(s.flags['roundFailedDay']).toBeCloseTo(21, 0)
    // The door is shut for ROUND_RETRY_DAYS, the down round shows as the way out.
    expect(s.derived.canStartRound).toBe(false)
    expect(s.derived.round!.downRound).toBe(true)
    expect(s.derived.round!.retryIn).toBe(B.ROUND_RETRY_DAYS)
    expect(api.applyAction(s, { type: 'startRound' }).error).toBe('roundNotReady')
    expect(api.applyAction(s, { type: 'startRound', down: true }).error).toBe('roundNotReady')
    // The view carries the down round's terms per size (the UI draws, never computes).
    for (const o of s.derived.round!.sizes!) {
      expect(o.down!.amount).toBeCloseTo(o.amount * B.DOWN_ROUND_AMOUNT, 6)
      expect(o.down!.equity).toBeCloseTo(Math.min(B.ROUND_EQUITY_MAX, o.equity * B.DOWN_ROUND_EQUITY), 9)
      expect(o.down!.offer).toBeGreaterThan(0)
    }
    s = api.step(s, B.ROUND_RETRY_DAYS)
    expect(s.derived.round!.retryIn).toBeUndefined()
    const normal = api.applyAction(s, { type: 'startRound' }).state
    const down = api.applyAction(s, { type: 'startRound', down: true })
    expect(down.ok).toBe(true)
    expect(down.state.round!.down).toBe(true)
    expect(down.state.round!.offer.equity).toBeCloseTo(Math.min(B.ROUND_EQUITY_MAX, normal.round!.offer.equity * B.DOWN_ROUND_EQUITY), 9)
    expect(down.state.round!.baseAmount).toBeCloseTo(normal.round!.baseAmount! * B.DOWN_ROUND_AMOUNT, 6)
    expect(down.state.derived.round!.downRound).toBe(true)
    // One-time: the stage's down round is used.
    const after = { ...down.state, round: undefined }
    expect(api.applyAction(refresh(after), { type: 'startRound', down: true }).error).toBe('roundNotReady')
  })

  it('a check unmet at the start never strikes; one broken check strikes, a clean week takes one back', () => {
    let s = strong()
    // Runway / growth / morale unmet from the start do not count; only what broke since does.
    s = { ...s, round: { ...s.round!, ddStart: [] } }
    for (let w = 0; w < 3; w++) s = api.step(broken(s), 7)
    expect(s.round!.active).toBe(true)
    expect(s.round!.strikes).toBe(0)
    // Only morale broken (growth back above the ask): one strike.
    s = { ...s, round: { ...s.round!, ddStart: ['morale', 'growth'], strikes: 1 } }
    s = api.step({ ...broken(s), finance: { ...s.finance, mrrHistory: [1_000, 1_200] } }, 7)
    expect(s.round!.strikes).toBe(2)
    // Nothing broken: one back.
    const healthy = (x: GameState): GameState => ({ ...x, stats: { ...x.stats, morale: 70 }, employees: x.employees.map((e) => ({ ...e, morale: 70 })), finance: { ...x.finance, mrrHistory: [1_000, 1_200] } })
    s = api.step(healthy(s), 7)
    expect(s.round!.strikes).toBe(1)
  })

  it('from week 4 a metrics part on the floor fails the round (not before); a down round has no floor', () => {
    const early = launched(usersFor(target * 0.65))
    const weak = (s: GameState): GameState => ({ ...s, stats: { ...s.stats, cash: 200, morale: 40 }, employees: s.employees.map((e) => ({ ...e, morale: 40 })) })
    let s = api.applyAction(refresh(weak(early)), { type: 'startRound' }).state
    s = { ...s, round: { ...s.round!, weeksTotal: 10, weeksLeft: 10 } }
    for (let w = 1; w <= 3; w++) {
      s = api.step(weak(s), 7)
      expect(s.round?.active).toBe(true)
    }
    expect(s.derived.round!.factor - s.derived.round!.pitchBonus).toBeLessThanOrEqual(B.ROUND_OFFER_FLOOR + 1e-9)
    s = api.step(weak(s), 7)
    expect(s.round).toBeUndefined()
    expect(s.events.some((e) => e.kind === 'roundFailed')).toBe(true)
    // A down round on the same numbers runs past week 4 (no floor) and prices below the old floor.
    s = api.step(s, B.ROUND_RETRY_DAYS)
    s = api.applyAction(weak(s), { type: 'startRound', down: true }).state
    s = { ...s, round: { ...s.round!, weeksTotal: 10, weeksLeft: 10 } }
    for (let w = 1; w <= 5; w++) s = api.step(weak(s), 7)
    expect(s.round?.active).toBe(true)
    expect(s.round!.weeksTotal - s.round!.weeksLeft).toBe(5)
    expect(offerFactor(0.6, dd([false, false, false]), 0)).toBe(B.ROUND_OFFER_FLOOR)
    expect(offerFactor(0.6, dd([false, false, false]), 0, 0)).toBeLessThan(B.ROUND_OFFER_FLOOR)
  })

  it('the close pays the loan balance off first', () => {
    const s = running()
    const loan = { principal: 20_000, balance: 12_000, rateMonthly: 0.02, monthsLeft: 6, covenantRunway: 1, covenantFromDay: 999, interestOnlyUntil: 999, breaches: 0 }
    const cash0 = s.stats.cash
    const end = api.step({ ...s, finance: { ...s.finance, loan, debt: loan.balance } }, 6 * 7 + 1)
    expect(end.stage).toBe(1)
    expect(end.finance.loan).toBeUndefined()
    expect(end.finance.debt).toBe(0)
    const amount = end.events.find((e) => e.kind === 'roundClosed')!.value!
    expect(end.events.some((e) => e.kind === 'loanRepaid')).toBe(true)
    expect(end.stats.cash).toBeLessThan(cash0 + amount - 12_000 + 1)
  })

  function running(users = usersFor(450_000)): GameState {
    const s = api.applyAction(launched(users), { type: 'startRound' }).state
    return { ...s, round: { ...s.round!, weeksTotal: 6, weeksLeft: 6 } }
  }
})

describe('"Elle kullanıcı bul" saturation (dont-scale)', () => {
  const findOnce = (s: GameState): GameState => {
    const r = api.applyAction(s, { type: 'founderAction', kind: 'findUsers' })
    expect(r.ok).toBe(true)
    return api.step({ ...r.state, founder: { ...r.state.founder, energy: 100 } }, B.FOUNDER_ACTION_DEFS.findUsers.durationDays + B.FOUNDER_ACTION_DEFS.findUsers.cooldownDays)
  }

  it('the month’s first 3 finds are full, then the return halves; a new month resets it', () => {
    let s = api.createGame({ seed: 3 })
    expect(findUsersPreview(s)).toMatchObject({ min: B.FIND_USERS_MIN, max: B.FIND_USERS_MAX, fullLeft: 3, factor: 1, reasons: [] })
    for (let i = 0; i < B.FIND_USERS_FULL_PER_MONTH; i++) {
      const before = s.stats.users
      s = findOnce(s)
      const got = s.stats.users - before
      expect(got).toBeGreaterThanOrEqual(B.FIND_USERS_MIN - 1)
    }
    const p = s.derived.findUsers!
    expect(p.fullLeft).toBe(0)
    expect(p.factor).toBe(B.FIND_USERS_SATURATION)
    expect(p.reasons).toEqual(['circle'])
    expect(p.max).toBeLessThan(B.FIND_USERS_MAX)
    // The halved find really returns less (users only rise by found users in an empty garage; allow churn noise).
    const before = s.stats.users
    s = findOnce(s)
    expect(s.stats.users - before).toBeLessThanOrEqual(p.max + 0.5)
    // Month end resets the circle.
    s = api.step(s, 30 - (s.time.day % 30) + 0.5)
    expect(s.derived.findUsers!.fullLeft).toBe(B.FIND_USERS_FULL_PER_MONTH)
    expect(s.derived.findUsers!.factor).toBe(1)
  })

  it('over 100 users every find returns half', () => {
    const s = refresh({ ...api.createGame({ seed: 1 }), stats: { ...api.createGame({ seed: 1 }).stats, users: B.FIND_USERS_BIG_AT + 1 } })
    expect(s.derived.findUsers!.factor).toBe(B.FIND_USERS_BIG_FACTOR)
    expect(s.derived.findUsers!.reasons).toEqual(['big'])
  })

  it('is deterministic: same seed, same finds', () => {
    const a = findOnce(findOnce(api.createGame({ seed: 9 })))
    const b = findOnce(findOnce(api.createGame({ seed: 9 })))
    expect(a.stats.users).toBe(b.stats.users)
  })
})
