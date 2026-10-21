// Icon badges over the desks (T20, Two Point's "A+ / $" pops): what the office is doing, read without a panel.
//   bug: from tech debt TECH_DEBT_BADGE up, engineers on a project pop a red bug, more often the higher the debt;
//   flow (E3): a gold ▲ now and then; sprint (E3): desks of a sprinting project pop a red arrow every SPRINT_PERIOD s.
// The plain production pop (every builder's dept ▲ every 9–13 s) is gone (P5): with 20–36 people it was a few pops a
// second that said nothing; WorkFloats.tsx names who did what instead. At most MAX_POPS pops run at once.
// Pops rise and fade (never blink in / out). All on scene time: a held world holds them, a paused game starts no new
// pops. One sprite per desk and kind, drawn from canvas textures. The persistent state badges (tired / morale / bored)
// and the lead star live on the head plate now (HeadPlates.tsx, H1); a pop is never smaller than POP_MIN_PX on screen.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Dept, Employee, GameState, PersonEffort } from '../engine/types'
import { hash01 } from './constants'
import { popScale } from './headPlate'
import { sceneTime, useLayout } from './sceneRegistry'
import { useGS } from './source'

/** Tech debt from which engineers pop bugs. */
export const TECH_DEBT_BADGE = 6

const POP_S = 1.5
const FLOW_PERIOD = 16
const BUG_PERIOD = 16
/** Fastest bug pop per desk (s), however deep the debt. */
const BUG_MIN_PERIOD = 10
const SPRINT_PERIOD = 8
/** Pops running at once over the whole office: a big team's desks no longer flicker all over (P5). */
export const MAX_POPS = 3
/** Height of a badge over the floor: above a seated head (~1.15) and its status icon. */
const Y = 1.62
const RISE = 0.35
const SIZE = 0.4
/** Smallest projected size of a pop (CSS px): 10 px badges were unreadable on a phone. */
const POP_MIN_PX = 20

export type BadgeKind = 'bug' | 'flow' | 'sprint'

/** What effort adds to the badges (E3); without it (the garage, old callers) there are no effort badges. */
export interface BadgeFx {
  day: number
  /** derived.people: empty / absent in the garage. */
  people?: Readonly<Record<string, PersonEffort>>
}

export interface DeskBadge {
  employeeId: string
  slotId: string
  dept: Dept
  kinds: BadgeKind[]
  /** Seconds between bug pops (when 'bug'). */
  bugPeriod: number
}

/** Which badges each seated employee may show (pure; the frame loop decides when a pop is on). */
export function deskBadges(employees: readonly Employee[], techDebt: number, fx?: BadgeFx): DeskBadge[] {
  const out: DeskBadge[] = []
  for (const e of employees) {
    if (!e.deskSlotId) continue
    const kinds: BadgeKind[] = []
    const building = e.status === 'working' && !!e.projectId
    const effort = fx?.people?.[e.id]
    // One output pop, only for a state worth seeing: sprint (red, quicker) > flow (gold).
    if (building && effort?.pace === 'sprint') kinds.push('sprint')
    else if (building && effort?.flow) kinds.push('flow')
    if (building && e.dept === 'eng' && techDebt >= TECH_DEBT_BADGE) kinds.push('bug')
    if (kinds.length) out.push({ employeeId: e.id, slotId: e.deskSlotId, dept: e.dept, kinds, bugPeriod: Math.max(BUG_MIN_PERIOD, BUG_PERIOD * (TECH_DEBT_BADGE / Math.max(techDebt, TECH_DEBT_BADGE))) })
  }
  return out
}

/** 0..1 through a pop that is on at scene time t, else null. Each desk has its own phase (seed). */
export function popPhase(t: number, period: number, seed: string): number | null {
  const offset = hash01(seed, 7) * period
  const k = (t + offset) % period
  return k < POP_S ? k / POP_S : null
}

// ---------------------------------------------------------------------------
// Textures: a coloured disc with a white glyph, drawn once per colour / kind.
// ---------------------------------------------------------------------------

const PX = 128
const texCache = new Map<string, THREE.Texture>()

function drawDisc(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.clearRect(0, 0, PX, PX)
  ctx.beginPath()
  ctx.arc(PX / 2, PX / 2, PX / 2 - 6, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function badgeTexture(kind: BadgeKind, color: string): THREE.Texture | null {
  const key = `${kind}|${color}`
  const hit = texCache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = PX
  const ctx = c.getContext('2d')
  if (!ctx) return null
  drawDisc(ctx, color)
  const m = PX / 2
  if (kind === 'flow' || kind === 'sprint') {
    // ▲ output arrow
    ctx.beginPath()
    ctx.moveTo(m, 30)
    ctx.lineTo(m + 26, 64)
    ctx.lineTo(m + 10, 64)
    ctx.lineTo(m + 10, 94)
    ctx.lineTo(m - 10, 94)
    ctx.lineTo(m - 10, 64)
    ctx.lineTo(m - 26, 64)
    ctx.closePath()
    ctx.fill()
  } else if (kind === 'bug') {
    ctx.lineWidth = 7
    for (const dy of [-12, 4, 20]) {
      ctx.beginPath()
      ctx.moveTo(m - 30, m + dy - 4)
      ctx.lineTo(m + 30, m + dy + 4)
      ctx.moveTo(m + 30, m + dy - 4)
      ctx.lineTo(m - 30, m + dy + 4)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.ellipse(m, m + 6, 17, 24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(m, m - 24, 11, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  texCache.set(key, tex)
  return tex
}

const BADGE_COLOR: Record<BadgeKind, string> = { bug: '#e0533d', flow: '#f5c542', sprint: '#e2574c' }

function material(kind: BadgeKind): THREE.SpriteMaterial {
  const color = BADGE_COLOR[kind]
  return new THREE.SpriteMaterial({ map: badgeTexture(kind, color), transparent: true, depthWrite: false, opacity: 0 })
}

// ---------------------------------------------------------------------------

const select = (s: GameState) => [s.employees, s.techDebt, s.time.speed, s.derived.people, Math.floor(s.time.day)] as const

interface Live {
  sprite: THREE.Sprite | null
  kind: BadgeKind
  /** A pop that started keeps going to its end, even if its reason is gone. */
  popping: boolean
}

function Badge({ id, kind, pos, register }: { id: string; kind: BadgeKind; pos: [number, number]; register: (key: string, kind: BadgeKind, s: THREE.Sprite | null) => void }) {
  const mat = useMemo(() => material(kind), [kind])
  // The material is this badge's own (its map is the shared cached texture, left alone): freed with the badge (F5).
  useEffect(() => () => mat.dispose(), [mat])
  const key = `${id}|${kind}`
  return (
    <sprite
      ref={(s) => register(key, kind, s)}
      material={mat}
      position={[pos[0], Y, pos[1]]}
      scale={[SIZE, SIZE, 1]}
      renderOrder={20}
      visible={false}
    />
  )
}

/** Kinds a seated employee can ever show here: sprites stay mounted so a badge fades rather than unmounting. */
function kindsFor(dept: Dept): BadgeKind[] {
  const all: BadgeKind[] = ['flow', 'sprint']
  return dept === 'eng' ? ['bug', ...all] : all
}

export function DeskBadges() {
  const [employees, techDebt, speed, people, day] = useGS(select)
  const layout = useLayout()
  const live = useRef(new Map<string, Live>())
  /** key → period (pops) while the badge applies. */
  const on = useRef(new Map<string, number>())
  const running = useRef(speed > 0)
  running.current = speed > 0
  // A ref callback re-runs (null, then the sprite) on every render: the badge's state outlives that, and an entry
  // whose sprite stayed null through a commit (the seat is gone) is dropped by the frame loop.
  const register = useMemo(
    () => (key: string, kind: BadgeKind, s: THREE.Sprite | null) => {
      const l = live.current.get(key)
      if (l) l.sprite = s
      else if (s) live.current.set(key, { sprite: s, kind, popping: false })
    },
    [],
  )

  useMemo(() => {
    on.current.clear()
    for (const b of deskBadges(employees, techDebt, { day, people }))
      for (const kind of b.kinds) on.current.set(`${b.employeeId}|${kind}`, kind === 'bug' ? b.bugPeriod : kind === 'sprint' ? SPRINT_PERIOD : FLOW_PERIOD + hash01(b.employeeId, 5) * 4)
  }, [employees, techDebt, people, day])

  const seats = useMemo(() => {
    const out: { id: string; dept: Dept; pos: [number, number] }[] = []
    for (const e of employees) {
      if (!e.deskSlotId) continue
      const c = layout.itemCenter.get(e.deskSlotId)?.pos ?? layout.slotWorld.get(e.deskSlotId)
      if (c) out.push({ id: e.id, dept: e.dept, pos: [c[0], c[1]] })
    }
    return out
  }, [employees, layout])

  const camera = useThree((st) => st.camera)
  const size = useThree((st) => st.size)
  const base = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const t = sceneTime.t
    // Projected size of one world unit at the scene centre: a pop is scaled up to POP_MIN_PX on small screens.
    base.set(0, Y, 0).project(camera)
    const y0 = (1 - base.y) * (size.height / 2)
    base.set(0, Y + 1, 0).project(camera)
    const pxPerUnit = Math.abs(y0 - (1 - base.y) * (size.height / 2))
    const floor = popScale(SIZE, pxPerUnit, POP_MIN_PX)
    let popping = 0
    for (const l of live.current.values()) if (l.popping) popping++
    for (const [key, l] of live.current) {
      const s = l.sprite
      if (!s) {
        live.current.delete(key)
        continue
      }
      const mat = s.material
      const period = on.current.get(key)
      const ph = popPhase(t, period ?? (l.kind === 'bug' ? BUG_PERIOD : l.kind === 'sprint' ? SPRINT_PERIOD : FLOW_PERIOD), key)
      if (ph === null) l.popping = false
      // A pop starts only while its reason holds and time runs; once started it runs to its end.
      else if (!l.popping && period !== undefined && running.current && ph < 0.1 && popping < MAX_POPS) {
        l.popping = true
        popping++
      }
      if (!l.popping || ph === null) {
        s.visible = false
        continue
      }
      const grow = Math.min(1, ph / 0.18)
      const fade = ph < 0.6 ? 1 : 1 - (ph - 0.6) / 0.4
      s.visible = true
      const sc = floor * (0.6 + 0.4 * (1 - Math.pow(1 - grow, 3)))
      s.scale.set(sc, sc, 1)
      s.position.y = Y + RISE * (1 - Math.pow(1 - ph, 2))
      mat.opacity = fade
    }
  })

  return (
    <group>
      {seats.flatMap((seat) =>
        kindsFor(seat.dept).map((kind) => <Badge key={`${seat.id}|${kind}`} id={seat.id} kind={kind} pos={seat.pos} register={register} />),
      )}
    </group>
  )
}
