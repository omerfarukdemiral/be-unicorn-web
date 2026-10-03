// Center screens' data (GAMEPLAY V2 §7.2, §8.1–8.4): the Kanun Kitabı cards, the market tiles, the rival rows and the
// Büyüme rows are the engine's own numbers (derived views, policyError, acquirePrice), only sorted here.
import { describe, expect, it } from 'vitest'
import { acquirePrice, applyAction, createGame, policyError, step, type GameState, type StageIndex } from '../../engine'
import { POLICY_MIN_STAGE, POLICY_SIGN_COOLDOWN_DAYS } from '../../engine/balance'
import { enterStage } from '../../engine/round'
import { CONTENT, POLICIES, STAGES } from '../../content'
import { boardRow, centerSummary, daysLeft, lawbookView, lockedTools, renewalRows, rivalRows, segmentTiles, signBurnDelta } from './centerData'

/** A fresh company walked up to `stage` (each arrival unlocks its tools, opens its segments, brings its rivals). */
function at(stage: StageIndex, cash = 50_000_000): GameState {
  let s = createGame({ seed: 1 })
  for (let i = 1; i <= stage; i++) enterStage(s, i as StageIndex)
  s = { ...s, stats: { ...s.stats, cash } }
  return step(s, 0.25)
}

const book = (s: GameState) => lawbookView(POLICIES, s.derived.policies, (id) => policyError(s, CONTENT, id), s)
const card = (s: GameState, id: string) => book(s).trees.flatMap((g) => g.cards).find((c) => c.id === id)!

describe('Kanun Kitabı (§7.2)', () => {
  it('every policy once, in its tree, tier order; status and error are policyError’s answer', () => {
    const s = at(2)
    const v = book(s)
    expect(v.trees.map((g) => g.tree)).toEqual(['survival', 'growth', 'craft', 'org'])
    expect(v.trees.flatMap((g) => g.cards).map((c) => c.id).sort()).toEqual(POLICIES.map((p) => p.id).sort())
    for (const g of v.trees) expect(g.cards.map((c) => c.tier)).toEqual([...g.cards.map((c) => c.tier)].sort((a, b) => a - b))
    for (const c of v.trees.flatMap((g) => g.cards)) expect(c.error, c.id).toBe(policyError(s, CONTENT, c.id))
    // Rich at Seed: the survival tree stays shut (runway lock), Seed's growth / craft laws are open, A's are not.
    expect(card(s, 'salary-freeze').status).toBe('locked')
    expect(card(s, 'salary-freeze').lock).toEqual({ metric: 'runway', value: 8 })
    expect(card(s, 'salary-freeze').survival).toBe(true)
    expect(card(s, 'hire-fast').status).toBe('open')
    expect(card(s, 'crunch-culture').status).toBe('open')
    expect(card(s, 'ads-first').status).toBe('locked')
    expect(card(s, 'management').status).toBe('locked')
    expect(v.signed).toBe(0)
    expect(v.total).toBe(POLICIES.length)
    expect(v.wait).toEqual({ left: 0, total: POLICY_SIGN_COOLDOWN_DAYS })
  })

  it('a signature: the card is signed for good, the others wait out the cooldown ring; an excluded law is closed', () => {
    let s = at(2)
    const r = applyAction(s, { type: 'adoptPolicy', policyId: 'crunch-culture' })
    expect(r.ok).toBe(true)
    s = r.state
    const v = book(s)
    expect(card(s, 'crunch-culture').status).toBe('signed')
    expect(card(s, 'crunch-culture').error).toBeNull()
    expect(card(s, 'hire-fast').status).toBe('wait')
    expect(card(s, 'quality-gate').status).toBe('closed')
    expect(v.signed).toBe(1)
    expect(v.wait.left).toBe(daysLeft(s.derived.policies!.nextSignDay, s.time.day))
    expect(v.wait.left).toBeGreaterThan(0)
    expect(v.wait.left).toBeLessThanOrEqual(POLICY_SIGN_COOLDOWN_DAYS)
  })

  it('notUnlocked by the book’s gates: the stage pill before POLICY_MIN_STAGE, a deferred-pay law past its window is closed', () => {
    // Garaj, broke: the runway lock holds, but the book itself is shut until POLICY_MIN_STAGE.
    let g = createGame({ seed: 1 })
    g = step({ ...g, stats: { ...g.stats, cash: Math.max(1, g.finance.burn) } }, 0.25)
    expect(policyError(g, CONTENT, 'salary-freeze')).toBe('notUnlocked')
    expect(card(g, 'salary-freeze').status).toBe('locked')
    expect(card(g, 'salary-freeze').lock).toEqual({ metric: 'stage', value: POLICY_MIN_STAGE })
    expect(card(g, 'management').lock.value).toBeGreaterThanOrEqual(POLICY_MIN_STAGE)
    // Series C: no round left to pay the held wages back.
    const c = at(5)
    expect(policyError(c, CONTENT, 'deferred-pay')).toBe('notUnlocked')
    expect(card(c, 'deferred-pay').status).toBe('closed')
    expect(card(c, 'salary-freeze').lock).toEqual({ metric: 'runway', value: 8 })
  })

  it('İmzala’s preview input: the burn after the engine signs on a copy; 0 when it cannot be signed', () => {
    // Short of cash at Pre-seed: the founder's pay is a survival law away.
    let s = at(1, 0)
    s = step({ ...s, stats: { ...s.stats, cash: Math.max(1, s.finance.burn) * 2 } }, 0.25)
    expect(s.finance.runway).not.toBeNull()
    expect(s.finance.runway!).toBeLessThan(5)
    expect(policyError(s, CONTENT, 'founder-no-pay')).toBeNull()
    const delta = signBurnDelta(s, 'founder-no-pay')
    expect(delta).toBeLessThan(0)
    expect(delta).toBeCloseTo(applyAction(s, { type: 'adoptPolicy', policyId: 'founder-no-pay' }).state.finance.burn - s.finance.burn, 6)
    expect(signBurnDelta(s, 'management')).toBe(0)
  })
})

describe('Pazar haritası (§8.1–8.2)', () => {
  it('segment tiles: open / ready / locked from the engine view', () => {
    const s = at(3)
    const tiles = segmentTiles(s.derived.market)
    expect(tiles.map((t) => [t.id, t.status])).toEqual([
      ['early', 'open'],
      ['smb', 'open'],
      ['midmarket', 'ready'],
      ['enterprise', 'locked'],
      ['global', 'locked'],
    ])
    const mid = tiles.find((t) => t.id === 'midmarket')!
    expect(mid.cost).toBe(250_000)
    expect(mid.error).toBeNull()
    // Short of cash: still 'ready' (its stage is here), the button carries the reason.
    const poor = segmentTiles(at(3, 1_000).derived.market).find((t) => t.id === 'midmarket')!
    expect(poor.status).toBe('ready')
    expect(poor.error).toBe('insufficientCash')
    expect(segmentTiles(undefined)).toEqual([])
  })

  it('rival rows: name, share, valuation bar on the player’s scale; the price is acquirePrice, gated before Series B', () => {
    const a = at(3)
    expect((a.rivals ?? []).length).toBeGreaterThan(0)
    const ra = rivalRows(a.derived.market, a.rivals, a.finance.valuation)
    expect(ra.rows.map((r) => r.id)).toEqual(a.derived.market!.rivals.map((r) => r.id))
    expect(ra.rows[0]!.lead).toBe(true)
    for (const r of ra.rows) {
      expect(r.error).toBe('notUnlocked')
      expect(r.bar).toBeGreaterThanOrEqual(0)
      expect(r.bar).toBeLessThanOrEqual(1)
    }
    expect(Math.max(ra.you, ...ra.rows.map((r) => r.bar))).toBeCloseTo(1, 9)

    const b = at(4)
    const rb = rivalRows(b.derived.market, b.rivals, b.finance.valuation)
    for (const r of rb.rows) {
      const rival = b.rivals!.find((x) => x.id === r.id)!
      expect(r.price).toBe(acquirePrice(b, rival))
      expect(r.name).toBe(rival.name)
      expect(r.share).toBe(rival.share)
    }
    // A bought rival leaves the board.
    const first = rb.rows[0]!
    const bought = applyAction(b, { type: 'acquireRival', id: first.id })
    if (bought.ok) expect(rivalRows(bought.state.derived.market, bought.state.rivals, bought.state.finance.valuation).rows.map((r) => r.id)).not.toContain(first.id)
  })
})

describe('Büyüme rows (§10.5, §8.3, §8.4)', () => {
  it('summary: policies signed + days to the next signature, market fill + open segments', () => {
    let s = at(3)
    let sum = centerSummary(s.derived.policies, s.derived.market, s.derived.penetration, s.time.day)
    expect(sum).toEqual({ policies: 0, waitDays: 0, pen: s.derived.penetration, segments: 2 })
    s = applyAction(s, { type: 'adoptPolicy', policyId: 'hire-fast' }).state
    sum = centerSummary(s.derived.policies, s.derived.market, s.derived.penetration, s.time.day)
    expect(sum.policies).toBe(1)
    expect(sum.waitDays).toBe(daysLeft(s.derived.policies!.nextSignDay, s.time.day))
    expect(centerSummary(undefined, undefined, undefined, 0)).toEqual({ policies: 0, waitDays: 0, pen: 0, segments: 0 })
  })

  it('Kurul: the target, days to the quarter end and the MRR bar from derived.board; none before Series A', () => {
    expect(boardRow(at(2).derived.board, 0)).toBeNull()
    const s = at(3)
    const b = s.derived.board!
    const row = boardRow(b, s.time.day)!
    expect(row.target).toBe(b.targetMrr)
    expect(row.days).toBe(daysLeft(b.endDay, s.time.day))
    expect(row.progress).toBeGreaterThanOrEqual(0)
    expect(row.progress).toBeLessThanOrEqual(1)
    expect(boardRow({ ...b, mrr: b.targetMrr * 2 }, s.time.day)!.progress).toBe(1)
  })

  it('renewals: days left and the MRR change of each offer as burn (revenue up = burn down)', () => {
    const rows = renewalRows([{ id: 'c1', name: 'Acme', mrr: 10_000, untilDay: 130, holdChance: 0.62, holdMrr: 11_000, discountMrr: 8_500, error: null }], 100.4)
    expect(rows).toEqual([expect.objectContaining({ id: 'c1', days: 30, holdBurn: -1_000, discountBurn: 1_500, failBurn: 10_000, holdChance: 0.62 })])
    expect(renewalRows(undefined, 0)).toEqual([])
  })
})

describe('Dock silhouettes (§8.5)', () => {
  it('the next stage’s late tools, with that stage; gone once unlocked', () => {
    expect(lockedTools(STAGES, [], 0)).toEqual([])
    expect(lockedTools(STAGES, [], 2).map((x) => [x.id, x.stage])).toEqual([
      ['segments', 3],
      ['refactor', 3],
      ['renewal', 3],
    ])
    const a = at(3)
    expect(lockedTools(STAGES, a.unlockedTools, a.stage)).toEqual([{ id: 'mna', stage: 4 }])
    const b = at(4)
    expect(lockedTools(STAGES, b.unlockedTools, b.stage)).toEqual([])
  })
})
