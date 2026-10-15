// Office edit mode in the scene (grid design §4, PC only): the cell grid, one tinted fill for the team labels, the
// selection and the ghost (green / red footprint, its front edge), the refused cells with their short reason, and the
// pointer: press a piece and drag it (over 10 px), or select it and click a free cell. Picking is plane math (a y = 0
// ray hit → worldToGrid), never a raycast on the baked meshes. One draw call (grid lines are thin quads in the same
// vertex-coloured mesh) plus DOM for the reason; nothing here bakes, and the drop only changes the draft (furniture
// moves by transform, see useFurnitureView).
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { frontDir, gridHalf, inGrid, ringOfCell, stageFixtures, worldToGrid, type CellKey } from '../engine/layout'
import { isRingUnlocked } from '../engine/office'
import { FOUNDER_SLOT_ID, type GridPos, type OfficeState } from '../engine/types'
import { UI_TEXT } from '../content'
import { checkPlace, draftPieces, pieceAt, type DraftPiece, type LayoutEdit } from '../store/layoutEdit'
import { CELL, gridToWorld } from './constants'
import { useHtmlPortal } from './htmlPortal'
import { DEPT_COLORS, HIGHLIGHT } from './palette'
import { useOffice } from './sceneRegistry'
import { storeApi, useUi } from './source'

/** Screen px a press must travel before it becomes a drag (the slot tap tolerance). */
const DRAG_PX = 10
/**
 * Lift over the floor. The floor and its decals are pulled toward the camera with polygonOffset (about one pixel of
 * depth slope: several cm at the far zoom), so a plain lift is not enough: the overlay pulls harder (OVERLAY_MAT).
 */
const Y_FILL = 0.03
/** A tinted cell is a bit smaller than the cell, so neighbours read as separate cells. */
const FILL = CELL * 0.9
const LINE = CELL * 0.96
/** Grid line width (world units). */
const LINE_W = 0.035
const LINE_RGBA: RGBA = [1, 1, 1, 0.5]

type RGBA = [number, number, number, number]

const rgba = (hex: string, a: number): RGBA => {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b, a]
}

const sameCell = (a: GridPos | null, b: GridPos | null): boolean => (a === null ? b === null : b !== null && a.x === b.x && a.z === b.z)

/** Every editable cell: in the stage's grid and in an open ring (locked rings stay dark, the shell shows them). */
function openCells(office: OfficeState): GridPos[] {
  const h = gridHalf(office.stage)
  const out: GridPos[] = []
  for (let z = -h; z <= h; z++) for (let x = -h; x <= h; x++) if (isRingUnlocked(office, ringOfCell({ x, z }))) out.push({ x, z })
  return out
}

/** The cell outlines as thin quads (one per cell side): drawn in the fill mesh, so the grid costs no draw call. */
function gridQuads(cells: readonly GridPos[]): Box[] {
  const out: Box[] = []
  const s = LINE / 2
  const w = LINE_W / 2
  for (const c of cells) {
    const [x, z] = gridToWorld(c)
    out.push([x - s, x + s, z - s - w, z - s + w], [x - s, x + s, z + s - w, z + s + w], [x - s - w, x - s + w, z - s, z + s], [x + s - w, x + s + w, z - s, z + s])
  }
  return out
}

/** World rect [minX, maxX, minZ, maxZ]. */
type Box = [number, number, number, number]

interface Quad {
  c: GridPos
  color: RGBA
  /** Front edge strip (the chair / access side) for this rotation; absent = the whole cell. */
  front?: number
}

function fillGeometry(lines: readonly Box[], quads: readonly Quad[]): THREE.BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  for (const [x0, x1, z0, z1] of lines) {
    const n = pos.length / 3
    pos.push(x0, Y_FILL, z0, x1, Y_FILL, z0, x1, Y_FILL, z1, x0, Y_FILL, z1)
    for (let k = 0; k < 4; k++) col.push(...LINE_RGBA)
    idx.push(n, n + 2, n + 1, n, n + 3, n + 2)
  }
  for (const q of quads) {
    const [cx, cz] = gridToWorld(q.c)
    let hx = FILL / 2
    let hz = FILL / 2
    let ox = 0
    let oz = 0
    if (q.front !== undefined) {
      const f = frontDir(q.front)
      const t = FILL * 0.14
      if (f.x !== 0) hx = t / 2
      else hz = t / 2
      ox = f.x * (FILL / 2 - t / 2)
      oz = f.z * (FILL / 2 - t / 2)
    }
    const n = pos.length / 3
    const y = q.front !== undefined ? Y_FILL + 0.002 : Y_FILL
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      pos.push(cx + ox + sx * hx, y, cz + oz + sz * hz)
      col.push(...q.color)
    }
    idx.push(n, n + 2, n + 1, n, n + 3, n + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  g.setIndex(idx)
  return g
}

const keyToCell = (k: CellKey): GridPos => {
  const [x, z] = k.split(',').map(Number) as [number, number]
  return { x, z }
}

interface Drag {
  id: string
  /** Anchor minus the grabbed cell: a room grabbed by its second cell keeps that offset. */
  dx: number
  dz: number
  x0: number
  y0: number
  active: boolean
}

export function LayoutEditor() {
  const edit = useUi((u) => u.layoutEdit)
  return edit ? <Editor edit={edit} /> : null
}

function Editor({ edit }: { edit: LayoutEdit }) {
  const office = useOffice()
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const portal = useHtmlPortal()
  const pieces = useMemo(() => draftPieces(office, edit.draft), [office, edit.draft])
  const piecesRef = useRef(pieces)
  piecesRef.current = pieces
  const cells = useMemo(() => openCells(office), [office])
  const lines = useMemo(() => gridQuads(cells), [cells])
  const [hover, setHover] = useState<GridPos | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const drag = useRef<Drag | null>(null)
  const grab = useRef({ dx: 0, dz: 0 })

  // Pointer → cell by plane math: the camera ray meets the floor (y = 0), worldToGrid names the cell. The cross-aisle
  // and the margins outside a cell box are no cell (null).
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    const cellOf = (ev: PointerEvent): GridPos | null => {
      const r = el.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, get().camera)
      if (!ray.ray.intersectPlane(floor, hit)) return null
      const c = { x: worldToGrid(hit.x), z: worldToGrid(hit.z) }
      const [wx, wz] = gridToWorld(c)
      if (Math.abs(hit.x - wx) > CELL / 2 || Math.abs(hit.z - wz) > CELL / 2) return null
      return inGrid(office.stage, c) ? c : null
    }
    let last: GridPos | null = null
    const setCell = (c: GridPos | null) => {
      if (sameCell(c, last)) return
      last = c
      setHover(c)
    }
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      const c = cellOf(ev)
      const id = c ? pieceAt(piecesRef.current, c) : null
      const api = storeApi()
      if (!c || !id) return
      if (id === FOUNDER_SLOT_ID) {
        api.layoutEditOp({ kind: 'select', id })
        return
      }
      const p = piecesRef.current.find((x) => x.id === id)!
      drag.current = { id, dx: p.x - c.x, dz: p.z - c.z, x0: ev.clientX, y0: ev.clientY, active: false }
      api.layoutEditOp({ kind: 'select', id })
      el.setPointerCapture?.(ev.pointerId)
    }
    const onMove = (ev: PointerEvent) => {
      const c = cellOf(ev)
      setCell(c)
      const d = drag.current
      if (d && !d.active && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) > DRAG_PX) {
        d.active = true
        grab.current = { dx: d.dx, dz: d.dz }
        setDragId(d.id)
      }
      el.style.cursor = drag.current?.active ? 'grabbing' : c && pieceAt(piecesRef.current, c) && pieceAt(piecesRef.current, c) !== FOUNDER_SLOT_ID ? 'grab' : ''
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      const api = storeApi()
      const d = drag.current
      drag.current = null
      el.releasePointerCapture?.(ev.pointerId)
      const c = cellOf(ev)
      if (d?.active) {
        setDragId(null)
        if (c) api.layoutEditOp({ kind: 'place', id: d.id, x: c.x + d.dx, z: c.z + d.dz })
        return
      }
      if (d) return
      // A click on bare floor: move the selected piece there, or drop the selection.
      const e = api.ui.layoutEdit
      if (c && e?.selected && pieceAt(piecesRef.current, c) === null) api.layoutEditOp({ kind: 'place', id: e.selected, x: c.x, z: c.z })
      else api.layoutEditOp({ kind: 'select', id: null })
    }
    const onLeave = () => setCell(null)
    const onContext = () => {
      drag.current = null
      setDragId(null)
      storeApi().layoutEditOp({ kind: 'select', id: null })
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('contextmenu', onContext)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('contextmenu', onContext)
      el.style.cursor = ''
    }
  }, [gl, get, office.stage])

  // Ghost: the dragged piece under the pointer, or the selected piece over a free hovered cell (click to move there).
  const selected = edit.selected ? pieces.find((p) => p.id === edit.selected) : undefined
  let ghost: { piece: DraftPiece; x: number; z: number } | null = null
  if (hover && dragId) {
    const p = pieces.find((x) => x.id === dragId)
    if (p) ghost = { piece: p, x: hover.x + grab.current.dx, z: hover.z + grab.current.dz }
  } else if (hover && selected && pieceAt(pieces, hover) === null) ghost = { piece: selected, x: hover.x, z: hover.z }
  const gx = ghost?.x
  const gz = ghost?.z
  const gid = ghost?.piece.id
  const gr = ghost?.piece.r
  const check = useMemo(
    () => (gid !== undefined && gx !== undefined && gz !== undefined && gr !== undefined ? checkPlace(office, edit.draft, gid, gx, gz, gr) : null),
    [office, edit.draft, gid, gx, gz, gr],
  )
  const hoverId = hover && !dragId ? pieceAt(pieces, hover) : null

  const fill = useMemo(() => {
    const quads: Quad[] = []
    const fx = stageFixtures(office.stage)
    for (const k of [...fx.noPiece, ...fx.blocked]) {
      const c = keyToCell(k)
      if (c.x === 0 && c.z === 0) continue
      quads.push({ c, color: rgba('#7a7468', 0.22) })
    }
    for (const p of pieces) {
      const tint = p.team ? rgba(DEPT_COLORS[p.team], 0.42) : rgba('#ffffff', 0.12)
      for (const c of p.cells) quads.push({ c, color: tint })
    }
    const lit = (p: DraftPiece | undefined, hex: string, a: number) => {
      if (!p) return
      for (const c of p.cells) quads.push({ c, color: rgba(hex, a) })
      quads.push({ c: p.cells[0]!, color: rgba(hex, Math.min(1, a + 0.4)), front: p.r })
    }
    if (hoverId && hoverId !== edit.selected && hoverId !== FOUNDER_SLOT_ID) lit(pieces.find((p) => p.id === hoverId), HIGHLIGHT.hover, 0.28)
    lit(selected, HIGHLIGHT.selected, 0.5)
    if (ghost && check) {
      const hex = check.ok ? HIGHLIGHT.valid : HIGHLIGHT.invalid
      for (const c of check.cells) quads.push({ c, color: rgba(hex, 0.55) })
      quads.push({ c: check.cells[0]!, color: rgba(hex, 0.95), front: ghost.piece.r })
      if (!check.ok) for (const k of check.bad) quads.push({ c: keyToCell(k), color: rgba(HIGHLIGHT.invalid, 0.45) })
    }
    if (edit.refused) for (const k of edit.refused.cells) quads.push({ c: keyToCell(k), color: rgba(HIGHLIGHT.invalid, 0.6) })
    return fillGeometry(lines, quads)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office.stage, lines, pieces, hoverId, selected, edit.selected, edit.refused, check, ghost?.piece.r])

  useEffect(() => () => fill.dispose(), [fill])
  // Pulls toward the camera harder than the floor's own offset (factor / units −1), still behind any furniture.
  const fillMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), [])
  useEffect(() => () => fillMat.dispose(), [fillMat])

  // The short reason next to the red cells: the ghost's while it is over a refused spot, else the last refused drop.
  const reason = ghost && check && !check.ok ? { key: check.reason, at: check.cells[0]! } : edit.refused ? { key: edit.refused.reason, at: keyToCell(edit.refused.cells[0]!) } : null
  const reasonAt = reason ? gridToWorld(reason.at) : null

  return (
    <group name="layoutEditor">
      <mesh geometry={fill} material={fillMat} renderOrder={4} />
      {reason && reasonAt && (
        <Html portal={portal} position={[reasonAt[0], 0.4, reasonAt[1]]} center zIndexRange={[14, 12]} wrapperClass="pointer-events-none" style={{ pointerEvents: 'none' }}>
          <div
            data-layout-reason=""
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold text-white shadow-[0_2px_8px_rgb(0_0_0/0.25)]"
            style={{ background: HIGHLIGHT.invalid, transform: 'translateY(-26px)' }}
          >
            {UI_TEXT[`layout.reason.${reason.key}`]}
          </div>
        </Html>
      )}
    </group>
  )
}
