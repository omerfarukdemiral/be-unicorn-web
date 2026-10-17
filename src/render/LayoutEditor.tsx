// Office edit mode in the scene (grid v2, PC only): carry and drop, the way a building game does it. No grid lines and
// no tinted squares: the floor's own tiles are the cells. A piece is picked up with a click (or pressed and dragged),
// follows the pointer as its real model tinted soft green where it fits and red where it does not, R or a right click
// turns it, a click puts it down (Shift keeps a new one of the same piece in the hand), Delete takes it away, Esc
// puts it back. A catalogue card arms a new piece the same way. Picking is plane math (a y = 0 ray hit → worldToGrid),
// never a raycast on the baked meshes. The short reason shows next to the piece only when a click is refused.
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { decorCells, inGrid, isWallKind, rightDir, wallSegments, worldToGrid, type CellKey, type Rotation } from '../engine/layout'
import { FOUNDER_SLOT_ID, type GridPos } from '../engine/types'
import { UI_TEXT } from '../content'
import { checkFloor, checkNewItem, checkPlace, checkWall, decorAt, draftPieces, editorHover, pieceAt, wallAt, type Carry, type DecorCheck, type LayoutEdit, type WallSeg } from '../store/layoutEdit'
import { CELL, WALL_HEIGHT, gridToWorld, yawOf } from './constants'
import { FloorModel, WallModel, floorPose, wallPose } from './Decor'
import { FurnitureModel } from './Furniture'
import { resolveFurniture } from './furnitureCatalog'
import { useHtmlPortal } from './htmlPortal'
import { HIGHLIGHT } from './palette'
import { useLayout, useOffice } from './sceneRegistry'
import { storeApi, useGS, useUi } from './source'

/** Screen px a press must travel before it becomes a drag (the slot tap tolerance). */
const DRAG_PX = 10
/** Lift of the footprint glow over the floor (it also pulls toward the camera with polygonOffset). */
const Y_FILL = 0.03

const sameCell = (a: GridPos | null, b: GridPos | null): boolean => (a === null ? b === null : b !== null && a.x === b.x && a.z === b.z)
const sameSeg = (a: WallSeg | null, b: WallSeg | null): boolean => (a === null ? b === null : b !== null && a.wall === b.wall && a.seg === b.seg)

const keyToCell = (k: CellKey): GridPos => {
  const [x, z] = k.split(',').map(Number) as [number, number]
  return { x, z }
}

/** What is in the hand: a placed piece picked up (`carry`) or a new one from a card (`armed`). */
type Hand =
  | { what: 'item'; id: string | null; itemId: string; type: Parameters<typeof resolveFurniture>[1]; size: 1 | 2; r: Rotation }
  | { what: 'floor'; id: string | null; kind: string; r: Rotation }
  | { what: 'wall'; from: WallSeg | null; kind: string; color?: string }

function handOf(edit: LayoutEdit, pieces: ReturnType<typeof draftPieces>): Hand | null {
  const c = edit.carry
  if (c?.what === 'item') {
    const p = pieces.find((x) => x.id === c.id)
    return p ? { what: 'item', id: p.id, itemId: p.itemId, type: p.type, size: p.size, r: c.r } : null
  }
  if (c?.what === 'decor') {
    const p = edit.draft.decor.find((x) => x.id === c.id)
    return p ? { what: 'floor', id: p.id, kind: p.kind, r: c.r } : null
  }
  if (c?.what === 'wall') {
    const w = wallAt(edit.draft, c.at)
    return w ? { what: 'wall', from: c.at, kind: w.kind } : null
  }
  const a = edit.armed
  if (!a) return null
  const r = (edit.armedRot ?? 0) as Rotation
  if (a.item) {
    const f = resolveFurniture(a.kind)
    return { what: 'item', id: null, itemId: a.kind, type: f.slotType, size: f.item?.size === 2 ? 2 : 1, r }
  }
  if (isWallKind(a.kind)) return { what: 'wall', from: null, kind: a.kind, ...(a.color ? { color: a.color } : {}) }
  return { what: 'floor', id: null, kind: a.kind, r }
}

export function LayoutEditor() {
  const edit = useUi((u) => u.layoutEdit)
  return edit ? <Editor edit={edit} /> : null
}

interface Press {
  x0: number
  y0: number
  /** The press picked this piece up: a release far enough away puts it down there (drag and drop). */
  picked: boolean
}

function Editor({ edit }: { edit: LayoutEdit }) {
  const office = useOffice()
  const bounds = useLayout().bounds
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const portal = useHtmlPortal()
  const cash = useGS((s) => s.stats.cash)
  const pieces = useMemo(() => draftPieces(office, edit.draft), [office, edit.draft])
  const piecesRef = useRef(pieces)
  piecesRef.current = pieces
  const [hover, setHover] = useState<GridPos | null>(null)
  const [hoverWall, setHoverWall] = useState<WallSeg | null>(null)

  // Pointer → cell by plane math: the camera ray meets the floor (y = 0), worldToGrid names the cell. The back and
  // left walls are planes too: a ray that meets a wall before the floor points at that wall's segment.
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const backWall = new THREE.Plane(new THREE.Vector3(0, 0, 1), -bounds.minZ)
    const leftWall = new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.minX)
    const hit = new THREE.Vector3()
    const aim = (ev: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, get().camera)
    }
    const floorAt = (): { c: GridPos | null; d: number } => {
      if (!ray.ray.intersectPlane(floor, hit)) return { c: null, d: Infinity }
      const d = ray.ray.origin.distanceTo(hit)
      const c = { x: worldToGrid(hit.x), z: worldToGrid(hit.z) }
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
    const pick = (ev: PointerEvent | MouseEvent): { c: GridPos | null; w: WallSeg | null } => {
      aim(ev)
      const f = floorAt()
      const w = wallAtRay()
      return w.w && w.d < f.d ? { c: null, w: w.w } : { c: f.c, w: null }
    }
    /** The piece under the pointer (nothing in the hand): an item, a floor piece, a wall piece. */
    const pieceUnder = (c: GridPos | null, w: WallSeg | null, e: LayoutEdit): Carry | null => {
      if (w) return wallAt(e.draft, w) ? { what: 'wall', at: w } : null
      if (!c) return null
      const id = pieceAt(piecesRef.current, c)
      if (id && id !== FOUNDER_SLOT_ID) return { what: 'item', id, r: 0 }
      const did = decorAt(e.draft, c)
      return did ? { what: 'decor', id: did, r: 0 } : null
    }
    let lastC: GridPos | null = null
    let lastW: WallSeg | null = null
    let press: Press | null = null
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
    /** Puts what is in the hand down at the pointer; true when it landed. Shift keeps a new one of it in the hand. */
    const putDown = (c: GridPos | null, w: WallSeg | null, shift: boolean): boolean => {
      const api = storeApi()
      const e = api.ui.layoutEdit
      if (!e) return false
      const before = e.undo.length
      const carry = e.carry
      const landed = () => (storeApi().ui.layoutEdit?.undo.length ?? before) > before
      if (carry?.what === 'item' && c) {
        const p = piecesRef.current.find((x) => x.id === carry.id)
        api.layoutEditOp({ kind: 'place', id: carry.id, x: c.x, z: c.z, r: carry.r })
        if (landed() && shift && p) api.layoutEditOp({ kind: 'arm', armed: { kind: p.itemId, item: true } })
        if (landed() && shift) storeApi().layoutEditOp({ kind: 'armRot', r: carry.r })
        return landed()
      }
      if (carry?.what === 'decor' && c) {
        const p = e.draft.decor.find((x) => x.id === carry.id)
        api.layoutEditOp({ kind: 'moveDecor', id: carry.id, x: c.x, z: c.z, r: carry.r })
        if (landed() && shift && p) {
          api.layoutEditOp({ kind: 'arm', armed: { kind: p.kind } })
          storeApi().layoutEditOp({ kind: 'armRot', r: carry.r })
        }
        return landed()
      }
      if (carry?.what === 'wall' && w) {
        api.layoutEditOp({ kind: 'moveWall', from: carry.at, to: w })
        return landed()
      }
      const a = e.armed
      if (!a) return false
      if (a.item && c) api.layoutEditOp({ kind: 'addItem', x: c.x, z: c.z })
      else if (isWallKind(a.kind) && w) api.layoutEditOp({ kind: 'hang', at: w })
      else if (!a.item && !isWallKind(a.kind) && c) api.layoutEditOp({ kind: 'addDecor', x: c.x, z: c.z })
      else return false
      const ok = landed()
      // One piece per click; Shift keeps the next one in the hand (paint stays on the brush).
      if (ok && !shift && a.kind !== 'paint') storeApi().layoutEditOp({ kind: 'arm', armed: null })
      return ok
    }
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      const { c, w } = pick(ev)
      const e = storeApi().ui.layoutEdit
      if (!e) return
      if (e.carry || e.armed) {
        putDown(c, w, ev.shiftKey)
        press = null
        return
      }
      const under = pieceUnder(c, w, e)
      if (c && !under && pieceAt(piecesRef.current, c) === FOUNDER_SLOT_ID) {
        storeApi().layoutEditOp({ kind: 'select', id: FOUNDER_SLOT_ID })
        return
      }
      if (!under) {
        if (e.selected || e.decorSel || e.wallSel) storeApi().layoutEditOp({ kind: 'drop' })
        return
      }
      storeApi().layoutEditOp({ kind: 'pick', carry: under })
      press = { x0: ev.clientX, y0: ev.clientY, picked: true }
      el.setPointerCapture?.(ev.pointerId)
    }
    const onMove = (ev: PointerEvent) => {
      const { c, w } = pick(ev)
      setTarget(c, w)
      const e = storeApi().ui.layoutEdit
      const under = e && !e.carry && !e.armed ? pieceUnder(c, w, e) : null
      editorHover.current = under
      el.style.cursor = e?.carry ? 'grabbing' : e?.armed ? 'copy' : under ? 'grab' : ''
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      el.releasePointerCapture?.(ev.pointerId)
      const p = press
      press = null
      // Pressed on a piece and dragged off: it goes down where the button came up. A plain click keeps it in the hand.
      if (p?.picked && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > DRAG_PX) {
        const { c, w } = pick(ev)
        putDown(c, w, ev.shiftKey)
      }
    }
    const onLeave = () => {
      setTarget(null, null)
      editorHover.current = null
    }
    const onContext = (ev: MouseEvent) => {
      ev.preventDefault()
      const e = storeApi().ui.layoutEdit
      // Right click turns what is in the hand (a building game's habit); with nothing in it, it does nothing.
      if (e?.carry || e?.armed) storeApi().layoutEditOp({ kind: 'rotate' })
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
      editorHover.current = null
    }
  }, [gl, get, office.stage, bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ])

  const hand = handOf(edit, pieces)
  const handKey = hand ? JSON.stringify(hand) : ''
  // Fit of the piece in the hand at the hovered cell / wall segment (on a cell change, never per pixel).
  const check = useMemo<{ ok: boolean; cells: GridPos[] } | null>(() => {
    if (!hand) return null
    if (hand.what === 'wall') {
      if (!hoverWall) return null
      if (hand.from) {
        const taken = wallAt(edit.draft, hoverWall) && !sameSeg(hand.from, hoverWall)
        return { ok: !taken, cells: [] }
      }
      const c: DecorCheck = checkWall(office, edit, hoverWall, { kind: hand.kind, ...(hand.color ? { color: hand.color } : {}) }, cash)
      return { ok: c.ok, cells: [] }
    }
    if (!hover) return null
    if (hand.what === 'item') {
      const c = hand.id ? checkPlace(office, edit.draft, hand.id, hover.x, hover.z, hand.r) : checkNewItem(office, edit, hand.itemId, hover.x, hover.z, hand.r, cash)
      return { ok: c.ok, cells: c.cells }
    }
    const c = checkFloor(office, edit, hand.id, hand.kind, hover.x, hover.z, hand.r, cash)
    return { ok: c.ok, cells: c.cells }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office, edit.draft, handKey, hover?.x, hover?.z, hoverWall?.wall, hoverWall?.seg, cash])

  // The piece under the pointer with nothing in the hand: a soft light under it says "this one can be picked up".
  const hoverPiece = !hand && hover ? pieceAt(pieces, hover) : null
  const hoverDecor = !hand && hover && !hoverPiece ? decorAt(edit.draft, hover) : null
  const lit: GridPos[] = hoverPiece && hoverPiece !== FOUNDER_SLOT_ID ? (pieces.find((p) => p.id === hoverPiece)?.cells ?? []) : hoverDecor ? decorCells(edit.draft.decor.find((p) => p.id === hoverDecor)!) : []

  // Refused click: the red cells and the reason next to them, until the refusal fades (LayoutPanel clears it).
  const refused = edit.refused
  const refusedCells = refused ? refused.cells.map(keyToCell) : []
  const glow = useMemo(() => {
    const quads: { c: GridPos; color: string; a: number }[] = []
    for (const c of lit) quads.push({ c, color: HIGHLIGHT.hover, a: 0.22 })
    if (hand && check) for (const c of check.cells) quads.push({ c, color: check.ok ? HIGHLIGHT.valid : HIGHLIGHT.invalid, a: 0.28 })
    for (const c of refusedCells) quads.push({ c, color: HIGHLIGHT.invalid, a: 0.4 })
    return quads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit.map((c) => `${c.x},${c.z}`).join(';'), handKey, check, refused])

  let reason: { key: string; at: [number, number, number] } | null = null
  if (refused) {
    const at = refusedCells[0]
    const [x, z] = at ? gridToWorld(at) : hover ? gridToWorld(hover) : [0, 0]
    reason = { key: refused.reason, at: [x, 0.5, z] }
  }

  return (
    <group name="layoutEditor">
      <Glow quads={glow} />
      {hand && check && <HandGhost hand={hand} hover={hover} hoverWall={hoverWall} ok={check.ok} bounds={bounds} />}
      {reason && (
        <Html portal={portal} position={reason.at} center zIndexRange={[14, 12]} wrapperClass="pointer-events-none" style={{ pointerEvents: 'none' }}>
          <div
            data-layout-reason=""
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold text-white shadow-[0_2px_8px_rgb(0_0_0/0.25)]"
            style={{ background: HIGHLIGHT.invalid, transform: 'translateY(-34px)' }}
          >
            {UI_TEXT[`layout.reason.${reason.key}`]}
          </div>
        </Html>
      )}
    </group>
  )
}

/** Soft cell lights under the hand and the hovered piece: one small mesh, rebuilt on a cell change only. */
function Glow({ quads }: { quads: { c: GridPos; color: string; a: number }[] }) {
  const geo = useMemo(() => {
    const pos: number[] = []
    const col: number[] = []
    const idx: number[] = []
    const h = CELL * 0.46
    for (const q of quads) {
      const [cx, cz] = gridToWorld(q.c)
      const c = new THREE.Color(q.color)
      const n = pos.length / 3
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        pos.push(cx + sx * h, Y_FILL, cz + sz * h)
        col.push(c.r, c.g, c.b, q.a)
      }
      idx.push(n, n + 2, n + 1, n, n + 3, n + 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
    g.setIndex(idx)
    return g
  }, [quads])
  useEffect(() => () => geo.dispose(), [geo])
  const m = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), [])
  useEffect(() => () => m.dispose(), [m])
  if (!quads.length) return null
  return <mesh geometry={geo} material={m} renderOrder={4} />
}

const ghostMats = new Map<string, THREE.Material>()
/** The ghost's look: the model's own colours washed toward green / red, a little see-through. */
function ghostMat(ok: boolean, vertexColors: boolean): THREE.Material {
  const key = `${ok}|${vertexColors}`
  let m = ghostMats.get(key)
  if (!m) {
    const tint = new THREE.Color(ok ? HIGHLIGHT.valid : HIGHLIGHT.invalid)
    m = new THREE.MeshStandardMaterial({
      color: vertexColors ? new THREE.Color(1, 1, 1).lerp(tint, 0.45) : tint,
      vertexColors,
      emissive: tint,
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.82,
      roughness: 0.7,
      depthWrite: true,
    })
    ghostMats.set(key, m)
  }
  return m
}

/** Every mesh under `ref` drawn with the ghost material (the model bakes itself after mount, so this runs per frame). */
function useGhostLook(ref: React.RefObject<THREE.Group | null>, ok: boolean) {
  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const want = ghostMat(ok, !!mesh.geometry.getAttribute('color'))
      if (mesh.material !== want) {
        mesh.material = want
        mesh.castShadow = false
      }
    })
  })
}

/** The real model of what is in the hand, on the hovered cell (or wall segment), turned as it will go down. */
function HandGhost({ hand, hover, hoverWall, ok, bounds }: { hand: Hand; hover: GridPos | null; hoverWall: WallSeg | null; ok: boolean; bounds: ReturnType<typeof useLayout>['bounds'] }) {
  const ref = useRef<THREE.Group>(null)
  useGhostLook(ref, ok)
  if (hand.what === 'wall') {
    if (!hoverWall || hand.kind === 'paint') return null
    const { pos, yaw } = wallPose(bounds, hoverWall.wall, hoverWall.seg)
    return (
      <group ref={ref} position={pos} rotation={[0, yaw, 0]}>
        <WallModel kind={hand.kind} />
      </group>
    )
  }
  if (!hover) return null
  if (hand.what === 'floor') {
    const { pos, yaw } = floorPose({ kind: hand.kind, pos: hover, rotation: hand.r })
    return (
      <group ref={ref} position={[pos[0], 0.02, pos[1]]} rotation={[0, yaw, 0]}>
        <FloorModel kind={hand.kind} />
      </group>
    )
  }
  const [x, z] = gridToWorld(hover)
  const span = hand.size === 2
  const d = rightDir(hand.r)
  const pos: [number, number] = span ? [x + (d.x * CELL) / 2, z + (d.z * CELL) / 2] : [x, z]
  const yaw = span ? -Math.atan2(d.z, d.x) : yawOf(hand.r)
  return (
    <group ref={ref} position={[pos[0], 0.02, pos[1]]} rotation={[0, yaw, 0]}>
      <FurnitureModel key={hand.itemId} resolved={resolveFurniture(hand.itemId, hand.type)} span={span} />
    </group>
  )
}

/** Left edge of the hint's band: clear of the money island in the bottom-left corner (about 290 px wide on a PC). */
const HINT_LEFT = 300

/**
 * The one hint box at the bottom of the scene while the edit mode is open: the keys of the carry, nothing else. DOM,
 * mounted by GameCanvas next to the canvas (not inside the three tree).
 */
export function LayoutKeyHint() {
  const open = useUi((u) => u.layoutEdit !== null)
  const inset = useUi((u) => u.sceneInset)
  if (!open) return null
  return (
    <div className="pointer-events-none absolute z-[13] flex justify-center" style={{ left: HINT_LEFT, right: inset?.right ?? 0, bottom: (inset?.bottom ?? 0) + 8 }}>
      <div data-layout-keys="" className="rounded-full bg-ink/80 px-3.5 py-1.5 font-text text-[12px] font-semibold text-white shadow-[0_2px_10px_rgb(0_0_0/0.18)]">
        {UI_TEXT['layout.keys']}
      </div>
    </div>
  )
}
