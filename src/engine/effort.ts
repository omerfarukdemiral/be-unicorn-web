// Effort management (E1, docs/GAMEPLAY_V2.md "Efor yönetimi"): per-person load, fatigue, boredom, flow and skills,
// the project sprint and the project lead. Pure helpers: derive reads them for output and morale targets, dailyPeople
// runs dailyEffort once a day. One penalty channel each: fatigue only multiplies output, boredom only moves morale.
// Off in the garage (stage < EFFORT_MIN_STAGE): nothing moves there and every factor is 1.
import * as B from './balance'
import { auraAt, findSlot } from './office'
import { PROJECT_CATEGORIES, type EffectivePace, type Employee, type EmployeeId, type GameState, type PersonEffort, type Project, type ProjectCategory, type ProjectId } from './types'
import { pushActivity, type EngineContent } from './util'

export const effortOn = (s: Pick<GameState, 'stage'>): boolean => s.stage >= B.EFFORT_MIN_STAGE
export const isBuilder = (e: Pick<Employee, 'dept'>): boolean => e.dept === 'eng' || e.dept === 'product'
export const onLeave = (e: Pick<Employee, 'offUntil'>, day: number): boolean => (e.offUntil ?? -Infinity) > day
export const isSprinting = (p: Pick<Project, 'sprintUntil'>, day: number): boolean => (p.sprintUntil ?? -Infinity) > day
/** Work left to push: unfinished, or a module build open. */
export const hasOpenWork = (p: Pick<Project, 'maturity' | 'build'>): boolean => p.maturity < 1 || p.build !== undefined
/** On a project with a lead, and not the lead: the members' relief (fatigue, boredom, no tired / bored bubble). */
export const ledMember = (p: Project | undefined, e: Pick<Employee, 'id'>): boolean => p?.leadId !== undefined && p.leadId !== e.id

/** Stable string hash (the break-day offset, a candidate's skill): no rng draw. */
export function idHash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

/** Deterministic break day: every BREAK_EVERY_DAYS days, offset per employee. */
export function isBreakDay(id: string, day: number): boolean {
  return (idHash(id) + day) % B.BREAK_EVERY_DAYS === 0
}

/** Mola (PLAN §7.2) needs a common-area item (coffee corner, kitchen…) in aura range of the desk. */
export function nearCommonArea(s: GameState, content: EngineContent, e: Employee): boolean {
  const slot = e.deskSlotId !== undefined ? findSlot(s.office, e.deskSlotId) : undefined
  return slot !== undefined && auraAt(s, content, slot) > 0
}

/**
 * A candidate's one skill, from the id's hash: with projects, CANDIDATE_FIT_BIAS of the pool knows one of their
 * categories and the rest one the company does not build; with none, any category.
 */
export function candidateSkill(s: Pick<GameState, 'projects'>, id: string): ProjectCategory {
  const h = idHash(id)
  const used = [...new Set(s.projects.map((p) => p.category))]
  if (!used.length) return PROJECT_CATEGORIES[h % PROJECT_CATEGORIES.length]!
  const k = Math.floor(h / 10)
  if (h % 10 < Math.round(B.CANDIDATE_FIT_BIAS * 10)) return used[k % used.length]!
  const rest = PROJECT_CATEGORIES.filter((c) => !used.includes(c))
  return rest.length ? rest[k % rest.length]! : used[k % used.length]!
}

/** The project the idle founder codes on (FOUNDER_PROJECT_OUTPUT): the oldest unfinished one, else the first. */
export function founderProject(s: GameState): Project | undefined {
  if (s.founder.currentAction) return undefined
  return s.projects.find((p) => p.maturity < 1) ?? s.projects[0]
}

/**
 * The single authority on a project's demand in builder-FTE: PROJECT_SIZE × DEMAND_PER_SIZE × (1 + growth × stage)
 * while unfinished; a finished one building a module asks the same at its grown size, an idle finished one × FINISHED_DEMAND.
 */
export function projectDemand(s: Pick<GameState, 'stage'>, p: Project): number {
  const base = B.PROJECT_SIZE[p.category] * B.DEMAND_PER_SIZE * (1 + B.DEMAND_STAGE_GROWTH * s.stage)
  if (p.maturity < 1) return base
  if (p.build) return (base * p.size) / B.PROJECT_SIZE[p.category]
  return base * B.FINISHED_DEMAND
}

/** FTE one builder brings: 1 working, ONBOARDING 0.5, less when tired / burnt out, 0 on leave. */
export function supplyOf(e: Employee, day: number): number {
  if (onLeave(e, day)) return 0
  const f = e.fatigue ?? 0
  const base = e.status === 'onboarding' ? B.SUPPLY_ONBOARDING : 1
  return base * (f >= B.FATIGUE_BURNOUT ? B.SUPPLY_BURNOUT : f >= B.FATIGUE_TIRED ? B.SUPPLY_TIRED : 1)
}

/**
 * Load on a project's builders: demand / max(LOAD_MIN_SUPPLY, supply), 0–LOAD_CAP. Supply = its non-founder builders'
 * FTE + FOUNDER_PROJECT_OUTPUT when the founder codes on it; `extra` adds FTE (the UI's "if they joined" preview).
 */
export function projectLoad(s: GameState, p: Project, extra = 0, byId?: ReadonlyMap<EmployeeId, Employee>, founderOn = founderProject(s)): number {
  const day = s.time.day
  let supply = (p === founderOn ? B.FOUNDER_PROJECT_OUTPUT : 0) + extra
  for (const id of p.assignedIds) {
    const e = byId ? byId.get(id) : s.employees.find((x) => x.id === id)
    if (e && isBuilder(e)) supply += supplyOf(e, day)
  }
  return Math.min(B.LOAD_CAP, Math.max(0, projectDemand(s, p) / Math.max(B.LOAD_MIN_SUPPLY, supply)))
}

/** Every project's load (one pass; maturityRates and the people view share it). */
export function projectLoads(s: GameState, byId: ReadonlyMap<EmployeeId, Employee>): Record<ProjectId, number> {
  const fp = founderProject(s)
  const out: Record<ProjectId, number> = {}
  for (const p of s.projects) out[p.id] = projectLoad(s, p, 0, byId, fp)
  return out
}

/**
 * One person's instant load: a builder their project's (0 on none), an engineer at least the servers' share
 * (min(1, users / capacity)); ops 1 + overload (≤ 2); marketing and sales 1.
 */
export function workload(s: GameState, e: Employee, loads: Readonly<Record<ProjectId, number>>): number {
  if (e.dept === 'ops') return Math.min(B.LOAD_CAP, 1 + s.derived.overload)
  if (!isBuilder(e)) return 1
  const proj = e.projectId !== undefined ? (loads[e.projectId] ?? 0) : 0
  if (e.dept !== 'eng') return proj
  const cap = s.derived.capacity
  return Math.max(proj, cap > 0 ? Math.min(1, s.stats.users / cap) : 0)
}

/** Today's pace: their own; 'sprint' for a builder on a sprinting project unless calm. 'normal' in the garage. */
export function effectivePace(s: GameState, e: Employee, p: Project | undefined): EffectivePace {
  if (!effortOn(s)) return 'normal'
  const own = e.pace ?? 'normal'
  if (own === 'calm') return 'calm'
  return p && isBuilder(e) && isSprinting(p, s.time.day) ? 'sprint' : own
}

export const paceOutput = (pace: EffectivePace): number => (pace === 'sprint' ? B.SPRINT_OUTPUT : B.PACE_OUTPUT[pace])

/** Output multiplier read from the fatigue NUMBER (not the status, so low morale never doubles it); 0 on leave. */
export function fatigueFactor(s: GameState, e: Employee): number {
  if (!effortOn(s)) return 1
  if (onLeave(e, s.time.day)) return 0
  const f = e.fatigue ?? 0
  return f >= B.FATIGUE_BURNOUT ? B.BURNOUT_OUTPUT : f >= B.FATIGUE_TIRED ? B.TIRED_OUTPUT : 1
}

/** computeOutputs' effort factor: fatigue × pace (1 in the garage). */
export function effortOutput(s: GameState, e: Employee, p: Project | undefined): number {
  if (!effortOn(s)) return 1
  return fatigueFactor(s, e) * paceOutput(effectivePace(s, e, p))
}

/** A builder fluent in their project's category. */
export function fits(e: Employee, p: Project | undefined): boolean {
  return p !== undefined && isBuilder(e) && (e.skills?.includes(p.category) ?? false)
}

/** Flow: fit, loadAvg in [FLOW_LOAD_MIN, FLOW_LOAD_MAX], fatigue < FLOW_FATIGUE_MAX, not sprinting, not on leave. */
export function inFlow(s: GameState, e: Employee, p: Project | undefined): boolean {
  if (!effortOn(s) || !fits(e, p) || onLeave(e, s.time.day)) return false
  const la = e.loadAvg ?? 1
  return la >= B.FLOW_LOAD_MIN && la <= B.FLOW_LOAD_MAX && (e.fatigue ?? 0) < B.FLOW_FATIGUE_MAX && effectivePace(s, e, p) !== 'sprint'
}

/** Boredom's morale term: BORED_MORALE × (UNDERLOAD − loadAvg) / UNDERLOAD under UNDERLOAD, halved under a lead. */
export function boredMoraleTerm(s: GameState, e: Employee, p: Project | undefined): number {
  if (!effortOn(s) || e.dept === 'sales' || onLeave(e, s.time.day)) return 0
  const la = e.loadAvg ?? 1
  if (la >= B.UNDERLOAD) return 0
  return (B.BORED_MORALE * (B.UNDERLOAD - la)) / B.UNDERLOAD * (ledMember(p, e) ? B.LEAD_BORED_FACTOR : 1)
}

/** What effort adds to someone's morale target: boredom (−) and flow (+). Fatigue adds nothing (one channel). */
export function effortMorale(s: GameState, e: Employee): number {
  if (!effortOn(s)) return 0
  const p = e.projectId !== undefined ? s.projects.find((x) => x.id === e.projectId) : undefined
  return boredMoraleTerm(s, e, p) + (inFlow(s, e, p) ? B.FLOW_MORALE : 0)
}

/** A project with more than NO_LEAD_FREE builders and no lead slows: × max(NO_LEAD_MIN, 1 − LOSS × (n − FREE)). */
export function crowdFactor(p: Project, builders: number): number {
  if (p.leadId !== undefined || builders <= B.NO_LEAD_FREE) return 1
  return Math.max(B.NO_LEAD_MIN, 1 - B.NO_LEAD_LOSS_PER_PERSON * (builders - B.NO_LEAD_FREE))
}

/** Builders (eng / product) assigned to a project. */
export function buildersOf(s: GameState, p: Project, byId?: ReadonlyMap<EmployeeId, Employee>): Employee[] {
  const out: Employee[] = []
  for (const id of p.assignedIds) {
    const e = byId ? byId.get(id) : s.employees.find((x) => x.id === id)
    if (e && isBuilder(e)) out.push(e)
  }
  return out
}

/** derived.people: everyone's load, fatigue factor, pace, fit and flow today ({} in the garage). */
export function peopleView(s: GameState): Record<EmployeeId, PersonEffort> {
  const out: Record<EmployeeId, PersonEffort> = {}
  if (!effortOn(s)) return out
  const byId = new Map(s.employees.map((e) => [e.id, e]))
  const projects = new Map(s.projects.map((p) => [p.id, p]))
  const loads = projectLoads(s, byId)
  for (const e of s.employees) {
    const p = e.projectId !== undefined ? projects.get(e.projectId) : undefined
    out[e.id] = { load: workload(s, e, loads), fatigueFactor: fatigueFactor(s, e), pace: effectivePace(s, e, p), fit: fits(e, p), flow: inFlow(s, e, p) }
  }
  return out
}

/** One day's fatigue change at `pace` and load average `la`: pace + load − common area (and a break day) − lead relief. */
function fatigueDelta(s: GameState, content: EngineContent, e: Employee, pace: EffectivePace, la: number, day: number | null): number {
  const p = e.projectId !== undefined ? s.projects.find((x) => x.id === e.projectId) : undefined
  let d = (pace === 'sprint' ? B.SPRINT_FATIGUE : B.PACE_FATIGUE[pace]) + B.LOAD_FATIGUE * (la - 1)
  if (nearCommonArea(s, content, e)) {
    d -= B.COMMON_AREA_RECOVERY
    if (day === null) d -= B.BREAK_DAY_RECOVERY / B.BREAK_EVERY_DAYS
    else if (isBreakDay(e.id, day)) d -= B.BREAK_DAY_RECOVERY
  }
  if (ledMember(p, e)) d -= B.LEAD_FATIGUE_RELIEF
  return d
}

/**
 * The steady fatigue per day this person would have at `pace` (a break day counts as its daily average), for their load
 * average, common area and lead. The UI's side-by-side "Normal / Rahat" numbers; dailyEffort runs the same arithmetic.
 */
export function fatigueRate(s: GameState, content: EngineContent, e: Employee, pace: 'normal' | 'calm' | 'sprint'): number {
  return fatigueDelta(s, content, e, pace, e.loadAvg ?? 1, null)
}

/**
 * Daily, from Pre-seed (before the status machine): loadAvg moves 1/LOAD_AVG_DAYS toward today's load; fatigue moves by
 * pace + LOAD_FATIGUE × (loadAvg − 1) − break day − common area − lead relief (on leave: − LEAVE_RECOVERY_PER_DAY only);
 * builders learn their project's category, flow grows quality; a lead calms its tired members and lets them go back.
 * Sales stay out (load 1, no fatigue, no boredom).
 */
export function dailyEffort(s: GameState, content: EngineContent): void {
  if (!effortOn(s)) return
  const day = s.time.day
  const view = s.derived.people ?? peopleView(s)
  const projects = new Map(s.projects.map((p) => [p.id, p]))
  for (const e of s.employees) {
    if (e.dept === 'sales') continue
    const p = e.projectId !== undefined ? projects.get(e.projectId) : undefined
    const before = e.fatigue ?? 0
    if (onLeave(e, day)) {
      e.fatigue = Math.max(0, before - B.LEAVE_RECOVERY_PER_DAY)
      continue
    }
    const avg = e.loadAvg ?? 1
    const la = avg + ((view[e.id]?.load ?? avg) - avg) / B.LOAD_AVG_DAYS
    e.loadAvg = la
    const f = Math.min(100, Math.max(0, before + fatigueDelta(s, content, e, effectivePace(s, e, p), la, Math.floor(day))))
    if (f !== 0 || e.fatigue !== undefined) e.fatigue = f
    if (p && isBuilder(e)) learn(e, p.category)
    if (inFlow(s, e, p)) {
      e.flowDays = (e.flowDays ?? 0) + 1
      if (e.flowDays >= B.FLOW_GROW_DAYS) {
        e.flowDays = 0
        const q = Math.min(B.QUALITY_GROW_CAP, e.quality + B.FLOW_QUALITY_STEP)
        if (q > e.quality) {
          e.qualityGain = (e.qualityGain ?? 0) + (q - e.quality)
          e.quality = Math.round(q * 1000) / 1000
          pushActivity(s, 'grew', { name: e.name, id: e.id })
        }
      }
    }
  }
  autoCalm(s, projects)
}

/** SKILL_LEARN_DAYS on a category not yet known → learned (at most MAX_SKILLS). */
function learn(e: Employee, cat: ProjectCategory): void {
  const skills = e.skills ?? []
  if (skills.includes(cat) || skills.length >= B.MAX_SKILLS) return
  const days = (e.skillDays ??= {})
  days[cat] = (days[cat] ?? 0) + 1
  if (days[cat]! < B.SKILL_LEARN_DAYS) return
  e.skills = [...skills, cat]
  delete days[cat]
}

/**
 * A lead sets normal-pace members calm at LEAD_AUTO_CALM_AT; whoever it calmed goes back to normal at LEAD_AUTO_NORMAL_AT
 * (lead or not by then). A manual calm or a sprint stays the player's.
 */
function autoCalm(s: GameState, projects: ReadonlyMap<ProjectId, Project>): void {
  for (const e of s.employees) {
    const f = e.fatigue ?? 0
    if (e.autoCalm) {
      if (f <= B.LEAD_AUTO_NORMAL_AT) {
        e.pace = 'normal'
        delete e.autoCalm
      }
      continue
    }
    const p = e.projectId !== undefined ? projects.get(e.projectId) : undefined
    if (p && ledMember(p, e) && !isSprinting(p, s.time.day) && (e.pace ?? 'normal') === 'normal' && f >= B.LEAD_AUTO_CALM_AT) {
      e.pace = 'calm'
      e.autoCalm = true
    }
  }
}
