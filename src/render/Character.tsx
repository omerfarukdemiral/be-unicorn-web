// Employees and the founder as walking low-poly characters (PLAN §4.3, §7.2).
// Movement/animation is local visual state; the engine only provides status & actions.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import type * as THREE from 'three'
import type { Dept, Employee, FounderActionRun, Slot } from '../engine/types'
import { CELL, hash01, hashString, pick, rotateXZ, yawOf } from './constants'
import { CharacterModel, StatusIcon, createRig, type Accessory, type CharacterLook } from './CharacterModel'
import type { OfficeLayout, XZ } from './layout'
import { DEPT_COLORS, FOUNDER_COLORS, FOUNDER_LEGS, HAIR_COLORS, HIGHLIGHT, LEG_COLORS, SKIN_TONES } from './palette'
import { GEO, HIT_MAT, flatMat } from './resources'
import { clearSpeaker, isCelebrating, setSpeakerPos } from './sceneRegistry'
import { Mover, overlayYawn, poseCheer, poseSip, poseSit, poseStand, poseWalk } from './walker'

const HEAD_Y = 1.05

export function employeeLook(id: string, dept: Dept): CharacterLook {
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
    legs: pick(LEG_COLORS, id, 5),
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

function idleSpot(layout: OfficeLayout, id: string): XZ {
  const i = hashString(id) % 5
  return [layout.door.inside[0] - CELL * (0.3 + 0.35 * i), layout.door.inside[1] + CELL * (0.2 + 0.25 * (i % 2))]
}

interface HitProps {
  onSelect: () => void
  selected: boolean
}

function HitAndRing({ onSelect, selected }: HitProps) {
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 10) return
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
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
        }}
      />
      {selected && <mesh geometry={GEO.ring} material={flatMat(HIGHLIGHT.selected, 0.9)} scale={[0.8, 1, 0.8]} position={[0, 0.02, 0]} />}
    </>
  )
}

export interface EmployeeCharacterProps {
  employee: Employee
  deskSlot: Slot | undefined
  layout: OfficeLayout
  /** Game speed multiplier (0 = paused). */
  speed: number
  /** Derived overload > 0: engineers rush. */
  overload: boolean
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
    a.speed === b.speed &&
    a.overload === b.overload &&
    a.selected === b.selected &&
    a.onSelect === b.onSelect
  )
}

export const EmployeeCharacter = memo(function EmployeeCharacter(props: EmployeeCharacterProps) {
  const { employee, layout } = props
  const look = useMemo(() => employeeLook(employee.id, employee.dept), [employee.id, employee.dept])
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
  const latest = useRef(props)
  latest.current = props
  const stageRef = useRef(layout.stage)
  const wanderN = useRef(0)

  useEffect(() => () => clearSpeaker(employee.id), [employee.id])

  useFrame(({ clock }, rawDt) => {
    const p = latest.current
    const L = p.layout
    const e = p.employee
    const now = performance.now()
    const t = clock.elapsedTime
    const dt = Math.min(rawDt, 0.1)
    const speedMul = p.speed === 0 ? 0 : 0.75 + p.speed * 0.25
    const seat = seatOf(p.deskSlot, L)

    // Office changed (moved to a new stage): teleport to the new seat.
    if (stageRef.current !== L.stage) {
      stageRef.current = L.stage
      if (seat) mover.teleport(seat.pos, seat.yaw)
      else mover.teleport(idleSpot(L, e.id))
      mover.goalKey = ''
    }

    // Decide the goal for the current status.
    const status = e.status
    // 'leaving' walks to the door and waits there (respondResignation window).
    let mode: 'seat' | 'lounge' | 'wander' | 'door' | 'idle' = 'idle'
    if (status === 'leaving') mode = 'door'
    else if (status === 'break') mode = 'lounge'
    else if (status === 'onboarding') mode = seat && hash01(e.id, Math.floor(t / 12)) < 0.3 ? 'seat' : 'wander'
    else if (seat) mode = 'seat'

    if (mode === 'seat' && seat) {
      const key = `seat:${seat.pos[0].toFixed(2)},${seat.pos[1].toFixed(2)}`
      const burnoutYaw = Math.atan2(L.door.pos[0] - seat.pos[0], L.door.pos[1] - seat.pos[1])
      if (mover.goalKey !== key) mover.goTo(seat.pos, L, key, seat.yaw)
      mover.faceYaw = status === 'burnout' ? burnoutYaw : seat.yaw
    } else if (mode === 'lounge') {
      const spot = L.lounge[hashString(e.id) % L.lounge.length]!
      const key = `lounge:${spot[0].toFixed(2)},${spot[1].toFixed(2)}`
      if (mover.goalKey !== key) mover.goTo([spot[0] + (seed - 0.5) * 0.4, spot[1] + (seed - 0.5) * 0.3], L, key, Math.PI)
    } else if (mode === 'door') {
      const spot: XZ = [L.door.inside[0] + (seed - 0.5) * 0.5, L.door.inside[1] + 0.15]
      if (mover.goalKey !== 'door') mover.goTo(spot, L, 'door', Math.PI)
    } else if (mode === 'wander') {
      if (!mover.moving && (mover.goalKey !== 'wander' || now - mover.arrivedAt > 1800 + seed * 1500)) {
        wanderN.current++
        mover.goTo(randomIn(L, e.id, wanderN.current), L, 'wander', null)
      }
    } else {
      const spot = idleSpot(L, e.id)
      const key = `idle:${spot[0].toFixed(2)},${spot[1].toFixed(2)}`
      if (mover.goalKey !== key) mover.goTo(spot, L, key, 0.6)
    }

    const tiredMul = status === 'tired' || status === 'burnout' ? 0.55 : status === 'onboarding' ? 0.8 : 1
    const moving = mover.update(dt, speedMul * tiredMul, now)
    const atSeat = !moving && mode === 'seat' && !!seat && Math.hypot(mover.x - seat.pos[0], mover.z - seat.pos[1]) < 0.05
    const cheering = isCelebrating(now) && !mover.outside

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
    if (rig.cup) rig.cup.visible = mode === 'lounge' && !moving

    const g = root.current
    if (g) {
      g.position.set(mover.x, lift, mover.z)
      g.rotation.y = mover.yaw
      g.visible = !mover.outside
    }
    if (icon.current) icon.current.position.set(mover.x, 0, mover.z)
    setSpeakerPos(e.id, mover.x, HEAD_Y + lift, mover.z, !mover.outside)
  })

  const showIcon = employee.status !== 'working'
  return (
    <>
      <group ref={root}>
        <CharacterModel look={look} rig={rig} />
        <HitAndRing selected={props.selected} onSelect={() => props.onSelect(employee.id)} />
      </group>
      {showIcon && (
        <group ref={icon}>
          <StatusIcon status={employee.status} />
        </group>
      )}
    </>
  )
}, sameEmployeeProps)

export interface FounderCharacterProps {
  action: FounderActionRun | undefined
  founderSlot: Slot | undefined
  deskSlots: Slot[]
  layout: OfficeLayout
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
  const latest = useRef(props)
  latest.current = props
  const tourIdx = useRef(0)
  const stageRef = useRef(props.layout.stage)

  useEffect(() => () => clearSpeaker('founder'), [])

  useFrame(({ clock }, rawDt) => {
    const p = latest.current
    const L = p.layout
    const now = performance.now()
    const t = clock.elapsedTime
    const dt = Math.min(rawDt, 0.1)
    const speedMul = p.speed === 0 ? 0 : 0.8 + p.speed * 0.3
    const seat = seatOf(p.founderSlot, L)
    const kind = p.action?.kind

    if (stageRef.current !== L.stage) {
      stageRef.current = L.stage
      if (seat) mover.teleport(seat.pos, seat.yaw)
      mover.goalKey = ''
    }

    let mode: 'seat' | 'exit' | 'meeting' | 'tour' | 'rest' = 'seat'
    if (kind === 'findUsers' || kind === 'salesCall' || kind === 'talkToUsers') mode = 'exit'
    else if (kind === 'investorCoffee') mode = L.meeting ? 'meeting' : 'exit'
    else if (kind === 'motivateTeam') mode = p.deskSlots.length > 0 ? 'tour' : 'seat'
    else if (kind === 'rest') mode = 'rest'

    if (mode === 'seat' && seat) {
      const key = `seat:${seat.pos[0].toFixed(2)},${seat.pos[1].toFixed(2)}`
      if (mover.goalKey !== key) mover.goTo(seat.pos, L, key, seat.yaw)
    } else if (mode === 'exit') {
      if (mover.goalKey !== 'exit') mover.exit(L, 'exit')
    } else if (mode === 'meeting' && L.meeting) {
      const target: XZ = [L.meeting[0], L.meeting[1] + CELL * 0.3]
      if (mover.goalKey !== 'meeting') mover.goTo(target, L, 'meeting', Math.PI)
    } else if (mode === 'rest') {
      const spot = L.lounge[0]!
      if (mover.goalKey !== 'rest') mover.goTo(spot, L, 'rest', Math.PI * 0.75)
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

    const moving = mover.update(dt, speedMul, now)
    const atSeat = !moving && mode === 'seat' && !!seat && Math.hypot(mover.x - seat.pos[0], mover.z - seat.pos[1]) < 0.05
    let lift = 0
    if (isCelebrating(now) && !moving && !mover.outside) lift = poseCheer(rig, t, 0.5)
    else if (moving) poseWalk(rig, mover.phase)
    else if (atSeat) poseSit(rig, t, 1)
    else if (mode === 'rest') poseSip(rig, t, 0.3)
    else if (mode === 'tour') {
      poseStand(rig, t)
      if (rig.armR) rig.armR.rotation.x = -2.2 + Math.sin(t * 10) * 0.4
    } else poseStand(rig, t)
    if (rig.cup) rig.cup.visible = mode === 'rest' && !moving

    const g = root.current
    if (g) {
      g.position.set(mover.x, lift, mover.z)
      g.rotation.y = mover.yaw
      g.visible = !mover.outside
    }
    if (icon.current) {
      icon.current.position.set(mover.x, 0, mover.z)
      icon.current.visible = !mover.outside
    }
    setSpeakerPos('founder', mover.x, HEAD_Y * 1.06 + lift, mover.z, !mover.outside)
  })

  const iconKind = props.action ? (props.action.kind === 'rest' ? 'rest' : 'busy') : 'none'
  return (
    <>
      <group ref={root}>
        <CharacterModel look={FOUNDER_LOOK} rig={rig} />
        <HitAndRing selected={props.selected} onSelect={props.onSelect} />
      </group>
      <group ref={icon}>
        <StatusIcon status={iconKind} y={1.3} />
      </group>
    </>
  )
}, sameFounderProps)
