// Office layout (rings from center outward), ring opening rules and adjacency (PLAN §3.2–3.4).
import type { FurnitureItem } from '../content/index'
import * as B from './balance'
import { autoPlace, carryOffice, cellKey, coveredCells, typeCaps, typeUse } from './layout'
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
  return { stage, rings, slots, decor: [], walls: [], storage: [], saved: [] }
}

/**
 * Move to the next office: same slot ids/positions, furniture, seats, team labels and separators carried for free,
 * new rings locked (layout.carryOffice: other decor to storage, pieces on a new fixture re-placed). syncSeats after.
 */
export function relocateOffice(old: OfficeState, stage: StageIndex): OfficeState {
  const unlocked = old.rings.filter((r) => r.unlocked).length
  const next = buildOffice(stage, Math.max(1, unlocked))
  carryOffice(old, next)
  return next
}

/** Points every seated employee at the slot that seats them after the office moved pieces (a seat that is gone: none). */
export function syncSeats(s: GameState): void {
  const seat = new Map<string, string>()
  for (const slot of s.office.slots) if (slot.occupantId !== undefined) seat.set(slot.occupantId, slot.id)
  for (const e of s.employees) {
    const id = seat.get(e.id)
    if (id !== undefined) e.deskSlotId = id
    else if (e.deskSlotId !== undefined && !findSlot(s.office, e.deskSlotId)) delete e.deskSlotId
  }
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

function adjacent(a: Slot, b: Slot): boolean {
  return a.id !== b.id && a.ring === b.ring && a.type === b.type && Math.abs(a.pos.x - b.pos.x) + Math.abs(a.pos.z - b.pos.z) === 1
}

/** Slot free for a new item (ignoring `ignoreIds`, e.g. the moving item's own slots). */
function isFreeFor(s: Slot, ignoreIds: readonly string[]): boolean {
  return s.id !== FOUNDER_SLOT_ID && (s.itemId === undefined || ignoreIds.includes(s.id)) && s.occupantId === undefined
}

/**
 * Free neighbours that a size-2 item on (a, b) would leave without any free partner of their own.
 * Pairs with 0 orphans keep runs like -2..1 usable for a second 2-slot item.
 */
export function orphansOf(office: OfficeState, a: Slot, b: Slot, ignoreIds: readonly string[]): number {
  let n = 0
  for (const x of office.slots) {
    if (x.id === a.id || x.id === b.id || !isFreeFor(x, ignoreIds)) continue
    if (!adjacent(x, a) && !adjacent(x, b)) continue
    const hasPartner = office.slots.some((y) => y.id !== a.id && y.id !== b.id && adjacent(x, y) && isFreeFor(y, ignoreIds))
    if (!hasPartner) n++
  }
  return n
}

/** Free adjacent partner for a size-2 item on `slot`; the one leaving the fewest orphan slots (then slot order). */
export function findPartnerSlot(office: OfficeState, slot: Slot, ignoreIds: readonly string[] = []): Slot | undefined {
  let best: Slot | undefined
  let bestOrphans = Infinity
  for (const s of office.slots) {
    if (!adjacent(s, slot) || !isFreeFor(s, ignoreIds)) continue
    const o = orphansOf(office, slot, s, ignoreIds)
    if (o < bestOrphans) {
      best = s
      bestOrphans = o
    }
  }
  return best
}

/** What auto placement needs to know about an item. */
export interface PlacementSpec {
  slotType: SlotType
  size: 1 | 2
}

/**
 * True when `slot` can take a new item of `spec` right now (open ring, right type, free, partner for size 2), its
 * cell is not covered by a moved piece or decor, and the type cap leaves room.
 */
export function canPlaceAt(office: OfficeState, slot: Slot, spec: PlacementSpec): boolean {
  if (slot.id === FOUNDER_SLOT_ID || slot.type !== spec.slotType) return false
  if (slot.itemId !== undefined || slot.spanOf !== undefined) return false
  if (!isRingUnlocked(office, slot.ring)) return false
  if (typeUse(office)[spec.slotType] + spec.size > typeCaps(office)[spec.slotType]) return false
  const covered = coveredCells(office)
  if (covered.has(cellKey(slot.pos.x, slot.pos.z))) return false
  if (spec.size !== 2) return true
  const partner = findPartnerSlot(office, slot)
  return partner !== undefined && !covered.has(cellKey(partner.pos.x, partner.pos.z))
}

/**
 * Auto placement on today's slots (buy → place, the shop's preview): layout.autoPlace tiers 1–2.
 * Order: ring (inside out), then (size 2) pairs that leave no orphan slot, then squared distance from the
 * founder desk, then slot order. Deterministic; placeItem pairs the anchor with the same findPartnerSlot.
 */
export function findAutoSlotFor(office: OfficeState, spec: PlacementSpec): Slot | null {
  const p = autoPlace(office, spec, { canonicalOnly: true })
  return p?.slotId !== undefined ? (findSlot(office, p.slotId) ?? null) : null
}

/** The footprint autoPlace needs for a furniture item. */
export function placementSpec(item: FurnitureItem): PlacementSpec {
  return { slotType: item.slotType, size: item.size === 2 ? 2 : 1 }
}

/** findAutoSlotFor by furniture id; null for unknown items or a full office. */
export function findAutoSlot(state: GameState, itemId: string, content: EngineContent): Slot | null {
  const item = furnitureById(content, itemId)
  if (!item) return null
  return findAutoSlotFor(state.office, placementSpec(item))
}

/** Desk slot an employee can sit on: desk type, open ring, not founder, free. */
export function isFreeDesk(office: OfficeState, slot: Slot): boolean {
  return slot.type === 'desk' && slot.id !== FOUNDER_SLOT_ID && slot.occupantId === undefined && isRingUnlocked(office, slot.ring)
}

/** First free desk slot that holds a desk item (PLAN §4.2: işe al → masa gerekir), inner rings first. */
export function firstFreeDesk(office: OfficeState): Slot | undefined {
  return office.slots.find((s) => isFreeDesk(office, s) && s.itemId !== undefined)
}

/** True when no desk is free but one more may still be bought (the desk cap is not reached). */
export function onlyEmptyDeskSlots(office: OfficeState): boolean {
  return !firstFreeDesk(office) && typeUse(office).desk < typeCaps(office).desk
}

/** The cheapest desk the stage allows: what a one-tap hire buys when no desk stands free (F6). */
export function autoDeskItem(state: GameState, content: EngineContent): FurnitureItem | undefined {
  let best: FurnitureItem | undefined
  for (const f of content.furniture) if (f.slotType === 'desk' && f.stageUnlock <= state.stage && (!best || f.price < best.price)) best = f
  return best
}

/**
 * What a hire with `autoDesk` adds on top of the salary: 0 with a free desk, the auto desk's price when an empty
 * desk slot can take one, null when no desk slot is open (a ring has to open first).
 */
export function hireDeskCost(state: GameState, content: EngineContent): number | null {
  if (firstFreeDesk(state.office)) return 0
  // Same placement as the hire's auto desk (grid autoPlace, desk cap included), so the price shown is what it buys.
  const item = autoDeskItem(state, content)
  return item && autoPlace(state.office, placementSpec(item)) ? item.price : null
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

/** One team island: same-label desks, each seating someone of that team, linked by Chebyshev ≤ TEAM_ADJ_RADIUS. */
export interface TeamCluster {
  team: Dept
  /** Desk slot ids in the island. */
  slotIds: string[]
  /** Employee ids seated on them. */
  employeeIds: string[]
  /** Size ≥ TEAM_CLUSTER_MIN: everyone in it gets TEAM_ADJ_BONUS. */
  active: boolean
}

/** A desk as the team rule sees it (a live slot or an edit-mode draft piece). */
export interface TeamDesk {
  id: string
  pos: { x: number; z: number }
  team?: Dept
  occupantId?: string
}

/**
 * Team islands (grid §5): a desk counts when it is labelled `team` and seats someone of that dept (unlabelled desks
 * and a sitter from another team never count). Desks link at Chebyshev ≤ 1, diagonals included. `deptOf` maps an
 * occupant id to its dept. Callers pass desks only, never the founder's.
 */
export function teamIslands(all: readonly TeamDesk[], deptOf: (id: string) => Dept | undefined): TeamCluster[] {
  const desks = all.filter((d) => d.team !== undefined && d.occupantId !== undefined && deptOf(d.occupantId) === d.team)
  const out: TeamCluster[] = []
  const seen = new Set<string>()
  for (const start of desks) {
    if (seen.has(start.id)) continue
    const comp: TeamDesk[] = []
    const stack = [start]
    seen.add(start.id)
    while (stack.length) {
      const cur = stack.pop()!
      comp.push(cur)
      for (const o of desks) {
        if (seen.has(o.id) || o.team !== cur.team || chebyshev(o.pos, cur.pos) > B.TEAM_ADJ_RADIUS) continue
        seen.add(o.id)
        stack.push(o)
      }
    }
    out.push({ team: start.team!, slotIds: comp.map((x) => x.id), employeeIds: comp.map((x) => x.occupantId!), active: comp.length >= B.TEAM_CLUSTER_MIN })
  }
  return out
}

/** teamIslands over the office's placed desks (the founder desk excluded). */
export function teamClusters(office: OfficeState, deptOf: (id: string) => Dept | undefined): TeamCluster[] {
  return teamIslands(
    office.slots.filter((s) => s.type === 'desk' && s.id !== FOUNDER_SLOT_ID && s.spanOf === undefined && s.itemId !== undefined),
    deptOf,
  )
}

/** Employee ids in an active team island (grid §5: +TEAM_ADJ_BONUS speed). */
export function teamClusteredEmployees(state: GameState): Set<string> {
  const dept = new Map(state.employees.map((e) => [e.id, e.dept]))
  const out = new Set<string>()
  for (const c of teamClusters(state.office, (id) => dept.get(id))) if (c.active) c.employeeIds.forEach((id) => out.add(id))
  return out
}
