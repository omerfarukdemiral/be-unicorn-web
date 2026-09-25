// Scene root inside <Canvas>: fixed isometric orthographic camera with limited zoom levels,
// warm soft lighting + shadows, and all office layers.
import { OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { GameState } from '../engine/types'
import type { Selection, ZoomLevel } from '../store/types'
import type { BubbleRenderer } from './bubbles'
import { CAMERA_DIR, CELL, ZOOM_FACTORS, clamp, damp } from './constants'
import { EffectsLayer } from './Effects'
import { JuiceLayer } from './Juice'
import { FurnitureLayer } from './Furniture'
import type { OfficeLayout } from './layout'
import { Office } from './Office'
import { stagePalette } from './palette'
import { People } from './People'
import { speakerPositions, useLayout } from './sceneRegistry'
import { SlotsLayer } from './Slot'
import { useGS, useUi } from './source'
import { panelSelection } from '../store/gameStore'
import { WorldBubbles } from './WorldBubbles'

export interface OfficeSceneProps {
  /** Overrides ui.zoom (e.g. previews). */
  zoom?: ZoomLevel
  lowPower?: boolean
  renderBubble?: BubbleRenderer
  ambientBubbles?: boolean
}

const CAM_DIST = 60
const dir = new THREE.Vector3(...CAMERA_DIR).normalize()

function focusOf(sel: Selection | null, layout: OfficeLayout): [number, number] | null {
  if (!sel) return null
  if (sel.kind === 'slot') return layout.itemCenter.get(sel.id)?.pos ?? layout.slotWorld.get(sel.id) ?? null
  const id = sel.kind === 'founder' ? 'founder' : sel.kind === 'employee' || sel.kind === 'visitor' ? sel.id : null
  const p = id ? speakerPositions.get(id) : undefined
  return p ? [p.x, p.z] : null
}

/**
 * Box the default zoom frames. Stage 2+ offices are mostly locked rings (dark overlay); framing the whole
 * office there makes the open, colourful ring a small island in a dark slab. At the default zoom (level 1)
 * a mostly-locked office is framed on the unlocked area plus a margin of OPEN_PAD (clamped to the office),
 * so the open ring fills the view. Zoom level 0 still shows the whole office.
 */
const OPEN_PAD = CELL * 0.6
function frameBox(layout: OfficeLayout, zoomLevel: ZoomLevel): { cx: number; cz: number; r: number } {
  const b = layout.bounds
  const w = layout.walkBox
  const areaB = (b.maxX - b.minX) * (b.maxZ - b.minZ)
  const areaW = (w.maxX - w.minX) * (w.maxZ - w.minZ)
  if (zoomLevel !== 1 || areaB <= 0 || areaW / areaB >= 0.5) return { cx: layout.center[0], cz: layout.center[1], r: layout.radius }
  const minX = Math.max(b.minX, w.minX - OPEN_PAD)
  const maxX = Math.min(b.maxX, w.maxX + OPEN_PAD)
  const minZ = Math.max(b.minZ, w.minZ - OPEN_PAD)
  const maxZ = Math.min(b.maxZ, w.maxZ + OPEN_PAD)
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, r: Math.hypot(maxX - minX, maxZ - minZ) / 2 }
}

const camRight = new THREE.Vector3()
const camUp = new THREE.Vector3()

function CameraRig({ zoomLevel }: { zoomLevel: ZoomLevel }) {
  const cam = useRef<THREE.OrthographicCamera>(null)
  const layout = useLayout()
  const selection = useUi((u) => panelSelection(u.panel))
  const insetWant = useUi((u) => u.sceneInset)
  const size = useThree((s) => s.size)
  const target = useRef(new THREE.Vector3(layout.center[0], 0, layout.center[1]))
  const first = useRef(true)
  // Damped screen inset (px) hidden by the ui panel / sheet: the office is framed in the visible rest.
  const inset = useRef({ top: 0, right: 0, bottom: 0 })

  useFrame((_, rawDt) => {
    const c = cam.current
    if (!c) return
    const dt = Math.min(rawDt, 0.1)
    const ins = inset.current
    if (first.current) Object.assign(ins, insetWant)
    else {
      ins.top = damp(ins.top, insetWant.top, 7, dt)
      ins.right = damp(ins.right, insetWant.right, 7, dt)
      ins.bottom = damp(ins.bottom, insetWant.bottom, 7, dt)
    }
    const availW = Math.max(size.width - ins.right, size.width * 0.3)
    const availH = Math.max(size.height - ins.top - ins.bottom, Math.min(size.height, 140))
    const frame = frameBox(layout, zoomLevel)
    const r = Math.max(frame.r, 3)
    // A tall free area (portrait phone) is width-bound: trim the side margin (the diamond's width is ~2r) so the
    // office uses more of the room between the bars instead of floating in beige.
    const sideFit = availH > availW * 1.2 ? 2.05 : 2.35
    const fit = Math.min(availW / (r * sideFit), availH / (r * 1.75 + 2.6))
    const want = clamp(fit * ZOOM_FACTORS[zoomLevel], 12, 400)

    // Close zoom follows the selection (clamped to the office); otherwise frame the office (frameBox).
    let fx = frame.cx
    let fz = frame.cz
    if (zoomLevel === 2) {
      const f = focusOf(selection, layout)
      if (f) {
        fx = clamp(f[0], layout.bounds.minX, layout.bounds.maxX)
        fz = clamp(f[1], layout.bounds.minZ, layout.bounds.maxZ)
      }
    }
    if (first.current) {
      first.current = false
      c.zoom = want
      target.current.set(fx, 0, fz)
    } else {
      c.zoom = damp(c.zoom, want, 6, dt)
      target.current.x = damp(target.current.x, fx, 5, dt)
      target.current.z = damp(target.current.z, fz, 5, dt)
    }
    c.position.copy(target.current).addScaledVector(dir, CAM_DIST)
    c.position.y += 0.6
    c.lookAt(target.current.x, 0.6, target.current.z)
    // Slide the camera in its own plane so the target sits at the center of the visible area
    // (1 px = 1 / zoom world units for the orthographic camera).
    const shiftX = (size.width - availW) / 2
    const shiftY = (ins.top - (size.height - availH - ins.top)) / 2
    if (shiftX || shiftY) {
      c.updateMatrixWorld()
      camRight.setFromMatrixColumn(c.matrixWorld, 0)
      camUp.setFromMatrixColumn(c.matrixWorld, 1)
      c.position.addScaledVector(camRight, shiftX / c.zoom).addScaledVector(camUp, shiftY / c.zoom)
    }
    c.updateProjectionMatrix()
  })

  return <OrthographicCamera ref={cam} makeDefault near={0.1} far={300} position={[CAM_DIST, CAM_DIST, CAM_DIST]} zoom={60} />
}

function Lights({ lowPower }: { lowPower: boolean }) {
  const layout = useLayout()
  const light = useRef<THREE.DirectionalLight>(null)
  const r = Math.max(layout.radius, 4) + 2
  const [cx, cz] = layout.center
  // Primitive deps: only a real office change reconfigures the shadow camera.
  useEffect(() => {
    const l = light.current
    if (!l) return
    const cam = l.shadow.camera
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = 60
    cam.updateProjectionMatrix()
    l.target.position.set(cx, 0, cz)
    l.target.updateMatrixWorld()
    l.shadow.needsUpdate = true
  }, [r, cx, cz])
  const mapSize = lowPower ? 1024 : 2048
  return (
    <>
      <hemisphereLight args={['#fff4e4', '#e6d2b8', 1.35]} />
      {/* Fill 0.4 (was 0.25): pastel walls keep their hue on the shaded face instead of going grey. */}
      <ambientLight intensity={0.4} />
      <directionalLight
        ref={light}
        key={mapSize}
        position={[layout.center[0] - 8, 16, layout.center[1] + 10]}
        intensity={1.6}
        color="#fff0dc"
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={lowPower ? 2 : 5}
      />
    </>
  )
}

/** Short "moving in" pop when the office changes stage. */
function StageTransition({ children }: { children: ReactNode }) {
  const stage = useGS((s: GameState) => s.office.stage)
  const g = useRef<THREE.Group>(null)
  const since = useRef(-1)
  const prev = useRef(stage)
  useEffect(() => {
    if (prev.current !== stage) since.current = performance.now()
    prev.current = stage
  }, [stage])
  useFrame(() => {
    const grp = g.current
    if (!grp) return
    if (since.current < 0) return
    const k = Math.min(1, (performance.now() - since.current) / 900)
    const e = 1 - Math.pow(1 - k, 3)
    grp.scale.setScalar(0.9 + 0.1 * e)
    grp.position.y = (1 - e) * -0.6
    if (k >= 1) since.current = -1
  })
  return <group ref={g}>{children}</group>
}

function Background() {
  const stage = useGS((s: GameState) => s.office.stage)
  return <color attach="background" args={[stagePalette(stage).background]} />
}

export function OfficeScene({ zoom, lowPower = false, renderBubble, ambientBubbles = true }: OfficeSceneProps) {
  const uiZoom = useUi((u) => u.zoom)
  return (
    <>
      <Background />
      <CameraRig zoomLevel={zoom ?? uiZoom} />
      <Lights lowPower={lowPower} />
      <StageTransition>
        <Office />
        <SlotsLayer />
        <FurnitureLayer />
        <People />
      </StageTransition>
      <EffectsLayer />
      {/* Core loop beats: release banner + user wave, payday light (docs/CORE_LOOP.md §7). */}
      <JuiceLayer />
      <WorldBubbles renderBubble={renderBubble} ambient={ambientBubbles} />
    </>
  )
}
