// Pure scene layout derived from office slots: floor bounds, ring bands, door, walk targets.
// No game formulas here — only geometry for drawing and walking.
import { FOUNDER_SLOT_ID, type RingState, type Slot, type SlotId, type StageIndex } from '../engine/types'
import { CELL, gridToWorld, hashString } from './constants'
import { resolveFurniture } from './furnitureCatalog'

export interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface RingBand {
  ring: number
  unlocked: boolean
  /** Rectangles covering (ring box − inner ring box). */
  rects: Box[]
  box: Box
}

export type XZ = [number, number]

export interface OfficeLayout {
  stage: StageIndex
  /** Interior floor. */
  bounds: Box
  center: XZ
  /** Radius that encloses the office, for camera fit. */
  radius: number
  bands: RingBand[]
  /** Door is on the back (−z) wall. */
  door: { pos: XZ; inside: XZ; outside: XZ; width: number }
  slotWorld: Map<SlotId, XZ>
  /** Anchor slot id → world centre of the (possibly 2-cell) item footprint. */
  itemCenter: Map<SlotId, { pos: XZ; yaw: number; span: boolean }>
  /** Where people drink coffee (next to common items). */
  lounge: XZ[]
  /** Meeting room target, if one exists. */
  meeting?: XZ
  /** Unlocked walkable area (for onboarding wander). */
  walkBox: Box
}

function boxOfCells(cells: Slot[], pad: number): Box | null {
  if (cells.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const s of cells) {
    const [x, z] = gridToWorld(s.pos)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad }
}

function union(a: Box, b: Box): Box {
  return { minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ) }
}

function expand(b: Box, d: number): Box {
  return { minX: b.minX - d, maxX: b.maxX + d, minZ: b.minZ - d, maxZ: b.maxZ + d }
}

/** outer − inner as up to four rectangles (inner ⊆ outer). */
function bandRects(outer: Box, inner: Box | null): Box[] {
  if (!inner) return [outer]
  const out: Box[] = []
  const e = 1e-3
  if (inner.minZ - outer.minZ > e) out.push({ minX: outer.minX, maxX: outer.maxX, minZ: outer.minZ, maxZ: inner.minZ })
  if (outer.maxZ - inner.maxZ > e) out.push({ minX: outer.minX, maxX: outer.maxX, minZ: inner.maxZ, maxZ: outer.maxZ })
  if (inner.minX - outer.minX > e) out.push({ minX: outer.minX, maxX: inner.minX, minZ: inner.minZ, maxZ: inner.maxZ })
  if (outer.maxX - inner.maxX > e) out.push({ minX: inner.maxX, maxX: outer.maxX, minZ: inner.minZ, maxZ: inner.maxZ })
  return out
}

export function computeLayout(slots: readonly Slot[], rings: readonly RingState[], stage: StageIndex): OfficeLayout {
  const pad = CELL * 0.55
  const slotWorld = new Map<SlotId, XZ>()
  for (const s of slots) slotWorld.set(s.id, gridToWorld(s.pos))

  const maxRing = slots.reduce((m, s) => Math.max(m, s.ring), 0)
  const bands: RingBand[] = []
  let prev: Box | null = null
  for (let r = 0; r <= maxRing; r++) {
    const own = boxOfCells(
      slots.filter((s) => s.ring === r),
      pad,
    )
    if (!own && !prev) continue
    const box: Box = prev ? (own ? union(prev, own) : prev) : own!
    const ringState = rings.find((x) => x.index === r)
    const unlocked = r === 0 || (ringState ? ringState.unlocked : true)
    bands.push({ ring: r, unlocked, rects: bandRects(box, prev), box })
    prev = box
  }

  const fallback: Box = { minX: -CELL * 2, maxX: CELL * 2, minZ: -CELL * 2, maxZ: CELL * 2 }
  const bounds = expand(prev ?? fallback, CELL * 0.35)
  const unlockedBands = bands.filter((b) => b.unlocked)
  const walkBox = expand(unlockedBands[unlockedBands.length - 1]?.box ?? bounds, -CELL * 0.1)
  const center: XZ = [(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2]
  const radius = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2

  const doorX = Math.max(bounds.minX + CELL * 0.8, bounds.maxX - CELL * 1.1)
  const door = {
    pos: [doorX, bounds.minZ] as XZ,
    inside: [doorX, bounds.minZ + CELL * 0.6] as XZ,
    outside: [doorX, bounds.minZ - CELL * 1.4] as XZ,
    width: CELL * 0.9,
  }

  // Item footprints (2-cell items are centred between anchor and secondary).
  const itemCenter = new Map<SlotId, { pos: XZ; yaw: number; span: boolean }>()
  for (const s of slots) {
    // The founder desk is always drawn, even before any desk item exists.
    if ((!s.itemId && s.id !== FOUNDER_SLOT_ID) || s.spanOf) continue
    const base = slotWorld.get(s.id)!
    const second = slots.find((o) => o.spanOf === s.id)
    if (second) {
      const b = slotWorld.get(second.id)!
      const dx = b[0] - base[0]
      const dz = b[1] - base[1]
      itemCenter.set(s.id, { pos: [(base[0] + b[0]) / 2, (base[1] + b[1]) / 2], yaw: -Math.atan2(dz, dx), span: true })
    } else {
      itemCenter.set(s.id, { pos: base, yaw: -s.rotation * (Math.PI / 2), span: false })
    }
  }

  const lounge: XZ[] = []
  let meeting: XZ | undefined
  for (const s of slots) {
    if (!s.itemId || s.spanOf) continue
    const c = itemCenter.get(s.id)!.pos
    const ring = bands.find((b) => b.ring === s.ring)
    if (ring && !ring.unlocked) continue
    if (s.type === 'common') {
      const h = hashString(s.id)
      lounge.push([c[0] + (h % 2 === 0 ? 0.55 : -0.55) * CELL, c[1] + 0.45 * CELL])
    } else if (s.type === 'room') {
      const shape = resolveFurniture(s.itemId, s.type).shape
      if (!meeting || shape === 'meeting') meeting = c
    }
  }
  if (lounge.length === 0) lounge.push([door.inside[0] - CELL * 0.6, door.inside[1] + CELL * 0.3])

  return { stage, bounds, center, radius, bands, door, slotWorld, itemCenter, lounge, meeting, walkBox }
}

/** L-shaped path (x first, then z) from a to b; returns waypoints excluding a. */
export function lPath(a: XZ, b: XZ, xFirst = true): XZ[] {
  const corner: XZ = xFirst ? [b[0], a[1]] : [a[0], b[1]]
  const d1 = Math.hypot(corner[0] - a[0], corner[1] - a[1])
  const d2 = Math.hypot(b[0] - corner[0], b[1] - corner[1])
  if (d1 < 0.05 || d2 < 0.05) return [b]
  return [corner, b]
}

/** Path from inside the office to the door and out. */
export function pathToDoor(from: XZ, layout: OfficeLayout, exit: boolean): XZ[] {
  const pts = lPath(from, layout.door.inside, false)
  if (exit) pts.push(layout.door.outside)
  return pts
}

/** Path from outside the door to a target inside. */
export function pathFromDoor(target: XZ, layout: OfficeLayout): XZ[] {
  return [layout.door.inside, ...lPath(layout.door.inside, target, false)]
}
