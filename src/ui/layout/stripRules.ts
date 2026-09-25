// Pure rules of the notification strip (docs/LAYOUT.md §3): one channel, one line, one item at a time.
// Priorities: P0 danger (bankruptcy clock, runway just fell under 3) > P1 placing mode > P2 moments / errors /
// new metric / activity > P3 the next step (resting item). Kept free of React so the rules are unit-tested.
import type { ActivityKind } from '../../engine/types'
import { mergeMoments, MOMENT_LIFE_MS, MOMENT_QUEUE_MAX, type MomentKind } from '../momentRules'

/** Transient kinds that wait in the queue (P0 runwayLow + every P2). */
export type TransientKind = MomentKind | 'runwayLow' | 'error' | 'newMetric' | 'activity'

export type StripPriority = 0 | 1 | 2 | 3

export function priorityOf(kind: TransientKind): StripPriority {
  return kind === 'runwayLow' ? 0 : 2
}

/** Life of a transient item in ms at 1×/2× (hover holds it; time only runs while it is on screen). */
export const STRIP_LIFE_MS: Record<TransientKind, number> = {
  ...MOMENT_LIFE_MS,
  runwayLow: 6000,
  error: 2600,
  newMetric: 5000,
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
 * - receipt / roundWeek replace the older one of their kind in place (momentRules MERGE_KINDS);
 * - a P0 item and an error jump the queue (to the front; the displaced item waits, its time stopped);
 * - at 4× no more than 2 of a kind wait; over the limit the oldest WAITING item goes, never the front one —
 *   activity first, then a new-metric note, and a moment (receipt, release, outcome…) only when nothing else is left.
 */
export function enqueue<T extends QueueItem>(cur: readonly T[], add: readonly T[], opts: { fast?: boolean } = {}): T[] {
  let out = [...cur]
  for (const item of add) {
    if (item.kind === 'runwayLow' || item.kind === 'error') {
      // Only one of each at a time: a newer error replaces the older one.
      out = out.filter((x) => x.kind !== item.kind)
      const firstNonDanger = item.kind === 'error' ? out.findIndex((x) => priorityOf(x.kind) > 0) : 0
      out.splice(firstNonDanger < 0 ? out.length : firstNonDanger, 0, item)
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

/** Eviction order over the cap: oldest waiting activity, then new-metric note, then the oldest waiting item. */
const EVICT_ORDER: readonly TransientKind[] = ['activity', 'newMetric']
function evictIndex(out: readonly QueueItem[]): number {
  for (const kind of EVICT_ORDER) {
    const i = out.findIndex((x, idx) => idx > 0 && x.kind === kind)
    if (i > 0) return i
  }
  return 1
}

function isMergeKind(kind: TransientKind): boolean {
  return kind === 'receipt' || kind === 'roundWeek'
}

/** What the strip shows right now. */
export type StripSlot = 'bankrupt' | 'queue' | 'placing' | 'nextStep' | 'empty'

export function pickSlot(p: { bankrupt: boolean; placing: boolean; nextStep: boolean; front?: QueueItem | undefined }): StripSlot {
  if (p.bankrupt) return 'bankrupt'
  if (p.front && priorityOf(p.front.kind) === 0) return 'queue'
  if (p.placing) return 'placing'
  if (p.front) return 'queue'
  if (p.nextStep) return 'nextStep'
  return 'empty'
}

/** Activity kinds the strip announces (§3.3). The rest stay in the history popover only. */
export const STRIP_ACTIVITY: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'hired', 'fired', 'resigned', 'resignWarning', 'retained', 'projectLaunched', 'founderActionDone',
  'roundStarted', 'roundClosed', 'roundShrunk', 'milestone', 'enterpriseWon', 'enterpriseLost', 'decisionDefaulted',
])

/** Moment kinds that already tell the same story as an activity entry. */
const SAME_STORY: Partial<Record<ActivityKind, readonly TransientKind[]>> = {
  projectLaunched: ['release'],
  roundStarted: ['roundWindow', 'roundWeek'],
  roundClosed: ['roundWeek'],
  roundShrunk: ['roundWeek'],
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

