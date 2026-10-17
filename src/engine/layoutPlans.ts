// Whole-office layouts (grid design §3 callers, §8 step 6): the presets, "Otomatik düzenle" and the saved layouts.
// Each one turns into an edit-mode draft (a LayoutSnapshot over the live office), so it is applied, undone and paid
// like any hand-made draft. Pure and deterministic. Every plan is built on a trial office one piece at a time and
// each piece is kept only if validateLayout still passes, so the result is always a legal layout. The founder desk
// never moves. Desks are seated team by team, so the templates grow team islands (TEAM_ADJ_BONUS) wherever the
// office has the people; a saved layout never buys a piece: what the company does not own is reported as missing.
import { PAINT_KIND } from '../content/decor'
import { autoPlace, autoPlaceDecor, cellKey, cellOpen, decorBill, decorCap, decorCells, decorCount, dropEmptyFreeSlots, frontDir, gridHalf, inGrid, itemPieces, liftItem, nextDecorId, previewSnapshot, putItem, rightDir, stageFixtures, storeDecor, validateLayout, wallSegments, type Placement, type Rotation } from './layout'
import { isRingUnlocked, teamClusters, type PlacementSpec } from './office'
import { DEPTS, FOUNDER_SLOT_ID, type DecorPiece, type Dept, type GridPos, type LayoutSnapshot, type NewItem, type OfficeState, type SavedLayout, type SlotId, type SlotType, type StageIndex, type WallPiece } from './types'

export type LayoutPreset = 'classic' | 'islands' | 'open' | 'rows'
/** Order in the Düzenler tab: today's default first. */
export const LAYOUT_PRESETS: readonly LayoutPreset[] = ['classic', 'islands', 'open', 'rows']

/** Named layouts an office keeps (grid §2: ≤ 3). */
export const SAVED_LAYOUT_MAX = 3
/** Longest layout name, in characters. */
export const LAYOUT_NAME_MAX = 20

/** A piece a saved layout wants and the company does not own (furniture by item id, decor and wall pieces by kind). */
export interface MissingPiece {
  kind: string
  n: number
  /** Furniture (bought in the shop) rather than decor. */
  item: boolean
}

type DeptOf = (employeeId: string) => Dept | undefined

/** A functional piece lifted off the trial office, keyed by its LIVE anchor slot id (the draft's key). */
interface Lifted {
  id: SlotId
  itemId: string
  type: SlotType
  size: 1 | 2
  occupantId?: string
  /** Team label as the draft has it. */
  label?: Dept
  /** Where the draft has it now, and its cells (anchor first: a ring room's partner may sit on its left). */
  home: { x: number; z: number; r: Rotation }
  cells: GridPos[]
  /** The draft's own entry for it (absent: the draft leaves it where the live office has it). */
  cp?: LayoutSnapshot['slots'][string]
  /** Bought in the draft (its `buy` key): it stays a purchase wherever the plan puts it. */
  buyKey?: string
}

interface Trial {
  live: OfficeState
  office: OfficeState
  lifted: Lifted[]
  /** Final cell of each placed piece (live anchor id → placement; `home`: on exactly the cells the draft has). */
  placed: Map<SlotId, { x: number; z: number; r: Rotation; team?: Dept; home: boolean }>
  /** The draft's decor, waiting to be put back after the furniture. */
  decor: DecorPiece[]
}

const shallow = (o: OfficeState): OfficeState => ({ ...o, slots: o.slots.map((s) => ({ ...s, pos: { ...s.pos } })), decor: (o.decor ?? []).map((p) => ({ ...p, pos: { ...p.pos } })), walls: (o.walls ?? []).map((w) => ({ ...w })), storage: (o.storage ?? []).map((x) => ({ ...x })) })

/**
 * The live office with the draft applied, every movable piece lifted and the floor decor taken off: the empty
 * shell a plan fills. The draft's walls stay (they never block a cell).
 */
function liftAll(live: OfficeState, draft: LayoutSnapshot): Trial | null {
  const built = previewSnapshot(live, draft)
  if ('error' in built) return null
  const office = shallow(built.office)
  // previewSnapshot gives moved pieces new slot ids: map each built anchor back to its live anchor through the draft.
  const liveById = new Map(itemPieces(live).map((p) => [p.anchor.id, p]))
  const wanted = new Map<string, SlotId>()
  for (const p of itemPieces(live)) {
    const cp = draft.slots[p.anchor.id]
    const x = cp?.x ?? p.anchor.pos.x
    const z = cp?.z ?? p.anchor.pos.z
    wanted.set(cellKey(x, z), p.anchor.id)
  }
  // Items bought in the draft are pieces too ("+key"), so a plan arranges them with the rest.
  for (const n of draft.buy ?? []) wanted.set(cellKey(n.x, n.z), `+${n.key}`)
  const lifted: Lifted[] = []
  for (const it of itemPieces(office)) {
    const liveId = wanted.get(cellKey(it.anchor.pos.x, it.anchor.pos.z))
    const src = liveId ? liveById.get(liveId) : undefined
    const buyKey = liveId?.startsWith('+') ? liveId.slice(1) : undefined
    if (!liveId || (!src && buyKey === undefined)) return null
    lifted.push({
      id: liveId,
      itemId: it.anchor.itemId!,
      type: it.anchor.type,
      size: it.cells.length === 2 ? 2 : 1,
      ...(it.anchor.occupantId !== undefined ? { occupantId: it.anchor.occupantId } : {}),
      ...(it.anchor.team !== undefined ? { label: it.anchor.team } : {}),
      home: { x: it.anchor.pos.x, z: it.anchor.pos.z, r: it.rotation },
      cells: it.cells.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      ...(draft.slots[liveId] ? { cp: draft.slots[liveId] } : {}),
      ...(buyKey !== undefined ? { buyKey } : {}),
    })
    liftItem(office, it.cells)
  }
  dropEmptyFreeSlots(office)
  const decor = office.decor ?? []
  office.decor = []
  return { live, office, lifted, placed: new Map(), decor }
}

/** Team a desk is seated for: its sitter's dept, else its label. */
const teamOf = (p: Lifted, deptOf: DeptOf): Dept | undefined => (p.occupantId !== undefined ? (deptOf(p.occupantId) ?? p.label) : p.label)

/** The label a desk leaves with: the sitter's dept (so they count in an island), else the label it had. */
const labelOf = (p: Lifted, deptOf: DeptOf, fallback?: Dept): Dept | undefined => (p.type !== 'desk' ? undefined : (teamOf(p, deptOf) ?? fallback))

const same = (a: GridPos, b: GridPos): boolean => a.x === b.x && a.z === b.z

/**
 * Puts `p` on (x, z) turned `r` if the trial office stays legal; false and nothing changed otherwise. A room covers
 * its anchor and the cell on its right, the way applySnapshot rebuilds it (`cells` names both cells: a ring room whose
 * partner is on its left is anchored on the partner instead, so the draft lands on the very same cells). An empty
 * ring slot on a cell is reused, as applySnapshot does.
 */
function tryPut(t: Trial, p: Lifted, x: number, z: number, r: Rotation, team: Dept | undefined, cells?: readonly GridPos[]): boolean {
  const o = t.office
  let at: GridPos = { x, z }
  const d = rightDir(r)
  if (p.size === 2 && cells?.length === 2 && same(cells[0]!, { x: cells[1]!.x + d.x, z: cells[1]!.z + d.z })) at = { ...cells[1]! }
  const foot = p.size === 2 ? [at, { x: at.x + d.x, z: at.z + d.z }] : [at]
  if (!foot.every((c) => inGrid(o.stage, c))) return false
  const next = shallow(o)
  const slotAt = (c: GridPos) => next.slots.find((s) => !s.free && s.id !== FOUNDER_SLOT_ID && same(s.pos, c) && s.type === p.type && s.itemId === undefined && s.spanOf === undefined)
  const a = slotAt(foot[0]!)
  const b = p.size === 2 ? slotAt(foot[1]!) : undefined
  const canonical = a !== undefined && (p.size === 1 || (b !== undefined && b.ring === a.ring))
  const place: Placement = canonical ? { pos: at, rotation: r, slotId: a.id, ...(b ? { partnerId: b.id } : {}), bumped: [] } : { pos: at, rotation: r, bumped: [] }
  const anchor = putItem(next, place, p.itemId, { slotType: p.type, size: p.size })
  anchor.rotation = r
  if (b && canonical) b.rotation = r
  if (p.occupantId !== undefined) anchor.occupantId = p.occupantId
  if (team !== undefined) anchor.team = team
  if (!validateLayout(next).ok) return false
  t.office = next
  const home = r === p.home.r && foot.length === p.cells.length && foot.every((c) => p.cells.some((q) => same(c, q)))
  t.placed.set(p.id, { x: at.x, z: at.z, r, home, ...(team !== undefined ? { team } : {}) })
  return true
}

/** Back on exactly the cells the draft has it on. */
const putHome = (t: Trial, p: Lifted, team: Dept | undefined): boolean => tryPut(t, p, p.home.x, p.home.z, p.home.r, team, p.cells)

/** autoPlace for a lifted piece (desks try their team's area first); false when no cell keeps the office legal. */
function autoPut(t: Trial, p: Lifted, team: Dept | undefined): boolean {
  const spec: PlacementSpec = { slotType: p.type, size: p.size }
  const place = (team !== undefined ? autoPlace(t.office, spec, { team, teamOnly: true, ignoreCap: true }) : null) ?? autoPlace(t.office, spec, { ...(team !== undefined ? { team } : {}), ignoreCap: true })
  if (!place) return false
  storeDecor(t.office, place.bumped)
  return tryPut(t, p, place.pos.x, place.pos.z, place.rotation, team, partnerCells(t.office, place))
}

/** Both cells of a ring-slot placement (a ring room's partner may be on either side). */
function partnerCells(office: OfficeState, place: Placement): GridPos[] | undefined {
  if (place.partnerId === undefined) return undefined
  const b = office.slots.find((s) => s.id === place.partnerId)
  return b ? [place.pos, { ...b.pos }] : undefined
}

/** Last resort for a piece no plan cell took: autoPlace, else back where the draft had it. */
function settle(t: Trial, p: Lifted, team: Dept | undefined): boolean {
  return autoPut(t, p, team) || putHome(t, p, team)
}

/**
 * Puts the draft's floor decor back: on its own cell when that is still free, else on the nearest free cell
 * (autoPlaceDecor), else it waits in storage (free to re-place). Pieces keep their ids, so nothing is bought.
 */
function restoreDecor(t: Trial, pieces: readonly DecorPiece[]): void {
  const moved: DecorPiece[] = []
  for (const p of pieces) {
    t.office.decor!.push({ ...p, pos: { ...p.pos } })
    if (!validateLayout(t.office).ok) moved.push(t.office.decor!.pop()!)
  }
  for (const p of moved) {
    const at = autoPlaceDecor(t.office, p.kind)
    if (!at) continue
    t.office.decor!.push({ ...p, pos: at.pos, rotation: at.rotation })
    if (!validateLayout(t.office).ok) t.office.decor!.pop()
  }
}

/** The trial as a draft over the live office; null if the whole is not legal (it always is by construction). */
function toDraft(t: Trial, walls?: WallPiece[]): LayoutSnapshot | null {
  const slots: LayoutSnapshot['slots'] = {}
  const buy: NewItem[] = []
  for (const [id, cp] of t.placed) {
    const p = t.lifted.find((x) => x.id === id)!
    if (p.buyKey !== undefined) {
      buy.push({ key: p.buyKey, itemId: p.itemId, x: cp.x, z: cp.z, r: cp.r, ...(cp.team !== undefined ? { team: cp.team } : {}) })
      continue
    }
    if (cp.home) {
      // The draft's own entry (if it had one) puts it back on these cells; else the live office already does.
      if (p.cp) slots[id] = { ...p.cp, ...(cp.team !== undefined ? { team: cp.team } : {}) }
      else if (cp.team !== undefined && cp.team !== p.label) slots[id] = { x: p.home.x, z: p.home.z, r: p.home.r, team: cp.team }
      continue
    }
    slots[id] = { x: cp.x, z: cp.z, r: cp.r, ...(cp.team !== undefined ? { team: cp.team } : {}) }
  }
  const draft: LayoutSnapshot = { slots, decor: (t.office.decor ?? []).map((p) => ({ ...p, pos: { ...p.pos } })), walls: (walls ?? t.office.walls ?? []).map((w) => ({ ...w })), ...(buy.length ? { buy: buy.sort((a, b) => a.key.localeCompare(b.key)) } : {}) }
  const res = previewSnapshot(t.live, draft)
  return 'error' in res || !res.check.ok ? null : draft
}

/**
 * Desks grouped by team, the biggest team first (seated desks before empty ones inside a team), unlabelled empty desks
 * last. A template filled in this order puts each team on consecutive cells.
 */
function deskGroups(t: Trial, deptOf: DeptOf): { team: Dept | undefined; desks: Lifted[] }[] {
  const by = new Map<Dept | undefined, Lifted[]>()
  for (const p of t.lifted) {
    if (p.type !== 'desk') continue
    const k = teamOf(p, deptOf)
    by.set(k, [...(by.get(k) ?? []), p])
  }
  const seated = (p: Lifted) => (p.occupantId !== undefined ? 0 : 1)
  const heads = (xs: Lifted[]) => xs.filter((p) => p.occupantId !== undefined).length
  // Unlabelled empty desks last; else the most people first, ties in DEPTS order.
  const key = (team: Dept | undefined, desks: Lifted[]) => [team === undefined ? 1 : 0, -heads(desks), team === undefined ? DEPTS.length : DEPTS.indexOf(team)]
  return [...by.entries()]
    .map(([team, desks]) => ({ team, desks: [...desks].sort((a, b) => seated(a) - seated(b)), key: key(team, desks) }))
    .sort((a, b) => (less(a.key, b.key) ? -1 : less(b.key, a.key) ? 1 : 0))
}

// ---------------------------------------------------------------------------
// Templates: desk cells in fill order, cut into blocks (a team starts a new block in "Ekip adaları")
// ---------------------------------------------------------------------------

interface TemplateCell {
  x: number
  z: number
  r: Rotation
  block: number
}

/** Rotation whose front points along z toward `dz` (+1 / −1). */
const faceZ = (dz: number): Rotation => (dz > 0 ? 0 : 2)

/** The cell in front of (x, z) turned `r` is inside the grid (a desk facing the outer wall would be sealed). */
function frontInside(stage: StageIndex, x: number, z: number, r: Rotation): boolean {
  const f = frontDir(r)
  return inGrid(stage, { x: x + f.x, z: z + f.z })
}

/** Usable for a desk at all: in the grid, an open ring, not a fixture, not the founder's cell. */
function openCell(office: OfficeState, x: number, z: number): boolean {
  const fx = stageFixtures(office.stage)
  const k = cellKey(x, z)
  return cellOpen(office, { x, z }) && !fx.blocked.has(k) && !fx.noPiece.has(k) && !(x === 0 && z === 0)
}

/** Sides of the office, nearest the founder first: (z side, x side). */
const SIDES: readonly [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]

/** Columns of one x side, from the centre out (the x = 0 column belongs to the + side). */
function columns(h: number, sx: number): number[] {
  const out: number[] = []
  for (let u = sx > 0 ? 0 : 1; u <= h; u++) out.push(sx * u)
  return out
}

/**
 * Açık ofis: bench rows along x, filled column by column so a team takes a 2-wide strip: row 1 alone with its back to
 * the founder's cross-aisle (the main walkway stays clear of chairs), then back-to-back pairs 3–4, 6–7, 9–10 with an
 * aisle row in front of each side. Ekip adaları: the same benches cut into pods of three columns with an empty column
 * between pods. Sıra sıra: single rows (1, 3, 5…) whose people all look toward the founder, an aisle behind each.
 */
function templateCells(office: OfficeState, preset: Exclude<LayoutPreset, 'classic'>): TemplateCell[] {
  const h = gridHalf(office.stage)
  const out: TemplateCell[] = []
  let block = 0
  const push = (x: number, z: number, r: Rotation) => {
    if (openCell(office, x, z) && frontInside(office.stage, x, z, r)) out.push({ x, z, r, block })
  }
  if (preset === 'rows') {
    for (let v = 1; v <= h; v += 2) {
      for (const [sz, sx] of SIDES) {
        block++
        for (const x of columns(h, sx)) push(x, sz * v, faceZ(sz))
      }
    }
    return out
  }
  // Back-to-back pairs 3–4, 6–7, 9–10 from the founder out, then row 1 alone (its back to the founder's cross-aisle):
  // the 2-row benches make the bigger islands, so they fill first.
  const bands: number[] = []
  for (let k = 1; 3 * k <= h; k++) bands.push(k)
  bands.push(0)
  for (const k of bands) {
    const rows: [number, number][] = k === 0 ? [[1, 1]] : [[3 * k, -1], [3 * k + 1, 1]]
    for (const [sz, sx] of SIDES) {
      const cols = columns(h, sx).filter((x) => preset === 'open' || x !== 0)
      cols.forEach((x, i) => {
        if (preset === 'islands') {
          // Pods of 3 columns, one empty column between them.
          if (i % 4 === 3) return
          if (i % 4 === 0) block++
        }
        for (const [v, dir] of rows) if (v <= h) push(x, sz * v, faceZ(dir * sz))
      })
      if (preset === 'open') block++
    }
  }
  return out
}

/** Fills the template team by team; a team in "Ekip adaları" starts on a fresh pod. Desks it cannot seat are returned. */
function fillTemplate(t: Trial, cells: readonly TemplateCell[], deptOf: DeptOf, freshBlock: boolean): Lifted[] {
  const left: Lifted[] = []
  let i = 0
  for (const g of deskGroups(t, deptOf)) {
    // A new team leaves the rest of the pod it would share.
    if (freshBlock && i > 0) {
      const cur = cells[i - 1]!.block
      while (i < cells.length && cells[i]!.block === cur) i++
    }
    for (const p of g.desks) {
      let ok = false
      while (!ok && i < cells.length) {
        const c = cells[i++]!
        ok = tryPut(t, p, c.x, c.z, c.r, labelOf(p, deptOf, g.team))
      }
      if (!ok) left.push(p)
    }
  }
  return left
}

/** Non-desk pieces back where the draft has them (if still legal); returns the ones that need a new cell. */
function keepOthers(t: Trial): Lifted[] {
  const left: Lifted[] = []
  for (const p of t.lifted) if (p.type !== 'desk' && !putHome(t, p, undefined)) left.push(p)
  return left
}

/**
 * A preset as a draft over the live office (with `draft` the current edit draft: its decor and walls are kept where
 * they still fit, its team labels are used). Null only if a piece finds no legal cell at all.
 *  - classic (Klasik): today's default, every piece on today's ring slots; teams take consecutive slots.
 *  - islands (Ekip adaları): 2×3 pods, one team a pod (a bigger team takes the next pod too).
 *  - open (Açık ofis): long back-to-back benches, teams side by side.
 *  - rows (Sıra sıra): single rows facing the founder.
 */
export function presetDraft(live: OfficeState, draft: LayoutSnapshot, preset: LayoutPreset, deptOf: DeptOf): LayoutSnapshot | null {
  const t = liftAll(live, draft)
  if (!t) return null
  const rest: Lifted[] = []
  if (preset === 'classic') {
    // Other pieces first, each on an empty ring slot of its type (today's findAutoSlotFor order), then the desks on
    // the desk slots in slot order, team after team.
    for (const p of t.lifted) {
      if (p.type === 'desk') continue
      const place = autoPlace(t.office, { slotType: p.type, size: p.size }, { canonicalOnly: true, ignoreCap: true })
      if (!place || !tryPut(t, p, place.pos.x, place.pos.z, place.rotation, undefined, partnerCells(t.office, place))) rest.push(p)
    }
    const slots = t.office.slots.filter((s) => s.type === 'desk' && !s.free && s.id !== FOUNDER_SLOT_ID && isRingUnlocked(t.office, s.ring))
    const cells: TemplateCell[] = slots.map((s, i) => ({ x: s.pos.x, z: s.pos.z, r: s.rotation, block: i }))
    rest.push(...fillTemplate(t, cells, deptOf, false))
  } else {
    rest.push(...keepOthers(t))
    rest.push(...fillTemplate(t, templateCells(t.office, preset), deptOf, preset === 'islands'))
  }
  for (const p of rest) if (!settle(t, p, labelOf(p, deptOf))) return null
  restoreDecor(t, t.decor)
  return toDraft(t)
}

/**
 * Otomatik düzenle: every desk re-seated by autoPlace, the biggest team first, each desk in its team's area when
 * there is room (so teams close up into islands); other pieces and the decor stay where the draft has them.
 */
export function autoArrangeDraft(live: OfficeState, draft: LayoutSnapshot, deptOf: DeptOf): LayoutSnapshot | null {
  const t = liftAll(live, draft)
  if (!t) return null
  const rest = keepOthers(t)
  restoreDecor(t, t.decor)
  for (const g of deskGroups(t, deptOf)) for (const p of g.desks) if (!settle(t, p, labelOf(p, deptOf, g.team))) return null
  for (const p of rest) if (!settle(t, p, undefined)) return null
  return toDraft(t)
}

// ---------------------------------------------------------------------------
// Saved layouts
// ---------------------------------------------------------------------------

/** Trimmed, collapsed, capped name; blank → null. */
export function cleanLayoutName(name: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim().slice(0, LAYOUT_NAME_MAX)
  return n.length ? n : null
}

/** The arrangement of `office` (an applied draft) as a saved layout: pieces by item / kind, so it survives a stage move. */
export function captureLayout(office: OfficeState, name: string): SavedLayout {
  return {
    name,
    stage: office.stage,
    items: itemPieces(office).map((p) => {
      // A ring room whose partner is on its left is stored from that partner, so its second cell is on the right.
      const d = rightDir(p.rotation)
      const b = p.cells[1]?.pos
      const at = b && same(p.anchor.pos, { x: b.x + d.x, z: b.z + d.z }) ? b : p.anchor.pos
      return { itemId: p.anchor.itemId!, x: at.x, z: at.z, r: p.rotation, ...(p.anchor.team !== undefined ? { team: p.anchor.team } : {}) }
    }),
    decor: (office.decor ?? []).map((p) => ({ kind: p.kind, x: p.pos.x, z: p.pos.z, r: p.rotation })),
    walls: (office.walls ?? []).map((w) => ({ ...w })),
  }
}

/**
 * A saved layout as a draft over the live office. Each saved piece takes an owned piece of the same kind (a desk
 * whose sitter is of the saved team first): furniture from the office, decor from the draft or storage. Nothing is
 * bought: a piece the company does not own is listed in `missing`. A saved cell this office cannot use (a later
 * stage's door, a locked ring) and owned pieces the layout does not mention go through autoPlace; owned decor it does
 * not mention waits in storage.
 */
export function savedDraft(live: OfficeState, draft: LayoutSnapshot, saved: SavedLayout, deptOf: DeptOf): { draft: LayoutSnapshot; missing: MissingPiece[] } | null {
  const t = liftAll(live, draft)
  if (!t) return null
  const missing = new Map<string, MissingPiece>()
  const miss = (kind: string, item: boolean) => {
    const m = missing.get(kind)
    if (m) m.n++
    else missing.set(kind, { kind, n: 1, item })
  }
  const free = new Set(t.lifted)
  const rest: Lifted[] = []
  // Non-desk pieces first (rooms are the hardest to fit), then desks.
  const entries = [...saved.items].sort((a, b) => Number(isDeskItem(t, a.itemId)) - Number(isDeskItem(t, b.itemId)))
  for (const e of entries) {
    let pick: Lifted | undefined
    let key: number[] = []
    for (const p of free) {
      if (p.itemId !== e.itemId) continue
      const team = teamOf(p, deptOf)
      const k = [p.type === 'desk' && e.team !== undefined && team === e.team ? 0 : 1, p.occupantId !== undefined ? 0 : 1, (p.home.x - e.x) ** 2 + (p.home.z - e.z) ** 2]
      if (!pick || less(k, key)) {
        pick = p
        key = k
      }
    }
    if (!pick) {
      miss(e.itemId, true)
      continue
    }
    free.delete(pick)
    const team = pick.type === 'desk' ? (pick.occupantId !== undefined ? labelOf(pick, deptOf, e.team) : (e.team ?? pick.label)) : undefined
    if (!tryPut(t, pick, e.x, e.z, e.r, team)) rest.push(pick)
  }
  for (const p of [...rest, ...free]) if (!settle(t, p, labelOf(p, deptOf))) return null
  // Decor: the draft's pieces of a kind first (their ids keep them free), then storage, else missing.
  const bill = decorBill(live, draft)
  const stock = new Map<string, number>()
  if (!('error' in bill)) for (const x of bill.storage) stock.set(x.kind, x.n)
  const onFloor = new Map<string, DecorPiece[]>()
  for (const p of t.decor) onFloor.set(p.kind, [...(onFloor.get(p.kind) ?? []), p])
  const take = (kind: string): 'floor' | 'stock' | null => {
    if (onFloor.get(kind)?.length) return 'floor'
    if ((stock.get(kind) ?? 0) > 0) {
      stock.set(kind, stock.get(kind)! - 1)
      return 'stock'
    }
    return null
  }
  for (const d of saved.decor) {
    const src = take(d.kind)
    if (!src) {
      miss(d.kind, false)
      continue
    }
    const id = src === 'floor' ? onFloor.get(d.kind)!.shift()!.id : nextDecorId(t.live.decor, t.decor, t.office.decor)
    t.office.decor!.push({ id, kind: d.kind, pos: { x: d.x, z: d.z }, rotation: d.r })
    if (!placeable(t.office, t.office.decor![t.office.decor!.length - 1]!) || !validateLayout(t.office).ok) t.office.decor!.pop()
  }
  // Walls: the same, a segment at a time (pieces this building has no wall for wait in storage). Paint is a job:
  // the colour already on that wall stays, a stored paint job (from a stage move) is used, else it is missing.
  const hung = [...(draft.walls ?? live.walls ?? [])]
  const walls: WallPiece[] = []
  const wallStock = new Map<string, number>()
  for (const w of hung) if (w.kind !== PAINT_KIND) wallStock.set(w.kind, (wallStock.get(w.kind) ?? 0) + 1)
  for (const w of saved.walls) {
    if (w.kind === PAINT_KIND) {
      if (!wallSegments(t.office.stage, w.wall).length) continue
      const same = hung.some((x) => x.kind === PAINT_KIND && x.wall === w.wall && x.color === w.color)
      if (same || take(PAINT_KIND) === 'stock') walls.push({ ...w })
      else miss(PAINT_KIND, false)
      continue
    }
    if ((wallStock.get(w.kind) ?? 0) > 0) wallStock.set(w.kind, wallStock.get(w.kind)! - 1)
    else if (take(w.kind) !== 'stock') {
      miss(w.kind, false)
      continue
    }
    if (!wallSegments(t.office.stage, w.wall).includes(w.seg) || walls.some((x) => x.kind !== PAINT_KIND && x.wall === w.wall && x.seg === w.seg)) continue
    walls.push({ ...w })
    t.office.walls = walls
    if (decorCount(t.office) > decorCap(t.office.stage)) walls.pop()
  }
  // A wall left unpainted by the saved layout keeps the draft's paint.
  for (const w of hung) if (w.kind === PAINT_KIND && !walls.some((x) => x.kind === PAINT_KIND && x.wall === w.wall)) walls.push({ ...w })
  t.office.walls = walls
  const out = toDraft(t, walls)
  return out ? { draft: out, missing: [...missing.values()] } : null
}

const isDeskItem = (t: Trial, itemId: string): boolean => t.lifted.some((p) => p.itemId === itemId && p.type === 'desk')

function less(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!
  return false
}

/** A decor piece's cells are inside this office's open floor (a saved piece from a bigger office may not be). */
function placeable(office: OfficeState, p: DecorPiece): boolean {
  return decorCells(p).every((c) => cellOpen(office, c))
}

/**
 * What `saved` still lacks against the edit draft, live: furniture it lists beyond what the office owns, decor and
 * wall pieces beyond what the draft shows plus storage, paint jobs for walls the draft has not painted that colour.
 * Buying a missing piece and putting it down takes it off the list.
 */
export function missingPieces(live: OfficeState, draft: LayoutSnapshot, saved: SavedLayout): MissingPiece[] {
  const count = (xs: readonly string[]) => xs.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())
  const out: MissingPiece[] = []
  const owned = count(itemPieces(live).map((p) => p.anchor.itemId!))
  for (const [kind, n] of count(saved.items.map((x) => x.itemId))) if (n > (owned.get(kind) ?? 0)) out.push({ kind, n: n - (owned.get(kind) ?? 0), item: true })
  const bill = decorBill(live, draft)
  const stock = new Map<string, number>()
  if (!('error' in bill)) for (const x of bill.storage) stock.set(x.kind, x.n)
  const walls = draft.walls ?? live.walls ?? []
  const have = count([...draft.decor.map((p) => p.kind), ...walls.filter((w) => w.kind !== PAINT_KIND).map((w) => w.kind)])
  const want = count([...saved.decor.map((p) => p.kind), ...saved.walls.filter((w) => w.kind !== PAINT_KIND).map((w) => w.kind)])
  for (const [kind, n] of want) {
    const short = n - (have.get(kind) ?? 0) - (stock.get(kind) ?? 0)
    if (short > 0) out.push({ kind, n: short, item: false })
  }
  const paints = saved.walls.filter((w) => w.kind === PAINT_KIND && wallSegments(live.stage, w.wall).length > 0 && !walls.some((x) => x.kind === PAINT_KIND && x.wall === w.wall && x.color === w.color)).length
  const paintShort = paints - (stock.get(PAINT_KIND) ?? 0)
  if (paintShort > 0) out.push({ kind: PAINT_KIND, n: paintShort, item: false })
  return out
}

/** People in an active team island of an office (the Düzenler tab's one number). */
export function islandHeads(office: OfficeState, deptOf: DeptOf): number {
  return teamClusters(office, deptOf).reduce((n, c) => n + (c.active ? c.slotIds.length : 0), 0)
}
