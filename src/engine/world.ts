// World flavour: milestones, ambient office bubbles, visitors, month-end bookkeeping, archetype.
import type { OfficeLine, OfficeLineTrigger } from '../content/index'
import { NPC_NAMES, RIVAL_NAMES } from '../content/names'
import * as B from './balance'
import { clamp } from './economy'
import type { Rng } from './rng'
import { NPC_ROLES, DEPTS, DAYS_PER_WEEK, type Archetype, type DirectorState, type GameState, type MilestoneId, type NpcRole, type Rival } from './types'
import { incCounter, modifierMult, newId, pushActivity, pushEvent, uniquePush, type EngineContent } from './util'

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
  // Burn multiple reads the month-end net (GAMEPLAY V2 §4.1); whole dollars keep the save small.
  ;(s.finance.netHistory ??= []).push(Math.round(s.finance.net))
  // Old v4 saves past Series A have no close day on record: grace starts from their first month end, not -∞.
  if (s.stage >= B.IDLE_PENALTY_MIN_STAGE) s.finance.lastRoundCloseDay ??= s.time.day
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
  rivalsMonthEnd(s)
}

/**
 * Daily (tick.ts): the director, then the rivals (lazy birth for older saves, the weekly share, the lead's overtake)
 * and the rival pressure the rival cards read (PLAN §6.3 "baskı ≥ 0.35", GAMEPLAY V2 §8.2).
 */
export function updateRivalPressure(s: GameState): void {
  s.cast ??= castOf()
  updateDirector(s)
  ensureRivals(s)
  anchorPendingRivals(s)
  const rivals = s.rivals ?? []
  if (Math.floor(s.time.day) % DAYS_PER_WEEK === 0) for (const r of rivals) weeklyShare(s, r)
  checkLeadPassed(s)
  const lead = rivals[0]
  const own = Math.max(1, s.finance.valuation)
  const ratio = lead ? Math.min(B.RIVAL_PRESSURE_RATIO_MAX, lead.valuation / own) : 0
  const p = clamp(0, 1, rivals.reduce((a, r) => a + r.strength * r.share, 0) + B.RIVAL_PRESSURE_VALUATION * ratio)
  s.flags['rivalPressure'] = Math.round(p * 100) / 100
}

// ---------------------------------------------------------------------------
// Director (GAMEPLAY V2 §5.2): pressure grows with wealth, drops after a missed payroll
// ---------------------------------------------------------------------------

/** The director; older saves default lazily (§3.1). */
export function directorOf(s: GameState): DirectorState {
  return (s.director ??= { pressure: B.DIRECTOR_PRESSURE_DEFAULT, graceUntil: 0 })
}

/** Daily: pressure = clamp(0.1, 1, base + stage + rich + profitable + fast − grace). */
export function updateDirector(s: GameState): void {
  const d = directorOf(s)
  const runway = s.finance.runway
  const raw =
    B.DIRECTOR_BASE +
    B.DIRECTOR_PER_STAGE * s.stage +
    (runway === null || runway > B.DIRECTOR_RICH_RUNWAY ? B.DIRECTOR_RICH : 0) +
    ((s.counters.profitMonths ?? 0) >= B.DIRECTOR_PROFIT_MONTHS ? B.DIRECTOR_PROFIT : 0) +
    ((s.derived.momAvg ?? s.derived.momGrowth) > B.DIRECTOR_FAST_MOM ? B.DIRECTOR_FAST : 0) -
    (s.time.day < d.graceUntil ? B.DIRECTOR_GRACE : 0)
  d.pressure = Math.round(clamp(B.DIRECTOR_PRESSURE_MIN, B.DIRECTOR_PRESSURE_MAX, raw) * 100) / 100
}

/** A missed payroll: the director and the rivals give DIRECTOR_GRACE_DAYS of breath (a way back, not a spiral). */
export function graceAfterMissedPayroll(s: GameState): void {
  const until = s.time.day + B.DIRECTOR_GRACE_DAYS
  directorOf(s).graceUntil = until
  for (const r of s.rivals ?? []) r.adaptUntilDay = until
}

// ---------------------------------------------------------------------------
// Fixed cast (GAMEPLAY V2 §9.1) and named rivals (§8.2)
// ---------------------------------------------------------------------------

/** One name per NPC role for the whole run: drawn with `rng`, else each role's first name (older saves). */
export function castOf(rng?: Rng): Record<NpcRole, string> {
  const cast = {} as Record<NpcRole, string>
  for (const role of NPC_ROLES) {
    const names = NPC_NAMES[role]
    cast[role] = rng ? rng.pick(names) : names[0]!
  }
  return cast
}

/** MRR the stage is heading for: the next stage's target valuation at this stage's top multiple. */
function stageTargetMrr(stage: number): number {
  const next = Math.min(B.LAST_STAGE, stage + 1)
  const val = B.STAGE_TARGET_VALUATION[next] ?? B.STAGE_TARGET_VALUATION[B.LAST_STAGE]!
  const mult = B.MULTIPLE_MAX_BY_STAGE[Math.min(B.MULTIPLE_MAX_BY_STAGE.length - 1, stage)]!
  return val / (12 * mult)
}

/** clamp(0.2, 0.9, 0.3 + 0.1 × stage + 0.2 × MRR / stage target MRR + 0.1 × pressure), × 0.6 while the player adapts. */
export function rivalStrengthTarget(s: GameState, r?: Rival): number {
  const t = clamp(
    B.RIVAL_STRENGTH_MIN,
    B.RIVAL_STRENGTH_MAX,
    B.RIVAL_STRENGTH_BASE +
      B.RIVAL_STRENGTH_PER_STAGE * s.stage +
      B.RIVAL_STRENGTH_PER_MRR * (Math.max(0, s.finance.mrr) / stageTargetMrr(s.stage)) +
      B.RIVAL_STRENGTH_PER_PRESSURE * directorOf(s).pressure,
  )
  return r?.adaptUntilDay !== undefined && s.time.day < r.adaptUntilDay ? t * B.RIVAL_ADAPT_STRENGTH : t
}

/** What the player holds the market with: 0.5 × maturity + 0.3 × reputation + 0.2 × the room left in the market. */
export function playerPower(s: GameState): number {
  const pen = s.derived.penetration ?? 0
  return B.RIVAL_POWER_MAT * s.derived.avgMaturity + B.RIVAL_POWER_REP * (clamp(0, 100, s.stats.reputation) / 100) + B.RIVAL_POWER_ROOM * (1 - pen)
}

/** Flag: the day of a stage arrival whose rivals still wait for the new stage's valuation to anchor on. */
const ANCHOR_FLAG = 'rivalAnchorDay'

/**
 * Stage arrival (enterStage): the anchor waits for the next daily(), when the player's valuation is the new stage's
 * (at Seed the pre-revenue floor fades; anchoring on the old figure put the lead ahead on day one).
 */
export function markRivalAnchor(s: GameState): void {
  s.flags[ANCHOR_FLAG] = Math.floor(s.time.day)
}

/** Valuation and MRR at `ratio` of the player's: both then grow at the same tempo (§8.2: tempo, not a head start). */
function anchorRival(s: GameState, r: Rival, ratio: number): void {
  r.valuation = Math.round(Math.max(1, s.finance.valuation) * ratio)
  r.mrr = Math.round(Math.max(0, s.finance.mrr) * ratio)
  r.ahead = false
}

/**
 * The lead anchors on the player's figures again, and the rivals born on that stage arrival at their own ratio. Runs
 * in daily() after recomputeDerived.
 */
function anchorPendingRivals(s: GameState): void {
  const day = s.flags[ANCHOR_FLAG]
  if (typeof day !== 'number') return
  delete s.flags[ANCHOR_FLAG]
  ;(s.rivals ?? []).forEach((r, i) => {
    if (i > 0 && r.bornDay < day) return
    anchorRival(s, r, i === 0 ? B.RIVAL_START_RATIO : B.RIVAL_FOLLOWER_RATIO)
  })
}

/** A new rival: the lead at RIVAL_START_RATIO of the player's valuation, later ones at RIVAL_FOLLOWER_RATIO. */
function spawnRival(s: GameState, rng?: Rng): Rival {
  const rivals = (s.rivals ??= [])
  const used = new Set(rivals.map((r) => r.name))
  const free = RIVAL_NAMES.filter((n) => !used.has(n))
  const name = free.length ? (rng ? rng.pick(free) : free[0]!) : `${RIVAL_NAMES[rivals.length % RIVAL_NAMES.length]} ${rivals.length + 1}`
  const r: Rival = {
    id: newId(s, 'rival'),
    name,
    bornDay: Math.floor(s.time.day),
    strength: Math.round(rivalStrengthTarget(s) * 100) / 100,
    share: B.RIVAL_BORN_SHARE,
    mrr: 0,
    valuation: 0,
    momentum: 0,
    ahead: false,
  }
  anchorRival(s, r, rivals.length === 0 ? B.RIVAL_START_RATIO : B.RIVAL_FOLLOWER_RATIO)
  rivals.push(r)
  pushEvent(s, { kind: 'rivalBorn', refId: r.id })
  return r
}

/**
 * The stage's rivals are in the market (RIVALS_BY_STAGE): enterStage draws their names with the step's rng; an older
 * save (or a stage set without one) gets them lazily, names in RIVAL_NAMES order (no rng).
 */
export function ensureRivals(s: GameState, rng?: Rng): void {
  const want = B.RIVALS_BY_STAGE[Math.min(B.RIVALS_BY_STAGE.length - 1, s.stage)] ?? 0
  const rivals = (s.rivals ??= [])
  while (rivals.length < want) spawnRival(s, rng)
}

/** The investor's ask at this stage (the same pace DD measures, with its modifiers). */
function rivalAsk(s: GameState): number {
  return B.DILIGENCE_MOM[Math.min(B.DILIGENCE_MOM.length - 1, s.stage)]! * modifierMult(s, 'diligenceMom')
}

/**
 * Weekly: share += 0.03 × (strength − player power) (+ 0.005 while growth is under the ask), clamp(0, 0.5). The
 * rivals together hold at most RIVAL_SHARE_TOTAL_MAX: past it a rival only loses share (the market is not theirs).
 */
function weeklyShare(s: GameState, r: Rival): void {
  const ask = rivalAsk(s)
  const slow = (s.derived.momAvg ?? s.derived.momGrowth) < ask ? B.RIVAL_SHARE_SLOW_GROWTH : 0
  const share = r.share + B.RIVAL_SHARE_K * (r.strength - playerPower(s)) + slow
  const others = (s.rivals ?? []).reduce((a, o) => (o === r ? a : a + o.share), 0)
  const max = Math.min(B.RIVAL_SHARE_MAX, Math.max(r.share, B.RIVAL_SHARE_TOTAL_MAX - others))
  r.share = Math.round(clamp(0, max, share) * 1000) / 1000
}

/** Month end: strength moves toward its target; valuation and MRR grow at the investor's tempo (× pressure). */
function rivalsMonthEnd(s: GameState): void {
  const rivals = s.rivals ?? []
  if (!rivals.length) return
  const pace = B.RIVAL_TEMPO_ASK[Math.min(B.RIVAL_TEMPO_ASK.length - 1, s.stage)]!
  const tempo = 1 + pace * rivalAsk(s) * (1 + B.RIVAL_TEMPO_PRESSURE * directorOf(s).pressure)
  for (const r of rivals) {
    const before = r.strength
    const target = rivalStrengthTarget(s, r)
    r.strength = Math.round((before + (target - before) * B.RIVAL_STRENGTH_LERP) * 100) / 100
    r.momentum = r.strength > before ? 1 : r.strength < before ? -1 : 0
    r.valuation = Math.round(r.valuation * tempo)
    r.mrr = Math.round(r.mrr * tempo)
  }
}

/**
 * The lead overtakes the player: rivalPassed once per overtake. The race is run on MRR (both priced at one multiple
 * it is the valuation race without the multiple's month-to-month swing: §8.2 "3+ ay ask'ın altında kalınca rakip
 * geçer", not a crisis dip). It counts again only after the player has pulled back ahead by RIVAL_PASS_RESET.
 */
function checkLeadPassed(s: GameState): void {
  const lead = s.rivals?.[0]
  if (!lead) return
  const own = s.finance.mrr
  if (!lead.ahead && lead.mrr > 0 && lead.mrr > own) {
    lead.ahead = true
    pushEvent(s, { kind: 'rivalPassed', refId: lead.id, value: lead.valuation })
  } else if (lead.ahead && own > lead.mrr * B.RIVAL_PASS_RESET) lead.ahead = false
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
