// World flavour: milestones, ambient office bubbles, visitors, month-end bookkeeping, archetype.
import type { OfficeLine, OfficeLineTrigger } from '../content/index'
import { MARKET_SEGMENTS, segmentDef } from '../content/markets'
import { NPC_NAMES, RIVAL_NAMES } from '../content/names'
import * as B from './balance'
import { clamp, segmentRamp } from './economy'
import { applyMorale } from './effects'
import { movesError, spendMoves } from './founder'
import type { Rng } from './rng'
import {
  NPC_ROLES,
  DEPTS,
  DAYS_PER_WEEK,
  MARKET_SEGMENT_IDS,
  type ActionErrorCode,
  type AcquisitionView,
  type Archetype,
  type BoardState,
  type BoardView,
  type DirectorState,
  type GameState,
  type MarketSegmentId,
  type MarketState,
  type MarketView,
  type MilestoneId,
  type NpcRole,
  type Rival,
  type SegmentView,
  type ToolId,
} from './types'
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
  leadGone(s)
  anchorPendingRivals(s)
  const rivals = s.rivals ?? []
  if (Math.floor(s.time.day) % DAYS_PER_WEEK === 0) for (const r of rivals) if (!rivalOut(r)) weeklyShare(s, r)
  checkLeadPassed(s)
  const lead = rivals[0] && !rivalOut(rivals[0]) ? rivals[0] : undefined
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
    if (rivalOut(r) || (i > 0 && r.bornDay < day)) return
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

/** Out of the market: bought by the player, or closed down (the rival thread's rival-dies). */
export function rivalOut(r: Rival): boolean {
  return r.acquiredDay !== undefined || r.goneDay !== undefined
}

/** The rival thread closed the lead down (flags.rivalGone, rival-dies): it leaves the market with its share. */
function leadGone(s: GameState): void {
  const lead = s.rivals?.[0]
  if (!lead || rivalOut(lead) || s.flags[B.RIVAL_GONE_FLAG] === undefined) return
  lead.goneDay = Math.floor(s.time.day)
  lead.share = 0
  lead.ahead = false
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

/** The investor's ask at this stage (the same pace DD measures, with its modifiers; the board asks it too). */
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
    if (rivalOut(r)) continue
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
  if (!lead || rivalOut(lead)) return
  const own = s.finance.mrr
  if (!lead.ahead && lead.mrr > 0 && lead.mrr > own) {
    lead.ahead = true
    pushEvent(s, { kind: 'rivalPassed', refId: lead.id, value: lead.valuation })
  } else if (lead.ahead && own > lead.mrr * B.RIVAL_PASS_RESET) lead.ahead = false
}

// ---------------------------------------------------------------------------
// Board (GAMEPLAY V2 §8.3): a known exam every quarter from Series A. A miss does not kill: two in a row cap the
// multiple until the next hit (a door back stays open).
// ---------------------------------------------------------------------------

/** The quarter's target: MRR × (1 + ask)^3, three months at the investor's pace (whole dollars). */
export function boardTarget(mrr: number, ask: number): number {
  return Math.round(Math.max(0, mrr) * (1 + ask) ** 3)
}

/** A board whose first quarter starts on `day`: arriving at Series A, or an older save from A on (save.ts, no state read). */
export function newBoard(day: number, mrr: number, ask: number): BoardState {
  return { quarterStart: Math.floor(day), targetMrr: boardTarget(mrr, ask), missed: 0, streak: 0 }
}

/**
 * The board from Series A (undefined before). A save from A on that has none gets its first quarter from today, and
 * with it the stage's 'renewal' tool (both came with this wave). Mutates: engine paths only.
 */
export function boardOf(s: GameState): BoardState | undefined {
  if (s.stage < B.BOARD_FROM_STAGE) return undefined
  if (!s.board) {
    s.board = newBoard(s.time.day, s.finance.mrr, rivalAsk(s))
    uniquePush(s.unlockedTools, 'renewal')
  }
  return s.board
}

/**
 * Daily: the quarter ends BOARD_QUARTER_DAYS after it began. Hit (MRR ≥ target): reputation, a round-equity credit, the
 * cap penalty lifted. Missed: BOARD_PENALTY_MISSES in a row raise flags.boardCapPenalty and bring the board-review card
 * (queued: it takes the next card slot, like a crisis card). Either way the next quarter starts at today's MRR (after a
 * miss at the revised ask).
 */
export function dailyBoard(s: GameState, content: EngineContent): void {
  const b = boardOf(s)
  if (!b || s.gameOver || s.time.day < b.quarterStart + B.BOARD_QUARTER_DAYS) return
  if (s.finance.mrr >= b.targetMrr) {
    b.streak += 1
    b.missed = 0
    b.hits = (b.hits ?? 0) + 1
    b.credit = Math.min(B.BOARD_CREDIT_MAX, (b.credit ?? 0) + 1)
    s.stats.reputation = clamp(0, 100, s.stats.reputation + B.BOARD_HIT_REPUTATION)
    delete s.flags[B.BOARD_PENALTY_FLAG]
    pushEvent(s, { kind: 'boardHit', value: Math.round(s.finance.mrr) })
  } else {
    b.missed += 1
    b.streak = 0
    b.misses = (b.misses ?? 0) + 1
    pushEvent(s, { kind: 'boardMissed', value: b.missed })
    if (b.missed >= B.BOARD_PENALTY_MISSES && !s.flags[B.BOARD_PENALTY_FLAG]) {
      s.flags[B.BOARD_PENALTY_FLAG] = true
      const id = B.BOARD_REVIEW_CARD_ID
      if (content.decisions.some((c) => c.id === id) && !s.decisions.queue.includes(id) && s.decisions.active?.cardId !== id) s.decisions.queue.push(id)
    }
  }
  b.quarterStart = Math.floor(s.time.day)
  // After a miss the board revises its plan (BOARD_REVISED_ASK): a door back to a hit, and the cap lifts with it.
  b.targetMrr = boardTarget(s.finance.mrr, rivalAsk(s) * (b.missed > 0 ? B.BOARD_REVISED_ASK : 1))
}

/** derived.board: the running quarter (the horizon's "Kurul $X · 23g"). */
export function boardView(s: GameState): BoardView | undefined {
  const b = s.stage >= B.BOARD_FROM_STAGE ? s.board : undefined
  if (!b) return undefined
  return {
    targetMrr: b.targetMrr,
    endDay: b.quarterStart + B.BOARD_QUARTER_DAYS,
    mrr: s.finance.mrr,
    missed: b.missed,
    streak: b.streak,
    penalty: !!s.flags[B.BOARD_PENALTY_FLAG],
  }
}

// ---------------------------------------------------------------------------
// Market (GAMEPLAY V2 §8.1): segments open, ramp in, never close; rivals can be bought (§8.2)
// ---------------------------------------------------------------------------

/** Segments a company at `stage` has open without having bought any: the automatic ones up to it. */
function autoSegments(stage: number, openedDay: number): MarketState['segments'] {
  return MARKET_SEGMENTS.filter((m) => m.auto && m.stage <= stage).map((m) => ({ id: m.id, size: segmentSize(m.size), openedDay, upkeep: 0 }))
}

/** Users a segment adds: its content size × MARKET_SIZE_SCALE. */
export function segmentSize(contentSize: number): number {
  return Math.round(contentSize * B.MARKET_SIZE_SCALE)
}

/**
 * The market of a save from before segments (§3.1 "aşamaya göre otomatik segmentler açık"): the automatic ones up to
 * its stage and the ones of the stages it has already left (a Series B save is sized as one that opened midmarket),
 * fully ramped and with no upkeep (nothing was paid for them). The current stage's verb stays the player's.
 */
export function defaultMarket(stage: number, day: number): MarketState {
  const segments = MARKET_SEGMENTS.filter((m) => m.auto ? m.stage <= stage : m.stage < stage).map((m) => ({ id: m.id, size: segmentSize(m.size), openedDay: day - B.MARKET_RAMP_DAYS, upkeep: 0 }))
  return { segments }
}

/** The market; older saves default lazily by stage (with the market tools of the stages reached, §3.1). */
export function marketOf(s: GameState): MarketState {
  if (!s.market) {
    for (const t of marketTools(s.stage)) uniquePush(s.unlockedTools, t)
    s.market = defaultMarket(s.stage, Math.floor(s.time.day))
  }
  return s.market
}

/** The market verbs' tools ('segments', 'mna') a company at `stage` has: a save from before them gets them on load. */
export function marketTools(stage: number): ToolId[] {
  const out: ToolId[] = []
  for (let i = 0; i <= stage; i++) for (const t of B.STAGE_UNLOCK_TOOLS[i] ?? []) if (B.MARKET_TOOLS.includes(t)) out.push(t)
  return out
}

/** Stage arrival: the automatic segments of the new stage open (smb at Seed) and ramp in. */
export function openAutoSegments(s: GameState): void {
  const m = marketOf(s)
  for (const seg of autoSegments(s.stage, Math.floor(s.time.day))) if (!m.segments.some((x) => x.id === seg.id)) m.segments.push(seg)
}

/** Monthly upkeep of the opened segments (the receipt's "Pazar" line). */
export function marketUpkeep(s: GameState): number {
  return (s.market?.segments ?? []).reduce((a, m) => a + m.upkeep, 0)
}

/**
 * Why openSegment would fail, or null (pure: the market map and the action share it): unknown or open already →
 * invalid; automatic (it opens with its stage) → notUnlocked; before its stage, the 'segments' tool, enterpriseSales or the ops it needs → notUnlocked;
 * cash → insufficientCash; one move (§7.1) → noMoves.
 */
export function segmentError(s: GameState, id: MarketSegmentId): ActionErrorCode | null {
  const def = (MARKET_SEGMENT_IDS as readonly string[]).includes(id) ? segmentDef(id) : undefined
  if (!def) return 'invalid'
  if ((s.market?.segments ?? []).some((m) => m.id === id)) return 'invalid'
  if (def.auto) return 'notUnlocked'
  if (s.stage < def.stage || !s.unlockedTools.includes('segments')) return 'notUnlocked'
  if (def.needsTool && !s.unlockedTools.includes(def.needsTool)) return 'notUnlocked'
  if (def.needsOps !== undefined && s.employees.filter((e) => e.dept === 'ops').length < def.needsOps) return 'notUnlocked'
  if (s.stats.cash < def.cost) return 'insufficientCash'
  return movesError(s, B.MOVE_COST.openSegment)
}

/** Opens a segment (call after segmentError passed): its cost now, its upkeep from the next ledger day, a 60-day ramp. */
export function openSegment(s: GameState, id: MarketSegmentId): void {
  const def = segmentDef(id)!
  s.stats.cash -= def.cost
  spendMoves(s, B.MOVE_COST.openSegment)
  const size = segmentSize(def.size)
  marketOf(s).segments.push({ id, size, openedDay: Math.floor(s.time.day), upkeep: def.upkeep })
  pushEvent(s, { kind: 'segmentOpened', refId: id, value: size })
}

/** What a rival costs: its MRR × 12 × the player's multiple × 0.8 (× the prepared offer's discount, §9.2 thread). */
export function acquirePrice(s: GameState, r: Rival): number {
  const intent = s.flags[B.ACQUIRE_INTENT_FLAG] && r === s.rivals?.[0] ? B.ACQUIRE_INTENT_DISCOUNT : 1
  return Math.round(Math.max(0, r.mrr) * 12 * s.derived.valuationMultiple * B.ACQUIRE_PRICE_FACTOR * intent)
}

/** Users a rival brings: its share × TAM × ACQUIRE_USERS_SHARE. */
export function acquireUsers(s: GameState, r: Rival): number {
  return Math.round(r.share * (s.derived.tam ?? 0) * B.ACQUIRE_USERS_SHARE)
}

/** Why acquireRival would fail, or null: not in the market → notFound; before Series B / 'mna' → notUnlocked; cash; two moves. */
export function acquireError(s: GameState, id: string): ActionErrorCode | null {
  const r = (s.rivals ?? []).find((x) => x.id === id)
  if (!r || rivalOut(r)) return 'notFound'
  if (s.stage < B.ACQUIRE_MIN_STAGE || !s.unlockedTools.includes('mna')) return 'notUnlocked'
  if (s.stats.cash < acquirePrice(s, r)) return 'insufficientCash'
  return movesError(s, B.MOVE_COST.acquireRival)
}

/**
 * Buys a rival (call after acquireError passed): the price now; its users come over (share × TAM × 0.6), its share
 * goes to 0 for good; two codebases and two teams merge: tech debt, morale, production × 0.85 for 60 days.
 */
export function acquireRival(s: GameState, id: string): void {
  const r = s.rivals!.find((x) => x.id === id)!
  const price = acquirePrice(s, r)
  s.stats.cash -= price
  s.stats.users += acquireUsers(s, r)
  r.share = 0
  r.acquiredDay = Math.floor(s.time.day)
  r.ahead = false
  s.techDebt = (s.techDebt ?? 0) + B.ACQUIRE_TECH_DEBT
  applyMorale(s, B.ACQUIRE_MORALE)
  s.modifiers.push({ id: newId(s, 'mod'), kind: 'production', value: B.ACQUIRE_PRODUCTION, untilDay: s.time.day + B.ACQUIRE_PRODUCTION_DAYS, source: 'acquireRival' })
  if (r === s.rivals![0]) delete s.flags[B.ACQUIRE_INTENT_FLAG]
  spendMoves(s, B.MOVE_COST.acquireRival)
  pushEvent(s, { kind: 'rivalAcquired', refId: r.id, value: price })
}

/** The market map (derived.market): every segment open or as a silhouette, and the rivals still to be bought. */
export function marketView(s: GameState): MarketView {
  const open = s.market?.segments ?? []
  const day = s.time.day
  const segments: SegmentView[] = MARKET_SEGMENTS.map((def) => {
    const seg = open.find((m) => m.id === def.id)
    return {
      id: def.id,
      stage: def.stage,
      size: segmentSize(def.size),
      cost: def.cost,
      upkeep: def.upkeep,
      open: seg !== undefined,
      ramp: seg ? segmentRamp(seg.openedDay, day) : 0,
      auto: def.auto,
      error: segmentError(s, def.id),
    }
  })
  const rivals: AcquisitionView[] = (s.rivals ?? [])
    .filter((r) => !rivalOut(r))
    .map((r) => ({ id: r.id, price: acquirePrice(s, r), users: acquireUsers(s, r), error: acquireError(s, r.id) }))
  return { segments, rivals }
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
