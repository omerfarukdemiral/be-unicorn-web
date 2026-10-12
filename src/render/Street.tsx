// The valley street (Silicon Valley vibe): across the road from the office door a row of startup-world businesses
// (VC fund, accelerator, big-tech glass HQ, coworking, the founders' café; all names invented), street lamps on
// the near kerb, cars and a bus in both lanes and a few people on the pavements. Everything sits on the −z side
// behind the office, so nothing here can hide a desk (the camera frames the office box only, frameFit).
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { hash01 } from './constants'
import { PASTEL } from './palette'
import { GEO, glowMat, mat } from './resources'
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

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.cyl} material={mat('#5b5866')} scale={[0.07, 1.9, 0.07]} position={[0, 0.95, 0]} />
      <mesh geometry={GEO.box} material={mat('#5b5866')} scale={[0.36, 0.05, 0.08]} position={[0.14, 1.88, 0]} />
      <mesh geometry={GEO.sphere} material={glowMat('#fff2c4', 0.6)} scale={[0.16, 0.12, 0.16]} position={[0.28, 1.82, 0]} />
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
  bus?: boolean
}

const CARS: readonly Mover[] = [
  { lane: 0, speed: 2.6, offset: 0, color: '#3f7fe8' },
  { lane: 0, speed: 2.2, offset: 27, color: '#fdfcf8' },
  { lane: 0, speed: 1.7, offset: 52, color: '#ffcf3d', bus: true },
  { lane: 1, speed: 2.4, offset: 12, color: '#e0483e' },
  { lane: 1, speed: 2.9, offset: 40, color: '#14a98f' },
  { lane: 1, speed: 2.1, offset: 66, color: '#6b4ef0' },
]

/** lowPower from stage 4: every other car and walker (the street is backdrop at that point). */
const THIN_CARS = CARS.filter((_, i) => i % 2 === 0)

function Vehicle({ m }: { m: Mover }) {
  const len = m.bus ? 3.2 : 1.5
  const h = m.bus ? 1.0 : 0.4
  return (
    <group>
      <mesh geometry={GEO.box} material={mat(m.color)} scale={[len, h, 0.78]} position={[0, 0.14 + h / 2, 0]} />
      {m.bus ? (
        <mesh geometry={GEO.box} material={mat('#bfe3ff')} scale={[len * 0.86, 0.3, 0.8]} position={[0.05, 0.86, 0]} />
      ) : (
        <>
          <mesh geometry={GEO.box} material={mat(m.color)} scale={[len * 0.52, 0.3, 0.66]} position={[-0.08, 0.69, 0]} />
          <mesh geometry={GEO.box} material={mat('#bfe3ff')} scale={[len * 0.54, 0.2, 0.68]} position={[-0.08, 0.68, 0]} />
        </>
      )}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={GEO.cyl} material={mat('#2b2a33')} scale={[0.3, 0.12, 0.3]} position={[sx * len * 0.32, 0.15, sz * 0.38]} rotation={[Math.PI / 2, 0, 0]} />
        )),
      )}
    </group>
  )
}

const WALKERS: readonly { side: 0 | 1; speed: number; offset: number; color: string }[] = [
  { side: 0, speed: 0.6, offset: 0, color: '#d9529b' },
  { side: 0, speed: -0.5, offset: 21, color: '#14a98f' },
  { side: 1, speed: 0.55, offset: 9, color: '#f5a81c' },
  { side: 1, speed: -0.45, offset: 33, color: '#3e3c48' },
  { side: 0, speed: 0.5, offset: 45, color: '#86bdf7' },
]

const THIN_WALKERS = WALKERS.filter((_, i) => i % 2 === 0)

function Walker({ color }: { color: string }) {
  return (
    <group>
      <mesh geometry={GEO.cyl} material={mat(color)} scale={[0.26, 0.55, 0.2]} position={[0, 0.5, 0]} />
      <mesh geometry={GEO.cyl} material={mat('#3e3c48')} scale={[0.2, 0.25, 0.16]} position={[0, 0.13, 0]} />
      <mesh geometry={GEO.sphere} material={mat('#f0c39b')} scale={[0.22, 0.22, 0.22]} position={[0, 0.9, 0]} />
    </group>
  )
}

/** Moving traffic and pedestrians over a span of the street; positions wrap so the flow never ends. The street keeps
 *  the office's clock: paused (speed 0 or a focus hold) it stands still, at 2×/3× it runs faster like the staff. */
function Flow({ lanes, walks, x0, x1, thin }: { lanes: [number, number]; walks: [number, number]; x0: number; x1: number; thin: boolean }) {
  const cars = thin ? THIN_CARS : CARS
  const walkers = thin ? THIN_WALKERS : WALKERS
  const span = x1 - x0
  const carRefs = useRef<(THREE.Group | null)[]>([])
  const people = useRef<(THREE.Group | null)[]>([])
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
      g.position.set(wrap(t * w.speed + w.offset), Math.abs(Math.sin(t * 6 + i)) * 0.04, walks[w.side])
      g.rotation.y = w.speed > 0 ? Math.PI / 2 : -Math.PI / 2
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
          <Walker color={w.color} />
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
  /** Halve cars and walkers (lowPower at stage >= 4). */
  thin?: boolean
}

export function Street({ road, farWalk, nearWalkZ, x0, x1, seed, thin = false }: StreetProps) {
  const row = useMemo(() => streetRow(x0, x1, seed), [x0, x1, seed])
  const lamps = useMemo(() => {
    const out: number[] = []
    for (let x = Math.ceil(x0 / 6) * 6; x < x1; x += 6) out.push(x)
    return out
  }, [x0, x1])
  const zFront = farWalk.z0 - 0.25
  const laneW = (road.z1 - road.z0) / 4
  return (
    <group>
      {row.map((p, i) => (
        <Building key={i} {...p} zFront={zFront} />
      ))}
      {lamps.map((x) => (
        <Lamp key={x} x={x} z={road.z1 + 0.25} />
      ))}
      <Flow lanes={[road.z1 - laneW, road.z0 + laneW]} walks={[(farWalk.z0 + farWalk.z1) / 2, nearWalkZ]} x0={x0} x1={x1} thin={thin} />
    </group>
  )
}
