// Pure rules of the notification strip (docs/LAYOUT.md §3, docs/GAMEPLAY_V2.md §12): one channel, one line, one
// item at a time. Priorities: P0 danger (bankruptcy clock, runway just fell under 3) > P1 cash tension (payday short,
// crisis, loan called, round failed, board missed) and placing mode > P2 moments / errors / activity > P3 the next
// step (resting item). A daily budget keeps P2 at 2 a game day (the rest folds into a digest); achievements never
// enter the strip. Kept free of React so the rules are unit-tested.
import type { ActivityKind } from '../../engine/types'
import { mergeMoments, MOMENT_LIFE_MS, MOMENT_QUEUE_MAX, type MomentKind } from '../momentRules'

/** P1 cash-tension items (docs/GAMEPLAY_V2.md §6). The engine waves emit them; the strip is ready for them. */
export type AlarmKind = 'paydayShort' | 'crisis' | 'loanCalled' | 'roundFailed' | 'boardMissed'

/** Transient kinds that wait in the queue (P0 runwayLow, P1 alarms, every P2). */
export type TransientKind = MomentKind | AlarmKind | 'runwayLow' | 'error' | 'activity'

export type StripPriority = 0 | 1 | 2 | 3

const ALARMS: ReadonlySet<string> = new Set<AlarmKind>(['paydayShort', 'crisis', 'loanCalled', 'roundFailed', 'boardMissed'])

export function priorityOf(kind: TransientKind): StripPriority {
  if (kind === 'runwayLow') return 0
  return ALARMS.has(kind) ? 1 : 2
}

/** Life of a transient item in ms at 1×/2× (hover holds it; time only runs while it is on screen). */
export const STRIP_LIFE_MS: Record<TransientKind, number> = {
  ...MOMENT_LIFE_MS,
  runwayLow: 6000,
  paydayShort: 6000,
  crisis: 6000,
  loanCalled: 6000,
  roundFailed: 6000,
  boardMissed: 6000,
  error: 2600,
  activity: 3000,
}

/** At 4× every transient item lives 0.75× as long, never under 2.5 s (a payday every 15 s must not pile up). */
export function stripLifeMs(kind: TransientKind, speed: number): number {
  const base = STRIP_LIFE_MS[kind]
  return speed >= 4 ? Math.max(2500, Math.round(base * 0.75)) : base
}

/** Items waiting behind the one on screen. */
export const STRIP_QUEUE_MAX = MOMENT_QUEUE_MAX

/** Same-kind items allowed in the queue at 4× (more of the same is noise at that speed). */
export const SAME_KIND_MAX_FAST = 2

export interface QueueItem {
  key: number
  kind: TransientKind
}

/**
 * Adds fresh transient items to the queue (index 0 = the one on screen or next to show).
 * - a receipt replaces the older one in place (momentRules MERGE_KINDS);
 * - a P0 item, a P1 alarm and an error jump the queue (P0 to the front, the others behind the higher ones; the
 *   displaced item waits, its time stopped);
 * - at 4× no more than 2 of a kind wait; over the limit the oldest WAITING item goes, never the front one —
 *   activity first, and a moment (receipt, release, outcome…) only when nothing else is left.
 */
export function enqueue<T extends QueueItem>(cur: readonly T[], add: readonly T[], opts: { fast?: boolean } = {}): T[] {
  let out = [...cur]
  for (const item of add) {
    const pri = priorityOf(item.kind)
    if (pri < 2 || item.kind === 'error') {
      // Only one of each at a time: a newer error / alarm replaces the older one.
      out = out.filter((x) => x.kind !== item.kind)
      const first = out.findIndex((x) => priorityOf(x.kind) > pri || (pri === 2 && priorityOf(x.kind) === 2))
      out.splice(first < 0 ? out.length : first, 0, item)
      continue
    }
    if (opts.fast) {
      const same = out.filter((x) => x.kind === item.kind)
      if (same.length >= SAME_KIND_MAX_FAST && !isMergeKind(item.kind)) {
        // Drop the oldest waiting one of this kind to make room (never the front item).
        const i = out.findIndex((x, idx) => idx > 0 && x.kind === item.kind)
        if (i > 0) out.splice(i, 1)
        else continue
      }
    }
    out = mergeMoments(out, [item], Number.POSITIVE_INFINITY)
  }
  const limit = 1 + STRIP_QUEUE_MAX
  while (out.length > limit) out.splice(evictIndex(out), 1)
  return out
}

/** Eviction order over the cap: oldest waiting activity, then the oldest waiting item. */
const EVICT_ORDER: readonly TransientKind[] = ['activity']
function evictIndex(out: readonly QueueItem[]): number {
  for (const kind of EVICT_ORDER) {
    const i = out.findIndex((x, idx) => idx > 0 && x.kind === kind)
    if (i > 0) return i
  }
  return 1
}

function isMergeKind(kind: TransientKind): boolean {
  return kind === 'receipt'
}

/** What the strip shows right now. */
export type StripSlot = 'bankrupt' | 'queue' | 'placing' | 'nextStep' | 'empty'

export function pickSlot(p: { bankrupt: boolean; placing: boolean; nextStep: boolean; front?: QueueItem | undefined }): StripSlot {
  if (p.bankrupt) return 'bankrupt'
  if (p.front && priorityOf(p.front.kind) <= 1) return 'queue'
  if (p.placing) return 'placing'
  if (p.front) return 'queue'
  if (p.nextStep) return 'nextStep'
  return 'empty'
}

/**
 * Activity kinds the strip announces (§3.3). The rest stay in the history popover only. Milestones are confetti +
 * a cue, a founder action shows on its own button, the round lives in the top bar (docs/GAMEPLAY_V2.md §12 D9).
 */
export const STRIP_ACTIVITY: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'hired', 'fired', 'resigned', 'resignWarning', 'retained', 'projectLaunched',
  'roundClosed', 'roundShrunk', 'enterpriseWon', 'enterpriseLost', 'decisionDefaulted',
])

/** Moment kinds that already tell the same story as an activity entry. */
const SAME_STORY: Partial<Record<ActivityKind, readonly TransientKind[]>> = {
  projectLaunched: ['release'],
}

/** Window in which a moment hides an activity entry about the same event. */
export const SAME_STORY_MS = 2000

/** False when the kind is not announced, or a moment about the same event arrived within the last 2 s. */
export function activityShown(kind: ActivityKind, recent: readonly { kind: TransientKind; at: number }[], now: number): boolean {
  if (!STRIP_ACTIVITY.has(kind)) return false
  const twins = SAME_STORY[kind]
  if (!twins) return true
  return !recent.some((r) => now - r.at <= SAME_STORY_MS && twins.includes(r.kind))
}

/** The resting "next step" item is hidden while the start card asks for time, when the top bar already offers the round, after the end, and on phones under an open sheet. */
export function nextStepShown(p: { hasStep: boolean; startCall: boolean; stepId?: string; canStartRound: boolean; over: boolean; sheetOpen: boolean }): boolean {
  if (!p.hasStep || p.over || p.startCall || p.sheetOpen) return false
  if (p.stepId === 'round' && p.canStartRound) return false
  return true
}

/** True when the strip renders something (a rendered strip is the only thing a pointer can hover). */
export function stripVisible(slot: StripSlot, sheetOpen: boolean): boolean {
  return slot !== 'empty' && !(sheetOpen && slot === 'nextStep')
}

/**
 * Whether the front item's life clock runs: only while a queue item is on screen, not under a mouse hover, and not
 * while a full-screen overlay (move scene, post-mortem) covers the strip.
 */
export function stripClockRuns(p: { slot: StripSlot; hasFront: boolean; hover: boolean; overlay: boolean }): boolean {
  return p.slot === 'queue' && p.hasFront && !p.hover && !p.overlay
}

/**
 * Hover state after a render: a strip that stops rendering (empty slot, hidden under the phone sheet) gets no
 * mouseleave, so its hover is cleared here instead of freezing every later item.
 */
export function nextHover(hover: boolean, slot: StripSlot, sheetOpen: boolean): boolean {
  return hover && stripVisible(slot, sheetOpen)
}


// ---------------------------------------------------------------------------
// Daily budget (docs/GAMEPLAY_V2.md §12 D9): what reaches the strip and the office in one game day
// ---------------------------------------------------------------------------

/** P2 items the strip shows in one game day; more fold into the digest. */
export const P2_PER_DAY = 2
/** Office lines (scene ambient bubbles) in one game day, counted by the same budget. */
export const OFFICE_LINES_PER_DAY = 1
/** An item with a dedupe key does not come back within this many game days. */
export const DEDUPE_DAYS = 30

/** P2 kinds outside the quota: the month receipt (its own beat) and a rejected action (the player's own click). */
const QUOTA_FREE: ReadonlySet<TransientKind> = new Set<TransientKind>(['receipt', 'error'])

/** Office line triggers that may still speak (docs/GAMEPLAY_V2.md §9.4): people coming and going, a crisis. */
export const OFFICE_LINE_TRIGGERS: ReadonlySet<string> = new Set(['hire', 'fire', 'resign', 'crisis'])

export interface DayBudget {
  /** Whole game day the counters belong to. */
  day: number
  /** P2 items shown on `day`. */
  p2: number
  /** Office lines shown on `day`. */
  office: number
  /** P2 items folded into the digest since it was last read. */
  digest: number
  /** dedupeKey → day it was last let through. */
  seen: Readonly<Record<string, number>>
}

export type BudgetVerdict = 'show' | 'digest' | 'skip'

/**
 * The budget for game day `day`: a new day refills the quotas (the digest and dedupe memory stay); a day before the
 * budget's own (new run) starts clean.
 */
export function dailyBudget(day: number, prev?: DayBudget): DayBudget {
  const d = Math.floor(day)
  if (!prev || d < prev.day) return { day: d, p2: 0, office: 0, digest: 0, seen: {} }
  if (d === prev.day) return prev
  return { ...prev, day: d, p2: 0, office: 0 }
}

/**
 * Lets one strip item through the budget. A dedupe key seen within DEDUPE_DAYS is skipped (any priority); P0 / P1
 * pierce the quota; a P2 over P2_PER_DAY folds into the digest. Receipts and errors are quota-free.
 */
export function admit(b: DayBudget, item: { kind: TransientKind; dedupeKey?: string }, day: number): [BudgetVerdict, DayBudget] {
  let next = dailyBudget(day, b)
  const key = item.dedupeKey
  if (key !== undefined) {
    const last = next.seen[key]
    if (last !== undefined && next.day - last < DEDUPE_DAYS) return ['skip', next]
  }
  if (priorityOf(item.kind) === 2 && !QUOTA_FREE.has(item.kind)) {
    if (next.p2 >= P2_PER_DAY) return ['digest', { ...next, digest: next.digest + 1 }]
    next = { ...next, p2: next.p2 + 1 }
  }
  if (key !== undefined) next = { ...next, seen: { ...next.seen, [key]: next.day } }
  return ['show', next]
}

/** One office line: only the listed triggers speak, at most OFFICE_LINES_PER_DAY a game day. */
export function admitOfficeLine(b: DayBudget, trigger: string | undefined, day: number): [boolean, DayBudget] {
  const next = dailyBudget(day, b)
  if (!trigger || !OFFICE_LINE_TRIGGERS.has(trigger) || next.office >= OFFICE_LINES_PER_DAY) return [false, next]
  return [true, { ...next, office: next.office + 1 }]
}

/** The digest was read (history popover opened): its count starts over. */
export function readDigest(b: DayBudget): DayBudget {
  return b.digest === 0 ? b : { ...b, digest: 0 }
}

/**
 * The one budget of this session: the strip and the office lines draw from the same counter. Mutable on purpose
 * (both consumers are effects / renderers outside one React tree); reset on a new run.
 */
export const sharedBudget: { current: DayBudget } = { current: dailyBudget(0) }

export function resetSharedBudget(day = 0): void {
  sharedBudget.current = dailyBudget(day)
}
