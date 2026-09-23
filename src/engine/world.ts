// World flavour: milestones, ambient office bubbles, visitors, month-end bookkeeping, archetype.
import type { OfficeLine, OfficeLineTrigger } from '../content/index'
import * as B from './balance'
import type { Rng } from './rng'
import { NPC_ROLES, DEPTS, type Archetype, type GameState, type MilestoneId, type NpcRole } from './types'
import { incCounter, newId, pushActivity, pushEvent, uniquePush, type EngineContent } from './util'

export function hitMilestone(s: GameState, id: MilestoneId, value?: number): boolean {
  if (!uniquePush(s.milestones, id)) return false
  pushActivity(s, 'milestone', { milestone: id })
  pushEvent(s, { kind: 'milestone', milestone: id, ...(value !== undefined ? { value } : {}) })
  return true
}

/** Daily milestone checks. Returns newly hit ids. */
export function checkMilestones(s: GameState): MilestoneId[] {
  const hit: MilestoneId[] = []
  const u = s.stats.users
  if (u >= 100 && hitMilestone(s, 'users100')) hit.push('users100')
  if (u >= 1000 && hitMilestone(s, 'users1000')) hit.push('users1000')
  if (u >= 10_000 && hitMilestone(s, 'users10k')) hit.push('users10k')
  if (s.finance.mrr > 0 && hitMilestone(s, 'firstMrr', s.finance.mrr)) hit.push('firstMrr')
  if (s.projects.some((p) => p.launched) && hitMilestone(s, 'firstLaunch')) hit.push('firstLaunch')
  return hit
}

/** Month boundary: snapshots, growth streaks, profit month. */
export function monthEnd(s: GameState): void {
  s.finance.mrrHistory.push(s.finance.mrr)
  s.finance.usersHistory.push(s.stats.users)
  const h = s.finance.mrrHistory
  const prev = h[h.length - 2]
  const cur = h[h.length - 1] ?? 0
  if (cur > 0 && prev !== undefined && prev > 0 && (cur - prev) / prev < B.LOW_GROWTH_MOM) incCounter(s, 'lowGrowthMonths')
  else s.counters.lowGrowthMonths = 0
  if (s.finance.mrr > 0 && s.finance.net > 0) {
    incCounter(s, 'profitMonths')
    hitMilestone(s, 'firstProfitMonth', s.finance.net)
  }
  s.flags['manualLastMonth'] = Number(s.flags['manualThisMonth'] ?? 0)
  s.flags['manualThisMonth'] = 0
  s.flags['findUsesThisMonth'] = 0
  s.flags['salesCallsThisMonth'] = 0
}

/** Rival pressure 0–1 used by rival card conditions (PLAN §6.3 "baskı ≥ 0.35"). */
export function updateRivalPressure(s: GameState): void {
  const p = B.RIVAL_PRESSURE_BASE + B.RIVAL_PRESSURE_PER_STAGE * s.stage + (s.stats.reputation > 60 ? 0.1 : 0) + (s.derived.momGrowth > 0.15 ? 0.1 : 0)
  s.flags['rivalPressure'] = Math.min(1, Math.round(p * 100) / 100)
}

/** Archetype from play style, detected once from Series A on (no-single-path concept). */
export function detectArchetype(s: GameState): void {
  if (s.archetype !== undefined || s.stage < B.ARCHETYPE_MIN_STAGE) return
  let a: Archetype
  const launchedCats = new Set(s.projects.filter((p) => p.launched).map((p) => p.category))
  if (s.projects.length >= 3 || launchedCats.has('api') || launchedCats.has('marketplace')) a = 'platform'
  else if (s.finance.adBudget > 0 && s.finance.net < 0) a = 'vcRocket'
  else if (s.projects.length <= 1 && s.derived.deptCounts.sales >= s.derived.deptCounts.marketing) a = 'niche'
  else a = 'bootstrap'
  s.archetype = a
}

// ---------------------------------------------------------------------------
// Ambient bubbles (PLAN §6.4)
// ---------------------------------------------------------------------------

function safeCondition(l: OfficeLine, s: GameState): boolean {
  if (!l.condition) return true
  try {
    return l.condition(s) === true
  } catch {
    return false
  }
}

function resolveSpeaker(s: GameState, l: OfficeLine, rng: Rng): string | undefined {
  const sp = l.speaker
  if (sp === 'founder') return 'founder'
  if (sp === 'anyEmployee') return s.employees.length ? rng.pick(s.employees).id : 'founder'
  if ((DEPTS as readonly string[]).includes(sp)) {
    const pool = s.employees.filter((e) => e.dept === sp)
    return pool.length ? rng.pick(pool).id : undefined
  }
  if ((NPC_ROLES as readonly string[]).includes(sp)) {
    const v = s.visitors.find((x) => x.role === (sp as NpcRole) && x.leaveDay > s.time.day)
    return v?.id
  }
  return undefined
}

export function sayLine(s: GameState, content: EngineContent, rng: Rng, trigger: OfficeLineTrigger, milestone?: MilestoneId): boolean {
  const lines = content.officeLines.filter(
    (l) =>
      l.trigger === trigger &&
      (milestone === undefined || l.milestone === undefined || l.milestone === milestone) &&
      (l.minStage === undefined || s.stage >= l.minStage) &&
      (l.maxStage === undefined || s.stage <= l.maxStage) &&
      safeCondition(l, s),
  )
  for (const l of rng.shuffle(lines)) {
    const speakerId = resolveSpeaker(s, l, rng)
    if (speakerId === undefined) continue
    s.bubbles.push({ id: newId(s, 'b'), lineId: l.id, speakerId, day: s.time.day, untilDay: s.time.day + B.BUBBLE_DAYS })
    if (s.bubbles.length > B.BUBBLE_MAX) s.bubbles.splice(0, s.bubbles.length - B.BUBBLE_MAX)
    return true
  }
  return false
}

/** Situational idle line every few days (profit → no runway panic: lines gate themselves too). */
export function idleLine(s: GameState, content: EngineContent, rng: Rng): void {
  const day = Math.floor(s.time.day)
  if (day % B.IDLE_BUBBLE_EVERY_DAYS !== 0) return
  const order: OfficeLineTrigger[] = []
  if (s.derived.overload > 0.1) order.push('overload')
  if (s.finance.runway !== null && s.finance.runway < 4) order.push('lowRunway')
  if (s.stats.morale < 45) order.push('lowMorale')
  if (s.stats.morale > 75) order.push('highMorale')
  if (s.finance.net > 0) order.push('profit')
  order.push('idle')
  for (const t of order) if (sayLine(s, content, rng, t)) return
}

// ---------------------------------------------------------------------------
// Visitors
// ---------------------------------------------------------------------------

const AMBIENT_ROLES: readonly NpcRole[] = ['customer', 'mentor', 'journalist']

export function dailyVisitors(s: GameState, rng: Rng): void {
  const day = s.time.day
  // Decision visitors wait while their card is open (old saves carried a 20-day leaveDay: push it out once,
  // so render never walks the visitor away from an unanswered card).
  const activeCardVisitor = s.decisions.active?.visitorId
  for (const v of s.visitors) if (v.id === activeCardVisitor && v.leaveDay < day + 1) v.leaveDay = v.arriveDay + B.DECISION_VISITOR_WAIT_DAYS
  const leaving = s.visitors.filter((v) => v.leaveDay <= day && v.id !== activeCardVisitor)
  for (const v of leaving) pushEvent(s, { kind: 'visitorLeft', refId: v.id })
  if (leaving.length) s.visitors = s.visitors.filter((v) => !leaving.includes(v))
  if (Math.floor(day) % B.AMBIENT_VISITOR_EVERY_DAYS === 0 && Math.floor(day) > 0 && !s.visitors.some((v) => v.purpose === 'ambient')) {
    const id = newId(s, 'v')
    s.visitors.push({ id, role: rng.pick(AMBIENT_ROLES), purpose: 'ambient', arriveDay: day, leaveDay: day + B.AMBIENT_VISITOR_DAYS })
    pushEvent(s, { kind: 'visitorArrived', refId: id })
  }
}

export function expireBubbles(s: GameState): void {
  s.bubbles = s.bubbles.filter((b) => b.untilDay > s.time.day)
}
