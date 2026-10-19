// The valley street (Silicon Valley vibe): across the road from the office door a row of startup-world businesses
// (VC fund, accelerator, big-tech glass HQ, coworking, the founders' café; all names invented), street lamps on
// the near kerb, cars and a bus in both lanes and a few people on the pavements. Everything sits on the −z side
// behind the office, so nothing here can hide a desk (the camera frames the office box only, frameFit).
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useBake } from './bake'
import { CharacterModel, createRig, type CharacterLook, type Rig } from './CharacterModel'
import { hash01 } from './constants'
import { HAIR_COLORS, PASTEL, SKIN_TONES } from './palette'
import { GEO, glowMat, mat } from './resources'
import { rimGeo, tyreGeo, vehicleGeos, vehicleSpec, type VehicleKind } from './vehicleGeo'
import { useGS, useMockState, useUi } from './source'
import { facadeTexture, type FacadeSpec } from './surfaces'
import { speedMultiplier } from './walker'

/** Height of one storey across the street (the office wall is 2.2). */
const STOREY = 1.15
/** Depth of every building. */
export const BUILDING_D = 3.2

interface Business extends FacadeSpec {
  w: number
}

const ROW: readonly Business[] = [
  { w: 3.6, body: '#3b3640', floors: 1, sign: { text: 'PITCH KAHVE', bg: '#ffd95c', fg: '#2b2a33' }, awning: ['#2b2a33', '#ffd95c'] },
  { w: 4.4, body: '#a9dbe8', glass: true, floors: 4, sign: { text: 'NOVA VENTURES', sub: 'Girişim sermayesi', bg: '#123c4a', fg: '#d8f4ff' } },
  { w: 4.2, body: '#f39a63', floors: 2, sign: { text: 'LAUNCHPAD', sub: 'Hızlandırıcı · Demo Day', bg: '#2b2a33', fg: '#ffb27f' } },
  { w: 5.2, body: '#bfe6f0', glass: true, floors: 6, sign: { text: 'ORBIT', sub: 'Genel merkez', logo: '#3f84e5', bg: '#fdfcf8', fg: '#123c4a' } },
  { w: 4.0, body: '#ffe08a', floors: 2, sign: { text: 'HUB coworking', bg: '#14a98f', fg: '#fdfcf8' }, awning: ['#14a98f', '#fdf8ef'] },
  { w: 4.0, body: '#cdbcf7', floors: 3, sign: { text: 'SEED LABS', sub: 'Ar-Ge kampüsü', bg: '#fdfcf8', fg: '#5b3fd0' } },
  { w: 4.8, body: '#c9ced6', floors: 2, sign: { text: 'BULUT VERİ', sub: 'Veri merkezi', bg: '#2b2a33', fg: '#7fdcb4' } },
]

interface Placed {
  b: Business
  x0: number
}

/** Lays the row out along x from `from` to `to`, cycling the businesses with small green gaps. */
export function streetRow(from: number, to: number, seed: string): Placed[] {
  const out: Placed[] = []
  let x = from
  let i = Math.floor(hash01(seed) * ROW.length)
  while (x < to) {
    const b = ROW[i % ROW.length]!
    out.push({ b, x0: x })
    x += b.w + 0.7 + hash01(seed, i) * 0.9
    i++
  }
  return out
}

function Building({ b, x0, zFront }: Placed & { zFront: number }) {
  const h = b.floors * STOREY
  const front = facadeTexture(b, b.w, h, true)
  const side = facadeTexture(b, BUILDING_D, h, false)
  const cx = x0 + b.w / 2
  const cz = zFront - BUILDING_D / 2
  const frontMat = useMemo(() => (front ? new THREE.MeshStandardMaterial({ map: front, roughness: 0.75 }) : null), [front])
  const sideMat = useMemo(() => (side ? new THREE.MeshStandardMaterial({ map: side, roughness: 0.75, color: '#e9e6e2' }) : null), [side])
  // Own materials over cached facade textures: freed with the building (a stage move rebuilds the street, F5).
  useEffect(() => () => frontMat?.dispose(), [frontMat])
  useEffect(() => () => sideMat?.dispose(), [sideMat])
  return (
    <group>
      <mesh geometry={GEO.box} material={mat(b.body)} scale={[b.w, h, BUILDING_D]} position={[cx, h / 2, cz]} receiveShadow />
      <mesh geometry={GEO.box} material={mat(PASTEL.cream100)} scale={[b.w + 0.08, 0.14, BUILDING_D + 0.08]} position={[cx, h + 0.07, cz]} />
      {frontMat && (
        <mesh material={frontMat} position={[cx, h / 2, zFront + 0.006]}>
          <planeGeometry args={[b.w, h]} />
        </mesh>
      )}
      {sideMat && (
        <mesh material={sideMat} position={[x0 + b.w + 0.006, h / 2, cz]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[BUILDING_D, h]} />
        </mesh>
      )}
    </group>
  )
}

/** Street lamp: a cast base, a tapered pole, an arm reaching over the kerb and a lantern lit from below. */
function Lamp({ x, z }: { x: number; z: number }) {
  const pole = '#3d4046'
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.cylSmooth} material={mat(pole)} scale={[0.16, 0.18, 0.16]} position={[0, 0.09, 0]} castShadow />
      <mesh geometry={GEO.cylSmooth} material={mat(pole)} scale={[0.06, 2.1, 0.06]} position={[0, 1.2, 0]} castShadow />
      <mesh geometry={GEO.cylSmooth} material={mat(pole)} scale={[0.09, 0.12, 0.09]} position={[0, 2.28, 0]} />
      <mesh geometry={GEO.box} material={mat(pole)} scale={[0.5, 0.035, 0.05]} position={[0.22, 2.32, 0]} castShadow />
      <mesh geometry={GEO.box} material={mat(pole)} scale={[0.3, 0.06, 0.16]} position={[0.46, 2.3, 0]} castShadow />
      <mesh geometry={GEO.box} material={glowMat('#fff2c4', 0.9)} scale={[0.24, 0.015, 0.12]} position={[0.46, 2.265, 0]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Traffic and people
// ---------------------------------------------------------------------------

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface Mover {
  lane: number
  speed: number
  offset: number
  color: string
  kind: VehicleKind
}

/** Real-world paints (white, silver and black outnumber everything else on a real street), one city bus. */
const CARS: readonly Mover[] = [
  { lane: 0, speed: 2.6, offset: 0, color: '#2e4a78', kind: 'sedan' },
  { lane: 0, speed: 2.2, offset: 27, color: '#ecebe7', kind: 'suv' },
  { lane: 0, speed: 1.7, offset: 52, color: '#e9a92a', kind: 'bus' },
  { lane: 1, speed: 2.4, offset: 12, color: '#9b2b2b', kind: 'hatch' },
  { lane: 1, speed: 2.9, offset: 40, color: '#b9bdc3', kind: 'sedan' },
  { lane: 1, speed: 2.1, offset: 66, color: '#f2f1ed', kind: 'van' },
]

/** traffic 'thin' (lowPower): every other car and walker. */
const THIN_CARS = CARS.filter((_, i) => i % 2 === 0)

const TRIM = '#26272b'
const TYRE = '#1b1b1e'
const RIM = '#c9ccd6'
const GLASS = '#18202a'

function Vehicle({ m }: { m: Mover }) {
  const spec = vehicleSpec(m.kind)
  const geo = vehicleGeos(m.kind)
  const paint = mat(m.color, 'paint')
  const bus = m.kind === 'bus'
  const half = spec.width / 2
  const wz = half - spec.tyreW / 2 - 0.02
  const glassTop = Math.max(...spec.glass.map((p) => p[1]))
  const glassBot = Math.min(...spec.glass.map((p) => p[1]))
  const front = spec.head[0]
  const back = spec.tail[0]
  const root = useRef<THREE.Group>(null)
  useBake(root, [m])
  return (
    <group ref={root}>
      <mesh geometry={geo.body} material={paint} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={mat(GLASS, 'glass')} castShadow />
      <mesh geometry={geo.roof} material={paint} castShadow />
      {/* pillars between the side windows */}
      {spec.pillars.map((x) => (
        <mesh key={x} geometry={GEO.box} material={paint} scale={[bus ? 0.1 : 0.07, glassTop - glassBot, spec.width - (bus ? 0.02 : 0.08)]} position={[x, (glassTop + glassBot) / 2, 0]} />
      ))}
      {/* sills and bumpers: black plastic */}
      <mesh geometry={GEO.box} material={mat(TRIM, 'rubber')} scale={[spec.len * 0.98, 0.07, spec.width + 0.01]} position={[0, spec.body[0]![1] + 0.02, 0]} />
      <mesh geometry={GEO.box} material={mat(TRIM, 'rubber')} scale={[0.08, 0.1, spec.width * 0.92]} position={[front + 0.03, spec.body[0]![1] + 0.08, 0]} />
      <mesh geometry={GEO.box} material={mat(TRIM, 'rubber')} scale={[0.08, 0.1, spec.width * 0.92]} position={[back - 0.03, spec.body[0]![1] + 0.08, 0]} />
      {/* grille */}
      <mesh geometry={GEO.box} material={mat(TRIM)} scale={[0.02, 0.07, spec.width * 0.42]} position={[front + 0.04, spec.head[1] - 0.04, 0]} />
      {/* lamps */}
      {[-1, 1].map((sz) => (
        <group key={sz}>
          <mesh geometry={GEO.box} material={glowMat('#fff6de', 0.9)} scale={[0.03, 0.06, 0.2]} position={[front + 0.02, spec.head[1], sz * (half - 0.16)]} />
          <mesh geometry={GEO.box} material={glowMat('#d8322c', 0.8)} scale={[0.03, 0.06, 0.18]} position={[back - 0.02, spec.tail[1], sz * (half - 0.15)]} />
          {!bus && <mesh geometry={GEO.box} material={paint} scale={[0.07, 0.05, 0.08]} position={[spec.glass[0]![0] - 0.06, spec.glass[0]![1] + 0.06, sz * (half + 0.03)]} />}
        </group>
      ))}
      {/* wheels */}
      {spec.axles.map((ax) =>
        [-1, 1].map((sz) => (
          <group key={`${ax}${sz}`} position={[ax, spec.wheelR, sz * wz]}>
            <mesh geometry={tyreGeo(spec.wheelR, spec.tyreW)} material={mat(TYRE, 'rubber')} castShadow />
            <mesh geometry={rimGeo(spec.wheelR)} material={mat(RIM)} position={[0, 0, sz * (spec.tyreW / 2 - 0.005)]} />
          </group>
        )),
      )}
    </group>
  )
}

const WALKERS: readonly { side: 0 | 1; speed: number; offset: number; color: string }[] = [
  { side: 0, speed: 0.6, offset: 0, color: '#9a4a66' },
  { side: 0, speed: -0.5, offset: 21, color: '#2f6b5e' },
  { side: 1, speed: 0.55, offset: 9, color: '#c98a2b' },
  { side: 1, speed: -0.45, offset: 33, color: '#3e3c48' },
  { side: 0, speed: 0.5, offset: 45, color: '#5d7fa8' },
]

const THIN_WALKERS = WALKERS.filter((_, i) => i % 2 === 0)

/** A passer-by: the office's own person model, so the street and the staff are one cast. */
function walkerLook(color: string, i: number): CharacterLook {
  return { body: color, skin: SKIN_TONES[i % SKIN_TONES.length]!, hair: HAIR_COLORS[(i * 3) % HAIR_COLORS.length]!, hairStyle: i % 3, accessories: i % 2 ? ['briefcase'] : [], legs: i % 2 ? '#2f3344' : '#3d5378' }
}

function Walker({ color, i, rig }: { color: string; i: number; rig: Rig }) {
  const look = useMemo(() => walkerLook(color, i), [color, i])
  return <CharacterModel look={look} rig={rig} />
}

/** Moving traffic and pedestrians over a span of the street; positions wrap so the flow never ends. The street keeps
 *  the office's clock: paused (speed 0 or a focus hold) it stands still, at 2×/3× it runs faster like the staff. */
function Flow({ lanes, walks, x0, x1, thin }: { lanes: [number, number]; walks: [number, number]; x0: number; x1: number; thin: boolean }) {
  const cars = thin ? THIN_CARS : CARS
  const walkers = thin ? THIN_WALKERS : WALKERS
  const span = x1 - x0
  const carRefs = useRef<(THREE.Group | null)[]>([])
  const people = useRef<(THREE.Group | null)[]>([])
  const rigs = useMemo(() => walkers.map(() => createRig()), [walkers])
  const place = (t: number) => {
    const wrap = (v: number) => x0 + (((v % span) + span) % span)
    cars.forEach((m, i) => {
      const g = carRefs.current[i]
      if (!g) return
      const d = m.lane === 0 ? 1 : -1
      g.position.set(wrap(d * t * m.speed + m.offset), 0, lanes[m.lane])
      g.rotation.y = d > 0 ? 0 : Math.PI
    })
    walkers.forEach((w, i) => {
      const g = people.current[i]
      if (!g) return
      const phase = t * 7 + i
      g.position.set(wrap(t * w.speed + w.offset), Math.abs(Math.sin(phase)) * 0.025, walks[w.side])
      g.rotation.y = w.speed > 0 ? Math.PI / 2 : -Math.PI / 2
      const r = rigs[i]
      if (r?.legL && r.legR && r.armL && r.armR) {
        const sw = Math.sin(phase) * 0.55
        r.legL.rotation.x = sw
        r.legR.rotation.x = -sw
        r.armL.rotation.x = -sw * 0.7
        r.armR.rotation.x = sw * 0.7
      }
    })
  }
  const speed = useGS((s) => s.time.speed)
  const held = useUi((u) => u.pauseReasons.length > 0)
  const mock = useMockState()
  const rate = mock ? 1 : held ? 0 : speedMultiplier(speed)
  const t = useRef(8)
  useFrame((_, dt) => {
    if (REDUCED) return place(8)
    t.current += Math.min(dt, 0.1) * rate
    place(t.current)
  })
  return (
    <group>
      {cars.map((m, i) => (
        <group key={i} ref={(g) => void (carRefs.current[i] = g)}>
          <Vehicle m={m} />
        </group>
      ))}
      {walkers.map((w, i) => (
        <group key={i} ref={(g) => void (people.current[i] = g)}>
          <Walker color={w.color} i={i} rig={rigs[i]!} />
        </group>
      ))}
    </group>
  )
}

export interface StreetProps {
  /** Carriageway z range. */
  road: { z0: number; z1: number }
  /** Far pavement z range (the shops stand behind it). */
  farWalk: { z0: number; z1: number }
  /** Near pavement centre (between the kerb and the office apron). */
  nearWalkZ: number
  /** x extent of the street to dress. */
  x0: number
  x1: number
  seed: string
  /** Cars and walkers (renderBudget): all, every other one, or none. */
  traffic?: 'full' | 'thin' | 'none'
}

export function Street({ road, farWalk, nearWalkZ, x0, x1, seed, traffic = 'full' }: StreetProps) {
  const row = useMemo(() => streetRow(x0, x1, seed), [x0, x1, seed])
  const lamps = useMemo(() => {
    const out: number[] = []
    for (let x = Math.ceil(x0 / 6) * 6; x < x1; x += 6) out.push(x)
    return out
  }, [x0, x1])
  const zFront = farWalk.z0 - 0.25
  const laneW = (road.z1 - road.z0) / 4
  // Shop bodies, roofs and lamps: one baked mesh (the facades keep their own textured planes).
  const statics = useRef<THREE.Group>(null)
  useBake(statics, [row, lamps, zFront, road.z1])
  return (
    <group>
      <group ref={statics}>
        {row.map((p, i) => (
          <Building key={i} {...p} zFront={zFront} />
        ))}
        {lamps.map((x) => (
          <Lamp key={x} x={x} z={road.z1 + 0.25} />
        ))}
      </group>
      {traffic !== 'none' && <Flow lanes={[road.z1 - laneW, road.z0 + laneW]} walks={[(farWalk.z0 + farWalk.z1) / 2, nearWalkZ]} x0={x0} x1={x1} thin={traffic === 'thin'} />}
    </group>
  )
}
