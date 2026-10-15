// Office edit mode (grid design §4), pure: the draft, the pieces as the player sees them in it, and the ops.
// The draft is a LayoutSnapshot over the live office (anchor slot id → cell + rotation + team label), so "Bitti" is one
// applyLayout action. Every op keeps the draft legal: a move, turn or label that validateLayout refuses never lands,
// it comes back as red cells and a short reason. No money moves in edit mode yet (buying pieces comes with step 4).
import { cellKey, itemPieces, previewSnapshot, rightDir, ringOfCell, type CellKey, type LayoutRefusal, type Rotation } from '../engine/layout'
import { FOUNDER_SLOT_ID, type Dept, type GridPos, type LayoutSnapshot, type OfficeState, type Slot, type SlotId, type SlotType } from '../engine/types'

/** Undo depth (one snapshot is well under 10 KB). */
export const UNDO_MAX = 100

/** Why a change was refused: a layout rule, the fixed founder desk, or a malformed draft. */
export type EditRefusal = LayoutRefusal | 'founder' | 'invalid'

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
}

export type LayoutOp =
  | { kind: 'select'; id: SlotId | null }
  | { kind: 'place'; id: SlotId; x: number; z: number; r?: Rotation }
  | { kind: 'rotate'; id?: SlotId }
  | { kind: 'team'; team: Dept; id?: SlotId }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'armCancel'; on: boolean }

export function startEdit(office: OfficeState): LayoutEdit {
  return { draft: { slots: {}, decor: (office.decor ?? []).map((p) => ({ ...p, pos: { ...p.pos } })) }, undo: [], redo: [], selected: null, refused: null, armedCancel: false }
}

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

/** Every movable piece (the founder desk is fixed) where the draft puts it. */
export function draftPieces(office: OfficeState, draft: LayoutSnapshot): DraftPiece[] {
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
  const prev = draft.slots[id]
  const next: LayoutSnapshot = { ...draft, slots: { ...draft.slots, [id]: { x, z, r, ...(prev?.team !== undefined ? { team: prev.team } : {}) } } }
  const res = previewSnapshot(office, next)
  if ('error' in res) return { ok: false, cells, bad: [], reason: 'invalid' }
  if (!res.check.ok) return { ok: false, cells, bad: res.check.bad, reason: res.check.reason! }
  return { ok: true, draft: next, cells }
}

function push(e: LayoutEdit, draft: LayoutSnapshot, selected: SlotId | null): LayoutEdit {
  const undo = [...e.undo, e.draft]
  if (undo.length > UNDO_MAX) undo.shift()
  return { ...e, draft, undo, redo: [], selected, refused: null, armedCancel: false }
}

function refuse(e: LayoutEdit, cells: readonly GridPos[], bad: readonly CellKey[], reason: EditRefusal, now: number): LayoutEdit {
  const keys = [...new Set([...cells.map((c) => cellKey(c.x, c.z)), ...bad])]
  return { ...e, refused: { cells: keys, reason, at: now }, armedCancel: false }
}

/** One op on the edit state. Returns the same object when nothing changes. `now` stamps a refusal. */
export function reduceLayoutEdit(office: OfficeState, e: LayoutEdit, op: LayoutOp, now = 0): LayoutEdit {
  switch (op.kind) {
    case 'select': {
      if (op.id === FOUNDER_SLOT_ID) return refuse({ ...e, selected: null }, [{ x: 0, z: 0 }], [], 'founder', now)
      if (op.id !== null && !draftPieces(office, e.draft).some((p) => p.id === op.id)) return e
      return e.selected === op.id && !e.refused && !e.armedCancel ? e : { ...e, selected: op.id, refused: null, armedCancel: false }
    }
    case 'place':
    case 'rotate': {
      const id = op.kind === 'place' ? op.id : (op.id ?? e.selected)
      if (id === null) return e
      if (id === FOUNDER_SLOT_ID) return refuse(e, [{ x: 0, z: 0 }], [], 'founder', now)
      const piece = draftPieces(office, e.draft).find((p) => p.id === id)
      if (!piece) return e
      const x = op.kind === 'place' ? op.x : piece.x
      const z = op.kind === 'place' ? op.z : piece.z
      const r: Rotation = op.kind === 'place' ? (op.r ?? piece.r) : (((piece.r + 1) & 3) as Rotation)
      if (x === piece.x && z === piece.z && r === piece.r) return e.selected === id ? e : { ...e, selected: id, refused: null }
      const c = checkPlace(office, e.draft, id, x, z, r)
      if (!c.ok) return refuse({ ...e, selected: id }, c.cells, c.bad, c.reason, now)
      return push(e, c.draft, id)
    }
    case 'team': {
      const id = op.id ?? e.selected
      const piece = id ? draftPieces(office, e.draft).find((p) => p.id === id) : undefined
      if (!piece || piece.type !== 'desk' || piece.team === op.team) return e
      const prev = e.draft.slots[piece.id]
      const cp = prev ? { ...prev, team: op.team } : { x: piece.x, z: piece.z, r: piece.r, team: op.team }
      return push(e, { ...e.draft, slots: { ...e.draft.slots, [piece.id]: cp } }, piece.id)
    }
    case 'undo': {
      const draft = e.undo[e.undo.length - 1]
      if (!draft) return e
      return { ...e, draft, undo: e.undo.slice(0, -1), redo: [...e.redo, e.draft], refused: null, armedCancel: false }
    }
    case 'redo': {
      const draft = e.redo[e.redo.length - 1]
      if (!draft) return e
      return { ...e, draft, redo: e.redo.slice(0, -1), undo: [...e.undo, e.draft], refused: null, armedCancel: false }
    }
    case 'armCancel':
      return e.armedCancel === op.on ? e : { ...e, armedCancel: op.on }
  }
}

/**
 * The office the scene draws while editing: moved pieces on their draft cells under their LIVE slot ids, so a moved
 * desk only changes its transform (no remount, no rebake). The canonical cell a piece leaves stays as an empty
 * suggested cell (`<id>~`), so the ring bands keep their boxes. Same object when nothing moved.
 */
export function draftOffice(office: OfficeState, draft: LayoutSnapshot): OfficeState {
  const pieces = draftPieces(office, draft).filter((p) => p.moved)
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
    const pos = own.piece.cells[own.k] ?? own.piece.cells[0]!
    slots.push({ ...s, ring: ringOfCell(pos), pos: { ...pos }, rotation: own.piece.r })
  }
  return { ...office, slots }
}
