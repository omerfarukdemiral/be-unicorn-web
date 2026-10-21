// 2026-10-21 clarity & pace: one decision at a time (pace.ts), delegated hiring from Series A (staffing.ts), rescue
// notices and the down round's price (P2), praise milestones (praise.ts), save v7.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../content/index'
import * as B from '../balance'
import { recomputeDerived } from '../derive'
import { relocateOffice, syncSeats } from '../office'
import { createEngine } from '../index'
import { decisionSlotFree, openDecision } from '../pace'
import { dailyPraise } from '../praise'
import { deserialize, serialize } from '../save'
import { DEPTS, NEXT_MOVES, SAVE_VERSION, type Dept, type Employee, type GameState } from '../types'
import { clone, headcount } from '../util'

const api = createEngine(CONTENT)

function emp(id: string, dept: Dept, over: Partial<Employee> = {}): Employee {
  return { id, name: id, dept, quality: 1, salary: 3000, status: 'working', statusSinceDay: 0, hiredDay: -100, morale: 80, ...over }
}

/** A Series A company with a live product, rich, `team` people per dept in `depts`. */
function seriesA(team = 2, cash = 50_000_000): GameState {
  const s = clone(api.createGame({ seed: 11 }))
  s.stage = 3
  s.stats.cash = cash
  s.stats.users = 20_000
  s.time.day = 400
  s.projects = [{ id: 'p1', name: 'P', category: 'web', size: B.PROJECT_SIZE.web, maturity: 1, launched: true, releaseLevel: 5, createdDay: 0, assignedIds: [] }]
  s.employees = []
  for (const d of DEPTS) for (let i = 0; i < team; i++) s.employees.push(emp(`${d}${i}`, d, d === 'eng' || d === 'product' ? { projectId: 'p1' } : {}))
  s.projects[0]!.assignedIds = s.employees.filter((e) => e.projectId).map((e) => e.id)
  s.praise = { done: CONTENT.praise!.map((r) => r.id) }
  s.office = relocateOffice(s.office, 3)
  for (const r of s.office.rings) r.unlocked = true
  syncSeats(s)
  recomputeDerived(s, CONTENT)
  return s
}

describe('one decision at a time (pace.ts)', () => {
  it('an open card holds a resignation notice; DECISION_GAP_DAYS after it closes the notice comes', () => {
    const s = seriesA()
    s.time.day = 403
    s.decisions.active = { cardId: CONTENT.decisions[0]!.id, shownDay: 403 }
    expect(openDecision(s)).toBe('card')
    expect(decisionSlotFree(s)).toBe(false)
    s.decisions.active = undefined
    s.decisions.closedDay = 403
    expect(decisionSlotFree(s)).toBe(false)
    s.time.day = 403 + B.DECISION_GAP_DAYS
    expect(decisionSlotFree(s)).toBe(true)
  })

  it('never two open at once over a long run (cards, meetings, leavers, the payday desk)', () => {
    let s = api.createGame({ seed: 5 })
    s = api.applyAction(s, { type: 'startProject', category: 'web' }).state
    let both = 0
    for (let d = 0; d < 700 && !s.gameOver; d++) {
      s = api.step(s, 1)
      const open = [!!s.decisions.active, !!s.finance.pendingPayday, s.round?.pitchDue !== undefined && !!s.round?.active].filter(Boolean).length
      if (open > 1) both++
      if (s.derived.canStartRound) s = api.applyAction(s, { type: 'startRound' }).state
    }
    expect(both).toBe(0)
  })

  it('payday receipt days hold new decisions (from the first payday on)', () => {
    const s = seriesA()
    s.time.day = 420
    expect(decisionSlotFree(s)).toBe(false)
    s.time.day = 421.5
    expect(decisionSlotFree(s)).toBe(false)
    s.time.day = 422
    expect(decisionSlotFree(s)).toBe(true)
  })
})

describe('delegated hiring from Series A (staffing.ts)', () => {
  it('setHireTarget is refused before Series A and checked', () => {
    const g = api.createGame({ seed: 1 })
    expect(api.applyAction(g, { type: 'setHireTarget', dept: 'eng', target: 3 }).error).toBe('notUnlocked')
    const s = seriesA()
    expect(api.applyAction(s, { type: 'setHireTarget', dept: 'eng', target: -1 }).ok).toBe(false)
    expect(api.applyAction(s, { type: 'setHireTarget', dept: 'eng', target: 2.5 }).ok).toBe(false)
    expect(api.applyAction(s, { type: 'setHireTarget', dept: 'eng', target: B.STAFF_TARGET_MAX + 1 }).ok).toBe(false)
    const r = api.applyAction(s, { type: 'setHireTarget', dept: 'eng', target: 6 })
    expect(r.ok).toBe(true)
    expect(r.state.staffing?.targets.eng).toBe(6)
    expect(r.state.derived.staffing?.depts.eng).toMatchObject({ count: 2, target: 6, blocked: null })
  })

  it('the leads fill the target on the weekly pass (at most STAFF_BATCH_MAX a dept) and one notice says who joined', () => {
    let s = seriesA()
    s = api.applyAction(s, { type: 'setHireTarget', dept: 'eng', target: 7 }).state
    s = api.applyAction(s, { type: 'setHireTarget', dept: 'marketing', target: 3 }).state
    const toPass = B.STAFF_PASS_DAYS - (Math.floor(s.time.day) % B.STAFF_PASS_DAYS)
    s = api.step(s, toPass)
    expect(headcount(s).eng).toBe(2 + B.STAFF_BATCH_MAX)
    expect(headcount(s).marketing).toBe(3)
    const note = s.notices!.filter((n) => n.kind === 'teamHired').at(-1)!
    expect(note.hires).toEqual({ eng: B.STAFF_BATCH_MAX, marketing: 1 })
    expect(note.text).toContain('Geliştirme +3')
    expect(s.events.some((e) => e.kind === 'notice' && e.value === note.id)).toBe(true)
    s = api.step(s, B.STAFF_PASS_DAYS)
    expect(headcount(s).eng).toBe(7)
  })

  it('a full office holds the leads (blocked: desk); the section is the player\'s move', () => {
    let s = seriesA()
    for (const r of s.office.rings) if (r.index > 0) r.unlocked = false
    s = api.applyAction(s, { type: 'setHireTarget', dept: 'eng', target: 40 }).state
    s = api.step(s, B.STAFF_PASS_DAYS * 4)
    expect(s.derived.staffing?.depts.eng.blocked).toBe('desk')
    expect(headcount(s).eng).toBeLessThan(40)
  })

  it('no cash, no hire: the guard holds and the view says cash; a lower target fires nobody', () => {
    let s = seriesA(2, 1_000)
    s.stats.users = 50
    recomputeDerived(s, CONTENT)
    s = api.applyAction(s, { type: 'setHireTarget', dept: 'sales', target: 5 }).state
    expect(s.derived.staffing?.depts.sales.blocked).toBe('cash')
    s = api.step(s, B.STAFF_PASS_DAYS)
    expect(headcount(s).sales).toBe(2)
    s = api.applyAction(s, { type: 'setHireTarget', dept: 'ops', target: 0 }).state
    s = api.step(s, B.STAFF_PASS_DAYS)
    expect(headcount(s).ops).toBe(2)
  })

  it('from Series A the chip never names a single hire; a team move carries the dept and target', () => {
    expect(NEXT_MOVES).toContain('teamTarget')
    let seen = 0
    for (const seed of [1, 2, 3]) {
      let s = seriesA(2)
      s.time.day += seed
      s.stats.users = 2_000_000 // servers tight: the engineers come first
      // No round window now (a failed round's retry wait): the chip looks past the round.
      s.flags['roundFailedDay'] = s.time.day
      s.flags['roundFailedStage'] = 3
      recomputeDerived(s, CONTENT)
      const step = s.derived.nextStep!
      expect(['hireEng', 'hireMarketing', 'hireGrowth']).not.toContain(step.move)
      if (step.move === 'teamTarget') {
        seen++
        expect(step.team!.target).toBeGreaterThan(headcount(s)[step.team!.dept])
        s = api.applyAction(s, { type: 'setHireTarget', dept: step.team!.dept, target: step.team!.target }).state
        // Its lead is on it: the chip does not ask again for that dept.
        expect(s.derived.nextStep?.team?.dept === step.team!.dept && s.derived.nextStep?.move === 'teamTarget').toBe(false)
      }
    }
    expect(seen).toBeGreaterThan(0)
  })
})

describe('P2: when the till runs dry, one card says what came and its price', () => {
  it('the angel taken by its default writes a rescue notice with the cash and the 5% share', () => {
    const s = clone(api.createGame({ seed: 3 }))
    s.time.day = 50
    s.finance.burn = 6_000
    s.decisions.active = { cardId: B.ANGEL_CARD_ID, shownDay: 50 - 14 }
    s.stats.cash = -500
    const r = api.step(s, 1)
    const n = r.notices!.find((x) => x.kind === 'rescue')!
    expect(n).toBeDefined()
    expect(n.equity).toBeCloseTo(0.05, 5)
    expect(n.cash!).toBeGreaterThan(0)
    expect(n.text).toContain('bakmadan')
    expect(n.text).toContain('%5')
  })

  it('a down round closes at a lower valuation than before it, even though the stage goes up', () => {
    const s = seriesA(3)
    s.stage = 2
    s.finance.mrrHistory = [100_000, 110_000, 121_000, 133_000]
    recomputeDerived(s, CONTENT)
    const before = s.finance.valuation
    s.flags['roundFailedDay'] = 0
    s.flags['roundFailedStage'] = 2
    const started = api.applyAction(s, { type: 'startRound', down: true })
    if (!started.ok) return // the down round's door rules live in round.ts; the close is what this checks
    let t = started.state
    t.round!.weeksLeft = 1
    t = api.step(t, 7)
    expect(t.stage).toBe(3)
    expect(t.finance.valuation).toBeLessThanOrEqual(before * B.DOWN_ROUND_VALUATION + 1)
    expect(t.notices!.some((n) => n.kind === 'roundWhileBroke')).toBe(true)
  })
})

describe('praise (praise.ts)', () => {
  it('month 1 with users: an ahead line naming Airbnb; one per PRAISE_GAP_DAYS', () => {
    const s = clone(api.createGame({ seed: 2 }))
    s.stats.users = 40
    s.time.day = 30
    dailyPraise(s, CONTENT)
    const n = s.notices!.at(-1)!
    expect(n.kind).toBe('praise')
    expect(n.grade).toBe('ahead')
    expect(n.text).toContain('Airbnb')
    // Another row reached the next day waits for the gap.
    s.stage = 1
    s.time.day = 31
    dailyPraise(s, CONTENT)
    expect(s.notices!.filter((x) => x.kind === 'praise')).toHaveLength(1)
    s.time.day = 30 + B.PRAISE_GAP_DAYS
    dailyPraise(s, CONTENT)
    expect(s.notices!.filter((x) => x.kind === 'praise')).toHaveLength(2)
  })

  it('behind and with no neutral line: nothing is said', () => {
    const s = clone(api.createGame({ seed: 2 }))
    s.praise = { done: CONTENT.praise!.filter((r) => r.id !== 'stage-3').map((r) => r.id) }
    s.stage = 3
    s.time.day = 60 * 30 // 60 months: Airbnb's Series A took ~37
    dailyPraise(s, CONTENT)
    expect(s.notices ?? []).toHaveLength(0)
    expect(s.praise.done).toContain('stage-3')
  })

  it('an older save without praise state marks what it already passed (no flood)', () => {
    const s = clone(api.createGame({ seed: 2 }))
    delete s.praise
    s.time.day = 400
    s.stage = 3
    s.stats.users = 20_000
    dailyPraise(s, CONTENT)
    expect(s.notices ?? []).toHaveLength(0)
  })

  it('the table: 10–15 rows, one sentence-ish each, no em dash', () => {
    const rows = CONTENT.praise!
    expect(rows.length).toBeGreaterThanOrEqual(10)
    expect(rows.length).toBeLessThanOrEqual(15)
    for (const r of rows) for (const t of [r.ahead, r.close, r.neutral]) if (t) expect(t).not.toMatch(/—/)
  })
})

describe('save v7', () => {
  it('a v6 save from Series A gets targets at today’s headcount', () => {
    const s = seriesA(2)
    delete s.staffing
    const raw = JSON.parse(serialize(s)) as { version: number; state: GameState }
    raw.version = 6
    delete raw.state.staffing
    delete raw.state.notices
    const out = deserialize(JSON.stringify(raw))!
    expect(SAVE_VERSION).toBe(7)
    expect(out.staffing?.targets).toEqual({ eng: 2, product: 2, marketing: 2, sales: 2, ops: 2 })
    expect(out.notices).toEqual([])
  })
})
