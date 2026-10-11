// Pure scene layout derived from office slots: floor bounds, ring bands, door, walk targets.
// No game formulas here — only geometry for drawing and walking.
import { FOUNDER_SLOT_ID, type RingState, type Slot, type SlotId, type StageIndex } from '../engine/types'
import { CELL, gridToWorld, hashString, rotateXZ } from './constants'
import { findPath, isFreeFloor } from './nav'
import { resolveFurniture, type ShapeKey } from './furnitureCatalog'

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
  /** Where people drink coffee: two spots per common item, beside its front, pushed clear of it. */
  lounge: XZ[]
  /** Facing for each lounge spot (toward its item). */
  loungeYaw: number[]
  /** Where people without a desk wait: off the door → founder lane, nearest the door first. */
  idle: XZ[]
  /** Meeting room target, if one exists. */
  meeting?: XZ
  /** Yaw / 2-cell span of the meeting room item (seats sit at its table ends). */
  meetingYaw?: number
  meetingSpan?: boolean
  /** Unlocked walkable area (for onboarding wander). */
  walkBox: Box
  /** World-space footprints of placed furniture; characters path around these. */
  obstacles: Box[]
  /** Structural columns (stages 3–5), kept off slot cells and the door lane. */
  columns: XZ[]
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

/** Local blocked rect of a model (CELL units, front/chair side = +z), leaving seats reachable. */
function footprint(shape: ShapeKey, span: boolean): { hx: number; z0: number; z1: number } {
  const wide = span ? 0.5 : 0
  switch (shape) {
    case 'desk':
    case 'deskErgo':
    case 'deskDual':
      return { hx: 0.43, z0: -0.3, z1: 0.2 }
    case 'meeting':
      return { hx: (span ? 0.8 : 0.4) + 0.15, z0: -0.65, z1: 0.26 }
    case 'plant':
      return { hx: 0.25, z0: -0.25, z1: 0.25 }
    default:
      return { hx: 0.44 + wide, z0: -0.44, z1: 0.3 }
  }
}

/** World AABB of a local rect rotated by yaw (three.js Y rotation) around `c`. */
function rotatedBox(c: XZ, yaw: number, hx: number, z0: number, z1: number): Box {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const out: Box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  for (const lx of [-hx, hx]) {
    for (const lz of [z0, z1]) {
      const x = c[0] + (lx * cos + lz * sin) * CELL
      const z = c[1] + (-lx * sin + lz * cos) * CELL
      out.minX = Math.min(out.minX, x)
      out.maxX = Math.max(out.maxX, x)
      out.minZ = Math.min(out.minZ, z)
      out.maxZ = Math.max(out.maxZ, z)
    }
  }
  return out
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
    // Just past the threshold: further out, heads show above the back wall.
    outside: [doorX, bounds.minZ - CELL * 0.35] as XZ,
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

  const obstacles: Box[] = []
  for (const s of slots) {
    const c = itemCenter.get(s.id)
    if (!c) continue
    const shape = resolveFurniture(s.itemId ?? 'desk-basic', s.type).shape
    const f = footprint(shape, c.span)
    obstacles.push(rotatedBox(c.pos, c.yaw, f.hx, f.z0, f.z1))
  }

  // Columns on a coarse grid, skipping any spot that would land on a slot cell or in the doorway.
  const columns: XZ[] = []
  if (stage >= 3 && stage <= 5) {
    const step = CELL * 3
    const slotPts = [...slotWorld.values()]
    for (let x = bounds.minX + step; x < bounds.maxX - CELL; x += step) {
      for (let z = bounds.minZ + step; z < bounds.maxZ - CELL; z += step) {
        const c: XZ = [x + CELL * 0.5, z + CELL * 0.5]
        if (Math.hypot(c[0], c[1]) <= CELL * 1.5) continue
        if (slotPts.some((p) => Math.max(Math.abs(p[0] - c[0]), Math.abs(p[1] - c[1])) < CELL * 0.75)) continue
        if (Math.abs(c[0] - door.pos[0]) < CELL * 0.7 && c[1] < door.inside[1] + CELL) continue
        columns.push(c)
        obstacles.push({ minX: c[0] - 0.11, maxX: c[0] + 0.11, minZ: c[1] - 0.11, maxZ: c[1] + 0.11 })
      }
    }
  }

  // Series B stairs along the back-left corner (drawn in Office.tsx).
  if (stage === 4) obstacles.push({ minX: bounds.minX, maxX: bounds.minX + 0.95, minZ: bounds.minZ, maxZ: bounds.minZ + 4.6 })

  // A seated person is furniture too: walkers path around occupied seats instead of through laps.
  for (const s of slots) {
    if (s.type !== 'desk' || s.spanOf || (!s.occupantId && s.id !== FOUNDER_SLOT_ID)) continue
    const seat = seatPoint(slotWorld.get(s.id)!, s.rotation)
    obstacles.push({ minX: seat[0] - SEAT_HALF, maxX: seat[0] + SEAT_HALF, minZ: seat[1] - SEAT_HALF, maxZ: seat[1] + SEAT_HALF })
  }

  const founderSeat = slotWorld.get(FOUNDER_SLOT_ID)
  const laneEnd: XZ = founderSeat ? seatPoint(founderSeat, slots.find((s) => s.id === FOUNDER_SLOT_ID)!.rotation) : center
  const idle = idleCandidates(walkBox, obstacles, door, laneEnd)

  const lounge: XZ[] = []
  const loungeYaw: number[] = []
  let meeting: XZ | undefined
  let meetingYaw: number | undefined
  let meetingSpan: boolean | undefined
  for (const s of slots) {
    if (!s.itemId || s.spanOf) continue
    const item = itemCenter.get(s.id)!
    const c = item.pos
    const ring = bands.find((b) => b.ring === s.ring)
    if (ring && !ring.unlocked) continue
    if (s.type === 'common') {
      // Both front corners, rotated with the item and pushed 0.1 u past its footprint.
      const side = hashString(s.id) % 2 === 0 ? 1 : -1
      const hx = (item.span ? 1.05 : 0.55) * CELL
      for (const sx of [side, -side]) {
        const p = localToWorld(c, item.yaw, sx * hx, 0.45 * CELL + 0.1)
        lounge.push(p)
        loungeYaw.push(Math.atan2(c[0] - p[0], c[1] - p[1]))
      }
    } else if (s.type === 'room') {
      const shape = resolveFurniture(s.itemId, s.type).shape
      if (!meeting || shape === 'meeting') {
        meeting = c
        meetingYaw = item.yaw
        meetingSpan = item.span
      }
    }
  }
  if (lounge.length === 0) {
    for (const p of idle.slice(0, 2)) {
      lounge.push(p)
      loungeYaw.push(0.6)
    }
  }
  if (lounge.length === 0) {
    lounge.push([door.inside[0] - CELL * 0.6, door.inside[1] + CELL * 0.3])
    loungeYaw.push(0.6)
  }

  return { stage, bounds, center, radius, bands, door, slotWorld, itemCenter, lounge, loungeYaw, idle, meeting, meetingYaw, meetingSpan, walkBox, obstacles, columns }
}

/** Half size of the blocked square on an occupied seat (~0.5 × 0.5 u). */
const SEAT_HALF = 0.25

/** Seat point of a desk slot: 0.32 cells in front of it (Character.seatOf draws people here). */
export function seatPoint(base: XZ, rotation: number): XZ {
  const [ox, oz] = rotateXZ(0, 0.32 * CELL, rotation)
  return [base[0] + ox, base[1] + oz]
}

/** Item-local (x, z) offset (front = +z) to world, using the item yaw (same convention as rotatedBox). */
export function localToWorld(c: XZ, yaw: number, lx: number, lz: number): XZ {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return [c[0] + lx * cos + lz * sin, c[1] - lx * sin + lz * cos]
}

/** Distance from p to the segment a→b. */
function segDist(p: XZ, a: XZ, b: XZ): number {
  const vx = b[0] - a[0]
  const vz = b[1] - a[1]
  const len2 = vx * vx + vz * vz
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / len2)) : 0
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vz * t))
}

/** Clearance kept from the door → founder lane and from furniture by idle spots. */
const LANE_CLEAR = 0.6
const IDLE_STEP = 0.6
const IDLE_MAX = 12

/** Free floor points on a 0.6 u grid, off the lane and furniture, nearest the door first. */
function idleCandidates(walk: Box, obstacles: readonly Box[], door: OfficeLayout['door'], laneEnd: XZ): XZ[] {
  const pts: { p: XZ; d: number }[] = []
  const inX = walk.maxX - walk.minX
  const inZ = walk.maxZ - walk.minZ
  const nx = Math.max(1, Math.floor(inX / IDLE_STEP))
  const nz = Math.max(1, Math.floor(inZ / IDLE_STEP))
  const x0 = walk.minX + (inX - (nx - 1) * IDLE_STEP) / 2
  const z0 = walk.minZ + (inZ - (nz - 1) * IDLE_STEP) / 2
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const p: XZ = [x0 + i * IDLE_STEP, z0 + j * IDLE_STEP]
      if (segDist(p, door.outside, door.inside) < LANE_CLEAR || segDist(p, door.inside, laneEnd) < LANE_CLEAR) continue
      if (obstacles.some((o) => p[0] > o.minX - 0.3 && p[0] < o.maxX + 0.3 && p[1] > o.minZ - 0.3 && p[1] < o.maxZ + 0.3)) continue
      pts.push({ p, d: Math.hypot(p[0] - door.inside[0], p[1] - door.inside[1]) })
    }
  }
  pts.sort((a, b) => a.d - b.d)
  return pts.slice(0, IDLE_MAX).map((x) => x.p)
}

/** Idle (desk-less) standing spots, off the door lane (spots.reserve picks one per person). */
export function idleSpots(L: OfficeLayout): XZ[] {
  return L.idle
}

/** A door-queue spot keeps this far from door.outside (walker.DOOR_CLEAR + margin), so a waiting body never holds the door. */
export const QUEUE_DOOR_CLEAR = 0.85
/** …and this far from the door lane (outside → inside), leaving the entry walk free. */
export const QUEUE_LANE_CLEAR = 0.6
/** Spacing of the fan (≥ spots.reserve's 0.55 minDist, so every spot can be held at once). */
const QUEUE_STEP = 0.6
const queueCache = new WeakMap<OfficeLayout, XZ[]>()

/**
 * Where a visitor waits when every spot at their target is taken: a fan either side of the entry lane, just inside
 * the door, nearest first (row by row, alternating sides). Each point is on free floor, off the door lane and clear
 * of door.outside. Spots are QUEUE_STEP apart, so spots.reserve can hand every one out; when all are held the next
 * visitor waits outside, unseen.
 */
export function doorQueue(L: OfficeLayout): XZ[] {
  const hit = queueCache.get(L)
  if (hit) return hit
  const [x, z] = L.door.inside
  // Bounds, not walkBox: the door can open onto a still-locked ring, which people do walk through.
  const b = L.bounds
  const pts: { p: XZ; d: number }[] = []
  for (let row = 0; row < 3; row++) {
    for (let k = 1; k <= 3; k++) {
      for (const side of [-1, 1]) {
        const p: XZ = [x + side * k * QUEUE_STEP, z + 0.15 + row * QUEUE_STEP]
        if (p[0] < b.minX + 0.3 || p[0] > b.maxX - 0.3 || p[1] < b.minZ + 0.3 || p[1] > b.maxZ - 0.3) continue
        if (segDist(p, L.door.outside, L.door.inside) < QUEUE_LANE_CLEAR) continue
        if (Math.hypot(p[0] - L.door.outside[0], p[1] - L.door.outside[1]) < QUEUE_DOOR_CLEAR) continue
        if (L.obstacles.some((o) => p[0] > o.minX - 0.25 && p[0] < o.maxX + 0.25 && p[1] > o.minZ - 0.25 && p[1] < o.maxZ + 0.25)) continue
        if (!isFreeFloor(L, p)) continue
        pts.push({ p, d: Math.hypot(p[0] - x, p[1] - z) })
      }
    }
  }
  pts.sort((a, b2) => a.d - b2.d)
  const out = pts.map((q) => q.p)
  queueCache.set(L, out)
  return out
}

/** Meeting room seats at the two table ends, facing each other: founder at −x, guest at +x. */
export function meetingSeats(L: OfficeLayout): { founder: { pos: XZ; yaw: number }; guest: { pos: XZ; yaw: number } } | null {
  if (!L.meeting) return null
  const yaw = L.meetingYaw ?? 0
  const end = (L.meetingSpan ? 0.85 : 0.45) * CELL
  const f = localToWorld(L.meeting, yaw, -end, 0.1 * CELL)
  const g = localToWorld(L.meeting, yaw, end, 0.1 * CELL)
  return {
    founder: { pos: f, yaw: Math.atan2(g[0] - f[0], g[1] - f[1]) },
    guest: { pos: g, yaw: Math.atan2(f[0] - g[0], f[1] - g[1]) },
  }
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
  const pts = findPath(from, layout.door.inside, layout)
  if (exit) pts.push(layout.door.outside)
  return pts
}

/** Path from outside the door to a target inside. */
export function pathFromDoor(target: XZ, layout: OfficeLayout): XZ[] {
  return [layout.door.inside, ...findPath(layout.door.inside, target, layout)]
}

/** Margin around the furnished area when a phone frames it (a desk's width, so people at the edge desks stay in). */
const FURNISHED_PAD = CELL * 1.2

/**
 * Portrait phone, default zoom: the furnished part of the office plus FURNISHED_PAD (always with the door, where
 * people come in), clamped to the office. From Series A the whole floor fitted into 390 px made the office a third of
 * the screen with 4-5 px people (QA); bare floor around the desks is what gets cropped. Null when it would not help.
 */
export function furnishedBox(layout: OfficeLayout, slots: readonly Pick<Slot, 'id' | 'itemId'>[]): { cx: number; cz: number; r: number } | null {
  let minX = layout.door.inside[0]
  let maxX = minX
  let minZ = layout.door.inside[1]
  let maxZ = minZ
  let n = 0
  for (const s of slots) {
    if (!s.itemId) continue
    const c = layout.itemCenter.get(s.id)?.pos ?? layout.slotWorld.get(s.id)
    if (!c) continue
    n++
    minX = Math.min(minX, c[0])
    maxX = Math.max(maxX, c[0])
    minZ = Math.min(minZ, c[1])
    maxZ = Math.max(maxZ, c[1])
  }
  if (n === 0) return null
  const b = layout.bounds
  minX = Math.max(b.minX, minX - FURNISHED_PAD)
  maxX = Math.min(b.maxX, maxX + FURNISHED_PAD)
  minZ = Math.max(b.minZ, minZ - FURNISHED_PAD)
  maxZ = Math.min(b.maxZ, maxZ + FURNISHED_PAD)
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, r: Math.hypot(maxX - minX, maxZ - minZ) / 2 }
}
