// Office shell: ground, floor, walls, door, rings (locked = dark & dusty, opening = renovation),
// and stage-specific decor (garage → coworking → … → campus). Parametric on the layout.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { STAIRS_LEN } from '../engine/layout'
import type { StageIndex } from '../engine/types'
import { CELL, WALL_HEIGHT, WALL_THICKNESS, hash01 } from './constants'
import type { Box, OfficeLayout, RingBand } from './layout'
import { LOCKED_OPACITY, PASTEL, PROP_COLORS, stagePalette, type StagePalette } from './palette'
import { useBake } from './bake'
import { GEO, glassMat, glowMat, mat } from './resources'
import { mood, useDecorView, useLayout } from './sceneRegistry'
import { paintOf } from './Decor'
import { FLOOR_TILE, WALL_TILE, floorTexture, wallTexture } from './surfaces'

type V3 = [number, number, number]

/**
 * Flat floor decal material: pulled toward the camera in depth (polygonOffset) so it never
 * z-fights the floor it lies on, whatever the zoom. Cached by colour.
 */
const decalCache = new Map<string, THREE.MeshStandardMaterial>()
function decalMat(color: string): THREE.MeshStandardMaterial {
  let m = decalCache.get(color)
  if (!m) {
    m = mat(color).clone()
    m.polygonOffset = true
    m.polygonOffsetFactor = -2
    m.polygonOffsetUnits = -2
    decalCache.set(color, m)
  }
  return m
}

function B({ s, p, c, r, shadow = true }: { s: V3; p: V3; c: string; r?: V3; shadow?: boolean }) {
  return <mesh geometry={GEO.box} material={mat(c)} scale={s} position={p} rotation={r} castShadow={shadow} receiveShadow />
}

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------

/**
 * A flat quad from four corners, with UVs in world units / `tile` so a repeat-wrapped texture keeps one scale and
 * stays continuous across separate pieces (floor, wall segments around the door).
 */
function surfaceGeo(corners: readonly V3[], uvs: readonly [number, number][]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.computeVertexNormals()
  return g
}

const surfaceMatCache = new Map<THREE.Texture, THREE.MeshStandardMaterial>()
/** Lit material over a painted surface texture, pulled toward the camera like the decals (it lies on a box face). */
function surfaceMat(tex: THREE.Texture): THREE.MeshStandardMaterial {
  let m = surfaceMatCache.get(tex)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    surfaceMatCache.set(tex, m)
  }
  return m
}

function Surface({ corners, uvs, tex }: { corners: readonly V3[]; uvs: readonly [number, number][]; tex: THREE.Texture }) {
  const key = JSON.stringify([corners, uvs])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geo = useMemo(() => surfaceGeo(corners, uvs), [key])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={surfaceMat(tex)} renderOrder={1} receiveShadow />
}

function Floor({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const stage = layout.stage
  const tex = floorTexture(stage)
  const T = FLOOR_TILE
  // Texture seams on cell edges: the repeat starts half a cell off the founder's cell centre (a joint every cell).
  const u = (w: number) => (w + CELL / 2) / T
  const y = 0.002
  return (
    <group>
      <B s={[w, 0.08, d]} p={[(b.minX + b.maxX) / 2, -0.04, (b.minZ + b.maxZ) / 2]} c={pal.floor} shadow={false} />
      {tex && (
        <Surface
          tex={tex}
          corners={[
            [b.minX, y, b.maxZ],
            [b.maxX, y, b.maxZ],
            [b.maxX, y, b.minZ],
            [b.minX, y, b.minZ],
          ]}
          uvs={[
            [u(b.minX), u(-b.maxZ)],
            [u(b.maxX), u(-b.maxZ)],
            [u(b.maxX), u(-b.minZ)],
            [u(b.minX), u(-b.minZ)],
          ]}
        />
      )}
      {stage === 0 && (
        // oil stain
        <mesh geometry={GEO.disc} material={decalMat(PROP_COLORS.oilStain)} scale={[0.9, 1, 0.6]} position={[b.minX + w * 0.28, 0.004, b.maxZ - d * 0.22]} renderOrder={2} />
      )}
      {stage === 6 && <BrassInlay b={b} />}
      {stage >= 2 && stage <= 5 && (
        <mesh geometry={GEO.plane} material={decalMat(stage === 2 ? PASTEL.lilac : stage === 3 ? PASTEL.sky : stage === 4 ? PASTEL.peach : PASTEL.mint)} scale={[CELL * 3, 1, CELL * 3]} position={[0, 0.006, 0]} renderOrder={2} receiveShadow />
      )}
    </group>
  )
}

/** Campus: a brass line inset around the walnut floor. */
function BrassInlay({ b }: { b: Box }) {
  const i = CELL
  const w = b.maxX - b.minX - i * 2
  const d = b.maxZ - b.minZ - i * 2
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  const m = decalMat(PROP_COLORS.brass)
  return (
    <group>
      <mesh geometry={GEO.plane} material={m} scale={[w, 1, 0.07]} position={[cx, 0.005, b.minZ + i]} renderOrder={2} />
      <mesh geometry={GEO.plane} material={m} scale={[w, 1, 0.07]} position={[cx, 0.005, b.maxZ - i]} renderOrder={2} />
      <mesh geometry={GEO.plane} material={m} scale={[0.07, 1, d]} position={[b.minX + i, 0.005, cz]} renderOrder={2} />
      <mesh geometry={GEO.plane} material={m} scale={[0.07, 1, d]} position={[b.maxX - i, 0.005, cz]} renderOrder={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Walls & door
// ---------------------------------------------------------------------------

function Windows({ from, to, fixed, axis, pal, tall }: { from: number; to: number; fixed: number; axis: 'x' | 'z'; pal: StagePalette; tall?: boolean }) {
  const len = to - from
  const n = Math.max(1, Math.floor(len / (CELL * 1.6)))
  const h = tall ? WALL_HEIGHT * 0.8 : 0.7
  const y = tall ? WALL_HEIGHT * 0.48 : 1.3
  const items = []
  for (let i = 0; i < n; i++) {
    const c = from + (len / n) * (i + 0.5)
    const wlen = tall ? (len / n) * 0.9 : Math.min(CELL * 1.1, (len / n) * 0.7)
    const pos: V3 = axis === 'x' ? [c, y, fixed] : [fixed, y, c]
    const size: V3 = axis === 'x' ? [wlen, h, WALL_THICKNESS * 1.3] : [WALL_THICKNESS * 1.3, h, wlen]
    const frame: V3 = axis === 'x' ? [wlen + 0.08, h + 0.08, WALL_THICKNESS * 1.1] : [WALL_THICKNESS * 1.1, h + 0.08, wlen + 0.08]
    items.push(
      <group key={i}>
        <B s={frame} p={pos} c={pal.wallTrim} shadow={false} />
        <mesh geometry={GEO.box} material={glassMat(PROP_COLORS.glass, 0.85)} scale={size} position={pos} />
      </group>,
    )
  }
  return <>{items}</>
}

/** The painted inner faces of the back wall (around the door; not on the glass street front) and the left wall. */
function WallFaces({ layout, pal, H, dl, dr, paint }: { layout: OfficeLayout; pal: StagePalette; H: number; dl: number; dr: number; paint: Paint }) {
  const b = layout.bounds
  const st = layout.stage
  const back = wallTexture(st, 'back', paint.back ?? pal.wall, pal.accent, pal.wallTrim)
  const left = wallTexture(st, 'left', paint.left ?? pal.wall, pal.accent, pal.wallTrim)
  const T = WALL_TILE
  const z = b.minZ + 0.002
  const x = b.minX + 0.002
  const backSeg = (x0: number, x1: number, y0: number, y1: number) => ({
    corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]] as V3[],
    uvs: [[x0 / T, y0 / H], [x1 / T, y0 / H], [x1 / T, y1 / H], [x0 / T, y1 / H]] as [number, number][],
  })
  const segs = st === 5 ? [] : [backSeg(b.minX, dl, 0, H), backSeg(dr, b.maxX, 0, H), backSeg(dl, dr, 1.35, H)]
  return (
    <group>
      {back && segs.map((sg, i) => <Surface key={i} tex={back} corners={sg.corners} uvs={sg.uvs} />)}
      {left && (
        <Surface
          tex={left}
          corners={[[x, 0, b.maxZ], [x, 0, b.minZ], [x, H, b.minZ], [x, H, b.maxZ]]}
          uvs={[[-b.maxZ / T, 0], [-b.minZ / T, 0], [-b.minZ / T, 1], [-b.maxZ / T, 1]]}
        />
      )}
    </group>
  )
}

/** Wall colours the player painted (grid §6), per wall; absent = the stage's own. */
type Paint = { back?: string; left?: string }

function Walls({ layout, pal, paint }: { layout: OfficeLayout; pal: StagePalette; paint: Paint }) {
  const b = layout.bounds
  const t = WALL_THICKNESS
  const H = layout.stage === 5 ? WALL_HEIGHT * 1.15 : WALL_HEIGHT
  const door = layout.door
  const dl = door.pos[0] - door.width / 2
  const dr = door.pos[0] + door.width / 2
  const backZ = b.minZ - t / 2
  const leftX = b.minX - t / 2
  const glassy = layout.stage === 5
  const wallC = paint.back ?? pal.wall
  const leftC = paint.left ?? pal.wall
  return (
    <group>
      {/* back wall (−z) with door gap */}
      {glassy ? (
        <>
          <mesh geometry={GEO.box} material={glassMat(PROP_COLORS.glassWall, 0.45)} scale={[dl - b.minX + t, H, t]} position={[(b.minX - t + dl) / 2, H / 2, backZ]} />
          <mesh geometry={GEO.box} material={glassMat(PROP_COLORS.glassWall, 0.45)} scale={[b.maxX - dr, H, t]} position={[(dr + b.maxX) / 2, H / 2, backZ]} />
        </>
      ) : (
        <>
          <B s={[dl - b.minX + t, H, t]} p={[(b.minX - t + dl) / 2, H / 2, backZ]} c={wallC} />
          <B s={[b.maxX - dr, H, t]} p={[(dr + b.maxX) / 2, H / 2, backZ]} c={wallC} />
        </>
      )}
      <B s={[door.width, H - 1.35, t]} p={[door.pos[0], 1.35 + (H - 1.35) / 2, backZ]} c={wallC} />
      <B s={[b.maxX - b.minX + t, 0.08, t + 0.04]} p={[(b.minX + b.maxX - t) / 2, H, backZ]} c={pal.wallTrim} shadow={false} />
      {/* left wall (−x) */}
      <B s={[t, H, b.maxZ - b.minZ]} p={[leftX, H / 2, (b.minZ + b.maxZ) / 2]} c={leftC} />
      <B s={[t + 0.04, 0.08, b.maxZ - b.minZ]} p={[leftX, H, (b.minZ + b.maxZ) / 2]} c={pal.wallTrim} shadow={false} />
      {/* skirting on the open front sides */}
      <B s={[b.maxX - b.minX, 0.1, 0.06]} p={[(b.minX + b.maxX) / 2, 0.05, b.maxZ + 0.03]} c={pal.wallTrim} shadow={false} />
      <B s={[0.06, 0.1, b.maxZ - b.minZ]} p={[b.maxX + 0.03, 0.05, (b.minZ + b.maxZ) / 2]} c={pal.wallTrim} shadow={false} />
      <WallFaces layout={layout} pal={pal} H={H} dl={dl} dr={dr} paint={paint} />
      {/* door frame + open leaf */}
      <B s={[0.07, 1.4, t + 0.06]} p={[dl - 0.035, 0.7, backZ]} c={pal.wallTrim} />
      <B s={[0.07, 1.4, t + 0.06]} p={[dr + 0.035, 0.7, backZ]} c={pal.wallTrim} />
      <B s={[door.width + 0.14, 0.07, t + 0.06]} p={[door.pos[0], 1.38, backZ]} c={pal.wallTrim} />
      <group position={[dl, 0, backZ + t / 2]} rotation={[0, -1.45, 0]}>
        <B s={[door.width * 0.95, 1.32, 0.05]} p={[door.width * 0.475, 0.66, 0]} c={pal.accent} />
        <B s={[0.04, 0.04, 0.08]} p={[door.width * 0.85, 0.65, 0.04]} c={PROP_COLORS.brass} shadow={false} />
      </group>
      {/* doormat outside-in */}
      <mesh geometry={GEO.plane} material={decalMat(PROP_COLORS.doormat)} scale={[door.width * 0.9, 1, 0.45]} position={[door.pos[0], 0.008, b.minZ + 0.3]} renderOrder={1} />
      {layout.stage >= 1 && layout.stage <= 4 && <Windows from={b.minZ + CELL * 0.4} to={b.maxZ - CELL * 0.4} fixed={leftX} axis="z" pal={pal} />}
      {layout.stage >= 2 && layout.stage <= 4 && <Windows from={b.minX + CELL * 0.4} to={dl - CELL * 0.4} fixed={backZ} axis="x" pal={pal} />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Stage decor
// ---------------------------------------------------------------------------

function GarageDecor({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  const d = b.maxZ - b.minZ
  const doorW = Math.min(d * 0.7, CELL * 2.6)
  const cz = (b.minZ + b.maxZ) / 2 + d * 0.08
  const x = b.minX + 0.02
  const slats = []
  for (let i = 0; i < 9; i++) slats.push(<B key={i} s={[0.05, 0.16, doorW]} p={[x + 0.02, 0.15 + i * 0.19, cz]} c={i % 2 ? pal.accent : PROP_COLORS.garageSlat} shadow={false} />)
  return (
    <group>
      {/* roll-up garage door on the left wall */}
      <B s={[0.08, 1.85, doorW + 0.16]} p={[x - 0.01, 0.92, cz]} c={PROP_COLORS.garageFrame} shadow={false} />
      {slats}
      {/* metal shelf with boxes in the back-left corner cell (a fixture: layout.stageFixtures) */}
      <group position={[b.minX + CELL * 0.5, 0, b.minZ + 0.25]}>
        <B s={[0.05, 1.3, 0.05]} p={[-0.55, 0.65, -0.12]} c={PROP_COLORS.metal} />
        <B s={[0.05, 1.3, 0.05]} p={[0.55, 0.65, -0.12]} c={PROP_COLORS.metal} />
        <B s={[0.05, 1.3, 0.05]} p={[-0.55, 0.65, 0.12]} c={PROP_COLORS.metal} />
        <B s={[0.05, 1.3, 0.05]} p={[0.55, 0.65, 0.12]} c={PROP_COLORS.metal} />
        {[0.3, 0.75, 1.2].map((y) => (
          <B key={y} s={[1.15, 0.03, 0.3]} p={[0, y, 0]} c={PROP_COLORS.shelfBoard} />
        ))}
        <B s={[0.3, 0.22, 0.24]} p={[-0.3, 0.43, 0]} c={PROP_COLORS.cardboard} />
        <B s={[0.24, 0.18, 0.2]} p={[0.05, 0.41, 0]} c={PROP_COLORS.cardboardLight} />
        <B s={[0.36, 0.26, 0.24]} p={[0.2, 0.9, 0]} c={PROP_COLORS.cardboard} />
        <B s={[0.2, 0.3, 0.12]} p={[-0.3, 1.36, 0]} c={PROP_COLORS.redBox} />
      </group>
      {/* hanging bulb */}
      <group position={[0, 2.05, 0]}>
        <B s={[0.01, 0.35, 0.01]} p={[0, 0.17, 0]} c={PROP_COLORS.cord} shadow={false} />
        <mesh geometry={GEO.sphere} material={glowMat(PROP_COLORS.bulb, 1.2)} scale={[0.14, 0.16, 0.14]} />
      </group>
      {/* bicycle-ish tyres leaning on the wall */}
      <mesh geometry={GEO.cyl} material={mat(PROP_COLORS.tire)} scale={[0.5, 0.06, 0.5]} rotation={[Math.PI / 2, 0, 0.1]} position={[b.maxX - CELL * 0.35, 0.26, b.minZ + 0.1]} castShadow />
    </group>
  )
}

function Columns({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  // Columns standing in a locked ring recede with it: the trim colour pulled toward the locked tone. The locked tone
  // itself rendered as unlit black boxes beside the blue pillars (QA: read as a missing material, not "locked").
  const open = layout.bands.filter((b) => b.unlocked).at(-1)?.box
  const inOpen = (x: number, z: number) => !!open && x >= open.minX && x <= open.maxX && z >= open.minZ && z <= open.maxZ
  const lockedPost = useMemo(() => `#${new THREE.Color(pal.wallTrim).lerp(new THREE.Color(pal.locked), 0.4).getHexString()}`, [pal])
  return (
    <group>
      {layout.columns.map(([x, z], i) => (
        <B key={i} s={[0.22, WALL_HEIGHT, 0.22]} p={[x, WALL_HEIGHT / 2, z]} c={inOpen(x, z) ? pal.wallTrim : lockedPost} />
      ))}
    </group>
  )
}

function Stairs({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  const steps = []
  for (let i = 0; i < 8; i++) steps.push(<B key={i} s={[0.8, 0.2 * (i + 1), 0.28]} p={[b.minX + 0.5, 0.1 * (i + 1), b.minZ + 0.4 + i * 0.28]} c={i % 2 ? pal.floorAlt : pal.floor} />)
  return (
    <group>
      {steps}
      <B s={[0.9, 0.08, STAIRS_LEN - 2.2]} p={[b.minX + 0.5, 1.64, b.minZ + 2.2 + (STAIRS_LEN - 2.2) / 2]} c={pal.floor} />
      <B s={[0.04, 0.5, STAIRS_LEN]} p={[b.minX + 0.92, 1.9, b.minZ + STAIRS_LEN / 2]} c={pal.wallTrim} />
    </group>
  )
}

function ElevatorDecor({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  const b = layout.bounds
  return (
    <group position={[b.minX + CELL * 1.2, 0, b.minZ + 0.05]}>
      <B s={[1.1, 1.6, 0.06]} p={[0, 0.8, 0]} c={PROP_COLORS.elevator} />
      <B s={[0.02, 1.5, 0.08]} p={[0, 0.75, 0.01]} c={PROP_COLORS.metal} shadow={false} />
      <mesh geometry={GEO.sphere} material={glowMat(pal.accent, 0.8)} scale={[0.07, 0.07, 0.07]} position={[0.7, 1.0, 0.04]} />
    </group>
  )
}

function CampusDecor({ layout }: { layout: OfficeLayout }) {
  const b = layout.bounds
  // The trees around the campus are the lot's (Surroundings).
  return (
    <group>
      {/* unicorn statue */}
      <group position={[b.maxX + CELL * 0.8, 0, b.maxZ + CELL * 0.8]}>
        <B s={[0.8, 0.3, 0.8]} p={[0, 0.15, 0]} c={PROP_COLORS.statueBase} />
        <mesh geometry={GEO.sphere} material={mat(PROP_COLORS.statue)} scale={[0.5, 0.4, 0.8]} position={[0, 0.6, 0]} castShadow />
        <mesh geometry={GEO.sphere} material={mat(PROP_COLORS.statue)} scale={[0.3, 0.32, 0.36]} position={[0, 0.9, 0.35]} castShadow />
        <mesh geometry={GEO.cone} material={glowMat(PROP_COLORS.statueHorn, 0.5)} scale={[0.08, 0.3, 0.08]} position={[0, 1.15, 0.45]} rotation={[0.5, 0, 0]} />
        <mesh geometry={GEO.sphere} material={mat(PROP_COLORS.statueMane)} scale={[0.14, 0.3, 0.3]} position={[0, 0.95, 0.12]} />
      </group>
    </group>
  )
}

function StageDecor({ layout, pal }: { layout: OfficeLayout; pal: StagePalette }) {
  switch (layout.stage) {
    case 0:
      return <GarageDecor layout={layout} pal={pal} />
    // Pre-seed / Seed: their plants, banner, prints, clock and plaque are starter decor pieces now (Decor.tsx).
    case 1:
    case 2:
      return null
    case 3:
      return <Columns layout={layout} pal={pal} />
    case 4:
      return (
        <>
          <Columns layout={layout} pal={pal} />
          <Stairs layout={layout} pal={pal} />
        </>
      )
    case 5:
      return (
        <>
          <Columns layout={layout} pal={pal} />
          <ElevatorDecor layout={layout} pal={pal} />
        </>
      )
    default:
      return <CampusDecor layout={layout} />
  }
}

// ---------------------------------------------------------------------------
// Rings: locked = dark + dust, opening = renovation (brighten + rising sparks)
// ---------------------------------------------------------------------------

const RENOVATE_MS = 1800

function Dust({ rects, count, color, rising }: { rects: Box[]; count: number; color: string; rising?: { start: number } }) {
  // Key on the rect coordinates, not the array identity, so a re-render never rebuilds the geometry.
  const rectKey = rects.map((r) => `${r.minX},${r.minZ},${r.maxX},${r.maxZ}`).join(';')
  const base = useMemo(() => {
    const arr = new Float32Array(count * 3)
    const area = rects.reduce((a, r) => a + (r.maxX - r.minX) * (r.maxZ - r.minZ), 0) || 1
    let i = 0
    for (const r of rects) {
      const n = Math.round((count * ((r.maxX - r.minX) * (r.maxZ - r.minZ))) / area)
      for (let k = 0; k < n && i < count; k++, i++) {
        arr[i * 3] = r.minX + (r.maxX - r.minX) * hash01(`d${r.minX}`, k * 3 + 1)
        arr[i * 3 + 1] = 0.05 + 0.9 * hash01(`d${r.minZ}`, k * 3 + 2)
        arr[i * 3 + 2] = r.minZ + (r.maxZ - r.minZ) * hash01(`d${r.maxX}`, k * 3 + 3)
      }
    }
    return arr.subarray(0, i * 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rectKey, count])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base), 3))
    return g
  }, [base])
  const material = useMemo(() => new THREE.PointsMaterial({ color, size: rising ? 5 : 3, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false }), [color, rising])
  // Objects passed as props are not disposed by R3F: free the GPU buffers when they are replaced/unmounted.
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ clock }) => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const a = pos.array as Float32Array
    const t = clock.elapsedTime
    const prog = rising ? Math.min(1, (performance.now() - rising.start) / RENOVATE_MS) : 0
    for (let i = 0; i < a.length; i += 3) {
      const ph = i * 0.37
      a[i] = base[i]! + Math.sin(t * 0.4 + ph) * 0.06
      a[i + 1] = rising ? base[i + 1]! * 0.4 + prog * (1.2 + (i % 7) * 0.2) : base[i + 1]! + Math.sin(t * 0.6 + ph * 1.3) * 0.08
      a[i + 2] = base[i + 2]! + Math.cos(t * 0.35 + ph) * 0.06
    }
    pos.needsUpdate = true
    if (rising) material.opacity = 0.9 * (1 - prog)
  })
  return <points geometry={geo} material={material} />
}

function Clutter({ rects, color }: { rects: Box[]; color: string }) {
  const root = useRef<THREE.Group>(null)
  useBake(root, [rects, color], { tag: 'clutter' })
  return (
    <group ref={root}>
      {rects.map((r, i) => {
        const w = r.maxX - r.minX
        const d = r.maxZ - r.minZ
        if (w < 0.8 || d < 0.8) return null
        const x = r.minX + w * (0.2 + 0.6 * hash01('c', i))
        const z = r.minZ + d * (0.2 + 0.6 * hash01('c', i + 9))
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, hash01('c', i + 3) * 1.5, 0]}>
            <B s={[0.4, 0.3, 0.34]} p={[0, 0.15, 0]} c={color} />
            <B s={[0.3, 0.22, 0.26]} p={[0.1, 0.41, 0.02]} c={color} />
            <mesh geometry={GEO.sphere} material={mat(PROP_COLORS.dustSheet)} scale={[0.6, 0.35, 0.5]} position={[-0.5, 0.15, 0.1]} castShadow />
          </group>
        )
      })}
    </group>
  )
}

function RingBandView({ band, pal }: { band: RingBand; pal: StagePalette }) {
  const wasLocked = useRef(!band.unlocked)
  const [renovating, setRenovating] = useState<{ start: number } | null>(null)

  // Locked → unlocked transition starts the renovation animation (covers ringOpened events too).
  useEffect(() => {
    if (wasLocked.current && band.unlocked) {
      const start = performance.now()
      mood.renovateUntil = start + RENOVATE_MS
      setRenovating({ start })
    }
    wasLocked.current = !band.unlocked
  }, [band.unlocked])
  const overlayMat = useMemo(() => new THREE.MeshBasicMaterial({ color: pal.locked, transparent: true, opacity: LOCKED_OPACITY, depthWrite: false }), [pal.locked])
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PASTEL.lemon, transparent: true, opacity: 0, depthWrite: false }), [])
  useEffect(
    () => () => {
      overlayMat.dispose()
      flashMat.dispose()
    },
    [overlayMat, flashMat],
  )


  useFrame(() => {
    if (!renovating) {
      overlayMat.opacity = band.unlocked ? 0 : LOCKED_OPACITY
      return
    }
    const k = Math.min(1, (performance.now() - renovating.start) / RENOVATE_MS)
    overlayMat.opacity = LOCKED_OPACITY * (1 - k)
    flashMat.opacity = Math.sin(k * Math.PI) * 0.45
    if (k >= 1) setRenovating(null)
  })

  const showOverlay = !band.unlocked || renovating
  if (!showOverlay || band.ring === 0) return null
  return (
    <group>
      {band.rects.map((r, i) => (
        <group key={i}>
          <mesh geometry={GEO.plane} material={overlayMat} scale={[r.maxX - r.minX, 1, r.maxZ - r.minZ]} position={[(r.minX + r.maxX) / 2, 0.03, (r.minZ + r.maxZ) / 2]} renderOrder={3} />
          {renovating && (
            <mesh geometry={GEO.plane} material={flashMat} scale={[r.maxX - r.minX, 1, r.maxZ - r.minZ]} position={[(r.minX + r.maxX) / 2, 0.04, (r.minZ + r.maxZ) / 2]} renderOrder={4} />
          )}
        </group>
      ))}
      {!band.unlocked && <Clutter rects={band.rects} color={PROP_COLORS.clutter} />}
      {!band.unlocked && <Dust rects={band.rects} count={Math.min(260, band.rects.length * 50)} color={PROP_COLORS.dust} />}
      {renovating && <Dust rects={band.rects} count={160} color={PASTEL.lemon} rising={renovating} />}
    </group>
  )
}

/** Yellow tape on the border between the open office and the first locked ring. */
function LockTape({ box }: { box: Box }) {
  const b = box
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  return (
    <group>
      <B s={[w, 0.012, 0.05]} p={[cx, 0.035, b.maxZ]} c={PASTEL.lemon} shadow={false} />
      <B s={[w, 0.012, 0.05]} p={[cx, 0.035, b.minZ]} c={PASTEL.lemon} shadow={false} />
      <B s={[0.05, 0.012, d]} p={[b.maxX, 0.035, cz]} c={PASTEL.lemon} shadow={false} />
      <B s={[0.05, 0.012, d]} p={[b.minX, 0.035, cz]} c={PASTEL.lemon} shadow={false} />
    </group>
  )
}

// ---------------------------------------------------------------------------

/**
 * What the shell draws from the layout: stage, bounds, door, ring locks, columns. A hire or a moved desk changes the
 * layout object (seats are walk obstacles) but not this, so the shell never rebakes for them (grid §7).
 */
export function shellKey(layout: OfficeLayout): string {
  const b = layout.bounds
  return `${layout.stage}|${b.minX},${b.maxX},${b.minZ},${b.maxZ}|${layout.door.pos.join(',')}|${layout.bands.map((x) => `${x.ring}${x.unlocked ? 1 : 0}`).join('')}|${layout.columns.map((c) => c.join(',')).join(';')}`
}

export function Office({ lowPower = false }: { lowPower?: boolean }) {
  const live = useLayout()
  const key = shellKey(live)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => live, [key])
  const pal = stagePalette(layout.stage as StageIndex)
  const walls = useDecorView().walls
  const paint = paintOf(walls)
  const paintKey = `${paint.back ?? ''}|${paint.left ?? ''}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paintMemo = useMemo(() => paint, [paintKey])
  const lockedIdx = layout.bands.findIndex((b) => !b.unlocked)
  const tapeBox = lockedIdx > 0 ? layout.bands[lockedIdx - 1]!.box : null
  // Floor, walls, stage decor and tape are a pure function of the shell key and the paint: baked into a few draw calls.
  const statics = useRef<THREE.Group>(null)
  useBake(statics, [key, paintKey, lowPower], { tag: 'shell' })
  return (
    <group>
      <group ref={statics}>
        <Floor layout={layout} pal={pal} />
        {layout.stage !== 6 && <Walls layout={layout} pal={pal} paint={paintMemo} />}
        <StageDecor layout={layout} pal={pal} />
        {tapeBox && <LockTape box={tapeBox} />}
      </group>
      {layout.bands.map((band) => (
        <RingBandView key={`${layout.stage}:${band.ring}`} band={band} pal={pal} />
      ))}
    </group>
  )
}
