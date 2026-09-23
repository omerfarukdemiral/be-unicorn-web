// One-shot celebration effects: confetti burst + team cheering (PLAN §6.4).
// Watches state.events with its own cursor (does not consume ui.lastSeenEventId, which the UI owns).
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GameEvent, GameEventKind, GameState } from '../engine/types'
import { CONFETTI_COLORS } from './palette'
import { celebrate, useLayout } from './sceneRegistry'
import { useGS } from './source'

const CELEBRATE: ReadonlySet<GameEventKind> = new Set<GameEventKind>(['milestone', 'roundClosed', 'stageUp', 'projectLaunched', 'victory'])
const COUNT = 220
const LIFE = 3.6

interface Piece {
  p: THREE.Vector3
  v: THREE.Vector3
  r: THREE.Euler
  w: THREE.Vector3
}

export function Confetti({ trigger, origin }: { trigger: number; origin: [number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const started = useRef(-1)
  const pieces = useMemo<Piece[]>(
    () => Array.from({ length: COUNT }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() })),
    [],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(0.09, 0.05), [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false }), [])

  useEffect(() => {
    const m = ref.current
    if (!m) return
    const c = new THREE.Color()
    for (let i = 0; i < COUNT; i++) m.setColorAt(i, c.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]!))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [])

  const originRef = useRef(origin)
  originRef.current = origin
  useEffect(() => {
    if (trigger <= 0) return
    const origin = originRef.current
    started.current = performance.now()
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 1.2 + Math.random() * 2.6
      const piece = pieces[i]!
      piece.p.set(origin[0] + (Math.random() - 0.5) * 0.6, 2.6 + Math.random() * 0.6, origin[1] + (Math.random() - 0.5) * 0.6)
      piece.v.set(Math.cos(a) * sp, 3 + Math.random() * 3, Math.sin(a) * sp)
      piece.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      piece.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12)
    }
  }, [trigger, pieces])

  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, rawDt) => {
    const m = ref.current
    if (!m) return
    const age = (performance.now() - started.current) / 1000
    const alive = started.current > 0 && age < LIFE
    m.visible = alive
    if (!alive) return
    const dt = Math.min(rawDt, 0.05)
    for (let i = 0; i < COUNT; i++) {
      const q = pieces[i]!
      q.v.y -= 6.5 * dt
      q.v.multiplyScalar(1 - 1.6 * dt)
      q.p.addScaledVector(q.v, dt)
      if (q.p.y < 0.02) {
        q.p.y = 0.02
        q.v.set(0, 0, 0)
      } else {
        q.r.x += q.w.x * dt
        q.r.y += q.w.y * dt
        q.r.z += q.w.z * dt
      }
      tmp.position.copy(q.p)
      tmp.rotation.copy(q.r)
      const s = age > LIFE - 0.6 ? Math.max(0, (LIFE - age) / 0.6) : 1
      tmp.scale.setScalar(s)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geo, material, COUNT]} visible={false} frustumCulled={false} />
}

const selectEvents = (s: GameState) => s.events

/** Watches game events and fires celebrations. */
export function EffectsLayer() {
  const events = useGS(selectEvents)
  const layout = useLayout()
  const cursor = useRef<number | null>(null)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    const maxId = events.reduce((m: number, e: GameEvent) => Math.max(m, e.id), 0)
    // First sight skips history (loaded save); a smaller max id means a new game started.
    if (cursor.current === null || maxId < cursor.current) {
      cursor.current = maxId
      return
    }
    let fire = false
    for (const e of events) if (e.id > cursor.current && CELEBRATE.has(e.kind)) fire = true
    cursor.current = Math.max(cursor.current, maxId)
    if (fire) {
      celebrate()
      setBurst((b) => b + 1)
    }
  }, [events])

  return <Confetti trigger={burst} origin={layout.center} />
}
