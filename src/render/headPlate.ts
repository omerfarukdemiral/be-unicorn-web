// Head plates (H1): the little card over a seated person: specialty icon, first name, salary, a fatigue bar and at most
// one state glyph. The rules are pure so they can be tested; HeadPlates.tsx draws it. Replaces the persistent desk badges.
import * as B from '../engine/balance'
import { onLeave } from '../engine/effort'
import type { Employee, PersonEffort } from '../engine/types'

/** Morale below this shows the heart (the leaving / burnout statuses have their own head icons). */
export const LOW_MORALE = 35
/** Plates whose projected anchors are closer than this (CSS px) drop to icon + bar. */
export const CROWD_PX = 48
/** Longest first name shown whole. */
export const NAME_MAX = 8

export type PlateGlyph = 'tired' | 'morale' | 'bored'

/** What effort adds to the plate; without it (the garage, old callers) there is no state glyph. */
export interface PlateFx {
  day: number
  /** derived.people: empty / absent in the garage. */
  people?: Readonly<Record<string, PersonEffort>>
}

/** The one glyph that stays: tired (fatigue ≥ FATIGUE_TIRED) > low morale > bored (under UNDERLOAD). */
export function plateGlyph(e: Employee, fx?: PlateFx): PlateGlyph | null {
  if (e.status === 'leaving' || e.status === 'burnout') return null
  const effort = !!fx?.people?.[e.id]
  if (effort && fx && !onLeave(e, fx.day) && (e.fatigue ?? 0) >= B.FATIGUE_TIRED) return 'tired'
  if (e.morale < LOW_MORALE) return 'morale'
  if (effort && fx && !onLeave(e, fx.day) && e.dept !== 'sales' && e.status !== 'onboarding' && (e.loadAvg ?? 1) < B.UNDERLOAD) return 'bored'
  return null
}

/** Fatigue bar colour: green under 40, amber 40-59, red from FATIGUE_TIRED. */
export function fatigueTone(f: number): 'ok' | 'warn' | 'bad' {
  return f >= B.FATIGUE_TIRED ? 'bad' : f >= 40 ? 'warn' : 'ok'
}

export const shortName = (name: string): string => {
  const first = name.trim().split(/\s+/)[0] ?? ''
  return first.length > NAME_MAX ? `${first.slice(0, NAME_MAX - 1)}…` : first
}

/** "$1.7K" / "$800" / "$12K". */
export function plateSalary(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0'
  if (n < 1000) return `$${Math.round(n)}`
  const k = n / 1000
  return `$${k >= 10 ? Math.round(k) : (Math.round(k * 10) / 10).toString()}K`
}

export interface PlateGate {
  /** seatedRegistry: at their own desk, standing still. */
  seated: boolean
  /** A center screen / modal / start call covers the scene. */
  covered: boolean
  /** A visible bubble belongs to this person. */
  ownBubble: boolean
  /** The plate's rect touches a visible bubble. */
  overlapsBubble: boolean
}

/** Shown only while seated; bubbles win; nothing under a covered scene. */
export const plateShown = (g: PlateGate): boolean => g.seated && !g.covered && !g.ownBubble && !g.overlapsBubble

/** Icon + bar only: the farthest zoom, or when another plate is within CROWD_PX. */
export const plateCompact = (zoom: number, crowded: boolean): boolean => zoom === 0 || crowded

/** Ids that have another anchor within `min` px (both of a close pair). */
export function crowdedIds(anchors: readonly { id: string; x: number; y: number }[], min = CROWD_PX): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < anchors.length; i++)
    for (let j = i + 1; j < anchors.length; j++) {
      const a = anchors[i]!
      const b = anchors[j]!
      if (Math.hypot(a.x - b.x, a.y - b.y) < min) {
        out.add(a.id)
        out.add(b.id)
      }
    }
  return out
}

/**
 * Compact plates still stack when seats touch (a team island seen from a phone): within `min` px only the plate
 * nearest the camera (lowest on screen) stays, the ones behind it step aside. Ids to hide.
 */
export const STACK_PX = 30
export function stackedIds(anchors: readonly { id: string; x: number; y: number }[], min = STACK_PX): Set<string> {
  const kept: { x: number; y: number }[] = []
  const out = new Set<string>()
  const order = [...anchors].sort((a, b) => b.y - a.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const a of order) {
    if (kept.some((k) => Math.hypot(a.x - k.x, a.y - k.y) < min)) out.add(a.id)
    else kept.push(a)
  }
  return out
}

/** A pop sprite is never smaller than `minPx` on screen: scale = max(base, minPx / pxPerWorldUnit). */
export const popScale = (base: number, pxPerUnit: number, minPx = 20): number => (pxPerUnit > 0 ? Math.max(base, minPx / pxPerUnit) : base)

/** Does any shown bubble belong to this person? Exact id match (`e1` is not `e12`); undefined = no speaker. */
export const hasOwnBubble = (id: string, speakers: Iterable<string | undefined>): boolean => {
  for (const s of speakers) if (s === id) return true
  return false
}

/** How much of a plate shows: name + salary, name only (the salary chip goes first), icon + bar, or nothing. */
export type PlateLevel = 'full' | 'name' | 'icon' | 'hidden'

export interface PlateBox {
  id: string
  /** Anchor (CSS px): the plate is centred on x with its bottom edge on y. */
  x: number
  y: number
  /** Widths (px) at each level; the height is shared. */
  w: { full: number; name: number; icon: number }
  h: number
  /** Hovered or selected: placed first, always whole. */
  pinned?: boolean
}

/** Gap (px) two plates keep between them. */
export const PLATE_GAP = 2

export interface PlateRect {
  l: number
  r: number
  t: number
  b: number
}

/**
 * Plate declutter (fix round 2 N5, round 3): plates are laid out greedily, pinned ones first, then nearest the camera
 * (lowest on screen). Each takes the richest level whose rect touches no plate already placed and no obstacle (bubbles,
 * status chips, "+N" floats): name + salary, then name only, then icon + bar; one that fits at none hides. A plate is
 * slid sideways to stay inside `[minX, maxX]` (a left-edge desk's plate no longer runs off the phone). `minLevel` caps
 * the richest level (the farthest zoom: icons only). Pinned plates ignore everything but the screen edge.
 */
export function declutterPlates(
  items: readonly PlateBox[],
  minLevel: 'full' | 'icon' = 'full',
  obstacles: readonly PlateRect[] = [],
  edge?: { minX: number; maxX: number },
): Map<string, { level: PlateLevel; x: number }> {
  const out = new Map<string, { level: PlateLevel; x: number }>()
  const placed: PlateRect[] = [...obstacles]
  const order = [...items].sort((a, b) => (a.pinned === b.pinned ? b.y - a.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.pinned ? -1 : 1))
  const levels: Exclude<PlateLevel, 'hidden'>[] = minLevel === 'icon' ? ['icon'] : ['full', 'name', 'icon']
  const touches = (box: PlateRect) => placed.some((p) => box.l < p.r + PLATE_GAP && p.l < box.r + PLATE_GAP && box.t < p.b + PLATE_GAP && p.t < box.b + PLATE_GAP)
  for (const it of order) {
    let got: { level: PlateLevel; x: number } = { level: 'hidden', x: it.x }
    for (const lv of it.pinned ? (['full'] as const) : levels) {
      const half = it.w[lv] / 2
      const x = edge ? Math.min(Math.max(it.x, edge.minX + half), Math.max(edge.minX + half, edge.maxX - half)) : it.x
      const box = { l: x - half, r: x + half, t: it.y - it.h, b: it.y }
      if (it.pinned || !touches(box)) {
        placed.push(box)
        got = { level: lv, x }
        break
      }
    }
    out.set(it.id, got)
  }
  return out
}

/** Estimated plate widths (px) from its text: 11px semibold name, 10px tabular salary, 16px dept dot, 6px side padding. */
export function plateWidths(p: { name: string; salary: string; lead: boolean; glyph: unknown }): PlateBox['w'] {
  const icon = 12 + 16 + (p.lead ? 16 : 0)
  const name = icon + 4 + p.name.length * 6.4 + (p.glyph ? 17 : 0)
  return { icon, name, full: name + 4 + p.salary.length * 5.8 }
}
