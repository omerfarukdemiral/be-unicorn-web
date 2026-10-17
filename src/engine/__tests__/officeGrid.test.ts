// Free office grid, step 2 (engine + auto placement): no player-visible change, validity, auto placement, hiring
// seats, stage moves and the v4 → v5 save migration.
import { describe, expect, it } from 'vitest'
import { computeLayout } from '../../render/layout'
import { CELL, gridToWorld } from '../../render/constants'
import { createMockState } from '../../render/mockState'
import { applyAction, createGame } from '../index'
import { autoPlace, autoPlaceDecor, cellKey, decorCap, frontDir, gridHalf, nearestFreeDesk, repairOffice, ringHalf, ringOfCell, stageFixtures, typeCaps, validateLayout, worldToGrid } from '../layout'
import { buildOffice, findAutoSlotFor, relocateOffice, stageRingCount } from '../office'
import { enterStage } from '../round'
import { deserialize, serialize } from '../save'
import { FOUNDER_SLOT_ID, SAVE_VERSION, type DecorPiece, type GameState, type OfficeState, type StageIndex } from '../types'
import golden from './data/officeGolden.json'
import saveV4 from './data/saveV4.json'
import saveV5 from './data/saveV5.json'
import { FURNITURE } from '../../content/furniture'
import { autoFill, goldenNow, moveChain } from './officeGolden'

const STAGES = [0, 1, 2, 3, 4, 5, 6] as StageIndex[]
type Golden = { canonical: unknown[]; autoFill: { order: unknown; layout: unknown }[]; moveChain: unknown[]; mock: unknown[] }
const G = golden as unknown as Golden

/** A fully bought, fully furnished canonical office (the autoFill golden scenario). */
const full = (stage: StageIndex): OfficeState => autoFill(stage).state.office
const panel = (id: string, x: number, z: number, kind = 'panel'): DecorPiece => ({ id, kind, pos: { x, z }, rotation: 0 })
const rich = (stage: StageIndex, office?: OfficeState): GameState => {
  const s = createGame({ seed: 1 })
  return { ...s, stage, office: office ?? buildOffice(stage, stageRingCount(stage)), stats: { ...s.stats, cash: 1e12 } }
}

/** The cell a world coordinate had before grid v2 (the 0.9 founder cross-aisle): the golden was written with it. */
const oldToGrid = (w: number): number => (Math.abs(w) < 1.65 ? 0 : Math.sign(w) * Math.round((Math.abs(w) - 0.9) / 1.5))
type GoldenLayout = { bounds: unknown; slotWorld: [string, [number, number]][]; door: { inside: [number, number] } }
const cellsOf = (L: GoldenLayout, toGrid: (w: number) => number) => L.slotWorld.map(([id, [x, z]]) => [id, toGrid(x), toGrid(z)])

describe('same offices on one grid (golden from master 2fca964)', () => {
  it('canonical offices, auto placement order and stage moves are unchanged; every slot lands on its old cell', () => {
    const now = JSON.parse(JSON.stringify(goldenNow())) as Golden
    expect(now.canonical).toEqual(G.canonical)
    STAGES.forEach((st) => {
      expect(now.autoFill[st]!.order, `auto order s${st}`).toEqual(G.autoFill[st]!.order)
      const a = now.autoFill[st]!.layout as GoldenLayout
      const b = G.autoFill[st]!.layout as GoldenLayout
      expect(cellsOf(a, worldToGrid), `cells s${st}`).toEqual(cellsOf(b, oldToGrid))
      // The room is the same size: the cross-aisle became the row along the walls.
      expect(a.bounds, `bounds s${st}`).toEqual(b.bounds)
      const m = now.mock[st] as GoldenLayout
      expect(cellsOf(m, worldToGrid), `mock s${st}`).toEqual(cellsOf(G.mock[st] as GoldenLayout, oldToGrid))
    })
    expect(JSON.parse(JSON.stringify(moveChain()))).toEqual(G.moveChain)
  })

  it('engine grid geometry mirrors render: linear cells, worldToGrid inverts gridToWorld, fixtures match computeLayout', () => {
    expect(CELL).toBe(1.5)
    expect(gridToWorld({ x: 1, z: -2 })).toEqual([1.5, -3])
    for (let v = -12; v <= 12; v++) expect(worldToGrid(gridToWorld({ x: v, z: 0 })[0])).toBe(v)
    for (let v = -12; v <= 12; v++) expect(worldToGrid(v * CELL + CELL * 0.49)).toBe(v)
    for (const st of STAGES) {
      const L = computeLayout(buildOffice(st, stageRingCount(st)).slots, [], st)
      const fx = stageFixtures(st)
      expect(fx.columns).toEqual(L.columns)
      expect(fx.door).toEqual({ x: worldToGrid(L.door.inside[0]), z: worldToGrid(L.door.inside[1]) })
      expect(fx.door).toEqual({ x: ringHalf(st), z: -gridHalf(st) })
      expect(L.bounds.minZ).toBeCloseTo(-(gridHalf(st) + 0.5) * CELL)
      // The door zone: the door cell, its neighbour toward the corner and the two cells in front of them.
      expect(fx.doorZone.map((c) => cellKey(c.x, c.z)).sort()).toEqual([cellKey(ringHalf(st), -gridHalf(st)), cellKey(gridHalf(st), -gridHalf(st)), cellKey(ringHalf(st), -ringHalf(st)), cellKey(gridHalf(st), -ringHalf(st))].sort())
    }
  })
})

describe('grid model', () => {
  it('rings become zones; the wall row is the outer ring; type caps are today’s canonical counts', () => {
    expect(ringOfCell({ x: 0, z: 0 })).toBe(0)
    expect([1, 2, 3, 4, 5].map((d) => ringOfCell({ x: d, z: 0 }))).toEqual([1, 2, 2, 3, 3])
    expect(ringOfCell({ x: 2, z: 0 }, 0)).toBe(1)
    expect(ringOfCell({ x: 4, z: -4 }, 1)).toBe(2)
    for (let r = 1; r <= 6; r++) for (const s of buildOffice(5, 6).slots.filter((x) => x.ring === r)) expect(ringOfCell(s.pos)).toBe(r)
    const desks = [1, 2, 3, 4, 5, 6].map((r) => typeCaps(buildOffice(5, r)).desk)
    expect(desks).toEqual([4, 8, 12, 21, 28, 36])
    expect(typeCaps(buildOffice(6, 6))).toEqual({ desk: 36, common: 8, room: 12, special: 4 })
    expect(STAGES.map(decorCap)).toEqual([6, 12, 20, 30, 45, 60, 80])
    expect(STAGES.map(gridHalf)).toEqual([2, 4, 6, 8, 10, 12, 12])
  })

  it('every canonical office is valid, furnished or not, at every ring count', () => {
    for (const st of STAGES) {
      expect(validateLayout(full(st)).ok, `full s${st}`).toBe(true)
      for (let r = 1; r <= stageRingCount(st); r++) expect(validateLayout(buildOffice(st, r)).ok).toBe(true)
    }
  })
})

const desk = (id: string, x: number, z: number, rotation: 0 | 1 | 2 | 3, stage: StageIndex = 1) => ({ id, ring: ringOfCell({ x, z }, stage), type: 'desk' as const, pos: { x, z }, rotation, itemId: 'desk-basic', free: true as const })

describe('validateLayout', () => {
  it('refuses cells outside, in locked rings, on fixtures, in the door zone and on other pieces', () => {
    const o = buildOffice(1, 1)
    expect(validateLayout({ ...o, decor: [panel('a', 5, 0)] }).reason).toBe('outside')
    expect(validateLayout({ ...o, decor: [panel('a', 2, 2)] }).reason).toBe('locked')
    // The row along the walls is the outer ring's.
    expect(validateLayout({ ...o, decor: [panel('a', -4, 0)] }).reason).toBe('locked')
    expect(validateLayout({ ...o, decor: [panel('a', 0, 0)] }).reason).toBe('overlap')
    expect(validateLayout({ ...buildOffice(3, 4), decor: [panel('a', ...columnCell(3))] }).reason).toBe('fixture')
    const open = buildOffice(1, 2)
    expect(validateLayout({ ...open, decor: [panel('a', -4, 0)] }).ok).toBe(true)
    // Door (3,−4): it and (4,−4), (3,−3), (4,−3) stay clear.
    for (const [x, z] of [[3, -4], [4, -4], [3, -3], [4, -3]] as const) expect(validateLayout({ ...open, decor: [panel('a', x, z)] })).toMatchObject({ ok: false, reason: 'doorZone', bad: [cellKey(x, z)] })
    expect(validateLayout({ ...open, slots: [...open.slots, desk('f1', 4, -3, 3)] }).reason).toBe('doorZone')
    expect(validateLayout({ ...open, decor: [panel('a', 2, 2), panel('b', 2, 2)] }).reason).toBe('overlap')
    // A rug lies under a desk, but not under another rug.
    expect(validateLayout({ ...open, decor: [{ ...panel('r', 1, 1, 'rug') }, panel('b', 2, 2)] }).ok).toBe(true)
    expect(validateLayout({ ...open, decor: [{ ...panel('r', 1, 1, 'rug') }, { ...panel('s', 2, 2, 'rug') }] }).reason).toBe('overlap')
  })

  it('desks need only their chair side: side by side, back to back, a row of 4, against a wall', () => {
    const o = buildOffice(1, 2)
    const ok = (...xs: ReturnType<typeof desk>[]) => validateLayout({ ...o, slots: [...o.slots, ...xs] })
    expect(ok(desk('f1', -3, 2, 0), desk('f2', -2, 2, 0)).ok).toBe(true)
    // Back to back: desk tops touching, chairs on the far sides.
    expect(ok(desk('f1', -3, 1, 2), desk('f2', -3, 2, 0)).ok).toBe(true)
    // A row of four along the left wall row, all chairs into the room.
    expect(ok(desk('f1', -4, -1, 3), desk('f2', -4, 0, 3), desk('f3', -4, 1, 3), desk('f4', -4, 2, 3)).ok).toBe(true)
    // Against the back wall, chairs facing the room.
    expect(ok(desk('f1', -2, -4, 0), desk('f2', -1, -4, 0)).ok).toBe(true)
    // Chairs facing each other with no aisle between them.
    expect(ok(desk('f1', -3, 1, 0), desk('f2', -3, 2, 2)).ok).toBe(true)
  })

  it('sealing a chair in is refused', () => {
    const o = buildOffice(1, 2)
    // Corner desk at (−4,−4) facing +z: its chair half is open on its right and in front; panels on both seal it.
    const d = { ...o, slots: [...o.slots, desk('f1', -4, -4, 0)] }
    expect(validateLayout({ ...d, decor: [panel('a', -3, -4)] }).ok).toBe(true)
    expect(validateLayout({ ...d, decor: [panel('a', -3, -4), panel('b', -4, -3)] })).toMatchObject({ ok: false, reason: 'sealsDesk', bad: ['-4,-4'] })
    // Other items need the cell in front of them: a sofa facing a panel is cut off.
    const sofa = { ...o, slots: o.slots.map((x) => (x.id === 'r2-s4' ? { ...x, itemId: 'plants' } : x)) }
    const s6 = sofa.slots.find((x) => x.id === 'r2-s4')!
    const f = frontDir(s6.rotation)
    expect(validateLayout(sofa).ok).toBe(true)
    expect(validateLayout({ ...sofa, decor: [panel('a', s6.pos.x + f.x, s6.pos.z + f.z)] }).reason).toBe('sealsDesk')
  })

  it('type and decor caps', () => {
    const o = buildOffice(0, 1)
    // Garage: 5 back + 5 left segments and a cap of 6; paint is free of the cap.
    const walls = (['back', 'left'] as const).flatMap((wall) => [-1, 0, 1].map((seg) => ({ wall, seg, kind: 'poster' })))
    expect(validateLayout({ ...o, walls }).ok).toBe(true)
    expect(validateLayout({ ...o, walls, decor: [panel('l', 1, 1, 'lamp')] }).reason).toBe('decorCap')
    expect(validateLayout({ ...o, walls: [...walls, { wall: 'back', seg: 0, kind: 'paint', color: '#fff' }, { wall: 'left', seg: 0, kind: 'paint', color: '#fff' }] }).ok).toBe(true)
    const desks = { ...o, slots: [...o.slots.map((s) => (s.ring === 1 ? { ...s, itemId: 'desk-basic' } : s)), desk('f1', -1, 1, 0, 0)] }
    expect(validateLayout(desks).reason).toBe('typeCap')
  })

  it('canonical rooms on the ring-3 row are valid', () => {
    const o = buildOffice(2, 3)
    const slots = o.slots.map((s) => ({ ...s }))
    const rooms = slots.filter((s) => s.type === 'room' && s.pos.z === -5)
    expect(rooms.map((s) => s.pos.x).sort()).toEqual([-1, 0])
    rooms[0]!.itemId = 'meeting-room'
    rooms[1]!.itemId = 'meeting-room'
    rooms[1]!.spanOf = rooms[0]!.id
    expect(validateLayout({ ...o, slots }).ok).toBe(true)
  })
})

describe('autoPlace', () => {
  it('tier 2 is today’s findAutoSlotFor; deterministic', () => {
    for (const st of STAGES) {
      const o = buildOffice(st, stageRingCount(st))
      const a = autoPlace(o, { slotType: 'desk', size: 1 })
      expect(a?.slotId).toBe(findAutoSlotFor(o, { slotType: 'desk', size: 1 })?.id)
      expect(autoPlace(o, { slotType: 'desk', size: 1 })).toEqual(a)
    }
  })

  it('tier 1: a team desk goes next to its team', () => {
    const o = buildOffice(3, 4)
    const far = o.slots.find((s) => s.id === 'r4-s0')!
    far.itemId = 'desk-basic'
    far.team = 'sales'
    const plain = autoPlace(o, { slotType: 'desk', size: 1 })!
    const team = autoPlace(o, { slotType: 'desk', size: 1 }, { team: 'sales' })!
    expect(plain.slotId).not.toBe(team.slotId)
    const at = o.slots.find((s) => s.id === team.slotId)!
    expect(Math.max(Math.abs(at.pos.x - far.pos.x), Math.abs(at.pos.z - far.pos.z))).toBe(1)
  })

  it('team area full: falls back to tier 2', () => {
    const o = buildOffice(1, 1)
    const a = o.slots.find((s) => s.id === 'r1-s0')!
    a.itemId = 'desk-basic'
    a.team = 'eng'
    // r1-s0 (0,-1) has no canonical desk within Chebyshev 1 other than r1-s2 (1,0) / r1-s3 (-1,0).
    for (const id of ['r1-s2', 'r1-s3']) o.slots.find((s) => s.id === id)!.itemId = 'desk-basic'
    expect(autoPlace(o, { slotType: 'desk', size: 1 }, { team: 'eng' })?.slotId).toBe('r1-s1')
  })

  it('tiers 3–4: free cells once the canonical cells are covered; null at the type cap', () => {
    const o = buildOffice(1, 2)
    // Ring 1 furnished, every empty ring-2 desk cell under decor: the desk goes to a free cell.
    for (const s of o.slots) if (s.type === 'desk' && s.ring === 1) s.itemId = 'desk-basic'
    o.decor = o.slots.filter((s) => s.type === 'desk' && s.ring === 2).map((s, i) => panel(`p${i}`, s.pos.x, s.pos.z))
    expect(validateLayout(o).ok).toBe(true)
    const p = autoPlace(o, { slotType: 'desk', size: 1 })!
    expect(p.slotId).toBeUndefined()
    expect(p.bumped).toEqual([])
    expect(validateLayout({ ...o, slots: [...o.slots, { id: 'f1', ring: ringOfCell(p.pos, 1), type: 'desk', pos: p.pos, rotation: p.rotation, itemId: 'x', free: true }] }).ok).toBe(true)
    const full8 = buildOffice(1, 2)
    for (const s of full8.slots) if (s.type === 'desk' && s.ring > 0) s.itemId = 'desk-basic'
    expect(autoPlace(full8, { slotType: 'desk', size: 1 })).toBeNull()
  })

  it('worst case: cells jammed by decor → the decor nearest the centre goes to storage (max 3)', () => {
    // Pre-seed with only ring 1 open: the founder's 3×3. Three desks, the fourth slot and every corner under a panel,
    // which walls the ring in: nothing can be added until decor makes way.
    const o = buildOffice(1, 1)
    for (const id of ['r1-s0', 'r1-s2', 'r1-s3']) o.slots.find((s) => s.id === id)!.itemId = 'desk-basic'
    o.decor = [panel('a', 0, 1), panel('b', -1, -1), panel('c', -1, 1), panel('d', 1, 1), panel('e', 1, -1)]
    const p = autoPlace(o, { slotType: 'desk', size: 1 })!
    expect(p.bumped.length).toBeGreaterThan(0)
    expect(p.bumped.length).toBeLessThanOrEqual(3)
    expect(p.bumped[0]).toBe('a')
    // Through the action: the panels land in storage, the desk on a cell, and the office is legal.
    const r = applyAction(rich(1, o), { type: 'placeItem', itemId: 'desk-basic' })
    expect(r.ok).toBe(true)
    expect(r.state.office.storage).toEqual([{ kind: 'panel', n: p.bumped.length }])
    expect(validateLayout(r.state.office).ok).toBe(true)
  })

  it('decor auto placement keeps the office valid', () => {
    const o = full(2)
    const at = autoPlaceDecor(o, 'panel')!
    expect(validateLayout({ ...o, decor: [panel('x', at.pos.x, at.pos.z)] }).ok).toBe(true)
  })
})

describe('hiring seats (nearestFreeDesk)', () => {
  it('a desk touching the team, then a labelled one nearest the team, then the first unlabelled one (today’s seat), then any', () => {
    const o = buildOffice(2, 3)
    const desks = o.slots.filter((s) => s.type === 'desk' && s.ring > 0)
    for (const s of desks) s.itemId = 'desk-basic'
    expect(nearestFreeDesk(o, 'eng')?.id).toBe(desks[0]!.id)
    const seat = desks.find((s) => s.id === 'r3-s4')!
    seat.occupantId = 'e1'
    seat.team = 'eng'
    // Grid §5: the free desk beside the team (r3-s5, Chebyshev 1) beats today's first unlabelled one.
    expect(nearestFreeDesk(o, 'eng')?.id).toBe('r3-s5')
    expect(nearestFreeDesk(o, 'sales')?.id).toBe(desks[0]!.id)
    // Two labelled free desks: the one nearest the seated team wins.
    const near = desks.find((s) => s.id === 'r3-s5')!
    near.team = 'eng'
    desks.find((s) => s.id === 'r1-s0')!.team = 'eng'
    expect(nearestFreeDesk(o, 'eng')?.id).toBe('r3-s5')
    // Another team's labels are taken last.
    for (const s of desks) if (!s.occupantId) s.team = 'sales'
    expect(nearestFreeDesk(o, 'eng')?.team).toBe('sales')
  })

  it('the hire action seats on it and labels the desk', () => {
    let s = rich(0)
    for (let i = 0; i < 2; i++) s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    const c = s.candidates[0]!
    s = applyAction(s, { type: 'hire', candidateId: c.id }).state
    const seat = s.office.slots.find((x) => x.occupantId !== undefined)!
    expect(seat.team).toBe(c.dept)
    expect(s.employees.find((e) => e.deskSlotId === seat.id)?.dept).toBe(c.dept)
  })
})

describe('moves and layouts (actions)', () => {
  it('moveItem to a free cell: a free slot, the seat follows, the source keeps its canonical rotation', () => {
    let s = rich(1, buildOffice(1, 2))
    s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s0' }).state
    s = applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id }).state
    const e = s.employees[0]!
    expect(e.deskSlotId).toBe('r1-s0')
    const r = applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: -3, z: -2, r: 3 } })
    expect(r.ok).toBe(true)
    const f = r.state.office.slots.find((x) => x.id === 'f1')!
    expect(f).toMatchObject({ free: true, ring: 2, pos: { x: -3, z: -2 }, rotation: 3, itemId: 'desk-basic', occupantId: e.id, team: e.dept })
    expect(r.state.employees[0]!.deskSlotId).toBe('f1')
    const src = r.state.office.slots.find((x) => x.id === 'r1-s0')!
    expect(src.itemId).toBeUndefined()
    expect(src.team).toBeUndefined()
    // And back onto a canonical slot by cell: the free slot is gone.
    const back = applyAction(r.state, { type: 'moveItem', fromSlotId: 'f1', toCell: { x: 0, z: 1, r: 2 } })
    expect(back.ok).toBe(true)
    expect(back.state.office.slots.some((x) => x.free)).toBe(false)
    expect(back.state.office.slots.find((x) => x.id === 'r1-s1')!.occupantId).toBe(e.id)
  })

  it('moveItem refuses the door zone, a sealed desk, a fixture and a cell off the grid', () => {
    let s = rich(1, buildOffice(1, 2))
    for (const id of ['r1-s0', 'r1-s1']) s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: id }).state
    expect(applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: 3, z: -3, r: 0 } }).error).toBe('blocksDoor')
    expect(applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: 0, z: 0, r: 0 } }).error).toBe('slotOccupied')
    expect(applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: 5, z: 0, r: 0 } }).error).toBe('slotLocked')
    // Desks right against each other are fine; a corner desk whose chair the move walls in is not.
    expect(applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: -1, z: 1, r: 0 } }).ok).toBe(true)
    s = { ...s, office: { ...s.office, slots: [...s.office.slots, { id: 'f9', ring: 2, type: 'desk', pos: { x: -4, z: -4 }, rotation: 0, itemId: 'desk-basic', free: true }], decor: [panel('a', -3, -4)] } }
    expect(validateLayout(s.office).ok).toBe(true)
    expect(applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: -4, z: -3, r: 0 } }).error).toBe('sealsDesk')
  })

  it('applyLayout: moves, labels and decor from storage in one step; atomic on a refusal', () => {
    let s = rich(1, buildOffice(1, 2))
    for (const id of ['r1-s0', 'r1-s1']) s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: id }).state
    s = { ...s, office: { ...s.office, storage: [{ kind: 'plantRow', n: 1 }] } }
    const r = applyAction(s, {
      type: 'applyLayout',
      draft: { slots: { 'r1-s0': { x: -3, z: -1, r: 3, team: 'eng' } }, decor: [panel('d1', -3, 0, 'plantRow')] },
    })
    expect(r.ok).toBe(true)
    expect(r.state.office.slots.find((x) => x.free)).toMatchObject({ pos: { x: -3, z: -1 }, rotation: 3, team: 'eng' })
    expect(r.state.office.decor).toEqual([panel('d1', -3, 0, 'plantRow')])
    expect(r.state.office.storage).toEqual([])
    expect(r.state.stats.cash).toBe(s.stats.cash)
    // Decor that is neither placed nor stored is a purchase: a piece the stage does not sell yet is refused.
    expect(applyAction(s, { type: 'applyLayout', draft: { slots: {}, decor: [panel('d1', -3, 0, 'glass')] } }).error).toBe('notUnlocked')
    const bad = applyAction(s, { type: 'applyLayout', draft: { slots: { 'r1-s0': { x: -2, z: 2, r: 0 }, 'r1-s1': { x: 4, z: -3, r: 0 } }, decor: [] } })
    expect(bad).toMatchObject({ ok: false, error: 'blocksDoor' })
    expect(bad.state).toBe(s)
  })

  it('applyLayout buys the items a draft put down: their price, a dept desk’s label, the activity line; atomic', () => {
    const s = rich(1, buildOffice(1, 2))
    const cash = s.stats.cash
    const r = applyAction(s, { type: 'applyLayout', draft: { slots: {}, decor: [], buy: [{ key: 'n1', itemId: 'desk-basic', x: -2, z: 2, r: 1 }, { key: 'n2', itemId: 'desk-design', x: -1, z: 2, r: 1 }] } })
    expect(r.error).toBeUndefined()
    const placed = r.state.office.slots.filter((x) => x.itemId)
    expect(placed.map((x) => [x.itemId, x.pos.x, x.pos.z, x.rotation])).toEqual([['desk-basic', -2, 2, 1], ['desk-design', -1, 2, 1]])
    expect(placed[1]!.team).toBe('product')
    const price = (id: string) => FURNITURE.find((f) => f.id === id)!.price
    expect(r.state.stats.cash).toBe(cash - price('desk-basic') - price('desk-design'))
    // Short of cash for the lot: nothing changes.
    const poor = { ...s, stats: { ...s.stats, cash: price('desk-basic') } }
    expect(applyAction(poor, { type: 'applyLayout', draft: { slots: {}, decor: [], buy: [{ key: 'n1', itemId: 'desk-basic', x: -2, z: 2, r: 1 }, { key: 'n2', itemId: 'desk-design', x: -1, z: 2, r: 1 }] } })).toMatchObject({ ok: false, error: 'insufficientCash' })
    // In the door zone, or a stage the item is not sold at yet: refused.
    expect(applyAction(s, { type: 'applyLayout', draft: { slots: {}, decor: [], buy: [{ key: 'n1', itemId: 'desk-basic', x: 3, z: -3, r: 0 }] } }).error).toBe('blocksDoor')
    const late = FURNITURE.find((f) => f.slotType === 'desk' && f.stageUnlock > 1)!
    expect(applyAction(s, { type: 'applyLayout', draft: { slots: {}, decor: [], buy: [{ key: 'n1', itemId: late.id, x: -2, z: 2, r: 0 }] } }).error).toBe('notUnlocked')
  })

  it('placeItem on a canonical slot covered by a piece is refused', () => {
    const s = rich(1, { ...buildOffice(1, 2), decor: [panel('a', 0, -1)] })
    expect(applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s0' }).error).toBe('slotOccupied')
    expect(applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state.office.slots.find((x) => x.id === 'r1-s0')!.itemId).toBeUndefined()
  })
})

/** A Series A column cell inside ring 3 (free floor on the Seed office). */
const columnCell = (stage: StageIndex): [number, number] =>
  stageFixtures(stage)
    .columns.map(([x, z]) => [worldToGrid(x), worldToGrid(z)] as [number, number])
    .find(([x, z]) => ringOfCell({ x, z }) <= 3)!

describe('stage move carry-over', () => {
  it('carries free desks and separators; floor decor, wall pieces and paint jobs to storage', () => {
    const o = buildOffice(1, 2)
    o.slots.push({ id: 'f1', ring: 2, type: 'desk', pos: { x: -3, z: -2 }, rotation: 3, itemId: 'desk-basic', free: true, occupantId: 'e1', team: 'eng' })
    o.decor = [panel('a', -2, 2, 'plantRow'), panel('b', 2, 2, 'lamp')]
    o.walls = [{ wall: 'back', seg: 1, kind: 'poster' }, { wall: 'left', seg: 0, kind: 'paint', color: '#fff' }]
    const n = relocateOffice(o, 2)
    expect(n.slots.find((x) => x.id === 'f1')).toMatchObject({ pos: { x: -3, z: -2 }, occupantId: 'e1', team: 'eng' })
    // The plant row carries; the Seed office's starter pieces go up (the stored poster is used for its own).
    expect(n.decor![0]).toEqual(panel('a', -2, 2, 'plantRow'))
    expect(n.decor!.slice(1).map((p) => p.kind)).toEqual(['plantPot', 'plantPot', 'plantPot'])
    expect(n.walls!.map((w) => w.kind).sort()).toEqual(['banner', 'clock', 'plaque', 'poster', 'print', 'print', 'print'])
    expect(n.storage).toEqual(expect.arrayContaining([{ kind: 'lamp', n: 1 }, { kind: 'paint', n: 1 }]))
    expect(n.storage!.find((x) => x.kind === 'poster')).toBeUndefined()
    expect(validateLayout(n).ok).toBe(true)
  })

  it('a piece on a new fixture (a Series A column) is re-placed and keeps its seat', () => {
    const col = columnCell(3)
    expect(col).toBeDefined()
    const o = buildOffice(2, 3)
    o.slots.push({ id: 'f1', ring: ringOfCell({ x: col[0], z: col[1] }), type: 'desk', pos: { x: col[0], z: col[1] }, rotation: 0, itemId: 'desk-basic', free: true, occupantId: 'e1' })
    const n = relocateOffice(o, 3)
    const seat = n.slots.find((x) => x.occupantId === 'e1')!
    expect(cellKey(seat.pos.x, seat.pos.z)).not.toBe(cellKey(col[0], col[1]))
    expect(seat.itemId).toBe('desk-basic')
    expect(validateLayout(n).ok).toBe(true)
    // A separator on it goes to storage.
    const m = relocateOffice({ ...o, slots: o.slots.filter((x) => x.id !== 'f1'), decor: [panel('s', col[0], col[1], 'panel')] }, 3)
    expect(m.decor).toEqual([])
    expect(m.storage).toEqual([{ kind: 'panel', n: 1 }])
  })

  it('a desk against the garage wall lands in the next office’s still locked ring: it is re-placed with its sitter', () => {
    const o = buildOffice(0, 1)
    o.slots.push({ id: 'f1', ring: ringOfCell({ x: -2, z: 0 }, 0), type: 'desk', pos: { x: -2, z: 0 }, rotation: 3, itemId: 'desk-basic', free: true, occupantId: 'e1' })
    expect(o.slots.find((x) => x.id === 'f1')!.ring).toBe(1)
    expect(validateLayout(o).ok).toBe(true)
    const n = relocateOffice(o, 1)
    const seat = n.slots.find((x) => x.occupantId === 'e1')!
    expect(seat.itemId).toBe('desk-basic')
    expect(ringOfCell(seat.pos, 1)).toBe(1)
    expect(validateLayout(n).ok).toBe(true)
  })

  it('the game’s stage move points a re-placed desk’s sitter at its new slot', () => {
    const [x, z] = columnCell(3)
    let s = rich(2, buildOffice(2, 3))
    s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s0' }).state
    s = applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id }).state
    s = applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x, z, r: 0 } }).state
    const e = s.employees[0]!
    expect(e.deskSlotId).toBe('f1')
    enterStage(s, 3)
    const seat = s.office.slots.find((q) => q.occupantId === e.id)!
    expect(seat.id).not.toBe('f1')
    expect(e.deskSlotId).toBe(seat.id)
    expect(s.office.slots.find((q) => q.id === FOUNDER_SLOT_ID)).toBeDefined()
  })
})

describe('saves', () => {
  it('SAVE_VERSION is 6', () => {
    expect(SAVE_VERSION).toBe(6)
  })

  it('the v4 fixture loads with team labels and empty decor, every piece on its old cell', () => {
    const raw = saveV4 as unknown as { version: number; state: GameState }
    expect(raw.version).toBe(4)
    const before = raw.state.office.slots.map((x) => [x.id, x.pos.x, x.pos.z, x.rotation, x.itemId ?? null])
    const s = deserialize(JSON.stringify(raw))!
    expect(s.meta.saveVersion).toBe(6)
    expect(s.office.slots.map((x) => [x.id, x.pos.x, x.pos.z, x.rotation, x.itemId ?? null])).toEqual(before)
    expect(s.office).toMatchObject({ decor: [], walls: [], storage: [], saved: [] })
    for (const slot of s.office.slots) {
      const e = s.employees.find((x) => x.id === slot.occupantId)
      expect(slot.team).toBe(e?.dept)
    }
    expect(s.office.slots.filter((x) => x.team).length).toBe(3)
    expect(validateLayout(s.office).ok).toBe(true)
  })

  it('v5 → v6: a piece on a cell the one grid now keeps clear (a moved column) is re-placed; its sitter follows', () => {
    // data/saveV5.json was written by the v5 engine (grid 4fb2172): a Seed-sized Series A office with a seated desk
    // moved onto (−3,3) and a panel on (−3,−3), both column cells on the v2 grid.
    const raw = structuredClone(saveV5) as unknown as { version: number; state: GameState }
    expect(raw.version).toBe(5)
    expect(validateLayout(raw.state.office).ok).toBe(false)
    const old = raw.state.office
    const moved = old.slots.find((x) => x.pos.x === -3 && x.pos.z === 3 && x.itemId)!
    const sitter = moved.occupantId!
    const s = deserialize(JSON.stringify(raw))!
    expect(s.meta.saveVersion).toBe(6)
    expect(validateLayout(s.office).ok).toBe(true)
    // Everything else stays on its cell.
    const keep = (o: OfficeState) => o.slots.filter((x) => x.itemId && x.occupantId !== sitter).map((x) => [x.id, x.pos.x, x.pos.z, x.rotation])
    expect(keep(s.office)).toEqual(keep(old))
    const seat = s.office.slots.find((x) => x.occupantId === sitter)!
    expect([seat.pos.x, seat.pos.z]).not.toEqual([-3, 3])
    expect(seat.itemId).toBe(moved.itemId)
    expect(s.employees.find((e) => e.id === sitter)!.deskSlotId).toBe(seat.id)
    expect(s.office.decor!.map((p) => p.id).sort()).toEqual(old.decor!.filter((p) => !(p.pos.x === -3 && p.pos.z === -3)).map((p) => p.id).sort())
    expect(s.office.storage).toEqual([{ kind: 'panel', n: 1 }])
    // A legal v5 office loads untouched.
    const fine = structuredClone(saveV5) as unknown as { version: number; state: GameState }
    fine.state.office.slots = fine.state.office.slots.filter((x) => x.id !== moved.id)
    fine.state.office.decor = fine.state.office.decor!.filter((p) => !(p.pos.x === -3 && p.pos.z === -3))
    fine.state.employees = fine.state.employees.map((e) => (e.id === sitter ? { ...e, deskSlotId: undefined } : e))
    expect(validateLayout(fine.state.office).ok).toBe(true)
    expect(deserialize(JSON.stringify(fine))!.office.slots).toEqual(fine.state.office.slots)
  })

  it('repairOffice leaves a legal office alone and moves decor off the door zone', () => {
    const o = full(2)
    const before = JSON.stringify(o)
    repairOffice(o)
    expect(JSON.stringify(o)).toBe(before)
    const fx = stageFixtures(2)
    const bad = { ...o, decor: [panel('z', fx.doorZone[3]!.x, fx.doorZone[3]!.z)] }
    expect(validateLayout(bad).reason).toBe('doorZone')
    repairOffice(bad)
    expect(bad.decor).toEqual([])
    expect(bad.storage).toEqual([{ kind: 'panel', n: 1 }])
  })

  it('mock states 0–6 keep their cells after the migrations; a dept desk takes its dept', () => {
    for (const st of STAGES) {
      const m = createMockState(st)
      const cells = m.office.slots.map((x) => [x.id, x.pos.x, x.pos.z])
      const back = deserialize(JSON.stringify({ version: 4, state: { ...m, office: { stage: m.office.stage, rings: m.office.rings, slots: m.office.slots } } }))!
      expect(back.office.slots.map((x) => [x.id, x.pos.x, x.pos.z]).filter((c) => cells.some((d) => d[0] === c[0])), `mock s${st}`).toEqual(cells.filter((c) => back.office.slots.some((x) => x.id === c[0])))
    }
    const s = rich(2, buildOffice(2, 3))
    s.office.slots.find((x) => x.id === 'r1-s0')!.itemId = 'desk-eng'
    const file = JSON.parse(serialize(s)) as { version: number; state: GameState }
    file.version = 4
    delete file.state.office.decor
    const back = deserialize(JSON.stringify(file))!
    expect(back.office.slots.find((x) => x.id === 'r1-s0')!.team).toBe('eng')
  })
})
