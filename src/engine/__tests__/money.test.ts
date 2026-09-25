// Phase 3 (docs/CORE_LOOP.md §5, §10 Faz 3): money constraint, stage multiple cap, unanswered card default,
// delayed effects inside the horizon, rescue loan → debt, v1 → v2 save migration.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { createEngine } from '../index'
import { migrate } from '../save'
import { COMPANY_NAME_MAX, DEFAULT_COMPANY_NAME, SAVE_VERSION } from '../types'
import { fakeCard, fakeContent } from './fixtures'

describe('garage money (S1-b)', () => {
  it('starts with $15K and a $1.2K founder living cost in the burn', () => {
    const api = createEngine(fakeContent())
    const s = api.step(api.createGame({ seed: 1 }), 1)
    expect(s.stats.cash).toBeLessThanOrEqual(B.START_CASH)
    expect(s.finance.burnBreakdown.founder).toBe(B.FOUNDER_LIVING_COST[0])
    expect(s.finance.burn).toBeGreaterThanOrEqual(B.FOUNDER_LIVING_COST[0]!)
    // ~10 months of runway with no team.
    expect(s.finance.runway!).toBeGreaterThan(8)
    expect(s.finance.runway!).toBeLessThan(13)
  })

  it('the derived multiple is capped by the stage ceiling', () => {
    const api = createEngine(fakeContent())
    const s = api.step(api.createGame({ seed: 1 }), 1)
    expect(s.derived.multipleCap).toBe(B.MULTIPLE_MAX_BY_STAGE[0])
    expect(s.derived.valuationMultiple).toBeLessThanOrEqual(s.derived.multipleCap!)
  })
})

describe('unanswered card default (Cevapsız kalırsa)', () => {
  it('applies the written default option after DECISION_DEFAULT_AFTER_DAYS', () => {
    const api = createEngine(fakeContent({ decisions: [fakeCard('c1', { defaultOption: 0 })] }))
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    const shown = s.decisions.active!.shownDay
    const cash = s.stats.cash
    s = api.step(s, B.DECISION_DEFAULT_AFTER_DAYS - 2)
    expect(s.decisions.active?.cardId).toBe('c1')
    s = api.step(s, 3)
    expect(s.time.day - shown).toBeGreaterThanOrEqual(B.DECISION_DEFAULT_AFTER_DAYS)
    expect(s.decisions.active?.cardId).not.toBe('c1')
    expect(s.events.some((e) => e.kind === 'decisionDefaulted' && e.refId === 'c1' && e.value === 0)).toBe(true)
    // Option 0 gave +$1000 (costs of the days in between are far smaller than a payday here? no: compare history).
    expect(s.decisions.history.some((h) => h.cardId === 'c1' && h.optionIndex === 0)).toBe(true)
    expect(Number.isFinite(cash)).toBe(true)
  })

  it('without defaultOption the last option is the default', () => {
    const api = createEngine(fakeContent({ decisions: [fakeCard('c1')] }))
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    s = api.step(s, B.DECISION_DEFAULT_AFTER_DAYS + 1)
    expect(s.decisions.history.some((h) => h.cardId === 'c1' && h.optionIndex === 1)).toBe(true)
  })
})

describe('delayed effects stay on the horizon', () => {
  it('a long delay is capped at DECISION_DELAY_MAX_DAYS', () => {
    const card = fakeCard('c1')
    card.options[1]!.delayed = { days: 120, effects: { users: 10 }, note: 'n' }
    const api = createEngine(fakeContent({ decisions: [card] }))
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    s = api.applyAction(s, { type: 'answerDecision', cardId: 'c1', optionIndex: 1 }).state
    const p = s.decisions.pending.find((x) => x.sourceCardId === 'c1')!
    expect(p.applyDay - s.time.day).toBeLessThanOrEqual(B.DECISION_DELAY_MAX_DAYS + 1e-9)
  })
})

describe('rescue loan', () => {
  it('cash from an emergencyLoan option becomes finance.debt', () => {
    const card = fakeCard('loan', {
      options: [{ label: 'a', tradeoff: { gain: 'g', cost: 'c' }, effects: { cash: 15_000, setFlag: 'emergencyLoan' }, reflection: 'r' }],
    })
    const api = createEngine(fakeContent({ decisions: [card] }))
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    s = api.applyAction(s, { type: 'answerDecision', cardId: 'loan', optionIndex: 0 }).state
    expect(s.finance.debt).toBe(15_000)
  })
})

describe('save v1 → v2', () => {
  it('a v1 save already counting negative-cash days keeps its clock as a missed payday', () => {
    const api = createEngine(fakeContent())
    const s = api.createGame({ seed: 1 })
    const v1 = structuredClone(s) as unknown as Record<string, unknown>
    ;(v1.finance as { negativeCashDays: number }).negativeCashDays = 12
    delete (v1.finance as { payrollMissed?: boolean }).payrollMissed
    const out = migrate({ version: 1, state: v1 })!
    expect(out.finance.payrollMissed).toBe(true)
    expect(out.meta.saveVersion).toBe(SAVE_VERSION)
    const calm = migrate({ version: 1, state: structuredClone(s) })!
    expect(calm.finance.payrollMissed).toBeFalsy()
  })
})

describe('company name (save v3)', () => {
  it('createGame trims, collapses and caps the name; blank falls back to the default', () => {
    const api = createEngine(fakeContent())
    expect(api.createGame({ seed: 1, companyName: '  Helio   Studio ' }).meta.companyName).toBe('Helio Studio')
    expect(api.createGame({ seed: 1, companyName: ' ' }).meta.companyName).toBe(DEFAULT_COMPANY_NAME)
    expect(api.createGame({ seed: 1 }).meta.companyName).toBe(DEFAULT_COMPANY_NAME)
    expect(Array.from(api.createGame({ seed: 1, companyName: 'x'.repeat(50) }).meta.companyName)).toHaveLength(COMPANY_NAME_MAX)
  })

  it('a v2 save gets the default company name', () => {
    const api = createEngine(fakeContent())
    const v2 = structuredClone(api.createGame({ seed: 1 })) as unknown as { meta: Record<string, unknown> }
    delete v2.meta.companyName
    const out = migrate({ version: 2, state: v2 })!
    expect(out.meta.companyName).toBe(DEFAULT_COMPANY_NAME)
    expect(out.meta.saveVersion).toBe(SAVE_VERSION)
  })
})
