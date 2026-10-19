// Procedural low-poly furniture. Models are built in CELL units (1 = one grid cell),
// origin at the footprint centre on the floor, front (chair side) = +z.
// Size-2 items span local x ∈ [−1, 1].
import { useFrame } from '@react-three/fiber'
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { CONCEPTS } from '../content'
import type { PrimitiveHint } from '../content'
import { FOUNDER_SLOT_ID, type GameState, type Slot } from '../engine/types'
import { useBake } from './bake'
import { bushGeo, coniferGeo } from './foliage'
import { REAL_LOOK } from './look'
import { CELL } from './constants'
import type { StageBand } from '../content/stageBand'
import { resolveFurniture, type ResolvedFurniture } from './furnitureCatalog'
import { BOOK_COLORS } from './palette'
import { GEO, boxPart, capsuleGeo, glassMat, glowMat, mat, torusGeo } from './resources'
import { MAX_EXTRAS_IN_SCENE, furnitureBand, founderDeskExtras, pickExtras } from './stageLook'
import { useGS } from './source'
import type { OfficeLayout, XZ } from './layout'
import { useFurnitureView, useLayoutEditing } from './sceneRegistry'
import { useSpawnScale } from './useSpawnScale'

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
  const box = g === 'box' ? boxPart(s) : null
  return (
    <mesh
      geometry={box ? box.geometry : GEO[g]}
      material={glow ? glowMat(c, 0.6) : mat(c)}
      scale={box ? box.scale : s}
      position={p}
      rotation={r}
      castShadow={shadow}
      receiveShadow
    />
  )
}

function Monitor({ x = 0, z = -0.14, yaw = 0, screen = '#bfe3ff' }: { x?: number; z?: number; yaw?: number; screen?: string }) {
  if (REAL_LOOK) return <RealMonitor x={x} z={z} yaw={yaw} screen={screen} />
  return (
    <group position={[x, 0.34, z]} rotation={[0, yaw, 0]}>
      <P s={[0.04, 0.1, 0.04]} p={[0, 0.05, 0]} c="#3e3c48" />
      <P s={[0.3, 0.19, 0.025]} p={[0, 0.19, 0]} c="#3e3c48" />
      <P s={[0.27, 0.16, 0.005]} p={[0, 0.19, 0.014]} c={screen} glow shadow={false} />
    </group>
  )
}

function Chair({ z = 0.32, color = '#5b5866' }: { z?: number; color?: string }) {
  if (REAL_LOOK) return <RealChair z={z} color={color} />
  return (
    <group position={[0, 0, z]}>
      <P g="cyl" s={[0.05, 0.16, 0.05]} p={[0, 0.08, 0]} c="#3e3c48" />
      <P g="cyl" s={[0.22, 0.02, 0.22]} p={[0, 0.01, 0]} c="#3e3c48" />
      <P s={[0.24, 0.04, 0.24]} p={[0, 0.18, 0]} c={color} />
      <P s={[0.24, 0.22, 0.04]} p={[0, 0.31, 0.12]} c={color} />
    </group>
  )
}

// --- Realistic look (look.ts): the pieces seen on every desk, modelled closer to the real thing ---------------------

const STEEL = '#c0c4cc'
const BLACK = '#2b2a33'

/** A slim panel on an aluminium neck and foot plate. */
function RealMonitor({ x, z, yaw, screen, y = 0.34, k = 1 }: { x: number; z: number; yaw: number; screen: string; y?: number; k?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]} scale={k}>
      <P s={[0.13, 0.01, 0.09]} p={[0, 0.005, 0.01]} c={STEEL} />
      <P s={[0.022, 0.12, 0.016]} p={[0, 0.065, -0.012]} c={STEEL} />
      <P s={[0.33, 0.2, 0.014]} p={[0, 0.2, 0]} c={BLACK} />
      <P s={[0.31, 0.18, 0.004]} p={[0, 0.202, 0.008]} c={screen} glow shadow={false} />
    </group>
  )
}

/** Office chair: five-star base on casters, gas lift, padded seat and a slightly reclined back, armrests. */
function RealChair({ z, color }: { z: number; color: string }) {
  return (
    <group position={[0, 0, z]}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <group key={i} rotation={[0, a, 0]}>
            <P s={[0.012, 0.014, 0.11]} p={[0, 0.03, 0.055]} c={BLACK} />
            <P g="sphere" s={[0.026, 0.026, 0.026]} p={[0, 0.013, 0.105]} c={BLACK} />
          </group>
        )
      })}
      <P g="cylSmooth" s={[0.03, 0.12, 0.03]} p={[0, 0.1, 0]} c={STEEL} />
      <P s={[0.25, 0.045, 0.24]} p={[0, 0.18, 0]} c={color} />
      <P s={[0.025, 0.1, 0.02]} p={[0, 0.22, 0.12]} c={BLACK} />
      <group position={[0, 0.33, 0.135]} rotation={[-0.12, 0, 0]}>
        <P s={[0.24, 0.2, 0.04]} p={[0, 0, 0]} c={color} />
      </group>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <P s={[0.014, 0.06, 0.014]} p={[sx * 0.135, 0.225, 0.02]} c={BLACK} />
          <P s={[0.035, 0.014, 0.11]} p={[sx * 0.135, 0.258, 0.0]} c={BLACK} />
        </group>
      ))}
    </group>
  )
}

/** Screen colour of a lit desk monitor (an editor's light theme). */
const SCREEN = '#cfe6ff'

/**
 * Realistic look: a desk drawn from content's deskParts (content/furniture.ts) is recognised by its layout (top, four
 * legs, three chair parts, then one or two monitors and a stand) and rebuilt as a real desk; whatever an item adds
 * after those parts (lamp, mug, laptop) is drawn from its hints as before.
 */
function RealDeskFromHints({ hints, colors }: { hints: readonly PrimitiveHint[]; colors: ResolvedFurniture['colors'] }) {
  const top = hints[0]!
  const screens = hints.slice(8).filter((h) => h.kind === 'box' && h.size[1] >= 0.19 && h.size[2] <= 0.04)
  const monitors = screens.length >= 2 ? 2 : 1
  const rest = hints.slice(8 + (monitors === 1 ? 2 : 3))
  const [w, , d] = top.size
  const topY = top.pos[1]
  const surface = topY + top.size[1] / 2
  const legH = topY - top.size[1] / 2
  const leg = colors.secondary
  return (
    <group>
      <P s={[w, 0.04, d]} p={[0, topY + 0.005, top.pos[2]]} c={colors.primary} />
      {/* steel frame: four slim legs and a rail under the top */}
      {[-1, 1].map((sx) =>
        [-0.25, 0.15].map((z) => <P key={`${sx}${z}`} s={[0.035, legH, 0.035]} p={[sx * (w / 2 - 0.05), legH / 2, z]} c={leg} />),
      )}
      <P s={[w - 0.12, 0.04, 0.02]} p={[0, legH - 0.03, -0.25]} c={leg} />
      {/* keyboard, mouse */}
      <P s={[0.28, 0.014, 0.09]} p={[0, surface + 0.007, 0.09]} c="#e9e8ee" />
      <P s={[0.25, 0.004, 0.065]} p={[0, surface + 0.016, 0.09]} c="#d3d2da" shadow={false} />
      <P g="sphere" s={[0.035, 0.016, 0.055]} p={[0.22, surface + 0.008, 0.1]} c="#e9e8ee" />
      {monitors === 1 ? (
        <RealMonitor x={0} z={-0.22} yaw={0} screen={SCREEN} y={surface} k={1.05} />
      ) : (
        <>
          <RealMonitor x={-0.18} z={-0.2} yaw={0.25} screen={SCREEN} y={surface} k={0.95} />
          <RealMonitor x={0.18} z={-0.2} yaw={-0.25} screen={SCREEN} y={surface} k={0.95} />
        </>
      )}
      <group scale={1.4}>
        <RealChair z={0.38 / 1.4} color={colors.accent} />
      </group>
      {rest.length > 0 && <Primitives hints={rest} colors={colors} />}
    </group>
  )
}

/** Realistic look: a green sphere or cone in content's hints is foliage (plant tops), drawn as leaf clumps. */
function isLeafGreen(hex: string): boolean {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  return hsl.h > 0.18 && hsl.h < 0.45 && hsl.s > 0.2 && hsl.l < 0.7
}

/** A potted plant: glazed pot, soil, and leafy clumps instead of balls. */
function RealPlant({ colors, k }: { colors: ResolvedFurniture['colors']; k: number }) {
  const leaf = mat('#4f7f3c', 'foliage')
  const leafLight = mat('#6e9c4a', 'foliage')
  return (
    <group scale={[k, k, k]}>
      <P g="cylSmooth" s={[0.26, 0.22, 0.26]} p={[0, 0.11, 0]} c={colors.secondary} />
      <P g="cylSmooth" s={[0.23, 0.01, 0.23]} p={[0, 0.215, 0]} c="#4a3a2c" />
      <mesh geometry={bushGeo()} material={leaf} scale={[0.36, 0.34, 0.36]} position={[0, 0.36, 0]} castShadow receiveShadow />
      <mesh geometry={bushGeo()} material={leafLight} scale={[0.24, 0.26, 0.24]} position={[0.06, 0.52, 0.03]} rotation={[0, 1.3, 0]} castShadow receiveShadow />
      <mesh geometry={bushGeo()} material={leaf} scale={[0.18, 0.22, 0.18]} position={[-0.06, 0.64, -0.03]} rotation={[0, 2.4, 0]} castShadow receiveShadow />
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
      <Chair color={colors.accent} />
    </group>
  )
}

function Plant({ colors, big = false }: { colors: ResolvedFurniture['colors']; big?: boolean }) {
  const k = big ? 1.4 : 1
  if (REAL_LOOK) return <RealPlant colors={colors} k={k} />
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
        const leafy = REAL_LOOK && (h.kind === 'sphere' || h.kind === 'cone') && isLeafGreen(color)
        const m = mat(color, leafy ? 'foliage' : undefined)
        const [a, b, c] = h.size
        const box = boxPart([a, b, c])
        let geo: THREE.BufferGeometry = box.geometry
        let scale: V3 = box.scale
        switch (h.kind) {
          case 'cylinder':
            geo = GEO.cyl
            scale = [a * 2, b, c * 2]
            break
          case 'cone':
            geo = leafy ? coniferGeo() : GEO.cone
            scale = [a * 2, b, c * 2]
            break
          case 'sphere':
            geo = leafy ? bushGeo() : GEO.sphere
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
  if (REAL_LOOK && hints && hints.length >= 10 && shape.startsWith('desk')) {
    body = <RealDeskFromHints hints={hints} colors={colors} />
  } else if (hints && hints.length > 0 && shape !== 'bookshelf' && shape !== 'serverRack') {
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
  // One draw call per piece (plus its glow parts) instead of one per primitive: everything here is a pure function
  // of these props (the server rack's LED material animates but is not bakeable, so it stays its own mesh).
  const root = useRef<THREE.Group>(null)
  useBake(root, [resolved, span, books, overload], { shadow: 'all' })
  return (
    <group ref={root} scale={[CELL, CELL, CELL]}>
      {body}
      {resolved.extras.length > 0 && <Primitives hints={resolved.extras} colors={colors} />}
    </group>
  )
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

export interface Placed {
  key: string
  pos: XZ
  yaw: number
  span: boolean
  resolved: ResolvedFurniture
  /** The founder's bare desk (no item in the slot). */
  bare?: boolean
}

/**
 * The pieces to draw. A key is the slot and its item, never the band: a band change re-resolves a piece in place
 * (new finish, same React key), so nothing remounts or plops in again. The finish comes in as many extra meshes as
 * the scene's budget allows (the founder desk's nameplate always).
 */
export function placeItems(slots: readonly Slot[], layout: OfficeLayout, look: StageBand): Placed[] {
  const out: Placed[] = []
  for (const s of slots) {
    if ((!s.itemId && s.id !== FOUNDER_SLOT_ID) || s.spanOf) continue
    const c = layout.itemCenter.get(s.id)
    if (!c) continue
    out.push({ key: `${s.id}:${s.itemId}`, pos: c.pos, yaw: c.yaw, span: c.span, resolved: resolveFurniture(s.itemId ?? FOUNDER_DESK_ITEM, s.type, look), bare: !s.itemId })
  }
  const keep = pickExtras(out.map((p) => ({ key: p.key, count: p.bare ? 0 : p.resolved.extras.length })), MAX_EXTRAS_IN_SCENE - founderDeskExtras(look).length)
  return out.map((p) => {
    if (p.bare) return { ...p, resolved: { ...p.resolved, extras: founderDeskExtras(look) } }
    return keep.has(p.key) || p.resolved.extras.length === 0 ? p : { ...p, resolved: resolveFurniture(p.resolved.id, p.resolved.slotType, look, false) }
  })
}

/** One placed item. Grows in when bought / moved here (spawn), shrinks out as a ghost when sold / moved away. */
const PlacedItem = memo(function PlacedItem({
  item,
  spawn,
  exiting = false,
  onExited,
  books,
  overload,
}: {
  item: Placed
  spawn: boolean
  exiting?: boolean
  onExited?: (key: string) => void
  books: string[]
  overload: boolean
}) {
  const ref = useRef<THREE.Group>(null)
  const scale = useSpawnScale(ref, { spawn, exiting, onExited: onExited && (() => onExited(item.key)) })
  return (
    <group ref={ref} position={[item.pos[0], 0, item.pos[1]]} rotation={[0, item.yaw, 0]} scale={scale}>
      <FurnitureModel resolved={item.resolved} span={item.span} books={books} overload={overload} />
    </group>
  )
})

/**
 * All placed furniture in the office. `band` (G2) is the company's look band: purchased items gain a finish from
 * band 2 within a scene budget, starter items are repainted, the founder desk gets a nameplate at band 3. A band
 * change re-resolves the pieces in place: PlacedItem keeps its key, so nothing remounts or plops in again.
 */
export function FurnitureLayer({ band = 1, lowPower = false }: { band?: StageBand; lowPower?: boolean }) {
  // The edit draft while the office edit mode is open (moved pieces keep their keys: a drop is a transform only).
  const view = useFurnitureView()
  const slots = view.office.slots
  const layout = view.layout
  const editing = useLayoutEditing()
  const books = useBookColors()
  const overload = useGS(selectOverload)
  const look = furnitureBand(band, lowPower)
  const placed = useMemo(() => placeItems(slots, layout, look), [slots, layout, look])

  // First mount of the layer (a loaded save) and a stage move do not plop in piece by piece; only
  // later changes inside one office animate.
  const mounted = useRef(false)
  const stage = useRef(layout.stage)
  // Entering or leaving the edit mode re-keys moved pieces (draft ids → their committed slots): no plop for that.
  const wasEditing = useRef(editing)
  const animate = mounted.current && stage.current === layout.stage && wasEditing.current === editing
  const prev = useRef<Placed[]>(placed)
  const [ghosts, setGhosts] = useState<Placed[]>([])
  useLayoutEffect(() => {
    const old = prev.current
    prev.current = placed
    const stageMoved = stage.current !== layout.stage
    stage.current = layout.stage
    const editToggled = wasEditing.current !== editing
    wasEditing.current = editing
    if (!mounted.current || stageMoved || editToggled) {
      mounted.current = true
      if (stageMoved || editToggled) setGhosts((g) => (g.length ? [] : g))
      return
    }
    const keys = new Set(placed.map((p) => p.key))
    const gone = old.filter((p) => !keys.has(p.key))
    setGhosts((cur) => {
      const kept = cur.filter((g) => !keys.has(g.key) && !gone.some((x) => x.key === g.key))
      return gone.length === 0 && kept.length === cur.length ? cur : [...kept, ...gone]
    })
  }, [placed, layout.stage, editing])
  const ghostDone = useCallback((key: string) => setGhosts((cur) => cur.filter((g) => g.key !== key)), [])

  return (
    <group>
      {placed.map((p) => (
        <PlacedItem key={p.key} item={p} spawn={animate} books={books} overload={overload} />
      ))}
      {ghosts.map((g) => (
        <PlacedItem key={`ghost:${g.key}`} item={g} spawn={false} exiting onExited={ghostDone} books={books} overload={overload} />
      ))}
    </group>
  )
}
