// Pure rules of the moments (docs/CORE_LOOP.md §7 "Popup bütçesi"), items of the one notification strip
// (docs/LAYOUT.md §3; queue + 4× timing in layout/stripRules.ts): how long each stays, how a burst of events is
// merged, which panel one opens. Kept free of React so the rules are unit-tested (momentRules.test.ts).
import type { Panel } from '../store/types'

export type MomentKind = 'receipt' | 'release' | 'outcome' | 'goal' | 'roundWindow' | 'roundWeek'

/** Every card closes by itself within 4 s (hovering holds it open). */
export const MOMENT_LIFE_MS: Record<MomentKind, number> = { receipt: 4000, release: 4000, outcome: 4000, goal: 3500, roundWindow: 4000, roundWeek: 3500 }

/** Cards waiting behind the shown ones. */
export const MOMENT_QUEUE_MAX = 3

/** Kinds where a newer card replaces an older one of the same kind (the old numbers are stale). */
const MERGE_KINDS: ReadonlySet<string> = new Set<MomentKind>(['receipt', 'roundWeek'])

/**
 * Adds fresh cards: a receipt / round week replaces the older one of its kind in place (keeps its slot on screen),
 * the rest queue behind. Over the limit the oldest WAITING card is dropped, never one that is on screen.
 */
export function mergeMoments<T extends { key: number; kind: string }>(cur: readonly T[], add: readonly T[], shown: number): T[] {
  const out = [...cur]
  for (const m of add) {
    const i = MERGE_KINDS.has(m.kind) ? out.findIndex((x) => x.kind === m.kind) : -1
    if (i >= 0) out[i] = m
    else out.push(m)
  }
  const limit = shown + MOMENT_QUEUE_MAX
  while (out.length > limit) out.splice(shown, 1)
  return out
}

/** Panel a moment opens when clicked. The month receipt opens Yakıt in Metrikler (the cost breakdown's home). */
export function momentPanel(kind: MomentKind): Panel {
  switch (kind) {
    case 'receipt':
      return { kind: 'metrics', focus: 'burnBreakdown' }
    case 'release':
      return { kind: 'projects' }
    case 'roundWindow':
    case 'roundWeek':
      return { kind: 'growth', section: 'round' }
    default:
      return { kind: 'growth' }
  }
}
