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
// Geometry (mirrors render/constants gridToWorld: CELL 1.5, CENTER_GAP 0.9)
// ---------------------------------------------------------------------------

const GRID_CELL = 1.5
const GRID_GAP = 0.9
/** Cell box half size; the founder cross-aisle (GRID_GAP wide) lies between cell 0 and cells ±1. */
const CELL_HALF = GRID_CELL / 2

const axisToWorld = (v: number): number => v * GRID_CELL + Math.sign(v) * GRID_GAP

/** Inverse of gridToWorld on one axis: the cell whose centre is nearest (the cross-aisle snaps to cell 0). */
export function worldToGrid(w: number): number {
  const a = Math.abs(w)
  return a < GRID_CELL + GRID_GAP - CELL_HALF ? 0 : Math.sign(w) * Math.round((a - GRID_GAP) / GRID_CELL)
}

/** Front of a piece (its chair / access side) for a rotation: render rotateXZ(0, 1, rot). */
export function frontDir(rot: number): GridPos {
  return [{ x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }, { x: 1, z: 0 }][rot & 3]!
}

/** Right-hand axis of a rotation (render rotateXZ(1, 0, rot)): where a size-2 room puts its second cell. */
export function rightDir(rot: number): GridPos {
  return [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }][rot & 3]!
}

/** Half size of the stage's square grid (the outer ring's Chebyshev distance): 1 / 3 / 5 / 7 / 9 / 11 / 11. */
export function gridHalf(stage: StageIndex): number {
  return ringDistance(stageRingCount(stage))
}

/** Ring (zone) a cell belongs to: the founder cell is 0, a ring owns its slot row and the walkway inside it. */
export function ringOfCell(c: GridPos): number {
  const d = Math.max(Math.abs(c.x), Math.abs(c.z))
  return d === 0 ? 0 : Math.ceil((d + 1) / 2)
}

export function inGrid(stage: StageIndex, c: GridPos): boolean {
  const h = gridHalf(stage)
  return Math.abs(c.x) <= h && Math.abs(c.z) <= h
}

// ---------------------------------------------------------------------------
// Walk grid. Walking happens on an "expanded" grid: every cell, plus one node row for each side of the founder
// cross-aisle (e = ±1), which is free floor that runs the whole office. Cell v sits at e = v + sign(v).
// ---------------------------------------------------------------------------

const ex = (v: number): number => v + Math.sign(v)

interface WalkGrid {
  /** Expanded half size (gridHalf + 1). */
  h: number
  n: number
  blocked: Uint8Array
}

const nodeOf = (g: WalkGrid, x: number, z: number): number => (z + g.h) * g.n + (x + g.h)
const inWalk = (g: WalkGrid, x: number, z: number): boolean => Math.abs(x) <= g.h && Math.abs(z) <= g.h

// ---------------------------------------------------------------------------
// Fixtures: cells fixed by the stage's building, never by the player
// ---------------------------------------------------------------------------

export interface Fixtures {
  /** The door's cell (door.inside lands here): the flood fill starts on it. */
  door: GridPos
  /** No piece and no walking (stairs, the founder desk). */
  blocked: Set<CellKey>
  /** No piece, but free floor (the door cell, structural columns are a thin post). */
  noPiece: Set<CellKey>
  /** Column centres in world space, as render/layout.ts draws them (pinned by a test). */
  columns: [number, number][]
}

const fixtureCache = new Map<StageIndex, Fixtures>()

/** Cells a world box overlaps (cell boxes are their centre ± half a cell; the cross-aisle belongs to no cell). */
function cellsUnder(minX: number, maxX: number, minZ: number, maxZ: number, h: number): GridPos[] {
  const axis = (lo: number, hi: number): number[] => {
    const out: number[] = []
    for (let v = -h; v <= h; v++) {
      const c = axisToWorld(v)
      if (c + CELL_HALF > lo + 1e-6 && c - CELL_HALF < hi - 1e-6) out.push(v)
    }
    return out
  }
  const xs = axis(minX, maxX)
  const zs = axis(minZ, maxZ)
  return xs.flatMap((x) => zs.map((z) => ({ x, z })))
}

/**
 * The stage's fixed cells, from its canonical bounds only: the door on the back wall's right end, the columns of
 * stages 3–5 (computed against canonical slots, exactly as computeLayout places them), the Series B stairs and the
 * founder desk. Memoised per stage.
 */
export function stageFixtures(stage: StageIndex): Fixtures {
  const hit = fixtureCache.get(stage)
  if (hit) return hit
  const h = gridHalf(stage)
  const edge = axisToWorld(h) + GRID_CELL * 0.55 + GRID_CELL * 0.35
  const b = { minX: -edge, maxX: edge, minZ: -edge, maxZ: edge }
  const doorX = Math.max(b.minX + GRID_CELL * 0.8, b.maxX - GRID_CELL * 1.1)
  const doorInZ = b.minZ + GRID_CELL * 0.6
  const door = { x: worldToGrid(doorX), z: worldToGrid(doorInZ) }
  const blocked = new Set<CellKey>([cellKey(0, 0)])
  const noPiece = new Set<CellKey>([cellKey(door.x, door.z)])
  const columns: [number, number][] = []
  if (stage >= 3 && stage <= 5) {
    const slotPts: [number, number][] = [[0, 0]]
    for (let r = 1; r <= stageRingCount(stage); r++) for (const s of buildRingSlots(r)) slotPts.push([axisToWorld(s.pos.x), axisToWorld(s.pos.z)])
    const step = GRID_CELL * 3
    for (let x = b.minX + step; x < b.maxX - GRID_CELL; x += step) {
      for (let z = b.minZ + step; z < b.maxZ - GRID_CELL; z += step) {
        const c: [number, number] = [x + GRID_CELL * 0.5, z + GRID_CELL * 0.5]
        if (Math.hypot(c[0], c[1]) <= GRID_CELL * 1.5) continue
        if (slotPts.some((p) => Math.max(Math.abs(p[0] - c[0]), Math.abs(p[1] - c[1])) < GRID_CELL * 0.75)) continue
        if (Math.abs(c[0] - doorX) < GRID_CELL * 0.7 && c[1] < doorInZ + GRID_CELL) continue
        columns.push(c)
        for (const cell of cellsUnder(c[0] - 0.11, c[0] + 0.11, c[1] - 0.11, c[1] + 0.11, h)) noPiece.add(cellKey(cell.x, cell.z))
      }
    }
  }
  // Series B stairs along the back-left corner (render/layout.ts obstacle box).
  if (stage === 4) for (const cell of cellsUnder(b.minX, b.minX + 0.95, b.minZ, b.minZ + 4.6, h)) blocked.add(cellKey(cell.x, cell.z))
  const fx: Fixtures = { door, blocked, noPiece, columns }
  fixtureCache.set(stage, fx)
  return fx
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

export type LayoutRefusal = 'outside' | 'locked' | 'fixture' | 'overlap' | 'typeCap' | 'decorCap' | 'blocksDoor' | 'sealsDesk'

export interface LayoutCheck {
  ok: boolean
  /** Offending cells ("x,z"). */
  bad: CellKey[]
  reason?: LayoutRefusal
}

function walkGrid(office: OfficeState, fx: Fixtures, items: readonly ItemPiece[]): WalkGrid {
  const h = gridHalf(office.stage) + 1
  const n = h * 2 + 1
  const g: WalkGrid = { h, n, blocked: new Uint8Array(n * n) }
  const block = (c: GridPos) => {
    const x = ex(c.x)
    const z = ex(c.z)
    if (inWalk(g, x, z)) g.blocked[nodeOf(g, x, z)] = 1
  }
  for (const k of fx.blocked) {
    const [x, z] = k.split(',').map(Number) as [number, number]
    block({ x, z })
  }
  for (const it of items) {
    for (const c of it.cells) block(c.pos)
    // A room straddling the cross-aisle closes the aisle node between its two cells.
    for (let i = 1; i < it.cells.length; i++) {
      const a = it.cells[i - 1]!.pos
      const b = it.cells[i]!.pos
      const mx = (ex(a.x) + ex(b.x)) / 2
      const mz = (ex(a.z) + ex(b.z)) / 2
      if (Number.isInteger(mx) && Number.isInteger(mz) && inWalk(g, mx, mz)) g.blocked[nodeOf(g, mx, mz)] = 1
    }
  }
  for (const p of office.decor ?? []) if (decorShape(p.kind).blocking) for (const c of decorCells(p)) block(c)
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
    const x = (cur % g.n) - g.h
    const z = Math.floor(cur / g.n) - g.h
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const nz = z + dz
      if (!inWalk(g, nx, nz)) continue
      const k = nodeOf(g, nx, nz)
      if (seen[k] || g.blocked[k]) continue
      seen[k] = 1
      queue.push(k)
    }
  }
  return seen
}

/** Walk node in front of a cell: one step on the expanded grid (a ring-1 desk's front is the cross-aisle). */
function frontNode(g: WalkGrid, c: GridPos, rot: number): number | null {
  const f = frontDir(rot)
  const x = ex(c.x) + f.x
  const z = ex(c.z) + f.z
  return inWalk(g, x, z) ? nodeOf(g, x, z) : null
}

/**
 * Is this office layout legal? Run on every hover and every commit (≤ 529 cells, one fill ≈ 0.05 ms):
 * 1. every piece cell is in the grid, in an open ring, off the fixtures and not on another blocking piece;
 * 2. the type caps and the decor cap hold;
 * 3. a flood fill from the door reaches the front of every item and of the founder desk (two facing desks may share
 *    one aisle cell). `blocksDoor` when the door has no free floor around it, `sealsDesk` when a front is cut off.
 */
export function validateLayout(office: OfficeState): LayoutCheck {
  const stage = office.stage
  const fx = stageFixtures(stage)
  const items = itemPieces(office)
  const seen = new Map<CellKey, 'item' | 'rug'>()
  const fail = (reason: LayoutRefusal, cells: GridPos[]): LayoutCheck => ({ ok: false, reason, bad: cells.map((c) => cellKey(c.x, c.z)) })
  const cellError = (c: GridPos): LayoutRefusal | null => {
    if (!inGrid(stage, c)) return 'outside'
    if (!isRingUnlocked(office, ringOfCell(c))) return 'locked'
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
  const reach = flood(g, nodeOf(g, ex(fx.door.x), ex(fx.door.z)))
  const doorWayIn = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => {
    const x = ex(fx.door.x) + dx!
    const z = ex(fx.door.z) + dz!
    return inWalk(g, x, z) && reach[nodeOf(g, x, z)] === 1
  })
  if (!doorWayIn) return fail('blocksDoor', [fx.door])
  const sealed: GridPos[] = []
  const founder = office.slots.find((s) => s.id === FOUNDER_SLOT_ID)
  const fronts: { cell: GridPos; rot: number }[] = founder ? [{ cell: founder.pos, rot: founder.rotation }] : []
  for (const it of items) for (const s of it.cells) fronts.push({ cell: s.pos, rot: it.rotation })
  for (const f of fronts) {
    const k = frontNode(g, f.cell, f.rot)
    if (k === null || !reach[k]) sealed.push(f.cell)
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
  const anchor: Slot = { id: nextFreeSlotId(office), ring: ringOfCell(p.pos), type: spec.slotType, pos: { ...p.pos }, rotation: p.rotation, itemId, free: true }
  office.slots.push(anchor)
  if (spec.size === 2) {
    const r = rightDir(p.rotation)
    const pos = { x: p.pos.x + r.x, z: p.pos.z + r.z }
    office.slots.push({ id: nextFreeSlotId(office), ring: ringOfCell(pos), type: spec.slotType, pos, rotation: p.rotation, itemId, spanOf: anchor.id, free: true })
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
  const sx = ex(Math.round(from.x))
  const sz = ex(Math.round(from.z))
  if (!inWalk(g, sx, sz)) return d
  const start = nodeOf(g, sx, sz)
  d[start] = 0
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!
    const x = (cur % g.n) - g.h
    const z = Math.floor(cur / g.n) - g.h
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const nz = z + dz
      if (!inWalk(g, nx, nz)) continue
      const k = nodeOf(g, nx, nz)
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
    return inGrid(stage, c) && isRingUnlocked(office, ringOfCell(c)) && !fx.blocked.has(k) && !fx.noPiece.has(k) && !covered.has(k) && !opts.avoid?.has(k)
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
        const d = dist[nodeOf(g, ex(x), ex(z))]!
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
  for (const o of old.slots) if (o.free) next.slots.push({ ...o, pos: { ...o.pos }, ring: ringOfCell(o.pos) })
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
  repairFixtures(next)
  placeStarterDecor(next)
}

/** Re-places items and separators that sit on a fixture cell (mutates). Separators that find no cell go to storage. */
function repairFixtures(office: OfficeState): void {
  const fx = stageFixtures(office.stage)
  const onFixture = (c: GridPos) => fx.blocked.has(cellKey(c.x, c.z)) || fx.noPiece.has(cellKey(c.x, c.z))
  const clash = (office.decor ?? []).filter((p) => decorCells(p).some(onFixture)).map((p) => p.id)
  storeDecor(office, clash)
  // Lift every clashing piece first: one still on a fixture would make every trial cell of the others invalid.
  const lifted = itemPieces(office)
    .filter((it) => it.cells.some((s) => onFixture(s.pos)))
    .map((it) => {
      const spec: PlacementSpec = { slotType: it.anchor.type, size: it.cells.length === 2 ? 2 : 1 }
      const keep = { itemId: it.anchor.itemId!, occupantId: it.anchor.occupantId, team: it.anchor.team }
      for (const s of it.cells) {
        delete s.itemId
        delete s.spanOf
        delete s.occupantId
        delete s.team
      }
      return { spec, keep }
    })
  office.slots = office.slots.filter((s) => !(s.free && s.itemId === undefined))
  for (const { spec, keep } of lifted) {
    const place = autoPlace(office, spec, { team: keep.team, ignoreCap: true })
    if (!place) continue
    storeDecor(office, place.bumped)
    const anchor = putItem(office, place, keep.itemId, spec)
    if (keep.occupantId !== undefined) anchor.occupantId = keep.occupantId
    if (keep.team !== undefined) anchor.team = keep.team
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
  const d = ringDistance(open)
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
    const free = decorCells(piece).every((c) => !covered.has(cellKey(c.x, c.z)) && isRingUnlocked(office, ringOfCell(c)))
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
