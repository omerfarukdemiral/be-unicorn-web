// Office edit mode (grid step 3): the pure draft reducer (select, move, turn, team label, undo / redo, refusals) and
// the store around it (the `layout` pause, Vazgeç drops everything, Bitti is one applyLayout).
import { beforeEach, describe, expect, it } from 'vitest'
import { applyAction, createGame } from '../engine'
import { buildOffice } from '../engine/office'
import type { GameState, OfficeState } from '../engine/types'
import { UI_TEXT } from '../content'
import { effectiveSpeed, pauseReasonsOf, useGameStore } from './gameStore'
import { draftOffice, draftPieces, isDirty, reduceLayoutEdit, startEdit, UNDO_MAX, type LayoutEdit } from './layoutEdit'

/** Pre-seed office (2 rings open), desks on r1-s0 (0,-1) and r1-s1 (0,1); the door cell is (3,-3). */
function game(): GameState {
  let s = createGame({ seed: 1 })
  s = { ...s, stage: 1, office: buildOffice(1, 2), stats: { ...s.stats, cash: 1e9 } }
  for (const id of ['r1-s0', 'r1-s1']) s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: id }).state
  return s
}

const office = (): OfficeState => game().office
const run = (o: OfficeState, e: LayoutEdit, ...ops: Parameters<typeof reduceLayoutEdit>[2][]) => ops.reduce((acc, op) => reduceLayoutEdit(o, acc, op, 1), e)

describe('layout edit reducer', () => {
  it('starts clean: empty draft, nothing selected, nothing to keep', () => {
    const e = startEdit(office())
    expect(e.draft.slots).toEqual({})
    expect(isDirty(e)).toBe(false)
    expect(draftPieces(office(), e.draft).map((p) => [p.id, p.x, p.z, p.moved])).toEqual([
      ['r1-s0', 0, -1, false],
      ['r1-s1', 0, 1, false],
    ])
  })

  it('a legal move lands in the draft (one undo step) and the scene view keeps the live slot id', () => {
    const o = office()
    const e = run(o, startEdit(o), { kind: 'place', id: 'r1-s0', x: 2, z: -3 })
    expect(e.draft.slots['r1-s0']).toMatchObject({ x: 2, z: -3 })
    expect(e.undo).toHaveLength(1)
    expect(e.selected).toBe('r1-s0')
    expect(e.refused).toBeNull()
    const view = draftOffice(o, e.draft)
    expect(view.slots.find((s) => s.id === 'r1-s0')).toMatchObject({ pos: { x: 2, z: -3 }, itemId: 'desk-basic' })
    // The canonical cell it left stays as an empty suggested cell (ring bands keep their boxes).
    expect(view.slots.find((s) => s.id === 'r1-s0~')).toMatchObject({ pos: { x: 0, z: -1 } })
    expect(view.slots.find((s) => s.id === 'r1-s0~')!.itemId).toBeUndefined()
    // The live office is untouched until Bitti.
    expect(o.slots.find((s) => s.id === 'r1-s0')!.pos).toEqual({ x: 0, z: -1 })
    expect(draftOffice(o, startEdit(o).draft)).toBe(o)
  })

  it('refuses a door block and a sealed desk with red cells and the reason; the draft stays as it was', () => {
    const o = office()
    const e1 = run(o, startEdit(o), { kind: 'place', id: 'r1-s0', x: 2, z: -3 })
    const door = reduceLayoutEdit(o, e1, { kind: 'place', id: 'r1-s1', x: 3, z: -2 }, 42)
    expect(door.draft).toBe(e1.draft)
    expect(door.undo).toBe(e1.undo)
    expect(door.refused).toMatchObject({ reason: 'blocksDoor', at: 42 })
    expect(door.refused!.cells).toContain('3,-2')

    let s = game()
    s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r2-s0' }).state
    const sealed = run(s.office, startEdit(s.office), { kind: 'place', id: 'r1-s0', x: -1, z: -2 })
    expect(sealed.refused?.reason).toBe('sealsDesk')
    expect(sealed.draft.slots).toEqual({})
    // On another piece, on a fixture (the door cell), outside the open rings.
    expect(run(o, startEdit(o), { kind: 'place', id: 'r1-s0', x: 0, z: 1 }).refused?.reason).toBe('overlap')
    expect(run(o, startEdit(o), { kind: 'place', id: 'r1-s0', x: 3, z: -3 }).refused?.reason).toBe('fixture')
    expect(run(o, startEdit(o), { kind: 'place', id: 'r1-s0', x: 5, z: 0 }).refused?.reason).toMatch(/locked|outside/)
  })

  it('every refusal has a short line in the game voice (no em dash)', () => {
    for (const r of ['blocksDoor', 'sealsDesk', 'typeCap', 'decorCap', 'overlap', 'fixture', 'locked', 'outside', 'founder', 'invalid']) {
      const line = UI_TEXT[`layout.reason.${r}`]
      expect(line, r).toBeTruthy()
      expect(line!.split(/\s+/).length, r).toBeLessThanOrEqual(6)
      expect(line).not.toMatch(/—/)
    }
    expect(UI_TEXT['layout.reason.typeCap']).toBe('Ofis dolu.')
  })

  it('turns a piece 90° in place; the founder desk is fixed', () => {
    const o = office()
    const r0 = o.slots.find((s) => s.id === 'r1-s0')!.rotation
    const e = run(o, startEdit(o), { kind: 'select', id: 'r1-s0' }, { kind: 'rotate' })
    expect(e.draft.slots['r1-s0']).toEqual({ x: 0, z: -1, r: (r0 + 1) & 3 })
    expect(draftPieces(o, e.draft).find((p) => p.id === 'r1-s0')).toMatchObject({ r: (r0 + 1) & 3, moved: true })
    const f = run(o, e, { kind: 'select', id: 'founder' })
    expect(f.selected).toBeNull()
    expect(f.refused).toMatchObject({ reason: 'founder', cells: ['0,0'] })
    expect(run(o, f, { kind: 'place', id: 'founder', x: 1, z: 1 }).draft).toBe(e.draft)
  })

  it('team label: desks only, the same label twice is no change', () => {
    const o = office()
    const e = run(o, startEdit(o), { kind: 'select', id: 'r1-s1' }, { kind: 'team', team: 'sales' })
    expect(e.draft.slots['r1-s1']).toEqual({ x: 0, z: 1, r: o.slots.find((s) => s.id === 'r1-s1')!.rotation, team: 'sales' })
    expect(reduceLayoutEdit(o, e, { kind: 'team', team: 'sales' })).toBe(e)
    // The label rides along when the desk then moves.
    const moved = run(o, e, { kind: 'place', id: 'r1-s1', x: -2, z: 2 })
    expect(moved.draft.slots['r1-s1']).toMatchObject({ x: -2, z: 2, team: 'sales' })
  })

  it('undo / redo walk the draft history; a new change clears redo; the stack is capped', () => {
    const o = office()
    const a = run(o, startEdit(o), { kind: 'place', id: 'r1-s0', x: 2, z: -3 })
    const b = run(o, a, { kind: 'place', id: 'r1-s1', x: -2, z: 2 })
    const u = run(o, b, { kind: 'undo' })
    expect(u.draft).toBe(a.draft)
    expect(u.redo).toHaveLength(1)
    expect(run(o, u, { kind: 'redo' }).draft).toBe(b.draft)
    const back = run(o, u, { kind: 'undo' })
    expect(back.draft.slots).toEqual({})
    expect(isDirty(back)).toBe(false)
    expect(run(o, back, { kind: 'undo' })).toBe(back)
    const fresh = run(o, u, { kind: 'rotate', id: 'r1-s1' })
    expect(fresh.redo).toEqual([])
    let many = startEdit(o)
    for (let i = 0; i < UNDO_MAX + 5; i++) many = reduceLayoutEdit(o, many, { kind: 'rotate', id: 'r1-s1' })
    expect(many.undo).toHaveLength(UNDO_MAX)
  })
})

describe('layout edit in the store', () => {
  const store = () => useGameStore.getState()
  beforeEach(() => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    useGameStore.setState((st) => ({ state: { ...game(), time: { ...st.state.time, speed: 1 } }, ui: { ...st.ui, runStarted: true } }))
  })

  it('entering pauses (`layout`), owns the panel and keeps the camera off the close zoom', () => {
    store().setZoom(2)
    expect(store().beginLayoutEdit()).toBe(true)
    const ui = store().ui
    expect(ui.pauseReasons).toEqual(['layout'])
    expect(effectiveSpeed(store())).toBe(0)
    expect(store().state.time.speed).toBe(1)
    expect(ui.panel).toEqual({ kind: 'layout' })
    expect(ui.zoom).toBe(1)
    store().setZoom(2)
    expect(store().ui.zoom).toBe(1)
    // Nothing else opens over the draft; a scene tap selects nothing.
    store().openPanel({ kind: 'team' })
    store().select({ kind: 'founder' })
    store().openOverlay({ kind: 'stats' })
    expect(store().ui.panel).toEqual({ kind: 'layout' })
    expect(store().ui.overlay).toBeNull()
    expect(pauseReasonsOf({ overlay: null, panel: null, layoutEdit: {} })).toEqual(['layout'])
    expect(store().beginLayoutEdit()).toBe(false)
  })

  it('Vazgeç drops the draft: the office is the same object, time flows again', () => {
    const before = store().state.office
    store().beginLayoutEdit()
    store().layoutEditOp({ kind: 'place', id: 'r1-s0', x: 2, z: -3 })
    expect(isDirty(store().ui.layoutEdit!)).toBe(true)
    store().cancelLayoutEdit()
    expect(store().state.office).toBe(before)
    expect(store().ui.layoutEdit).toBeNull()
    expect(store().ui.panel).toBeNull()
    expect(store().ui.pauseReasons).toEqual([])
    expect(effectiveSpeed(store())).toBe(1)
    // Closing the panel is Vazgeç too.
    store().beginLayoutEdit()
    store().layoutEditOp({ kind: 'place', id: 'r1-s0', x: 2, z: -3 })
    store().closePanel()
    expect(store().ui.layoutEdit).toBeNull()
    expect(store().state.office).toBe(before)
  })

  it('Bitti commits the whole draft as one applyLayout; the seat and label travel with the desk', () => {
    const e = store().state.employees[0]
    store().beginLayoutEdit()
    store().layoutEditOp({ kind: 'place', id: 'r1-s0', x: 2, z: -3 })
    store().layoutEditOp({ kind: 'team', id: 'r1-s1', team: 'eng' })
    const n = store().exportReplay().actions.length
    const res = store().commitLayoutEdit()
    expect(res?.ok).toBe(true)
    const acts = store().exportReplay().actions.slice(n)
    expect(acts.map((a) => a.action.type)).toEqual(['applyLayout'])
    const slots = store().state.office.slots
    expect(slots.find((s) => s.itemId && s.pos.x === 2 && s.pos.z === -3)).toMatchObject({ free: true })
    expect(slots.find((s) => s.id === 'r1-s0')!.itemId).toBeUndefined()
    expect(slots.find((s) => s.id === 'r1-s1')!.team).toBe('eng')
    expect(store().ui.layoutEdit).toBeNull()
    expect(store().ui.pauseReasons).toEqual([])
    if (e?.deskSlotId) expect(slots.find((s) => s.id === e.deskSlotId)?.occupantId).toBe(e.id)
  })

  it('Bitti with nothing changed just closes; a refused draft keeps the edit mode open with the reason', () => {
    const before = store().state.office
    store().beginLayoutEdit()
    expect(store().commitLayoutEdit()?.ok).toBe(true)
    expect(store().state.office).toBe(before)
    expect(store().ui.layoutEdit).toBeNull()
    // A draft that turned illegal under it (forced here): nothing moves, the draft stays.
    store().beginLayoutEdit()
    const bad = { slots: { 'r1-s0': { x: 2, z: -3, r: 0 as const }, 'r1-s1': { x: 3, z: -2, r: 0 as const } }, decor: [] }
    useGameStore.setState((st) => ({ ui: { ...st.ui, layoutEdit: { ...st.ui.layoutEdit!, draft: bad, undo: [{ slots: {}, decor: [] }] } } }))
    const res = store().commitLayoutEdit()
    expect(res).toMatchObject({ ok: false, error: 'blocksDoor' })
    expect(store().state.office).toBe(before)
    expect(store().ui.layoutEdit?.draft).toBe(bad)
    expect(store().ui.pauseReasons).toEqual(['layout'])
  })

  it('no edit mode over a blocking modal or after the end', () => {
    store().openOverlay({ kind: 'victory' })
    expect(store().beginLayoutEdit()).toBe(false)
    store().closeOverlay()
    useGameStore.setState((st) => ({ state: { ...st.state, gameOver: { reason: 'bankrupt' } as never } }))
    expect(store().beginLayoutEdit()).toBe(false)
  })
})
