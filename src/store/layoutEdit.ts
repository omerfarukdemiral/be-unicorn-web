// Office edit mode (grid design §4), pure: the draft, the pieces as the player sees them in it, and the ops.
// The draft is a LayoutSnapshot over the live office (anchor slot id → cell + rotation + team label), so "Bitti" is one
// applyLayout action. Every op keeps the draft legal: a move, turn or label that validateLayout refuses never lands,
// it comes back as red cells and a short reason. Decor (grid step 4): floor pieces and wall pieces are placed,
// moved, turned and taken out (to storage) in the same draft; new ones are priced against storage (decorBill) and
// paid on Bitti. The spend is shown live and a piece the cash cannot cover is refused when it is added.
import { PAINT_KIND, decorDef } from '../content/decor'
import { FURNITURE } from '../content/furniture'
import { buyCost, cellKey, decorBill, decorCells, decorShape, isWallKind, itemPieces, nextDecorId, previewSnapshot, rightDir, ringOfCell, type CellKey, type LayoutRefusal, type Rotation } from '../engine/layout'
import { teamIslands, type TeamCluster } from '../engine/office'
import { FOUNDER_SLOT_ID, type SavedLayout, type DecorPiece, type Dept, type GridPos, type LayoutSnapshot, type NewItem, type OfficeState, type Slot, type SlotId, type SlotType, type WallPiece } from '../engine/types'

/** Undo depth (one snapshot is well under 10 KB). */
export const UNDO_MAX = 100

/** Why a change was refused: a layout rule, the fixed founder desk, cash, a malformed draft, a plan that found no fit, or Delete on an item the company owns (sold in the shop). */
export type EditRefusal = LayoutRefusal | 'founder' | 'invalid' | 'cash' | 'plan' | 'sell'

/** A wall segment: which wall and which cell column / row along it. */
export interface WallSeg {
  wall: WallPiece['wall']
  seg: number
}

/** What a click puts down: a catalogue or stored piece (floor or wall), a paint colour, or a furniture item to buy (`item`). */
export interface Armed {
  kind: string
  color?: string
  /** `kind` is a furniture item id (bought on Bitti). */
  item?: boolean
}

/**
 * A placed piece picked up (grid v2 carry): it follows the pointer as its own model until a click puts it down, R turns
 * it, Esc puts it back where it was. Items by their draft piece id (a live anchor id or "+key" for a bought one).
 */
export type Carry = { what: 'item'; id: SlotId; r: Rotation } | { what: 'decor'; id: string; r: Rotation } | { what: 'wall'; at: WallSeg }

/** Draft piece id of an item bought in the draft. */
export const newPieceId = (key: string): SlotId => `+${key}`
const newKeyOf = (id: SlotId): string | null => (id.startsWith('+') ? id.slice(1) : null)

export interface LayoutEdit {
  draft: LayoutSnapshot
  undo: LayoutSnapshot[]
  redo: LayoutSnapshot[]
  /** Anchor slot id (of the live office) of the selected piece. */
  selected: SlotId | null
  /** Last refused change: its red cells and the reason; `at` = performance.now(). */
  refused: { cells: CellKey[]; reason: EditRefusal; at: number } | null
  /** Esc with nothing selected and changes made: the next Esc drops them (a line in the panel, no popup). */
  armedCancel: boolean
  /** Selected floor decor piece (draft id). Only one of selected / decorSel / wallSel is set. */
  decorSel?: string | null
  /** Selected wall piece. */
  wallSel?: WallSeg | null
  /** The piece a click puts down (stays armed for the next click until Esc or another card). */
  armed?: Armed | null
  /** Turn of the armed floor piece. */
  armedRot?: Rotation
  /** The saved layout applied last and the undo depth it was applied at: its missing pieces show until undone. */
  fromSaved?: { layout: SavedLayout; depth: number } | null
  /** Panel tab to open on (the storage chip opens Depo). */
  tab?: string
  /** The piece picked up and carried (null: nothing in hand). */
  carry?: Carry | null
}

/** A functional piece where the draft puts it. */
export interface DraftPiece {
  id: SlotId
  itemId: string
  type: SlotType
  size: 1 | 2
  x: number
  z: number
  r: Rotation
  team?: Dept
  occupantId?: string
  /** Cells it covers, anchor first. */
  cells: GridPos[]
  /** Off its live cell or turned. */
  moved: boolean
  /** Bought in this draft (id "+key"): Delete drops it, nothing to sell. */
  isNew?: boolean
}

export type LayoutOp =
  | { kind: 'select'; id: SlotId | null }
  | { kind: 'place'; id: SlotId; x: number; z: number; r?: Rotation }
  | { kind: 'rotate'; id?: SlotId }
  | { kind: 'team'; team: Dept; id?: SlotId }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'armCancel'; on: boolean }
  | { kind: 'selectDecor'; id: string | null }
  | { kind: 'selectWall'; at: WallSeg | null }
  | { kind: 'arm'; armed: Armed | null }
  | { kind: 'addDecor'; x: number; z: number }
  | { kind: 'moveDecor'; id: string; x: number; z: number; r?: Rotation }
  | { kind: 'hang'; at: WallSeg }
  | { kind: 'moveWall'; from: WallSeg; to: WallSeg }
  | { kind: 'remove'; target?: Carry }
  /** Pick a placed piece up (carry), put it back (drop), buy-and-place the armed furniture item. */
  | { kind: 'pick'; carry: Carry }
  | { kind: 'drop' }
  | { kind: 'armRot'; r: Rotation }
  | { kind: 'addItem'; x: number; z: number }
  /** A whole-office plan (preset, Otomatik düzenle, a saved layout) as one undoable step; null = it found no fit. */
  | { kind: 'plan'; draft: LayoutSnapshot | null; saved?: SavedLayout }

export function startEdit(office: OfficeState, tab?: string): LayoutEdit {
  return {
    ...(tab ? { tab } : {}),
    draft: { slots: {}, decor: (office.decor ?? []).map((p) => ({ ...p, pos: { ...p.pos } })), walls: (office.walls ?? []).map((w) => ({ ...w })) },
    undo: [],
    redo: [],
    selected: null,
    refused: null,
    armedCancel: false,
    decorSel: null,
    wallSel: null,
    armed: null,
    armedRot: 0,
    carry: null,
  }
}

/** Decor and wall pieces waiting in storage (paint jobs are not pieces): the storage chip's count. */
export function storedPieces(office: OfficeState): number {
  return (office.storage ?? []).reduce((n, x) => n + (x.kind !== PAINT_KIND && decorDef(x.kind) ? x.n : 0), 0)
}

/** Cash the draft spends on Bitti (new pieces not covered by storage, paint jobs, items bought in the draft). */
export function draftSpend(office: OfficeState, draft: LayoutSnapshot): number {
  const b = decorBill(office, draft)
  return ('error' in b ? 0 : b.cost) + buyCost(draft)
}

/** The floor piece on a cell: a blocking piece before a rug under it. */
export function decorAt(draft: LayoutSnapshot, c: GridPos): string | null {
  const on = draft.decor.filter((p) => decorCells(p).some((q) => q.x === c.x && q.z === c.z))
  return (on.find((p) => decorShape(p.kind).blocking) ?? on[0])?.id ?? null
}

/** The wall piece (not paint) hung on a segment. */
export function wallAt(draft: LayoutSnapshot, at: WallSeg): WallPiece | undefined {
  return (draft.walls ?? []).find((w) => w.kind !== PAINT_KIND && w.wall === at.wall && w.seg === at.seg)
}

const sameSeg = (a: WallSeg | null | undefined, b: WallSeg | null | undefined): boolean => !!a && !!b && a.wall === b.wall && a.seg === b.seg

export type DecorCheck = { ok: true; draft: LayoutSnapshot; cells: GridPos[] } | { ok: false; cells: GridPos[]; bad: CellKey[]; reason: EditRefusal }

/**
 * Would the draft with `decor` / `walls` swapped in be legal and affordable? Same engine preview as a desk move
 * (validateLayout), plus the bill: a change that raises the spend past `cash` is refused ('cash').
 */
export function checkDecor(office: OfficeState, e: Pick<LayoutEdit, 'draft'>, next: Partial<Pick<LayoutSnapshot, 'decor' | 'walls'>>, cells: GridPos[], cash = Infinity): DecorCheck {
  const draft: LayoutSnapshot = { ...e.draft, ...next }
  const res = previewSnapshot(office, draft)
  if ('error' in res) return { ok: false, cells, bad: [], reason: 'invalid' }
  if (!res.check.ok) return { ok: false, cells, bad: res.check.bad, reason: res.check.reason! }
  const spend = res.cost + buyCost(draft)
  if (spend > cash && spend > draftSpend(office, e.draft)) return { ok: false, cells, bad: [], reason: 'cash' }
  return { ok: true, draft, cells }
}

/** A floor piece of `kind` at (x, z) turned `r`, replacing piece `id` (a move) or new (`id` null). */
export function checkFloor(office: OfficeState, e: Pick<LayoutEdit, 'draft'>, id: string | null, kind: string, x: number, z: number, r: Rotation, cash = Infinity): DecorCheck & { id: string } {
  const pid = id ?? nextDecorId(office.decor, e.draft.decor)
  const piece: DecorPiece = { id: pid, kind, pos: { x, z }, rotation: r }
  const decor = id ? e.draft.decor.map((p) => (p.id === id ? piece : p)) : [...e.draft.decor, piece]
  return { ...checkDecor(office, e, { decor }, decorCells(piece), cash), id: pid }
}

/** Walls of the draft with `kind` hung on `at` (paint replaces the wall's paint; a piece needs a bare segment). */
function hungWalls(draft: LayoutSnapshot, at: WallSeg, armed: Armed): WallPiece[] {
  const walls = draft.walls ?? []
  if (armed.kind === PAINT_KIND) return [...walls.filter((w) => !(w.kind === PAINT_KIND && w.wall === at.wall)), { wall: at.wall, seg: 0, kind: PAINT_KIND, color: armed.color ?? '#ffffff' }]
  return [...walls, { wall: at.wall, seg: at.seg, kind: armed.kind }]
}

export function checkWall(office: OfficeState, e: Pick<LayoutEdit, 'draft'>, at: WallSeg, armed: Armed, cash = Infinity): DecorCheck {
  if (armed.kind !== PAINT_KIND && wallAt(e.draft, at)) return { ok: false, cells: [], bad: [], reason: 'overlap' }
  return checkDecor(office, e, { walls: hungWalls(e.draft, at, armed) }, [], cash)
}

/** Nothing selected, nothing armed (Esc order: armed piece, selection, then the cancel). */
export function hasSelection(e: LayoutEdit): boolean {
  return !!(e.selected || e.decorSel || e.wallSel)
}

const NO_SEL = { selected: null, decorSel: null, wallSel: null } as const

/** Something to keep or drop (the undo stack is the change list: back to the start = nothing to save). */
export function isDirty(e: LayoutEdit): boolean {
  return e.undo.length > 0
}

/** Cells of a piece of `size` at `pos` turned `r`: a room's second cell is on its right. */
export function footprint(pos: GridPos, r: Rotation, size: 1 | 2): GridPos[] {
  if (size === 1) return [{ x: pos.x, z: pos.z }]
  const d = rightDir(r)
  return [{ x: pos.x, z: pos.z }, { x: pos.x + d.x, z: pos.z + d.z }]
}

/** Every movable piece (the founder desk is fixed) where the draft puts it, the items bought in the draft last. */
export function draftPieces(office: OfficeState, draft: LayoutSnapshot): DraftPiece[] {
  return [...livePieces(office, draft), ...(draft.buy ?? []).flatMap((n) => newPiece(n))]
}

/** A furniture item bought in the draft, as a piece. */
function newPiece(n: NewItem): DraftPiece[] {
  const item = FURNITURE.find((f) => f.id === n.itemId)
  if (!item) return []
  const size: 1 | 2 = item.size === 2 ? 2 : 1
  return [{ id: newPieceId(n.key), itemId: n.itemId, type: item.slotType, size, x: n.x, z: n.z, r: n.r, ...(n.team !== undefined ? { team: n.team } : {}), cells: footprint({ x: n.x, z: n.z }, n.r, size), moved: true, isNew: true }]
}

function livePieces(office: OfficeState, draft: LayoutSnapshot): DraftPiece[] {
  return itemPieces(office).map((p) => {
    const a = p.anchor
    const cp = draft.slots[a.id]
    const size: 1 | 2 = p.cells.length === 2 ? 2 : 1
    const moved = !!cp && (cp.x !== a.pos.x || cp.z !== a.pos.z || cp.r !== a.rotation)
    const team = cp?.team ?? a.team
    return {
      id: a.id,
      itemId: a.itemId!,
      type: a.type,
      size,
      x: moved ? cp.x : a.pos.x,
      z: moved ? cp.z : a.pos.z,
      r: moved ? cp.r : p.rotation,
      ...(team !== undefined ? { team } : {}),
      ...(a.occupantId !== undefined ? { occupantId: a.occupantId } : {}),
      cells: moved ? footprint({ x: cp.x, z: cp.z }, cp.r, size) : p.cells.map((s) => ({ x: s.pos.x, z: s.pos.z })),
      moved,
    }
  })
}

/** Team islands (grid §5) of the draft as it stands: the panel's island rows and the scene's brighter tint. */
export function draftIslands(office: OfficeState, draft: LayoutSnapshot, deptOf: (id: string) => Dept | undefined): TeamCluster[] {
  const desks = draftPieces(office, draft)
    .filter((p) => p.type === 'desk' && p.id !== FOUNDER_SLOT_ID)
    .map((p) => ({ id: p.id, pos: { x: p.x, z: p.z }, ...(p.team !== undefined ? { team: p.team } : {}), ...(p.occupantId !== undefined ? { occupantId: p.occupantId } : {}) }))
  return teamIslands(desks, deptOf)
}

/** The piece on a cell, 'founder' on the founder desk, null on bare floor. */
export function pieceAt(pieces: readonly DraftPiece[], c: GridPos): SlotId | null {
  if (c.x === 0 && c.z === 0) return FOUNDER_SLOT_ID
  return pieces.find((p) => p.cells.some((q) => q.x === c.x && q.z === c.z))?.id ?? null
}

export type PlaceCheck = { ok: true; draft: LayoutSnapshot; cells: GridPos[] } | { ok: false; cells: GridPos[]; bad: CellKey[]; reason: EditRefusal }

/**
 * Would `id` at (x, z) turned `r` be legal? The engine's own preview of the whole office decides (validateLayout:
 * door, a sealed desk, caps, overlap…). Run on a hovered cell change and on every drop, never per pixel.
 */
export function checkPlace(office: OfficeState, draft: LayoutSnapshot, id: SlotId, x: number, z: number, r: Rotation): PlaceCheck {
  const piece = draftPieces(office, draft).find((p) => p.id === id)
  const cells = footprint({ x, z }, r, piece?.size ?? 1)
  if (!piece) return { ok: false, cells, bad: [], reason: id === FOUNDER_SLOT_ID ? 'founder' : 'invalid' }
  const key = newKeyOf(id)
  const prev = draft.slots[id]
  const next: LayoutSnapshot =
    key !== null
      ? { ...draft, buy: (draft.buy ?? []).map((n) => (n.key === key ? { ...n, x, z, r } : n)) }
      : { ...draft, slots: { ...draft.slots, [id]: { x, z, r, ...(prev?.team !== undefined ? { team: prev.team } : {}) } } }
  const res = previewSnapshot(office, next)
  if ('error' in res) return { ok: false, cells, bad: [], reason: 'invalid' }
  if (!res.check.ok) return { ok: false, cells, bad: res.check.bad, reason: res.check.reason! }
  return { ok: true, draft: next, cells }
}

/** Smallest unused key for an item bought in the draft: n1, n2, … */
function nextNewKey(draft: LayoutSnapshot): string {
  const keys = new Set((draft.buy ?? []).map((n) => n.key))
  let n = 1
  while (keys.has(`n${n}`)) n++
  return `n${n}`
}

/** The dept a desk item works for (its deptBonus): a bought desk starts with that team label. */
function deskDept(item: (typeof FURNITURE)[number]): Dept | undefined {
  const bonus = item.slotType === 'desk' ? item.effects.deptBonus : undefined
  return bonus ? (Object.keys(bonus) as Dept[]).find((d) => (bonus[d] ?? 0) > 0) : undefined
}

/**
 * Would a new `itemId` bought at (x, z) turned `r` be legal and affordable? The draft it would make, or the refusal
 * (the ghost tints red on it; a click refuses with the reason).
 */
export function checkNewItem(office: OfficeState, e: Pick<LayoutEdit, 'draft'>, itemId: string, x: number, z: number, r: Rotation, cash = Infinity): PlaceCheck {
  const item = FURNITURE.find((f) => f.id === itemId)
  const cells = footprint({ x, z }, r, item?.size === 2 ? 2 : 1)
  if (!item) return { ok: false, cells, bad: [], reason: 'invalid' }
  const team = deskDept(item)
  const draft: LayoutSnapshot = { ...e.draft, buy: [...(e.draft.buy ?? []), { key: nextNewKey(e.draft), itemId: item.id, x, z, r, ...(team !== undefined ? { team } : {}) }] }
  const res = previewSnapshot(office, draft)
  if ('error' in res) return { ok: false, cells, bad: [], reason: 'invalid' }
  if (!res.check.ok) return { ok: false, cells, bad: res.check.bad, reason: res.check.reason! }
  const spend = draftSpend(office, draft)
  if (spend > cash && spend > draftSpend(office, e.draft)) return { ok: false, cells, bad: [], reason: 'cash' }
  return { ok: true, draft, cells }
}

function push(e: LayoutEdit, draft: LayoutSnapshot, selected: SlotId | null, sel: Partial<Pick<LayoutEdit, 'decorSel' | 'wallSel'>> = {}): LayoutEdit {
  const undo = [...e.undo, e.draft]
  if (undo.length > UNDO_MAX) undo.shift()
  return { ...e, draft, undo, redo: [], selected, decorSel: null, wallSel: null, ...sel, refused: null, armedCancel: false, carry: null }
}

function refuse(e: LayoutEdit, cells: readonly GridPos[], bad: readonly CellKey[], reason: EditRefusal, now: number): LayoutEdit {
  const keys = [...new Set([...cells.map((c) => cellKey(c.x, c.z)), ...bad])]
  return { ...e, refused: { cells: keys, reason, at: now }, armedCancel: false }
}

/**
 * One op on the edit state. Returns the same object when nothing changes. `now` stamps a refusal; `cash` is the live
 * company cash (a new piece the draft cannot pay for is refused when it is put down).
 */
export function reduceLayoutEdit(office: OfficeState, e: LayoutEdit, op: LayoutOp, now = 0, cash = Infinity): LayoutEdit {
  switch (op.kind) {
    case 'select': {
      if (op.id === FOUNDER_SLOT_ID) return refuse({ ...e, ...NO_SEL, carry: null }, [{ x: 0, z: 0 }], [], 'founder', now)
      if (op.id !== null && !draftPieces(office, e.draft).some((p) => p.id === op.id)) return e
      return e.selected === op.id && !e.decorSel && !e.wallSel && !e.refused && !e.armedCancel && !e.carry ? e : { ...e, ...NO_SEL, selected: op.id, refused: null, armedCancel: false, carry: null }
    }
    case 'pick': {
      const c = op.carry
      const base = { ...e, ...NO_SEL, armed: null, refused: null, armedCancel: false }
      if (c.what === 'item') {
        if (c.id === FOUNDER_SLOT_ID) return refuse({ ...e, ...NO_SEL, carry: null }, [{ x: 0, z: 0 }], [], 'founder', now)
        const piece = draftPieces(office, e.draft).find((p) => p.id === c.id)
        return piece ? { ...base, selected: piece.id, carry: { what: 'item', id: piece.id, r: piece.r } } : e
      }
      if (c.what === 'decor') {
        const p = e.draft.decor.find((x) => x.id === c.id)
        return p ? { ...base, decorSel: p.id, carry: { what: 'decor', id: p.id, r: p.rotation } } : e
      }
      return wallAt(e.draft, c.at) ? { ...base, wallSel: c.at, carry: { what: 'wall', at: c.at } } : e
    }
    case 'armRot':
      return e.armedRot === op.r ? e : { ...e, armedRot: op.r }
    case 'drop':
      return e.carry || hasSelection(e) ? { ...e, ...NO_SEL, carry: null, refused: null } : e
    case 'addItem': {
      const a = e.armed
      if (!a?.item) return e
      const c = checkNewItem(office, e, a.kind, op.x, op.z, e.armedRot ?? 0, cash)
      if (!c.ok) return refuse(e, c.cells, c.bad, c.reason, now)
      return push(e, c.draft, null)
    }
    case 'selectDecor': {
      if (op.id !== null && !e.draft.decor.some((p) => p.id === op.id)) return e
      return e.decorSel === op.id && !e.selected && !e.wallSel && !e.refused ? e : { ...e, ...NO_SEL, decorSel: op.id, armed: null, refused: null, armedCancel: false }
    }
    case 'selectWall': {
      if (op.at && !wallAt(e.draft, op.at)) return e
      return { ...e, ...NO_SEL, wallSel: op.at, armed: null, refused: null, armedCancel: false }
    }
    case 'arm': {
      const ok = !op.armed || (op.armed.item ? FURNITURE.some((f) => f.id === op.armed!.kind) : op.armed.kind === PAINT_KIND || !!decorDef(op.armed.kind))
      if (!ok) return e
      return { ...e, ...NO_SEL, armed: op.armed, armedRot: e.armedRot ?? 0, refused: null, armedCancel: false, carry: null }
    }
    case 'addDecor': {
      const a = e.armed
      if (!a || isWallKind(a.kind)) return e
      const c = checkFloor(office, e, null, a.kind, op.x, op.z, e.armedRot ?? 0, cash)
      if (!c.ok) return refuse(e, c.cells, c.bad, c.reason, now)
      return push(e, c.draft, null)
    }
    case 'moveDecor': {
      const p = e.draft.decor.find((x) => x.id === op.id)
      if (!p) return e
      const r = op.r ?? p.rotation
      if (p.pos.x === op.x && p.pos.z === op.z && r === p.rotation) return { ...e, ...NO_SEL, decorSel: p.id, refused: null, carry: null }
      const c = checkFloor(office, e, p.id, p.kind, op.x, op.z, r, cash)
      if (!c.ok) return refuse({ ...e, ...NO_SEL, decorSel: p.id }, c.cells, c.bad, c.reason, now)
      return push(e, c.draft, null, { decorSel: p.id })
    }
    case 'hang': {
      const a = e.armed
      if (!a || !isWallKind(a.kind)) return e
      const c = checkWall(office, e, op.at, a, cash)
      if (!c.ok) return refuse(e, [], [], c.reason, now)
      return push(e, c.draft, null)
    }
    case 'moveWall': {
      const w = wallAt(e.draft, op.from)
      if (!w || sameSeg(op.from, op.to)) return e
      if (wallAt(e.draft, op.to)) return refuse(e, [], [], 'overlap', now)
      const walls = (e.draft.walls ?? []).map((x) => (x === w ? { ...x, wall: op.to.wall, seg: op.to.seg } : x))
      const c = checkDecor(office, e, { walls }, [], cash)
      if (!c.ok) return refuse(e, [], [], c.reason, now)
      return push(e, c.draft, null, { wallSel: op.to })
    }
    case 'remove': {
      // Del: the carried or hovered (else the selected) floor or wall piece goes to storage on Bitti (free to put back);
      // an item bought in this draft is simply not bought. Items the company owns stay (sell them in the shop).
      const t: Carry | null = op.target ?? e.carry ?? (e.decorSel ? { what: 'decor', id: e.decorSel, r: 0 } : e.wallSel ? { what: 'wall', at: e.wallSel } : null)
      if (!t) return e
      if (t.what === 'decor') return e.draft.decor.some((p) => p.id === t.id) ? push(e, { ...e.draft, decor: e.draft.decor.filter((p) => p.id !== t.id) }, null) : e
      if (t.what === 'wall') {
        const w = wallAt(e.draft, t.at)
        return w ? push(e, { ...e.draft, walls: (e.draft.walls ?? []).filter((x) => x !== w) }, null) : e
      }
      const key = newKeyOf(t.id)
      if (key !== null) return push(e, { ...e.draft, buy: (e.draft.buy ?? []).filter((n) => n.key !== key) }, null)
      const piece = draftPieces(office, e.draft).find((p) => p.id === t.id)
      return piece ? refuse(e, piece.cells, [], 'sell', now) : e
    }
    case 'place':
    case 'rotate': {
      // A carried piece turns in the hand; the ghost shows whether it fits (a click checks it).
      if (op.kind === 'rotate' && !op.id && e.carry && e.carry.what !== 'wall') return { ...e, carry: { ...e.carry, r: ((e.carry.r + 1) & 3) as Rotation }, refused: null }
      if (op.kind === 'rotate' && !op.id && !e.selected) {
        // R turns the armed piece, else the selected floor piece.
        if (e.armed && (e.armed.item || !isWallKind(e.armed.kind))) return { ...e, armedRot: (((e.armedRot ?? 0) + 1) & 3) as Rotation }
        const p = e.decorSel ? e.draft.decor.find((x) => x.id === e.decorSel) : undefined
        if (!p) return e
        const c = checkFloor(office, e, p.id, p.kind, p.pos.x, p.pos.z, ((p.rotation + 1) & 3) as Rotation, cash)
        if (!c.ok) return refuse(e, c.cells, c.bad, c.reason, now)
        return push(e, c.draft, null, { decorSel: p.id })
      }
      const id = op.kind === 'place' ? op.id : (op.id ?? e.selected)
      if (id === null) return e
      if (id === FOUNDER_SLOT_ID) return refuse(e, [{ x: 0, z: 0 }], [], 'founder', now)
      const piece = draftPieces(office, e.draft).find((p) => p.id === id)
      if (!piece) return e
      const x = op.kind === 'place' ? op.x : piece.x
      const z = op.kind === 'place' ? op.z : piece.z
      const r: Rotation = op.kind === 'place' ? (op.r ?? piece.r) : (((piece.r + 1) & 3) as Rotation)
      if (x === piece.x && z === piece.z && r === piece.r) return e.selected === id ? e : { ...e, ...NO_SEL, selected: id, refused: null }
      const c = checkPlace(office, e.draft, id, x, z, r)
      if (!c.ok) return refuse({ ...e, ...NO_SEL, selected: id }, c.cells, c.bad, c.reason, now)
      return push(e, c.draft, id)
    }
    case 'team': {
      const id = op.id ?? e.selected
      const piece = id ? draftPieces(office, e.draft).find((p) => p.id === id) : undefined
      if (!piece || piece.type !== 'desk' || piece.team === op.team) return e
      const key = newKeyOf(piece.id)
      if (key !== null) return { ...push(e, { ...e.draft, buy: (e.draft.buy ?? []).map((n) => (n.key === key ? { ...n, team: op.team } : n)) }, piece.id), carry: e.carry }
      const prev = e.draft.slots[piece.id]
      const cp = prev ? { ...prev, team: op.team } : { x: piece.x, z: piece.z, r: piece.r, team: op.team }
      return { ...push(e, { ...e.draft, slots: { ...e.draft.slots, [piece.id]: cp } }, piece.id), carry: e.carry }
    }
    case 'plan': {
      if (!op.draft) return refuse({ ...e, ...NO_SEL }, [], [], 'plan', now)
      const same = JSON.stringify(op.draft) === JSON.stringify(e.draft)
      const next = same ? { ...e, ...NO_SEL, refused: null, armedCancel: false } : push(e, op.draft, null)
      return { ...next, armed: null, fromSaved: op.saved ? { layout: op.saved, depth: next.undo.length } : null }
    }
    case 'undo': {
      const draft = e.undo[e.undo.length - 1]
      if (!draft) return e
      const fromSaved = e.fromSaved && e.undo.length - 1 >= e.fromSaved.depth ? e.fromSaved : null
      return { ...e, draft, undo: e.undo.slice(0, -1), redo: [...e.redo, e.draft], decorSel: null, wallSel: null, refused: null, armedCancel: false, fromSaved, carry: null }
    }
    case 'redo': {
      const draft = e.redo[e.redo.length - 1]
      if (!draft) return e
      return { ...e, draft, redo: e.redo.slice(0, -1), undo: [...e.undo, e.draft], decorSel: null, wallSel: null, refused: null, armedCancel: false, carry: null }
    }
    case 'armCancel':
      return e.armedCancel === op.on ? e : { ...e, armedCancel: op.on }
  }
}

/**
 * The office the scene draws while editing: moved pieces on their draft cells under their LIVE slot ids, so a moved
 * desk only changes its transform (no remount, no rebake). The canonical cell a piece leaves stays as an empty
 * suggested cell (`<id>~`), so the ring bands keep their boxes. Items bought in the draft are drawn on "+key" slots.
 * `hide` (a carried piece's id) is left out: it is in the hand, drawn as the ghost. Same object when nothing changed.
 */
export function draftOffice(office: OfficeState, draft: LayoutSnapshot, hide?: SlotId | null): OfficeState {
  const pieces = draftPieces(office, draft).filter((p) => p.moved || p.id === hide)
  if (pieces.length === 0) return office
  const byAnchor = new Map(pieces.map((p) => [p.id, p]))
  const owner = new Map<SlotId, { piece: DraftPiece; k: number }>()
  for (const p of itemPieces(office)) {
    const d = byAnchor.get(p.anchor.id)
    if (d) p.cells.forEach((c, k) => owner.set(c.id, { piece: d, k }))
  }
  const slots: Slot[] = []
  for (const s of office.slots) {
    const own = owner.get(s.id)
    if (!own) {
      slots.push(s)
      continue
    }
    if (!s.free) slots.push({ id: `${s.id}~`, ring: s.ring, type: s.type, pos: s.pos, rotation: s.rotation })
    if (own.piece.id === hide) continue
    const pos = own.piece.cells[own.k] ?? own.piece.cells[0]!
    slots.push({ ...s, ring: ringOfCell(pos, office.stage), pos: { ...pos }, rotation: own.piece.r })
  }
  for (const p of pieces) {
    if (!p.isNew || p.id === hide) continue
    p.cells.forEach((c, k) => {
      const slot: Slot = { id: k === 0 ? p.id : `${p.id}/${k}`, ring: ringOfCell(c, office.stage), type: p.type, pos: { ...c }, rotation: p.r, itemId: p.itemId, free: true }
      if (k > 0) slot.spanOf = p.id
      if (k === 0 && p.team !== undefined) slot.team = p.team
      slots.push(slot)
    })
  }
  return { ...office, slots }
}

/**
 * The piece under the pointer in the scene (render/LayoutEditor writes it on a cell change): Delete with nothing in
 * the hand removes this one. Module state, not store state: hovering never re-renders the panel.
 */
export const editorHover: { current: Carry | null } = { current: null }
