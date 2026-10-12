// The world outside the office (T07): ground to the screen edge instead of a model floating on beige. A pavement
// apron around the building, the street past the door (−z, behind the back wall), and greenery scattered over the
// lot. Placement is pure (surroundingsPlan) and deterministic per office box, so a stage change re-plants the same
// way every run. Anything in front of the open sides (+x / +z) stays low near the floor so it never hides a desk.
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CELL, hash01 } from './constants'
import type { Box, OfficeLayout } from './layout'
import { PROP_COLORS, SURROUND, stagePalette } from './palette'
import { GEO, mat } from './resources'
import { useLayout } from './sceneRegistry'
import { BUILDING_D, Street } from './Street'

/** Pavement apron around the building. */
const APRON = CELL * 0.6
/** Street: gap from the apron, carriageway width, far pavement. */
const ROAD_GAP = CELL * 0.5
const ROAD_W = CELL * 2
const FAR_WALK = CELL * 0.8
/** Planting ring: from the apron out to this far. */
const LOT = CELL * 9
/** In front of the open sides, tall things keep this far from the floor edge (a 2-unit tree projects ~1.6 up). */
const FRONT_TREE_CLEAR = CELL * 3
/** …and low bushes this far. */
const FRONT_BUSH_CLEAR = CELL * 0.9
/** How far the shops across the street reach past the far pavement (Street). */
const SHOP_BAND = BUILDING_D + 0.6
/** The shop row runs this far past the office on each side. */
const SHOP_REACH = 26
const TREE_TRIES = 160
const BUSH_TRIES = 120

export interface Plant {
  x: number
  z: number
  s: number
  light: boolean
}

export interface SurroundingsPlan {
  apron: Box
  road: { z0: number; z1: number }
  farWalk: { z0: number; z1: number }
  trees: Plant[]
  bushes: Plant[]
}

/** Distance of (x, z) past the open front sides (+x, +z) of the box; ≤ 0 when not in front. */
function frontDistance(b: Box, x: number, z: number): number {
  return Math.max(x - b.maxX, z - b.maxZ)
}

export function surroundingsPlan(layout: Pick<OfficeLayout, 'bounds' | 'stage'>): SurroundingsPlan {
  const b = layout.bounds
  const apron: Box = { minX: b.minX - APRON, maxX: b.maxX + APRON, minZ: b.minZ - APRON, maxZ: b.maxZ + APRON }
  const road = { z0: apron.minZ - ROAD_GAP - ROAD_W, z1: apron.minZ - ROAD_GAP }
  const farWalk = { z0: road.z0 - FAR_WALK, z1: road.z0 }
  const seed = `lot:${layout.stage}`
  // the street plus the row of businesses behind its far pavement (Street)
  const inStreet = (z: number, pad: number) => z > farWalk.z0 - SHOP_BAND - pad && z < road.z1 + pad
  const inApron = (x: number, z: number, pad: number) => x > apron.minX - pad && x < apron.maxX + pad && z > apron.minZ - pad && z < apron.maxZ + pad

  const scatter = (tries: number, salt: number, ok: (x: number, z: number) => boolean, minGap: number, into: Plant[], scale: [number, number]) => {
    for (let i = 0; i < tries; i++) {
      const x = apron.minX - LOT + hash01(seed, salt + i * 3) * (apron.maxX - apron.minX + LOT * 2)
      const z = apron.minZ - LOT + hash01(seed, salt + i * 3 + 1) * (apron.maxZ - apron.minZ + LOT * 2)
      if (!ok(x, z)) continue
      if (into.some((p) => Math.hypot(p.x - x, p.z - z) < minGap)) continue
      into.push({ x, z, s: scale[0] + hash01(seed, salt + i * 3 + 2) * (scale[1] - scale[0]), light: hash01(seed, salt + i * 7) > 0.66 })
    }
  }

  const trees: Plant[] = []
  scatter(
    TREE_TRIES,
    0,
    (x, z) => {
      if (inStreet(z, CELL * 0.7) || inApron(x, z, CELL * 0.6)) return false
      const fd = frontDistance(b, x, z)
      return fd <= 0 || fd >= FRONT_TREE_CLEAR
    },
    CELL * 1.5,
    trees,
    [0.8, 1.3],
  )
  const bushes: Plant[] = []
  scatter(
    BUSH_TRIES,
    1000,
    (x, z) => !inStreet(z, CELL * 0.3) && !inApron(x, z, CELL * 0.15) && (frontDistance(b, x, z) <= 0 || frontDistance(b, x, z) >= FRONT_BUSH_CLEAR),
    CELL * 0.9,
    bushes,
    [0.55, 0.95],
  )
  return { apron, road, farWalk, trees, bushes: bushes.filter((p) => !trees.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < CELL * 0.9)) }
}

function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, items: readonly Plant[], place: (p: Plant, m: THREE.Matrix4) => void) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    items.forEach((p, i) => {
      place(p, m)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [ref, items, place])
}

const pos = new THREE.Vector3()
const quat = new THREE.Quaternion()
const scl = new THREE.Vector3()

const placeTrunk = (p: Plant, m: THREE.Matrix4) => m.compose(pos.set(p.x, 0.3 * p.s, p.z), quat.identity(), scl.set(0.16 * p.s, 0.6 * p.s, 0.16 * p.s))
const placeCrown = (p: Plant, m: THREE.Matrix4) => m.compose(pos.set(p.x, 1.1 * p.s, p.z), quat.identity(), scl.set(0.85 * p.s, 1.15 * p.s, 0.85 * p.s))
const placeBush = (p: Plant, m: THREE.Matrix4) => m.compose(pos.set(p.x, 0.2 * p.s, p.z), quat.identity(), scl.set(0.7 * p.s, 0.5 * p.s, 0.7 * p.s))

function Plants({ items, kind }: { items: Plant[]; kind: 'tree' | 'bush' }) {
  const dark = useMemo(() => items.filter((p) => !p.light), [items])
  const light = useMemo(() => items.filter((p) => p.light), [items])
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crownsD = useRef<THREE.InstancedMesh>(null)
  const crownsL = useRef<THREE.InstancedMesh>(null)
  const top = kind === 'tree' ? placeCrown : placeBush
  useInstances(trunks, kind === 'tree' ? items : [], placeTrunk)
  useInstances(crownsD, dark, top)
  useInstances(crownsL, light, top)
  const geo = kind === 'tree' ? GEO.cone : GEO.sphere
  return (
    <>
      {kind === 'tree' && items.length > 0 && <instancedMesh key={`t${items.length}`} ref={trunks} args={[GEO.cyl, mat(PROP_COLORS.trunk), items.length]} castShadow />}
      {dark.length > 0 && <instancedMesh key={`d${dark.length}`} ref={crownsD} args={[geo, mat(PROP_COLORS.tree), dark.length]} castShadow receiveShadow />}
      {light.length > 0 && <instancedMesh key={`l${light.length}`} ref={crownsL} args={[geo, mat(PROP_COLORS.treeLight), light.length]} castShadow receiveShadow />}
    </>
  )
}

/** Flat slab a hair above the ground, under the office floor (−0.09 … −0.08). */
function Slab({ minX, maxX, minZ, maxZ, y, color }: Box & { y: number; color: string }) {
  return <mesh geometry={GEO.box} material={mat(color)} scale={[maxX - minX, 0.02, maxZ - minZ]} position={[(minX + maxX) / 2, y, (minZ + maxZ) / 2]} receiveShadow />
}

const STREET_HALF = 90
const DASH = CELL * 0.7

export function Surroundings({ lowPower = false }: { lowPower?: boolean }) {
  const layout = useLayout()
  const plan = useMemo(() => surroundingsPlan(layout), [layout])
  const pal = stagePalette(layout.stage)
  const { apron, road, farWalk } = plan
  const dashes = useMemo(() => {
    const out: number[] = []
    for (let x = -STREET_HALF; x < STREET_HALF; x += DASH * 2) out.push(x)
    return out
  }, [])
  const dashRef = useRef<THREE.InstancedMesh>(null)
  const midZ = (road.z0 + road.z1) / 2
  useLayoutEffect(() => {
    const mesh = dashRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    dashes.forEach((x, i) => {
      mesh.setMatrixAt(i, m.compose(pos.set(x, -0.085, midZ), quat.identity(), scl.set(DASH, 0.02, 0.09)))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [dashes, midZ])
  return (
    <group>
      {/* the lot: ground to the screen edge */}
      <mesh geometry={GEO.plane} material={mat(pal.ground)} scale={[220, 1, 220]} position={[0, -0.11, 0]} receiveShadow />
      <Slab {...apron} y={-0.1} color={SURROUND.pavement} />
      <Slab minX={-STREET_HALF} maxX={STREET_HALF} minZ={road.z0} maxZ={road.z1} y={-0.1} color={SURROUND.road} />
      <Slab minX={-STREET_HALF} maxX={STREET_HALF} minZ={farWalk.z0} maxZ={farWalk.z1} y={-0.1} color={SURROUND.pavement} />
      {/* kerb between the near pavement and the carriageway */}
      <Slab minX={-STREET_HALF} maxX={STREET_HALF} minZ={road.z1} maxZ={road.z1 + ROAD_GAP} y={-0.1} color={SURROUND.pavement} />
      <instancedMesh ref={dashRef} args={[GEO.box, mat(SURROUND.marking), dashes.length]} />
      <Street road={road} farWalk={farWalk} nearWalkZ={road.z1 + ROAD_GAP * 0.55} x0={apron.minX - SHOP_REACH} x1={apron.maxX + SHOP_REACH} seed={`street:${layout.stage}`} thin={lowPower && layout.stage >= 4} />
      <Plants items={plan.trees} kind="tree" />
      <Plants items={plan.bushes} kind="bush" />
    </group>
  )
}
