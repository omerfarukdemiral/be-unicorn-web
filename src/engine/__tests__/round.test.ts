// Core loop, phase 2 (docs/CORE_LOOP.md §4.3, §5): the live round window (early start at 60%, size choice,
// due diligence, weekly live offer + pitch, bridge loan kept) and "Elle kullanıcı bul" saturation.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { findUsersPreview } from '../founder'
import { createEngine } from '../index'
import { diligenceFactor, offerFactor, priceRatio, roundAmountFor, roundEquityFor } from '../round'
import type { DiligenceItem, GameState } from '../types'
import { fakeCard, fakeContent } from './fixtures'

const api = createEngine(fakeContent())

/** Recompute derived numbers without advancing time. */
const refresh = (s: GameState): GameState => api.applyAction(s, { type: 'setSpeed', speed: 0 }).state

/** Garage with one engineer and a launched MVP: pre-revenue valuation = 60K + 200K + users × 150. */
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

/** Users that put the garage valuation at `v`. */
const usersFor = (v: number) => Math.ceil((v - B.VAL_PER_TEAM - B.VAL_PER_LAUNCHED) / B.VAL_PER_USER)

const dd = (met: boolean[]): DiligenceItem[] => met.map((m, i) => ({ id: (['runway', 'growth', 'morale'] as const)[i]!, target: 1, value: 1, met: m }))

describe('round window (erken tur penceresi)', () => {
  const target = B.STAGE_TARGET_VALUATION[1]!

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

describe('round size (12 / 18 / 24 months ↔ equity)', () => {
  it('more months = more money and more equity; the amount follows the new burn inside the table band', () => {
    const s = launched(usersFor(400_000))
    const sizes = s.derived.round!.sizes!
    expect(sizes.map((x) => x.months)).toEqual([12, 18, 24])
    expect(sizes[0]!.equity).toBeLessThan(sizes[1]!.equity)
    expect(sizes[1]!.equity).toBeLessThan(sizes[2]!.equity)
    expect(sizes[1]!.equity).toBeCloseTo(B.ROUND_EQUITY[1]!, 6)
    for (const o of sizes) {
      expect(o.amount).toBeGreaterThanOrEqual(B.ROUND_AMOUNT[1]! * B.ROUND_AMOUNT_TABLE_MIN)
      expect(o.amount).toBeLessThanOrEqual(B.ROUND_AMOUNT[1]! * B.ROUND_AMOUNT_TABLE_MAX)
    }
    // A bigger burn buys a bigger round (until the table cap).
    const low = { ...s, finance: { ...s.finance, burn: 1_000 } }
    const high = { ...s, finance: { ...s.finance, burn: 4_000 } }
    expect(roundAmountFor(high, 1, 12)).toBeGreaterThan(roundAmountFor(low, 1, 12))
    expect(roundAmountFor(low, 1, 12)).toBe(B.ROUND_AMOUNT[1]! * B.ROUND_AMOUNT_TABLE_MIN)
    expect(roundAmountFor({ ...s, finance: { ...s.finance, burn: 1e9 } }, 1, 24)).toBe(B.ROUND_AMOUNT[1]! * B.ROUND_AMOUNT_TABLE_MAX)
  })

  it('startRound takes the size; the round remembers months and equity (☆ discounts still apply)', () => {
    const s = launched(usersFor(450_000))
    const r = api.applyAction(s, { type: 'startRound', size: 'large' })
    expect(r.ok).toBe(true)
    expect(r.state.round!.size).toBe('large')
    expect(r.state.round!.months).toBe(24)
    expect(r.state.round!.offer.equity).toBeCloseTo(roundEquityFor(1, 'large', 0), 6)
    expect(api.applyAction(s, { type: 'startRound', size: 'huge' as never }).error).toBe('invalid')
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
    expect(offerFactor(1, dd([true, true, false]), 1)).toBeCloseTo(1.0, 9)
    expect(offerFactor(0.6, dd([false, false, false]), 1)).toBe(B.ROUND_OFFER_FLOOR)
    expect(offerFactor(1.2, dd([true, true, true]), 1.2)).toBe(B.ROUND_OFFER_CEIL)
  })

  it('the round carries the investor’s checklist with live values', () => {
    const s = api.applyAction(launched(usersFor(450_000)), { type: 'startRound' }).state
    const ids = s.round!.diligence!.map((d) => d.id)
    expect(ids).toEqual(['runway', 'growth', 'morale'])
    const morale = s.round!.diligence!.find((d) => d.id === 'morale')!
    expect(morale.target).toBe(B.DILIGENCE_MORALE)
    expect(morale.met).toBe(true)
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
    expect(st.state.round!.pitchFactor!).toBeGreaterThan(1)
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
