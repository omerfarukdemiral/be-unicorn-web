// Free office grid (grid design §2–3): cells and zones, fixtures, the validity flood fill and auto placement.
// The office already is a grid: slots carry integer cells, and today's ring slots stay as "canonical" suggested cells.
// A piece moved off them sits on a `free` slot. Everything here is pure and deterministic; no render imports, the
// world geometry the fixtures need (CELL, the founder cross-aisle) is mirrored below and pinned by a test.
import * as B from './balance'
import { buildRingSlots, chebyshev, findPartnerSlot, isRingUnlocked, orphansOf, ringDistance, stageRingCount, type PlacementSpec } from './office'
import { FOUNDER_SLOT_ID, type ActionErrorCode, type DecorKind, type DecorPiece, type Dept, type GridPos, type LayoutSnapshot, type OfficeState, type Slot, type SlotId, type SlotType, type StageIndex, type StoredPiece, type WallPiece } from './types'
import { clone } from './util'
import { PAINT_KIND, PAINT_PRICE, decorDef } from '../content/decor'

export type Rotation = 0 | 1 | 2 | 3
export type CellKey = string

export const cellKey = (x: number, z: number): CellKey => `${x},${z}`

// ---------------------------------------------------------------------------
// Geometry (mirrors render/constants gridToWorld: one cell = CELL 1.5, linear, the floor tiles are the cells)
// ---------------------------------------------------------------------------

const GRID_CELL = 1.5

const axisToWorld = (v: number): number => v * GRID_CELL

/** Inverse of gridToWorld on one axis: the cell whose box holds the point. */
export function worldToGrid(w: number): number {
  return Math.round(w / GRID_CELL) || 0
}

/** Front of a piece (its chair / access side) for a rotation: render rotateXZ(0, 1, rot). */
export function frontDir(rot: number): GridPos {
  return [{ x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }, { x: 1, z: 0 }][rot & 3]!
}

/** Right-hand axis of a rotation (render rotateXZ(1, 0, rot)): where a size-2 room puts its second cell. */
export function rightDir(rot: number): GridPos {
  return [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }][rot & 3]!
}

/** Half size of the stage's ring square (the outer ring's Chebyshev distance): 1 / 3 / 5 / 7 / 9 / 11 / 11. */
export function ringHalf(stage: StageIndex): number {
  return ringDistance(stageRingCount(stage))
}

/**
 * Half size of the stage's floor in cells: the ring square plus one row along every wall, so the walls stand on cell
 * edges and a piece can go right against them (5×5 garage … 25×25 Series C). The wall row belongs to the outer ring.
 */
export function gridHalf(stage: StageIndex): number {
  return ringHalf(stage) + 1
}

/**
 * Ring (zone) a cell belongs to: the founder cell is 0, a ring owns its slot row and the walkway inside it. With a
 * stage, the row along the walls counts as the stage's outer ring.
 */
export function ringOfCell(c: GridPos, stage?: StageIndex): number {
  const d = Math.max(Math.abs(c.x), Math.abs(c.z))
  const r = d === 0 ? 0 : Math.ceil((d + 1) / 2)
  return stage === undefined ? r : Math.min(r, stageRingCount(stage))
}

export function inGrid(stage: StageIndex, c: GridPos): boolean {
  const h = gridHalf(stage)
  return Math.abs(c.x) <= h && Math.abs(c.z) <= h
}

/** In the grid and in an open ring: a piece may stand there unless a fixture or another piece is on it. */
export function cellOpen(office: OfficeState, c: GridPos): boolean {
  return inGrid(office.stage, c) && isRingUnlocked(office, ringOfCell(c, office.stage))
}

// ---------------------------------------------------------------------------
// Walk grid: half cells. Every cell is 2×2 walk nodes, so a desk blocks only its back half (the desk top) and its
// chair half stays floor: desks side by side, back to back or against a wall all leave the chairs reachable.
// Node (sx, sz) on an axis: sx = 2·(x + H) + k, k = 0 on the cell's −side, 1 on its +side.
// ---------------------------------------------------------------------------

interface WalkGrid {
  /** Cell half size (gridHalf). */
  H: number
  /** Nodes per side. */
  n: number
  blocked: Uint8Array
}

const subOf = (g: WalkGrid, v: number, k: number): number => 2 * (v + g.H) + k
const nodeAt = (g: WalkGrid, sx: number, sz: number): number => sz * g.n + sx
const inWalk = (g: WalkGrid, sx: number, sz: number): boolean => sx >= 0 && sz >= 0 && sx < g.n && sz < g.n

/** The four walk nodes of a cell. */
function cellNodes(g: WalkGrid, c: GridPos): number[] {
  const out: number[] = []
  for (const kz of [0, 1]) for (const kx of [0, 1]) {
    const sx = subOf(g, c.x, kx)
    const sz = subOf(g, c.z, kz)
    if (inWalk(g, sx, sz)) out.push(nodeAt(g, sx, sz))
  }
  return out
}

/** The two nodes of a cell on the side `f` points to (f = frontDir: the chair half of a desk). */
function halfNodes(g: WalkGrid, c: GridPos, f: GridPos): number[] {
  const out: number[] = []
  for (const k of [0, 1]) {
    const kx = f.x !== 0 ? (f.x > 0 ? 1 : 0) : k
    const kz = f.z !== 0 ? (f.z > 0 ? 1 : 0) : k
    const sx = subOf(g, c.x, kx)
    const sz = subOf(g, c.z, kz)
    if (inWalk(g, sx, sz)) out.push(nodeAt(g, sx, sz))
  }
  return out
}

const back = (f: GridPos): GridPos => ({ x: -f.x, z: -f.z })

// ---------------------------------------------------------------------------
// Fixtures: cells fixed by the stage's building, never by the player
// ---------------------------------------------------------------------------

export interface Fixtures {
  /** The door's cell (door.inside lands here): the flood fill starts on it. */
  door: GridPos
  /** The 2×2 cells just inside the door: kept clear, so nothing ever narrows the way in. */
  doorZone: GridPos[]
  /** No piece and no walking (the Series B stairs, the garage shelf). */
  blocked: Set<CellKey>
  /** No piece, but free floor (the door zone, the founder desk's cell, structural columns are a thin post). */
  noPiece: Set<CellKey>
  /** Column centres in world space (render/layout.ts draws exactly these). */
  columns: [number, number][]
}

const fixtureCache = new Map<StageIndex, Fixtures>()

/** Cells a world box overlaps (a cell's box is its centre ± half a cell). */
function cellsUnder(minX: number, maxX: number, minZ: number, maxZ: number, h: number): GridPos[] {
  const axis = (lo: number, hi: number): number[] => {
    const out: number[] = []
    for (let v = -h; v <= h; v++) {
      const c = axisToWorld(v)
      if (c + GRID_CELL / 2 > lo + 1e-6 && c - GRID_CELL / 2 < hi - 1e-6) out.push(v)
    }
    return out
  }
  const xs = axis(minX, maxX)
  const zs = axis(minZ, maxZ)
  return xs.flatMap((x) => zs.map((z) => ({ x, z })))
}

/** Interior floor of a stage in world units: the cell grid edge to edge (the walls stand on its outer cell edges). */
export function stageBounds(stage: StageIndex): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const e = (gridHalf(stage) + 0.5) * GRID_CELL
  return { minX: -e, maxX: e, minZ: -e, maxZ: e }
}

/** Length of the Series B stairs along the left wall (three cells of the wall row). */
export const STAIRS_LEN = GRID_CELL * 3

/**
 * The stage's fixed cells, from its bounds only: the door on the back wall above the ring square's last column with
 * the 2×2 cells inside it kept clear, the columns of stages 3–5 (on walkway cells, never on a ring slot), the Series B
 * stairs, the garage shelf and the founder desk's cell. Memoised per stage.
 */
export function stageFixtures(stage: StageIndex): Fixtures {
  const hit = fixtureCache.get(stage)
  if (hit) return hit
  const rh = ringHalf(stage)
  const h = gridHalf(stage)
  const b = stageBounds(stage)
  const door = { x: rh, z: -h }
  const doorZone = [door, { x: rh + 1, z: -h }, { x: rh, z: -rh }, { x: rh + 1, z: -rh }]
  const zone = new Set(doorZone.map((c) => cellKey(c.x, c.z)))
  const blocked = new Set<CellKey>()
  const noPiece = new Set<CellKey>([cellKey(0, 0), ...zone])
  const columns: [number, number][] = []
  if (stage >= 3 && stage <= 5) {
    const slots = new Set<CellKey>()
    for (let r = 1; r <= stageRingCount(stage); r++) for (const s of buildRingSlots(r)) slots.add(cellKey(s.pos.x, s.pos.z))
    // On every third cell (multiples of 3, inside the wall row), skipping the founder's square, ring slots and the door zone.
    const m = Math.floor((h - 1) / 3) * 3
    for (let x = -m; x <= m; x += 3) {
      for (let z = -m; z <= m; z += 3) {
        if (Math.max(Math.abs(x), Math.abs(z)) <= 1) continue
        const k = cellKey(x, z)
        if (slots.has(k) || zone.has(k)) continue
        columns.push([axisToWorld(x), axisToWorld(z)])
        noPiece.add(k)
      }
    }
  }
  // Series B stairs along the back of the left wall (render/layout.ts obstacle box).
  if (stage === 4) for (const cell of cellsUnder(b.minX, b.minX + 0.95, b.minZ, b.minZ + STAIRS_LEN, h)) blocked.add(cellKey(cell.x, cell.z))
  // The garage's metal shelf in the back-left corner.
  if (stage === 0) blocked.add(cellKey(-h, -h))
  const fx: Fixtures = { door, doorZone, blocked, noPiece, columns }
  fixtureCache.set(stage, fx)
  return fx
}

/** A cell of the stage's door zone (the 2×2 inside the door). */
export function inDoorZone(stage: StageIndex, c: GridPos): boolean {
  return stageFixtures(stage).doorZone.some((d) => d.x === c.x && d.z === c.z)
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** Footprint of a cosmetic piece (content/decor.ts). Unknown kinds are a blocking 1×1. */
export interface DecorShape {
  /** Cells along the right axis × along the front axis. */
  w: 1 | 2
  d: 1 | 2
  /** Rugs lie under everything and are walked on. */
  blocking: boolean
  /** Separators travel with the desks on a stage move; other decor goes to storage. */
  separator: boolean
}

export function decorShape(kind: DecorKind): DecorShape {
  const d = decorDef(kind)
  if (!d || d.group === 'wall') return { w: 1, d: 1, blocking: true, separator: false }
  return { w: d.w, d: d.d, blocking: d.blocking, separator: d.group === 'separator' }
}

export const isWallKind = (kind: string): boolean => kind === PAINT_KIND || decorDef(kind)?.group === 'wall'

/**
 * Wall segments a piece may hang on: one per cell column along the back (−z) wall and per cell row along the left
 * (−x) wall. None on the campus (no walls) and none on the Series C glass back wall.
 */
export function wallSegments(stage: StageIndex, wall: WallPiece['wall']): number[] {
  if (stage === 6 || (stage === 5 && wall === 'back')) return []
  const h = gridHalf(stage)
  const out: number[] = []
  for (let v = -h; v <= h; v++) out.push(v)
  return out
}

/** A wall can take paint: it stands and it is not glass. */
export const paintable = (stage: StageIndex, wall: WallPiece['wall']): boolean => wallSegments(stage, wall).length > 0

export function decorCells(p: Pick<DecorPiece, 'kind' | 'pos' | 'rotation'>): GridPos[] {
  const { w, d } = decorShape(p.kind)
  const r = rightDir(p.rotation)
  const f = frontDir(p.rotation)
  const out: GridPos[] = []
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push({ x: p.pos.x + r.x * i + f.x * j, z: p.pos.z + r.z * i + f.z * j })
  return out
}

/** Pieces that count against the decor cap: floor decor and wall pieces (paint is free). */
export function decorCount(office: OfficeState): number {
  return (office.decor?.length ?? 0) + (office.walls ?? []).filter((w) => w.kind !== PAINT_KIND).length
}

export function decorCap(stage: StageIndex): number {
  return B.DECOR_CAP[stage] ?? B.DECOR_CAP[B.DECOR_CAP.length - 1]!
}

/** A functional item as placed: its cells (anchor first) and its rotation. */
export interface ItemPiece {
  anchor: Slot
  cells: Slot[]
  rotation: Rotation
}

export function itemPieces(office: OfficeState): ItemPiece[] {
  const parts = new Map<SlotId, Slot[]>()
  for (const s of office.slots) if (s.spanOf !== undefined) parts.set(s.spanOf, [...(parts.get(s.spanOf) ?? []), s])
  const out: ItemPiece[] = []
  for (const s of office.slots) {
    if (s.spanOf !== undefined || s.itemId === undefined || s.id === FOUNDER_SLOT_ID) continue
    out.push({ anchor: s, cells: [s, ...(parts.get(s.id) ?? [])], rotation: s.rotation })
  }
  return out
}

/** Cells covered by a blocking piece: placed items, blocking decor and the founder desk. */
export function coveredCells(office: OfficeState): Set<CellKey> {
  const out = new Set<CellKey>([cellKey(0, 0)])
  for (const s of office.slots) if (s.itemId !== undefined) out.add(cellKey(s.pos.x, s.pos.z))
  for (const p of office.decor ?? []) if (decorShape(p.kind).blocking) for (const c of decorCells(p)) out.add(cellKey(c.x, c.z))
  return out
}

// ---------------------------------------------------------------------------
// Type caps: today's canonical slot counts over the unlocked rings, so the economy and the sim stay identical
// ---------------------------------------------------------------------------

const ringTypeCounts = new Map<number, Record<SlotType, number>>()

function typeCountsOfRing(ring: number): Record<SlotType, number> {
  let c = ringTypeCounts.get(ring)
  if (!c) {
    c = { desk: 0, common: 0, room: 0, special: 0 }
    for (const s of buildRingSlots(ring)) c[s.type]++
    ringTypeCounts.set(ring, c)
  }
  return c
}

/** Cells per item type the office may hold (room = cells, 2 a room). Desks: 4 / 8 / 12 / 21 / 28 / 36 by ring. */
export function typeCaps(office: OfficeState): Record<SlotType, number> {
  const out: Record<SlotType, number> = { desk: 0, common: 0, room: 0, special: 0 }
  for (const r of office.rings) {
    if (!r.unlocked) continue
    const c = typeCountsOfRing(r.index)
    for (const t of Object.keys(out) as SlotType[]) out[t] += c[t]
  }
  return out
}

/** Cells used per item type (the founder desk is free). */
export function typeUse(office: OfficeState): Record<SlotType, number> {
  const out: Record<SlotType, number> = { desk: 0, common: 0, room: 0, special: 0 }
  for (const s of office.slots) if (s.itemId !== undefined && s.id !== FOUNDER_SLOT_ID) out[s.type]++
  return out
}

// ---------------------------------------------------------------------------
// Validity
// ---------------------------------------------------------------------------

export type LayoutRefusal = 'outside' | 'locked' | 'fixture' | 'doorZone' | 'overlap' | 'typeCap' | 'decorCap' | 'blocksDoor' | 'sealsDesk'

export interface LayoutCheck {
  ok: boolean
  /** Offending cells ("x,z"). */
  bad: CellKey[]
  reason?: LayoutRefusal
}

/** A desk (any desk item, the founder's too): only its back half is solid, its chair half is floor. */
const deskLike = (type: SlotType): boolean => type === 'desk'

/** The office's founder desk as a piece of the walk grid (always drawn, item or not). */
function founderSlot(office: OfficeState): Slot | undefined {
  return office.slots.find((s) => s.id === FOUNDER_SLOT_ID)
}

/**
 * Walk nodes (half cells) of the office: fixtures, non-desk items and blocking decor take their whole cells, a desk
 * only the back half (the desk top); its chair half stays walkable floor.
 */
function walkGrid(office: OfficeState, fx: Fixtures, items: readonly ItemPiece[]): WalkGrid {
  const H = gridHalf(office.stage)
  const n = 2 * (2 * H + 1)
  const g: WalkGrid = { H, n, blocked: new Uint8Array(n * n) }
  const all = (c: GridPos) => {
    for (const k of cellNodes(g, c)) g.blocked[k] = 1
  }
  for (const k of fx.blocked) {
    const [x, z] = k.split(',').map(Number) as [number, number]
    all({ x, z })
  }
  const founder = founderSlot(office)
  if (founder) for (const k of halfNodes(g, founder.pos, back(frontDir(founder.rotation)))) g.blocked[k] = 1
  for (const it of items) {
    if (deskLike(it.anchor.type) && it.cells.length === 1) {
      for (const k of halfNodes(g, it.anchor.pos, back(frontDir(it.rotation)))) g.blocked[k] = 1
    } else for (const c of it.cells) all(c.pos)
  }
  for (const p of office.decor ?? []) if (decorShape(p.kind).blocking) for (const c of decorCells(p)) all(c)
  return g
}

/** 4-connected flood fill over free nodes from `start`; returns the reached mask (empty if start is blocked). */
function flood(g: WalkGrid, start: number): Uint8Array {
  const seen = new Uint8Array(g.n * g.n)
  if (g.blocked[start]) return seen
  const queue = [start]
  seen[start] = 1
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!
    const x = cur % g.n
    const z = Math.floor(cur / g.n)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const nz = z + dz
      if (!inWalk(g, nx, nz)) continue
      const k = nodeAt(g, nx, nz)
      if (seen[k] || g.blocked[k]) continue
      seen[k] = 1
      queue.push(k)
    }
  }
  return seen
}

/**
 * Where a piece is used from: a desk's own chair half; any other item's front edge, the two nodes of the next cell
 * along its front. Null when that edge is the wall.
 */
function accessNodes(g: WalkGrid, c: GridPos, rot: number, desk: boolean): number[] | null {
  const f = frontDir(rot)
  if (desk) return halfNodes(g, c, f)
  const n = { x: c.x + f.x, z: c.z + f.z }
  if (Math.abs(n.x) > g.H || Math.abs(n.z) > g.H) return null
  return halfNodes(g, n, back(f))
}

/**
 * Is this office layout legal? Run on a hovered cell change and on every commit (≤ 625 cells, one fill ≈ 0.1 ms):
 * 1. every piece cell is in the grid, in an open ring, off the fixtures and the door zone, not on another blocking piece;
 * 2. the type caps and the decor cap hold;
 * 3. a flood fill over half cells from the door reaches every desk's chair half (desks may stand side by side, back to
 *    back, in a row or against a wall) and the front edge of every other item. `sealsDesk` when one is cut off.
 */
export function validateLayout(office: OfficeState): LayoutCheck {
  const stage = office.stage
  const fx = stageFixtures(stage)
  const items = itemPieces(office)
  const seen = new Map<CellKey, 'item' | 'rug'>()
  const fail = (reason: LayoutRefusal, cells: GridPos[]): LayoutCheck => ({ ok: false, reason, bad: cells.map((c) => cellKey(c.x, c.z)) })
  const cellError = (c: GridPos): LayoutRefusal | null => {
    if (!inGrid(stage, c)) return 'outside'
    if (!isRingUnlocked(office, ringOfCell(c, stage))) return 'locked'
    if (inDoorZone(stage, c)) return 'doorZone'
    // The founder's desk is a piece on its cell like any other.
    if (c.x === 0 && c.z === 0) return 'overlap'
    const k = cellKey(c.x, c.z)
    if (fx.blocked.has(k) || fx.noPiece.has(k)) return 'fixture'
    return null
  }
  for (const it of items) {
    for (const s of it.cells) {
      // A canonical slot keeps its ring even where it differs from the cell's zone (it never does today).
      const err = s.free ? cellError(s.pos) : !isRingUnlocked(office, s.ring) ? 'locked' : cellError(s.pos)
      if (err) return fail(err, [s.pos])
      const k = cellKey(s.pos.x, s.pos.z)
      if (seen.has(k)) return fail('overlap', [s.pos])
      seen.set(k, 'item')
    }
  }
  for (const p of office.decor ?? []) {
    const blocking = decorShape(p.kind).blocking
    for (const c of decorCells(p)) {
      const err = cellError(c)
      if (err) return fail(err, [c])
      const k = cellKey(c.x, c.z)
      const other = seen.get(k)
      // A rug lies under anything but another rug; blocking pieces never share a cell.
      if (other !== undefined && (blocking ? other === 'item' : other === 'rug')) return fail('overlap', [c])
      if (blocking) seen.set(k, 'item')
      else if (other === undefined) seen.set(k, 'rug')
    }
  }
  const hung = new Set<string>()
  for (const w of office.walls ?? []) {
    const k = w.kind === PAINT_KIND ? `${w.wall}|paint` : `${w.wall}|${w.seg}`
    if (w.kind === PAINT_KIND ? !paintable(stage, w.wall) : !wallSegments(stage, w.wall).includes(w.seg)) return fail('outside', [])
    if (hung.has(k)) return fail('overlap', [])
    hung.add(k)
  }
  const caps = typeCaps(office)
  const use = typeUse(office)
  for (const t of Object.keys(caps) as SlotType[]) {
    if (use[t] > caps[t]) return fail('typeCap', office.slots.filter((s) => s.type === t && s.itemId !== undefined && s.free).map((s) => s.pos))
  }
  if (decorCount(office) > decorCap(stage)) return fail('decorCap', [])
  const g = walkGrid(office, fx, items)
  const start = cellNodes(g, fx.door)[0]!
  const reach = flood(g, start)
  if (!reach[start]) return fail('blocksDoor', [fx.door])
  const sealed: GridPos[] = []
  const founder = founderSlot(office)
  const uses: { cell: GridPos; rot: number; desk: boolean }[] = founder ? [{ cell: founder.pos, rot: founder.rotation, desk: true }] : []
  for (const it of items) {
    const desk = deskLike(it.anchor.type) && it.cells.length === 1
    for (const s of it.cells) uses.push({ cell: s.pos, rot: it.rotation, desk })
  }
  for (const u of uses) {
    const ks = accessNodes(g, u.cell, u.rot, u.desk)
    if (!ks || !ks.some((k) => reach[k] === 1)) sealed.push(u.cell)
  }
  if (sealed.length) return fail('sealsDesk', sealed)
  return { ok: true, bad: [] }
}

// ---------------------------------------------------------------------------
// Placement on the office (pure): what a placement would change, for validation and for the actions
// ---------------------------------------------------------------------------

/** Where a piece goes: a canonical slot (and its partner), or a free cell. */
export interface Placement {
  pos: GridPos
  rotation: Rotation
  /** Canonical slot taken (tiers 1–2); absent → new free slot(s) on `pos` (+ its right neighbour for a room). */
  slotId?: SlotId
  partnerId?: SlotId
  /** Decor pieces moved to storage to make room (worst case, ≤ 3). */
  bumped: string[]
}

/** Smallest unused free-slot id: f1, f2, … */
export function nextFreeSlotId(office: OfficeState): SlotId {
  let n = 1
  const ids = new Set(office.slots.map((s) => s.id))
  while (ids.has(`f${n}`)) n++
  return `f${n}`
}

/**
 * Writes `itemId` onto the office at `p` (mutates). Canonical: the slot (and partner) take the item. Free: new
 * `free` slots on the cell (and, for a room, the cell on its right). Returns the anchor slot.
 */
export function putItem(office: OfficeState, p: Placement, itemId: string, spec: PlacementSpec): Slot {
  if (p.slotId !== undefined) {
    const slot = office.slots.find((s) => s.id === p.slotId)!
    slot.itemId = itemId
    if (p.partnerId !== undefined) {
      const partner = office.slots.find((s) => s.id === p.partnerId)!
      partner.itemId = itemId
      partner.spanOf = slot.id
    }
    return slot
  }
  const anchor: Slot = { id: nextFreeSlotId(office), ring: ringOfCell(p.pos, office.stage), type: spec.slotType, pos: { ...p.pos }, rotation: p.rotation, itemId, free: true }
  office.slots.push(anchor)
  if (spec.size === 2) {
    const r = rightDir(p.rotation)
    const pos = { x: p.pos.x + r.x, z: p.pos.z + r.z }
    office.slots.push({ id: nextFreeSlotId(office), ring: ringOfCell(pos, office.stage), type: spec.slotType, pos, rotation: p.rotation, itemId, spanOf: anchor.id, free: true })
  }
  return anchor
}

/** Moves decor pieces to storage (mutates). */
export function storeDecor(office: OfficeState, ids: readonly string[]): void {
  if (!ids.length) return
  const storage = (office.storage ??= [])
  for (const id of ids) {
    const i = (office.decor ?? []).findIndex((p) => p.id === id)
    if (i < 0) continue
    const [p] = office.decor!.splice(i, 1)
    const row = storage.find((x) => x.kind === p!.kind)
    if (row) row.n++
    else storage.push({ kind: p!.kind, n: 1 })
  }
}

/** Shallow office copy whose slot / decor arrays (and slots) may be mutated freely. */
function trialOffice(office: OfficeState): OfficeState {
  return { ...office, slots: office.slots.map((s) => ({ ...s })), decor: (office.decor ?? []).map((p) => ({ ...p })) }
}

// ---------------------------------------------------------------------------
// Auto placement (one algorithm for everyone: phone buys, quick-buy, hires' desks, stage moves, load repair)
// ---------------------------------------------------------------------------

export interface AutoPlaceOpts {
  /** Desk team: prefer cells in that team's area. */
  team?: Dept
  /** Cells to skip. */
  avoid?: ReadonlySet<CellKey>
  /** Only today's canonical slots (tiers 1–2), as the shop's slot preview shows. */
  canonicalOnly?: boolean
  /** Ignore the type cap (stage moves re-place pieces the office already owns). */
  ignoreCap?: boolean
  /** Only cells in the team's area (tiers 1 and 3); no decor is bumped. Null when the area has no room. */
  teamOnly?: boolean
  /** Extra sort key for cells in the team's area, right after the team-neighbour count (lower first). */
  rank?: (c: GridPos) => number[]
}

const MAX_BUMPS = 3

/** Desk cells labelled `team` (with a desk on them). */
function teamCells(office: OfficeState, team: Dept | undefined): GridPos[] {
  if (team === undefined) return []
  return office.slots.filter((s) => s.type === 'desk' && s.team === team && s.itemId !== undefined).map((s) => s.pos)
}

function centroidOf(cells: readonly GridPos[]): GridPos | null {
  if (!cells.length) return null
  return { x: cells.reduce((a, c) => a + c.x, 0) / cells.length, z: cells.reduce((a, c) => a + c.z, 0) / cells.length }
}

const dist2 = (a: GridPos, b: GridPos): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!
  return false
}

/** Rotation order for a free cell: facing the founder first, then the rest in order. */
function rotationsFor(c: GridPos): Rotation[] {
  let face: Rotation
  if (Math.abs(c.x) > Math.abs(c.z)) face = c.x > 0 ? 1 : 3
  else face = c.z > 0 ? 2 : 0
  return [face, ...([0, 1, 2, 3] as Rotation[]).filter((r) => r !== face)]
}

interface Candidate {
  key: number[]
  place: Omit<Placement, 'bumped'>
}

function canonicalCandidates(office: OfficeState, spec: PlacementSpec, covered: Set<CellKey>, opts: AutoPlaceOpts, team: GridPos[], centre: GridPos | null): { inTeam: Candidate[]; rest: Candidate[] } {
  const inTeam: Candidate[] = []
  const rest: Candidate[] = []
  const free = (s: Slot) => !covered.has(cellKey(s.pos.x, s.pos.z)) && !opts.avoid?.has(cellKey(s.pos.x, s.pos.z))
  office.slots.forEach((s, order) => {
    if (s.free || s.id === FOUNDER_SLOT_ID || s.type !== spec.slotType || s.itemId !== undefined || s.spanOf !== undefined) return
    if (!isRingUnlocked(office, s.ring) || !free(s)) return
    let partnerId: SlotId | undefined
    let orphans = 0
    if (spec.size === 2) {
      const partner = findPartnerSlot(office, s)
      if (!partner || !free(partner)) return
      partnerId = partner.id
      orphans = orphansOf(office, s, partner, [])
    }
    const place = { pos: s.pos, rotation: s.rotation, slotId: s.id, ...(partnerId !== undefined ? { partnerId } : {}) }
    const near = team.filter((t) => chebyshev(t, s.pos) === 1).length
    if (near > 0) inTeam.push({ key: [-near, ...(opts.rank?.(s.pos) ?? []), centre ? dist2(s.pos, centre) : 0, dist2(s.pos, { x: 0, z: 0 }), order], place })
    // Tier 2 = today's findAutoSlotFor key: ring, then (rooms) orphan slots left, then squared distance, then slot order.
    else rest.push({ key: [s.ring, orphans, dist2(s.pos, { x: 0, z: 0 }), order], place })
  })
  return { inTeam, rest }
}

/** BFS distance on the walk grid from a cell (unreached → Infinity). */
function walkDistances(g: WalkGrid, from: GridPos): Int32Array {
  const d = new Int32Array(g.n * g.n).fill(-1)
  const sx = subOf(g, Math.round(from.x), 0)
  const sz = subOf(g, Math.round(from.z), 0)
  if (!inWalk(g, sx, sz)) return d
  const start = nodeAt(g, sx, sz)
  d[start] = 0
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!
    const x = cur % g.n
    const z = Math.floor(cur / g.n)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const nz = z + dz
      if (!inWalk(g, nx, nz)) continue
      const k = nodeAt(g, nx, nz)
      // Distances pass through blocked cells too (a desk cluster is not a wall to "near"), only the step counts.
      if (d[k]! >= 0) continue
      d[k] = d[cur]! + 1
      queue.push(k)
    }
  }
  return d
}

function freeCellCandidates(office: OfficeState, spec: PlacementSpec, covered: Set<CellKey>, opts: AutoPlaceOpts, team: GridPos[], centre: GridPos | null): { inTeam: Candidate[]; rest: Candidate[] } {
  const stage = office.stage
  const fx = stageFixtures(stage)
  const h = gridHalf(stage)
  const canonical = new Set(office.slots.filter((s) => !s.free && s.id !== FOUNDER_SLOT_ID).map((s) => cellKey(s.pos.x, s.pos.z)))
  const g = walkGrid(office, fx, itemPieces(office))
  const dist = walkDistances(g, centre ?? { x: 0, z: 0 })
  const open = (c: GridPos): boolean => {
    const k = cellKey(c.x, c.z)
    return cellOpen(office, c) && !fx.blocked.has(k) && !fx.noPiece.has(k) && !covered.has(k) && !opts.avoid?.has(k)
  }
  const inTeam: Candidate[] = []
  const rest: Candidate[] = []
  let order = 0
  for (let z = -h; z <= h; z++) {
    for (let x = -h; x <= h; x++) {
      const c = { x, z }
      if (!open(c)) continue
      for (const rotation of rotationsFor(c)) {
        if (spec.size === 2) {
          const r = rightDir(rotation)
          if (!open({ x: x + r.x, z: z + r.z })) continue
        }
        const d = dist[nodeAt(g, subOf(g, x, 0), subOf(g, z, 0))]!
        const near = team.filter((t) => chebyshev(t, c) === 1).length
        // Covering a canonical (suggested) cell comes last: phones and bots still look for those.
        const key = [canonical.has(cellKey(x, z)) ? 1 : 0, d < 0 ? 1e9 : d, dist2(c, { x: 0, z: 0 }), order++]
        const place = { pos: c, rotation }
        if (near > 0) inTeam.push({ key: [-near, ...(opts.rank?.(c) ?? []), ...key], place })
        else rest.push({ key, place })
      }
    }
  }
  return { inTeam, rest }
}

function sortCandidates(xs: Candidate[]): Candidate[] {
  return xs.sort((a, b) => (lexLess(a.key, b.key) ? -1 : lexLess(b.key, a.key) ? 1 : 0))
}

/** Trial office with `place` applied, for validateLayout. */
function withPlacement(office: OfficeState, place: Omit<Placement, 'bumped'>, spec: PlacementSpec): OfficeState {
  const t = trialOffice(office)
  putItem(t, { ...place, bumped: [] }, '__trial', spec)
  return t
}

function firstValid(office: OfficeState, spec: PlacementSpec, opts: AutoPlaceOpts): Omit<Placement, 'bumped'> | null {
  const covered = coveredCells(office)
  const team = teamCells(office, opts.team)
  const centre = centroidOf(team)
  const can = canonicalCandidates(office, spec, covered, opts, team, centre)
  const tiers = opts.teamOnly ? [sortCandidates(can.inTeam)] : [sortCandidates(can.inTeam), sortCandidates(can.rest)]
  for (const tier of tiers) for (const c of tier) if (validateLayout(withPlacement(office, c.place, spec)).ok) return c.place
  if (opts.canonicalOnly) return null
  const loose = freeCellCandidates(office, spec, covered, opts, team, centre)
  const looseTiers = opts.teamOnly ? [sortCandidates(loose.inTeam)] : [sortCandidates(loose.inTeam), sortCandidates(loose.rest)]
  for (const tier of looseTiers) for (const c of tier) if (validateLayout(withPlacement(office, c.place, spec)).ok) return c.place
  return null
}

/**
 * Where a new item goes. Tiers: (1) canonical empty slots in the team area, (2) any canonical empty slot by today's
 * findAutoSlotFor key, (3) free cells in the team area, (4) any free cell by walking distance from the team centroid
 * (else the founder). The first candidate that keeps the layout valid wins. Null when the type cap is reached;
 * when cells are only jammed by decor, up to three decor pieces nearest the centre go to storage (`bumped`).
 * Phones and new saves only ever see tiers 1–2, which is today's choice.
 */
export function autoPlace(office: OfficeState, spec: PlacementSpec, opts: AutoPlaceOpts = {}): Placement | null {
  if (!opts.ignoreCap && typeUse(office)[spec.slotType] + spec.size > typeCaps(office)[spec.slotType]) return null
  let cur = office
  const bumped: string[] = []
  for (let bump = 0; bump <= MAX_BUMPS; bump++) {
    const place = firstValid(cur, spec, opts)
    if (place) return { ...place, bumped }
    if (opts.canonicalOnly || opts.teamOnly) return null
    // Worst case: the cap allows it but decor jams every cell. Bump the blocking decor piece nearest the centre.
    const centre = centroidOf(teamCells(cur, opts.team)) ?? { x: 0, z: 0 }
    const decor = (cur.decor ?? []).filter((p) => decorShape(p.kind).blocking)
    if (!decor.length) return null
    let pick = decor[0]!
    for (const p of decor) if (dist2(p.pos, centre) < dist2(pick.pos, centre)) pick = p
    bumped.push(pick.id)
    cur = { ...cur, decor: (cur.decor ?? []).filter((p) => p.id !== pick.id) }
  }
  return null
}

/** Free cell for a decor piece (no type cap; the decor cap is checked by validateLayout), nearest the founder. */
export function autoPlaceDecor(office: OfficeState, kind: DecorKind): { pos: GridPos; rotation: Rotation } | null {
  const stage = office.stage
  const fx = stageFixtures(stage)
  const h = gridHalf(stage)
  const covered = coveredCells(office)
  const canonical = new Set(office.slots.filter((s) => !s.free && s.id !== FOUNDER_SLOT_ID).map((s) => cellKey(s.pos.x, s.pos.z)))
  const cands: { key: number[]; pos: GridPos; rotation: Rotation }[] = []
  let order = 0
  for (let z = -h; z <= h; z++) {
    for (let x = -h; x <= h; x++) {
      const pos = { x, z }
      for (const rotation of rotationsFor(pos)) cands.push({ key: [canonical.has(cellKey(x, z)) ? 1 : 0, dist2(pos, { x: 0, z: 0 }), order++], pos, rotation })
    }
  }
  cands.sort((a, b) => (lexLess(a.key, b.key) ? -1 : lexLess(b.key, a.key) ? 1 : 0))
  for (const c of cands) {
    const cells = decorCells({ kind, pos: c.pos, rotation: c.rotation })
    if (decorShape(kind).blocking && cells.some((p) => covered.has(cellKey(p.x, p.z)))) continue
    if (cells.some((p) => fx.blocked.has(cellKey(p.x, p.z)))) continue
    const t = trialOffice(office)
    t.decor!.push({ id: '__trial', kind, pos: c.pos, rotation: c.rotation })
    if (validateLayout(t).ok) return { pos: c.pos, rotation: c.rotation }
  }
  return null
}

// ---------------------------------------------------------------------------
// Hiring
// ---------------------------------------------------------------------------

function freeDeskWithItem(office: OfficeState, s: Slot): boolean {
  return s.type === 'desk' && s.id !== FOUNDER_SLOT_ID && s.itemId !== undefined && s.spanOf === undefined && s.occupantId === undefined && isRingUnlocked(office, s.ring)
}

/** Same-team desk cells around `c` (Chebyshev 1), `self` excluded. */
function teamNeighbours(office: OfficeState, dept: Dept, c: GridPos, self?: SlotId): number {
  let n = 0
  for (const s of office.slots) if (s.id !== self && s.type === 'desk' && s.team === dept && s.itemId !== undefined && s.spanOf === undefined && chebyshev(s.pos, c) <= B.TEAM_ADJ_RADIUS) n++
  return n
}

/**
 * Seat for a new hire of `dept` (read only): a free desk that touches the team (labelled `dept` or unlabelled; most
 * team neighbours, labelled first, then slot order), else a free desk labelled `dept` nearest the team's centroid,
 * else the first unlabelled free desk in slot order (it takes the label: today's firstFreeDesk choice), else any
 * free desk. autoSeat may still pull that unlabelled desk next to the team.
 */
export function nearestFreeDesk(office: OfficeState, dept: Dept): Slot | undefined {
  const free = office.slots.filter((s) => freeDeskWithItem(office, s))
  let touch: Slot | undefined
  let touchKey: number[] = []
  free.forEach((s, order) => {
    if (s.team !== undefined && s.team !== dept) return
    const n = teamNeighbours(office, dept, s.pos, s.id)
    if (n === 0) return
    const key = [-n, s.team === dept ? 0 : 1, order]
    if (!touch || lexLess(key, touchKey)) {
      touch = s
      touchKey = key
    }
  })
  if (touch) return touch
  const centre = centroidOf(office.slots.filter((s) => s.type === 'desk' && s.team === dept && s.occupantId !== undefined).map((s) => s.pos))
  const best = (xs: Slot[]): Slot | undefined => {
    if (!centre) return xs[0]
    let pick: Slot | undefined
    for (const s of xs) if (!pick || dist2(s.pos, centre) < dist2(pick.pos, centre)) pick = s
    return pick
  }
  return best(free.filter((s) => s.team === dept)) ?? free.find((s) => s.team === undefined) ?? best(free)
}

/**
 * Auto seat for a `dept` hire (grid §5; mutates): nearestFreeDesk, and when that is a spare, unlabelled desk on one
 * of today's ring slots away from a team that already has desks, the desk is first carried into the team's area
 * (autoPlace teamOnly: an empty ring desk slot by the team, else a free cell off the ring slots and their aisles,
 * aura neutral first). So phones and bots, which only buy onto ring slots, still grow team islands (TEAM_ADJ_BONUS)
 * the way a PC layout would, and nothing else about their office gets better. A desk the player moved off the ring
 * (`free`) or labelled stays where it is. Undefined: no free desk.
 */
export function autoSeat(office: OfficeState, dept: Dept): Slot | undefined {
  const desk = nearestFreeDesk(office, dept)
  if (!desk || desk.free || desk.team !== undefined || teamNeighbours(office, dept, desk.pos, desk.id) > 0) return desk
  if (!office.slots.some((s) => s.type === 'desk' && s.team === dept && s.itemId !== undefined && s.id !== FOUNDER_SLOT_ID)) return desk
  // Today's ring slots and the aisle cell in front of each stay clear, so every later buy still finds its slot.
  const avoid = new Set<CellKey>()
  for (const s of office.slots) {
    if (s.free || s.id === FOUNDER_SLOT_ID) continue
    const f = frontDir(restRotation(office.stage, s.id) ?? s.rotation)
    avoid.add(cellKey(s.pos.x, s.pos.z)).add(cellKey(s.pos.x + f.x, s.pos.z + f.z))
  }
  // Nor where a later office has a column, the stairs or its door: the island moves house unchanged.
  for (let st = office.stage + 1; st <= 6; st++) {
    const fx = stageFixtures(st as StageIndex)
    for (const k of fx.blocked) avoid.add(k)
    for (const k of fx.noPiece) avoid.add(k)
  }
  // Aura neutral first: a cell no nearer more of today's common-area / special cells than the ring slot it leaves
  // (the island is the bonus; a seat by the sofas on top would be a second one), else any cell by the team.
  const auraCells = office.slots.filter((s) => !s.free && (s.type === 'common' || s.type === 'special')).map((s) => s.pos)
  const exposure = (c: GridPos) => auraCells.filter((a) => chebyshev(a, c) <= B.ADJACENCY_RADIUS).length
  const limit = exposure(desk.pos)
  const nearer = new Set<CellKey>()
  const h = gridHalf(office.stage)
  for (let z = -h; z <= h; z++) for (let x = -h; x <= h; x++) if (exposure({ x, z }) > limit) nearer.add(cellKey(x, z))
  const neutral = new Set([...avoid, ...nearer])
  const spec: PlacementSpec = { slotType: 'desk', size: 1 }
  const trial = trialOffice(office)
  liftItem(trial, trial.slots.filter((s) => s.id === desk.id))
  // Within the team's area: fewest common-area cells in reach, then the outer side (the ring slots it frees are
  // refilled from the centre out, so the island grows where the outer ring desks would have been).
  const opts: AutoPlaceOpts = { team: dept, teamOnly: true, ignoreCap: true, rank: (c) => [exposure(c), -Math.max(Math.abs(c.x), Math.abs(c.z))] }
  const place =
    autoPlace(trial, spec, { ...opts, canonicalOnly: true, avoid: nearer }) ??
    autoPlace(trial, spec, { ...opts, avoid: neutral }) ??
    autoPlace(trial, spec, { ...opts, canonicalOnly: true }) ??
    autoPlace(trial, spec, { ...opts, avoid })
  if (!place) return desk
  const itemId = desk.itemId!
  liftItem(office, [desk])
  const slot = putItem(office, place, itemId, spec)
  slot.rotation = place.rotation
  return slot
}

// ---------------------------------------------------------------------------
// Stage move
// ---------------------------------------------------------------------------

/**
 * Carries the old office's pieces into the freshly built `next` (mutates `next`): canonical slots by id (furniture,
 * seat, team label, rotation), free slots by cell, separators by cell. Other floor decor and wall pieces go to
 * storage for free (paint stays with the old walls). A piece that lands on a new fixture (door, columns, stairs) is
 * re-placed with autoPlace; the rest keep their cells, so today's offices move pixel-identical.
 */
export function carryOffice(old: OfficeState, next: OfficeState): void {
  const byId = new Map(old.slots.map((s) => [s.id, s]))
  for (const s of next.slots) {
    const o = byId.get(s.id)
    if (!o) continue
    if (o.itemId !== undefined) s.itemId = o.itemId
    if (o.spanOf !== undefined) s.spanOf = o.spanOf
    if (o.occupantId !== undefined) s.occupantId = o.occupantId
    if (o.team !== undefined) s.team = o.team
    s.rotation = o.rotation
  }
  for (const o of old.slots) if (o.free) next.slots.push({ ...o, pos: { ...o.pos }, ring: ringOfCell(o.pos, next.stage) })
  next.decor = []
  next.storage = (old.storage ?? []).map((x) => ({ ...x }))
  next.saved = (old.saved ?? []).map((x) => ({ ...x }))
  next.walls = []
  const toStore: string[] = []
  for (const p of old.decor ?? []) {
    next.decor.push({ ...p, pos: { ...p.pos } })
    if (!decorShape(p.kind).separator) toStore.push(p.id)
  }
  // Walls stay with the old building: paintings go to storage, a painted wall leaves one free paint job behind.
  for (const w of old.walls ?? []) addStored(next.storage, w.kind)
  storeDecor(next, toStore)
  repairOffice(next)
  placeStarterDecor(next)
}

/** Lifts the items with a cell in `bad` (mutates): their item, seat and label, to be put down again. */
function liftBad(office: OfficeState, bad: (it: ItemPiece) => boolean): { spec: PlacementSpec; keep: { itemId: string; occupantId?: string; team?: Dept } }[] {
  const out = itemPieces(office)
    .filter(bad)
    .map((it) => {
      const spec: PlacementSpec = { slotType: it.anchor.type, size: it.cells.length === 2 ? 2 : 1 }
      const keep = { itemId: it.anchor.itemId!, ...(it.anchor.occupantId !== undefined ? { occupantId: it.anchor.occupantId } : {}), ...(it.anchor.team !== undefined ? { team: it.anchor.team } : {}) }
      liftItem(office, it.cells)
      return { spec, keep }
    })
  dropEmptyFreeSlots(office)
  return out
}

/**
 * Makes an office legal again after the building changed under it (a stage move, a save from before the door zone;
 * mutates): decor on a cell it may not use goes to storage, items on one are lifted and re-placed with autoPlace
 * (seat and team label kept), then anything still sealed in is re-placed the same way. A layout that was legal is
 * left exactly as it is.
 */
export function repairOffice(office: OfficeState): void {
  if (validateLayout(office).ok) return
  const fx = stageFixtures(office.stage)
  const badCell = (c: GridPos) => !cellOpen(office, c) || fx.blocked.has(cellKey(c.x, c.z)) || fx.noPiece.has(cellKey(c.x, c.z))
  storeDecor(office, (office.decor ?? []).filter((p) => decorCells(p).some(badCell)).map((p) => p.id))
  // Lift every clashing piece first: one still on a fixture would make every trial cell of the others invalid.
  const lifted = liftBad(office, (it) => it.cells.some((s) => (s.free ? badCell(s.pos) : !isRingUnlocked(office, s.ring) || badCell(s.pos))))
  for (let guard = 0; guard < 8; guard++) {
    const check = validateLayout(office)
    if (check.ok || check.reason !== 'sealsDesk') break
    const sealed = new Set(check.bad)
    // A sealed separator or decor piece never is: only items have a use side. Lift the sealed ones and their sealers.
    const before = lifted.length
    lifted.push(...liftBad(office, (it) => it.cells.some((s) => sealed.has(cellKey(s.pos.x, s.pos.z)))))
    if (lifted.length === before) break
  }
  for (const { spec, keep } of lifted) {
    const place = autoPlace(office, spec, { ...(keep.team !== undefined ? { team: keep.team } : {}), ignoreCap: true })
    if (!place) continue
    storeDecor(office, place.bumped)
    const anchor = putItem(office, place, keep.itemId, spec)
    if (keep.occupantId !== undefined) anchor.occupantId = keep.occupantId
    if (keep.team !== undefined) anchor.team = keep.team
  }
  // Still sealed (a decor ring around a desk): the blocking decor goes to storage, nearest the sealed cells first.
  for (let guard = 0; guard < 40; guard++) {
    const check = validateLayout(office)
    if (check.ok) break
    const decor = (office.decor ?? []).filter((p) => decorShape(p.kind).blocking)
    if (!decor.length) break
    const target = check.bad.map((k) => k.split(',').map(Number) as [number, number])
    const d = (p: DecorPiece) => Math.min(...target.map(([x, z]) => (p.pos.x - x) ** 2 + (p.pos.z - z) ** 2), 1e9)
    storeDecor(office, [decor.reduce((a, b) => (d(b) < d(a) ? b : a)).id])
  }
}

// ---------------------------------------------------------------------------
// Layout snapshots (edit-mode commit, moves to a free cell)
// ---------------------------------------------------------------------------

/** Action error for a layout refusal (the edit mode shows its own one-word reason per cell). */
export function refusalError(r: LayoutRefusal): ActionErrorCode {
  switch (r) {
    case 'outside':
    case 'locked':
      return 'slotLocked'
    case 'fixture':
    case 'overlap':
      return 'slotOccupied'
    case 'doorZone':
      return 'blocksDoor'
    case 'typeCap':
    case 'decorCap':
      return 'officeFull'
    default:
      return r
  }
}

const canonicalRotation = new Map<StageIndex, Map<SlotId, Rotation>>()

/** Rotation an empty canonical slot returns to (stage-independent today: rings are concentric). */
function restRotation(stage: StageIndex, id: SlotId): Rotation | undefined {
  let m = canonicalRotation.get(stage)
  if (!m) {
    m = new Map()
    for (let r = 1; r <= stageRingCount(stage); r++) for (const s of buildRingSlots(r)) m.set(s.id, s.rotation)
    canonicalRotation.set(stage, m)
  }
  return m.get(id)
}

/** Empties an item's slots (mutates); a canonical slot gets its own rotation back, free slots are dropped by the caller. */
export function liftItem(office: OfficeState, cells: readonly Slot[]): void {
  for (const s of cells) {
    delete s.itemId
    delete s.spanOf
    delete s.occupantId
    delete s.team
    if (!s.free) s.rotation = restRotation(office.stage, s.id) ?? s.rotation
  }
}

export function dropEmptyFreeSlots(office: OfficeState): void {
  office.slots = office.slots.filter((s) => !(s.free && s.itemId === undefined))
}

function addStored(storage: StoredPiece[], kind: string, n = 1): void {
  if (n <= 0) return
  const row = storage.find((x) => x.kind === kind)
  if (row) row.n += n
  else storage.push({ kind, n })
}

/** Takes one `kind` out of storage (mutates); false when there is none. */
function takeStored(storage: StoredPiece[], kind: string): boolean {
  const row = storage.find((x) => x.kind === kind && x.n > 0)
  if (!row) return false
  row.n--
  return true
}

/** Smallest unused decor id over the given piece lists: d1, d2, … */
export function nextDecorId(...lists: readonly (readonly { id: string }[] | undefined)[]): string {
  const ids = new Set(lists.flatMap((l) => (l ?? []).map((p) => p.id)))
  let n = 1
  while (ids.has(`d${n}`)) n++
  return `d${n}`
}

// ---------------------------------------------------------------------------
// Starter decor: today's fixed cosmetic stage decor (coworking corner plants and banner, the Seed office's prints,
// clock and plaque) as real pieces, free, counted in the cap, removable to storage. Placed when the stage's office
// is entered (and by the v4 → v5 migration); a piece already in storage is used before a new one is given.
// ---------------------------------------------------------------------------

export interface StarterPlan {
  floor: Omit<DecorPiece, 'id'>[]
  walls: WallPiece[]
}

export function starterPlan(office: OfficeState): StarterPlan {
  const stage = office.stage
  if (stage !== 1 && stage !== 2) return { floor: [], walls: [] }
  const open = Math.max(1, ...office.rings.filter((r) => r.unlocked).map((r) => r.index))
  // The open floor's corners: the wall row's once the outer ring is open.
  const d = open >= stageRingCount(stage) ? gridHalf(stage) : ringDistance(open)
  const h = gridHalf(stage)
  // Three plants in the corners of the open floor (the coworking corner plants), clear of the door's corner.
  const floor: StarterPlan['floor'] = [
    { kind: 'plantPot', pos: { x: -d, z: d }, rotation: 0 },
    { kind: 'plantPot', pos: { x: -d, z: -d }, rotation: 0 },
    { kind: 'plantPot', pos: { x: d, z: d }, rotation: 0 },
  ]
  const walls: WallPiece[] = [
    { wall: 'back', seg: -h, kind: 'banner' },
    { wall: 'left', seg: 1, kind: 'poster' },
  ]
  if (stage === 2) {
    const door = stageFixtures(stage).door.x
    for (const seg of [-h + 2, -h + 4, door - 2]) if (seg > -h && seg < door) walls.push({ wall: 'back', seg, kind: 'print' })
    walls.push({ wall: 'back', seg: door, kind: 'clock' })
    walls.push({ wall: 'back', seg: door < h ? door + 1 : door - 1, kind: 'plaque' })
  }
  const seen = new Set<string>()
  return { floor, walls: walls.filter((w) => (seen.has(`${w.wall}|${w.seg}`) ? false : (seen.add(`${w.wall}|${w.seg}`), true))) }
}

/**
 * Puts the stage's starter decor up (mutates): each piece from storage when there is one, else new and free. A piece
 * that does not fit (cell taken, the layout would break, the cap) waits in storage. `force` skips the whole-office
 * check (render mock offices, which are not real layouts).
 */
export function placeStarterDecor(office: OfficeState, { force = false }: { force?: boolean } = {}): void {
  const plan = starterPlan(office)
  if (!plan.floor.length && !plan.walls.length) return
  office.decor ??= []
  office.walls ??= []
  const storage = (office.storage ??= [])
  const fits = (): boolean => (force ? decorCount(office) <= decorCap(office.stage) : validateLayout(office).ok)
  for (const f of plan.floor) {
    takeStored(storage, f.kind)
    const piece: DecorPiece = { id: nextDecorId(office.decor), kind: f.kind, pos: { ...f.pos }, rotation: f.rotation }
    const covered = coveredCells(office)
    const free = decorCells(piece).every((c) => !covered.has(cellKey(c.x, c.z)) && cellOpen(office, c))
    office.decor.push(piece)
    if (free && fits()) continue
    office.decor.pop()
    addStored(storage, f.kind)
  }
  for (const w of plan.walls) {
    takeStored(storage, w.kind)
    office.walls.push({ ...w })
    if (fits()) continue
    office.walls.pop()
    addStored(storage, w.kind)
  }
  office.storage = storage.filter((x) => x.n > 0)
}

/**
 * The office with `snap` applied, or the refusal. Listed anchors move to their cell and rotation (onto the canonical
 * slot of that cell when it fits, else onto new free slots); seat and team label travel with the desk. Decor comes
 * from the placed pieces, from storage or is bought (decorBill: `cost`, charged by applyLayout); a piece left out
 * goes to storage. Validated as a whole (validateLayout).
 */
export function applySnapshot(office: OfficeState, snap: LayoutSnapshot): { office: OfficeState; cost: number } | { error: ActionErrorCode } {
  const p = previewSnapshot(office, snap)
  if ('error' in p) return p
  return p.check.ok ? { office: p.office, cost: p.cost } : { error: refusalError(p.check.reason!) }
}

/**
 * `snap` applied without the verdict, plus its validity check: the edit mode's hover and drop read the refusal and
 * its cells (applySnapshot only keeps the action error). `error` is a malformed snapshot (unknown anchor, bad cell).
 */
export function previewSnapshot(office: OfficeState, snap: LayoutSnapshot): { office: OfficeState; check: LayoutCheck; cost: number } | { error: ActionErrorCode } {
  const built = buildSnapshot(office, snap)
  return 'error' in built ? built : { office: built.office, check: validateLayout(built.office), cost: built.cost }
}

function buildSnapshot(office: OfficeState, snap: LayoutSnapshot): { office: OfficeState; cost: number } | { error: ActionErrorCode } {
  const next = clone(office)
  const pieces = new Map(itemPieces(next).map((p) => [p.anchor.id, p]))
  const moving: { cp: LayoutSnapshot['slots'][string]; itemId: string; occupantId?: string; team?: Dept; spec: PlacementSpec }[] = []
  for (const [id, cp] of Object.entries(snap.slots)) {
    const it = pieces.get(id)
    if (!it || ![0, 1, 2, 3].includes(cp.r) || !Number.isInteger(cp.x) || !Number.isInteger(cp.z)) return { error: 'invalid' }
    if (cp.x === it.anchor.pos.x && cp.z === it.anchor.pos.z && cp.r === it.rotation) {
      if (cp.team !== undefined) it.anchor.team = cp.team
      continue
    }
    const team = cp.team ?? it.anchor.team
    moving.push({ cp, itemId: it.anchor.itemId!, ...(it.anchor.occupantId !== undefined ? { occupantId: it.anchor.occupantId } : {}), ...(team !== undefined ? { team } : {}), spec: { slotType: it.anchor.type, size: it.cells.length === 2 ? 2 : 1 } })
    liftItem(next, it.cells)
  }
  dropEmptyFreeSlots(next)
  for (const m of moving) {
    const pos = { x: m.cp.x, z: m.cp.z }
    const r = rightDir(m.cp.r)
    const slotAt = (c: GridPos) => next.slots.find((s) => !s.free && s.id !== FOUNDER_SLOT_ID && s.pos.x === c.x && s.pos.z === c.z && s.type === m.spec.slotType && s.itemId === undefined && s.spanOf === undefined)
    const a = slotAt(pos)
    const b = m.spec.size === 2 ? slotAt({ x: pos.x + r.x, z: pos.z + r.z }) : undefined
    const canonical = a !== undefined && (m.spec.size === 1 || (b !== undefined && b.ring === a.ring))
    const place: Placement = canonical ? { pos, rotation: m.cp.r, slotId: a.id, ...(b ? { partnerId: b.id } : {}), bumped: [] } : { pos, rotation: m.cp.r, bumped: [] }
    const anchor = putItem(next, place, m.itemId, m.spec)
    anchor.rotation = m.cp.r
    if (b && canonical) b.rotation = m.cp.r
    if (m.occupantId !== undefined) anchor.occupantId = m.occupantId
    if (m.team !== undefined) anchor.team = m.team
  }
  const bill = decorBill(office, snap)
  if ('error' in bill) return bill
  next.decor = snap.decor.map((p) => ({ id: p.id, kind: p.kind, pos: { x: p.pos.x, z: p.pos.z }, rotation: p.rotation }))
  if (snap.walls) next.walls = snap.walls.map((w) => ({ ...w }))
  next.storage = bill.storage
  return { office: next, cost: bill.cost }
}

/** What a draft's decor costs: pieces bought per kind, paint jobs bought, the cash, and storage afterwards. */
export interface DecorBill {
  cost: number
  bought: Record<string, number>
  storage: StoredPiece[]
}

/**
 * Prices the decor and walls of `snap` against the live office. A piece kept (same id and kind, or the same wall
 * piece) is free; a new piece is taken from storage first, then bought. Pieces left out go to storage. Paint is a
 * job, not a thing: a newly painted wall uses a stored paint job (from a stage move) or costs PAINT_PRICE, and
 * painting over or clearing a wall gives nothing back. Buying a piece the stage does not sell yet is 'notUnlocked'.
 */
export function decorBill(office: OfficeState, snap: Pick<LayoutSnapshot, 'decor' | 'walls'>): DecorBill | { error: ActionErrorCode } {
  const stock = new Map<string, number>()
  for (const x of office.storage ?? []) stock.set(x.kind, (stock.get(x.kind) ?? 0) + x.n)
  const need = new Map<string, number>()
  const add = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n)
  const live = new Map((office.decor ?? []).map((p) => [p.id, p]))
  for (const p of snap.decor) {
    if (!decorDef(p.kind) || isWallKind(p.kind)) return { error: 'invalid' }
    if (live.get(p.id)?.kind === p.kind) live.delete(p.id)
    else add(need, p.kind)
  }
  for (const p of live.values()) add(stock, p.kind)
  if (snap.walls) {
    const key = (w: WallPiece) => `${w.wall}|${w.seg}|${w.kind}|${w.color ?? ''}`
    const hung = new Map((office.walls ?? []).map((w) => [key(w), w]))
    for (const w of snap.walls) {
      if (!isWallKind(w.kind) || (w.kind === PAINT_KIND && typeof w.color !== 'string')) return { error: 'invalid' }
      if (hung.delete(key(w))) continue
      add(need, w.kind)
    }
    for (const w of hung.values()) if (w.kind !== PAINT_KIND) add(stock, w.kind)
  }
  let cost = 0
  const bought: Record<string, number> = {}
  for (const [kind, n] of need) {
    const have = stock.get(kind) ?? 0
    const buy = Math.max(0, n - have)
    stock.set(kind, Math.max(0, have - n))
    if (!buy) continue
    const def = decorDef(kind)
    if (def && def.stage > office.stage) return { error: 'notUnlocked' }
    bought[kind] = buy
    cost += buy * (kind === PAINT_KIND ? PAINT_PRICE : def!.price)
  }
  const storage: StoredPiece[] = []
  for (const [kind, n] of stock) if (n > 0) storage.push({ kind, n })
  return { cost, bought, storage }
}

export type { PlacementSpec }
