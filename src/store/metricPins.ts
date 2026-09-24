// Top-bar pins for Metrikler gauges (docs/LAYOUT.md §5.2). Pure rules, no React, no src/ui import:
// the widget registry (src/ui/widgets.tsx) mirrors PINNABLE / MERGED_INTO and a test checks they agree.
import type { HudWidget } from '../engine/types'

/** At most this many gauges sit in the top bar. Pinning one more evicts the oldest. */
export const PIN_MAX = 2

/** Gauges that may be pinned (the Metrikler cards with a live number). Top-bar gauges, badges and links are not. */
export const PINNABLE: ReadonlySet<HudWidget> = new Set<HudWidget>([
  'burnBreakdown',
  'profitProjection',
  'capTable',
  'revenueDistribution',
  'retention',
  'arpu',
  'ltvCac',
  'channelBreakdown',
  'reputation',
  'moraleHeatmap',
  'coordinationWarning',
  'debtCounter',
])

/** Gauges folded into another card: churn is shown by Tutunma, founder stake by Cap table. */
export const MERGED_INTO: Readonly<Partial<Record<HudWidget, HudWidget>>> = {
  churn: 'retention',
  equity: 'capTable',
}

/** The card a gauge lives on (itself unless merged). */
export function canonicalMetric(id: HudWidget): HudWidget {
  return MERGED_INTO[id] ?? id
}

/** Every gauge id that shows up on card `id` (itself + the ones merged into it). */
export function metricSources(id: HudWidget): HudWidget[] {
  const out: HudWidget[] = [id]
  for (const [from, to] of Object.entries(MERGED_INTO) as [HudWidget, HudWidget][]) if (to === id) out.push(from)
  return out
}

/** Card `id` is visible when it or a gauge merged into it is unlocked. */
export function metricUnlocked(id: HudWidget, unlocked: readonly HudWidget[]): boolean {
  return metricSources(id).some((x) => unlocked.includes(x))
}

/** Pins whose card is unlocked in this run (the ones the top bar can draw), oldest first. */
export function effectivePins(pins: readonly HudWidget[], unlocked: readonly HudWidget[]): HudWidget[] {
  return pins.filter((id) => metricUnlocked(id, unlocked))
}

/** Adds `id` as the newest pin; with PIN_MAX pins the oldest leaves. Unknown / unpinnable ids change nothing. */
export function addPin(pins: readonly HudWidget[], raw: HudWidget): HudWidget[] {
  const id = canonicalMetric(raw)
  if (!PINNABLE.has(id) || pins.includes(id)) return [...pins]
  const next = [...pins, id]
  while (next.length > PIN_MAX) next.shift()
  return next
}

export function removePin(pins: readonly HudWidget[], raw: HudWidget): HudWidget[] {
  const id = canonicalMetric(raw)
  return pins.filter((x) => x !== id)
}

/**
 * Automatic pinning (until the player pins by hand): each newly unlocked, pinnable card fills a FREE slot, counting
 * only pins that are visible in this run. A locked pin kept from an earlier run gives its place up when the list
 * would grow past PIN_MAX. Returns `pins` itself when nothing changes.
 */
export function autoPin(pins: HudWidget[], fresh: readonly HudWidget[], unlocked: readonly HudWidget[]): HudWidget[] {
  let next = pins
  for (const raw of fresh) {
    const id = canonicalMetric(raw)
    if (!PINNABLE.has(id) || next.includes(id)) continue
    if (effectivePins(next, unlocked).length >= PIN_MAX) break
    next = [...next, id]
    while (next.length > PIN_MAX) {
      const locked = next.findIndex((x) => !metricUnlocked(x, unlocked))
      if (locked < 0) break
      next = next.filter((_, i) => i !== locked)
    }
  }
  return next
}

/** Unlocked, pinnable cards not yet seen in Metrikler (Dock badge count, "Yeni" tag). */
export function unseenMetrics(unlocked: readonly HudWidget[], seen: readonly HudWidget[]): HudWidget[] {
  const out: HudWidget[] = []
  for (const id of PINNABLE) {
    const src = metricSources(id)
    if (src.some((x) => unlocked.includes(x)) && !src.some((x) => seen.includes(x))) out.push(id)
  }
  return out
}

/** Keeps known ids only, without duplicates (storage may hold stale or foreign values). */
export function cleanMetricIds(ids: unknown, known: readonly string[]): HudWidget[] {
  if (!Array.isArray(ids)) return []
  const out: HudWidget[] = []
  for (const x of ids) if (typeof x === 'string' && known.includes(x) && !out.includes(x as HudWidget)) out.push(x as HudWidget)
  return out
}
