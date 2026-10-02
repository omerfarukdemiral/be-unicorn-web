// Payday desk view (docs/GAMEPLAY_V2.md §6.1, §10.6): a choice maps to rows (ledger amounts, picked answer, its cost)
// and to the engine's own outcome (cash / owed after, the bankruptcy clock). Node environment, no DOM.
import { describe, expect, it } from 'vitest'
import { applyAction, balance as B, createGame, type GameState, type PaydayChoice } from '../../engine'
import { PAYDAY_LINES, paydayView } from './paydayView'

const PAY_ALL: PaydayChoice = { salaries: 'full', rent: 'pay', infra: 'pay', ads: 'pay', founder: 'pay' }
const DEFER_ALL: PaydayChoice = { salaries: 'defer', rent: 'defer', infra: 'defer', ads: 'cut', founder: 'skip' }

/** A month of $4.4K waiting on the desk with `cash` in the till. */
function desk(cash = 1_000): GameState {
  const s = createGame({ seed: 7 })
  s.stats.cash = cash
  s.finance.pendingPayday = { day: 30, ledger: { revenue: 0, salaries: 3_000, rent: 500, infra: 200, ads: 300, founder: 400 }, deferredBefore: 0 }
  return s
}

describe('paydayView', () => {
  it('is null when no month waits on the desk', () => {
    expect(paydayView(createGame({ seed: 7 }), PAY_ALL)).toBeNull()
  })

  it('lists every line in desk order with its ledger amount, answers and pick', () => {
    const v = paydayView(desk(), PAY_ALL)!
    expect(v.rows.map((r) => r.line)).toEqual(PAYDAY_LINES)
    expect(Object.fromEntries(v.rows.map((r) => [r.line, r.amount]))).toEqual({ salaries: 3_000, infra: 200, rent: 500, founder: 400, ads: 300 })
    expect(v.rows.find((r) => r.line === 'salaries')!.options).toEqual(['full', 'half', 'defer'])
    expect(v.rows.find((r) => r.line === 'ads')!.options).toEqual(['pay', 'cut'])
    expect(v.rows.every((r) => r.pick === PAY_ALL[r.line] && r.cost === undefined)).toBe(true)
    expect(v.deadline).toBe(30 + B.PAYDAY_DECIDE_DAYS)
    expect(v.interest).toBe(B.DEFER_INTEREST)
  })

  it('maps each deferral to its engine cost', () => {
    const v = paydayView(desk(), DEFER_ALL)!
    const cost = Object.fromEntries(v.rows.map((r) => [r.line, r.cost]))
    expect(cost['salaries']).toEqual({ kind: 'morale', value: B.PAYDAY_DEFER_MORALE })
    expect(cost['infra']).toEqual({ kind: 'capacity', value: B.INFRA_DEFER_CAPACITY[0] })
    expect(cost['rent']).toEqual({ kind: 'rent', n: 1, max: B.EVICTION_MONTHS })
    expect(cost['founder']).toEqual({ kind: 'energy', value: B.FOUNDER_SKIP_ENERGY })
    expect(cost['ads']).toEqual({ kind: 'ads' })
    expect(paydayView(desk(), { ...PAY_ALL, salaries: 'half' })!.rows[0]!.cost).toEqual({ kind: 'morale', value: B.PAYDAY_HALF_MORALE })
  })

  it('shows exactly what resolvePayday does, without touching the state', () => {
    const s = desk()
    const before = JSON.stringify(s)
    for (const choice of [PAY_ALL, DEFER_ALL]) {
      const v = paydayView(s, choice)!
      const r = applyAction(s, { type: 'resolvePayday', choice })
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(v.cashNow).toBe(1_000)
      expect(v.cashAfter).toBe(r.state.stats.cash)
      expect(v.owedAfter).toBe(r.state.finance.deferred ?? 0)
    }
    expect(JSON.stringify(s)).toBe(before)
    // Deferring keeps cash and leaves the month owed.
    const pay = paydayView(s, PAY_ALL)!
    const defer = paydayView(s, DEFER_ALL)!
    expect(defer.cashAfter).toBeGreaterThan(pay.cashAfter)
    expect(defer.owedAfter).toBeGreaterThan(pay.owedAfter)
  })

  it('starts the bankruptcy clock on unpaid salaries, not on a month cash covers', () => {
    expect(paydayView(desk(), DEFER_ALL)!.clock).toBe(true)
    expect(paydayView(desk(50_000), PAY_ALL)!.clock).toBe(false)
  })
})
