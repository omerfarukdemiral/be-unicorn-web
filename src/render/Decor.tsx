// Office decor (grid design §6–7): separators, floor pieces and wall pieces as low-poly models, all under ONE group
// with a single bake (vertex colours + one glow bucket + one glass bucket), keyed on the decor signature only: a hire,
// a purchase or a desk move never rebakes it; a phone builds it once on load, a stage move or Bitti. Paint is not
// here: it recolours the walls in the shell bake (Office.tsx). Models face +z (their front) at rotation 0; a wall
// piece's back lies on the wall.
import { memo, useRef } from 'react'
import * as THREE from 'three'
import { decorCells } from '../engine/layout'
import type { DecorPiece, WallPiece } from '../engine/types'
import { PAINT_KIND } from '../content/decor'
import { useBake } from './bake'
import { gridToWorld, yawOf } from './constants'
import type { Box } from './layout'
import { PASTEL, PROP_COLORS } from './palette'
import { GEO, glassMat, glowMat, mat } from './resources'
import { useDecorView, useLayout } from './sceneRegistry'

type V3 = [number, number, number]

function B({ s, p, c, r }: { s: V3; p: V3; c: string; r?: V3 }) {
  return <mesh geometry={GEO.box} material={mat(c)} scale={s} position={p} rotation={r} castShadow receiveShadow />
}
function Cyl({ s, p, c, r }: { s: V3; p: V3; c: string; r?: V3 }) {
  return <mesh geometry={GEO.cyl} material={mat(c)} scale={s} position={p} rotation={r} castShadow receiveShadow />
}
function Ball({ s, p, c }: { s: V3; p: V3; c: string }) {
  return <mesh geometry={GEO.sphere} material={mat(c)} scale={s} position={p} castShadow receiveShadow />
}
function Glow({ s, p, c, i = 0.9, geo = GEO.box }: { s: V3; p: V3; c: string; i?: number; geo?: THREE.BufferGeometry }) {
  return <mesh geometry={geo} material={glowMat(c, i)} scale={s} position={p} />
}

const WOOD = '#b9875a'
const WOOD_DARK = '#8a5f3c'
const STEEL = '#8a8f99'
const MARBLE = '#ece8e2'

/** A floor piece's model in its own frame (cell centre on the floor, front +z). */
export function FloorModel({ kind }: { kind: string }) {
  switch (kind) {
    case 'panel':
      return (
        <group>
          <B s={[1.3, 0.85, 0.07]} p={[0, 0.5, 0]} c="#c3cbd6" />
          <B s={[1.32, 0.04, 0.09]} p={[0, 0.94, 0]} c={STEEL} />
          <B s={[0.08, 0.06, 0.36]} p={[-0.56, 0.03, 0]} c={STEEL} />
          <B s={[0.08, 0.06, 0.36]} p={[0.56, 0.03, 0]} c={STEEL} />
        </group>
      )
    case 'plantRow':
      return (
        <group>
          <B s={[1.3, 0.32, 0.34]} p={[0, 0.16, 0]} c="#b07a4f" />
          {[-0.45, -0.15, 0.15, 0.45].map((x, i) => (
            <Ball key={x} s={[0.36, 0.42 + (i % 2) * 0.1, 0.36]} p={[x, 0.5 + (i % 2) * 0.04, 0]} c={i % 2 ? PROP_COLORS.leaf : '#5ea860'} />
          ))}
        </group>
      )
    case 'glass':
      return (
        <group>
          <B s={[1.32, 0.08, 0.09]} p={[0, 0.04, 0]} c="#6b7280" />
          <B s={[1.32, 0.05, 0.07]} p={[0, 1.22, 0]} c="#6b7280" />
          <B s={[0.05, 1.22, 0.07]} p={[-0.64, 0.62, 0]} c="#6b7280" />
          <B s={[0.05, 1.22, 0.07]} p={[0.64, 0.62, 0]} c="#6b7280" />
          <mesh geometry={GEO.box} material={glassMat(PROP_COLORS.glass, 0.45)} scale={[1.24, 1.12, 0.03]} position={[0, 0.64, 0]} />
        </group>
      )
    case 'slats':
      return (
        <group>
          <B s={[1.32, 0.06, 0.22]} p={[0, 0.03, 0]} c={WOOD_DARK} />
          <B s={[1.32, 0.05, 0.12]} p={[0, 1.3, 0]} c={WOOD_DARK} />
          {Array.from({ length: 9 }, (_, i) => (
            <B key={i} s={[0.07, 1.25, 0.08]} p={[-0.6 + i * 0.15, 0.68, 0]} c={WOOD} />
          ))}
        </group>
      )
    case 'marblePlanter':
      return (
        <group>
          <B s={[1.32, 0.46, 0.44]} p={[0, 0.23, 0]} c={MARBLE} />
          <B s={[1.36, 0.04, 0.48]} p={[0, 0.47, 0]} c="#d8d1c6" />
          <B s={[1.2, 0.02, 0.4]} p={[0, 0.49, 0]} c="#6b4f36" />
          {[-0.42, 0, 0.42].map((x) => (
            <mesh key={x} geometry={GEO.cone} material={mat('#4f8f55')} scale={[0.34, 0.9, 0.34]} position={[x, 0.95, 0]} castShadow receiveShadow />
          ))}
        </group>
      )
    case 'plantPot':
      // The coworking corner plant (it was fixed stage decor before the free grid).
      return (
        <group>
          <Cyl s={[0.26, 0.26, 0.26]} p={[0, 0.13, 0]} c={PROP_COLORS.pot} />
          <Ball s={[0.4, 0.5, 0.4]} p={[0, 0.5, 0]} c={PROP_COLORS.leaf} />
        </group>
      )
    case 'bin':
      return (
        <group>
          <Cyl s={[0.3, 0.42, 0.3]} p={[0, 0.21, 0]} c="#7b8794" />
          <Cyl s={[0.33, 0.04, 0.33]} p={[0, 0.43, 0]} c="#5c6672" />
        </group>
      )
    case 'lamp':
      return (
        <group>
          <Cyl s={[0.32, 0.04, 0.32]} p={[0, 0.02, 0]} c="#3e3c48" />
          <Cyl s={[0.04, 1.45, 0.04]} p={[0, 0.74, 0]} c="#3e3c48" />
          <Glow s={[0.38, 0.28, 0.38]} p={[0, 1.55, 0]} c="#ffe2a8" i={0.7} geo={GEO.cyl} />
        </group>
      )
    case 'whiteboard':
      return (
        <group>
          <B s={[0.05, 1.5, 0.05]} p={[-0.52, 0.75, 0]} c={STEEL} />
          <B s={[0.05, 1.5, 0.05]} p={[0.52, 0.75, 0]} c={STEEL} />
          <B s={[0.3, 0.04, 0.4]} p={[-0.52, 0.02, 0]} c={STEEL} />
          <B s={[0.3, 0.04, 0.4]} p={[0.52, 0.02, 0]} c={STEEL} />
          <B s={[1.04, 0.68, 0.04]} p={[0, 1.1, 0]} c="#f6f7f9" />
          <B s={[0.4, 0.03, 0.01]} p={[-0.2, 1.25, 0.025]} c={PASTEL.sky} />
          <B s={[0.3, 0.03, 0.01]} p={[0.1, 1.1, 0.025]} c={PASTEL.rose} />
          <B s={[0.5, 0.03, 0.01]} p={[-0.05, 0.95, 0.025]} c={PASTEL.ink600} />
        </group>
      )
    case 'rug':
      return (
        <group>
          <B s={[2.5, 0.016, 2.5]} p={[0, 0.008, 0]} c="#c98f7a" />
          <B s={[2.2, 0.018, 2.2]} p={[0, 0.01, 0]} c="#f1d9b5" />
          <B s={[1.4, 0.02, 1.4]} p={[0, 0.012, 0]} c="#9cb8d8" />
        </group>
      )
    case 'sign':
      return (
        <group>
          <B s={[0.5, 0.04, 0.4]} p={[0, 0.02, 0]} c="#3e3c48" />
          <B s={[0.05, 1.1, 0.05]} p={[0, 0.57, 0]} c="#3e3c48" />
          <B s={[0.62, 0.42, 0.05]} p={[0, 1.2, 0]} c={PASTEL.lilac} />
          <B s={[0.44, 0.06, 0.01]} p={[0, 1.26, 0.03]} c="#ffffff" />
          <B s={[0.3, 0.04, 0.01]} p={[0, 1.14, 0.03]} c="#ffffff" />
        </group>
      )
    case 'arcade':
      return (
        <group>
          <B s={[0.62, 1.55, 0.55]} p={[0, 0.78, -0.05]} c="#5a3fd1" />
          <B s={[0.66, 0.08, 0.6]} p={[0, 1.58, -0.05]} c="#2b2a33" />
          <B s={[0.56, 0.06, 0.24]} p={[0, 0.86, 0.3]} c="#2b2a33" />
          <Glow s={[0.46, 0.36, 0.02]} p={[0, 1.18, 0.23]} c="#7fe0ff" i={0.8} />
          <Glow s={[0.5, 0.12, 0.02]} p={[0, 1.48, 0.23]} c="#ff94ae" i={0.9} />
        </group>
      )
    case 'sculpture':
      return (
        <group>
          <B s={[0.64, 0.86, 0.64]} p={[0, 0.43, 0]} c="#fbf8f2" />
          <B s={[0.7, 0.04, 0.7]} p={[0, 0.88, 0]} c={PROP_COLORS.brass} />
          <Ball s={[0.36, 0.36, 0.36]} p={[0, 1.08, 0]} c={PROP_COLORS.brass} />
          <mesh geometry={GEO.cone} material={mat(PROP_COLORS.brass)} scale={[0.22, 0.5, 0.22]} position={[0.05, 1.45, 0]} rotation={[0, 0, -0.3]} castShadow receiveShadow />
        </group>
      )
    default:
      return <B s={[0.5, 0.5, 0.5]} p={[0, 0.25, 0]} c={PASTEL.sand} />
  }
}

/** A wall piece's model: its back on the wall plane (z = 0), facing +z, centred on y = 0 (hung at WALL_Y). */
export function WallModel({ kind }: { kind: string }) {
  switch (kind) {
    case 'poster':
      return (
        <group>
          <B s={[0.5, 0.66, 0.02]} p={[0, 0, 0.01]} c="#f4f1ea" />
          <B s={[0.42, 0.42, 0.01]} p={[0, 0.07, 0.025]} c={PASTEL.peach} />
          <B s={[0.3, 0.05, 0.01]} p={[0, -0.22, 0.025]} c={PASTEL.ink600} />
        </group>
      )
    case 'banner':
      // The coworking striped banner (it was fixed stage decor before the free grid).
      return (
        <group>
          {[PASTEL.mint, PASTEL.lemon, PASTEL.rose, PASTEL.sky].map((c, i) => (
            <B key={c} s={[0.28, 0.5, 0.03]} p={[-0.45 + i * 0.3, -0.25, 0.015]} c={c} />
          ))}
        </group>
      )
    case 'clock':
      return (
        <group>
          <Cyl s={[0.32, 0.03, 0.32]} p={[0, 0, 0.015]} c="#3e3c48" r={[Math.PI / 2, 0, 0]} />
          <Cyl s={[0.27, 0.03, 0.27]} p={[0, 0, 0.03]} c="#fbf8f2" r={[Math.PI / 2, 0, 0]} />
          <B s={[0.02, 0.12, 0.01]} p={[0, 0.06, 0.05]} c="#2b2a33" />
          <B s={[0.09, 0.02, 0.01]} p={[0.045, 0, 0.05]} c="#2b2a33" />
        </group>
      )
    case 'plaque':
      return <B s={[0.4, 0.16, 0.02]} p={[0, 0, 0.01]} c={PROP_COLORS.brass} />
    case 'print':
      return (
        <group>
          <B s={[0.6, 0.36, 0.03]} p={[0, 0, 0.015]} c="#e8c46a" />
          <B s={[0.5, 0.26, 0.01]} p={[0, 0, 0.035]} c="#9cc9f5" />
        </group>
      )
    case 'neon':
      return (
        <group>
          <B s={[0.9, 0.4, 0.02]} p={[0, 0, 0.01]} c="#2b2a33" />
          <Glow s={[0.7, 0.05, 0.03]} p={[0, 0.1, 0.035]} c="#ff6fb1" i={1.2} />
          <Glow s={[0.5, 0.05, 0.03]} p={[-0.05, -0.04, 0.035]} c="#ff6fb1" i={1.2} />
          <Glow s={[0.05, 0.2, 0.03]} p={[0.3, -0.02, 0.035]} c="#ff6fb1" i={1.2} />
        </group>
      )
    case 'canvas':
      return (
        <group>
          <B s={[1.2, 0.56, 0.04]} p={[0, 0, 0.02]} c="#fbf8f2" />
          <B s={[0.5, 0.42, 0.01]} p={[-0.3, 0.02, 0.045]} c={PASTEL.sky} />
          <B s={[0.36, 0.3, 0.01]} p={[0.2, 0.06, 0.045]} c={PASTEL.peach} />
          <B s={[0.3, 0.16, 0.01]} p={[0.35, -0.14, 0.045]} c={PASTEL.lilac} />
        </group>
      )
    case 'goldRecords':
      return (
        <group>
          <B s={[1.3, 0.56, 0.03]} p={[0, 0, 0.015]} c="#2b2a33" />
          {[-0.42, 0, 0.42].map((x) => (
            <group key={x}>
              <Cyl s={[0.34, 0.02, 0.34]} p={[x, 0.02, 0.04]} c="#f2c94c" r={[Math.PI / 2, 0, 0]} />
              <Cyl s={[0.1, 0.022, 0.1]} p={[x, 0.02, 0.045]} c="#b0825c" r={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
          <B s={[1.0, 0.05, 0.01]} p={[0, -0.22, 0.035]} c={PROP_COLORS.brass} />
        </group>
      )
    default:
      return <B s={[0.4, 0.4, 0.02]} p={[0, 0, 0.01]} c={PASTEL.sand} />
  }
}

/** Height of a wall piece's centre: above the window row (windows top out at y 1.69), under the 2.2 m ceiling line. */
export const WALL_Y = 1.92

/** World centre and yaw of a floor piece (a 2×2 rug is centred on its four cells). */
export function floorPose(p: Pick<DecorPiece, 'kind' | 'pos' | 'rotation'>): { pos: [number, number]; yaw: number } {
  const cells = decorCells(p)
  let x = 0
  let z = 0
  for (const c of cells) {
    const w = gridToWorld(c)
    x += w[0]
    z += w[1]
  }
  return { pos: [x / cells.length, z / cells.length], yaw: yawOf(p.rotation) }
}

/** World pose of a wall segment: on the back wall (facing +z) or the left wall (facing +x). */
export function wallPose(bounds: Box, wall: WallPiece['wall'], seg: number): { pos: V3; yaw: number } {
  const [wx, wz] = gridToWorld({ x: seg, z: seg })
  return wall === 'back' ? { pos: [wx, WALL_Y, bounds.minZ + 0.005], yaw: 0 } : { pos: [bounds.minX + 0.005, WALL_Y, wz], yaw: Math.PI / 2 }
}

const FloorPiece = memo(function FloorPiece({ piece }: { piece: DecorPiece }) {
  const { pos, yaw } = floorPose(piece)
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, yaw, 0]}>
      <FloorModel kind={piece.kind} />
    </group>
  )
})

/** Every decor piece of the office, one bake (grid §7: about +3 draws at the cap, glass panes included). */
export function DecorLayer() {
  const view = useDecorView()
  const bounds = useLayout().bounds
  const bkey = `${bounds.minX},${bounds.minZ}`
  const root = useRef<THREE.Group>(null)
  useBake(root, [view.key, bkey], { shadow: 'all', glass: true, tag: 'decor' })
  const walled = view.stage !== 6
  return (
    <group ref={root} name="decorLayer">
      {view.decor.map((p) => (
        <FloorPiece key={p.id} piece={p} />
      ))}
      {walled &&
        view.walls.map((w) => {
          if (w.kind === PAINT_KIND) return null
          const { pos, yaw } = wallPose(bounds, w.wall, w.seg)
          return (
            <group key={`${w.wall}:${w.seg}`} position={pos} rotation={[0, yaw, 0]}>
              <WallModel kind={w.kind} />
            </group>
          )
        })}
    </group>
  )
}

/** Paint per wall from the decor view: the shell bake recolours that wall (Office.tsx). */
export function paintOf(walls: readonly WallPiece[]): { back?: string; left?: string } {
  const out: { back?: string; left?: string } = {}
  for (const w of walls) if (w.kind === PAINT_KIND && w.color) out[w.wall] = w.color
  return out
}

