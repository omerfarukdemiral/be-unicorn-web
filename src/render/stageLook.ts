// Growth you can feel, part 2 (G2): the same office a little more finished each stage band. Cosmetic only: no
// engine state, no save, no rng. Band 1 (Pre-seed / Seed) is today's look everywhere, so nothing here changes it.
// Every extra is skipped on lowPower; the scene-wide budget keeps the draw-call cost to a handful of meshes.
import type { PrimitiveHint } from '../content'
import type { StageBand } from '../content/stageBand'
import { hash01 } from './constants'
import type { ShapeKey } from './furnitureCatalog'

type V3 = [number, number, number]

// --- Furniture finish -----------------------------------------------------------------------------------------

const box = (size: V3, pos: V3, color: string, rot?: V3): PrimitiveHint => (rot ? { kind: 'box', size, pos, color, rot } : { kind: 'box', size, pos, color })
const cyl = (r: number, h: number, pos: V3, color: string): PrimitiveHint => ({ kind: 'cylinder', size: [r, h, r], pos, color })
const sphere = (r: number, pos: V3, color: string): PrimitiveHint => ({ kind: 'sphere', size: [r, r, r], pos, color })
const cone = (r: number, h: number, pos: V3, color: string): PrimitiveHint => ({ kind: 'cone', size: [r, h, r], pos, color })

const WHITE = '#f4f1ea'
const BRASS = '#d9b45a'
const DARK = '#2b2d42'

/** A desk top sits at y 0.445 (content/furniture deskParts); props stand in its left back corner, clear of the monitors. */
const MONITOR_CHIN = box([0.36, 0.02, 0.035], [0, 0.48, -0.205], WHITE)
const DESK_B2: readonly PrimitiveHint[] = [
  MONITOR_CHIN,
  // desk lamp
  cyl(0.035, 0.02, [-0.34, 0.455, -0.24], '#4a4a4a'),
  box([0.015, 0.2, 0.015], [-0.34, 0.55, -0.24], '#4a4a4a'),
  cone(0.06, 0.07, [-0.34, 0.67, -0.22], '#f7e08a'),
]
const DESK_B3: readonly PrimitiveHint[] = [
  MONITOR_CHIN,
  // laptop
  box([0.3, 0.012, 0.2], [0.18, 0.451, 0.06], '#c9ccd6'),
  box([0.3, 0.2, 0.01], [0.18, 0.55, -0.04], DARK, [-0.2, 0, 0]),
  // small pot
  cyl(0.04, 0.06, [-0.34, 0.475, -0.24], WHITE),
  sphere(0.06, [-0.34, 0.54, -0.24], '#6a994e'),
  // chair headrest
  box([0.2, 0.06, 0.04], [0, 0.62, 0.55], 'accent'),
]

/**
 * What a shape gains per band, in the item's own cell units (extras for a band replace the lower band's, they do not
 * stack). Shapes and positions follow the catalog's primitives. Bands 0 and 1 hold nothing: a finished look is a
 * mark of a bigger company, not of a cheaper one.
 */
export const FINISH: Partial<Record<ShapeKey, Partial<Record<StageBand, readonly PrimitiveHint[]>>>> = {
  desk: { 2: DESK_B2, 3: DESK_B3 },
  deskErgo: { 2: DESK_B2, 3: DESK_B3 },
  deskDual: { 2: DESK_B2, 3: DESK_B3 },
  sofa: {
    2: [box([0.34, 0.1, 0.16], [0, 0.07, 0.38], '#f5ebe0'), box([0.4, 0.03, 0.2], [0, 0.14, 0.38], '#f5ebe0')],
    3: [box([0.34, 0.1, 0.16], [0, 0.07, 0.38], '#f5ebe0'), box([0.4, 0.03, 0.2], [0, 0.14, 0.38], '#f5ebe0')],
  },
  plant: {
    2: [cyl(0.19, 0.2, [-0.15, 0.1, -0.1], WHITE), cyl(0.13, 0.14, [0.22, 0.07, 0.15], WHITE)],
    3: [cyl(0.19, 0.2, [-0.15, 0.1, -0.1], WHITE), cyl(0.13, 0.14, [0.22, 0.07, 0.15], WHITE)],
  },
  coffee: {
    2: [box([0.16, 0.2, 0.14], [0.3, 0.59, -0.26], DARK), box([0.12, 0.04, 0.1], [0.3, 0.71, -0.26], '#c0c4cc')],
    3: [box([0.16, 0.2, 0.14], [0.3, 0.59, -0.26], DARK), box([0.12, 0.04, 0.1], [0.3, 0.71, -0.26], '#c0c4cc'), box([0.78, 0.03, 0.012], [0, 0.4, 0.128], BRASS), box([0.78, 0.03, 0.012], [0, 0.1, 0.128], BRASS)],
  },
  meeting: {
    2: [box([1.0, 0.5, 0.02], [0.5, 0.62, -0.42], DARK), box([0.94, 0.44, 0.005], [0.5, 0.62, -0.408], '#9cc9f5')],
    3: [box([1.0, 0.5, 0.02], [0.5, 0.62, -0.42], DARK), box([0.94, 0.44, 0.005], [0.5, 0.62, -0.408], '#9cc9f5')],
  },
}

/** Most extra meshes one item carries. */
export const MAX_EXTRAS_PER_ITEM = 6
/** Most extra meshes in the whole scene (the budget `pickExtras` keeps). */
export const MAX_EXTRAS_IN_SCENE = 30

/** Furniture finish only reads from the band where it exists; lowPower keeps today's look everywhere. */
export function furnitureBand(band: StageBand, lowPower: boolean): StageBand {
  return lowPower ? 1 : band
}

const NONE: readonly PrimitiveHint[] = []
export function extrasFor(shape: ShapeKey, band: StageBand, lowPower = false): readonly PrimitiveHint[] {
  if (lowPower) return NONE
  return FINISH[shape]?.[band] ?? NONE
}

/** The founder desk (no item in the slot) only gains a nameplate at the top band. */
const FOUNDER_NAMEPLATE: readonly PrimitiveHint[] = [box([0.2, 0.03, 0.06], [0, 0.46, 0.1], BRASS)]
export function founderDeskExtras(band: StageBand, lowPower = false): readonly PrimitiveHint[] {
  return !lowPower && band >= 3 ? FOUNDER_NAMEPLATE : NONE
}

/** Items the game starts with: they are repainted to the next catalog tiers as the company grows (band 2: one, band 3: two). */
export const STARTER_ITEMS: ReadonlySet<string> = new Set(['desk-basic'])

/**
 * Which placed items keep their extras so the scene stays within `max` meshes: a stable pick by key (so buying
 * something does not reshuffle the whole room, and a mix of lamps and bare desks reads as a lived-in office).
 */
export function pickExtras(items: readonly { key: string; count: number }[], max = MAX_EXTRAS_IN_SCENE): Set<string> {
  const ranked = items.filter((i) => i.count > 0).sort((a, b) => hash01(a.key, 11) - hash01(b.key, 11) || (a.key < b.key ? -1 : 1))
  const kept = new Set<string>()
  let total = 0
  for (const i of ranked) {
    if (total + i.count > max) continue
    kept.add(i.key)
    total += i.count
  }
  return kept
}

// --- Light ---------------------------------------------------------------------------------------------------

/** The sun: a warm garage afternoon → a clearer, cooler campus noon. Band 1 is the baseline. Radius is the soft-shadow blur. */
export const SUN: Record<StageBand, { color: string; radius: number }> = {
  0: { color: '#ffe9cc', radius: 3 },
  1: { color: '#fff0dc', radius: 5 },
  2: { color: '#fff6ea', radius: 5 },
  3: { color: '#f6f9ff', radius: 4 },
}

/** lowPower keeps its cheap blur (the colour is free). */
export function sunFor(band: StageBand, lowPower: boolean): { color: string; radius: number } {
  const s = SUN[band]
  return lowPower ? { color: s.color, radius: 2 } : s
}

// --- Wardrobe ------------------------------------------------------------------------------------------------

/** Jeans in the garage, chinos by Series A, dark trousers by Series C. Band 1 keeps the per-person pick of today. */
export const LEGS_BY_BAND: Partial<Record<StageBand, string>> = { 0: '#3d5378', 2: '#6b5641', 3: '#34323f' }

// --- Seed decor (wall-mounted) -------------------------------------------------------------------------------

export interface WallPiece {
  size: V3
  pos: V3
  color: string
  /** Cylinder facing the room (clock face / rim) instead of a box. */
  round?: boolean
  rot?: V3
}

/** Everything hangs at y >= 1.2 like the striped banner, on the back wall's inner face. */
export const WALL_MIN_Y = 1.2

/**
 * Seed office wall dressing: three framed prints above the windows, a clock over the door, a plaque beside it. Pure so
 * a test can keep it off the slot cells, the door lane and the walkers.
 */
export function seedDecorPlan(bounds: { minX: number; maxX: number; minZ: number }, door: { pos: [number, number]; width: number }): WallPiece[] {
  const z = bounds.minZ + 0.02
  const dl = door.pos[0] - door.width / 2
  const dr = door.pos[0] + door.width / 2
  const out: WallPiece[] = []
  // Prints: above the window row (windows top out at y 1.69), spread across the back wall left of the door.
  const x0 = bounds.minX + 1.1
  const x1 = dl - 1.1
  const n = x1 - x0 >= 2.4 ? 3 : x1 - x0 >= 1.2 ? 2 : 0
  const FRAMES = ['#e8c46a', '#f4f1ea', '#b0825c']
  const ART = ['#9cc9f5', '#f5a3b5', '#9fe0c3']
  for (let i = 0; i < n; i++) {
    const x = x0 +((x1 - x0) * i) / (n - 1)
    out.push({ size: [0.6, 0.36, 0.03], pos: [x, 1.96, z], color: FRAMES[i]! }, { size: [0.5, 0.26, 0.01], pos: [x, 1.96, z + 0.02], color: ART[i]! })
  }
  // Clock above the door (the wall over the lintel is solid): rim, face, two hands.
  const cx = door.pos[0]
  out.push(
    { size: [0.32, 0.03, 0.32], pos: [cx, 1.82, z + 0.01], color: '#3e3c48', round: true, rot: [Math.PI / 2, 0, 0] },
    { size: [0.27, 0.03, 0.27], pos: [cx, 1.82, z + 0.025], color: '#fbf8f2', round: true, rot: [Math.PI / 2, 0, 0] },
    { size: [0.02, 0.12, 0.01], pos: [cx, 1.88, z + 0.045], color: '#2b2a33' },
    { size: [0.09, 0.02, 0.01], pos: [cx + 0.045, 1.82, z + 0.045], color: '#2b2a33' },
  )
  // Plaque on the wall segment right of the door.
  out.push({ size: [0.4, 0.16, 0.02], pos: [Math.min(dr + 0.4, bounds.maxX - 0.3), 1.4, z], color: BRASS })
  return out
}
