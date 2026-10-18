// Employees and the founder as walking low-poly characters (PLAN §4.3, §7.2).
// Movement/animation is local visual state; the engine only provides status & actions.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type * as THREE from 'three'
import type { StageBand } from '../content/stageBand'
import type { Dept, Employee, FounderActionRun, Slot } from '../engine/types'
import { CELL, damp, hash01, hashString, pick, rotateXZ, yawOf } from './constants'
import { CharacterModel, StatusIcon, createRig, type Accessory, type CharacterLook } from './CharacterModel'
import { idleSpots, meetingSeats, type OfficeLayout, type XZ } from './layout'
import { DEPT_COLORS, FOUNDER_COLORS, FOUNDER_LEGS, HAIR_COLORS, HIGHLIGHT, LEG_COLORS, SKIN_TONES } from './palette'
import { GEO, HIT_MAT, flatMat } from './resources'
import { FADE_MS, fadeScale, type GhostMode } from './departing'
import { clearSpeaker, hoveredPerson, isCelebrating, sceneTime, seatedRegistry, setLastPos, setSpeakerPos, speakerPositions, type LastPos } from './sceneRegistry'
import { STAND, hold, release, reserve } from './spots'
import { fromBubble } from './bubbleHit'
import { LEGS_BY_BAND } from './stageLook'
import { spawnCurve } from './useSpawnScale'
import { Mover, doorScale, overlayYawn, poseCheer, poseSip, poseSit, poseStand, poseWalk, settle, speedMultiplier } from './walker'

const HEAD_Y = 1.05

/** `band` (G2) dresses the same person for a bigger company; band 1 is exactly today's look. The shirt stays the department's colour. */
export function employeeLook(id: string, dept: Dept, band: StageBand = 1): CharacterLook {
  const acc: Accessory[] = []
  const r = hash01(id, 3)
  if (dept === 'eng' && r < 0.6) acc.push('headphones')
  if (dept === 'product' && r < 0.55) acc.push('glasses')
  if (dept === 'marketing' && r < 0.35) acc.push('cap')
  if (dept === 'sales' && r < 0.6) acc.push('tie')
  if (dept === 'ops' && r < 0.3) acc.push('glasses')
  return {
    body: DEPT_COLORS[dept],
    skin: pick(SKIN_TONES, id, 1),
    hair: pick(HAIR_COLORS, id, 2),
    hairStyle: hashString(`${id}#4`) % 4,
    accessories: acc,
    legs: LEGS_BY_BAND[band] ?? pick(LEG_COLORS, id, 5),
  }
}

export const FOUNDER_LOOK: CharacterLook = {
  body: FOUNDER_COLORS.body,
  skin: SKIN_TONES[1],
  hair: HAIR_COLORS[1],
  hairStyle: 0,
  accessories: ['horn'],
  legs: FOUNDER_LEGS,
  scale: 1.06,
}

/** The founder at the top band wears a tie (G2); other bands are FOUNDER_LOOK itself. */
const FOUNDER_LOOK_TIE: CharacterLook = { ...FOUNDER_LOOK, accessories: [...FOUNDER_LOOK.accessories, 'tie'] }
export function founderLook(band: StageBand = 1): CharacterLook {
  return band >= 3 ? FOUNDER_LOOK_TIE : FOUNDER_LOOK
}

/** Seat position and facing for a desk slot. */
export function seatOf(slot: Slot | undefined, layout: OfficeLayout): { pos: XZ; yaw: number } | null {
  if (!slot) return null
  const base = layout.slotWorld.get(slot.id)
  if (!base) return null
  const [ox, oz] = rotateXZ(0, 0.32 * CELL, slot.rotation)
  return { pos: [base[0] + ox, base[1] + oz], yaw: yawOf(slot.rotation) + Math.PI }
}

function randomIn(layout: OfficeLayout, seed: string, n: number): XZ {
  const b = layout.walkBox
  return [b.minX + (b.maxX - b.minX) * hash01(seed, n * 2), b.minZ + (b.maxZ - b.minZ) * hash01(seed, n * 2 + 1)]
}

/** Where a resigning person waits: either side of the door, leaving the doorway itself clear. */
const DOOR_OFFSETS: XZ[] = [
  [-0.55, 0.15],
  [0.55, 0.15],
  [-1.1, 0.2],
  [1.1, 0.2],
  [-0.55, 0.75],
  [0.55, 0.75],
  [-1.1, 0.8],
  [1.1, 0.8],
]
const doorCache = new WeakMap<OfficeLayout, XZ[]>()
function doorSpots(L: OfficeLayout): XZ[] {
  let out = doorCache.get(L)
  if (!out) {
    const b = L.walkBox
    const [x, z] = L.door.inside
    out = DOOR_OFFSETS.map(([dx, dz]): XZ => [x + dx, z + dz]).filter((p) => p[0] > b.minX && p[0] < b.maxX && p[1] > b.minZ && p[1] < b.maxZ)
    if (out.length === 0) out = [[x, z + 0.15]]
    doorCache.set(L, out)
  }
  return out
}

/** Lounge spots starting at a per-person one, so a break spreads people over the coffee corners. */
function loungeFor(L: OfficeLayout, id: string): XZ[] {
  const n = L.lounge.length
  const k = hashString(id) % n
  return n <= 1 ? L.lounge : [...L.lounge.slice(k), ...L.lounge.slice(0, k)]
}

/** Someone on a break stands in the lounge; with no common area (a leave in an office without one) they step out of the door. */
export function breakMode(hasLounge: boolean): 'lounge' | 'away' {
  return hasLounge ? 'lounge' : 'away'
}

function loungeYawOf(L: OfficeLayout, p: XZ): number {
  const i = L.lounge.indexOf(p)
  return i >= 0 ? (L.loungeYaw[i] ?? Math.PI) : Math.PI
}

function idleSpotOf(L: OfficeLayout, id: string): XZ {
  return reserve(STAND, id, idleSpots(L)) ?? L.door.inside
}

/** Character scale after a stage-move teleport: grows back in instead of blinking into the new office. */
function useRespawn(): { mark: () => void; scale: () => number } {
  const at = useRef(-1)
  return useMemo(
    () => ({
      mark: () => void (at.current = performance.now()),
      scale: () => {
        if (at.current < 0) return 1
        const s = spawnCurve(performance.now() - at.current)
        if (s >= 1) at.current = -1
        return s
      },
    }),
    [],
  )
}

interface HitProps {
  onSelect: () => void
  selected: boolean
  /** Registered as hoveredPerson while the pointer is over it (their head plate stays whole). */
  hoverId?: string
}

function HitAndRing({ onSelect, selected, hoverId }: HitProps) {
  // The selection ring is always mounted and grows / shrinks (damped) instead of blinking.
  const ring = useRef<THREE.Mesh>(null)
  const k = useRef(selected ? 1 : 0)
  const want = useRef(selected)
  want.current = selected
  useFrame((_, rawDt) => {
    const m = ring.current
    if (!m) return
    k.current = damp(k.current, want.current ? 1 : 0, 12, Math.min(rawDt, 0.1))
    const s = 0.8 * Math.max(0.001, k.current)
    m.scale.set(s, 1, s)
    m.visible = k.current > 0.01
  })
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 10 || fromBubble(e.nativeEvent)) return
    e.stopPropagation()
    onSelect()
  }
  return (
    <>
      <mesh
        geometry={GEO.box}
        material={HIT_MAT}
        scale={[0.6, 1.3, 0.6]}
        position={[0, 0.65, 0]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          if (hoverId) hoveredPerson.id = hoverId
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
          if (hoverId && hoveredPerson.id === hoverId) hoveredPerson.id = null
        }}
      />
      <mesh ref={ring} geometry={GEO.ring} material={flatMat(HIGHLIGHT.selected, 0.9)} scale={selected ? [0.8, 1, 0.8] : [0.001, 1, 0.001]} visible={selected} position={[0, 0.02, 0]} />
    </>
  )
}

export interface EmployeeCharacterProps {
  employee: Employee
  deskSlot: Slot | undefined
  layout: OfficeLayout
  /** The company's look band (G2): what they wear. */
  band?: StageBand
  /** Game speed multiplier (0 = paused). */
  speed: number
  /** Derived overload > 0: engineers rush. */
  overload: boolean
  /** A builder with nothing to build (idleBuilders): the "…" marker while otherwise working. */
  idle: boolean
  selected: boolean
  onSelect: (id: string) => void
}

/** Re-render only when something the JSX or the frame loop reads changes (not on every engine tick). */
function sameEmployeeProps(a: EmployeeCharacterProps, b: EmployeeCharacterProps): boolean {
  return (
    a.employee.id === b.employee.id &&
    a.employee.dept === b.employee.dept &&
    a.employee.status === b.employee.status &&
    a.deskSlot === b.deskSlot &&
    a.layout === b.layout &&
    a.band === b.band &&
    a.speed === b.speed &&
    a.overload === b.overload &&
    a.idle === b.idle &&
    a.employee.offUntil === b.employee.offUntil &&
    a.selected === b.selected &&
    a.onSelect === b.onSelect
  )
}

export const EmployeeCharacter = memo(function EmployeeCharacter(props: EmployeeCharacterProps) {
  const { employee, layout } = props
  const look = useMemo(() => employeeLook(employee.id, employee.dept, props.band), [employee.id, employee.dept, props.band])
  const rig = useMemo(createRig, [])
  const root = useRef<THREE.Group>(null)
  const icon = useRef<THREE.Group>(null)
  const seed = hash01(employee.id)
  const mover = useMemo(() => {
    const seat = seatOf(props.deskSlot, layout)
    if (employee.status === 'onboarding' || !seat) return new Mover(layout.door.outside[0], layout.door.outside[1], true)
    const m = new Mover(seat.pos[0], seat.pos[1])
    m.yaw = seat.yaw
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  mover.id = employee.id
  const latest = useRef(props)
  latest.current = props
  const stageRef = useRef(layout.stage)
  const wanderN = useRef(0)
  const respawn = useRespawn()

  useEffect(
    () => () => {
      clearSpeaker(employee.id)
      release(STAND, employee.id)
    },
    [employee.id],
  )

  useFrame(() => {
    const p = latest.current
    const L = p.layout
    const e = p.employee
    // Scene time: everything (poses, wander timers) stands still while a bubble holds the world.
    const t = sceneTime.t
    const now = t * 1000
    const dt = sceneTime.dt
    const speedMul = speedMultiplier(p.speed)
    const seat = seatOf(p.deskSlot, L)

    // Office changed (moved to a new stage): teleport to the new seat and grow back in.
    if (stageRef.current !== L.stage) {
      stageRef.current = L.stage
      if (seat) mover.teleport(seat.pos, seat.yaw)
      else mover.teleport(idleSpotOf(L, e.id))
      mover.goalKey = ''
      respawn.mark()
    }

    // Decide the goal for the current status.
    const status = e.status
    // 'leaving' walks to the door and waits there (respondResignation window).
    let mode: 'seat' | 'lounge' | 'wander' | 'door' | 'idle' | 'away' = 'idle'
    if (status === 'leaving') mode = 'door'
    else if (status === 'break') mode = breakMode(L.lounge.length > 0)
    else if (status === 'onboarding') mode = seat && hash01(e.id, Math.floor(t / 12)) < 0.3 ? 'seat' : 'wander'
    else if (seat) mode = 'seat'

    // Standing spots are reserved (spots.ts): nobody picks a point someone else already stands on.
    // A seat is held too, so a visitor never picks the point across a pod where this person sits.
    if (mode === 'seat' && seat) hold(STAND, e.id, seat.pos)
    else if (mode === 'seat' || mode === 'wander' || mode === 'away') release(STAND, e.id)
    if (mode === 'seat' && seat) {
      const key = `seat:${seat.pos[0].toFixed(2)},${seat.pos[1].toFixed(2)}`
      const burnoutYaw = Math.atan2(L.door.pos[0] - seat.pos[0], L.door.pos[1] - seat.pos[1])
      if (mover.goalKey !== key) mover.goTo(seat.pos, L, key, seat.yaw)
      mover.faceYaw = status === 'burnout' ? burnoutYaw : seat.yaw
    } else if (mode === 'away') {
      // On leave with no coffee corner: out of the door, back to the seat when the leave ends (goTo walks in from outside).
      if (mover.goalKey !== 'away') mover.exit(L, 'away')
    } else if (mode === 'lounge') {
      const spot = reserve(STAND, e.id, loungeFor(L, e.id))!
      const key = `lounge:${spot[0].toFixed(2)},${spot[1].toFixed(2)}`
      if (mover.goalKey !== key) mover.goTo(spot, L, key, loungeYawOf(L, spot))
    } else if (mode === 'door') {
      const spot = reserve(STAND, e.id, doorSpots(L))!
      const key = `door:${spot[0].toFixed(2)},${spot[1].toFixed(2)}`
      if (mover.goalKey !== key) mover.goTo(spot, L, key, Math.PI)
    } else if (mode === 'wander') {
      if (!mover.moving && (mover.goalKey !== 'wander' || now - mover.arrivedAt > 1800 + seed * 1500)) {
        wanderN.current++
        mover.goTo(randomIn(L, e.id, wanderN.current), L, 'wander', null)
      }
    } else {
      const spot = idleSpotOf(L, e.id)
      const key = `idle:${spot[0].toFixed(2)},${spot[1].toFixed(2)}`
      if (mover.goalKey !== key) mover.goTo(spot, L, key, 0.6)
    }

    const tiredMul = status === 'tired' || status === 'burnout' ? 0.55 : status === 'onboarding' ? 0.8 : 1
    // Seated people are not nudged; everyone else keeps a body's width from the rest.
    const seated = mode === 'seat' && !mover.moving && !!seat && Math.hypot(mover.x - seat.pos[0], mover.z - seat.pos[1]) < 0.05
    const moving = mover.update(dt, speedMul * tiredMul, now, seated ? null : speakerPositions)
    const atSeat = !moving && mode === 'seat' && !!seat && Math.hypot(mover.x - seat.pos[0], mover.z - seat.pos[1]) < 0.05 && mover.yawSettled
    const cheering = isCelebrating() && !mover.outside

    // Pose.
    let lift = 0
    if (cheering && !moving) lift = poseCheer(rig, t, seed)
    else if (moving) poseWalk(rig, mover.phase, status === 'tired' ? 0.35 : 0.6)
    else if (atSeat) {
      const rush = p.overload && e.dept === 'eng'
      const typing = status === 'burnout' ? 0 : status === 'tired' ? 0.45 : rush ? 2 : 1
      poseSit(rig, t, typing)
      if (rush && rig.body) rig.body.position.y = Math.abs(Math.sin(t * 16)) * 0.03
      if (status === 'tired') overlayYawn(rig, t, seed)
    } else if (mode === 'lounge') poseSip(rig, t, seed)
    else {
      poseStand(rig, t)
      if (status === 'tired') overlayYawn(rig, t, seed)
    }
    settle(rig, dt, mode === 'lounge' && !moving ? 1 : 0)

    const g = root.current
    if (g) {
      g.position.set(mover.x, lift, mover.z)
      g.rotation.y = mover.yaw
      g.visible = !mover.outside
      g.scale.setScalar(doorScale(mover.fade) * respawn.scale())
    }
    if (icon.current) {
      icon.current.position.set(mover.x, 0, mover.z)
      icon.current.visible = !mover.outside
    }
    setLastPos(e.id, mover.x, mover.z, mover.yaw, mover.outside)
    seatedRegistry.set(e.id, atSeat && !mover.outside)
    setSpeakerPos(e.id, mover.x, HEAD_Y + lift, mover.z, !mover.outside, mover.moving)
  })

  const iconKind = employee.status === 'working' && props.idle ? 'idle' : employee.status
  // Mount where the mover is (not at the origin for the first frame). The icon stays mounted so it
  // can shrink away when the status clears.
  return (
    <>
      <group ref={root} position={[mover.x, 0, mover.z]} rotation-y={mover.yaw} visible={!mover.outside} scale={doorScale(mover.fade)}>
        <CharacterModel look={look} rig={rig} />
        <HitAndRing selected={props.selected} onSelect={() => props.onSelect(employee.id)} hoverId={employee.id} />
      </group>
      <group ref={icon} position={[mover.x, 0, mover.z]} visible={!mover.outside}>
        <StatusIcon status={iconKind} />
      </group>
    </>
  )
}, sameEmployeeProps)

export interface FounderCharacterProps {
  action: FounderActionRun | undefined
  founderSlot: Slot | undefined
  deskSlots: Slot[]
  layout: OfficeLayout
  band?: StageBand
  speed: number
  selected: boolean
  onSelect: () => void
}

function sameAction(a: FounderActionRun | undefined, b: FounderActionRun | undefined): boolean {
  if (!a || !b) return a === b
  return a.kind === b.kind && a.startDay === b.startDay && a.endDay === b.endDay && a.targetId === b.targetId
}

function sameFounderProps(a: FounderCharacterProps, b: FounderCharacterProps): boolean {
  return (
    sameAction(a.action, b.action) &&
    a.founderSlot === b.founderSlot &&
    a.deskSlots === b.deskSlots &&
    a.layout === b.layout &&
    a.band === b.band &&
    a.speed === b.speed &&
    a.selected === b.selected &&
    a.onSelect === b.onSelect
  )
}

/** The founder: sits at the centre desk, walks out/in according to the current action (§4.3). */
export const FounderCharacter = memo(function FounderCharacter(props: FounderCharacterProps) {
  const rig = useMemo(createRig, [])
  const root = useRef<THREE.Group>(null)
  const icon = useRef<THREE.Group>(null)
  const mover = useMemo(() => {
    const seat = seatOf(props.founderSlot, props.layout)
    const m = seat ? new Mover(seat.pos[0], seat.pos[1]) : new Mover(0, CELL * 0.4)
    if (seat) m.yaw = seat.yaw
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  mover.id = 'founder'
  const latest = useRef(props)
  latest.current = props
  const tourIdx = useRef(0)
  const stageRef = useRef(props.layout.stage)
  const respawn = useRespawn()

  useEffect(
    () => () => {
      clearSpeaker('founder')
      release(STAND, 'founder')
    },
    [],
  )

  useFrame(() => {
    const p = latest.current
    const L = p.layout
    const t = sceneTime.t
    const now = t * 1000
    const dt = sceneTime.dt
    const speedMul = speedMultiplier(p.speed)
    const seat = seatOf(p.founderSlot, L)
    const kind = p.action?.kind

    if (stageRef.current !== L.stage) {
      stageRef.current = L.stage
      if (seat) mover.teleport(seat.pos, seat.yaw)
      mover.goalKey = ''
      respawn.mark()
    }

    let mode: 'seat' | 'exit' | 'meeting' | 'tour' | 'rest' = 'seat'
    if (kind === 'findUsers' || kind === 'salesCall' || kind === 'talkToUsers') mode = 'exit'
    else if (kind === 'investorCoffee') mode = L.meeting ? 'meeting' : 'exit'
    else if (kind === 'motivateTeam') mode = p.deskSlots.length > 0 ? 'tour' : 'seat'
    else if (kind === 'rest') mode = 'rest'

    if (mode === 'seat' && seat) hold(STAND, 'founder', seat.pos)
    else if (mode !== 'rest') release(STAND, 'founder')
    if (mode === 'seat' && seat) {
      const key = `seat:${seat.pos[0].toFixed(2)},${seat.pos[1].toFixed(2)}`
      if (mover.goalKey !== key) mover.goTo(seat.pos, L, key, seat.yaw)
    } else if (mode === 'exit') {
      if (mover.goalKey !== 'exit') mover.exit(L, 'exit')
    } else if (mode === 'meeting') {
      // One table end, facing the investor at the other (Npc takes the guest seat).
      const m = meetingSeats(L)
      const key = m ? `meeting:${m.founder.pos[0].toFixed(2)},${m.founder.pos[1].toFixed(2)}` : 'meeting'
      if (m) hold(STAND, 'founder', m.founder.pos)
      if (m && mover.goalKey !== key) mover.goTo(m.founder.pos, L, key, m.founder.yaw)
    } else if (mode === 'rest') {
      const spot = reserve(STAND, 'founder', L.lounge)!
      const key = `rest:${spot[0].toFixed(2)},${spot[1].toFixed(2)}`
      if (mover.goalKey !== key) mover.goTo(spot, L, key, loungeYawOf(L, spot))
    } else if (mode === 'tour') {
      if (!mover.moving && (mover.goalKey !== 'tour' || now - mover.arrivedAt > 1200)) {
        const desks = p.deskSlots
        const d = desks[tourIdx.current++ % desks.length]!
        const s = seatOf(d, L)
        if (s) {
          const [ox, oz] = rotateXZ(0.45 * CELL, 0.2 * CELL, d.rotation)
          mover.goTo([s.pos[0] + ox, s.pos[1] + oz], L, 'tour', s.yaw + Math.PI / 2)
        }
      }
    }

    const seated = mode === 'seat' && !mover.moving && !!seat && Math.hypot(mover.x - seat.pos[0], mover.z - seat.pos[1]) < 0.05
    const moving = mover.update(dt, speedMul, now, seated ? null : speakerPositions)
    const atSeat = !moving && mode === 'seat' && !!seat && Math.hypot(mover.x - seat.pos[0], mover.z - seat.pos[1]) < 0.05 && mover.yawSettled
    let lift = 0
    if (isCelebrating() && !moving && !mover.outside) lift = poseCheer(rig, t, 0.5)
    else if (moving) poseWalk(rig, mover.phase)
    else if (atSeat) poseSit(rig, t, 1)
    else if (mode === 'rest') poseSip(rig, t, 0.3)
    else if (mode === 'tour') {
      poseStand(rig, t)
      if (rig.armR) rig.armR.rotation.x = -2.2 + Math.sin(t * 10) * 0.4
    } else poseStand(rig, t)
    settle(rig, dt, mode === 'rest' && !moving ? 1 : 0)

    const g = root.current
    if (g) {
      g.position.set(mover.x, lift, mover.z)
      g.rotation.y = mover.yaw
      g.visible = !mover.outside
      g.scale.setScalar(doorScale(mover.fade) * respawn.scale())
    }
    if (icon.current) {
      icon.current.position.set(mover.x, 0, mover.z)
      icon.current.visible = !mover.outside
    }
    setLastPos('founder', mover.x, mover.z, mover.yaw, mover.outside)
    setSpeakerPos('founder', mover.x, HEAD_Y * 1.06 + lift, mover.z, !mover.outside)
  })

  const iconKind = props.action ? (props.action.kind === 'rest' ? 'rest' : 'busy') : 'none'
  return (
    <>
      <group ref={root} position={[mover.x, 0, mover.z]} rotation-y={mover.yaw} visible={!mover.outside} scale={doorScale(mover.fade)}>
        <CharacterModel look={founderLook(props.band)} rig={rig} />
        <HitAndRing selected={props.selected} onSelect={props.onSelect} />
      </group>
      <group ref={icon} position={[mover.x, 0, mover.z]} visible={!mover.outside}>
        <StatusIcon status={iconKind} y={1.3} />
      </group>
    </>
  )
}, sameFounderProps)

export interface DepartingFigureProps {
  id: string
  look: CharacterLook
  /** Where the person was drawn last (sceneRegistry.lastPos). */
  from: LastPos
  mode: GhostMode
  layout: OfficeLayout
  speed: number
  headY: number
  /** Walked out of the door / finished shrinking: People drops the ghost. */
  onDone: (id: string) => void
}

/**
 * A person who already left GameState (departing.ts): walks from their last spot out of the door
 * ('walk'), or shrinks away where they stood ('fade', a firing). Not clickable; still a speaker
 * until outside so a reflection bubble can follow them.
 */
export const DepartingFigure = memo(function DepartingFigure(props: DepartingFigureProps) {
  const rig = useMemo(createRig, [])
  const root = useRef<THREE.Group>(null)
  const [mover] = useState(() => {
    const m = new Mover(props.from.x, props.from.z, props.from.outside)
    m.yaw = props.from.yaw
    m.id = props.id
    return m
  })
  const latest = useRef(props)
  latest.current = props
  const started = useRef(sceneTime.t)
  const done = useRef(false)

  useEffect(() => () => clearSpeaker(props.id), [props.id])

  useFrame(() => {
    const p = latest.current
    if (done.current) return
    const g = root.current
    if (p.mode === 'fade') {
      poseStand(rig, sceneTime.t)
      settle(rig, sceneTime.dt)
      const s = fadeScale((sceneTime.t - started.current) * 1000)
      if (g) g.scale.setScalar(s)
      setSpeakerPos(p.id, mover.x, p.headY * s, mover.z, s > 0)
      if ((sceneTime.t - started.current) * 1000 >= FADE_MS) {
        done.current = true
        if (g) g.visible = false
        clearSpeaker(p.id)
        p.onDone(p.id)
      }
      return
    }
    if (mover.goalKey !== 'exit') mover.exit(p.layout, 'exit')
    const moving = mover.update(sceneTime.dt, speedMultiplier(p.speed), sceneTime.t * 1000, speakerPositions)
    if (moving) poseWalk(rig, mover.phase)
    else poseStand(rig, sceneTime.t)
    settle(rig, sceneTime.dt)
    if (g) {
      g.position.set(mover.x, 0, mover.z)
      g.rotation.y = mover.yaw
      g.visible = !mover.outside
      g.scale.setScalar(doorScale(mover.fade))
    }
    setSpeakerPos(p.id, mover.x, p.headY, mover.z, !mover.outside)
    if (mover.outside) {
      done.current = true
      clearSpeaker(p.id)
      p.onDone(p.id)
    }
  })

  return (
    <group ref={root} position={[mover.x, 0, mover.z]} rotation-y={mover.yaw} visible={!mover.outside} scale={doorScale(mover.fade)}>
      <CharacterModel look={props.look} rig={rig} />
    </group>
  )
})
