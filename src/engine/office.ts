// Office layout (rings from center outward), ring opening rules and adjacency (PLAN §3.2–3.4).
import type { FurnitureItem } from '../content/index'
import * as B from './balance'
import { DEPTS, FOUNDER_SLOT_ID, type Dept, type GameState, type OfficeState, type RingState, type Slot, type SlotType, type StageIndex, type ToolId } from './types'
import { furnitureById, type EngineContent } from './util'

type Side = 'N' | 'E' | 'S' | 'W'
const SIDE_ORDER: readonly Side[] = ['N', 'S', 'E', 'W']
const SIDE_ROTATION: Record<Side, 0 | 1 | 2 | 3> = { N: 0, E: 1, S: 2, W: 3 }

/** Slot type per ring (1..6) and side. Rooms only on sides with an even run (pairs). */
const RING_SIDE_TYPES: readonly Record<Side, SlotType>[] = [
  { N: 'desk', S: 'desk', E: 'desk', W: 'desk' },
  { N: 'desk', S: 'desk', E: 'common', W: 'common' },
  { N: 'room', S: 'room', E: 'desk', W: 'desk' },
  { N: 'desk', S: 'desk', E: 'desk', W: 'common' },
  { N: 'room', S: 'desk', E: 'desk', W: 'common' },
  { N: 'special', S: 'desk', E: 'desk', W: 'room' },
]

export const MAX_RINGS = RING_SIDE_TYPES.length

/** Chebyshev distance of ring r from the founder desk. Rings are separated by a walkway row. */
export function ringDistance(ring: number): number {
  return ring * 2 - 1
}

export function ringSlotCount(ring: number): number {
  return B.RING_SLOT_COUNTS[ring - 1] ?? 0
}

/** Deterministic slot list of one ring. */
export function buildRingSlots(ring: number): Slot[] {
  const n = ringSlotCount(ring)
  const d = ringDistance(ring)
  const types = RING_SIDE_TYPES[ring - 1]
  if (!types || n <= 0) return []
  const base = Math.floor(n / 4)
  const extra = n % 4
  const slots: Slot[] = []
  let idx = 0
  SIDE_ORDER.forEach((side, i) => {
    const k = base + (i < extra ? 1 : 0)
    const start = -Math.floor(k / 2)
    for (let j = 0; j < k; j++) {
      const t = start + j
      const pos = side === 'N' ? { x: t, z: -d } : side === 'S' ? { x: t, z: d } : side === 'E' ? { x: d, z: t } : { x: -d, z: t }
      slots.push({ id: `r${ring}-s${idx}`, ring, type: types[side], pos, rotation: SIDE_ROTATION[side] })
      idx++
    }
  })
  return slots
}

export function stageRingCount(stage: StageIndex): number {
  const r = B.STAGE_RINGS[stage] ?? 0
  return r > 0 ? r : MAX_RINGS
}

export function ringOpenCost(ring: number): number {
  return B.RING_OPEN_COST[ring] ?? 0
}

export function ringRent(stage: StageIndex, ring: number): number {
  return ring <= 1 ? 0 : (B.RING_RENT[stage] ?? 0)
}

/** Fresh office for a stage. Ring 1 open, the rest locked (unless `unlockedRings` says more). */
export function buildOffice(stage: StageIndex, unlockedRings = 1): OfficeState {
  const ringCount = stageRingCount(stage)
  const rings: RingState[] = []
  const slots: Slot[] = [{ id: FOUNDER_SLOT_ID, ring: 0, type: 'desk', pos: { x: 0, z: 0 }, rotation: 0 }]
  for (let r = 1; r <= ringCount; r++) {
    rings.push({ index: r, unlocked: r <= unlockedRings, openCost: ringOpenCost(r), rentPerMonth: ringRent(stage, r) })
    slots.push(...buildRingSlots(r))
  }
  return { stage, rings, slots }
}

/** Move to the next office: same slot ids/positions, furniture & seats carried for free, new rings locked. */
export function relocateOffice(old: OfficeState, stage: StageIndex): OfficeState {
  const unlocked = old.rings.filter((r) => r.unlocked).length
  const next = buildOffice(stage, Math.max(1, unlocked))
  const byId = new Map(old.slots.map((s) => [s.id, s]))
  for (const s of next.slots) {
    const o = byId.get(s.id)
    if (!o) continue
    if (o.itemId !== undefined) s.itemId = o.itemId
    if (o.spanOf !== undefined) s.spanOf = o.spanOf
    if (o.occupantId !== undefined) s.occupantId = o.occupantId
    s.rotation = o.rotation
  }
  return next
}

export function isRingUnlocked(office: OfficeState, ring: number): boolean {
  if (ring === 0) return true
  return office.rings.find((r) => r.index === ring)?.unlocked === true
}

/** Next ring that may be opened (rings open strictly in order), or null. */
export function nextLockedRing(office: OfficeState): number | null {
  const locked = office.rings.filter((r) => !r.unlocked).sort((a, b) => a.index - b.index)
  return locked[0]?.index ?? null
}

export function openExtraRingCount(office: OfficeState): number {
  return office.rings.filter((r) => r.unlocked && r.index > 1).length
}

export function ringRentTotal(office: OfficeState): number {
  return office.rings.reduce((sum, r) => sum + (r.unlocked ? r.rentPerMonth : 0), 0)
}

export function chebyshev(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z))
}

export function findSlot(office: OfficeState, id: string): Slot | undefined {
  return office.slots.find((s) => s.id === id)
}

/** Anchor slot of a (possibly spanned) slot. */
export function anchorOf(office: OfficeState, slot: Slot): Slot {
  if (slot.spanOf === undefined) return slot
  return findSlot(office, slot.spanOf) ?? slot
}

/** Free adjacent slot to pair with for a size-2 item. */
export function findPartnerSlot(office: OfficeState, slot: Slot, ignoreIds: readonly string[] = []): Slot | undefined {
  return office.slots.find(
    (s) =>
      s.id !== slot.id &&
      s.ring === slot.ring &&
      s.type === slot.type &&
      Math.abs(s.pos.x - slot.pos.x) + Math.abs(s.pos.z - slot.pos.z) === 1 &&
      (s.itemId === undefined || ignoreIds.includes(s.id)) &&
      s.occupantId === undefined,
  )
}

/** What auto placement needs to know about an item. */
export interface PlacementSpec {
  slotType: SlotType
  size: 1 | 2
}

/** True when `slot` can take a new item of `spec` right now (open ring, right type, free, partner for size 2). */
export function canPlaceAt(office: OfficeState, slot: Slot, spec: PlacementSpec): boolean {
  if (slot.id === FOUNDER_SLOT_ID || slot.type !== spec.slotType) return false
  if (slot.itemId !== undefined || slot.spanOf !== undefined) return false
  if (!isRingUnlocked(office, slot.ring)) return false
  return spec.size !== 2 || findPartnerSlot(office, slot) !== undefined
}

/**
 * Auto placement (buy → place): the free slot nearest the center that fits `spec`.
 * Order: ring (inside out), then squared distance from the founder desk, then slot order. Deterministic.
 */
export function findAutoSlotFor(office: OfficeState, spec: PlacementSpec): Slot | null {
  let best: Slot | null = null
  let bestKey: [number, number] = [Infinity, Infinity]
  for (const s of office.slots) {
    if (!canPlaceAt(office, s, spec)) continue
    const key: [number, number] = [s.ring, s.pos.x * s.pos.x + s.pos.z * s.pos.z]
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = s
      bestKey = key
    }
  }
  return best
}

/** findAutoSlotFor by furniture id; null for unknown items or a full office. */
export function findAutoSlot(state: GameState, itemId: string, content: EngineContent): Slot | null {
  const item = furnitureById(content, itemId)
  if (!item) return null
  return findAutoSlotFor(state.office, { slotType: item.slotType, size: item.size === 2 ? 2 : 1 })
}

/** Desk slot an employee can sit on: desk type, open ring, not founder, free. */
export function isFreeDesk(office: OfficeState, slot: Slot): boolean {
  return slot.type === 'desk' && slot.id !== FOUNDER_SLOT_ID && slot.occupantId === undefined && isRingUnlocked(office, slot.ring)
}

/** First free desk slot that holds a desk item (PLAN §4.2: işe al → masa gerekir), inner rings first. */
export function firstFreeDesk(office: OfficeState): Slot | undefined {
  return office.slots.find((s) => isFreeDesk(office, s) && s.itemId !== undefined)
}

/** True when the office has free desk slots but none with a desk item on it. */
export function onlyEmptyDeskSlots(office: OfficeState): boolean {
  return !firstFreeDesk(office) && office.slots.some((s) => isFreeDesk(office, s))
}

/** Placed items (anchor slots only) in open rings. */
export function placedItems(state: GameState, content: EngineContent): { slot: Slot; item: FurnitureItem }[] {
  const out: { slot: Slot; item: FurnitureItem }[] = []
  for (const slot of state.office.slots) {
    if (slot.spanOf !== undefined || slot.itemId === undefined) continue
    if (!isRingUnlocked(state.office, slot.ring)) continue
    const item = furnitureById(content, slot.itemId)
    if (item) out.push({ slot, item })
  }
  return out
}

export interface OfficeEffects {
  capacityMult: number
  infraMult: number
  hasMeetingRoom: boolean
  globalMorale: number
  hasBookshelf: boolean
  maturityBonus: number
  deptBonus: Record<Dept, number>
  upkeep: number
  tools: ToolId[]
}

export function officeEffects(state: GameState, content: EngineContent): OfficeEffects {
  const deptBonus = {} as Record<Dept, number>
  for (const d of DEPTS) deptBonus[d] = 0
  const fx: OfficeEffects = { capacityMult: 1, infraMult: 1, hasMeetingRoom: false, globalMorale: 0, hasBookshelf: false, maturityBonus: 0, deptBonus, upkeep: 0, tools: [] }
  for (const { item } of placedItems(state, content)) {
    const e = item.effects
    if (e.capacityMult !== undefined) fx.capacityMult *= e.capacityMult
    if (e.infraMult !== undefined) fx.infraMult = Math.min(fx.infraMult, e.infraMult)
    if (e.coordinationFix) fx.hasMeetingRoom = true
    if (e.globalMorale !== undefined) fx.globalMorale += e.globalMorale
    if (item.visual.shape === 'bookshelf' || item.id === 'bookshelf') fx.hasBookshelf = true
    if (e.maturityBonus !== undefined) fx.maturityBonus += e.maturityBonus
    if (e.deptBonus) for (const d of DEPTS) fx.deptBonus[d] += e.deptBonus[d] ?? 0
    if (e.enablesTool && !fx.tools.includes(e.enablesTool)) fx.tools.push(e.enablesTool)
    fx.upkeep += item.upkeep ?? 0
  }
  return fx
}

/** Global morale from items, plus a book per learned concept when a bookshelf is placed (capped). */
export function bookshelfMorale(state: GameState, fx: OfficeEffects): number {
  const books = fx.hasBookshelf ? Math.min(B.BOOKSHELF_CONCEPT_CAP, state.concepts.learned.length * B.BOOKSHELF_PER_CONCEPT) : 0
  return fx.globalMorale + books
}

/** Sum of auras (common areas, specials) reaching a desk slot (§3.4 rule 1). */
export function auraAt(state: GameState, content: EngineContent, slot: Slot): number {
  let sum = 0
  for (const { slot: s, item } of placedItems(state, content)) {
    const aura = item.effects.moraleAura
    if (aura === undefined || s.type === 'desk') continue
    if (chebyshev(s.pos, slot.pos) <= B.ADJACENCY_RADIUS) sum += aura
  }
  return sum
}

export function deskQualityAt(content: EngineContent, slot: Slot | undefined): number {
  if (!slot) return B.NO_DESK_QUALITY
  if (slot.id === FOUNDER_SLOT_ID) return 1
  const item = furnitureById(content, slot.itemId)
  return item?.effects.deskQuality ?? (item ? 1 : B.NO_DESK_ITEM_QUALITY)
}

/** Employee ids that sit in a same-dept cluster of ≥3 adjacent desks (§3.4 rule 2). */
export function clusteredEmployees(state: GameState): Set<string> {
  const seated = state.employees
    .map((e) => ({ e, slot: e.deskSlotId !== undefined ? findSlot(state.office, e.deskSlotId) : undefined }))
    .filter((x): x is { e: GameState['employees'][number]; slot: Slot } => x.slot !== undefined)
  const out = new Set<string>()
  const seen = new Set<string>()
  for (const start of seated) {
    if (seen.has(start.e.id)) continue
    const comp: string[] = []
    const stack = [start]
    seen.add(start.e.id)
    while (stack.length) {
      const cur = stack.pop()!
      comp.push(cur.e.id)
      for (const o of seated) {
        if (seen.has(o.e.id) || o.e.dept !== cur.e.dept) continue
        if (chebyshev(o.slot.pos, cur.slot.pos) <= B.ADJACENCY_RADIUS) {
          seen.add(o.e.id)
          stack.push(o)
        }
      }
    }
    if (comp.length >= B.DEPT_CLUSTER_MIN) comp.forEach((id) => out.add(id))
  }
  return out
}
