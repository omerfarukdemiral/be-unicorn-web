// Visiting NPCs (PLAN §7.3): investor, mentor, customer, journalist… enter through the door,
// walk to their target, and walk out when their visit ends.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type * as THREE from 'three'
import type { NpcRole, Slot, Visitor } from '../engine/types'
import { CELL, hash01, pick, rotateXZ } from './constants'
import { CharacterModel, createRig, type Accessory, type CharacterLook } from './CharacterModel'
import { doorQueue, localToWorld, meetingSeats, type OfficeLayout, type XZ } from './layout'
import { HAIR_COLORS, HIGHLIGHT, MENTOR_HAIR, NPC_COLORS, NPC_LEGS, SKIN_TONES } from './palette'
import { GEO, HIT_MAT, flatMat } from './resources'
import { clearSpeaker, sceneTime, setLastPos, setSpeakerPos, speakerPositions } from './sceneRegistry'
import { STAND, claim, release, reserve, visitorFan } from './spots'
import { isFreeFloor } from './nav'
import { Mover, doorScale, poseStand, poseWalk, settle, speedMultiplier } from './walker'

/** Visitor head height (speaker anchor), shared with their departing ghost. */
export const NPC_HEAD_Y = 1.05

const ROLE_ACCESSORIES: Record<NpcRole, Accessory[]> = {
  investor: ['tie', 'briefcase'],
  mentor: ['glasses'],
  cofounder: [],
  accountant: ['glasses', 'notebook'],
  engineer: ['headphones'],
  customer: ['cap'],
  journalist: ['camera'],
}

export function npcLook(id: string, role: NpcRole): CharacterLook {
  const c = NPC_COLORS[role]
  return {
    body: c.body,
    skin: pick(SKIN_TONES, id, 1),
    hair: role === 'mentor' ? MENTOR_HAIR : pick(HAIR_COLORS, id, 2),
    hairStyle: role === 'mentor' ? 3 : Math.floor(hash01(id, 4) * 3),
    accessories: ROLE_ACCESSORIES[role],
    legs: role === 'investor' ? NPC_LEGS.investor : NPC_LEGS.default,
  }
}

/** Which visitors wait at the same spot: their target slot, or the founder desk / meeting room by default. */
export function visitorGroup(v: Visitor): string {
  return v.targetSlotId ?? (v.purpose === 'round' ? '@meeting' : '@founder')
}

/**
 * Where a visitor stands: in front of the target slot, the meeting room's guest seat (a round,
 * across from the founder) or the founder desk. Visitor `index` of `count` at the same target
 * stands in a fan (spots.visitorFan) so a crowd never shares a point.
 */
export function visitorTarget(v: Visitor, slots: readonly Slot[], layout: OfficeLayout, index = 0, count = 1): { pos: XZ; yaw: number } {
  const fan = visitorFan(index, count)
  const slot = v.targetSlotId ? slots.find((s) => s.id === v.targetSlotId) : undefined
  if (slot) {
    const base = layout.itemCenter.get(slot.id)?.pos ?? layout.slotWorld.get(slot.id)
    if (base) {
      if (slot.type === 'room') {
        const yaw = layout.itemCenter.get(slot.id)?.yaw ?? 0
        const pos = localToWorld(base, yaw, fan.dx, CELL * 0.35 - fan.dz)
        return { pos, yaw: Math.atan2(base[0] - pos[0], base[1] - pos[1]) }
      }
      // Stand across the desk from its occupant; a second visitor steps aside and back.
      const [ox, oz] = rotateXZ(fan.dx, -0.62 * CELL + fan.dz, slot.rotation)
      const pos: XZ = [base[0] + ox, base[1] + oz]
      return { pos, yaw: Math.atan2(base[0] - pos[0], base[1] - pos[1]) }
    }
  }
  if (v.purpose === 'round') {
    const m = meetingSeats(layout)
    if (m) {
      if (index === 0) return m.guest
      // Extra guests stand behind the first, still facing the founder's end.
      const pos = localToWorld(m.guest.pos, m.guest.yaw, fan.dx, fan.dz - 0.5)
      return { pos, yaw: m.guest.yaw }
    }
  }
  // Across the founder's desk from the founder, turned with the desk (a turned desk must not put the guest behind
  // the monitor), the same rule as any other desk above.
  const f = layout.slotWorld.get('founder') ?? [0, 0]
  const [fx, fz] = rotateXZ(CELL * 0.1 + fan.dx, -CELL * 0.62 + fan.dz, slots.find((s) => s.id === 'founder')?.rotation ?? 0)
  const pos: XZ = [f[0] + fx, f[1] + fz]
  return { pos, yaw: Math.atan2(f[0] - pos[0], f[1] - pos[1]) }
}

/** Inside the office walls, a body's width clear of them. */
function inRoom(L: OfficeLayout, p: XZ): boolean {
  const b = L.bounds
  return p[0] > b.minX + 0.3 && p[0] < b.maxX - 0.3 && p[1] > b.minZ + 0.3 && p[1] < b.maxZ - 0.3
}

/** Sideways steps (along the visitor's shoulders) and one step back tried when the planned spot is taken. */
const SIDE_STEPS: readonly [number, number][] = [
  [0, 0],
  [0.6, 0],
  [-0.6, 0],
  [1.2, 0],
  [-1.2, 0],
  [0.6, -0.6],
  [-0.6, -0.6],
  [0, -0.6],
]

/**
 * Standing points for a visitor, the planned one first: the spot across a desk can be the seat of the desk facing it
 * (desk pods), and a round guest without a meeting room shares the founder desk's front, so the reservation
 * (spots.reserve, kind STAND, seats held by their occupants) picks the first one nobody else stands or sits on.
 */
export function visitorCandidates(tgt: { pos: XZ; yaw: number }, layout: OfficeLayout): XZ[] {
  const fx = Math.sin(tgt.yaw)
  const fz = Math.cos(tgt.yaw)
  const out: XZ[] = []
  for (const [side, fwd] of SIDE_STEPS) {
    const p: XZ = [tgt.pos[0] + fz * side + fx * fwd, tgt.pos[1] - fx * side + fz * fwd]
    // The planned spot stands even on a nav cell marked blocked (a guest seat by the table), but never past a wall:
    // a crowd's fan can reach outside the room, and an off-floor spot paths everyone to one nearest cell (bodies
    // merged). Nothing left → the visitor waits in the door queue.
    if (out.length === 0 ? inRoom(layout, p) : isFreeFloor(layout, p)) out.push(p)
  }
  return out
}

/** Goal key of a visitor waiting outside for a free spot (not spawned yet). */
export const WAIT_OUTSIDE = 'wait-outside'

/**
 * Where visitor `id` goes now: a free spot at the target, else a free door-queue spot just inside the door (every
 * spot reserved, kind STAND, so no two bodies share a point), else nowhere (null: wait outside, unseen). Someone
 * already inside whose spot got taken keeps the least crowded target spot rather than vanish.
 */
export function visitorSpot(id: string, tgt: { pos: XZ; yaw: number }, layout: OfficeLayout, inside: boolean): { spot: XZ; queued: boolean } | null {
  const cands = visitorCandidates(tgt, layout)
  const at = claim(STAND, id, cands)
  if (at) return { spot: at, queued: false }
  const q = claim(STAND, id, doorQueue(layout))
  if (q) return { spot: q, queued: true }
  if (!inside) {
    release(STAND, id)
    return null
  }
  const any = reserve(STAND, id, cands)
  return any ? { spot: any, queued: false } : null
}

/** Rank visitors per target (arriveDay, then id): index / count for the fan. */
export function rankVisitors(visitors: readonly Visitor[]): Map<string, { index: number; count: number }> {
  const groups = new Map<string, Visitor[]>()
  for (const v of visitors) {
    const k = visitorGroup(v)
    const g = groups.get(k)
    if (g) g.push(v)
    else groups.set(k, [v])
  }
  const out = new Map<string, { index: number; count: number }>()
  for (const g of groups.values()) {
    g.sort((a, b) => a.arriveDay - b.arriveDay || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    g.forEach((v, i) => out.set(v.id, { index: i, count: g.length }))
  }
  return out
}

export interface NpcProps {
  visitor: Visitor
  slots: readonly Slot[]
  layout: OfficeLayout
  /** Current game day, read per frame (no re-render per tick). */
  getDay: () => number
  speed: number
  selected: boolean
  onSelect: (id: string) => void
  /** Place among visitors at the same target (rankVisitors). */
  fanIndex?: number
  fanCount?: number
}

function sameVisitor(a: Visitor, b: Visitor): boolean {
  return a.id === b.id && a.role === b.role && a.purpose === b.purpose && a.targetSlotId === b.targetSlotId && a.arriveDay === b.arriveDay && a.leaveDay === b.leaveDay
}

/** Skip the per-tick re-render: the frame loop reads the day through getDay(). */
function sameNpcProps(a: NpcProps, b: NpcProps): boolean {
  return (
    sameVisitor(a.visitor, b.visitor) &&
    a.slots === b.slots &&
    a.layout === b.layout &&
    a.getDay === b.getDay &&
    a.speed === b.speed &&
    a.selected === b.selected &&
    a.onSelect === b.onSelect &&
    a.fanIndex === b.fanIndex &&
    a.fanCount === b.fanCount
  )
}

export const Npc = memo(function Npc(props: NpcProps) {
  const { visitor } = props
  const look = useMemo(() => npcLook(visitor.id, visitor.role), [visitor.id, visitor.role])
  const rig = useMemo(createRig, [])
  const root = useRef<THREE.Group>(null)
  // Created once; later layout changes only re-plan paths.
  const [mover] = useState(() => {
    const m = new Mover(props.layout.door.outside[0], props.layout.door.outside[1], true)
    m.id = props.visitor.id
    return m
  })
  const latest = useRef(props)
  latest.current = props

  useEffect(
    () => () => {
      clearSpeaker(visitor.id)
      release(STAND, visitor.id)
    },
    [visitor.id],
  )

  useFrame(() => {
    const p = latest.current
    const v = p.visitor
    const L = p.layout
    const t = sceneTime.t
    const speedMul = speedMultiplier(p.speed)
    // Leave half a day early so the walk-out starts before the engine removes the visitor; a visitor
    // removed sooner (a card answered) walks out as a departing ghost from wherever they stood.
    const day = p.getDay()
    const leaving = day >= v.leaveDay - 0.5
    const present = day >= v.arriveDay
    // Where this visitor will stand (null: leaving, or waiting outside for room): their ask waits above it, still.
    let dest: XZ | null = null
    if (leaving) {
      release(STAND, v.id)
      if (mover.goalKey !== 'exit') mover.exit(L, 'exit')
    } else if (present) {
      const tgt = visitorTarget(v, p.slots, L, p.fanIndex ?? 0, p.fanCount ?? 1)
      // Still outside (or never stepped in) counts as outside: a full office keeps the visitor unseen at the door.
      const got = visitorSpot(v.id, tgt, L, !mover.outside)
      if (!got) {
        if (mover.goalKey !== WAIT_OUTSIDE) mover.stayOut(WAIT_OUTSIDE)
      } else {
        const { spot, queued } = got
        // Queued at the door: the real goal is the target, where the pill should already wait.
        dest = queued ? tgt.pos : spot
        const key = `${queued ? 'q' : 't'}:${spot[0].toFixed(2)},${spot[1].toFixed(2)}`
        // At the target: face across it. In the door queue: face the target, ready to walk on.
        const face = queued
          ? Math.atan2(tgt.pos[0] - spot[0], tgt.pos[1] - spot[1])
          : Math.atan2(tgt.pos[0] + Math.sin(tgt.yaw) - spot[0], tgt.pos[1] + Math.cos(tgt.yaw) - spot[1])
        if (mover.goalKey !== key) mover.goTo(spot, L, key, face)
      }
    }
    const moving = mover.update(sceneTime.dt, speedMul, t * 1000, speakerPositions)
    if (moving) poseWalk(rig, mover.phase)
    else {
      poseStand(rig, t)
      // Talking gesture while visiting.
      if (!mover.outside && rig.armR) rig.armR.rotation.x = -0.6 + Math.sin(t * 3 + hash01(v.id) * 6) * 0.25
    }
    settle(rig, sceneTime.dt)
    const g = root.current
    if (g) {
      g.position.set(mover.x, 0, mover.z)
      g.rotation.y = mover.yaw
      g.visible = !mover.outside
      g.scale.setScalar(doorScale(mover.fade))
    }
    setLastPos(v.id, mover.x, mover.z, mover.yaw, mover.outside)
    setSpeakerPos(v.id, mover.x, NPC_HEAD_Y, mover.z, !mover.outside, mover.moving, mover.moving || mover.outside ? dest : null)
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 10) return
    e.stopPropagation()
    props.onSelect(visitor.id)
  }

  return (
    <group ref={root} position={[mover.x, 0, mover.z]} rotation-y={mover.yaw} visible={!mover.outside} scale={doorScale(mover.fade)}>
      <CharacterModel look={look} rig={rig} />
      <mesh geometry={GEO.box} material={HIT_MAT} scale={[0.6, 1.3, 0.6]} position={[0, 0.65, 0]} onClick={onClick} />
      <mesh geometry={GEO.ring} material={flatMat(props.selected ? HIGHLIGHT.selected : NPC_COLORS[visitor.role].accent, 0.85)} scale={[0.7, 1, 0.7]} position={[0, 0.02, 0]} />
    </group>
  )
}, sameNpcProps)
