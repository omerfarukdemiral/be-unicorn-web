// GAMEPLAY V2 §8.3 board quarter (target, hit / miss, the cap penalty and its card), §8.2 the 'acquired' sub-ending.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../content/index'
import { runStatus, submissionOf } from '../../net/cloud'
import * as B from '../balance'
import { recomputeDerived } from '../derive'
import { createEngine } from '../index'
import { growthAsk, enterStage } from '../round'
import { migrate } from '../save'
import type { EnterpriseCustomer, GameState } from '../types'
import { boardTarget } from '../world'
import { fakeCard, fakeContent } from './fixtures'

const REVIEW = fakeCard(B.BOARD_REVIEW_CARD_ID, { category: 'crisis', condition: () => false, once: false })
const SALE = fakeCard('sale', {
  stage: 5,
  options: [
    { label: 'sat', tradeoff: { gain: 'g', cost: 'c' }, effects: { setFlag: B.ACQUIRED_FLAG }, reflection: 'r' },
    { label: 'kal', tradeoff: { gain: 'g', cost: 'c' }, effects: { morale: 1 }, reflection: 'r' },
  ],
})
const content = fakeContent({ decisions: [REVIEW, SALE] })
const api = createEngine(content)

/** An open-ended contract: the company's whole MRR, so the quarter is decided by what the test adds. */
const contract = (id: string, mrr: number): EnterpriseCustomer => ({ id, name: id, mrr, sinceDay: 0 })

/** A company walked up to Series A on `mrr` (one open-ended contract, plenty of cash): the board's first quarter starts. */
function atA(mrr = 10_000): GameState {
  let s = api.createGame({ seed: 1 })
  enterStage(s, 1)
  enterStage(s, 2)
  s = { ...s, stats: { ...s.stats, cash: 50_000_000 }, finance: { ...s.finance, enterpriseCustomers: [contract('base', mrr)] } }
  s = api.step(s, 0.25)
  enterStage(s, 3)
  return api.step(s, 0.25)
}

/** Steps to the day the running quarter ends (the daily check of that day included). */
const toQuarterEnd = (s: GameState): GameState => api.step(s, s.board!.quarterStart + B.BOARD_QUARTER_DAYS - s.time.day + 0.25)

const events = (s: GameState, kind: string) => s.events.filter((e) => e.kind === kind)

describe('board quarter (§8.3)', () => {
  it('starts on arriving at Series A: target = MRR × (1 + ask)^3, checked 90 days later', () => {
    const before = api.createGame({ seed: 1 })
    expect(before.board).toBeUndefined()
    expect(before.derived.board).toBeUndefined()
    const s = atA()
    const b = s.board!
    expect(b.quarterStart).toBe(Math.floor(s.time.day))
    expect(b.targetMrr).toBe(boardTarget(s.finance.mrr, growthAsk(s)))
    expect(b.targetMrr).toBeCloseTo(s.finance.mrr * (1 + B.DILIGENCE_MOM[3]!) ** 3, -1)
    expect(s.unlockedTools).toContain('renewal')
    // The horizon shows the known exam: "Kurul $X · 23g".
    expect(s.derived.board).toMatchObject({ targetMrr: b.targetMrr, endDay: b.quarterStart + B.BOARD_QUARTER_DAYS, penalty: false })
    expect(s.derived.horizon!.find((h) => h.kind === 'board')).toMatchObject({ day: b.quarterStart + B.BOARD_QUARTER_DAYS, amount: b.targetMrr })
    // Day 89 of the quarter: nothing yet; day 90: flat MRR missed it, and the next quarter starts on today's MRR.
    const early = api.step(s, B.BOARD_QUARTER_DAYS - 1)
    expect(events(early, 'boardMissed')).toHaveLength(0)
    const end = toQuarterEnd(s)
    expect(events(end, 'boardMissed')).toHaveLength(1)
    expect(end.board).toMatchObject({ missed: 1, streak: 0, misses: 1 })
    expect(end.board!.quarterStart).toBe(b.quarterStart + B.BOARD_QUARTER_DAYS)
    expect(end.flags[B.BOARD_PENALTY_FLAG]).toBeUndefined()
    // After a miss the board revises its plan: the next quarter asks BOARD_REVISED_ASK of the growth ask.
    expect(end.board!.targetMrr).toBe(boardTarget(end.finance.mrr, growthAsk(end) * B.BOARD_REVISED_ASK))
  })

  it('two misses in a row: boardCapPenalty (multiple × 0.8) and the board-review card; a hit lifts it', () => {
    let s = toQuarterEnd(toQuarterEnd(atA()))
    expect(events(s, 'boardMissed')).toHaveLength(2)
    expect(s.board!.missed).toBe(2)
    expect(s.flags[B.BOARD_PENALTY_FLAG]).toBe(true)
    expect(s.derived.board!.penalty).toBe(true)
    // The card takes the next slot (queued, shown the same day: a crisis card off the shared card budget).
    expect(s.decisions.active?.cardId).toBe(B.BOARD_REVIEW_CARD_ID)
    // The multiple's penalty part is × BOARD_CAP_PENALTY against the same state without the flag.
    const free = structuredClone(s)
    delete free.flags[B.BOARD_PENALTY_FLAG]
    recomputeDerived(free, content)
    expect(s.derived.valuationParts!.penalty / free.derived.valuationParts!.penalty).toBeCloseTo(B.BOARD_CAP_PENALTY, 6)
    // A third miss keeps the penalty without a second card.
    s = api.applyAction(s, { type: 'answerDecision', cardId: B.BOARD_REVIEW_CARD_ID, optionIndex: 1 }).state
    s = toQuarterEnd(s)
    expect(s.board!.missed).toBe(3)
    expect(s.decisions.active?.cardId).not.toBe(B.BOARD_REVIEW_CARD_ID)
    // Hit: MRR well past the target lifts the penalty, +reputation, one round-equity credit.
    const rep = s.stats.reputation
    s = api.step({ ...s, finance: { ...s.finance, enterpriseCustomers: [...s.finance.enterpriseCustomers, contract('whale', 50_000)] } }, 0.25)
    const credit = s.derived.round!.sizes!.find((x) => x.size === 'target')!.equity
    s = toQuarterEnd(s)
    expect(events(s, 'boardHit')).toHaveLength(1)
    expect(s.board).toMatchObject({ missed: 0, streak: 1, hits: 1, credit: 1 })
    expect(s.flags[B.BOARD_PENALTY_FLAG]).toBeUndefined()
    expect(s.stats.reputation).toBeCloseTo(Math.min(100, rep + B.BOARD_HIT_REPUTATION), 6)
    // The next round sells BOARD_HIT_EQUITY less.
    expect(s.derived.round!.sizes!.find((x) => x.size === 'target')!.equity).toBeCloseTo(credit - B.BOARD_HIT_EQUITY, 6)
  })

  it('no board before Series A; an older save from A on opens with its quarter (migration and lazily)', () => {
    const seed = api.step(api.createGame({ seed: 1 }), 30)
    expect(seed.board).toBeUndefined()
    const a = atA()
    const old = structuredClone(a) as GameState
    delete old.board
    old.unlockedTools = old.unlockedTools.filter((t) => t !== 'renewal')
    old.meta.saveVersion = 3
    const migrated = migrate({ version: 3, state: structuredClone(old) })!
    expect(migrated.board).toMatchObject({ quarterStart: Math.floor(a.time.day), missed: 0, streak: 0 })
    expect(migrated.board!.targetMrr).toBe(boardTarget(a.finance.mrr, B.DILIGENCE_MOM[3]!))
    expect(migrated.unlockedTools).toContain('renewal')
    // A v4 save written before the board: the first daily starts it.
    const lazy = api.step({ ...old, meta: { ...old.meta, saveVersion: 4 } }, 1)
    expect(lazy.board).toBeDefined()
    expect(lazy.unlockedTools).toContain('renewal')
  })
})

describe("'acquired' sub-ending (§8.2)", () => {
  it('the sale ends the run with the click: kind acquired, stage XP, time stopped', () => {
    let s = atA()
    s = { ...s, stage: 5, decisions: { ...s.decisions, queue: ['sale'] } }
    s = api.step(s, 1)
    expect(s.decisions.active?.cardId).toBe('sale')
    const r = api.applyAction(s, { type: 'answerDecision', cardId: 'sale', optionIndex: 0 })
    expect(r.ok).toBe(true)
    expect(r.state.gameOver).toMatchObject({ kind: 'acquired', xpEarned: B.XP_PER_STAGE * 6 })
    expect(r.state.time.speed).toBe(0)
    expect(r.state.flags[B.ACQUIRED_FLAG]).toBeUndefined()
    // Declining leaves the run going.
    expect(api.applyAction(s, { type: 'answerDecision', cardId: 'sale', optionIndex: 1 }).state.gameOver).toBeUndefined()
  })

  it('never goes to the leaderboard: runStatus is null (the last playing row stays)', () => {
    const playing = atA()
    expect(runStatus(playing)).toBe('playing')
    const sold: GameState = { ...playing, gameOver: { kind: 'acquired', day: playing.time.day, reasons: [], xpEarned: 6 } }
    expect(runStatus(sold)).toBeNull()
    expect(runStatus({ ...playing, gameOver: { kind: 'bankrupt', day: 1, reasons: [], xpEarned: 1 } })).toBe('bankrupt')
    // The body itself never claims a bankruptcy for a sale.
    expect(submissionOf(sold).status).toBe('playing')
  })

  it('the real offer: only with a strong rival, the sale is never the default, a good answer is still there', () => {
    const card = CONTENT.decisions.find((c) => c.id === 'acquisition-offer')!
    const sale = card.options.findIndex((o) => o.effects.setFlag === B.ACQUIRED_FLAG)
    expect(sale).toBeGreaterThanOrEqual(0)
    expect(card.options[sale]!.label.split(/\s+/).length).toBeLessThanOrEqual(5)
    expect(card.defaultOption ?? card.options.length - 1).not.toBe(sale)
    // Appended last: old saves' answers (0 sit down, 1 close the door) keep their meaning.
    expect(sale).toBe(card.options.length - 1)
    expect(card.options[1]!.effects.setFlag).toBeUndefined()
    const s = atA()
    const rival = { id: 'r', name: 'R', bornDay: 0, strength: 0.5, share: 0.1, mrr: 1, valuation: 1, momentum: 0 as const }
    expect(card.condition!({ ...s, rivals: [rival] })).toBe(false)
    expect(card.condition!({ ...s, rivals: [{ ...rival, strength: 0.75 }] })).toBe(true)
    expect(card.condition!({ ...s, rivals: [{ ...rival, strength: 0.75, acquiredDay: 1 }] })).toBe(false)
  })
})
