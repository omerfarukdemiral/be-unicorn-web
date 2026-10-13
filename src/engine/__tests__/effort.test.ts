// Effort management (E1, docs/GAMEPLAY_V2.md "Efor yönetimi"): load, fatigue (output only), boredom (morale only),
// the status order, skills, flow, sprint, leave, lead, staffAttention and saves.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { computeOutputs, employeeMoraleTarget, globalMoraleTarget, maturityRates, recomputeDerived } from '../derive'
import { dailyEffort, effortMorale, peopleView, projectDemand, projectLoad } from '../effort'
import { createEngine } from '../index'
import { staffAttention } from '../loopSelectors'
import { dailyPeople, hireCandidate, makeCandidate, yearlyRaises } from '../people'
import { Rng } from '../rng'
import { deserialize, serialize } from '../save'
import { DEPTS, SAVE_VERSION, type Employee, type GameState, type Project, type ProjectCategory, type StageIndex } from '../types'
import { clone } from '../util'
import { fakeContent } from './fixtures'

const content = fakeContent()
const api = createEngine(content)

function emp(id: string, over: Partial<Employee> = {}): Employee {
  return { id, name: id, dept: 'eng', quality: 1, salary: 3000, status: 'working', statusSinceDay: 0, hiredDay: -100, morale: 70, ...over }
}

/** A company at `stage` with `n` builders (e1…en) on one unfinished `cat` project, no desks (no common area), rich. */
function company(stage: StageIndex, n: number, cat: ProjectCategory = 'web', over: Partial<Employee> = {}): GameState {
  const s = clone(api.createGame({ seed: 3 }))
  s.stage = stage
  s.stats.cash = 10_000_000
  s.candidates = []
  const ids = Array.from({ length: n }, (_, i) => `e${i + 1}`)
  const p: Project = { id: 'p1', name: 'P', category: cat, size: B.PROJECT_SIZE[cat], maturity: 0.3, launched: true, releaseLevel: 1, createdDay: 0, assignedIds: [...ids] }
  s.projects = [p]
  s.employees = ids.map((id) => emp(id, { projectId: 'p1', ...over }))
  recomputeDerived(s, content)
  return s
}

const person = (s: GameState, id = 'e1') => s.employees.find((e) => e.id === id)!

/** n daily ticks of dailyPeople with every load forced to `load` (fixed: the pure fatigue / status rules). */
function days(s: GameState, n: number, load?: number): void {
  for (let i = 0; i < n; i++) {
    s.time.day += 1
    const v = peopleView(s)
    if (load !== undefined) for (const id of Object.keys(v)) v[id]!.load = load
    s.derived.people = v
    dailyPeople(s, content)
  }
}

describe('fatigue (E1 §2)', () => {
  it('the garage never moves it: an overloaded dev at stage 0 for 100 days', () => {
    const s = api.step(company(0, 1, 'ai'), 100)
    expect(s.employees[0]!.fatigue).toBeUndefined()
    expect(s.employees[0]!.loadAvg).toBeUndefined()
    expect(s.derived.people).toEqual({})
  })

  it('normal pace at load 1 stays 0 for 100 days', () => {
    const s = company(1, 1)
    days(s, 100, 1)
    expect(person(s).fatigue ?? 0).toBe(0)
  })

  it('load 1.5: tired by day 60, burnt out by day 85', () => {
    const s = company(1, 1, 'web', { loadAvg: 1.5 })
    days(s, 59, 1.5)
    expect(person(s).fatigue!).toBeLessThan(B.FATIGUE_TIRED)
    days(s, 1, 1.5)
    expect(person(s).fatigue!).toBeGreaterThanOrEqual(B.FATIGUE_TIRED)
    days(s, 25, 1.5)
    expect(person(s).fatigue!).toBeGreaterThanOrEqual(B.FATIGUE_BURNOUT)
  })

  it('load 2: tired on day 24, burnt out on day 34', () => {
    const s = company(1, 1, 'web', { loadAvg: 2 })
    days(s, 23, 2)
    expect(person(s).status).toBe('working')
    days(s, 1, 2)
    expect(person(s).status).toBe('tired')
    days(s, 9, 2)
    expect(person(s).status).toBe('tired')
    days(s, 1, 2)
    expect(person(s).status).toBe('burnout')
  })

  it('a 14-day sprint at load 1 ends at 42 ± 1', () => {
    const s = company(1, 1)
    s.projects[0]!.sprintUntil = s.time.day + 14.5
    days(s, 14, 1)
    expect(person(s).fatigue!).toBeGreaterThanOrEqual(41)
    expect(person(s).fatigue!).toBeLessThanOrEqual(43)
  })

  it('calm brings 85 down to 30 or less in 16 days; a leave takes 60 off in 5 days', () => {
    const s = company(1, 2, 'web', { fatigue: 85 })
    person(s, 'e1').pace = 'calm'
    days(s, 16, 1)
    expect(person(s, 'e1').fatigue!).toBeLessThanOrEqual(30)
    const t = company(1, 1, 'web', { fatigue: 80 })
    const r = api.applyAction(t, { type: 'giveLeave', employeeId: 'e1' })
    expect(r.ok).toBe(true)
    const u = clone(r.state)
    days(u, 5, 1)
    expect(person(u).fatigue!).toBeCloseTo(20, 6)
    expect(person(u).status).toBe('break')
    days(u, 1, 1)
    expect(person(u).status).toBe('working')
  })
})

describe('one penalty channel (E1 §3)', () => {
  it('fatigue never moves the morale target', () => {
    const s = company(1, 2, 'web', { fatigue: 70 })
    person(s, 'e2').fatigue = 0
    const o = computeOutputs(s, content)
    const g = globalMoraleTarget(s, content, o, 0)
    expect(employeeMoraleTarget(s, content, person(s, 'e1'), g)).toBe(employeeMoraleTarget(s, content, person(s, 'e2'), g))
  })

  it('computeOutputs: × 0.8 tired, × 0.4 burnt out, × 0 on leave, × 1.2 sprint, × 0.85 calm; low morale alone costs nothing extra', () => {
    const s = company(1, 7)
    const set = (id: string, over: Partial<Employee>) => Object.assign(person(s, id), over)
    set('e2', { fatigue: 70 })
    set('e3', { fatigue: 90 })
    set('e4', { offUntil: s.time.day + 3 })
    set('e6', { pace: 'calm' })
    // e7: tired by morale (status), fatigue 0; compared with e1 at the same morale.
    set('e7', { status: 'tired' })
    const base = computeOutputs(s, content).perEmployee
    const r = (id: string) => base[id]! / base['e1']!
    expect(r('e2')).toBeCloseTo(B.TIRED_OUTPUT, 6)
    expect(r('e3')).toBeCloseTo(B.BURNOUT_OUTPUT, 6)
    expect(r('e4')).toBe(0)
    expect(r('e6')).toBeCloseTo(B.PACE_OUTPUT.calm, 6)
    expect(r('e7')).toBeCloseTo(1, 6)
    s.projects[0]!.sprintUntil = s.time.day + 5
    const sp = computeOutputs(s, content).perEmployee
    expect(sp['e5']! / base['e5']!).toBeCloseTo(B.SPRINT_OUTPUT, 6)
    // The calm one is not swept into the sprint.
    expect(sp['e6']!).toBeCloseTo(base['e6']!, 6)
  })
})

describe('load (E1 §1)', () => {
  it("a teammate's leave raises the others' load", () => {
    const s = company(1, 3)
    const before = s.derived.people!['e2']!.load
    const r = api.applyAction(s, { type: 'giveLeave', employeeId: 'e1' })
    expect(r.state.derived.people!['e2']!.load).toBeGreaterThan(before)
  })

  it('the idle founder adds 0.5 supply', () => {
    const s = company(1, 2)
    const p = s.projects[0]!
    const d = projectDemand(s, p)
    expect(projectLoad(s, p)).toBeCloseTo(d / (2 + B.FOUNDER_PROJECT_OUTPUT), 6)
    s.founder.currentAction = { kind: 'findUsers', startDay: s.time.day, endDay: s.time.day + 3 }
    expect(projectLoad(s, p)).toBeCloseTo(d / 2, 6)
  })

  it('loadAvg moves at most 0.05 on the days a founder action starts and ends', () => {
    const s = company(1, 3)
    days(s, 60)
    const a0 = person(s).loadAvg!
    s.founder.currentAction = { kind: 'findUsers', startDay: s.time.day, endDay: s.time.day + 3 }
    days(s, 1)
    const a1 = person(s).loadAvg!
    expect(Math.abs(a1 - a0)).toBeLessThanOrEqual(0.05)
    days(s, 5)
    const a2 = person(s).loadAvg!
    delete s.founder.currentAction
    days(s, 1)
    expect(Math.abs(person(s).loadAvg! - a2)).toBeLessThanOrEqual(0.05)
  })

  it("an engineer's load never falls under the servers' share min(1, users / capacity)", () => {
    const s = company(1, 6)
    s.employees.push(emp('e9'))
    s.stats.users = 0
    recomputeDerived(s, content)
    s.stats.users = s.derived.capacity * 0.8
    recomputeDerived(s, content)
    expect(s.derived.people!['e9']!.load).toBeCloseTo(0.8, 6)
    // On a light project (six on a web one) the servers still set the floor.
    expect(s.derived.people!['e1']!.load).toBeGreaterThanOrEqual(0.8 - 1e-9)
    s.employees.push(emp('e10', { dept: 'product' }))
    recomputeDerived(s, content)
    expect(s.derived.people!['e10']!.load).toBe(0)
  })

  it('demand: unfinished full, finished × 0.6, finished with a module build open at its grown size', () => {
    const s = company(2, 2, 'mobile')
    const p = s.projects[0]!
    const full = B.PROJECT_SIZE.mobile * B.DEMAND_PER_SIZE * (1 + B.DEMAND_STAGE_GROWTH * 2)
    expect(projectDemand(s, p)).toBeCloseTo(full, 6)
    p.maturity = 1
    expect(projectDemand(s, p)).toBeCloseTo(full * B.FINISHED_DEMAND, 6)
    p.size = B.PROJECT_SIZE.mobile + 1
    p.build = { id: 'onboarding', progress: 0, startDay: 0 }
    expect(projectDemand(s, p)).toBeCloseTo((full * p.size) / B.PROJECT_SIZE.mobile, 6)
  })
})

describe('status order (E1 §4)', () => {
  it('in a retain grace a low-morale, burnt-out person stays: the burnout counter freezes', () => {
    const s = company(1, 1, 'web', { fatigue: 90, loadAvg: 2, morale: 20, burnoutDays: 3 })
    s.flags['retained:e1'] = s.time.day + 15.5
    days(s, 15, 2)
    expect(person(s).status).toBe('burnout')
    expect(person(s).burnoutDays).toBe(3)
  })

  it("10 days at 85+ → notice, cause 'burnout'; a leave resets the counter", () => {
    const s = company(1, 1, 'web', { fatigue: 90, loadAvg: 2 })
    days(s, 9, 2)
    expect(person(s).status).toBe('burnout')
    expect(person(s).burnoutDays).toBe(9)
    const r = api.applyAction(s, { type: 'giveLeave', employeeId: 'e1' })
    expect(r.ok).toBe(true)
    expect(person(r.state).burnoutDays).toBe(0)
    days(s, 1, 2)
    expect(person(s).status).toBe('leaving')
    expect(person(s).leaveCause).toBe('burnout')
    expect(s.events.some((e) => e.kind === 'burnedOut' && e.refId === 'e1')).toBe(true)
  })

  it("loadAvg 0.3 for 90 days → notice, cause 'bored', whatever the quality; one bored notice at a time", () => {
    const s = company(1, 2, 'web', { loadAvg: 0.3, quality: 0.6 })
    days(s, 89, 0.3)
    expect(person(s).status).not.toBe('leaving')
    days(s, 1, 0.3)
    expect(person(s, 'e1').leaveCause).toBe('bored')
    // e2 is as bored, but waits for e1's notice to be answered.
    expect(person(s, 'e2').status).not.toBe('leaving')
    expect(person(s, 'e2').boredDays).toBeGreaterThanOrEqual(B.BORED_QUIT_DAYS)
  })

  it('after a talk (or raise) boredDays is 45: unsolved, the next notice comes once the grace and 45 days are over', () => {
    const s = company(1, 1, 'web', { loadAvg: 0.3, boredDays: B.BORED_QUIT_DAYS - 1 })
    days(s, 1, 0.3)
    expect(person(s).status).toBe('leaving')
    const t = clone(api.applyAction(s, { type: 'respondResignation', employeeId: 'e1', response: 'raise' }).state)
    expect(person(t).boredDays).toBe(B.BORED_RETAIN_DAYS)
    expect(person(t).leaveCause).toBeUndefined()
    // Frozen while day < grace (the grace's last day already counts), then +1 a day from 45.
    days(t, B.BORED_RETAIN_DAYS + B.RETAIN_GRACE_DAYS - 2, 0.3)
    expect(person(t).status).not.toBe('leaving')
    days(t, 1, 0.3)
    expect(person(t).status).toBe('leaving')
    expect(person(t).leaveCause).toBe('bored')
  })

  it('a bored person moved to work (load ≥ 0.8) starts over', () => {
    const s = company(1, 1, 'web', { loadAvg: 0.3, boredDays: 60 })
    days(s, 12, 1.2)
    expect(person(s).boredDays).toBe(0)
  })

  it("a burnout notice answered: calm, 20 fatigue off, counter 0", () => {
    const s = company(1, 1, 'web', { fatigue: 95, loadAvg: 2, burnoutDays: B.BURNOUT_RESIGN_DAYS - 1 })
    days(s, 1, 2)
    expect(person(s).leaveCause).toBe('burnout')
    const f = person(s).fatigue!
    const r = api.applyAction(s, { type: 'respondResignation', employeeId: 'e1', response: 'raise' })
    expect(person(r.state).pace).toBe('calm')
    expect(person(r.state).fatigue).toBeCloseTo(f - 20, 6)
    expect(person(r.state).burnoutDays).toBe(0)
  })

  it('boredom costs morale (halved under a lead); flow adds FLOW_MORALE', () => {
    const s = company(2, 3, 'web', { loadAvg: 0.35 })
    expect(effortMorale(s, person(s))).toBeCloseTo((B.BORED_MORALE * (0.7 - 0.35)) / 0.7, 6)
    s.projects[0]!.leadId = 'e3'
    expect(effortMorale(s, person(s))).toBeCloseTo((B.BORED_MORALE * (0.7 - 0.35)) / 0.7 / 2, 6)
    const f = company(1, 1, 'web', { loadAvg: 1, skills: ['web'] })
    expect(effortMorale(f, person(f))).toBe(B.FLOW_MORALE)
  })
})

describe('skills (E1 §6)', () => {
  it('makeCandidate draws exactly as before (dept, quality, name): the skill is hashed', () => {
    const s = company(1, 1)
    const rng = new Rng(s.rng)
    const c = makeCandidate(s, content, rng)
    const replay = new Rng(s.rng)
    const d = replay.weighted(DEPTS, (x) => B.CANDIDATE_DEPT_WEIGHT[x]) ?? 'eng'
    const q = Math.round(replay.range(B.CANDIDATE_QUALITY_MIN, B.CANDIDATE_QUALITY_MAX) * 100) / 100
    const names = content.employeeNames.filter((n) => !s.employees.some((e) => e.name === n))
    expect(c.name).toBe(replay.pick(names))
    expect([c.dept, c.quality]).toEqual([d, q])
    expect(rng.snapshot()).toEqual(replay.snapshot())
  })

  it('with a project, 55–65% of 200 builder candidates know its category', () => {
    const s = company(1, 1, 'game')
    const rng = new Rng(s.rng)
    let hit = 0
    for (let i = 0; i < 200; i++) {
      const c = makeCandidate(s, content, rng, i % 2 ? 'eng' : 'product')
      expect(c.skills?.length).toBe(1)
      if (c.skills![0] === 'game') hit += 1
    }
    expect(hit / 200).toBeGreaterThanOrEqual(0.55)
    expect(hit / 200).toBeLessThanOrEqual(0.65)
    expect(makeCandidate(s, content, rng, 'marketing').skills).toBeUndefined()
  })

  it('90 days on a category teaches it, at most two; an old save starts with none (no fit)', () => {
    const s = company(1, 1, 'web')
    expect(s.derived.people!['e1']!.fit).toBe(false)
    days(s, B.SKILL_LEARN_DAYS - 1, 1)
    expect(person(s).skills).toBeUndefined()
    days(s, 1, 1)
    expect(person(s).skills).toEqual(['web'])
    recomputeDerived(s, content)
    expect(s.derived.people!['e1']!.fit).toBe(true)
    s.projects[0]!.category = 'ai'
    days(s, B.SKILL_LEARN_DAYS, 1)
    s.projects[0]!.category = 'game'
    days(s, B.SKILL_LEARN_DAYS, 1)
    expect(person(s).skills).toEqual(['web', 'ai'])
  })

  it('hiring copies the skill and keeps the auto-assignment (least mature unfinished project)', () => {
    const s = company(1, 0, 'web')
    s.projects.push({ ...s.projects[0]!, id: 'p2', name: 'Q', maturity: 0.1, assignedIds: [] })
    const e = hireCandidate(s, { id: 'c1', name: 'N', dept: 'eng', quality: 1, salary: 3000, expiresDay: 99, skills: ['api'] }, undefined)
    expect(e.skills).toEqual(['api'])
    expect(e.projectId).toBe('p2')
  })

  it('a fit builder makes × FIT_OUTPUT on the project', () => {
    const s = company(1, 2)
    s.founder.currentAction = { kind: 'findUsers', startDay: 0, endDay: 99 }
    const plain = maturityRates(s, computeOutputs(s, content))['p1']!
    person(s, 'e1').skills = ['web']
    person(s, 'e2').skills = ['web']
    expect(maturityRates(s, computeOutputs(s, content))['p1']! / plain).toBeCloseTo(B.FIT_OUTPUT, 9)
  })
})

describe('flow (E1 §7)', () => {
  it('90 flow days → quality + 0.03 (capped 1.5), "grew"; no output multiplier; the next raise prices it', () => {
    const s = company(1, 3, 'web', { skills: ['web'], loadAvg: 1 })
    // Three on a Pre-seed web project + the founder: load 3 / 3.5 ≈ 0.86, inside the flow band.
    person(s, 'e2').quality = 1.49
    recomputeDerived(s, content)
    expect(s.derived.people!['e1']!.flow).toBe(true)
    days(s, B.FLOW_GROW_DAYS)
    expect(person(s, 'e1').quality).toBeCloseTo(1.03, 6)
    expect(person(s, 'e2').quality).toBeCloseTo(1.5, 6)
    expect(s.activity.some((a) => a.kind === 'grew')).toBe(true)
    // Same morale, one in flow and one not: the same output.
    const o = computeOutputs(s, content)
    person(s, 'e3').skills = []
    expect(computeOutputs(s, content).perEmployee['e3']).toBeCloseTo(o.perEmployee['e3']!, 9)
    const e = person(s, 'e1')
    e.hiredDay = s.time.day - B.RAISE_EVERY_DAYS
    e.raises = 0
    yearlyRaises(s)
    expect(e.salary).toBeCloseTo(3000 * (1 + B.RAISE_YEARLY + B.FLOW_RAISE_PER_QUALITY * 0.03), 6)
    expect(e.qualityGain).toBeUndefined()
  })
})

describe('sprint (E1 §8)', () => {
  it('garage notUnlocked; 14 days then off; cooldown; on:false keeps it; no crunch counted', () => {
    expect(api.applyAction(company(0, 2), { type: 'sprint', projectId: 'p1', on: true }).error).toBe('notUnlocked')
    let s = company(1, 2)
    const r = api.applyAction(s, { type: 'sprint', projectId: 'p1', on: true })
    expect(r.ok).toBe(true)
    expect(api.applyAction(r.state, { type: 'sprint', projectId: 'p1', on: true }).error).toBe('invalid')
    // Started on day 0: days 1–14 tick in the sprint, it is over on day 15.
    s = api.step(r.state, 14.5)
    expect(s.derived.people!['e1']!.pace).toBe('sprint')
    s = api.step(s, 1)
    expect(s.derived.people!['e1']!.pace).toBe('normal')
    expect(api.applyAction(s, { type: 'sprint', projectId: 'p1', on: true }).error).toBe('cooldown')
    s = api.step(s, B.SPRINT_COOLDOWN_DAYS)
    const again = api.applyAction(s, { type: 'sprint', projectId: 'p1', on: true })
    expect(again.ok).toBe(true)
    const off = api.applyAction(again.state, { type: 'sprint', projectId: 'p1', on: false })
    expect(off.ok).toBe(true)
    expect(off.state.derived.people!['e1']!.pace).toBe('normal')
    expect(off.state.projects[0]!.sprintReadyDay).toBe(again.state.projects[0]!.sprintReadyDay)
    expect(api.applyAction(off.state, { type: 'sprint', projectId: 'p1', on: false }).error).toBe('invalid')
    expect(off.state.counters.crunches).toBeUndefined()
  })

  it('Series A with 5 engineers: debt + 0.5; a calm one keeps their pace', () => {
    const s = company(3, 5)
    person(s, 'e5').pace = 'calm'
    const r = api.applyAction({ ...s, techDebt: 2 }, { type: 'sprint', projectId: 'p1', on: true })
    expect(r.state.techDebt).toBeCloseTo(2.5, 9)
    expect(r.state.derived.people!['e5']!.pace).toBe('calm')
    expect(r.state.derived.people!['e1']!.pace).toBe('sprint')
  })

  it('needs work left: finished → invalid, finished with a module build → ok; no builders → invalid', () => {
    const s = company(2, 2)
    s.projects[0]!.maturity = 1
    expect(api.applyAction(s, { type: 'sprint', projectId: 'p1', on: true }).error).toBe('invalid')
    s.projects[0]!.build = { id: 'feedback', progress: 0, startDay: 0 }
    expect(api.applyAction(s, { type: 'sprint', projectId: 'p1', on: true }).ok).toBe(true)
    const t = company(2, 0)
    expect(api.applyAction(t, { type: 'sprint', projectId: 'p1', on: true }).error).toBe('invalid')
    expect(api.applyAction(t, { type: 'sprint', projectId: 'nope', on: true }).error).toBe('notFound')
  })
})

describe('leave and pace actions (E1 §9–10)', () => {
  it('giveLeave: garage notUnlocked, onboarding / leaving / on leave invalid, 30-day cooldown', () => {
    expect(api.applyAction(company(0, 1), { type: 'giveLeave', employeeId: 'e1' }).error).toBe('notUnlocked')
    const s = company(1, 1)
    expect(api.applyAction(s, { type: 'giveLeave', employeeId: 'x' }).error).toBe('notFound')
    expect(api.applyAction({ ...s, employees: [{ ...s.employees[0]!, status: 'onboarding' }] }, { type: 'giveLeave', employeeId: 'e1' }).error).toBe('invalid')
    const r = api.applyAction(s, { type: 'giveLeave', employeeId: 'e1' })
    expect(r.state.employees[0]!.offUntil).toBe(Math.floor(s.time.day) + B.LEAVE_DAYS + 1)
    expect(api.applyAction(r.state, { type: 'giveLeave', employeeId: 'e1' }).error).toBe('invalid')
    const later = api.step(r.state, 10)
    expect(api.applyAction(later, { type: 'giveLeave', employeeId: 'e1' }).error).toBe('cooldown')
    expect(api.applyAction(api.step(later, 21), { type: 'giveLeave', employeeId: 'e1' }).ok).toBe(true)
  })

  it('setPace: garage notUnlocked, a bad pace or a leaver invalid; clears the auto-calm', () => {
    expect(api.applyAction(company(0, 1), { type: 'setPace', employeeId: 'e1', pace: 'calm' }).error).toBe('notUnlocked')
    const s = company(1, 1, 'web', { autoCalm: true, pace: 'calm' })
    expect(api.applyAction(s, { type: 'setPace', employeeId: 'e1', pace: 'fast' as 'calm' }).error).toBe('invalid')
    const r = api.applyAction(s, { type: 'setPace', employeeId: 'e1', pace: 'calm' })
    expect(r.state.employees[0]!.autoCalm).toBeUndefined()
    expect(r.state.employees[0]!.pace).toBe('calm')
    expect(api.applyAction({ ...s, employees: [{ ...s.employees[0]!, status: 'leaving' }] }, { type: 'setPace', employeeId: 'e1', pace: 'normal' }).error).toBe('invalid')
  })
})

describe('lead (E1 §11)', () => {
  it('Seed+, 3+ builders, no move; the raise once; the old lead loses morale', () => {
    expect(api.applyAction(company(1, 3), { type: 'setLead', projectId: 'p1', employeeId: 'e1' }).error).toBe('notUnlocked')
    expect(api.applyAction(company(2, 2), { type: 'setLead', projectId: 'p1', employeeId: 'e1' }).error).toBe('invalid')
    const s = company(2, 3)
    s.employees.push(emp('m1', { dept: 'marketing' }))
    expect(api.applyAction(s, { type: 'setLead', projectId: 'p1', employeeId: 'm1' }).error).toBe('invalid')
    const moves = s.founder.moves?.left
    let r = api.applyAction(s, { type: 'setLead', projectId: 'p1', employeeId: 'e1' })
    expect(r.ok).toBe(true)
    expect(r.state.founder.moves?.left).toBe(moves)
    expect(person(r.state, 'e1').salary).toBe(Math.round(3000 * B.LEAD_SALARY_FACTOR))
    r = api.applyAction(r.state, { type: 'setLead', projectId: 'p1', employeeId: 'e2' })
    expect(person(r.state, 'e1').morale).toBe(70 + B.DEMOTE_MORALE)
    r = api.applyAction(r.state, { type: 'setLead', projectId: 'p1', employeeId: 'e1' })
    expect(person(r.state, 'e1').salary).toBe(Math.round(3000 * B.LEAD_SALARY_FACTOR))
    r = api.applyAction(r.state, { type: 'setLead', projectId: 'p1', employeeId: null })
    expect(r.state.projects[0]!.leadId).toBeUndefined()
    expect(r.state.activity.some((a) => a.kind === 'leadSet')).toBe(true)
  })

  it('auto-calm: only normal-pace members at 60+, back at 25; a manual calm stays', () => {
    const s = company(2, 4, 'web', { fatigue: 65 })
    s.projects[0]!.leadId = 'e1'
    person(s, 'e3').pace = 'calm'
    person(s, 'e4').fatigue = 30
    days(s, 1, 1)
    expect(person(s, 'e2').pace).toBe('calm')
    expect(person(s, 'e2').autoCalm).toBe(true)
    expect(person(s, 'e3').autoCalm).toBeUndefined()
    expect(person(s, 'e4').pace ?? 'normal').toBe('normal')
    // The lead is not a member.
    expect(person(s, 'e1').pace ?? 'normal').toBe('normal')
    days(s, 30, 1)
    expect(person(s, 'e2').pace).toBe('normal')
    expect(person(s, 'e2').autoCalm).toBeUndefined()
    expect(person(s, 'e3').pace).toBe('calm')
  })

  it("no lead: a crowd of 9 builders × 0.98, 8 × 1; the lead's own output × 0.75", () => {
    const rate = (s: GameState) => maturityRates(s, computeOutputs(s, content))['p1']!
    const per = (n: number) => {
      const s = company(2, n)
      s.founder.currentAction = { kind: 'findUsers', startDay: 0, endDay: 99 }
      return rate(s) / n
    }
    expect(per(9) / per(8)).toBeCloseTo(0.98, 6)
    const s = company(2, 9)
    s.founder.currentAction = { kind: 'findUsers', startDay: 0, endDay: 99 }
    const free = rate(s)
    s.projects[0]!.leadId = 'e1'
    expect(rate(s)).toBeCloseTo(((free / 0.98) * (8 + B.LEAD_OWN_OUTPUT)) / 9, 6)
  })

  it('assign away and removeEmployee clear the lead', () => {
    const s = company(2, 3)
    s.projects.push({ ...s.projects[0]!, id: 'p2', assignedIds: [] })
    let r = api.applyAction(s, { type: 'setLead', projectId: 'p1', employeeId: 'e1' })
    r = api.applyAction(r.state, { type: 'assign', employeeId: 'e1', projectId: 'p2' })
    expect(r.state.projects[0]!.leadId).toBeUndefined()
    r = api.applyAction(s, { type: 'setLead', projectId: 'p1', employeeId: 'e1' })
    r = api.applyAction(r.state, { type: 'fire', employeeId: 'e1' })
    expect(r.state.projects[0]!.leadId).toBeUndefined()
  })
})

describe('staffAttention (E1)', () => {
  it('leaving > burnout (≤ 2) > tired + bored (≤ 1) > idle; leads, acks and the garage keep quiet', () => {
    const s = company(1, 6)
    const set = (id: string, over: Partial<Employee>) => Object.assign(person(s, id), over)
    set('e1', { status: 'leaving' })
    set('e2', { fatigue: 86 })
    set('e3', { fatigue: 95 })
    set('e4', { fatigue: 90 })
    set('e5', { fatigue: 70 })
    set('e6', { boredDays: 40, loadAvg: 0.3 })
    s.employees.push(emp('i1', { projectId: undefined }))
    expect(staffAttention(s)).toEqual([['e1', 'leaving'], ['e3', 'burnout'], ['e4', 'burnout'], ['e5', 'tired'], ['i1', 'idle']])
    set('e5', { ackDay: s.time.day })
    expect(staffAttention(s).map(([, n]) => n)).toEqual(['leaving', 'burnout', 'burnout', 'bored', 'idle'])
    s.projects[0]!.leadId = 'e2'
    expect(staffAttention(s).some(([, n]) => n === 'bored' || n === 'tired')).toBe(false)
    s.time.day += B.STAFF_ACK_DAYS + 1
    expect(staffAttention(s).some(([, n]) => n === 'tired')).toBe(false)
    const g = company(0, 3, 'web', { fatigue: 90, boredDays: 50, loadAvg: 0.2 })
    expect(staffAttention(g)).toEqual([])
  })
})

describe('saves (E1)', () => {
  it('an old v4 save with none of the fields loads and steps: pace normal, fatigue 0, no NaN; derived.people is never saved', () => {
    const s = company(1, 3)
    const raw = serialize(s)
    expect(raw.includes('"people"')).toBe(false)
    const back = deserialize(raw)!
    expect(back.meta.saveVersion).toBe(SAVE_VERSION)
    const next = api.step(back, 40)
    for (const e of next.employees) {
      expect(Number.isFinite(e.fatigue ?? 0)).toBe(true)
      expect(Number.isFinite(e.loadAvg!)).toBe(true)
      expect(e.pace ?? 'normal').toBe('normal')
    }
    expect(next.derived.people!['e1']!.pace).toBe('normal')
    expect(next.employees[0]!.fatigue ?? 0).toBe(0)
    expect(Number.isFinite(next.finance.valuation)).toBe(true)
  })
})

describe('module builds (W2a × E1)', () => {
  it('tired builders slow a module build', () => {
    const s = company(2, 3)
    const p = s.projects[0]!
    p.maturity = 1
    p.build = { id: 'feedback', progress: 0, startDay: 0 }
    s.founder.currentAction = { kind: 'findUsers', startDay: 0, endDay: 99 }
    recomputeDerived(s, content)
    const fresh = s.derived.maturityPerDay!['p1']!
    for (const e of s.employees) e.fatigue = 70
    recomputeDerived(s, content)
    expect(s.derived.maturityPerDay!['p1']! / fresh).toBeCloseTo(B.TIRED_OUTPUT, 6)
    // dailyEffort is a no-op in the garage.
    const g = company(0, 1)
    dailyEffort(g, content)
    expect(g.employees[0]!.loadAvg).toBeUndefined()
  })
})
