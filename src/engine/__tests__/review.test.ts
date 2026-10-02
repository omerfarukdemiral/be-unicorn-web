// Review fixes after phase 3 (docs/CORE_LOOP.md): releases after 1.0, the rescue card before bankruptcy, stage
// goals measured inside the stage, beta users before the MVP, a smooth $1K MRR switch, sales-call saturation and
// contracts, an averaged pitch impression.
import { describe, expect, it } from 'vitest'
import { CONTENT, GOALS } from '../../content/index'
import * as B from '../balance'
import { valuation, valuationMultiple, valuationPreRevenue } from '../economy'
import { createEngine } from '../index'
import { recomputeDerived } from '../derive'
import type { GameState } from '../types'
import { playBot, RIVAL_EARLY_DAYS } from '../../../sim/bots'
import { fakeCard, fakeContent } from './fixtures'

const api = createEngine(fakeContent())
const refresh = (s: GameState): GameState => {
  const c = structuredClone(s)
  recomputeDerived(c, fakeContent())
  return c
}

/** A garage with one web project at `maturity`, one engineer on it, launched when past the MVP. */
function withProject(maturity: number): GameState {
  let s = api.createGame({ seed: 3 })
  s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
  s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
  const eng = s.candidates.find((c) => c.dept === 'eng') ?? s.candidates[0]!
  s = api.applyAction(s, { type: 'hire', candidateId: eng.id }).state
  const pid = s.projects[0]!.id
  s = api.applyAction(s, { type: 'assign', employeeId: s.employees[0]!.id, projectId: pid }).state
  const lvl = maturity >= 1 ? 5 : maturity >= 0.2 ? Math.floor(maturity / 0.2 + 1e-9) : 0
  return refresh({ ...s, projects: s.projects.map((p) => ({ ...p, maturity, launched: maturity >= B.MVP_MATURITY, releaseLevel: lvl })), stats: { ...s.stats, cash: 1e6 } })
}

describe('releases keep coming after 1.0 (updates)', () => {
  it('a finished project with builders ships updates, one per RELEASE_UPDATE_MIN_DAYS at most', () => {
    let s = withProject(1)
    const days: number[] = []
    for (let d = 0; d < 200; d++) {
      const before = s.releases?.length ?? 0
      s = api.step(s, 1)
      const list = s.releases ?? []
      if (list.length > before) days.push(list[list.length - 1]!.day)
    }
    expect(days.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < days.length; i++) expect(days[i]! - days[i - 1]!).toBeGreaterThanOrEqual(B.RELEASE_UPDATE_MIN_DAYS - 1e-9)
    const last = s.releases!.at(-1)!
    expect(last.level).toBe(5)
    expect(last.update).toBeGreaterThanOrEqual(1)
    expect(last.users).toBeGreaterThan(0)
    // The horizon shows the next update.
    expect(s.derived.horizon!.some((h) => h.kind === 'release' && h.update !== undefined)).toBe(true)
  })

  it('"Kullanıcıyla konuş" still works on a finished product: it feeds the next update', () => {
    const s = withProject(1)
    const r = api.applyAction(s, { type: 'founderAction', kind: 'talkToUsers' })
    expect(r.ok).toBe(true)
    const done = api.step(r.state, 1.5)
    expect(done.projects[0]!.updateProgress ?? 0).toBeGreaterThan(0)
  })
})

describe('rescue card on a missed payday (review #19)', () => {
  it('an idle run that misses payroll gets the rescue default well before the bankruptcy clock ends', () => {
    const real = createEngine(CONTENT)
    let s = real.createGame({ seed: 5 })
    s = real.applyAction(s, { type: 'startProject', category: 'web' }).state
    // The one-time angel (GAMEPLAY V2 §5.2, director.test) already spent: this is the rescue's path.
    s = { ...s, stats: { ...s.stats, cash: 500 }, director: { ...s.director!, angelUsed: true } }
    let missedDay: number | null = null
    let defaulted: number | null = null
    for (let d = 0; d < 200 && !s.gameOver && defaulted === null; d++) {
      s = real.step(s, 1)
      for (const e of s.events) {
        if (e.kind === 'payrollMissed' && missedDay === null) missedDay = e.day
        if (e.kind === 'decisionDefaulted' && e.refId === B.RESCUE_CARD_ID && defaulted === null) defaulted = e.day
      }
    }
    expect(missedDay).not.toBeNull()
    expect(defaulted).not.toBeNull()
    expect(defaulted! - missedDay!).toBeLessThan(B.BANKRUPT_DAYS)
    expect(s.gameOver).toBeUndefined()
  })

  it('the rescue takes over from a waiting card and skips the repeat cooldown (the max still holds)', () => {
    const rescue = fakeCard(B.RESCUE_CARD_ID, { category: 'crisis', once: false, condition: (x) => x.stats.cash < 0, defaultAfterDays: 14, defaultOption: 1 })
    const other = fakeCard('other', { condition: () => true })
    const eng = createEngine(fakeContent({ decisions: [other, rescue] }))
    let s = eng.createGame({ seed: 2 })
    for (let i = 0; i < 40 && s.decisions.active?.cardId !== 'other'; i++) s = eng.step(s, 1)
    expect(s.decisions.active?.cardId).toBe('other')
    // A rescue answered 10 days ago: inside REPEAT_CARD_COOLDOWN_DAYS.
    const day = s.time.day
    s = { ...s, decisions: { ...s.decisions, history: [...s.decisions.history, { cardId: B.RESCUE_CARD_ID, optionIndex: 0, day: day - 10 }] } }
    // Payday with the cash gone.
    s = { ...s, time: { ...s.time, day: Math.ceil(day / 30) * 30 - 0.5 }, stats: { ...s.stats, cash: -5_000 } }
    s = eng.step(s, 1)
    expect(s.finance.payrollMissed).toBe(true)
    expect(s.decisions.active?.cardId).toBe(B.RESCUE_CARD_ID)
    expect(s.decisions.queue).toContain('other')
  })
})

describe('stage goals measure the stage, not what was carried in (review #8)', () => {
  it('pre-seed goals are not done on arrival with a mature product and a team', () => {
    const real = createEngine(CONTENT)
    let s = real.createGame({ seed: 4 })
    s = real.applyAction(s, { type: 'startProject', category: 'web' }).state
    s = { ...s, projects: s.projects.map((p) => ({ ...p, maturity: 1, launched: true, releaseLevel: 5 })), stats: { ...s.stats, users: 500, cash: 1e6 } }
    // Arrive in Pre-seed the way a round close does.
    s = { ...s, stage: 1, stageStart: { stage: 1, day: s.time.day, users: 500, team: 4, releases: 5, mrr: 0, projects: 1 }, releaseCount: 5 }
    s = real.step(s, 2)
    const preseed = GOALS.filter((g) => g.stage === 1).map((g) => g.id)
    expect(s.goalsDone?.some((id) => preseed.includes(id)) ?? false).toBe(false)
  })
})

describe('money before the product (review #10)', () => {
  it('users found before the MVP are beta: no MRR until a project is launched', () => {
    let s = api.createGame({ seed: 1 })
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    s = refresh({ ...s, stats: { ...s.stats, users: 12 } })
    expect(s.finance.mrr).toBe(0)
    s = refresh({ ...s, projects: s.projects.map((p) => ({ ...p, maturity: 0.25, launched: true })) })
    expect(s.finance.mrr).toBeGreaterThan(0)
  })

  it('valuation has no jump at $1K MRR: the revenue formula blends in', () => {
    const at = (mrr: number) => valuation(mrr, valuationMultiple(0.5, 0), valuationPreRevenue(300, 1, 2), 0)
    const below = at(B.PRE_REVENUE_MRR - 1)
    const above = at(B.PRE_REVENUE_MRR + 1)
    expect(Math.abs(above - below) / below).toBeLessThan(0.02)
  })
})

describe('sales calls saturate and contracts end (review #20)', () => {
  it('deals past the month’s full ones are smaller, and a contract leaves after SALES_CONTRACT_DAYS', () => {
    let s = withProject(0.5)
    s = refresh({ ...s, stage: 2, time: { ...s.time, day: 1 } })
    expect(s.derived.salesCall!.factor).toBe(1)
    for (let i = 0; i < B.SALES_CALL_FULL_PER_MONTH; i++) {
      s = { ...s, founder: { ...s.founder, energy: 100, cooldowns: {}, moves: { left: 9, weekStart: 1 } } }
      s = api.applyAction(s, { type: 'founderAction', kind: 'salesCall' }).state
      s = api.step(s, B.FOUNDER_ACTION_DEFS.salesCall.durationDays + 0.25)
    }
    expect(s.finance.enterpriseCustomers).toHaveLength(B.SALES_CALL_FULL_PER_MONTH)
    const c = s.finance.enterpriseCustomers[0]!
    expect(c.untilDay).toBeCloseTo(c.sinceDay + B.SALES_CONTRACT_DAYS, 6)
    expect(s.derived.salesCall!.factor).toBeLessThan(1)
    s = api.step({ ...s, time: { ...s.time, day: c.untilDay! - 0.5 } }, 1)
    expect(s.finance.enterpriseCustomers.some((x) => x.id === c.id)).toBe(false)
  })
})

describe('weekly pitch: an average impression that never saturates (review #4, #17)', () => {
  it('a pitch still moves the offer when price × diligence is at its ceiling; a skipped week counts as zero', () => {
    let s = withProject(0.3)
    const target = B.STAGE_TARGET_VALUATION[1]!
    s = refresh({ ...s, stats: { ...s.stats, users: Math.ceil((target * 1.2) / B.VAL_PER_USER), morale: 80 } })
    s = api.applyAction(s, { type: 'startRound' }).state
    s = { ...s, round: { ...s.round!, weeksTotal: 12, weeksLeft: 12 } }
    s = api.step(s, 7)
    expect(s.round!.pitchDue).toBe(1)
    const before = s.derived.round!
    const good = api.applyAction(refresh({ ...s, finance: { ...s.finance, mrrHistory: [1_000, 1_300, 1_700, 2_200] } }), { type: 'roundPitch', pitch: 'metrics' }).state
    expect(good.round!.pitchBonus).toBeCloseTo(B.PITCH_METRICS_GOOD, 9)
    expect(good.derived.round!.factor).toBeGreaterThan(before.factor)
    // Next week: nothing pitched yet → the average halves (the waiting week counts as 0 until a pitch is made).
    const next = api.step(good, 7)
    expect(next.round!.pitchDue).toBe(2)
    expect(next.round!.pitchBonus).toBeCloseTo(B.PITCH_METRICS_GOOD / 2, 9)
    expect(next.derived.round!.factor).toBeLessThanOrEqual(B.ROUND_OFFER_CEIL + B.PITCH_BONUS_CAP + 1e-9)
  })
})

describe('named rivals (GAMEPLAY V2 §8.2)', () => {
  const USERS = 1500
  /** A Seed company with one product and its engineer: the lead rival is born on the first day. */
  function seedCompany(reputation = 50, maturity = 1): GameState {
    const s = withProject(maturity)
    return flat(refresh({ ...s, stage: 2, stats: { ...s.stats, users: USERS, reputation, cash: 5e6 } }), 1)
  }
  /**
   * Steps `days` with the user count held: a company that does not grow (MoM 0, under every stage's ask). `holdShare`
   * also holds the rivals' share, so the price (ARPU × (1 − Σshare × 0.2)) does not creep and the MRR stays flat.
   */
  function flat(s: GameState, days: number, holdShare = false): GameState {
    for (let d = 0; d < days; d++) {
      const rivals = holdShare ? s.rivals?.map((r) => ({ ...r, share: B.RIVAL_BORN_SHARE })) : s.rivals
      s = api.step({ ...s, stats: { ...s.stats, users: USERS }, rivals }, 1)
    }
    return s
  }
  const passes = (s: GameState, from: number) => s.events.filter((e) => e.kind === 'rivalPassed' && e.id > from)

  it('a stalled company (3+ months under the ask) is overtaken by the lead — once', () => {
    let s = seedCompany()
    expect(s.rivals).toHaveLength(1)
    expect(s.rivals![0]!.valuation).toBeLessThan(s.finance.valuation)
    const from = s.events.at(-1)?.id ?? 0
    const seen: number[] = []
    let firstDay: number | null = null
    for (let d = 0; d < 240; d++) {
      s = flat(s, 1, true)
      for (const e of passes(s, seen.at(-1) ?? from)) {
        seen.push(e.id)
        firstDay ??= e.day
      }
    }
    expect(seen).toHaveLength(1)
    // Three months under the ask are not enough yet; the fourth month end is (0.75 × tempo^4 > 1).
    expect(firstDay! - 1).toBeGreaterThanOrEqual(90)
    expect(firstDay! - 1).toBeLessThanOrEqual(150)
    expect(s.rivals![0]!.ahead).toBe(true)
    expect(s.flags['rivalPressure']).toBeGreaterThan(0.2)
  })

  it('a good bot arriving at Seed through a closed round is not overtaken in its first 90 days', () => {
    // The real path: closeRound → enterStage; the lead anchors on the new stage's valuation (the pre-revenue floor
    // fades at Seed), not on the Pre-seed figure.
    for (const kind of ['bootstrap', 'vcRocket'] as const) {
      let seedDay: number | null = null
      let lastDay = 0
      const run = playBot(kind, 1, CONTENT, 420, (s) => {
        if (s.stage >= 2) seedDay ??= s.time.day
        lastDay = s.time.day
      })
      expect(run.stageDays[2]).not.toBeNull()
      expect(lastDay - seedDay!).toBeGreaterThanOrEqual(RIVAL_EARLY_DAYS)
      expect(run.rivalPassedSeedEarly).toBe(0)
    }
  })

  it('share is not one-way: a mature, well-known product wins share back; a raw one loses it', () => {
    let strong = seedCompany(80, 1)
    let weak = seedCompany(10, 0.3)
    strong = flat(strong, 70)
    weak = flat(weak, 70)
    expect(strong.rivals![0]!.share).toBeLessThan(B.RIVAL_BORN_SHARE)
    expect(weak.rivals![0]!.share).toBeGreaterThan(B.RIVAL_BORN_SHARE)
    // Σ share presses the channels: organic and ARPU fall with it (§4.3).
    const base = refresh({ ...weak, rivals: [] })
    expect(weak.stats.arpu).toBeLessThan(base.stats.arpu)
  })
})
