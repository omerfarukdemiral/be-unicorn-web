// Scene juice for the core loop beats (docs/CORE_LOOP.md §7), kept apart from Office/Npc/Character:
// - release moment: a banner over the founder desk, a light pulse, confetti (from v1 on; MVP already
//   celebrates via projectLaunched) and a wave of simple user figures walking in through the door;
// - payday: a short warm-red light pulse over the office.
// Watches state.events with its own cursor; a new game / loaded save skips the history.
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GameState, ReleaseEntry } from '../engine/types'
import { UI_TEXT } from '../content'
import { CELL } from './constants'
import { Confetti } from './Effects'
import { pathFromDoor, type XZ } from './layout'
import { CONFETTI_COLORS } from './palette'
import { celebrate, useLayout } from './sceneRegistry'
import { useGS, useUi } from './source'

const MAX_FIGURES = 8
const WALK_SPEED = 2.4 // world units / s
const FIGURE_LINGER = 1.4 // s at the spot before fading
const BANNER_MS = 3600
/** The wave (banner + figures) unmounts after this long. */
const WAVE_MS = 9000
const PULSE_MS = 1400

function text(key: string, params: Record<string, string | number>): string {
  return (UI_TEXT[key] ?? key).replace(/\{(\w+)\}/g, (m, k: string) => (params[k] === undefined ? m : String(params[k])))
}

interface Wave {
  id: number
  release: ReleaseEntry
  started: number
}

const selectEvents = (s: GameState) => s.events
const selectReleases = (s: GameState) => s.releases

export function JuiceLayer() {
  const events = useGS(selectEvents)
  const releases = useGS(selectReleases)
  const generation = useUi((u) => u.generation)
  const layout = useLayout()
  const cursor = useRef<{ generation: number; id: number } | null>(null)
  const [wave, setWave] = useState<Wave | null>(null)
  const [confetti, setConfetti] = useState(0)
  const pulse = useRef<{ at: number; color: THREE.Color } | null>(null)

  useEffect(() => {
    const maxId = events[events.length - 1]?.id ?? 0
    const c = cursor.current
    if (!c || c.generation !== generation || maxId < c.id) {
      cursor.current = { generation, id: maxId }
      return
    }
    for (const e of events) {
      if (e.id <= c.id) continue
      if (e.kind === 'release') {
        const r = releases?.find((x) => x.id === e.refId)
        if (!r) continue
        setWave({ id: e.id, release: r, started: performance.now() })
        const id = e.id
        window.setTimeout(() => setWave((w) => (w?.id === id ? null : w)), WAVE_MS)
        pulse.current = { at: performance.now(), color: new THREE.Color('#ffe7a8') }
        if (r.level >= 2) {
          setConfetti((n) => n + 1)
          celebrate(2000)
        }
      } else if (e.kind === 'payday' && (e.value ?? 0) > 0.5) {
        pulse.current = { at: performance.now(), color: new THREE.Color('#ff9a8a') }
      }
    }
    c.id = maxId
  }, [events, releases, generation])

  const desk = useMemo<XZ>(() => layout.itemCenter.get('founder')?.pos ?? layout.slotWorld.get('founder') ?? layout.center, [layout])

  // One point light over the desk; brightens for a moment on a release (warm) or payday (red).
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const l = light.current
    if (!l) return
    const p = pulse.current
    if (!p) {
      l.intensity = 0
      return
    }
    const k = (performance.now() - p.at) / PULSE_MS
    if (k >= 1) {
      pulse.current = null
      l.intensity = 0
      return
    }
    l.color.copy(p.color)
    l.intensity = 9 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k)
  })

  return (
    <>
      <pointLight ref={light} position={[desk[0], 3.2, desk[1]]} distance={CELL * 7} decay={1.6} intensity={0} />
      <Confetti trigger={confetti} origin={desk} />
      {wave && <ReleaseBanner key={wave.id} wave={wave} at={desk} />}
      {wave && <UserWave key={`w${wave.id}`} count={Math.min(MAX_FIGURES, Math.max(2, Math.round(Math.sqrt(wave.release.users))))} target={desk} />}
    </>
  )
}

function ReleaseBanner({ wave, at }: { wave: Wave; at: XZ }) {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const id = window.setTimeout(() => setOn(false), BANNER_MS)
    return () => window.clearTimeout(id)
  }, [])
  if (!on) return null
  const r = wave.release
  const level = UI_TEXT[`release.level.${Math.max(1, Math.min(5, r.level))}`] ?? String(r.level)
  return (
    <Html position={[at[0], 2.6, at[1]]} center zIndexRange={[15, 10]} wrapperClass="pointer-events-none" style={{ pointerEvents: 'none' }}>
      <div
        className="animate-pop-in whitespace-nowrap rounded-[10px] px-3 py-1.5 text-center shadow-pop"
        style={{ background: 'var(--color-brand)', color: 'var(--color-on-ink)', fontFamily: 'var(--font-ui, inherit)' }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>{text('release.banner', { level })}</div>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>{text('release.waveShort', { u: Math.round(r.users) })}</div>
      </div>
    </Html>
  )
}

interface Figure {
  path: XZ[]
  delay: number
  color: THREE.Color
}

/** Simple user figures (body + head) walking in through the door to the desk area, then fading out. */
function UserWave({ count, target }: { count: number; target: XZ }) {
  const layout = useLayout()
  const started = useRef(performance.now())
  const figures = useMemo<Figure[]>(() => {
    const out: Figure[] = []
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const spot: XZ = [target[0] + Math.cos(a) * CELL * 0.9, target[1] + Math.sin(a) * CELL * 0.9]
      out.push({
        path: [layout.door.outside, ...pathFromDoor(spot, layout)],
        delay: i * 0.22,
        color: new THREE.Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length]!),
      })
    }
    return out
  }, [count, target, layout])
  const refs = useRef<(THREE.Group | null)[]>([])
  const body = useMemo(() => new THREE.CapsuleGeometry(0.13, 0.32, 4, 8), [])
  const head = useMemo(() => new THREE.SphereGeometry(0.12, 10, 8), [])
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f1c9a5', roughness: 0.8 }), [])
  const mats = useMemo(() => figures.map((f) => new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.7 })), [figures])
  const lengths = useMemo(
    () =>
      figures.map((f) => {
        const segs: number[] = []
        for (let i = 1; i < f.path.length; i++) segs.push(Math.hypot(f.path[i]![0] - f.path[i - 1]![0], f.path[i]![1] - f.path[i - 1]![1]))
        return segs
      }),
    [figures],
  )

  useFrame(() => {
    const t = (performance.now() - started.current) / 1000
    figures.forEach((f, i) => {
      const g = refs.current[i]
      if (!g) return
      const segs = lengths[i]!
      const total = segs.reduce((a, b) => a + b, 0)
      const walked = Math.max(0, t - f.delay) * WALK_SPEED
      if (t < f.delay) {
        g.visible = false
        return
      }
      g.visible = true
      let d = Math.min(walked, total)
      let k = 0
      while (k < segs.length - 1 && d > segs[k]!) d -= segs[k++]!
      const a = f.path[k]!
      const b = f.path[k + 1] ?? a
      const u = segs[k]! > 0 ? Math.min(1, d / segs[k]!) : 1
      g.position.set(a[0] + (b[0] - a[0]) * u, 0, a[1] + (b[1] - a[1]) * u)
      const moving = walked < total
      if (moving) {
        g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1])
        g.position.y = Math.abs(Math.sin(t * 12 + i)) * 0.05
      }
      // Linger, then shrink away (they have "joined" the product).
      const after = (walked - total) / WALK_SPEED
      const fade = moving ? 1 : Math.max(0, 1 - Math.max(0, after - FIGURE_LINGER) / 0.5)
      g.scale.setScalar(fade)
      if (fade <= 0) g.visible = false
    })
  })

  return (
    <group>
      {figures.map((_, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} visible={false}>
          <mesh geometry={body} material={mats[i]} position={[0, 0.3, 0]} castShadow />
          <mesh geometry={head} material={headMat} position={[0, 0.66, 0]} castShadow />
        </group>
      ))}
    </group>
  )
}
