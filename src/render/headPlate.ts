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

/** A pop sprite is never smaller than `minPx` on screen: scale = max(base, minPx / pxPerWorldUnit). */
export const popScale = (base: number, pxPerUnit: number, minPx = 20): number => (pxPerUnit > 0 ? Math.max(base, minPx / pxPerUnit) : base)
