// Phase 3 (docs/CORE_LOOP.md §5, §10 Faz 3): money constraint, stage multiple cap, unanswered card default,
// delayed effects inside the horizon, rescue loan → debt, v1 → v2 save migration.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { createEngine } from '../index'
import { migrate } from '../save'
import { COMPANY_NAME_MAX, DEFAULT_COMPANY_NAME, SAVE_VERSION, type GameState } from '../types'
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

describe('costs scale (GAMEPLAY V2 §4.2)', () => {
  const api = createEngine(fakeContent())
  /** A garage with one hire on day 0 and deep pockets (the test is about salaries, not survival). */
  function hired(): GameState {
    let s = api.createGame({ seed: 1 })
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    const c = s.candidates.find((x) => x.dept === 'eng') ?? s.candidates[0]!
    s = api.applyAction(s, { type: 'hire', candidateId: c.id }).state
    return { ...s, stats: { ...s.stats, cash: 50_000_000 } }
  }

  it('yearly raise: none on the first payday, × 1.08 by day 361, not again on day 391', () => {
    let s = hired()
    const pay0 = s.employees[0]!.salary
    s = api.step(s, 30.5)
    expect(s.employees[0]!.salary).toBe(pay0)
    s = api.step(s, 361 - s.time.day)
    expect(s.employees[0]!.salary).toBeCloseTo(pay0 * (1 + B.RAISE_YEARLY), 6)
    expect(s.employees[0]!.raises).toBe(1)
    s = api.step(s, 391 - s.time.day)
    expect(s.employees[0]!.salary).toBeCloseTo(pay0 * (1 + B.RAISE_YEARLY), 6)
    expect(s.employees[0]!.raises).toBe(1)
    // The raise shows in the burn right away; the month it was earned in was paid at the old salary.
    expect(s.finance.burnBreakdown.salaries).toBeCloseTo(pay0 * (1 + B.RAISE_YEARLY), 6)
  })

  it('an old save (no raises field) counts the years served as paid: no back pay, the next anniversary raises', () => {
    let s = hired()
    s = api.step(s, 700)
    const old = structuredClone(s)
    const pay = old.employees[0]!.salary
    delete old.employees[0]!.raises
    let next = api.step(old, 30)
    const years = Math.floor((next.time.day - next.employees[0]!.hiredDay) / B.RAISE_EVERY_DAYS)
    expect(next.employees[0]!.raises).toBe(years)
    expect(next.employees[0]!.salary).toBeCloseTo(pay, 6)
    next = api.step(next, (years + 1) * B.RAISE_EVERY_DAYS + 31 - next.time.day)
    expect(next.employees[0]!.raises).toBe(years + 1)
    expect(next.employees[0]!.salary).toBeCloseTo(pay * (1 + B.RAISE_YEARLY), 6)
  })

  it('infra is at least the stage share of MRR (the bill grows with the business)', () => {
    let s = hired()
    s = { ...s, stage: 4, stats: { ...s.stats, users: 20_000 }, projects: s.projects.map((p) => ({ ...p, maturity: 1, launched: true, releaseLevel: 5 })) }
    s = api.step(s, 0.01)
    const byUsers = (s.stats.users / 1000) * B.INFRA_PER_1000_BY_STAGE[4]!
    const byMrr = s.finance.mrr * B.INFRA_MRR_SHARE[4]!
    expect(byMrr).toBeGreaterThan(byUsers)
    expect(s.finance.burnBreakdown.infra).toBeCloseTo(byMrr, 3)
  })

  it('churn × (1 + techDebt / 200)', () => {
    let s = hired()
    s = { ...s, stats: { ...s.stats, users: 300 }, projects: s.projects.map((p) => ({ ...p, maturity: 0.5, launched: true, releaseLevel: 2 })) }
    const clean = api.step({ ...s, techDebt: 0 }, 0.01)
    const debt = api.step({ ...s, techDebt: 40 }, 0.01)
    expect(debt.stats.churn / clean.stats.churn).toBeCloseTo(1 + 40 / B.TECH_DEBT_CHURN_DIV, 3)
  })

  it('refactorSprint (Series A on): −(8 + eng) debt, production × 0.7 for 30 days, 90-day cooldown', () => {
    let s = hired()
    expect(api.applyAction({ ...s, techDebt: 50 }, { type: 'founderAction', kind: 'refactorSprint' }).error).toBe('notUnlocked')
    s = { ...s, stage: 3, techDebt: 50 }
    expect(api.applyAction({ ...s, techDebt: 0 }, { type: 'founderAction', kind: 'refactorSprint' }).error).toBe('notFound')
    const eng = s.employees.filter((e) => e.dept === 'eng').length
    const r = api.applyAction(s, { type: 'founderAction', kind: 'refactorSprint' })
    expect(r.ok).toBe(true)
    s = api.step(r.state, B.FOUNDER_ACTION_DEFS.refactorSprint.durationDays + 0.5)
    expect(s.techDebt).toBeCloseTo(50 - (B.REFACTOR_DEBT_BASE + eng), 6)
    const mod = s.modifiers.find((m) => m.source === 'refactorSprint')!
    expect(mod.kind).toBe('production')
    expect(mod.value).toBe(B.REFACTOR_PRODUCTION)
    expect(mod.untilDay - s.time.day).toBeGreaterThan(B.REFACTOR_DAYS - 1)
    s = api.step(s, 60)
    expect(api.applyAction(s, { type: 'founderAction', kind: 'refactorSprint' }).error).toBe('cooldown')
    s = api.step(s, B.REFACTOR_COOLDOWN_DAYS - 60 + 1)
    expect(api.applyAction(s, { type: 'founderAction', kind: 'refactorSprint' }).ok).toBe(true)
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

describe('save chain v1 → v4', () => {
  it('a v1 save walks every migration and lands on the current version with v4 defaults', () => {
    const api = createEngine(fakeContent())
    const v1 = structuredClone(api.step(api.createGame({ seed: 1 }), 65)) as unknown as { meta: Record<string, unknown>; finance: Record<string, unknown> }
    delete v1.meta.companyName
    delete v1.finance.receipts
    delete v1.finance.netHistory
    const out = migrate({ version: 1, state: v1 })!
    expect(out.meta.saveVersion).toBe(SAVE_VERSION)
    expect(out.meta.companyName).toBe(DEFAULT_COMPANY_NAME)
    expect(out.finance.receipts).toHaveLength(out.finance.mrrHistory.length)
    expect(out.finance.netHistory).toEqual([])
    // The engine keeps playing it (lazy ??= defaults for everything the migration did not touch).
    expect(api.step(out, 30).finance.receipts).toHaveLength(out.finance.mrrHistory.length + 1)
  })

  it('a save from the future is refused', () => {
    const api = createEngine(fakeContent())
    expect(migrate({ version: SAVE_VERSION + 1, state: api.createGame({ seed: 1 }) })).toBeNull()
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
