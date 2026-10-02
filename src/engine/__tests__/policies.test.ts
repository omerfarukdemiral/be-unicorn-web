// GAMEPLAY V2 §7.2 company policies (Kanun Kitabı): unlock, excludes, cooldown, irreversible, and the sharp effects.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { createEngine } from '../index'
import { POLICIES } from '../../content/index'
import { POLICY_IDS, type Employee, type GameState, type PolicyId } from '../types'
import { fakeContent } from './fixtures'
import { wordCount } from '../../content/__tests__/fixture'

const api = createEngine(fakeContent({ policies: POLICIES }))

/** A company at `stage` with `cash` in the bank (runway follows from the garage burn). */
function at(stage: GameState['stage'], cash: number, team = 0): GameState {
  const s = api.createGame({ seed: 1 })
  const employees: Employee[] = Array.from({ length: team }, (_, i) => ({
    id: `x${i}`, name: `N${i}`, dept: 'eng', quality: 0.6 + i * 0.03, salary: 3000, status: 'working', statusSinceDay: 0, hiredDay: 0, morale: 70,
  }))
  return api.step({ ...s, stage, employees, stats: { ...s.stats, cash } }, 0.25)
}

const sign = (s: GameState, policyId: PolicyId) => api.applyAction(s, { type: 'adoptPolicy', policyId })

/** Runway under 3 months at Pre-seed with no team. */
const SHORT = 2_000
/** Runway far above every survival lock. */
const RICH = 5_000_000

describe('content (§7.2 v1 set)', () => {
  it('twelve policies, one per id; names ≤ 6 words, texts ≤ 12; tier-2 growth ↔ craft exclude each other', () => {
    expect(POLICIES.map((p) => p.id).sort()).toEqual([...POLICY_IDS].sort())
    for (const p of POLICIES) {
      expect(wordCount(p.name), p.id).toBeLessThanOrEqual(6)
      expect(wordCount(p.text), p.id).toBeLessThanOrEqual(12)
    }
    const t2 = (tree: string) => POLICIES.filter((p) => p.tree === tree && p.tier === 2)
    for (const g of t2('growth')) for (const c of t2('craft')) {
      expect(g.excludes).toContain(c.id)
      expect(c.excludes).toContain(g.id)
    }
  })
})

describe('signing (§7.2)', () => {
  it('unlock: survival waits for the runway, growth for the stage; garage none', () => {
    expect(sign(at(1, RICH), 'salary-freeze').error).toBe('notUnlocked')
    expect(sign(at(1, SHORT), 'salary-freeze').ok).toBe(true)
    expect(sign(at(1, RICH), 'hire-fast').ok).toBe(true)
    expect(sign(at(1, RICH), 'crunch-culture').error).toBe('notUnlocked')
    expect(sign(at(0, SHORT), 'salary-freeze').error).toBe('notUnlocked')
    expect(at(1, SHORT).derived.policies!.available).toContain('deferred-pay')
    expect(at(1, RICH).derived.policies!.available).not.toContain('deferred-pay')
  })

  it('invalid: unknown, already signed; excludes close the other tier-2 for good', () => {
    expect(sign(at(1, RICH), 'nope' as PolicyId).error).toBe('invalid')
    let s = sign(at(2, RICH), 'crunch-culture').state
    expect(s.policies!.adopted).toEqual(['crunch-culture'])
    s = api.step(s, B.POLICY_SIGN_COOLDOWN_DAYS + 1)
    expect(sign(s, 'crunch-culture').error).toBe('invalid')
    expect(sign(s, 'quality-gate').error).toBe('invalid')
    expect(s.derived.policies!.available).not.toContain('quality-gate')
  })

  it('cooldown: one signature per POLICY_SIGN_COOLDOWN_DAYS, one move each', () => {
    let s = at(1, RICH)
    const left = s.derived.moves!.left
    s = sign(s, 'hire-fast').state
    expect(s.derived.moves!.left).toBe(left - B.MOVE_COST.adoptPolicy)
    expect(s.derived.policies!.nextSignDay).toBeCloseTo(s.time.day + B.POLICY_SIGN_COOLDOWN_DAYS, 6)
    s = { ...s, stage: 2 }
    expect(sign(s, 'remote-first').error).toBe('cooldown')
    s = api.step(s, B.POLICY_SIGN_COOLDOWN_DAYS)
    expect(sign(s, 'remote-first').ok).toBe(true)
  })

  it('irreversible: a signed policy stays signed after the runway recovers', () => {
    let s = sign(at(1, SHORT), 'lean-office').state
    s = api.step({ ...s, stats: { ...s.stats, cash: RICH } }, 90)
    expect(s.policies!.adopted).toEqual(['lean-office'])
    expect(s.derived.policies!.mult.rent).toBe(0.8)
  })

  it('the lease-hike crisis option opens remote-first before Seed', () => {
    const s = at(1, RICH)
    expect(sign(s, 'remote-first').error).toBe('notUnlocked')
    expect(sign({ ...s, flags: { ...s.flags, remoteFirstOpen: true } }, 'remote-first').ok).toBe(true)
  })

  it('content without policies: nothing to sign, the game runs', () => {
    const bare = createEngine(fakeContent())
    const s = bare.step(bare.createGame({ seed: 1 }), 40)
    expect(bare.applyAction({ ...s, stage: 1 }, { type: 'adoptPolicy', policyId: 'hire-fast' }).error).toBe('invalid')
    expect(s.derived.policies!.available).toEqual([])
  })
})

describe('effects (§7.2)', () => {
  it('lean-office: rent × 0.8 into the payday ledger', () => {
    const base = at(1, SHORT)
    const lean = sign(base, 'lean-office').state
    expect(lean.finance.burnBreakdown.rent).toBeCloseTo(base.finance.burnBreakdown.rent * 0.8, 6)
    const a = api.step(base, 10)
    const b = api.step(lean, 10)
    const accrued = (x: GameState, from: GameState) => x.finance.ledger!.rent - from.finance.ledger!.rent
    expect(accrued(b, lean)).toBeCloseTo(accrued(a, base) * 0.8, 6)
  })

  it('salary-freeze: no yearly raise, no candidate above quality 1', () => {
    let s = sign(at(1, SHORT, 1), 'salary-freeze').state
    s = api.step({ ...s, stats: { ...s.stats, cash: RICH } }, 361 - s.time.day)
    expect(s.employees[0]!.salary).toBe(3000)
    expect(s.candidates.length).toBeGreaterThan(0)
    expect(Math.max(...s.candidates.map((c) => c.quality))).toBeLessThanOrEqual(1)
  })

  it('layoff-round: the team −30% at once (no severance), reputation −15, morale target −20 for 90 days', () => {
    const s0 = at(1, SHORT, 10)
    const s = { ...s0, stats: { ...s0.stats, reputation: 40 } }
    const r = sign(s, 'layoff-round')
    expect(r.ok).toBe(true)
    expect(r.state.employees.length).toBe(7)
    // The lowest quality go first.
    expect(r.state.employees.map((e) => e.id)).toEqual(['x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'])
    expect(r.state.stats.reputation).toBeCloseTo(s.stats.reputation - 15, 6)
    expect(r.state.stats.cash).toBeCloseTo(s.stats.cash, 6)
    const mod = r.state.modifiers.find((m) => m.source === 'policy:layoff-round')!
    expect(mod.kind).toBe('morale')
    expect(mod.value).toBe(-20)
    expect(mod.untilDay - r.state.time.day).toBeCloseTo(90, 6)
    // The policy stays: no severance on a later fire either.
    const fired = api.applyAction(r.state, { type: 'fire', employeeId: 'x9' })
    expect(fired.state.stats.cash).toBeCloseTo(r.state.stats.cash, 6)
  })

  it('a survival signature: every round +0.005 equity and the radar team axis −0.1, for good', () => {
    const s = at(1, SHORT, 3)
    const before = s.derived.round!.sizes!.map((o) => o.equity)
    const after = sign(s, 'salary-freeze').state
    expect(after.policies!.survival).toBe(1)
    after.derived.round!.sizes!.forEach((o, i) => expect(o.equity - before[i]!).toBeCloseTo(B.POLICY_SURVIVAL_EQUITY, 9))
    // A growth policy does not.
    const grow = sign(at(1, RICH, 3), 'hire-fast').state
    expect(grow.policies!.survival ?? 0).toBe(0)
  })

  it('crunch-culture: +1 move a week, production × 1.2, tech debt +1 a payday, the burnout flag', () => {
    let s = at(2, RICH)
    const total = s.derived.moves!.total
    s = sign(s, 'crunch-culture').state
    expect(s.derived.moves!.total).toBe(total + 1)
    expect(s.derived.policies!.mult.production).toBeCloseTo(1.2, 9)
    expect(s.flags['crunchCultureDay']).toBe(Math.floor(s.time.day))
    const debt = s.techDebt
    s = api.step(s, 31)
    expect(s.techDebt).toBeGreaterThanOrEqual(debt + 1 - 1e-9)
  })

  it('deferred-pay: payroll × 0.6 now, the rest owed and paid when the round closes', () => {
    const s = at(1, SHORT, 2)
    const pay = s.finance.burnBreakdown.salaries
    let d = sign(s, 'deferred-pay').state
    expect(d.finance.burnBreakdown.salaries).toBeCloseTo(pay * 0.6, 6)
    expect(d.derived.policies!.payLater).toBeCloseTo(pay * 0.4, 6)
    d = api.step(d, 15)
    expect(d.policies!.owed).toBeCloseTo(pay * 0.4 * (15 / 30), 3)
  })

  it('deferred-pay: the held wages are owed, so runway does not grow from them', () => {
    const d = api.step(sign(at(1, SHORT, 2), 'deferred-pay').state, 15)
    expect(d.policies!.owed!).toBeGreaterThan(0)
    const cash = { ...d.stats, cash: 50_000 }
    const owing = api.step({ ...d, stats: cash }, 0.01)
    const paid = api.step({ ...d, stats: cash, policies: { ...d.policies!, owed: 0 } }, 0.01)
    expect(paid.finance.runway!).toBeGreaterThan(owing.finance.runway!)
  })

  it('deferred-pay: no round ahead from Series C, so it cannot be signed and a signed one holds nothing back', () => {
    const c = at((B.LAST_STAGE - 1) as GameState['stage'], SHORT, 2)
    expect(c.derived.policies!.available).not.toContain('deferred-pay')
    expect(sign(c, 'deferred-pay').error).toBe('notUnlocked')
    const pay = c.finance.burnBreakdown.salaries
    const old = api.step({ ...c, policies: { adopted: ['deferred-pay'], lastSignedDay: 0 } }, 15)
    expect(old.finance.burnBreakdown.salaries).toBeCloseTo(pay, 6)
    expect(old.policies!.owed ?? 0).toBe(0)
  })

  it('management: −1 move a week, coordination loss halved', () => {
    const s = at(2, RICH, 20)
    const r = sign(s, 'management')
    expect(r.ok).toBe(true)
    expect(r.state.derived.moves!.total).toBe(s.derived.moves!.total - 1)
    expect(1 - r.state.derived.coordination).toBeCloseTo((1 - s.derived.coordination) * 0.5, 9)
  })
})
