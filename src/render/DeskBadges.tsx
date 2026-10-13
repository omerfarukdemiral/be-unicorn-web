// Icon badges over the desks (T20, Two Point's "A+ / $" pops): what the office is doing, read without a panel.
//   production: a builder on a project now and then pops their dept's ▲ above the desk (output is happening);
//   bug: from tech debt TECH_DEBT_BADGE up, engineers on a project pop a red bug, more often the higher the debt;
//   one persistent badge per desk (tired > morale > bored): a draining battery from FATIGUE_TIRED (E3), the broken heart
//   under LOW_MORALE until morale recovers, grey "zzz" for someone with too little to do (E3);
//   flow (E3): the production pop in gold; sprint (E3): desks of a sprinting project pop every 5 s with a red arrow.
// Pops rise and fade (never blink in / out); the persistent badges scale in and out. All on scene time: a held world
// holds them, a paused game starts no new pops. One sprite per desk and kind, drawn from three canvas textures.
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import * as B from '../engine/balance'
import { onLeave } from '../engine/effort'
import type { Dept, Employee, GameState, PersonEffort } from '../engine/types'
import { damp, hash01 } from './constants'
import { DEPT_COLORS } from './palette'
import { sceneTime, useLayout } from './sceneRegistry'
import { useGS } from './source'

/** Morale below this shows the badge (the leaving / burnout statuses have their own head icons). */
export const LOW_MORALE = 35
/** Tech debt from which engineers pop bugs. */
export const TECH_DEBT_BADGE = 6

const POP_S = 1.5
const PRODUCTION_PERIOD = 9
const BUG_PERIOD = 16
const SPRINT_PERIOD = 5
/** Height of a badge over the floor: above a seated head (~1.15) and its status icon. */
const Y = 1.62
const RISE = 0.35
const SIZE = 0.4

export type BadgeKind = 'production' | 'bug' | 'morale' | 'tired' | 'bored' | 'flow' | 'sprint'

/** The kinds that stay on while their reason holds (one per desk); the rest are pops. */
export const PERSISTENT: ReadonlySet<BadgeKind> = new Set<BadgeKind>(['morale', 'tired', 'bored'])

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
    // One production pop: sprint (red, quicker) > flow (gold) > the dept's own.
    if (building) kinds.push(effort?.pace === 'sprint' ? 'sprint' : effort?.flow ? 'flow' : 'production')
    if (building && e.dept === 'eng' && techDebt >= TECH_DEBT_BADGE) kinds.push('bug')
    const persistent = persistentBadge(e, fx)
    if (persistent) kinds.push(persistent)
    if (kinds.length) out.push({ employeeId: e.id, slotId: e.deskSlotId, dept: e.dept, kinds, bugPeriod: Math.max(5, BUG_PERIOD * (TECH_DEBT_BADGE / Math.max(techDebt, TECH_DEBT_BADGE))) })
  }
  return out
}

/** The one badge that stays: tired (fatigue ≥ FATIGUE_TIRED) > morale (broken heart) > bored (under UNDERLOAD). The leaving / burnout heads speak for themselves. */
export function persistentBadge(e: Employee, fx?: BadgeFx): BadgeKind | null {
  if (e.status === 'leaving' || e.status === 'burnout') return null
  const effort = !!fx?.people?.[e.id]
  if (effort && fx && !onLeave(e, fx.day) && (e.fatigue ?? 0) >= B.FATIGUE_TIRED) return 'tired'
  if (e.morale < LOW_MORALE) return 'morale'
  if (effort && fx && !onLeave(e, fx.day) && e.dept !== 'sales' && e.status !== 'onboarding' && (e.loadAvg ?? 1) < B.UNDERLOAD) return 'bored'
  return null
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
  if (kind === 'production' || kind === 'flow' || kind === 'sprint') {
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
  } else if (kind === 'tired') {
    // draining battery: outline, nub, one low bar
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.roundRect(m - 32, m - 18, 58, 38, 7)
    ctx.stroke()
    ctx.fillRect(m + 28, m - 8, 8, 18)
    ctx.fillRect(m - 25, m - 11, 14, 24)
  } else if (kind === 'bored') {
    // "zzz"
    ctx.lineWidth = 8
    for (const [x, y, w] of [[m - 30, m - 6, 20], [m - 6, m - 22, 26], [m - 2, m + 8, 20]] as const) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w, y)
      ctx.lineTo(x, y + w * 0.9)
      ctx.lineTo(x + w, y + w * 0.9)
      ctx.stroke()
    }
  } else {
    // broken heart
    ctx.beginPath()
    ctx.moveTo(m, 96)
    ctx.bezierCurveTo(m - 44, 70, m - 40, 30, m - 18, 32)
    ctx.bezierCurveTo(m - 8, 33, m - 2, 40, m, 46)
    ctx.bezierCurveTo(m + 2, 40, m + 8, 33, m + 18, 32)
    ctx.bezierCurveTo(m + 40, 30, m + 44, 70, m, 96)
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(m, 46)
    ctx.lineTo(m - 7, 60)
    ctx.lineTo(m + 6, 70)
    ctx.lineTo(m - 2, 86)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  texCache.set(key, tex)
  return tex
}

const BADGE_COLOR: Record<Exclude<BadgeKind, 'production'>, string> = { bug: '#e0533d', morale: '#5b8fd9', tired: '#f0a03c', bored: '#9aa3b2', flow: '#f5c542', sprint: '#e2574c' }

function material(kind: BadgeKind, dept: Dept): THREE.SpriteMaterial {
  const color = kind === 'production' ? DEPT_COLORS[dept] : BADGE_COLOR[kind]
  return new THREE.SpriteMaterial({ map: badgeTexture(kind, color), transparent: true, depthWrite: false, opacity: 0 })
}

// ---------------------------------------------------------------------------

const select = (s: GameState) => [s.employees, s.techDebt, s.time.speed, s.derived.people, Math.floor(s.time.day)] as const

interface Live {
  sprite: THREE.Sprite | null
  kind: BadgeKind
  /** A persistent badge's scale, damped toward 1 while it applies and 0 after, so it never blinks out. */
  k: number
  /** A pop that started keeps going to its end, even if its reason is gone. */
  popping: boolean
}

function Badge({ id, dept, kind, pos, register }: { id: string; dept: Dept; kind: BadgeKind; pos: [number, number]; register: (key: string, kind: BadgeKind, s: THREE.Sprite | null) => void }) {
  const mat = useMemo(() => material(kind, dept), [kind, dept])
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
  const all: BadgeKind[] = ['production', 'flow', 'sprint', 'morale', 'tired', 'bored']
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
      else if (s) live.current.set(key, { sprite: s, kind, k: 0, popping: false })
    },
    [],
  )

  useMemo(() => {
    on.current.clear()
    for (const b of deskBadges(employees, techDebt, { day, people }))
      for (const kind of b.kinds) on.current.set(`${b.employeeId}|${kind}`, kind === 'bug' ? b.bugPeriod : kind === 'sprint' ? SPRINT_PERIOD : PRODUCTION_PERIOD + hash01(b.employeeId, 5) * 4)
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

  useFrame((_, rawDt) => {
    const t = sceneTime.t
    const dt = sceneTime.held ? 0 : Math.min(rawDt, 0.1)
    for (const [key, l] of live.current) {
      const s = l.sprite
      if (!s) {
        live.current.delete(key)
        continue
      }
      const mat = s.material
      const period = on.current.get(key)
      if (PERSISTENT.has(l.kind)) {
        l.k = damp(l.k, period !== undefined ? 1 : 0, 8, dt)
        s.visible = l.k > 0.01
        s.scale.set(SIZE * l.k, SIZE * l.k, 1)
        s.position.y = Y + Math.sin(t * 2 + hash01(key, 3) * 6) * 0.03
        mat.opacity = Math.min(1, l.k * 1.2)
        continue
      }
      const ph = popPhase(t, period ?? (l.kind === 'bug' ? BUG_PERIOD : l.kind === 'sprint' ? SPRINT_PERIOD : PRODUCTION_PERIOD), key)
      if (ph === null) l.popping = false
      // A pop starts only while its reason holds and time runs; once started it runs to its end.
      else if (!l.popping) l.popping = period !== undefined && running.current && ph < 0.1
      if (!l.popping || ph === null) {
        s.visible = false
        continue
      }
      const grow = Math.min(1, ph / 0.18)
      const fade = ph < 0.6 ? 1 : 1 - (ph - 0.6) / 0.4
      s.visible = true
      const sc = SIZE * (0.6 + 0.4 * (1 - Math.pow(1 - grow, 3)))
      s.scale.set(sc, sc, 1)
      s.position.y = Y + RISE * (1 - Math.pow(1 - ph, 2))
      mat.opacity = fade
    }
  })

  return (
    <group>
      {seats.flatMap((seat) =>
        kindsFor(seat.dept).map((kind) => <Badge key={`${seat.id}|${kind}`} id={seat.id} dept={seat.dept} kind={kind} pos={seat.pos} register={register} />),
      )}
    </group>
  )
}
