// Scene root inside <Canvas>: fixed isometric orthographic camera with limited zoom levels,
// soft pastel lighting + shadows, and all office layers.
import { OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { GameState } from '../engine/types'
import type { Selection, ZoomLevel } from '../store/types'
import type { BubbleRenderer } from './bubbles'
import { CAMERA_DIR, ZOOM_FACTORS, clamp, damp } from './constants'
import { EffectsLayer } from './Effects'
import { FurnitureLayer } from './Furniture'
import type { OfficeLayout } from './layout'
import { Office } from './Office'
import { stagePalette } from './palette'
import { People } from './People'
import { speakerPositions, useLayout } from './sceneRegistry'
import { SlotsLayer } from './Slot'
import { useGS, useUi } from './source'
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

function CameraRig({ zoomLevel }: { zoomLevel: ZoomLevel }) {
  const cam = useRef<THREE.OrthographicCamera>(null)
  const layout = useLayout()
  const selection = useUi((u) => u.selection)
  const size = useThree((s) => s.size)
  const target = useRef(new THREE.Vector3(layout.center[0], 0, layout.center[1]))
  const first = useRef(true)

  useFrame((_, rawDt) => {
    const c = cam.current
    if (!c) return
    const dt = Math.min(rawDt, 0.1)
    const r = Math.max(layout.radius, 3)
    const fit = Math.min(size.width / (r * 2.35), size.height / (r * 1.75 + 2.6))
    const want = clamp(fit * ZOOM_FACTORS[zoomLevel], 12, 400)

    // Close zoom follows the selection (clamped to the office); otherwise frame the whole office.
    let fx = layout.center[0]
    let fz = layout.center[1]
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
      <hemisphereLight args={['#fff6ea', '#d9cfc2', 1.35]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={light}
        key={mapSize}
        position={[layout.center[0] - 8, 16, layout.center[1] + 10]}
        intensity={1.6}
        color="#fff1dc"
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
      <WorldBubbles renderBubble={renderBubble} ambient={ambientBubbles} />
    </>
  )
}
