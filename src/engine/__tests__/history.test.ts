// GAMEPLAY V2 A3 (docs/GAMEPLAY_V2.md §14.2, §4.4, §3.1): month history, spend preview, cash projection, profile, save v4.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { createEngine } from '../index'
import { cashProjection, companyProfile, previewSpend, targetProfile } from '../loopSelectors'
import { migrate, serialize } from '../save'
import { PROFILE_AXES, SAVE_VERSION, type GameState, type MonthReceipt } from '../types'
import { fakeContent } from './fixtures'

const decimals = (v: number): number => (Number.isInteger(v) ? 0 : String(v).split('.')[1]!.length)

/** A run that stays alive for `months` paydays: enough cash, no cards. */
function longRun(months: number): GameState {
  const api = createEngine(fakeContent())
  let s = api.createGame({ seed: 3 })
  s.stats.cash = 1e9
  for (let m = 0; m < months; m++) s = api.step(s, 30)
  return s
}

describe('month history (finance.receipts)', () => {
  it('payday appends one receipt a month and keeps at most HISTORY_MAX_MONTHS', () => {
    const s = longRun(B.HISTORY_MAX_MONTHS + 1)
    const list = s.finance.receipts!
    expect(list).toHaveLength(B.HISTORY_MAX_MONTHS)
    // The oldest month fell off; the newest is the last payday.
    expect((list[0] as MonthReceipt).month).toBe(1)
    expect(list[list.length - 1]!.day).toBe(s.finance.lastReceipt!.day)
  })

  it('stored receipts are rounded; lastReceipt stays exact', () => {
    const api = createEngine(fakeContent())
    let s = api.createGame({ seed: 3 })
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    s.stats.users = 123.456
    s.finance.adBudget = 777.77
    s = api.step(s, 30)
    const r = s.finance.receipts!.at(-1) as MonthReceipt
    for (const k of ['revenue', 'salaries', 'rent', 'infra', 'ads', 'founder', 'paid', 'net', 'cashAfter', 'mrr', 'users', 'valuation', 'morale', 'reputation', 'usersDelta', 'adBudget'] as const) {
      expect(Number.isInteger(r[k]), k).toBe(true)
    }
    for (const k of ['mom', 'multiple', 'runwayAfter', 'equity'] as const) {
      const v = r[k]
      if (typeof v === 'number') expect(decimals(v), k).toBeLessThanOrEqual(B.HISTORY_RATIO_DECIMALS)
    }
    expect(r.team).toBe(0)
    expect(r.stage).toBe(0)
    expect(r.debt).toBeUndefined()
    expect(Number.isInteger(s.finance.lastReceipt!.users)).toBe(false)
  })

  it('usersDelta is the month’s change in users', () => {
    const s = longRun(3)
    const [a, b] = s.finance.receipts!.slice(-2) as MonthReceipt[]
    expect(Math.abs(b!.usersDelta! - (b!.users - a!.users))).toBeLessThanOrEqual(1)
  })

  it('ten years of history stay under ~50 KB of JSON', () => {
    const s = longRun(B.HISTORY_MAX_MONTHS)
    const bytes = new TextEncoder().encode(JSON.stringify(s.finance.receipts)).length
    expect(bytes).toBeLessThan(50_000)
  })
})

describe('save v3 → v4', () => {
  function v3Save(): Record<string, unknown> {
    const s = longRun(4)
    const v3 = structuredClone(s) as unknown as { finance: Record<string, unknown>; meta: Record<string, unknown> }
    delete v3.finance.receipts
    delete v3.finance.netHistory
    v3.meta.saveVersion = 3
    v3.finance.mrrHistory = [0, 100.4, 250, 400]
    v3.finance.usersHistory = [0, 10.2, 30, 45]
    return v3 as unknown as Record<string, unknown>
  }

  it('opens a v3 save with partial receipts from the month-end snapshots', () => {
    const out = migrate({ version: 3, state: v3Save() })!
    expect(out.meta.saveVersion).toBe(SAVE_VERSION)
    expect(out.finance.netHistory).toEqual([])
    expect(out.finance.receipts).toEqual([
      { partial: true, month: 0, day: 30, mrr: 0, users: 0, usersDelta: 0 },
      { partial: true, month: 1, day: 60, mrr: 100, users: 10, usersDelta: 10 },
      { partial: true, month: 2, day: 90, mrr: 250, users: 30, usersDelta: 20 },
      { partial: true, month: 3, day: 120, mrr: 400, users: 45, usersDelta: 15 },
    ])
  })

  it('the migrated run keeps playing and appends full receipts after the partial ones', () => {
    const api = createEngine(fakeContent())
    const out = migrate({ version: 3, state: v3Save() })!
    const s = api.step(out, 30)
    const list = s.finance.receipts!
    expect(list).toHaveLength(5)
    expect('partial' in list[3]!).toBe(true)
    expect('partial' in list[4]!).toBe(false)
  })

  it('a save without receipts at all is defaulted lazily by payday', () => {
    const api = createEngine(fakeContent())
    const s = api.createGame({ seed: 1 })
    delete s.finance.receipts
    expect(api.step(s, 30).finance.receipts).toHaveLength(1)
  })

  it('serialize writes the new version', () => {
    const api = createEngine(fakeContent())
    expect(JSON.parse(serialize(api.createGame({ seed: 1 }))).version).toBe(4)
  })
})

/** A losing company: fixed cash, no revenue, `burn` a month, mid-month with nothing owed yet. */
function burning(cash: number, burn: number, day = 0): GameState {
  const api = createEngine(fakeContent())
  const s = api.createGame({ seed: 1 })
  s.time.day = day
  s.stats.cash = cash
  s.finance.ledger = { revenue: 0, salaries: 0, rent: 0, infra: 0, ads: 0, founder: 0 }
  s.finance.mrr = 0
  s.finance.burn = burn
  s.finance.net = -burn
  s.finance.runway = cash / burn
  return s
}

describe('previewSpend / cashProjection (§4.4)', () => {
  it('a profitable company never dies', () => {
    const s = burning(10_000, 5_000)
    s.finance.mrr = 8_000
    s.finance.net = 3_000
    s.finance.runway = null
    const p = previewSpend(s)
    expect(p.deathDay).toBeNull()
    expect(p.paydayShort).toBe(false)
    expect(p.runwayAfter).toBeNull()
  })

  it('one more salary brings the death day about two months closer', () => {
    // 8 months of runway at $5K; a $1.2K hire.
    const s = burning(40_000, 5_000)
    const before = previewSpend(s)
    const after = previewSpend(s, { burnDelta: 1_200 })
    expect(before.deathDay).toBe(270)
    expect(after.runwayAfter).toBeCloseTo(40_000 / 6_200, 6)
    expect(before.deathDay! - after.deathDay!).toBeGreaterThanOrEqual(30)
    expect(before.deathDay! - after.deathDay!).toBeLessThanOrEqual(90)
    expect(after.runwayNow).toBe(s.finance.runway)
  })

  it('a purchase that eats next payday is paydayShort', () => {
    const s = burning(6_000, 5_000, 10)
    s.finance.ledger!.salaries = 1_000
    const p = previewSpend(s, { cashDelta: -4_500 })
    expect(p.deathDay).toBe(30)
    expect(p.paydayShort).toBe(true)
    expect(previewSpend(s).paydayShort).toBe(false)
  })

  it('cashProjection uses the same core: same input, same death day', () => {
    for (const [cash, burn, day] of [[40_000, 5_000, 0], [12_345, 3_000, 17], [1_000, 900, 29]] as const) {
      const s = burning(cash, burn, day)
      const proj = cashProjection(s, 12)
      expect(proj.deathDay).toBe(previewSpend(s).deathDay)
      expect(proj.points).toHaveLength(12)
      const dying = proj.points.find((x) => x.cash < 0)
      if (dying) expect(dying.day).toBe(proj.deathDay)
    }
  })
})

describe('companyProfile / targetProfile (§14.2)', () => {
  it('every axis is null or within 0–PROFILE_MAX; growth is locked before revenue, efficiency until burn multiple', () => {
    const api = createEngine(fakeContent())
    const s = api.step(api.createGame({ seed: 1 }), 1)
    const p = companyProfile(s)
    expect(Object.keys(p).sort()).toEqual([...PROFILE_AXES].sort())
    for (const a of PROFILE_AXES) {
      const v = p[a]
      if (v === null) continue
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(B.PROFILE_MAX)
    }
    expect(p.growth).toBeNull()
    expect(p.efficiency).toBeNull()
    expect(p.product).toBeNull()
  })

  it('profitable = full cash axis; the target polygon is the diligence ask', () => {
    const s = burning(10_000, 5_000)
    s.finance.runway = null
    expect(companyProfile(s).cash).toBe(B.PROFILE_MAX)
    const t = targetProfile(2)
    expect(t.growth).toBe(1)
    expect(t.cash).toBeCloseTo(B.DILIGENCE_RUNWAY_MONTHS / B.PROFILE_RUNWAY_MONTHS, 6)
  })
})
