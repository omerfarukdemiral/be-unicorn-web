// Grid step 6 in the store: a preset, Otomatik düzenle or a saved layout is one undoable draft step (Vazgeç drops it,
// Bitti applies it for free), saving lives outside the draft, a saved layout's missing pieces show until undone, and
// the storage chip counts what a stage move put away.
import { beforeEach, describe, expect, it } from 'vitest'
import { applyAction, createGame } from '../engine'
import { islandHeads } from '../engine/layoutPlans'
import { buildOffice, relocateOffice, teamClusters } from '../engine/office'
import { type Dept, type Employee, type GameState } from '../engine/types'
import { useGameStore } from './gameStore'
import { storedPieces } from './layoutEdit'

/** A Series A company: 4 rings open, 15 desks bought by auto placement, 13 people in three teams sitting at them. */
function company(): GameState {
  let s = createGame({ seed: 4 })
  s = { ...s, stage: 3, office: buildOffice(3, 4), stats: { ...s.stats, cash: 1e9 } }
  for (let i = 0; i < 15; i++) s = applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
  const teams: Dept[] = ['eng', 'product', 'marketing']
  const desks = s.office.slots.filter((x) => x.type === 'desk' && x.itemId && x.id !== 'founder')
  const employees: Employee[] = []
  desks.slice(0, 13).forEach((d, i) => {
    const dept = teams[i % 3]!
    const id = `p${i}`
    employees.push({ id, name: id, dept, quality: 1, salary: 3000, status: 'working', statusSinceDay: 0, hiredDay: 0, morale: 70, deskSlotId: d.id })
    d.occupantId = id
    d.team = dept
  })
  return { ...s, employees }
}

const store = () => useGameStore.getState()
const deptOf = (s: GameState) => (id: string) => s.employees.find((e) => e.id === id)?.dept

describe('layout plans in the edit mode', () => {
  beforeEach(() => {
    store().newGame({ seed: 7, founderXp: 0, runIndex: 0 })
    useGameStore.setState((st) => ({ state: company(), ui: { ...st.ui, runStarted: true, layoutEdit: null, panel: null, overlay: null } }))
  })

  it('a preset is one undo step, Bitti applies it free and the teams sit in islands', () => {
    const before = store().state
    expect(store().beginLayoutEdit()).toBe(true)
    expect(store().applyLayoutPlan({ kind: 'preset', preset: 'islands' })).toBe(true)
    expect(store().ui.layoutEdit!.undo).toHaveLength(1)
    store().layoutEditOp({ kind: 'undo' })
    expect(store().ui.layoutEdit!.draft.slots).toEqual({})
    store().layoutEditOp({ kind: 'redo' })
    expect(store().commitLayoutEdit()).toMatchObject({ ok: true })
    const s = store().state
    expect(s.stats.cash).toBe(before.stats.cash)
    expect(islandHeads(s.office, deptOf(s))).toBeGreaterThan(islandHeads(before.office, deptOf(before)))
    // Every person still has a seat, on the desk the office says they sit at.
    for (const e of s.employees) expect(s.office.slots.find((x) => x.id === e.deskSlotId)?.occupantId).toBe(e.id)
    expect(teamClusters(s.office, deptOf(s)).some((c) => c.active)).toBe(true)
  })

  it('Vazgeç after Otomatik düzenle leaves the office as it was', () => {
    const before = store().state.office
    store().beginLayoutEdit()
    expect(store().applyLayoutPlan({ kind: 'auto' })).toBe(true)
    store().cancelLayoutEdit()
    expect(store().state.office).toBe(before)
  })

  it('a saved layout survives Vazgeç, comes back after a stage move and shows its missing pieces until undone', () => {
    store().beginLayoutEdit()
    store().applyLayoutPlan({ kind: 'preset', preset: 'rows' })
    expect(store().saveLayout('Sıralar')).toMatchObject({ ok: true })
    store().cancelLayoutEdit()
    expect(store().state.office.saved!.map((x) => x.name)).toEqual(['Sıralar'])
    // Series B office; one desk sold before the move.
    useGameStore.setState((st) => {
      const empty = st.state.office.slots.find((x) => x.type === 'desk' && x.itemId && !x.occupantId && x.id !== 'founder')!
      const sold = applyAction(st.state, { type: 'sellItem', slotId: empty.id }).state
      return { state: { ...sold, stage: 4, office: relocateOffice(sold.office, 4) } }
    })
    store().beginLayoutEdit()
    expect(store().applyLayoutPlan({ kind: 'saved', index: 0 })).toBe(true)
    const e = store().ui.layoutEdit!
    expect(e.fromSaved?.layout.name).toBe('Sıralar')
    store().layoutEditOp({ kind: 'undo' })
    expect(store().ui.layoutEdit!.fromSaved).toBeNull()
    store().layoutEditOp({ kind: 'redo' })
    expect(store().commitLayoutEdit()).toMatchObject({ ok: true })
  })

  it('a plan that finds no fit is refused with the reason and changes nothing', () => {
    store().beginLayoutEdit()
    useGameStore.setState((st) => ({ state: { ...st.state, office: { ...st.state.office, saved: [] } } }))
    expect(store().applyLayoutPlan({ kind: 'saved', index: 2 })).toBe(false)
    expect(store().ui.layoutEdit!.refused?.reason).toBe('plan')
    expect(store().ui.layoutEdit!.undo).toHaveLength(0)
  })

  it('the storage chip: seen on entry, a stage move adds what it stored', () => {
    const s = store().state
    s.office.decor = [{ id: 'd1', kind: 'plantPot', pos: { x: -2, z: 2 }, rotation: 0 }]
    store().markStorageSeen()
    expect(store().ui.storageSeen).toBe(0)
    const moved = relocateOffice(s.office, 4)
    expect(storedPieces(moved)).toBe(1)
    useGameStore.setState((st) => ({ state: { ...st.state, stage: 4, office: moved } }))
    expect(storedPieces(store().state.office) - store().ui.storageSeen!).toBe(1)
    store().beginLayoutEdit('storage')
    expect(store().ui.storageSeen).toBe(1)
    expect(store().ui.layoutEdit!.tab).toBe('storage')
  })
})
