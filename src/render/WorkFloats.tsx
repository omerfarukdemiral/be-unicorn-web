// Work floats (P5): every few real seconds one seated person shows what their team's recent work gave, over their head
// where their plate sits (the plate steps aside for it): dept icon, first name, the effect. At most MAX_LIVE at once,
// each FLOAT_MS long with a slow rise. Picked by workPicker.ts. Scene time: a held world holds them; a paused game,
// a covered scene or the end of the run starts none.
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Vector3 } from 'three'
import type { Dept } from '../engine/types'
import { shortName } from './headPlate'
import { useHtmlPortal } from './htmlPortal'
import { DEPT_COLORS } from './palette'
import { DEPT_PATH } from './plateIcons'
import { sceneTime, seatedRegistry, speakerPositions, useSceneTimers } from './sceneRegistry'
import { getGS, useMockState, useSceneCovered, useUi } from './source'
import { FOUNDER, WorkFloatPicker, type WorkKind } from './workPicker'

/** A float's life (ms of scene time): long enough to read a name and a number. */
export const FLOAT_MS = 2800
/** A new float is considered this often (s of scene time); with FLOAT_MS that is mostly one, never more than MAX_LIVE. */
export const PICK_EVERY_S = 3.4
export const MAX_LIVE = 2
/** Same anchor as the head plate (HeadPlates ANCHOR_Y): the float takes the plate's place. */
const ANCHOR_Y = 1.42
/** Floats stay off the screen's outer band (NDC): a float half off the phone is no help. */
const EDGE_NDC = 0.86
/** A float's rough box over its anchor (px): half its width and its height, plus a margin, kept off every bubble. */
const HALF_W = 70
const BOX_H = 32

interface Live {
  id: number
  personId: string
  name: string
  dept: Dept
  kind: WorkKind
  text: string
  at: [number, number]
}

const TONE: Record<WorkKind, string> = {
  project: 'var(--color-ink)',
  version: 'var(--color-ink)',
  module: 'var(--color-ink)',
  users: 'var(--color-g-users)',
  kept: 'var(--color-g-users)',
  cash: 'var(--color-g-cash)',
}

const tmp = new Vector3()

export function WorkFloats() {
  const portal = useHtmlPortal()
  const mock = useMockState()
  const covered = useSceneCovered()
  const paused = useUi((u) => u.pauseReasons.length > 0)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const [picker] = useState(() => new WorkFloatPicker())
  if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __work: WorkFloatPicker }).__work = picker
  const [floats, setFloats] = useState<Live[]>([])
  const live = useRef<Live[]>([])
  live.current = floats
  const next = useRef(0)
  const seq = useRef(0)
  const later = useSceneTimers()
  const gate = useRef({ covered })
  gate.current = { covered }

  useFrame(() => {
    if (mock) return
    const t = sceneTime.t
    if (t < next.current) return
    next.current = t + PICK_EVERY_S
    const s = getGS(null)
    picker.accrue(s)
    // The desk's own floats (payday, a user wave: Juice.tsx) count too: never more than MAX_LIVE floats in the scene.
    const desk = document.querySelectorAll('[data-juice-float] > *').length
    if (s.gameOver || s.time.speed <= 0 || gate.current.covered || live.current.length + desk >= MAX_LIVE) return
    // People who have their own bubble up keep it, and a float never lands on a bubble (they win, it would hide under one).
    const owners = new Set<string>()
    const c = gl.domElement.getBoundingClientRect()
    const rects: { l: number; r: number; t: number; b: number }[] = []
    for (const el of document.querySelectorAll<HTMLElement>('[data-bubble-key]')) {
      if (el.style.visibility === 'hidden' || el.style.opacity === '0') continue
      if (el.dataset.bubbleSpeaker) owners.add(el.dataset.bubbleSpeaker)
      const q = el.getBoundingClientRect()
      if (q.width > 0 && q.height > 0) rects.push({ l: q.left - c.left, r: q.right - c.left, t: q.top - c.top, b: q.bottom - c.top })
    }
    const busy = new Set(live.current.map((f) => f.personId))
    const canShow = (id: string) => {
      if (busy.has(id) || owners.has(id)) return false
      const p = speakerPositions.get(id)
      if (!p || !(id === FOUNDER ? p.visible && !p.walking : seatedRegistry.get(id))) return false
      tmp.set(p.x, ANCHOR_Y, p.z).project(camera)
      if (!(Math.abs(tmp.x) < EDGE_NDC && tmp.y < EDGE_NDC && tmp.y > -EDGE_NDC && tmp.z < 1)) return false
      const x = (tmp.x + 1) * (size.width / 2)
      const y = (1 - tmp.y) * (size.height / 2)
      return !rects.some((q) => x - HALF_W < q.r && q.l < x + HALF_W && y - BOX_H < q.b && q.t < y + 2)
    }
    const got = picker.pick(s, canShow)
    if (!got) return
    const p = speakerPositions.get(got.personId)!
    const e = s.employees.find((x) => x.id === got.personId)
    const f: Live = { id: ++seq.current, personId: got.personId, name: e ? shortName(e.name) : got.personId === FOUNDER ? 'Sen' : '', dept: got.dept, kind: got.kind, text: got.text, at: [p.x, p.z] }
    setFloats((cur) => [...cur, f].slice(-MAX_LIVE))
    later(FLOAT_MS, () => setFloats((cur) => cur.filter((x) => x.id !== f.id)))
  })

  if (!floats.length) return null
  return (
    <>
      {floats.map((f) => (
        <Html key={f.id} portal={portal} position={[f.at[0], ANCHOR_Y, f.at[1]]} zIndexRange={[13, 10]} wrapperClass="pointer-events-none" style={{ pointerEvents: 'none' }}>
          <div data-work-float={f.personId} style={{ transform: 'translate(-50%, -100%)', visibility: covered ? 'hidden' : undefined }}>
            <div
              className="tabular flex items-center gap-1 whitespace-nowrap rounded-lg bg-surface px-1.5 py-1 leading-none shadow-pop"
              style={{ animation: `work-float ${FLOAT_MS}ms ease-out both`, animationPlayState: paused ? 'paused' : 'running' }}
            >
              <span className="grid size-[18px] shrink-0 place-items-center rounded-full" style={{ background: DEPT_COLORS[f.dept] }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {DEPT_PATH[f.dept]}
                </svg>
              </span>
              {f.name && <span className="text-[11px] font-semibold text-ink-2">{f.name}</span>}
              <span className="text-[13px] font-bold" style={{ color: TONE[f.kind] }}>
                {f.text}
              </span>
            </div>
          </div>
        </Html>
      ))}
    </>
  )
}
