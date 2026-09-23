// Visiting NPCs (PLAN §7.3): investor, mentor, customer, journalist… enter through the door,
// walk to their target, and walk out when their visit ends.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type * as THREE from 'three'
import type { NpcRole, Slot, Visitor } from '../engine/types'
import { CELL, hash01, pick, rotateXZ } from './constants'
import { CharacterModel, createRig, type Accessory, type CharacterLook } from './CharacterModel'
import type { OfficeLayout, XZ } from './layout'
import { HAIR_COLORS, HIGHLIGHT, NPC_COLORS, SKIN_TONES } from './palette'
import { GEO, HIT_MAT, flatMat } from './resources'
import { clearSpeaker, setSpeakerPos } from './sceneRegistry'
import { Mover, poseStand, poseWalk } from './walker'

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
    hair: role === 'mentor' ? '#c9c6cf' : pick(HAIR_COLORS, id, 2),
    hairStyle: role === 'mentor' ? 3 : Math.floor(hash01(id, 4) * 3),
    accessories: ROLE_ACCESSORIES[role],
    legs: role === 'investor' ? '#2f3344' : '#5b5866',
  }
}

/** Where a visitor stands: in front of the target slot, or the meeting room / founder desk. */
export function visitorTarget(v: Visitor, slots: readonly Slot[], layout: OfficeLayout): { pos: XZ; yaw: number } {
  const slot = v.targetSlotId ? slots.find((s) => s.id === v.targetSlotId) : undefined
  if (slot) {
    const base = layout.itemCenter.get(slot.id)?.pos ?? layout.slotWorld.get(slot.id)
    if (base) {
      if (slot.type === 'room') return { pos: [base[0], base[1] + CELL * 0.35], yaw: Math.PI }
      // Stand across the desk from its occupant.
      const [ox, oz] = rotateXZ(0, -0.62 * CELL, slot.rotation)
      const [ex, ez] = rotateXZ((hash01(v.id) - 0.5) * 0.5, 0, slot.rotation)
      const pos: XZ = [base[0] + ox + ex, base[1] + oz + ez]
      return { pos, yaw: Math.atan2(base[0] - pos[0], base[1] - pos[1]) }
    }
  }
  if (v.purpose === 'round' && layout.meeting) return { pos: [layout.meeting[0], layout.meeting[1] + CELL * 0.35], yaw: Math.PI }
  const f = layout.slotWorld.get('founder') ?? [0, 0]
  return { pos: [f[0] + CELL * 0.1, f[1] - CELL * 0.62], yaw: 0 }
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
}

export function Npc(props: NpcProps) {
  const { visitor } = props
  const look = useMemo(() => npcLook(visitor.id, visitor.role), [visitor.id, visitor.role])
  const rig = useMemo(createRig, [])
  const root = useRef<THREE.Group>(null)
  // Created once; later layout changes only re-plan paths.
  const [mover] = useState(() => new Mover(props.layout.door.outside[0], props.layout.door.outside[1], true))
  const latest = useRef(props)
  latest.current = props

  useEffect(() => () => clearSpeaker(visitor.id), [visitor.id])

  useFrame(({ clock }, rawDt) => {
    const p = latest.current
    const v = p.visitor
    const L = p.layout
    const now = performance.now()
    const dt = Math.min(rawDt, 0.1)
    const speedMul = p.speed === 0 ? 0 : 0.8 + p.speed * 0.3
    // Leave half a day early so the walk-out is visible before the engine removes the visitor.
    const day = p.getDay()
    const leaving = day >= v.leaveDay - 0.5
    const present = day >= v.arriveDay
    if (leaving) {
      if (mover.goalKey !== 'exit') mover.exit(L, 'exit')
    } else if (present) {
      const tgt = visitorTarget(v, p.slots, L)
      const key = `t:${tgt.pos[0].toFixed(2)},${tgt.pos[1].toFixed(2)}`
      if (mover.goalKey !== key) mover.goTo(tgt.pos, L, key, tgt.yaw, false)
    }
    const moving = mover.update(dt, speedMul, now)
    if (moving) poseWalk(rig, mover.phase)
    else {
      poseStand(rig, clock.elapsedTime)
      // Talking gesture while visiting.
      if (!mover.outside && rig.armR) rig.armR.rotation.x = -0.6 + Math.sin(clock.elapsedTime * 3 + hash01(v.id) * 6) * 0.25
    }
    const g = root.current
    if (g) {
      g.position.set(mover.x, 0, mover.z)
      g.rotation.y = mover.yaw
      g.visible = !mover.outside
    }
    setSpeakerPos(v.id, mover.x, 1.05, mover.z, !mover.outside)
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 10) return
    e.stopPropagation()
    props.onSelect(visitor.id)
  }

  return (
    <group ref={root}>
      <CharacterModel look={look} rig={rig} />
      <mesh geometry={GEO.box} material={HIT_MAT} scale={[0.6, 1.3, 0.6]} position={[0, 0.65, 0]} onClick={onClick} />
      <mesh geometry={GEO.ring} material={flatMat(props.selected ? HIGHLIGHT.selected : NPC_COLORS[visitor.role].accent, 0.85)} scale={[0.7, 1, 0.7]} position={[0, 0.02, 0]} />
    </group>
  )
}
