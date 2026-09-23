// Hiring pool, employee statuses, morale drift and the resignation warning window (PLAN §5.7).
import * as B from './balance'
import * as E from './economy'
import { employeeMoraleTarget, globalMoraleTarget, type Outputs } from './derive'
import { auraAt, findSlot } from './office'
import type { Rng } from './rng'
import { DEPTS, type Candidate, type Dept, type Employee, type GameState } from './types'
import { incCounter, newId, pushActivity, pushEvent, type EngineContent } from './util'

export function candidatePoolSize(s: GameState): number {
  return Math.min(B.CANDIDATE_POOL_MAX, B.CANDIDATE_POOL_BASE + s.stage)
}

export function makeCandidate(s: GameState, content: EngineContent, rng: Rng, dept?: Dept): Candidate {
  const d = dept ?? rng.weighted(DEPTS, (x) => B.CANDIDATE_DEPT_WEIGHT[x]) ?? 'eng'
  const quality = Math.round(rng.range(B.CANDIDATE_QUALITY_MIN, B.CANDIDATE_QUALITY_MAX) * 100) / 100
  const used = new Set([...s.employees.map((e) => e.name), ...s.candidates.map((c) => c.name)])
  const names = content.employeeNames.filter((n) => !used.has(n))
  const id = newId(s, 'c')
  const name = names.length ? rng.pick(names) : content.employeeNames.length ? `${rng.pick(content.employeeNames)} ${id}` : id
  const salary = Math.round(E.salary(B.BASE_SALARY[d], s.stage) * (0.85 + 0.3 * (quality - B.CANDIDATE_QUALITY_MIN) / (B.CANDIDATE_QUALITY_MAX - B.CANDIDATE_QUALITY_MIN)))
  return { id, name, dept: d, quality, salary, expiresDay: s.time.day + B.CANDIDATE_LIFETIME_DAYS }
}

/** Refill the pool; the first pool always offers eng, product and marketing. */
export function fillCandidates(s: GameState, content: EngineContent, rng: Rng, guaranteeCore = false): void {
  if (guaranteeCore) {
    for (const d of ['eng', 'product', 'marketing'] as const) {
      if (!s.candidates.some((c) => c.dept === d)) s.candidates.push(makeCandidate(s, content, rng, d))
    }
  }
  while (s.candidates.length < candidatePoolSize(s)) s.candidates.push(makeCandidate(s, content, rng))
}

export function refreshCost(s: GameState): number {
  return Math.round(B.REFRESH_COST_BASE * B.SALARY_STAGE_GROWTH ** s.stage)
}

export function removeEmployee(s: GameState, id: string): Employee | undefined {
  const idx = s.employees.findIndex((e) => e.id === id)
  if (idx < 0) return undefined
  const [e] = s.employees.splice(idx, 1)
  for (const slot of s.office.slots) if (slot.occupantId === id) delete slot.occupantId
  for (const p of s.projects) p.assignedIds = p.assignedIds.filter((x) => x !== id)
  return e
}

function setStatus(e: Employee, status: Employee['status'], day: number): void {
  if (e.status === status) return
  e.status = status
  e.statusSinceDay = day
}

/** Continuous: individual morale drifts toward its target (global + desk auras). */
export function driftMorale(s: GameState, content: EngineContent, o: Outputs, dtDays: number): void {
  const gTarget = globalMoraleTarget(s, o, s.derived.overload)
  if (s.employees.length === 0) {
    s.stats.morale = E.approachMorale(s.stats.morale, E.clamp(0, 100, gTarget), dtDays)
    return
  }
  let sum = 0
  for (const e of s.employees) {
    e.morale = E.clamp(0, 100, E.approachMorale(e.morale, employeeMoraleTarget(s, content, e, gTarget), dtDays))
    sum += e.morale
  }
  s.stats.morale = sum / s.employees.length
}

/** Deterministic break day: every BREAK_EVERY_DAYS days, offset per employee. */
function isBreakDay(id: string, day: number): boolean {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h + day) % B.BREAK_EVERY_DAYS === 0
}

/** Daily: statuses, resignation warnings and walk-outs. No random punishment: warning first, then a window. */
export function dailyPeople(s: GameState, content: EngineContent): void {
  const day = s.time.day
  for (const e of [...s.employees]) {
    if (e.status === 'leaving') {
      if (e.leaveDay !== undefined && day >= e.leaveDay) {
        removeEmployee(s, e.id)
        incCounter(s, 'resignations')
        pushActivity(s, 'resigned', { name: e.name, id: e.id })
        pushEvent(s, { kind: 'resigned', refId: e.id })
      }
      continue
    }
    const grace = Number(s.flags[`retained:${e.id}`] ?? -1)
    if (e.morale < B.RESIGN_MORALE && day >= grace) {
      setStatus(e, 'leaving', day)
      e.leaveDay = day + B.RESIGN_WARNING_DAYS
      pushActivity(s, 'resignWarning', { name: e.name, id: e.id })
      continue
    }
    if (day - e.hiredDay < B.ONBOARDING_DAYS) setStatus(e, 'onboarding', day)
    else if (e.morale < B.RESIGN_MORALE) setStatus(e, 'burnout', day)
    else if (e.morale < B.TIRED_MORALE) setStatus(e, 'tired', day)
    else if (isBreakDay(e.id, Math.floor(day)) && nearCommonArea(s, content, e)) setStatus(e, 'break', day)
    else setStatus(e, 'working', day)
  }
}

/** Mola (PLAN §7.2) needs a common-area item (coffee corner, kitchen…) in aura range of the desk. */
function nearCommonArea(s: GameState, content: EngineContent, e: Employee): boolean {
  const slot = e.deskSlotId !== undefined ? findSlot(s.office, e.deskSlotId) : undefined
  return slot !== undefined && auraAt(s, content, slot) > 0
}

export function hireCandidate(s: GameState, c: Candidate, deskSlotId: string | undefined): Employee {
  const e: Employee = {
    id: newId(s, 'e'),
    name: c.name,
    dept: c.dept,
    quality: c.quality,
    salary: c.salary,
    status: 'onboarding',
    statusSinceDay: s.time.day,
    hiredDay: s.time.day,
    morale: Math.max(B.START_MORALE, s.stats.morale),
    ...(deskSlotId !== undefined ? { deskSlotId } : {}),
  }
  s.employees.push(e)
  s.candidates = s.candidates.filter((x) => x.id !== c.id)
  if (deskSlotId !== undefined) {
    const slot = s.office.slots.find((x) => x.id === deskSlotId)
    if (slot) slot.occupantId = e.id
  }
  // Builders join the oldest unfinished project.
  if (e.dept === 'eng' || e.dept === 'product') {
    const p = s.projects.find((x) => x.maturity < 1)
    if (p) {
      p.assignedIds.push(e.id)
      e.projectId = p.id
    }
  }
  incCounter(s, 'hires')
  s.counters.peakTeam = Math.max(s.counters.peakTeam ?? 0, s.employees.length)
  if (s.flags['firstHireDay'] === undefined) s.flags['firstHireDay'] = s.time.day
  pushActivity(s, 'hired', { name: e.name, id: e.id, dept: e.dept })
  pushEvent(s, { kind: 'hired', refId: e.id })
  return e
}
