// Scene root inside <Canvas>: fixed isometric orthographic camera with limited zoom levels,
// warm soft lighting + shadows, and all office layers.
import { OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { GameState } from '../engine/types'
import type { Selection, ZoomLevel } from '../store/types'
import type { BubbleRenderer } from './bubbles'
import { CAMERA_DIR, CELL, WALL_HEIGHT, ZOOM_FACTORS, clamp, damp, renderBudget } from './constants'
import { fitOutline, gapCenterY, measureIslands, outlineOf, type Fit, type Rect } from './frameFit'
import { DeskBadges } from './DeskBadges'
import { HeadPlates } from './HeadPlates'
import { EffectsLayer } from './Effects'
import { JuiceLayer } from './Juice'
import { FurnitureLayer } from './Furniture'
import { occupiedBox, type FrameBox, type OfficeLayout } from './layout'
import { Office } from './Office'
import { DecorLayer } from './Decor'
import { stagePalette } from './palette'
import { stageBand, type StageBand } from '../content/stageBand'
import { sunFor } from './stageLook'
import { People } from './People'
import { speakerPositions, useLayout, useLayoutEditing, useOffice } from './sceneRegistry'
import { LayoutEditor } from './LayoutEditor'
import { SlotsLayer } from './Slot'
import { Surroundings } from './Surroundings'
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
const CAM_FAR = 140
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
function frameBox(layout: OfficeLayout, zoomLevel: ZoomLevel): FrameBox {
  const b = layout.bounds
  const w = layout.walkBox
  const areaB = (b.maxX - b.minX) * (b.maxZ - b.minZ)
  const areaW = (w.maxX - w.minX) * (w.maxZ - w.minZ)
  const box =
    zoomLevel !== 1 || areaB <= 0 || areaW / areaB >= 0.5
      ? { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ }
      : { minX: Math.max(b.minX, w.minX - OPEN_PAD), maxX: Math.min(b.maxX, w.maxX + OPEN_PAD), minZ: Math.max(b.minZ, w.minZ - OPEN_PAD), maxZ: Math.min(b.maxZ, w.maxZ + OPEN_PAD) }
  return { ...box, cx: (box.minX + box.maxX) / 2, cz: (box.minZ + box.maxZ) / 2, r: Math.hypot(box.maxX - box.minX, box.maxZ - box.minZ) / 2 }
}

/** The team's box is used only when it is clearly smaller than the default frame. */
const OCCUPIED_MIN_GAIN = 0.85
/** Portrait from this stage on frames the team's box whatever its size (and biases the camera into the HUD gap). */
const RING_FRAME_STAGE = 3
/**
 * Margin round the team's desks (world units). Landscape keeps a desk and a half of floor round the edge desks; a
 * portrait phone a bit less, so its figures read larger (fix round §4).
 */
const OCCUPIED_PAD = CELL * 1.5
const OCCUPIED_PAD_PORTRAIT = CELL * 0.8
/** Outline height: the walls (and the heads at the back desks) belong to the frame. */
const OUTLINE_H = WALL_HEIGHT
/** Portrait: the diamond's bare side tips may run this share of its width off each edge (figures read larger). */
const PORTRAIT_SLACK = 0.04
/**
 * Portrait framing the team: its box's side corners are bare floor past the outer desks (a team is a blob, not a
 * square), so more of them may run off the screen. At 0.04 a Series B team on a 390 px phone drew 19 px per unit.
 */
const TEAM_PORTRAIT_SLACK = 0.1
/** The diamond's bare tips may slip this share under a HUD island (frameFit.islandSlack). */
const ISLAND_SLACK = 0.1
/**
 * The default frame never zooms past this many px per world unit per px of the screen's short side: a small open
 * ring (Pre-seed's unlocked corner) would otherwise fill a desktop like the close zoom, walls cut off. A portrait
 * phone's short side is a third of a desktop's: its cap is looser, or a team of three stays a few px tall.
 */
const MAX_ZOOM_PER_PX = 1 / 12
const MAX_ZOOM_PER_PX_PORTRAIT = 1 / 8.5
/** Islands are re-read this often (ms) in case one changed size without a resize (a wider gauge, a new tab). */
const ISLAND_POLL_MS = 600

const camRight = new THREE.Vector3()
const camUp = new THREE.Vector3()

function sameRects(a: readonly Rect[], b: readonly Rect[]): boolean {
  return a.length === b.length && a.every((r, i) => {
    const o = b[i]!
    return Math.abs(r.left - o.left) < 2 && Math.abs(r.top - o.top) < 2 && Math.abs(r.right - o.right) < 2 && Math.abs(r.bottom - o.bottom) < 2
  })
}

function CameraRig({ zoomLevel }: { zoomLevel: ZoomLevel }) {
  const cam = useRef<THREE.OrthographicCamera>(null)
  const layout = useLayout()
  const office = useOffice()
  const occupied = useMemo(() => occupiedBox(layout, office.slots, OCCUPIED_PAD), [layout, office])
  const occupiedPortrait = useMemo(() => occupiedBox(layout, office.slots, OCCUPIED_PAD_PORTRAIT), [layout, office])
  const selection = useUi((u) => panelSelection(u.panel))
  // Only the side panel still takes a band off the scene; the top and bottom HUD are corner islands (T07).
  const panelRight = useUi((u) => u.sceneInset.right)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const target = useRef(new THREE.Vector3(layout.center[0], 0, layout.center[1]))
  const first = useRef(true)
  // Damped panel band (px) and the damped screen point where the target lands.
  const band = useRef(0)
  const anchor = useRef({ x: 0, y: 0 })
  const islands = useRef<Rect[]>([])
  const polled = useRef(-Infinity)
  const fitCache = useRef<{ key: string; fit: Fit } | null>(null)

  useFrame((state, rawDt) => {
    const c = cam.current
    if (!c) return
    const dt = Math.min(rawDt, 0.1)
    const now = state.clock.elapsedTime * 1000
    if (now - polled.current > ISLAND_POLL_MS) {
      polled.current = now
      const next = measureIslands(gl.domElement)
      if (!sameRects(next, islands.current)) islands.current = next
    }
    band.current = first.current ? panelRight : damp(band.current, panelRight, 7, dt)
    const freeRight = Math.max(size.width - band.current, size.width * 0.3)
    const portrait = size.height > freeRight * 1.2
    let frame = frameBox(layout, zoomLevel)
    // Default zoom frames the team (its desks plus a margin), not the floor: from Series A the whole floor made a
    // dozen people a small cluster in an empty slab (fix round §3). Portrait from Series A always does (the office is
    // tiny on a phone); otherwise only when the team's box is clearly smaller than the default frame.
    const ringStage = layout.stage >= RING_FRAME_STAGE
    const team = portrait ? occupiedPortrait : occupied
    if (zoomLevel === 1 && team && ((portrait && ringStage) || team.r < frame.r * OCCUPIED_MIN_GAIN)) frame = team

    // The fit only changes with the screen, the panel, the islands or the frame: cached on those.
    const biasDown = portrait && zoomLevel === 1 && ringStage
    const key = `${size.width}x${size.height}|${Math.round(freeRight)}|${frame.minX},${frame.maxX},${frame.minZ},${frame.maxZ}|${biasDown ? 1 : 0}|${islands.current.map((r) => `${r.left},${r.top},${r.right},${r.bottom}`).join(';')}`
    let fit = fitCache.current?.key === key ? fitCache.current.fit : null
    if (!fit) {
      // Islands under the side panel are hidden by it: only the ones in the free part count.
      const free = { left: 0, top: 0, right: freeRight, bottom: size.height }
      const focusY = biasDown ? gapCenterY(islands.current.filter((r) => r.left < freeRight), size.height) ?? undefined : undefined
      fit = fitOutline({ focusY, outline: outlineOf(frame, OUTLINE_H), free, islands: islands.current.filter((r) => r.left < freeRight), sideSlack: portrait ? (frame === team ? TEAM_PORTRAIT_SLACK : PORTRAIT_SLACK) : 0, islandSlack: ISLAND_SLACK, maxZoom: Math.min(size.width, size.height) * (portrait ? MAX_ZOOM_PER_PX_PORTRAIT : MAX_ZOOM_PER_PX) })
      fitCache.current = { key, fit }
    }
    const want = clamp(fit.zoom * ZOOM_FACTORS[zoomLevel], 12, 400)

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
    const a = anchor.current
    if (first.current) {
      first.current = false
      c.zoom = want
      target.current.set(fx, 0, fz)
      a.x = fit.x
      a.y = fit.y
    } else {
      c.zoom = damp(c.zoom, want, 6, dt)
      target.current.x = damp(target.current.x, fx, 5, dt)
      target.current.z = damp(target.current.z, fz, 5, dt)
      a.x = damp(a.x, fit.x, 6, dt)
      a.y = damp(a.y, fit.y, 6, dt)
    }
    c.position.copy(target.current).addScaledVector(dir, CAM_DIST)
    c.lookAt(target.current.x, 0, target.current.z)
    // Slide the camera in its own plane so the target lands on the fitted screen point
    // (1 px = 1 / zoom world units for the orthographic camera).
    const shiftX = size.width / 2 - a.x
    const shiftY = a.y - size.height / 2
    if (shiftX || shiftY) {
      c.updateMatrixWorld()
      camRight.setFromMatrixColumn(c.matrixWorld, 0)
      camUp.setFromMatrixColumn(c.matrixWorld, 1)
      c.position.addScaledVector(camRight, shiftX / c.zoom).addScaledVector(camUp, shiftY / c.zoom)
    }
    c.updateProjectionMatrix()
  })

  // Tight depth range (the camera sits CAM_DIST from the office): floor decals stay stable when zoomed out.
  // far covers the whole ground plane at the widest zoom of the largest office.
  return <OrthographicCamera ref={cam} makeDefault near={1} far={CAM_FAR} position={[CAM_DIST, CAM_DIST, CAM_DIST]} zoom={60} />
}

function Lights({ lowPower, band }: { lowPower: boolean; band: StageBand }) {
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
  const budget = renderBudget(lowPower, layout.stage)
  const mapSize = budget.shadowMapSize
  // A runtime drop to lowPower turns the sun's shadow off; free the map it already allocated.
  useEffect(() => {
    const l = light.current
    if (!l || budget.shadows || !l.shadow.map) return
    l.shadow.map.dispose()
    l.shadow.map = null
  }, [budget.shadows])
  // The sun's colour and blur follow the company's size (G2); it snaps with the stage pop, hidden by it.
  const sun = sunFor(band, lowPower)
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
        color={sun.color}
        castShadow={budget.shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={sun.radius}
      />
    </>
  )
}

/** Short "moving in" pop when the office changes stage, scaling about the new office's centre. */
function StageTransition({ children }: { children: ReactNode }) {
  const stage = useGS((s: GameState) => s.office.stage)
  const layout = useLayout()
  const center = useRef(layout.center)
  center.current = layout.center
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
    const sc = 0.9 + 0.1 * e
    const [cx, cz] = center.current
    grp.scale.setScalar(sc)
    // Pivot on the office centre (not the world origin): position = c·(1 − s).
    grp.position.set(cx * (1 - sc), (1 - e) * -0.6, cz * (1 - sc))
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
  // Office edit mode (PC): the grid overlay takes the floor; slot markers, people and desk badges step aside (people
  // would sit at desks that are being moved), and the camera stays on the whole office (no close zoom).
  const editing = useLayoutEditing()
  const zoomLevel = zoom ?? uiZoom
  const band = useGS((s: GameState) => stageBand(s.office.stage))
  return (
    <>
      <Background />
      <CameraRig zoomLevel={editing ? (Math.min(zoomLevel, 1) as ZoomLevel) : zoomLevel} />
      <Lights lowPower={lowPower} band={band} />
      <StageTransition>
        {/* Layer names: perf probes group meshes and draw calls by them. */}
        <group name="surroundings">
          <Surroundings lowPower={lowPower} />
        </group>
        <group name="office">
          <Office lowPower={lowPower} />
        </group>
        <group name="decor">
          <DecorLayer />
        </group>
        <group name="slots">{editing ? <LayoutEditor /> : <SlotsLayer />}</group>
        <group name="furniture">
          <FurnitureLayer band={band} lowPower={lowPower} />
        </group>
        <group name="people" visible={!editing}>
          <People band={band} />
        </group>
        <group name="badges" visible={!editing}>
          <DeskBadges />
        </group>
      </StageTransition>
      <group name="effects">
        <EffectsLayer />
        {/* Core loop beats: release banner + user wave, payday light (docs/CORE_LOOP.md §7). */}
        <JuiceLayer />
      </group>
      <HeadPlates />
      <WorldBubbles renderBubble={renderBubble} ambient={ambientBubbles} />
    </>
  )
}
