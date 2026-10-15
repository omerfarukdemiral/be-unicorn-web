// Hiring pool, employee statuses, morale drift and the resignation warning window (PLAN §5.7).
import * as B from './balance'
import * as E from './economy'
import { employeeMoraleTarget, globalMoraleTarget, type Outputs } from './derive'
import { candidateSkill, dailyEffort, effortOn, isBreakDay, nearCommonArea, onLeave } from './effort'
import type { Rng } from './rng'
import { DEPTS, type Candidate, type Dept, type Employee, type GameState, type LeaveCause } from './types'
import { incCounter, newId, policyHas, policyMult, policyQualityCap, policySum, pushActivity, pushEvent, type EngineContent } from './util'

/** Pool size: base + stage up to the max, plus what the policies add on top of the max (hire-fast +2, GAMEPLAY V2 §7.2: the law's point is a bigger pool than any stage gives). */
export function candidatePoolSize(s: GameState, content?: EngineContent): number {
  return Math.min(B.CANDIDATE_POOL_MAX, B.CANDIDATE_POOL_BASE + s.stage) + (content ? policySum(s, content, 'candidates') : 0)
}

export function makeCandidate(s: GameState, content: EngineContent, rng: Rng, dept?: Dept): Candidate {
  const d = dept ?? rng.weighted(DEPTS, (x) => B.CANDIDATE_DEPT_WEIGHT[x]) ?? 'eng'
  // salary-freeze (§7.2): stars do not apply to a company that froze pay (the draw stays the same, the ceiling cuts it).
  const quality = Math.min(policyQualityCap(s, content), Math.round(rng.range(B.CANDIDATE_QUALITY_MIN, B.CANDIDATE_QUALITY_MAX) * 100) / 100)
  const used = new Set([...s.employees.map((e) => e.name), ...s.candidates.map((c) => c.name)])
  const names = content.employeeNames.filter((n) => !used.has(n))
  const id = newId(s, 'c')
  const name = names.length ? rng.pick(names) : content.employeeNames.length ? `${rng.pick(content.employeeNames)} ${id}` : id
  const salary = Math.round(E.salary(B.BASE_SALARY[d], s.stage) * (0.85 + 0.3 * (quality - B.CANDIDATE_QUALITY_MIN) / (B.CANDIDATE_QUALITY_MAX - B.CANDIDATE_QUALITY_MIN)))
  // E1: a builder's one skill comes from the id's hash, so the pool's draws (and names) stay what they were.
  const skills = d === 'eng' || d === 'product' ? { skills: [candidateSkill(s, id)] } : {}
  return { id, name, dept: d, quality, salary, expiresDay: s.time.day + B.CANDIDATE_LIFETIME_DAYS, ...skills }
}

/** Refill the pool; the first pool always offers eng, product and marketing. */
export function fillCandidates(s: GameState, content: EngineContent, rng: Rng, guaranteeCore = false): void {
  if (guaranteeCore) {
    for (const d of ['eng', 'product', 'marketing'] as const) {
      if (!s.candidates.some((c) => c.dept === d)) s.candidates.push(makeCandidate(s, content, rng, d))
    }
  }
  while (s.candidates.length < candidatePoolSize(s, content)) s.candidates.push(makeCandidate(s, content, rng))
}

/**
 * Yearly market raise (GAMEPLAY V2 §4.2), on payday: someone RAISE_EVERY_DAYS or longer in the company with fewer
 * raises than full years served gets salary × (1 + RAISE_YEARLY). `raises` is the only source of truth, so the first
 * payday after a hire never raises and a year pays once. An old save (no `raises`) counts the years already served as
 * paid: no back pay, the next anniversary raises.
 */
export function yearlyRaises(s: GameState, content?: EngineContent): void {
  // salary-freeze (§7.2): no raise while it stands (it never goes; the years served stay unpaid).
  if (content && policyHas(s, content, 'noRaises')) return
  for (const e of s.employees) {
    const years = Math.floor((s.time.day - e.hiredDay + 1e-6) / B.RAISE_EVERY_DAYS)
    e.raises ??= years
    if (years < 1 || e.raises >= years) continue
    // E1: quality grown in flow since the last raise is priced in too.
    e.salary *= 1 + B.RAISE_YEARLY + B.FLOW_RAISE_PER_QUALITY * (e.qualityGain ?? 0)
    delete e.qualityGain
    e.raises += 1
  }
}

export function refreshCost(s: GameState): number {
  return Math.round(B.REFRESH_COST_BASE * B.SALARY_STAGE_GROWTH ** s.stage)
}

export function removeEmployee(s: GameState, id: string): Employee | undefined {
  const idx = s.employees.findIndex((e) => e.id === id)
  if (idx < 0) return undefined
  const [e] = s.employees.splice(idx, 1)
  for (const slot of s.office.slots) if (slot.occupantId === id) delete slot.occupantId
  for (const p of s.projects) {
    p.assignedIds = p.assignedIds.filter((x) => x !== id)
    if (p.leadId === id) delete p.leadId
  }
  return e
}

function setStatus(e: Employee, status: Employee['status'], day: number): void {
  if (e.status === status) return
  e.status = status
  e.statusSinceDay = day
}

/** Continuous: individual morale drifts toward its target (global + desk auras). */
export function driftMorale(s: GameState, content: EngineContent, o: Outputs, dtDays: number): void {
  const gTarget = globalMoraleTarget(s, content, o, s.derived.overload)
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

/**
 * Daily: effort first (E1, from Pre-seed), then statuses, resignation warnings and walk-outs. No random punishment:
 * warning first, then a window. Order: (a) leaving walks out on its day; (b) morale under the bar outside a retain grace
 * → notice; (c) BURNOUT_RESIGN_DAYS at FATIGUE_BURNOUT → notice; (d) BORED_QUIT_DAYS bored → notice (one bored notice at
 * a time); (c) and (d) freeze in a grace and on leave; (e) the status, first match.
 */
export function dailyPeople(s: GameState, content: EngineContent): void {
  const day = s.time.day
  const quitAt = resignMorale(s, content)
  const effort = effortOn(s)
  dailyEffort(s, content)
  let boredNotice = s.employees.some((e) => e.status === 'leaving' && e.leaveCause === 'bored')
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
    if (e.morale < quitAt && day >= grace) {
      notice(s, e, 'morale')
      continue
    }
    const off = onLeave(e, day)
    if (effort && !off && e.dept !== 'sales' && day >= grace) {
      if ((e.fatigue ?? 0) >= B.FATIGUE_BURNOUT) {
        e.burnoutDays = (e.burnoutDays ?? 0) + 1
        if (e.burnoutDays === 1) {
          pushActivity(s, 'burnedOut', { name: e.name, id: e.id })
          pushEvent(s, { kind: 'burnedOut', refId: e.id })
        }
      } else if (e.burnoutDays) e.burnoutDays = 0
      if ((e.burnoutDays ?? 0) >= B.BURNOUT_RESIGN_DAYS) {
        notice(s, e, 'burnout')
        continue
      }
      const la = e.loadAvg ?? 1
      if (la < B.UNDERLOAD) e.boredDays = (e.boredDays ?? 0) + 1
      else if (la >= B.BORED_RESET_LOAD && e.boredDays) e.boredDays = 0
      if ((e.boredDays ?? 0) >= B.BORED_QUIT_DAYS && !boredNotice) {
        notice(s, e, 'bored')
        boredNotice = true
        continue
      }
    }
    const fatigue = e.fatigue ?? 0
    if (day - e.hiredDay < B.ONBOARDING_DAYS) setStatus(e, 'onboarding', day)
    else if (off) setStatus(e, 'break', day)
    else if (fatigue >= B.FATIGUE_BURNOUT || e.morale < quitAt) setStatus(e, 'burnout', day)
    else if (fatigue >= B.FATIGUE_TIRED || e.morale < B.TIRED_MORALE) setStatus(e, 'tired', day)
    else if (isBreakDay(e.id, Math.floor(day)) && nearCommonArea(s, content, e)) setStatus(e, 'break', day)
    else setStatus(e, 'working', day)
  }
}

/**
 * The resignation notice: RESIGN_WARNING_DAYS to answer it (respondResignation; BURNOUT_NOTICE_DAYS for a burnout),
 * tagged with its cause. Every cause pushes `resignNotice` (value = days left): the store slows the game on it.
 */
function notice(s: GameState, e: Employee, cause: LeaveCause): void {
  const days = cause === 'burnout' ? B.BURNOUT_NOTICE_DAYS : B.RESIGN_WARNING_DAYS
  setStatus(e, 'leaving', s.time.day)
  e.leaveDay = s.time.day + days
  e.leaveCause = cause
  pushActivity(s, 'resignWarning', { name: e.name, id: e.id, cause })
  pushEvent(s, { kind: 'resignNotice', refId: e.id, value: days })
  if (cause === 'bored') pushEvent(s, { kind: 'bored', refId: e.id })
}

/**
 * Morale under which someone hands in their notice: RESIGN_MORALE, raised by RESIGN_RISK_MORALE per extra unit of the
 * policies' resignation risk (deferred-pay × 2 → 36; GAMEPLAY V2 §7.2).
 */
export function resignMorale(s: GameState, content: EngineContent): number {
  return B.RESIGN_MORALE + B.RESIGN_RISK_MORALE * Math.max(0, policyMult(s, content, 'resign') - 1)
}

/**
 * layoff-round (GAMEPLAY V2 §7.2): `share` of the team goes at once, the lowest quality first (the newest of equals),
 * with the severance the policies leave (0 for this policy). Returns how many left.
 */
export function layoff(s: GameState, content: EngineContent, share: number): number {
  const n = Math.round(s.employees.length * share)
  if (n <= 0) return 0
  const order = [...s.employees].sort((a, b) => a.quality - b.quality || b.hiredDay - a.hiredDay).slice(0, n)
  const severance = policyMult(s, content, 'severance')
  for (const e of order) {
    removeEmployee(s, e.id)
    s.stats.cash -= e.salary * B.SEVERANCE_MONTHS * severance
    incCounter(s, 'fires')
    pushActivity(s, 'fired', { name: e.name, id: e.id })
    pushEvent(s, { kind: 'fired', refId: e.id })
  }
  return n
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
    ...(c.skills?.length ? { skills: [...c.skills] } : {}),
  }
  s.employees.push(e)
  s.candidates = s.candidates.filter((x) => x.id !== c.id)
  if (deskSlotId !== undefined) {
    const slot = s.office.slots.find((x) => x.id === deskSlotId)
    if (slot) {
      slot.occupantId = e.id
      // Grid §2: an unlabelled desk takes its first sitter's team.
      if (slot.type === 'desk' && slot.team === undefined) slot.team = e.dept
    }
  }
  // Builders join the least mature unfinished project; with none left they wait for the next one (idleBuilders).
  if (e.dept === 'eng' || e.dept === 'product') {
    let p: (typeof s.projects)[number] | undefined
    for (const x of s.projects) if (x.maturity < 1 && (!p || x.maturity < p.maturity)) p = x
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
