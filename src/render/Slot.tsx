// Floor slots: type markers, hover/tap highlight, influence area glow (PLAN §3.4),
// and pointer → action routing (select / placeItem / moveItem / assignDesk).
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { ActionResult, GameState, RingState, Slot, SlotId } from '../engine/types'
import type { PlacingMode } from '../store/types'
import { CELL } from './constants'
import { FurnitureModel, useBookColors } from './Furniture'
import { resolveFurniture } from './furnitureCatalog'
import type { OfficeLayout } from './layout'
import { HIGHLIGHT, SLOT_COLORS } from './palette'
import { GEO, HIT_MAT, flatMat } from './resources'
import { useLayout } from './sceneRegistry'
import { dispatchAction, storeApi, useGS, useUi } from './source'

type Cls = 'none' | 'valid' | 'invalid'

function isUnlocked(rings: readonly RingState[], ring: number): boolean {
  return ring === 0 || rings.find((r) => r.index === ring)?.unlocked !== false
}

function anchorOf(slot: Slot): SlotId {
  return slot.spanOf ?? slot.id
}

/** Visual-only validity hint for the placing mode; the engine has the final say. */
function classify(slot: Slot, placing: PlacingMode | null, slots: readonly Slot[], rings: readonly RingState[]): Cls {
  if (!placing) return 'none'
  if (!isUnlocked(rings, slot.ring)) return 'invalid'
  if (placing.kind === 'place') {
    const f = resolveFurniture(placing.itemId)
    return slot.type === f.slotType && !slot.itemId && !slot.spanOf ? 'valid' : 'invalid'
  }
  if (placing.kind === 'move') {
    const from = slots.find((s) => s.id === placing.fromSlotId)
    return from && slot.type === from.type && !slot.itemId && slot.id !== from.id ? 'valid' : 'invalid'
  }
  return slot.type === 'desk' && !slot.occupantId && slot.id !== 'founder' ? 'valid' : 'invalid'
}

/** Cells lit when hovering a slot: neighbours for local items, every desk for room/special items. */
function auraCells(hover: Slot | undefined, slots: readonly Slot[]): Set<SlotId> {
  const out = new Set<SlotId>()
  if (!hover) return out
  const anchor = hover.spanOf ? slots.find((s) => s.id === hover.spanOf) ?? hover : hover
  const covered = slots.filter((s) => s.id === anchor.id || s.spanOf === anchor.id)
  if (anchor.type === 'room' || anchor.type === 'special') {
    if (anchor.itemId) for (const s of slots) if (s.type === 'desk') out.add(s.id)
    return out
  }
  for (const s of slots) {
    if (covered.includes(s)) continue
    for (const c of covered) {
      if (Math.max(Math.abs(s.pos.x - c.pos.x), Math.abs(s.pos.z - c.pos.z)) <= 1) {
        out.add(s.id)
        break
      }
    }
  }
  return out
}

const selectOffice = (s: GameState) => [s.office.slots, s.office.rings] as const

function onSlotClick(slot: Slot, e: ThreeEvent<MouseEvent>): void {
  if (e.delta > 10) return
  e.stopPropagation()
  const api = storeApi()
  const placing = api.ui.placing
  if (placing) {
    let res: ActionResult
    if (placing.kind === 'place') res = dispatchAction({ type: 'placeItem', itemId: placing.itemId, slotId: anchorOf(slot) })
    else if (placing.kind === 'move') res = dispatchAction({ type: 'moveItem', fromSlotId: placing.fromSlotId, toSlotId: anchorOf(slot) })
    else res = dispatchAction({ type: 'assignDesk', employeeId: placing.employeeId, slotId: anchorOf(slot) })
    if (res.ok) api.setPlacing(null)
    return
  }
  api.select({ kind: 'slot', id: anchorOf(slot) })
  api.setHoverSlot(anchorOf(slot))
}

interface SlotViewProps {
  slot: Slot
  layout: OfficeLayout
  locked: boolean
  cls: Cls
  hovered: boolean
  selected: boolean
  aura: boolean
  mats: PulseMats
}

function SlotView({ slot, layout, locked, cls, hovered, selected, aura, mats }: SlotViewProps) {
  const p = layout.slotWorld.get(slot.id)
  if (!p) return null
  const tint = SLOT_COLORS[slot.type]
  const markerOpacity = locked ? 0.12 : slot.itemId ? 0.22 : 0.6
  const s = CELL * 0.92
  let marker: THREE.BufferGeometry = GEO.frame
  let mScale: [number, number, number] = [s, 1, s]
  if (slot.type === 'common') {
    marker = GEO.ring
    mScale = [s * 0.95, 1, s * 0.95]
  } else if (slot.type === 'special') {
    marker = GEO.star
    mScale = [s * 0.9, 1, s * 0.9]
  }
  const fill =
    cls === 'valid' ? mats.valid : cls === 'invalid' ? null : selected ? mats.selected : hovered ? mats.hover : aura ? mats.aura : null
  return (
    <group position={[p[0], 0, p[1]]}>
      <mesh geometry={marker} material={flatMat(tint, markerOpacity)} scale={mScale} position={[0, 0.012, 0]} renderOrder={1} />
      {slot.type === 'desk' && !slot.itemId && !locked && (
        <mesh geometry={GEO.plane} material={flatMat(tint, 0.18)} scale={[s * 0.5, 1, s * 0.3]} position={[0, 0.011, 0]} />
      )}
      {fill && <mesh geometry={GEO.plane} material={fill} scale={[s, 1, s]} position={[0, 0.016, 0]} renderOrder={2} />}
      {cls === 'invalid' && <mesh geometry={GEO.plane} material={flatMat(HIGHLIGHT.invalid, 0.12)} scale={[s, 1, s]} position={[0, 0.016, 0]} />}
      <mesh
        geometry={GEO.plane}
        material={HIT_MAT}
        scale={[CELL, 1, CELL]}
        position={[0, 0.02, 0]}
        onClick={(e) => onSlotClick(slot, e)}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          storeApi().setHoverSlot(anchorOf(slot))
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
          const api = storeApi()
          if (api.ui.hoverSlotId === anchorOf(slot)) api.setHoverSlot(null)
        }}
      />
    </group>
  )
}

interface PulseMats {
  valid: THREE.MeshBasicMaterial
  hover: THREE.MeshBasicMaterial
  selected: THREE.MeshBasicMaterial
  aura: THREE.MeshBasicMaterial
}

function makeMat(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false })
}

export function SlotsLayer() {
  const [slots, rings] = useGS(selectOffice)
  const layout = useLayout()
  const [hoverId, selection, placing] = useUi((u) => [u.hoverSlotId, u.selection, u.placing] as const)
  const books = useBookColors()
  const mats = useMemo<PulseMats>(
    () => ({ valid: makeMat(HIGHLIGHT.valid), hover: makeMat(HIGHLIGHT.hover), selected: makeMat(HIGHLIGHT.selected), aura: makeMat(HIGHLIGHT.aura) }),
    [],
  )
  useFrame(({ clock }) => {
    const k = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4)
    mats.valid.opacity = 0.25 + 0.25 * k
    mats.aura.opacity = 0.18 + 0.2 * k
    mats.hover.opacity = 0.35
    mats.selected.opacity = 0.35 + 0.15 * k
  })

  const selectedId = selection?.kind === 'slot' ? selection.id : null
  const hovered = hoverId ? slots.find((s) => s.id === hoverId) : undefined
  const aura = useMemo(() => auraCells(hovered?.itemId ? hovered : undefined, slots), [hovered, slots])

  // Ghost preview of the item being placed on the hovered slot.
  let ghost: ReactNode = null
  if (placing?.kind === 'place' && hovered) {
    const cls = classify(hovered, placing, slots, rings)
    const c = layout.slotWorld.get(hovered.id)
    if (cls === 'valid' && c) {
      ghost = (
        <group position={[c[0], 0.04, c[1]]} rotation={[0, -hovered.rotation * (Math.PI / 2), 0]}>
          <FurnitureModel resolved={resolveFurniture(placing.itemId, hovered.type)} books={books} />
        </group>
      )
    }
  }

  return (
    <group>
      {slots.map((s) => (
        <SlotView
          key={s.id}
          slot={s}
          layout={layout}
          locked={!isUnlocked(rings, s.ring)}
          cls={classify(s, placing, slots, rings)}
          hovered={hoverId === anchorOf(s)}
          selected={selectedId === anchorOf(s)}
          aura={aura.has(s.id)}
          mats={mats}
        />
      ))}
      {ghost}
    </group>
  )
}
