// Free office grid, step 2 (engine + auto placement): no player-visible change, validity, auto placement, hiring
// seats, stage moves and the v4 → v5 save migration.
import { describe, expect, it } from 'vitest'
import { computeLayout } from '../../render/layout'
import { CELL, CENTER_GAP, gridToWorld } from '../../render/constants'
import { createMockState } from '../../render/mockState'
import { applyAction, createGame } from '../index'
import { autoPlace, autoPlaceDecor, cellKey, decorCap, gridHalf, nearestFreeDesk, ringOfCell, stageFixtures, typeCaps, validateLayout, worldToGrid } from '../layout'
import { buildOffice, findAutoSlotFor, relocateOffice, stageRingCount } from '../office'
import { enterStage } from '../round'
import { deserialize, serialize } from '../save'
import { FOUNDER_SLOT_ID, SAVE_VERSION, type DecorPiece, type GameState, type OfficeState, type StageIndex } from '../types'
import golden from './data/officeGolden.json'
import saveV4 from './data/saveV4.json'
import { autoFill, goldenNow, layoutOf, moveChain } from './officeGolden'

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

describe('no player-visible change (golden from master 2fca964)', () => {
  it('canonical offices, auto placement order, stage moves and scene layouts are unchanged', () => {
    const now = JSON.parse(JSON.stringify(goldenNow())) as Golden
    expect(now.canonical).toEqual(G.canonical)
    STAGES.forEach((st) => {
      expect(now.autoFill[st]!.order, `auto order s${st}`).toEqual(G.autoFill[st]!.order)
      expect(now.autoFill[st]!.layout, `layout s${st}`).toEqual(G.autoFill[st]!.layout)
      expect(now.mock[st], `mock s${st}`).toEqual(G.mock[st])
    })
    expect(JSON.parse(JSON.stringify(moveChain()))).toEqual(G.moveChain)
  })

  it('engine grid geometry mirrors render: worldToGrid inverts gridToWorld, fixtures match computeLayout', () => {
    expect(CELL).toBe(1.5)
    expect(CENTER_GAP).toBeCloseTo(0.9)
    for (let v = -12; v <= 12; v++) expect(worldToGrid(gridToWorld({ x: v, z: 0 })[0])).toBe(v)
    for (const st of STAGES) {
      const L = computeLayout(buildOffice(st, stageRingCount(st)).slots, [], st)
      const fx = stageFixtures(st)
      expect(fx.columns.map((c) => c.map((v) => +v.toFixed(6)))).toEqual(L.columns.map((c) => c.map((v) => +v.toFixed(6))))
      expect(fx.door).toEqual({ x: worldToGrid(L.door.inside[0]), z: worldToGrid(L.door.inside[1]) })
      expect(fx.door).toEqual({ x: gridHalf(st), z: -gridHalf(st) })
    }
  })
})

describe('grid model', () => {
  it('rings become zones; type caps are today’s canonical counts', () => {
    expect(ringOfCell({ x: 0, z: 0 })).toBe(0)
    expect([1, 2, 3, 4, 5].map((d) => ringOfCell({ x: d, z: 0 }))).toEqual([1, 2, 2, 3, 3])
    for (let r = 1; r <= 6; r++) for (const s of buildOffice(5, 6).slots.filter((x) => x.ring === r)) expect(ringOfCell(s.pos)).toBe(r)
    const desks = [1, 2, 3, 4, 5, 6].map((r) => typeCaps(buildOffice(5, r)).desk)
    expect(desks).toEqual([4, 8, 12, 21, 28, 36])
    expect(typeCaps(buildOffice(6, 6))).toEqual({ desk: 36, common: 8, room: 12, special: 4 })
    expect(STAGES.map(decorCap)).toEqual([6, 12, 20, 30, 45, 60, 80])
  })

  it('every canonical office is valid, furnished or not, at every ring count', () => {
    for (const st of STAGES) {
      expect(validateLayout(full(st)).ok, `full s${st}`).toBe(true)
      for (let r = 1; r <= stageRingCount(st); r++) expect(validateLayout(buildOffice(st, r)).ok).toBe(true)
    }
  })
})

describe('validateLayout', () => {
  it('refuses cells outside, in locked rings, on fixtures and on other pieces', () => {
    const o = buildOffice(1, 1)
    expect(validateLayout({ ...o, decor: [panel('a', 4, 0)] }).reason).toBe('outside')
    expect(validateLayout({ ...o, decor: [panel('a', 2, 2)] }).reason).toBe('locked')
    expect(validateLayout({ ...o, decor: [panel('a', 0, 0)] }).reason).toBe('fixture')
    expect(validateLayout({ ...o, decor: [panel('a', 3, -3)] }).reason).toBe('locked')
    const open = buildOffice(1, 2)
    expect(validateLayout({ ...open, decor: [panel('a', 3, -3)] })).toMatchObject({ ok: false, reason: 'fixture', bad: ['3,-3'] })
    expect(validateLayout({ ...open, decor: [panel('a', 2, 2), panel('b', 2, 2)] }).reason).toBe('overlap')
    // A rug lies under a desk, but not under another rug.
    expect(validateLayout({ ...open, decor: [{ ...panel('r', 1, 1, 'rug') }, panel('b', 2, 2)] }).ok).toBe(true)
    expect(validateLayout({ ...open, decor: [{ ...panel('r', 1, 1, 'rug') }, { ...panel('s', 2, 2, 'rug') }] }).reason).toBe('overlap')
  })

  it('blocksDoor when the door is boxed in, sealsDesk when a front is cut off', () => {
    const o = buildOffice(1, 2)
    // Door (3,-3): its two floor neighbours are (2,-3) and (3,-2).
    expect(validateLayout({ ...o, decor: [panel('a', 2, -3), panel('b', 3, -2)] })).toMatchObject({ ok: false, reason: 'blocksDoor' })
    // A desk next to the cross-aisle is always reached through it.
    const d0 = { ...o, slots: o.slots.map((s) => (s.id === 'r2-s0' ? { ...s, itemId: 'desk-basic' } : s)) }
    expect(validateLayout({ ...d0, decor: [[-2, -2], [0, -2]].map(([x, z], i) => panel(`p${i}`, x!, z!)) }).ok).toBe(true)
    // A corner desk at (-3,-3) facing +z: its front (-3,-2) walled off on its two other sides.
    const d = { ...o, slots: [...o.slots, { id: 'f1', ring: 2, type: 'desk' as const, pos: { x: -3, z: -3 }, rotation: 0 as const, itemId: 'desk-basic', free: true as const }] }
    const ring = [[-2, -2], [-3, -1]].map(([x, z], i) => panel(`p${i}`, x!, z!))
    expect(validateLayout({ ...d, decor: ring.slice(0, 1) }).ok).toBe(true)
    expect(validateLayout({ ...d, decor: ring })).toMatchObject({ ok: false, reason: 'sealsDesk', bad: ['-3,-3'] })
    // A piece right on the front cell seals it too.
    expect(validateLayout({ ...d, decor: [panel('f', -3, -2)] }).reason).toBe('sealsDesk')
  })

  it('two facing desks may share one aisle cell', () => {
    const o = buildOffice(1, 2)
    const desk = (id: string, x: number, z: number, rotation: 0 | 2) => ({ id, ring: ringOfCell({ x, z }), type: 'desk' as const, pos: { x, z }, rotation, itemId: 'desk-basic', free: true as const })
    const facing = { ...o, slots: [...o.slots, desk('f1', -3, -1, 2), desk('f2', -3, -3, 0)] }
    expect(validateLayout(facing).ok).toBe(true)
    // The shared cell's last other way in walled: both are sealed.
    expect(validateLayout({ ...facing, decor: [panel('a', -2, -2)] }).reason).toBe('sealsDesk')
  })

  it('type and decor caps', () => {
    const o = buildOffice(0, 1)
    // Garage: 3 back + 3 left segments and a cap of 6; paint is free of the cap.
    const walls = (['back', 'left'] as const).flatMap((wall) => [-1, 0, 1].map((seg) => ({ wall, seg, kind: 'poster' })))
    expect(validateLayout({ ...o, walls }).ok).toBe(true)
    expect(validateLayout({ ...o, walls, decor: [panel('l', 1, 1, 'lamp')] }).reason).toBe('decorCap')
    expect(validateLayout({ ...o, walls: [...walls, { wall: 'back', seg: 0, kind: 'paint', color: '#fff' }, { wall: 'left', seg: 0, kind: 'paint', color: '#fff' }] }).ok).toBe(true)
    const desks = { ...o, slots: [...o.slots.map((s) => (s.ring === 1 ? { ...s, itemId: 'desk-basic' } : s)), { id: 'f1', ring: 1, type: 'desk' as const, pos: { x: -1, z: 1 }, rotation: 0 as const, itemId: 'desk-basic', free: true as const }] }
    expect(validateLayout(desks).reason).toBe('typeCap')
  })

  it('a room across the founder cross-aisle closes that aisle node', () => {
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
    // Every empty canonical desk cell is covered by decor: the desk goes to a free cell, facing the founder first.
    o.decor = o.slots.filter((s) => s.type === 'desk' && s.ring > 0).map((s, i) => panel(`p${i}`, s.pos.x, s.pos.z))
    const p = autoPlace(o, { slotType: 'desk', size: 1 })!
    expect(p.slotId).toBeUndefined()
    expect(p.bumped).toEqual([])
    expect(validateLayout({ ...o, slots: [...o.slots, { id: 'f1', ring: ringOfCell(p.pos), type: 'desk', pos: p.pos, rotation: p.rotation, itemId: 'x', free: true }] }).ok).toBe(true)
    const full8 = buildOffice(1, 2)
    for (const s of full8.slots) if (s.type === 'desk' && s.ring > 0) s.itemId = 'desk-basic'
    expect(autoPlace(full8, { slotType: 'desk', size: 1 })).toBeNull()
  })

  it('worst case: cells jammed by decor → the nearest decor goes to storage (max 3), then the canonical slot', () => {
    const o = buildOffice(0, 1)
    for (const id of ['r1-s0', 'r1-s2', 'r1-s3']) o.slots.find((s) => s.id === id)!.itemId = 'desk-basic'
    o.decor = [panel('a', 0, 1), panel('b', -1, -1), panel('c', -1, 1), panel('d', 1, 1)]
    expect(validateLayout(o).ok).toBe(true)
    const p = autoPlace(o, { slotType: 'desk', size: 1 })!
    expect(p).toMatchObject({ slotId: 'r1-s1', bumped: ['a'] })
    // Through the action: the panel lands in storage and the desk on r1-s1.
    const r = applyAction(rich(0, o), { type: 'placeItem', itemId: 'desk-basic' })
    expect(r.ok).toBe(true)
    expect(r.state.office.slots.find((s) => s.id === 'r1-s1')!.itemId).toBe('desk-basic')
    expect(r.state.office.storage).toEqual([{ kind: 'panel', n: 1 }])
    expect(r.state.office.decor!.map((x) => x.id)).toEqual(['b', 'c', 'd'])
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

  it('moveItem refuses a door block, a sealed desk, a fixture and a locked cell', () => {
    let s = rich(1, buildOffice(1, 2))
    for (const id of ['r1-s0', 'r1-s1']) s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: id }).state
    s = { ...s, office: { ...s.office, decor: [panel('a', 2, -3)] } }
    expect(applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: 3, z: -2, r: 0 } }).error).toBe('blocksDoor')
    expect(applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: 3, z: -3, r: 0 } }).error).toBe('slotOccupied')
    expect(applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: 5, z: 0, r: 0 } }).error).toBe('slotLocked')
    // r1-s1 (0,1) faces −z into the cross-aisle; a desk right there seals nothing (the aisle runs on), but one on
    // the cell in front of a ring-2 desk does.
    s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r2-s0' }).state
    expect(applyAction(s, { type: 'moveItem', fromSlotId: 'r1-s0', toCell: { x: -1, z: -2, r: 0 } }).error).toBe('sealsDesk')
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
    const bad = applyAction(s, { type: 'applyLayout', draft: { slots: { 'r1-s0': { x: 2, z: -3, r: 0 }, 'r1-s1': { x: 3, z: -2, r: 0 } }, decor: [] } })
    expect(bad).toMatchObject({ ok: false, error: 'blocksDoor' })
    expect(bad.state).toBe(s)
  })

  it('placeItem on a canonical slot covered by a piece is refused', () => {
    const s = rich(1, { ...buildOffice(1, 2), decor: [panel('a', 0, -1)] })
    expect(applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s0' }).error).toBe('slotOccupied')
    expect(applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state.office.slots.find((x) => x.id === 'r1-s0')!.itemId).toBeUndefined()
  })
})

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
    const fx = stageFixtures(3)
    const col = [...fx.noPiece].map((k) => k.split(',').map(Number) as [number, number]).find(([x, z]) => ringOfCell({ x, z }) <= 3 && !(x === fx.door.x && z === fx.door.z))!
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

  it('the game’s stage move points a re-placed desk’s sitter at its new slot', () => {
    const fx = stageFixtures(3)
    const [x, z] = [...fx.noPiece].map((k) => k.split(',').map(Number) as [number, number]).find(([cx, cz]) => ringOfCell({ x: cx, z: cz }) <= 3 && !(cx === fx.door.x && cz === fx.door.z))!
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

describe('save v4 → v5', () => {
  it('SAVE_VERSION is 5', () => {
    expect(SAVE_VERSION).toBe(5)
  })

  it('the v4 fixture loads with team labels and empty decor, and lays out exactly as before', () => {
    const raw = saveV4 as unknown as { version: number; state: GameState }
    expect(raw.version).toBe(4)
    const before = layoutOf(raw.state.office)
    const s = deserialize(JSON.stringify(raw))!
    expect(s.meta.saveVersion).toBe(5)
    expect(layoutOf(s.office)).toEqual(before)
    expect(s.office).toMatchObject({ decor: [], walls: [], storage: [], saved: [] })
    for (const slot of s.office.slots) {
      const e = s.employees.find((x) => x.id === slot.occupantId)
      expect(slot.team).toBe(e?.dept)
    }
    expect(s.office.slots.filter((x) => x.team).length).toBe(3)
    expect(validateLayout(s.office).ok).toBe(true)
  })

  it('mock states 0–6 lay out the same after the migration; a dept desk takes its dept', () => {
    for (const st of STAGES) {
      const m = createMockState(st)
      const before = layoutOf(m.office)
      const back = deserialize(JSON.stringify({ version: 4, state: { ...m, office: { stage: m.office.stage, rings: m.office.rings, slots: m.office.slots } } }))!
      expect(layoutOf(back.office), `mock s${st}`).toEqual(before)
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
