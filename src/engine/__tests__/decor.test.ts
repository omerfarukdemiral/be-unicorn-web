// Grid step 4: decor pieces and their economy. The catalogue, buying on Bitti (charge / refuse / storage first),
// paint jobs, the decor cap ("Ofis dolu"), wall segments, the stage-move carry-over and the starter pieces that
// replace today's fixed coworking / Seed decor (migration included). Decor is cosmetic: auto placement is unchanged.
import { describe, expect, it } from 'vitest'
import { DECOR, PAINT_PRICE, PAINT_SWATCHES, decorDef } from '../../content/decor'
import { applyAction, createGame } from '../index'
import { autoPlace, decorBill, decorCap, decorShape, placeStarterDecor, starterPlan, validateLayout, wallSegments } from '../layout'
import { buildOffice, relocateOffice, stageRingCount } from '../office'
import { migrate } from '../save'
import type { DecorPiece, GameState, LayoutSnapshot, OfficeState, StageIndex, WallPiece } from '../types'
import { autoFill } from './officeGolden'
import saveV4 from './data/saveV4.json'

const STAGES: StageIndex[] = [0, 1, 2, 3, 4, 5, 6]
const piece = (id: string, kind: string, x: number, z: number, rotation: 0 | 1 | 2 | 3 = 0): DecorPiece => ({ id, kind, pos: { x, z }, rotation })

/** A company at `stage` with every ring open, a bare office and `cash`. */
function game(stage: StageIndex, cash = 1e9, office?: OfficeState): GameState {
  const s = createGame({ seed: 1 })
  return { ...s, stage, office: office ?? buildOffice(stage, stageRingCount(stage)), stats: { ...s.stats, cash } }
}

const layout = (s: GameState, decor: DecorPiece[], walls?: WallPiece[]) =>
  applyAction(s, { type: 'applyLayout', draft: { slots: {}, decor, ...(walls ? { walls } : {}) } satisfies LayoutSnapshot })

describe('decor catalogue', () => {
  it('kinds are unique, priced, gated by stage, and the owner prices hold', () => {
    const kinds = DECOR.map((d) => d.kind)
    expect(new Set(kinds).size).toBe(kinds.length)
    for (const d of DECOR) {
      expect(d.name.length).toBeGreaterThan(0)
      expect(d.price).toBeGreaterThan(0)
      expect(d.stage).toBeGreaterThanOrEqual(0)
      expect(d.stage).toBeLessThanOrEqual(6)
      expect(decorShape(d.kind).separator).toBe(d.group === 'separator')
    }
    expect(decorDef('panel')!.price).toBe(300)
    expect(decorDef('marblePlanter')!.price).toBe(20_000)
    expect(decorDef('poster')!.price).toBe(300)
    expect(decorDef('goldRecords')!.price).toBe(25_000)
    expect(PAINT_PRICE).toBe(200)
    expect(PAINT_SWATCHES).toHaveLength(12)
    // Only the rug is walked on, and it is the only 2×2 piece.
    expect(DECOR.filter((d) => d.group !== 'wall' && !d.blocking).map((d) => d.kind)).toEqual(['rug'])
    expect(decorShape('rug')).toMatchObject({ w: 2, d: 2 })
    // Something to place from the garage on: a separator, a floor piece, a wall piece.
    for (const g of ['separator', 'floor', 'wall'] as const) expect(DECOR.some((d) => d.group === g && d.stage === 0)).toBe(true)
  })

  it('decor caps per stage are 6 / 12 / 20 / 30 / 45 / 60 / 80', () => {
    expect(STAGES.map(decorCap)).toEqual([6, 12, 20, 30, 45, 60, 80])
  })
})

describe('buying on Bitti', () => {
  it('a new piece is charged once, on applyLayout; moving it later is free', () => {
    const s = game(1, 10_000)
    const r = layout(s, [piece('d1', 'plantRow', -3, 0)])
    expect(r.ok).toBe(true)
    expect(r.state.stats.cash).toBe(10_000 - 600)
    expect(r.state.office.decor).toEqual([piece('d1', 'plantRow', -3, 0)])
    const moved = layout(r.state, [piece('d1', 'plantRow', -3, 1, 1)])
    expect(moved.ok).toBe(true)
    expect(moved.state.stats.cash).toBe(r.state.stats.cash)
  })

  it('short of cash: refused, nothing changes', () => {
    const s = game(1, 500)
    const r = layout(s, [piece('d1', 'plantRow', -3, 0)])
    expect(r).toMatchObject({ ok: false, error: 'insufficientCash' })
    expect(r.state).toBe(s)
    // Two cheap pieces that together pass the cash are refused as a whole too.
    const two = layout(game(0, 400), [piece('d1', 'panel', 1, 1), piece('d2', 'lamp', -1, 1)])
    expect(two.error).toBe('insufficientCash')
  })

  it('storage first: a stored piece goes back up for free, the rest is bought; a piece taken out goes to storage', () => {
    const s = game(1, 10_000, { ...buildOffice(1, 2), storage: [{ kind: 'plantRow', n: 1 }] })
    const r = layout(s, [piece('d1', 'plantRow', -3, 0), piece('d2', 'plantRow', -3, 1)])
    expect(r.ok).toBe(true)
    expect(r.state.stats.cash).toBe(10_000 - 600)
    expect(r.state.office.storage).toEqual([])
    const out = layout(r.state, [piece('d2', 'plantRow', -3, 1)])
    expect(out.state.office.storage).toEqual([{ kind: 'plantRow', n: 1 }])
    expect(out.state.stats.cash).toBe(r.state.stats.cash)
  })

  it('a piece the stage does not sell yet is refused, unless it comes from storage', () => {
    expect(layout(game(1), [piece('d1', 'glass', -3, 0)]).error).toBe('notUnlocked')
    const stored = game(1, 1e6, { ...buildOffice(1, 2), storage: [{ kind: 'glass', n: 1 }] })
    expect(layout(stored, [piece('d1', 'glass', -3, 0)]).ok).toBe(true)
  })

  it('paint is a job: each newly painted wall costs 200, a repaint too, clearing gives nothing back, a stored job is free', () => {
    const s = game(1, 10_000)
    const back = { wall: 'back' as const, seg: 0, kind: 'paint', color: '#cfe6c4' }
    const r = layout(s, [], [back])
    expect(r.state.stats.cash).toBe(10_000 - 200)
    const again = layout(r.state, [], [{ ...back, color: '#3b3a45' }])
    expect(again.state.stats.cash).toBe(10_000 - 400)
    const cleared = layout(again.state, [], [])
    expect(cleared.state.office.walls).toEqual([])
    expect(cleared.state.office.storage).toEqual([])
    const stored = game(1, 10_000, { ...buildOffice(1, 2), storage: [{ kind: 'paint', n: 1 }] })
    expect(layout(stored, [], [back]).state.stats.cash).toBe(10_000)
  })

  it('decorBill prices without touching the office', () => {
    const o = buildOffice(2, 3)
    const b = decorBill(o, { decor: [piece('a', 'glass', -5, 0), piece('b', 'rug', -4, 2)], walls: [{ wall: 'left', seg: 0, kind: 'print' }] })
    expect(b).toEqual({ cost: 1_500 + 400 + 1_500, bought: { glass: 1, rug: 1, print: 1 }, storage: [] })
    expect(o.decor).toEqual([])
  })
})

describe('caps and walls', () => {
  it('Ofis dolu: past the stage cap the layout is refused as officeFull', () => {
    const o = buildOffice(0, 1)
    const walls: WallPiece[] = (['back', 'left'] as const).flatMap((wall) => [-1, 0, 1].map((seg) => ({ wall, seg, kind: 'poster' })))
    const s = game(0, 1e6, o)
    expect(layout(s, [], walls).ok).toBe(true)
    expect(layout(s, [piece('d1', 'lamp', 1, 1)], walls).error).toBe('officeFull')
  })

  it('wall segments: one piece each, none on the campus, none on the Series C glass front', () => {
    expect(wallSegments(0, 'back')).toEqual([-2, -1, 0, 1, 2])
    expect(wallSegments(5, 'back')).toEqual([])
    expect(wallSegments(5, 'left')).toHaveLength(25)
    expect(wallSegments(6, 'left')).toEqual([])
    const o = buildOffice(1, 2)
    expect(validateLayout({ ...o, walls: [{ wall: 'back', seg: 0, kind: 'poster' }, { wall: 'back', seg: 0, kind: 'clock' }] }).reason).toBe('overlap')
    expect(validateLayout({ ...o, walls: [{ wall: 'back', seg: 5, kind: 'poster' }] }).reason).toBe('outside')
    expect(validateLayout({ ...buildOffice(6, 1), walls: [{ wall: 'left', seg: 0, kind: 'paint', color: '#fff' }] }).ok).toBe(false)
  })
})

describe('stage move carry-over', () => {
  it('separators and desks carry; floor decor, wall pieces and paint jobs wait in storage', () => {
    const o = buildOffice(3, 4)
    o.decor = [piece('a', 'glass', -3, 0), piece('b', 'arcade', 3, 0)]
    o.walls = [{ wall: 'back', seg: 1, kind: 'neon' }, { wall: 'left', seg: 0, kind: 'paint', color: '#fff' }]
    const n = relocateOffice(o, 4)
    expect(n.decor).toEqual([piece('a', 'glass', -3, 0)])
    expect(n.walls).toEqual([])
    expect(n.storage).toEqual(expect.arrayContaining([{ kind: 'arcade', n: 1 }, { kind: 'neon', n: 1 }, { kind: 'paint', n: 1 }]))
    expect(validateLayout(n).ok).toBe(true)
    // To the campus: no walls there, so nothing wall-hung comes back.
    const camp = relocateOffice({ ...n, walls: [{ wall: 'left', seg: 2, kind: 'canvas' }] }, 6)
    expect(camp.walls).toEqual([])
    expect(camp.storage).toEqual(expect.arrayContaining([{ kind: 'canvas', n: 1 }]))
  })

  it('the full garage-to-campus chain keeps every office valid and never loses a piece', () => {
    let o = buildOffice(0, 1)
    o.decor = [piece('p', 'panel', 1, 1), piece('l', 'lamp', -1, 1)]
    o.walls = [{ wall: 'back', seg: -1, kind: 'poster' }]
    const total = (x: OfficeState) => (x.decor?.length ?? 0) + (x.walls ?? []).filter((w) => w.kind !== 'paint').length + (x.storage ?? []).filter((r) => r.kind !== 'paint').reduce((a, r) => a + r.n, 0)
    let before = total(o)
    for (const st of [1, 2, 3, 4, 5, 6] as StageIndex[]) {
      const given = starterPlan({ ...buildOffice(st, 1), rings: o.rings }).floor.length + starterPlan({ ...buildOffice(st, 1), rings: o.rings }).walls.length
      o = relocateOffice(o, st)
      expect(validateLayout(o).ok).toBe(true)
      // Starter pieces are only ever added (from storage first), so the owned count never drops.
      expect(total(o)).toBeGreaterThanOrEqual(before)
      expect(total(o)).toBeLessThanOrEqual(before + given)
      before = total(o)
    }
  })
})

describe('starter pieces (today’s fixed coworking / Seed decor)', () => {
  it('Pre-seed and Seed offices get their plants, banner and (Seed) prints, clock and plaque; others none', () => {
    for (const st of STAGES) {
      const o = buildOffice(st, stageRingCount(st))
      placeStarterDecor(o)
      expect(validateLayout(o).ok).toBe(true)
      const kinds = [...(o.decor ?? []).map((p) => p.kind), ...(o.walls ?? []).map((w) => w.kind)].sort()
      if (st === 1) expect(kinds).toEqual(['banner', 'plantPot', 'plantPot', 'plantPot', 'poster'])
      else if (st === 2) expect(kinds).toEqual(['banner', 'clock', 'plantPot', 'plantPot', 'plantPot', 'plaque', 'poster', 'print', 'print', 'print'])
      else expect(kinds).toEqual([])
    }
  })

  it('they never sit on a suggested cell, so auto placement (phones, bots, the sim) is unchanged', () => {
    for (const st of [1, 2] as StageIndex[]) {
      for (const open of [1, stageRingCount(st)]) {
        const bare = buildOffice(st, open)
        const dressed = buildOffice(st, open)
        placeStarterDecor(dressed)
        expect(dressed.decor!.length).toBeGreaterThan(0)
        for (const type of ['desk', 'common', 'room'] as const) {
          const spec = { slotType: type, size: type === 'room' ? (2 as const) : (1 as const) }
          expect(autoPlace(dressed, spec)).toEqual(autoPlace(bare, spec))
        }
      }
      // A fully furnished office dresses up valid, and every item keeps its slot.
      const full = autoFill(st).state.office
      const dressed = structuredClone(full)
      placeStarterDecor(dressed)
      expect(validateLayout(dressed).ok).toBe(true)
      expect(dressed.slots).toEqual(full.slots)
    }
  })

  it('v4 → v5 migration puts the starter pieces into an existing furnished Seed office', () => {
    const raw = structuredClone(saveV4) as unknown as { version: number; state: GameState }
    const office = structuredClone(autoFill(2).state.office) as Partial<OfficeState>
    delete office.decor
    delete office.walls
    delete office.storage
    delete office.saved
    for (const sl of office.slots!) delete sl.team
    raw.state = { ...raw.state, stage: 2, office: office as OfficeState }
    const s = migrate(raw)!
    expect(s.office.slots.map((x) => [x.id, x.itemId, x.pos, x.rotation])).toEqual(office.slots!.map((x) => [x.id, x.itemId, x.pos, x.rotation]))
    expect(s.office.decor!.map((p) => p.kind)).toEqual(['plantPot', 'plantPot', 'plantPot'])
    expect(s.office.walls!.length).toBe(7)
    expect(s.office.storage).toEqual([])
    expect(validateLayout(s.office).ok).toBe(true)
  })
})
