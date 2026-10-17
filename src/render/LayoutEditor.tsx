// Office edit mode in the scene (grid design §4, PC only): the cell grid, one tinted fill for the team labels (an
// island of 3+, grid §5, tinted stronger), the selection and the ghost (green / red footprint, its front edge), the
// refused cells with their short reason, and the pointer: press a piece and drag it (over 10 px), or select it and
// click a free cell. Picking is plane math (a y = 0 ray hit → worldToGrid), never a raycast on the baked meshes. One
// draw call (grid lines are thin quads in the same vertex-coloured mesh) plus DOM for the reason; nothing here bakes,
// and the drop only changes the draft (furniture moves by transform, see useFurnitureView).
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { decorCells, frontDir, gridHalf, inGrid, isWallKind, ringOfCell, stageFixtures, wallSegments, worldToGrid, type CellKey, type Rotation } from '../engine/layout'
import { isRingUnlocked } from '../engine/office'
import { FOUNDER_SLOT_ID, type Dept, type GridPos, type OfficeState } from '../engine/types'
import { UI_TEXT } from '../content'
import { checkFloor, checkPlace, checkWall, decorAt, draftIslands, draftPieces, pieceAt, wallAt, type DecorCheck, type DraftPiece, type LayoutEdit, type WallSeg } from '../store/layoutEdit'
import { CELL, WALL_HEIGHT, gridToWorld } from './constants'
import { FloorModel, WallModel, floorPose, wallPose } from './Decor'
import { useHtmlPortal } from './htmlPortal'
import { DEPT_COLORS, HIGHLIGHT } from './palette'
import { useLayout, useOffice } from './sceneRegistry'
import { storeApi, useGS, useUi } from './source'

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
const sameSeg = (a: WallSeg | null, b: WallSeg | null): boolean => (a === null ? b === null : b !== null && a.wall === b.wall && a.seg === b.seg)

/** Every editable cell: in the stage's grid and in an open ring (locked rings stay dark, the shell shows them). */
function openCells(office: OfficeState): GridPos[] {
  const h = gridHalf(office.stage)
  const out: GridPos[] = []
  for (let z = -h; z <= h; z++) for (let x = -h; x <= h; x++) if (isRingUnlocked(office, ringOfCell({ x, z }, office.stage))) out.push({ x, z })
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
  /** What is dragged: a functional piece, a floor decor piece, a wall piece. */
  what: 'item' | 'decor' | 'wall'
  id: string
  from?: WallSeg
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
  const bounds = useLayout().bounds
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const portal = useHtmlPortal()
  const cash = useGS((s) => s.stats.cash)
  const pieces = useMemo(() => draftPieces(office, edit.draft), [office, edit.draft])
  // Desks in a team island (grid §5) read stronger than a lone labelled desk. Seats do not change while editing.
  const deptOf = useGS((s) => s.employees.map((e) => `${e.id}:${e.dept}`).join('|'))
  const island = useMemo(() => {
    const m = new Map(deptOf.split('|').map((x) => x.split(':') as [string, Dept]))
    return new Set(draftIslands(office, edit.draft, (id) => m.get(id)).filter((c) => c.active).flatMap((c) => c.slotIds))
  }, [office, edit.draft, deptOf])
  const piecesRef = useRef(pieces)
  piecesRef.current = pieces
  const cells = useMemo(() => openCells(office), [office])
  const lines = useMemo(() => gridQuads(cells), [cells])
  const [hover, setHover] = useState<GridPos | null>(null)
  const [hoverWall, setHoverWall] = useState<WallSeg | null>(null)
  const [dragId, setDragId] = useState<{ what: Drag['what']; id: string } | null>(null)
  const drag = useRef<Drag | null>(null)
  const grab = useRef({ dx: 0, dz: 0 })

  // Pointer → cell by plane math: the camera ray meets the floor (y = 0), worldToGrid names the cell. The cross-aisle
  // and the margins outside a cell box are no cell (null). The back and left walls are planes too: a ray that meets a
  // wall before the floor points at that wall's segment.
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const backWall = new THREE.Plane(new THREE.Vector3(0, 0, 1), -bounds.minZ)
    const leftWall = new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.minX)
    const hit = new THREE.Vector3()
    const aim = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, get().camera)
    }
    const floorAt = (): { c: GridPos | null; d: number } => {
      if (!ray.ray.intersectPlane(floor, hit)) return { c: null, d: Infinity }
      const d = ray.ray.origin.distanceTo(hit)
      const c = { x: worldToGrid(hit.x), z: worldToGrid(hit.z) }
      const [wx, wz] = gridToWorld(c)
      if (Math.abs(hit.x - wx) > CELL / 2 || Math.abs(hit.z - wz) > CELL / 2) return { c: null, d }
      return { c: inGrid(office.stage, c) ? c : null, d }
    }
    const wallAtRay = (): { w: WallSeg | null; d: number } => {
      let best: { w: WallSeg | null; d: number } = { w: null, d: Infinity }
      for (const [wall, plane] of [['back', backWall], ['left', leftWall]] as const) {
        if (!ray.ray.intersectPlane(plane, hit) || hit.y < 0.2 || hit.y > WALL_HEIGHT + 0.3) continue
        const along = wall === 'back' ? hit.x : hit.z
        const span = wall === 'back' ? [bounds.minX, bounds.maxX] : [bounds.minZ, bounds.maxZ]
        if (along < span[0]! || along > span[1]!) continue
        const seg = worldToGrid(along)
        if (!wallSegments(office.stage, wall).includes(seg)) continue
        const d = ray.ray.origin.distanceTo(hit)
        if (d < best.d) best = { w: { wall, seg }, d }
      }
      return best
    }
    /** The floor cell or the wall segment under the pointer (the nearer one along the ray). */
    const pick = (ev: PointerEvent): { c: GridPos | null; w: WallSeg | null } => {
      aim(ev)
      const f = floorAt()
      const w = wallAtRay()
      return w.w && w.d < f.d ? { c: null, w: w.w } : { c: f.c, w: null }
    }
    let lastC: GridPos | null = null
    let lastW: WallSeg | null = null
    const setTarget = (c: GridPos | null, w: WallSeg | null) => {
      if (!sameCell(c, lastC)) {
        lastC = c
        setHover(c)
      }
      if (!sameSeg(w, lastW)) {
        lastW = w
        setHoverWall(w)
      }
    }
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      const { c, w } = pick(ev)
      const api = storeApi()
      const e = api.ui.layoutEdit
      if (!e) return
      // An armed piece goes down where the pointer is (and stays armed for the next one).
      if (e.armed) {
        if (isWallKind(e.armed.kind)) {
          if (w) api.layoutEditOp({ kind: 'hang', at: w })
        } else if (c) api.layoutEditOp({ kind: 'addDecor', x: c.x, z: c.z })
        return
      }
      if (w) {
        if (!wallAt(e.draft, w)) return
        drag.current = { what: 'wall', id: `${w.wall}:${w.seg}`, from: w, dx: 0, dz: 0, x0: ev.clientX, y0: ev.clientY, active: false }
        api.layoutEditOp({ kind: 'selectWall', at: w })
        el.setPointerCapture?.(ev.pointerId)
        return
      }
      if (!c) return
      const id = pieceAt(piecesRef.current, c)
      if (id === FOUNDER_SLOT_ID) {
        api.layoutEditOp({ kind: 'select', id })
        return
      }
      if (id) {
        const p = piecesRef.current.find((x) => x.id === id)!
        drag.current = { what: 'item', id, dx: p.x - c.x, dz: p.z - c.z, x0: ev.clientX, y0: ev.clientY, active: false }
        api.layoutEditOp({ kind: 'select', id })
        el.setPointerCapture?.(ev.pointerId)
        return
      }
      const did = decorAt(e.draft, c)
      if (did) {
        const p = e.draft.decor.find((x) => x.id === did)!
        drag.current = { what: 'decor', id: did, dx: p.pos.x - c.x, dz: p.pos.z - c.z, x0: ev.clientX, y0: ev.clientY, active: false }
        api.layoutEditOp({ kind: 'selectDecor', id: did })
        el.setPointerCapture?.(ev.pointerId)
      }
    }
    const onMove = (ev: PointerEvent) => {
      const { c, w } = pick(ev)
      setTarget(c, w)
      const d = drag.current
      if (d && !d.active && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) > DRAG_PX) {
        d.active = true
        grab.current = { dx: d.dx, dz: d.dz }
        setDragId({ what: d.what, id: d.id })
      }
      const e = storeApi().ui.layoutEdit
      const onPiece = !!c && ((pieceAt(piecesRef.current, c) !== null && pieceAt(piecesRef.current, c) !== FOUNDER_SLOT_ID) || (!!e && decorAt(e.draft, c) !== null))
      el.style.cursor = drag.current?.active ? 'grabbing' : e?.armed ? 'copy' : onPiece || (w && e && wallAt(e.draft, w)) ? 'grab' : ''
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      const api = storeApi()
      const d = drag.current
      drag.current = null
      el.releasePointerCapture?.(ev.pointerId)
      const { c, w } = pick(ev)
      if (d?.active) {
        setDragId(null)
        if (d.what === 'wall') {
          if (w && d.from) api.layoutEditOp({ kind: 'moveWall', from: d.from, to: w })
        } else if (c) api.layoutEditOp(d.what === 'item' ? { kind: 'place', id: d.id, x: c.x + d.dx, z: c.z + d.dz } : { kind: 'moveDecor', id: d.id, x: c.x + d.dx, z: c.z + d.dz })
        return
      }
      if (d) return
      const e = api.ui.layoutEdit
      if (!e || e.armed) return
      // A click on a bare spot: move the selected piece there, or drop the selection.
      if (w && e.wallSel && !wallAt(e.draft, w)) api.layoutEditOp({ kind: 'moveWall', from: e.wallSel, to: w })
      else if (c && e.selected && pieceAt(piecesRef.current, c) === null) api.layoutEditOp({ kind: 'place', id: e.selected, x: c.x, z: c.z })
      else if (c && e.decorSel && pieceAt(piecesRef.current, c) === null) api.layoutEditOp({ kind: 'moveDecor', id: e.decorSel, x: c.x, z: c.z })
      else api.layoutEditOp({ kind: 'select', id: null })
    }
    const onLeave = () => setTarget(null, null)
    const onContext = () => {
      drag.current = null
      setDragId(null)
      const e = storeApi().ui.layoutEdit
      storeApi().layoutEditOp(e?.armed ? { kind: 'arm', armed: null } : { kind: 'select', id: null })
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
  }, [gl, get, office.stage, bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ])

  // Ghost: the dragged piece under the pointer, or the selected piece over a free hovered cell (click to move there).
  const selected = edit.selected ? pieces.find((p) => p.id === edit.selected) : undefined
  let ghost: { piece: DraftPiece; x: number; z: number } | null = null
  if (hover && dragId?.what === 'item') {
    const p = pieces.find((x) => x.id === dragId.id)
    if (p) ghost = { piece: p, x: hover.x + grab.current.dx, z: hover.z + grab.current.dz }
  } else if (hover && !dragId && selected && pieceAt(pieces, hover) === null) ghost = { piece: selected, x: hover.x, z: hover.z }
  const gx = ghost?.x
  const gz = ghost?.z
  const gid = ghost?.piece.id
  const gr = ghost?.piece.r
  const check = useMemo(
    () => (gid !== undefined && gx !== undefined && gz !== undefined && gr !== undefined ? checkPlace(office, edit.draft, gid, gx, gz, gr) : null),
    [office, edit.draft, gid, gx, gz, gr],
  )

  // Decor ghost: the armed piece, a dragged floor piece, or the selected floor piece over a free cell.
  const decorSel = edit.decorSel ? edit.draft.decor.find((p) => p.id === edit.decorSel) : undefined
  let fGhost: { id: string | null; kind: string; x: number; z: number; r: Rotation } | null = null
  if (hover && edit.armed && !isWallKind(edit.armed.kind)) fGhost = { id: null, kind: edit.armed.kind, x: hover.x, z: hover.z, r: edit.armedRot ?? 0 }
  else if (hover && dragId?.what === 'decor') {
    const p = edit.draft.decor.find((x) => x.id === dragId.id)
    if (p) fGhost = { id: p.id, kind: p.kind, x: hover.x + grab.current.dx, z: hover.z + grab.current.dz, r: p.rotation }
  } else if (hover && !dragId && decorSel && pieceAt(pieces, hover) === null && decorAt(edit.draft, hover) === null) fGhost = { id: decorSel.id, kind: decorSel.kind, x: hover.x, z: hover.z, r: decorSel.rotation }
  const fKey = fGhost ? `${fGhost.id}|${fGhost.kind}|${fGhost.x}|${fGhost.z}|${fGhost.r}` : ''
  const fCheck = useMemo<DecorCheck | null>(
    () => (fGhost ? checkFloor(office, edit, fGhost.id, fGhost.kind, fGhost.x, fGhost.z, fGhost.r, cash) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [office, edit.draft, fKey, cash],
  )
  // Wall ghost: the armed wall piece (or paint) or a dragged wall piece over a wall segment.
  const draggedWall = dragId?.what === 'wall' && edit.wallSel ? wallAt(edit.draft, edit.wallSel) : undefined
  const wArmed = edit.armed && isWallKind(edit.armed.kind) ? edit.armed : draggedWall ? { kind: draggedWall.kind } : null
  const wKey = hoverWall && wArmed ? `${hoverWall.wall}|${hoverWall.seg}|${wArmed.kind}|${wArmed.color ?? ''}|${draggedWall ? 'd' : ''}` : ''
  const wCheck = useMemo<DecorCheck | null>(() => {
    if (!hoverWall || !wArmed) return null
    if (draggedWall) return wallAt(edit.draft, hoverWall) && !(edit.wallSel && hoverWall.wall === edit.wallSel.wall && hoverWall.seg === edit.wallSel.seg) ? { ok: false, cells: [], bad: [], reason: 'overlap' } : { ok: true, draft: edit.draft, cells: [] }
    return checkWall(office, edit, hoverWall, wArmed, cash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office, edit.draft, wKey, cash])
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
      const tint = p.team ? rgba(DEPT_COLORS[p.team], island.has(p.id) ? 0.7 : 0.42) : rgba('#ffffff', 0.12)
      for (const c of p.cells) quads.push({ c, color: tint })
    }
    for (const p of edit.draft.decor) for (const c of decorCells(p)) quads.push({ c, color: rgba('#ffffff', p.id === edit.decorSel ? 0 : 0.1) })
    const lit = (p: DraftPiece | undefined, hex: string, a: number) => {
      if (!p) return
      for (const c of p.cells) quads.push({ c, color: rgba(hex, a) })
      quads.push({ c: p.cells[0]!, color: rgba(hex, Math.min(1, a + 0.4)), front: p.r })
    }
    if (hoverId && hoverId !== edit.selected && hoverId !== FOUNDER_SLOT_ID) lit(pieces.find((p) => p.id === hoverId), HIGHLIGHT.hover, 0.28)
    lit(selected, HIGHLIGHT.selected, 0.5)
    if (decorSel) for (const c of decorCells(decorSel)) quads.push({ c, color: rgba(HIGHLIGHT.selected, 0.5) })
    if (ghost && check) {
      const hex = check.ok ? HIGHLIGHT.valid : HIGHLIGHT.invalid
      for (const c of check.cells) quads.push({ c, color: rgba(hex, 0.55) })
      quads.push({ c: check.cells[0]!, color: rgba(hex, 0.95), front: ghost.piece.r })
      if (!check.ok) for (const k of check.bad) quads.push({ c: keyToCell(k), color: rgba(HIGHLIGHT.invalid, 0.45) })
    }
    if (fCheck) {
      const hex = fCheck.ok ? HIGHLIGHT.valid : HIGHLIGHT.invalid
      for (const c of fCheck.cells) quads.push({ c, color: rgba(hex, 0.55) })
      if (!fCheck.ok) for (const k of fCheck.bad) quads.push({ c: keyToCell(k), color: rgba(HIGHLIGHT.invalid, 0.45) })
    }
    if (edit.refused) for (const k of edit.refused.cells) quads.push({ c: keyToCell(k), color: rgba(HIGHLIGHT.invalid, 0.6) })
    return fillGeometry(lines, quads)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office.stage, lines, pieces, island, hoverId, selected, edit.selected, edit.refused, check, ghost?.piece.r, edit.draft.decor, decorSel, fCheck])

  useEffect(() => () => fill.dispose(), [fill])
  // Pulls toward the camera harder than the floor's own offset (factor / units −1), still behind any furniture.
  const fillMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), [])
  useEffect(() => () => fillMat.dispose(), [fillMat])

  // The short reason next to the red cells: the ghost's while it is over a refused spot, else the last refused drop.
  const wallSpot = hoverWall ? wallPose(bounds, hoverWall.wall, hoverWall.seg).pos : null
  let reason: { key: string; at: [number, number, number] } | null = null
  const cellSpot = (c: GridPos, y = 0.4): [number, number, number] => {
    const [x, z] = gridToWorld(c)
    return [x, y, z]
  }
  if (ghost && check && !check.ok) reason = { key: check.reason, at: cellSpot(check.cells[0]!) }
  else if (fGhost && fCheck && !fCheck.ok) reason = { key: fCheck.reason, at: cellSpot({ x: fGhost.x, z: fGhost.z }) }
  else if (wCheck && !wCheck.ok && wallSpot) reason = { key: wCheck.reason, at: [wallSpot[0], wallSpot[1] + 0.3, wallSpot[2]] }
  else if (edit.refused) reason = { key: edit.refused.reason, at: edit.refused.cells[0] ? cellSpot(keyToCell(edit.refused.cells[0])) : (wallSpot ?? [0, 0.4, 0]) }

  // Model previews (unbaked, 1–4 draws): the floor ghost on its cell, the wall ghost on its segment.
  const fPose = fGhost ? floorPose({ kind: fGhost.kind, pos: { x: fGhost.x, z: fGhost.z }, rotation: fGhost.r }) : null
  const wPose = hoverWall && wArmed && wArmed.kind !== 'paint' && wCheck?.ok ? wallPose(bounds, hoverWall.wall, hoverWall.seg) : null

  return (
    <group name="layoutEditor">
      <mesh geometry={fill} material={fillMat} renderOrder={4} />
      {fGhost && fPose && (fCheck?.ok ?? false) && (
        <group position={[fPose.pos[0], 0, fPose.pos[1]]} rotation={[0, fPose.yaw, 0]}>
          <FloorModel kind={fGhost.kind} />
        </group>
      )}
      {wPose && wArmed && (
        <group position={wPose.pos} rotation={[0, wPose.yaw, 0]}>
          <WallModel kind={wArmed.kind} />
        </group>
      )}
      {edit.wallSel && !dragId && <WallMark at={edit.wallSel} bounds={bounds} />}
      {reason && (
        <Html portal={portal} position={reason.at} center zIndexRange={[14, 12]} wrapperClass="pointer-events-none" style={{ pointerEvents: 'none' }}>
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

/** The selected wall piece: a thin outline frame on the wall around its segment. */
function WallMark({ at, bounds }: { at: WallSeg; bounds: { minX: number; minZ: number } }) {
  const { pos, yaw } = wallPose(bounds as Parameters<typeof wallPose>[0], at.wall, at.seg)
  const m = useMemo(() => new THREE.MeshBasicMaterial({ color: HIGHLIGHT.selected, transparent: true, opacity: 0.85, depthWrite: false }), [])
  useEffect(() => () => m.dispose(), [m])
  const w = CELL * 0.92
  const h = 0.8
  const t = 0.04
  return (
    <group position={pos} rotation={[0, yaw, 0]}>
      {[
        [0, h / 2, w, t],
        [0, -h / 2, w, t],
        [-w / 2, 0, t, h],
        [w / 2, 0, t, h],
      ].map(([x, y, sx, sy], i) => (
        <mesh key={i} geometry={BOX} material={m} position={[x!, y!, 0.06]} scale={[sx!, sy!, 0.01]} renderOrder={5} />
      ))}
    </group>
  )
}

const BOX = new THREE.BoxGeometry(1, 1, 1)
