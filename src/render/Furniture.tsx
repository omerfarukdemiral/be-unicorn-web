// Procedural low-poly furniture. Models are built in CELL units (1 = one grid cell),
// origin at the footprint centre on the floor, front (chair side) = +z.
// Size-2 items span local x ∈ [−1, 1].
import { useFrame } from '@react-three/fiber'
import { memo, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { CONCEPTS } from '../content'
import type { PrimitiveHint } from '../content'
import { FOUNDER_SLOT_ID, type GameState, type Slot } from '../engine/types'
import { CELL } from './constants'
import { resolveFurniture, type ResolvedFurniture } from './furnitureCatalog'
import { BOOK_COLORS } from './palette'
import { GEO, capsuleGeo, glassMat, glowMat, mat, torusGeo } from './resources'
import { useGS } from './source'
import { useLayout, useOffice } from './sceneRegistry'

type V3 = [number, number, number]

interface PartProps {
  g?: 'box' | 'cyl' | 'cylSmooth' | 'cone' | 'sphere' | 'dome'
  s: V3
  p: V3
  r?: V3
  c: string
  glow?: boolean
  shadow?: boolean
}

/** One primitive part. Geometry & material are shared caches. */
function P({ g = 'box', s, p, r, c, glow, shadow = true }: PartProps) {
  return (
    <mesh
      geometry={GEO[g]}
      material={glow ? glowMat(c, 0.6) : mat(c)}
      scale={s}
      position={p}
      rotation={r}
      castShadow={shadow}
      receiveShadow
    />
  )
}

function Monitor({ x = 0, z = -0.14, yaw = 0, screen = '#bfe3ff' }: { x?: number; z?: number; yaw?: number; screen?: string }) {
  return (
    <group position={[x, 0.34, z]} rotation={[0, yaw, 0]}>
      <P s={[0.04, 0.1, 0.04]} p={[0, 0.05, 0]} c="#3e3c48" />
      <P s={[0.3, 0.19, 0.025]} p={[0, 0.19, 0]} c="#3e3c48" />
      <P s={[0.27, 0.16, 0.005]} p={[0, 0.19, 0.014]} c={screen} glow shadow={false} />
    </group>
  )
}

function Chair({ z = 0.32, color = '#5b5866' }: { z?: number; color?: string }) {
  return (
    <group position={[0, 0, z]}>
      <P g="cyl" s={[0.05, 0.16, 0.05]} p={[0, 0.08, 0]} c="#3e3c48" />
      <P g="cyl" s={[0.22, 0.02, 0.22]} p={[0, 0.01, 0]} c="#3e3c48" />
      <P s={[0.24, 0.04, 0.24]} p={[0, 0.18, 0]} c={color} />
      <P s={[0.24, 0.22, 0.04]} p={[0, 0.31, 0.12]} c={color} />
    </group>
  )
}

function Desk({ colors, variant }: { colors: ResolvedFurniture['colors']; variant: 'basic' | 'ergo' | 'dual' }) {
  const top = variant === 'basic' ? 0.03 : 0.045
  return (
    <group>
      <P s={[0.82, top, 0.46]} p={[0, 0.32, -0.04]} c={colors.primary} />
      {variant === 'basic' ? (
        <>
          <P s={[0.04, 0.3, 0.04]} p={[-0.37, 0.15, -0.23]} c={colors.secondary} />
          <P s={[0.04, 0.3, 0.04]} p={[0.37, 0.15, -0.23]} c={colors.secondary} />
          <P s={[0.04, 0.3, 0.04]} p={[-0.37, 0.15, 0.15]} c={colors.secondary} />
          <P s={[0.04, 0.3, 0.04]} p={[0.37, 0.15, 0.15]} c={colors.secondary} />
        </>
      ) : (
        <>
          <P s={[0.06, 0.3, 0.3]} p={[-0.34, 0.15, -0.04]} c={colors.secondary} />
          <P s={[0.06, 0.3, 0.3]} p={[0.34, 0.15, -0.04]} c={colors.secondary} />
          <P s={[0.2, 0.18, 0.36]} p={[0.2, 0.2, -0.04]} c={colors.accent} />
        </>
      )}
      <P s={[0.26, 0.012, 0.08]} p={[0, 0.345, 0.08]} c="#e8e6ef" />
      {variant === 'dual' ? (
        <>
          <Monitor x={-0.16} yaw={0.25} />
          <Monitor x={0.16} yaw={-0.25} />
        </>
      ) : (
        <Monitor />
      )}
      {variant === 'ergo' && (
        <>
          <P g="cyl" s={[0.07, 0.08, 0.07]} p={[-0.32, 0.38, -0.12]} c="#e7b48a" />
          <P g="sphere" s={[0.12, 0.12, 0.12]} p={[-0.32, 0.46, -0.12]} c="#8fcf8a" />
        </>
      )}
      <Chair color={variant === 'basic' ? '#6e6b7a' : colors.accent} />
    </group>
  )
}

function Plant({ colors, big = false }: { colors: ResolvedFurniture['colors']; big?: boolean }) {
  const k = big ? 1.4 : 1
  return (
    <group scale={[k, k, k]}>
      <P g="cyl" s={[0.26, 0.22, 0.26]} p={[0, 0.11, 0]} c={colors.secondary} />
      <P g="sphere" s={[0.34, 0.34, 0.34]} p={[0, 0.36, 0]} c={colors.primary} />
      <P g="sphere" s={[0.22, 0.22, 0.22]} p={[0.1, 0.52, 0.04]} c={colors.accent} />
      <P g="cone" s={[0.18, 0.3, 0.18]} p={[-0.08, 0.58, -0.05]} c={colors.primary} />
    </group>
  )
}

function Coffee({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.84, 0.36, 0.38]} p={[0, 0.18, -0.2]} c={colors.primary} />
      <P s={[0.86, 0.03, 0.4]} p={[0, 0.375, -0.2]} c={colors.secondary} />
      <P s={[0.2, 0.26, 0.2]} p={[-0.2, 0.52, -0.24]} c="#3e3c48" />
      <P s={[0.1, 0.03, 0.06]} p={[-0.2, 0.46, -0.12]} c={colors.accent} glow />
      <P g="cyl" s={[0.06, 0.07, 0.06]} p={[0.08, 0.425, -0.14]} c={colors.secondary} />
      <P g="cyl" s={[0.06, 0.07, 0.06]} p={[0.2, 0.425, -0.2]} c={colors.accent} />
      <P g="cyl" s={[0.22, 0.03, 0.22]} p={[0.1, 0.27, 0.22]} c={colors.secondary} />
      <P g="cyl" s={[0.04, 0.27, 0.04]} p={[0.1, 0.135, 0.22]} c="#3e3c48" />
    </group>
  )
}

function Kitchen({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.6, 0.36, 0.36]} p={[-0.12, 0.18, -0.22]} c={colors.primary} />
      <P s={[0.62, 0.03, 0.38]} p={[-0.12, 0.375, -0.22]} c={colors.secondary} />
      <P s={[0.26, 0.72, 0.32]} p={[0.32, 0.36, -0.24]} c="#eef0f2" />
      <P s={[0.02, 0.2, 0.02]} p={[0.2, 0.5, -0.07]} c="#8c8c96" />
      <P g="sphere" s={[0.1, 0.1, 0.1]} p={[-0.25, 0.43, -0.2]} c={colors.accent} />
      <P g="sphere" s={[0.09, 0.09, 0.09]} p={[-0.14, 0.43, -0.24]} c="#f7e08a" />
    </group>
  )
}

function Sofa({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.84, 0.18, 0.4]} p={[0, 0.12, -0.08]} c={colors.primary} />
      <P s={[0.84, 0.28, 0.1]} p={[0, 0.3, -0.26]} c={colors.primary} />
      <P s={[0.1, 0.24, 0.4]} p={[-0.42, 0.2, -0.08]} c={colors.primary} />
      <P s={[0.1, 0.24, 0.4]} p={[0.42, 0.2, -0.08]} c={colors.primary} />
      <P s={[0.36, 0.06, 0.3]} p={[-0.18, 0.24, -0.05]} c={colors.accent} />
      <P s={[0.36, 0.06, 0.3]} p={[0.18, 0.24, -0.05]} c={colors.accent} />
      <P s={[0.4, 0.14, 0.22]} p={[0, 0.07, 0.3]} c={colors.secondary} />
    </group>
  )
}

function GameCorner({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.5, 0.2, 0.14]} p={[0, 0.1, -0.3]} c={colors.secondary} />
      <P s={[0.5, 0.3, 0.03]} p={[0, 0.38, -0.32]} c="#2b2a33" />
      <P s={[0.46, 0.26, 0.005]} p={[0, 0.38, -0.3]} c={colors.accent} glow shadow={false} />
      <P g="sphere" s={[0.3, 0.2, 0.3]} p={[-0.2, 0.1, 0.2]} c={colors.primary} />
      <P g="sphere" s={[0.3, 0.2, 0.3]} p={[0.22, 0.1, 0.16]} c="#f5a3b5" />
    </group>
  )
}

function WaterCooler({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.24, 0.42, 0.24]} p={[0, 0.21, -0.1]} c={colors.primary} />
      <P g="cylSmooth" s={[0.2, 0.26, 0.2]} p={[0, 0.55, -0.1]} c={colors.secondary} />
      <P s={[0.05, 0.03, 0.03]} p={[0, 0.32, 0.03]} c={colors.accent} />
    </group>
  )
}

function PingPong({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.9, 0.03, 0.5]} p={[0, 0.3, 0]} c={colors.primary} />
      <P s={[0.01, 0.04, 0.5]} p={[0, 0.335, 0]} c={colors.secondary} />
      <P s={[0.04, 0.29, 0.4]} p={[-0.35, 0.145, 0]} c="#3e3c48" />
      <P s={[0.04, 0.29, 0.4]} p={[0.35, 0.145, 0]} c="#3e3c48" />
      <P g="sphere" s={[0.03, 0.03, 0.03]} p={[0.2, 0.36, 0.1]} c="#fbf8f2" />
    </group>
  )
}

function Whiteboard({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.04, 0.5, 0.04]} p={[-0.32, 0.25, -0.2]} c={colors.secondary} />
      <P s={[0.04, 0.5, 0.04]} p={[0.32, 0.25, -0.2]} c={colors.secondary} />
      <P s={[0.72, 0.42, 0.03]} p={[0, 0.58, -0.2]} c={colors.primary} />
      <P s={[0.3, 0.02, 0.005]} p={[-0.1, 0.66, -0.18]} c={colors.accent} shadow={false} />
      <P s={[0.2, 0.02, 0.005]} p={[0.05, 0.58, -0.18]} c="#7fb0e5" shadow={false} />
      <P s={[0.26, 0.02, 0.005]} p={[0, 0.5, -0.18]} c="#8fd19e" shadow={false} />
    </group>
  )
}

function Meeting({ colors, span }: { colors: ResolvedFurniture['colors']; span: boolean }) {
  const L = span ? 1.6 : 0.8
  const chairs: number[] = span ? [-0.55, 0, 0.55] : [-0.2, 0.2]
  return (
    <group>
      <P s={[L, 0.035, 0.5]} p={[0, 0.3, 0]} c={colors.primary} />
      <P s={[L * 0.8, 0.28, 0.08]} p={[0, 0.14, 0]} c="#6e6b7a" />
      {chairs.map((x) => (
        <group key={x}>
          <P s={[0.18, 0.2, 0.18]} p={[x, 0.1, 0.38]} c={colors.accent} />
          <P s={[0.18, 0.2, 0.18]} p={[x, 0.1, -0.38]} c={colors.accent} />
        </group>
      ))}
      <P s={[L + 0.3, 0.9, 0.03]} p={[0, 0.45, -0.62]} c={colors.secondary} />
      <mesh geometry={GEO.box} material={glassMat()} scale={[0.03, 0.9, 1.24]} position={[L / 2 + 0.15, 0.45, 0]} />
      <P s={[0.5, 0.3, 0.02]} p={[0, 0.62, -0.6]} c="#2b2a33" />
      <P s={[0.46, 0.26, 0.005]} p={[0, 0.62, -0.588]} c="#bfe3ff" glow shadow={false} />
    </group>
  )
}

function ServerRack({ colors, span, overload }: { colors: ResolvedFurniture['colors']; span: boolean; overload: boolean }) {
  const ledMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7fdca6', emissive: '#7fdca6', emissiveIntensity: 1 }), [])
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    const on = overload ? Math.sin(t.current * 8) > 0 : true
    const c = overload ? (on ? '#ff4d4d' : '#5a1f1f') : colors.accent
    ledMat.color.set(c)
    ledMat.emissive.set(c)
    ledMat.emissiveIntensity = overload ? (on ? 2 : 0.2) : 0.9
  })
  const xs = span ? [-0.6, -0.2, 0.2, 0.6] : [-0.2, 0.2]
  return (
    <group>
      {xs.map((x) => (
        <group key={x} position={[x, 0, -0.1]}>
          <P s={[0.34, 0.95, 0.44]} p={[0, 0.475, 0]} c={colors.primary} />
          {[0.25, 0.45, 0.65, 0.85].map((y) => (
            <group key={y}>
              <P s={[0.28, 0.05, 0.01]} p={[0, y, 0.225]} c={colors.secondary} shadow={false} />
              <mesh geometry={GEO.box} material={ledMat} scale={[0.03, 0.03, 0.01]} position={[0.1, y, 0.232]} />
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

function Bookshelf({ colors, span, books }: { colors: ResolvedFurniture['colors']; span: boolean; books: string[] }) {
  const W = span ? 1.7 : 0.8
  const shelves = [0.08, 0.36, 0.64]
  const perShelf = Math.max(1, Math.floor((W - 0.1) / 0.07))
  return (
    <group position={[0, 0, -0.25]}>
      <P s={[W, 0.92, 0.04]} p={[0, 0.46, -0.13]} c={colors.secondary} />
      <P s={[0.05, 0.92, 0.3]} p={[-W / 2, 0.46, 0]} c={colors.primary} />
      <P s={[0.05, 0.92, 0.3]} p={[W / 2, 0.46, 0]} c={colors.primary} />
      {shelves.map((y) => (
        <P key={y} s={[W, 0.03, 0.3]} p={[0, y, 0]} c={colors.primary} />
      ))}
      <P s={[W, 0.03, 0.3]} p={[0, 0.92, 0]} c={colors.primary} />
      {books.slice(0, perShelf * shelves.length).map((color, i) => {
        const shelf = Math.floor(i / perShelf)
        const k = i % perShelf
        const h = 0.17 + ((i * 37) % 7) * 0.012
        return <P key={i} s={[0.055, h, 0.2]} p={[-W / 2 + 0.08 + k * 0.07, shelves[shelf]! + 0.015 + h / 2, 0.02]} c={color} />
      })}
    </group>
  )
}

function PhoneBooth({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.6, 0.04, 0.6]} p={[0, 0.02, 0]} c={colors.accent} />
      <P s={[0.6, 0.95, 0.04]} p={[0, 0.5, -0.28]} c={colors.primary} />
      <P s={[0.04, 0.95, 0.6]} p={[-0.28, 0.5, 0]} c={colors.primary} />
      <P s={[0.04, 0.95, 0.6]} p={[0.28, 0.5, 0]} c={colors.primary} />
      <P s={[0.64, 0.05, 0.64]} p={[0, 0.98, 0]} c={colors.primary} />
      <mesh geometry={GEO.box} material={glassMat(colors.secondary, 0.4)} scale={[0.52, 0.9, 0.02]} position={[0, 0.5, 0.28]} />
      <P s={[0.3, 0.03, 0.2]} p={[0, 0.3, -0.16]} c="#e8e6ef" />
    </group>
  )
}

function DemoStage({ colors, span }: { colors: ResolvedFurniture['colors']; span: boolean }) {
  const W = span ? 1.8 : 0.9
  return (
    <group>
      <P s={[W, 0.12, 0.7]} p={[0, 0.06, -0.05]} c={colors.primary} />
      <P s={[W * 0.8, 0.5, 0.04]} p={[0, 0.5, -0.38]} c="#2b2a33" />
      <P s={[W * 0.76, 0.46, 0.005]} p={[0, 0.5, -0.357]} c={colors.secondary} glow shadow={false} />
      <P g="cyl" s={[0.03, 0.3, 0.03]} p={[0.15, 0.27, 0.12]} c="#8c8c96" />
      <P g="sphere" s={[0.05, 0.05, 0.05]} p={[0.15, 0.43, 0.12]} c="#3e3c48" />
      <P g="cone" s={[0.1, 0.12, 0.1]} p={[-W / 2 + 0.08, 0.8, 0.2]} r={[Math.PI * 0.8, 0, 0]} c={colors.accent} glow />
    </group>
  )
}

function Lab({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.84, 0.36, 0.4]} p={[0, 0.18, -0.18]} c={colors.primary} />
      <P s={[0.86, 0.03, 0.42]} p={[0, 0.375, -0.18]} c={colors.secondary} />
      <P g="cone" s={[0.1, 0.14, 0.1]} p={[-0.25, 0.46, -0.16]} c={colors.accent} />
      <P g="cylSmooth" s={[0.06, 0.16, 0.06]} p={[-0.1, 0.47, -0.22]} c="#9cc9f5" />
      <P s={[0.06, 0.2, 0.06]} p={[0.22, 0.49, -0.2]} c="#8c8c96" />
      <P s={[0.2, 0.05, 0.05]} p={[0.3, 0.6, -0.2]} r={[0, 0, -0.5]} c="#f7e08a" />
      <P g="sphere" s={[0.06, 0.06, 0.06]} p={[0.37, 0.56, -0.2]} c="#e57f7f" />
    </group>
  )
}

function Podcast({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P g="cyl" s={[0.6, 0.03, 0.6]} p={[0, 0.3, 0]} c={colors.primary} />
      <P g="cyl" s={[0.08, 0.3, 0.08]} p={[0, 0.15, 0]} c="#3e3c48" />
      <P g="cyl" s={[0.02, 0.14, 0.02]} p={[-0.15, 0.38, 0]} c="#8c8c96" />
      <P g="sphere" s={[0.05, 0.08, 0.05]} p={[-0.15, 0.48, 0]} c="#3e3c48" />
      <P g="cyl" s={[0.02, 0.14, 0.02]} p={[0.15, 0.38, 0]} c="#8c8c96" />
      <P g="sphere" s={[0.05, 0.08, 0.05]} p={[0.15, 0.48, 0]} c="#3e3c48" />
      <P s={[0.34, 0.1, 0.03]} p={[0, 0.8, -0.35]} c={colors.accent} glow />
      <P s={[0.9, 0.9, 0.03]} p={[0, 0.45, -0.45]} c={colors.secondary} />
    </group>
  )
}

function Helipad({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P g="cyl" s={[1.6, 0.04, 1.6]} p={[0, 0.02, 0]} c={colors.primary} />
      <P s={[0.08, 0.01, 0.5]} p={[-0.18, 0.045, 0]} c={colors.secondary} />
      <P s={[0.08, 0.01, 0.5]} p={[0.18, 0.045, 0]} c={colors.secondary} />
      <P s={[0.36, 0.01, 0.08]} p={[0, 0.045, 0]} c={colors.secondary} />
    </group>
  )
}

function Generic({ colors }: { colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      <P s={[0.6, 0.4, 0.5]} p={[0, 0.2, 0]} c={colors.primary} />
      <P s={[0.3, 0.1, 0.3]} p={[0, 0.45, 0]} c={colors.accent} />
    </group>
  )
}

/** Draws content-provided primitive hints (cell units). */
function Primitives({ hints, colors }: { hints: readonly PrimitiveHint[]; colors: ResolvedFurniture['colors'] }) {
  return (
    <group>
      {hints.map((h, i) => {
        const color = h.color === 'primary' || h.color === 'secondary' || h.color === 'accent' ? colors[h.color] : h.color
        const m = mat(color)
        const [a, b, c] = h.size
        let geo: THREE.BufferGeometry = GEO.box
        let scale: V3 = [a, b, c]
        switch (h.kind) {
          case 'cylinder':
            geo = GEO.cyl
            scale = [a * 2, b, c * 2]
            break
          case 'cone':
            geo = GEO.cone
            scale = [a * 2, b, c * 2]
            break
          case 'sphere':
            geo = GEO.sphere
            scale = [a * 2, b * 2, c * 2]
            break
          case 'torus':
            geo = torusGeo(a, b)
            scale = [1, 1, 1]
            break
          case 'capsule':
            geo = capsuleGeo(a, b)
            scale = [1, 1, 1]
            break
          default:
            break
        }
        return <mesh key={i} geometry={geo} material={m} scale={scale} position={h.pos} rotation={h.rot} castShadow receiveShadow />
      })}
    </group>
  )
}

export interface FurnitureModelProps {
  resolved: ResolvedFurniture
  /** Footprint covers two cells along local x. */
  span?: boolean
  /** Book colours (bookshelf only). */
  books?: string[]
  /** Server overload blink. */
  overload?: boolean
}

/** A furniture model in world units (already scaled by CELL). */
const NO_BOOKS: string[] = []

export const FurnitureModel = memo(function FurnitureModel({ resolved, span = false, books = NO_BOOKS, overload = false }: FurnitureModelProps) {
  const { shape, colors, item } = resolved
  const hints = item?.visual.primitives
  let body: ReactNode
  if (hints && hints.length > 0 && shape !== 'bookshelf' && shape !== 'serverRack') {
    body = <Primitives hints={hints} colors={colors} />
  } else {
    switch (shape) {
      case 'desk':
        body = <Desk colors={colors} variant="basic" />
        break
      case 'deskErgo':
        body = <Desk colors={colors} variant="ergo" />
        break
      case 'deskDual':
        body = <Desk colors={colors} variant="dual" />
        break
      case 'plant':
        body = <Plant colors={colors} big={/big|büyük|large/.test(resolved.id)} />
        break
      case 'coffee':
        body = <Coffee colors={colors} />
        break
      case 'kitchen':
        body = <Kitchen colors={colors} />
        break
      case 'sofa':
        body = <Sofa colors={colors} />
        break
      case 'gameCorner':
        body = <GameCorner colors={colors} />
        break
      case 'waterCooler':
        body = <WaterCooler colors={colors} />
        break
      case 'pingPong':
        body = <PingPong colors={colors} />
        break
      case 'whiteboard':
        body = <Whiteboard colors={colors} />
        break
      case 'meeting':
        body = <Meeting colors={colors} span={span} />
        break
      case 'serverRack':
        body = <ServerRack colors={colors} span={span} overload={overload} />
        break
      case 'bookshelf':
        body = <Bookshelf colors={colors} span={span} books={books} />
        break
      case 'phoneBooth':
        body = <PhoneBooth colors={colors} />
        break
      case 'demoStage':
        body = <DemoStage colors={colors} span={span} />
        break
      case 'lab':
        body = <Lab colors={colors} />
        break
      case 'podcast':
        body = <Podcast colors={colors} />
        break
      case 'helipad':
        body = <Helipad colors={colors} />
        break
      default:
        body = <Generic colors={colors} />
    }
  }
  return <group scale={[CELL, CELL, CELL]}>{body}</group>
})

const selectBooks = (s: GameState) => s.concepts.learned.join(',')
const selectOverload = (s: GameState) => s.derived.overload > 0

/** Book colours for learned concepts (PLAN §3.4 kitaplık). */
export function useBookColors(): string[] {
  const learnedKey = useGS(selectBooks)
  return useMemo(
    () =>
      (learnedKey ? learnedKey.split(',') : []).map((id, i) => CONCEPTS.find((c) => c.id === id)?.shelfColor ?? BOOK_COLORS[i % BOOK_COLORS.length]!),
    [learnedKey],
  )
}

/** Look of the founder desk while its slot holds no item. */
const FOUNDER_DESK_ITEM = 'desk-basic'

/** All placed furniture in the office. */
export function FurnitureLayer() {
  const slots = useOffice().slots
  const layout = useLayout()
  const books = useBookColors()
  const overload = useGS(selectOverload)
  const anchors = slots.filter((s: Slot) => (s.itemId || s.id === FOUNDER_SLOT_ID) && !s.spanOf)
  return (
    <group>
      {anchors.map((s) => {
        const c = layout.itemCenter.get(s.id)
        if (!c) return null
        const resolved = resolveFurniture(s.itemId ?? FOUNDER_DESK_ITEM, s.type)
        return (
          <group key={`${s.id}:${s.itemId}`} position={[c.pos[0], 0, c.pos[1]]} rotation={[0, c.yaw, 0]}>
            <FurnitureModel resolved={resolved} span={c.span} books={books} overload={overload} />
          </group>
        )
      })}
    </group>
  )
}
