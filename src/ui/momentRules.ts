// Pure rules of the moment cards under the HUD (docs/CORE_LOOP.md §7 "Popup bütçesi"): how long each card stays,
// how many show at once, when the month receipt is one line, how a burst of events is merged, which panel a card
// opens. Kept free of React so the rules are unit-tested (momentRules.test.ts).
import type { Panel } from '../store/types'

export type MomentKind = 'receipt' | 'release' | 'outcome' | 'goal' | 'roundWindow' | 'roundWeek'

/** Every card closes by itself within 4 s (hovering holds it open). */
export const MOMENT_LIFE_MS: Record<MomentKind, number> = { receipt: 4000, release: 4000, outcome: 4000, goal: 3500, roundWindow: 4000, roundWeek: 3500 }

/** Cards on screen at once: two on desktop, one on a phone (the scene is small there). */
export function maxShown(mobile: boolean): number {
  return mobile ? 1 : 2
}

/** Cards waiting behind the shown ones. */
export const MOMENT_QUEUE_MAX = 3

/** The month receipt is a one-line toast on phones and at 4× (a payday every 15 s must not stack cards). */
export function receiptCompact(speed: number, mobile: boolean): boolean {
  return mobile || speed >= 4
}

/** Kinds where a newer card replaces an older one of the same kind (the old numbers are stale). */
const MERGE_KINDS: ReadonlySet<MomentKind> = new Set<MomentKind>(['receipt', 'roundWeek'])

/**
 * Adds fresh cards: a receipt / round week replaces the older one of its kind in place (keeps its slot on screen),
 * the rest queue behind. Over the limit the oldest WAITING card is dropped, never one that is on screen.
 */
export function mergeMoments<T extends { key: number; kind: MomentKind }>(cur: readonly T[], add: readonly T[], shown: number): T[] {
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

/** Panel a card opens when clicked. */
export function momentPanel(kind: MomentKind): Panel {
  switch (kind) {
    case 'release':
      return { kind: 'projects' }
    case 'roundWindow':
    case 'roundWeek':
      return { kind: 'growth', section: 'round' }
    default:
      return { kind: 'growth' }
  }
}
