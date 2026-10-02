// GAMEPLAY V2 §8.1–8.2: the finite market (segments, ramp, upkeep, saturation) and buying a rival.
import { describe, expect, it } from 'vitest'
import { MARKET_SEGMENTS } from '../../content/markets'
import { SECRET_CARDS, THREAD_CARDS } from '../../content/threads'
import * as B from '../balance'
import * as E from '../economy'
import { createEngine, rivalNotch } from '../index'
import { enterStage, pushStageReport } from '../round'
import { migrate } from '../save'
import { MARKET_SEGMENT_IDS, type GameState, type Rival, type StageIndex } from '../types'
import { fakeContent } from './fixtures'

const api = createEngine(fakeContent())
/** Users a segment adds = content size × MARKET_SIZE_SCALE (interim knob, balance.ts). */
const S = B.MARKET_SIZE_SCALE

/** A fresh company walked up to `stage` (each arrival unlocks its tools and opens its automatic segments). */
function at(stage: StageIndex, cash = 50_000_000): GameState {
  let s = api.createGame({ seed: 1 })
  for (let i = 1; i <= stage; i++) enterStage(s, i as StageIndex)
  s = { ...s, stats: { ...s.stats, cash } }
  return api.step(s, 0.25)
}

const open = (s: GameState, id: (typeof MARKET_SEGMENT_IDS)[number]) => api.applyAction(s, { type: 'openSegment', id })

describe('segments (§8.1)', () => {
  it('Σ size up to each stage matches the formula (±25%): target valuation / (12 × top multiple × ARPU) / 0.7 × 1.15', () => {
    // The garage is valued before revenue (no multiple on MRR): the formula starts at Pre-seed.
    for (let stage = 1; stage <= 5; stage++) {
      const sum = MARKET_SEGMENTS.filter((m) => m.stage <= stage).reduce((a, m) => a + m.size, 0)
      const arpu = B.ARPU_BASE * B.ARPU_STAGE_GROWTH ** stage
      const want = (B.STAGE_TARGET_VALUATION[stage + 1]! / (12 * B.MULTIPLE_MAX_BY_STAGE[stage]! * arpu) / 0.7) * 1.15
      expect(sum / want, `stage ${stage}: ${sum} vs ${Math.round(want)}`).toBeGreaterThanOrEqual(0.75)
      expect(sum / want, `stage ${stage}: ${sum} vs ${Math.round(want)}`).toBeLessThanOrEqual(1.25)
    }
    expect(MARKET_SEGMENTS.map((m) => m.id)).toEqual([...MARKET_SEGMENT_IDS])
  })

  it('the garage starts with early adopters; Seed opens smb by itself and it ramps in over 60 days', () => {
    const g = api.createGame({ seed: 1 })
    expect(g.derived.tam).toBe(2_000 * S)
    let s = at(2)
    expect(s.market!.segments.map((m) => m.id)).toEqual(['early', 'smb'])
    expect(s.derived.tam! - 2_000 * S).toBeLessThan(100 * S)
    s = api.step(s, B.MARKET_RAMP_DAYS / 2)
    expect(s.derived.tam).toBeCloseTo((2_000 + 14_000 * E.segmentRamp(0, s.time.day)) * S)
    expect(E.segmentRamp(0, s.time.day)).toBeCloseTo(0.5, 1)
    s = api.step(s, B.MARKET_RAMP_DAYS)
    expect(s.derived.tam).toBe(16_000 * S)
    expect(s.derived.penetration).toBeCloseTo(E.penetration(s.stats.users, 16_000 * S))
  })

  it('openSegment: locked before its stage and its conditions; one move, the cost now, the upkeep on the receipt', () => {
    expect(open(at(2), 'midmarket').error).toBe('notUnlocked')
    expect(open(at(3), 'enterprise').error).toBe('notUnlocked')
    expect(open(at(3), 'smb').error).toBe('invalid')
    // An automatic segment not open yet waits for its stage: the action and the map say the same.
    const garage = api.createGame({ seed: 1 })
    expect(open(garage, 'smb').error).toBe('notUnlocked')
    expect(garage.derived.market!.segments.find((x) => x.id === 'smb')!.error).toBe('notUnlocked')
    expect(open(at(3, 1_000), 'midmarket').error).toBe('insufficientCash')
    // Global asks for three ops people (compliance).
    expect(open(at(5), 'global').error).toBe('notUnlocked')
    const noMoves = at(3)
    expect(open({ ...noMoves, founder: { ...noMoves.founder, moves: { left: 0, weekStart: 0 } } }, 'midmarket').error).toBe('noMoves')

    const s0 = at(3)
    const r = open(s0, 'midmarket')
    expect(r.ok).toBe(true)
    let s = r.state
    expect(s.stats.cash).toBeCloseTo(s0.stats.cash - 250_000, -1)
    expect(s.founder.moves!.left).toBe(s0.founder.moves!.left - B.MOVE_COST.openSegment)
    expect(s.finance.burnBreakdown.expansion).toBe(8_000)
    expect(s.finance.burn - s0.finance.burn).toBeCloseTo(8_000, 0)
    expect(s.events.some((e) => e.kind === 'segmentOpened' && e.refId === 'midmarket')).toBe(true)
    expect(open(s, 'midmarket').error).toBe('invalid')
    expect(s.derived.market!.segments.find((x) => x.id === 'midmarket')).toMatchObject({ open: true, error: 'invalid' })
    expect(s.derived.market!.segments.find((x) => x.id === 'midmarket')!.ramp).toBeLessThan(0.01)
    // Ramp: half way after 30 days, all of it after 60 (and never closed again).
    const ramp = () => s.derived.market!.segments.find((x) => x.id === 'midmarket')!.ramp
    s = api.step(s, 30)
    expect(ramp()).toBeCloseTo(0.5, 1)
    expect(s.derived.tam).toBeCloseTo(E.marketTam(s.market!.segments, s.time.day))
    s = api.step(s, 31)
    expect(ramp()).toBe(1)
    expect(s.derived.tam).toBe((2_000 + 14_000 + 68_000) * S)
    // The payday receipt carries the upkeep line ("Pazar") and the month paid it.
    const receipt = s.finance.lastReceipt!
    expect(receipt.expansion).toBeCloseTo(8_000, -1)
    expect(s.finance.receipts!.at(-1)).toMatchObject({ expansion: 8_000 })
  })

  it('one segment, ads doubled: paid users grow by less than half (spend saturation)', () => {
    const base = at(3)
    const users = Math.round(base.derived.tam! * 0.3)
    const mk = (ads: number) => api.step({ ...base, stats: { ...base.stats, users }, finance: { ...base.finance, adBudget: ads } }, 0.25)
    const s1 = mk(50_000)
    const mrr = s1.finance.mrr
    const a = mk(Math.max(mrr, B.CAC_SPEND_FLOOR[3]!)).derived.channels.paid
    const b = mk(2 * Math.max(mrr, B.CAC_SPEND_FLOOR[3]!)).derived.channels.paid
    expect(b).toBeGreaterThan(a)
    expect(b / a - 1).toBeLessThan(0.5)
  })

  it("horizon: 'saturation' once the market is 70% full", () => {
    const s = at(3)
    const tam = s.derived.tam!
    const low = api.step({ ...s, stats: { ...s.stats, users: Math.round(tam * 0.5) } }, 0.25)
    expect(low.derived.horizon!.some((h) => h.kind === 'saturation')).toBe(false)
    const full = api.step({ ...s, stats: { ...s.stats, users: Math.round(tam * 0.8) } }, 0.25)
    expect(full.derived.horizon!.some((h) => h.kind === 'saturation')).toBe(true)
  })
})

describe('save (§3.1): the market by stage', () => {
  it('a v3 save opens the automatic segments and those of the stages it has left, fully ramped; tam from them', () => {
    const s = at(4)
    const v3 = structuredClone(s) as unknown as Record<string, unknown>
    delete v3.market
    const out = migrate({ version: 3, state: v3 })!
    expect(out.market!.segments.map((m) => m.id)).toEqual(['early', 'smb', 'midmarket'])
    expect(out.market!.segments.every((m) => m.upkeep === 0)).toBe(true)
    const stepped = api.step(out, 0.25)
    expect(stepped.derived.tam).toBe((2_000 + 14_000 + 68_000) * S)
    // A state without a market (older runtime state) defaults the same way, lazily.
    const lazy = api.step({ ...s, market: undefined } as GameState, 0.25)
    expect(lazy.derived.tam).toBe((2_000 + 14_000 + 68_000) * S)
  })

  it("a save from before the market verbs gets the tools of the stages it reached ('segments' from A, 'mna' from B)", () => {
    const strip = (s: GameState) => {
      const old = structuredClone(s) as unknown as Record<string, unknown>
      delete old.market
      old.unlockedTools = s.unlockedTools.filter((t) => !B.MARKET_TOOLS.includes(t))
      return old
    }
    const a = migrate({ version: 3, state: strip(at(3)) })!
    expect(a.unlockedTools).toContain('segments')
    expect(a.unlockedTools).not.toContain('mna')
    expect(open(api.step(a, 0.25), 'midmarket').ok).toBe(true)
    const b = migrate({ version: 3, state: strip(at(4)) })!
    expect(b.unlockedTools).toEqual(expect.arrayContaining(['segments', 'mna']))
    expect(api.applyAction(api.step(b, 0.25), { type: 'acquireRival', id: b.rivals![0]!.id }).error).not.toBe('notUnlocked')
    // Lazily too (a v4 state from before the market).
    const lazy = api.step(strip(at(3)) as unknown as GameState, 0.25)
    expect(lazy.unlockedTools).toContain('segments')
    expect(open(lazy, 'midmarket').ok).toBe(true)
  })
})

describe('acquireRival (§8.2)', () => {
  /** A Series B company whose lead rival makes $200K MRR with 12% of the market. */
  function withRival(cash = 50_000_000): { s: GameState; r: Rival } {
    const s = at(4, cash)
    const r = s.rivals![0]!
    r.mrr = 200_000
    r.share = 0.12
    return { s: api.step(s, 0.25), r }
  }

  it('locked before Series B; price = rival MRR × 12 × multiple × 0.8', () => {
    const a = at(3)
    expect(api.applyAction(a, { type: 'acquireRival', id: a.rivals![0]!.id }).error).toBe('notUnlocked')
    const { s, r } = withRival()
    const view = s.derived.market!.rivals.find((x) => x.id === r.id)!
    expect(view.price).toBe(Math.round(200_000 * 12 * s.derived.valuationMultiple * B.ACQUIRE_PRICE_FACTOR))
    expect(view.users).toBe(Math.round(0.12 * s.derived.tam! * B.ACQUIRE_USERS_SHARE))
    expect(view.error).toBeNull()
    expect(api.applyAction(withRival(1_000).s, { type: 'acquireRival', id: r.id }).error).toBe('insufficientCash')
    expect(api.applyAction(s, { type: 'acquireRival', id: 'nobody' }).error).toBe('notFound')
  })

  it('users come over, share to 0, debt +15, morale −8, production × 0.85 for 60 days, two moves, once', () => {
    const { s, r } = withRival()
    const view = s.derived.market!.rivals.find((x) => x.id === r.id)!
    const res = api.applyAction(s, { type: 'acquireRival', id: r.id })
    expect(res.ok).toBe(true)
    const t = res.state
    expect(t.stats.cash).toBeCloseTo(s.stats.cash - view.price, 0)
    expect(t.stats.users).toBe(s.stats.users + view.users)
    const bought = t.rivals!.find((x) => x.id === r.id)!
    expect(bought.share).toBe(0)
    expect(bought.acquiredDay).toBeDefined()
    expect(t.techDebt).toBe(s.techDebt + B.ACQUIRE_TECH_DEBT)
    expect(t.stats.morale).toBeCloseTo(Math.max(0, s.stats.morale + B.ACQUIRE_MORALE))
    expect(t.modifiers.find((m) => m.source === 'acquireRival')).toMatchObject({ kind: 'production', value: B.ACQUIRE_PRODUCTION, untilDay: s.time.day + B.ACQUIRE_PRODUCTION_DAYS })
    expect(t.founder.moves!.left).toBe(s.founder.moves!.left - B.MOVE_COST.acquireRival)
    expect(t.events.some((e) => e.kind === 'rivalAcquired' && e.refId === r.id)).toBe(true)
    expect(t.derived.market!.rivals.some((x) => x.id === r.id)).toBe(false)
    expect(api.applyAction(t, { type: 'acquireRival', id: r.id }).error).toBe('notFound')
    // Out of the market: a month later it has not won any share back.
    expect(api.step(t, 35).rivals!.find((x) => x.id === r.id)!.share).toBe(0)
  })

  it("the rival thread's prepared offer (flags.rivalBuyIntent) prices it × 0.85, then goes", () => {
    const { s, r } = withRival()
    const plain = s.derived.market!.rivals.find((x) => x.id === r.id)!.price
    const prepared = api.step({ ...s, flags: { ...s.flags, [B.ACQUIRE_INTENT_FLAG]: true } }, 0.25)
    expect(prepared.derived.market!.rivals.find((x) => x.id === r.id)!.price).toBe(Math.round(plain * B.ACQUIRE_INTENT_DISCOUNT))
    const t = api.applyAction(prepared, { type: 'acquireRival', id: r.id }).state
    expect(t.flags[B.ACQUIRE_INTENT_FLAG]).toBeUndefined()
  })

  it('the prepared offer is for the lead only: another rival keeps its price and the offer stays', () => {
    const { s } = withRival()
    const other = s.rivals![1]!
    other.mrr = 100_000
    const prepared = api.step({ ...s, flags: { ...s.flags, [B.ACQUIRE_INTENT_FLAG]: true } }, 0.25)
    const plain = api.step(s, 0.25).derived.market!.rivals.find((x) => x.id === other.id)!.price
    expect(prepared.derived.market!.rivals.find((x) => x.id === other.id)!.price).toBe(plain)
    const t = api.applyAction(prepared, { type: 'acquireRival', id: other.id }).state
    expect(t.flags[B.ACQUIRE_INTENT_FLAG]).toBe(true)
  })

  it("the bought lead closes its thread: the rival cards that need it standing stay shut", () => {
    const { s, r } = withRival()
    const t = api.applyAction(s, { type: 'acquireRival', id: r.id }).state
    t.finance.mrr = r.mrr * 100
    for (const id of ['rival-buys-you', 'rival-ipo-race', 'rival-buy-them', 'rival-dies']) {
      const card = [...THREAD_CARDS, ...SECRET_CARDS].find((c) => c.id === id)!
      expect(card.condition!(t), id).toBe(false)
    }
  })

  it('the bought lead leaves the stage report (rivalRatio 0)', () => {
    const { s, r } = withRival()
    const t = api.applyAction(s, { type: 'acquireRival', id: r.id }).state
    pushStageReport(t, fakeContent())
    expect(t.stageReports!.at(-1)!.rivalRatio).toBe(0)
  })

  it("rival-dies (flags.rivalGone) takes the lead out of the market: no share, no pass, not for sale", () => {
    const { s, r } = withRival()
    const t = api.step({ ...s, flags: { ...s.flags, [B.RIVAL_GONE_FLAG]: true } }, 1)
    const gone = t.rivals!.find((x) => x.id === r.id)!
    expect(gone.goneDay).toBeDefined()
    expect(gone.share).toBe(0)
    expect(t.derived.market!.rivals.some((x) => x.id === r.id)).toBe(false)
    expect(api.applyAction(t, { type: 'acquireRival', id: r.id }).error).toBe('notFound')
    const later = api.step({ ...t, finance: { ...t.finance, mrr: 1 } }, 35)
    expect(later.rivals!.find((x) => x.id === r.id)!.share).toBe(0)
    expect(later.events.some((e) => e.kind === 'rivalPassed' && e.refId === r.id && e.day > t.time.day)).toBe(false)
  })
})

describe('rivalNotch (§9.4 selector)', () => {
  it('sits on the stageProgress scale, on the fill side its colour says, and drops out once the lead is out', () => {
    const s = at(4)
    const target = B.STAGE_TARGET_VALUATION[s.stage + 1]!
    const lead: Rival = { id: 'r1', name: 'Rakip', bornDay: 0, strength: 1, share: 0.1, mrr: 0, valuation: target * 0.9, momentum: 0 }
    const own = s.derived.stageProgress
    const behind = rivalNotch({ ...s, rivals: [{ ...lead, ahead: false }] })!
    expect(behind.ahead).toBe(false)
    expect(behind.at).toBeLessThanOrEqual(own)
    expect(rivalNotch({ ...s, rivals: [{ ...lead, valuation: 0, ahead: true }] })!.at).toBeGreaterThanOrEqual(own)
    expect(rivalNotch({ ...s, rivals: [{ ...lead, valuation: target * 0.3 * own, ahead: false }] })!.at).toBeCloseTo(0.3 * own)
    expect(rivalNotch({ ...s, rivals: [{ ...lead, acquiredDay: 1 }] })).toBeNull()
    expect(rivalNotch({ ...s, rivals: [{ ...lead, goneDay: 1 }] })).toBeNull()
    expect(rivalNotch({ ...s, rivals: [] })).toBeNull()
  })
})
