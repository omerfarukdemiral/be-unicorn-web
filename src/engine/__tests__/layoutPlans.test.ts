// Grid step 6: presets, Otomatik düzenle and saved layouts become edit drafts. Every one must be a legal layout on
// every stage and ring state, keep the founder desk, seat teams into islands where the office has the people, and a
// saved layout must never buy: what the company does not own comes back as missing.
import { describe, expect, it } from 'vitest'
import { createEngine } from '../index'
import { deserialize, serialize } from '../save'
import { fakeContent } from './fixtures'
import { applySnapshot, autoPlace, previewSnapshot, putItem, validateLayout } from '../layout'
import { LAYOUT_PRESETS, autoArrangeDraft, captureLayout, islandHeads, missingPieces, presetDraft, savedDraft } from '../layoutPlans'
import { buildOffice, relocateOffice, stageRingCount } from '../office'
import { DEPTS, FOUNDER_SLOT_ID, type Dept, type LayoutSnapshot, type OfficeState, type StageIndex } from '../types'

/** Occupant ids carry their dept: "eng-3" → eng. */
const deptOf = (id: string): Dept | undefined => DEPTS.find((d) => id.startsWith(`${d}-`))
const EMPTY: LayoutSnapshot = { slots: {}, decor: [] }

/**
 * A real office the way auto placement fills it: `rings` open, `desks` desks (every seat but the last two taken, the
 * teams dealt round-robin over `teams`), plus a coffee corner and a meeting room where the caps allow, plus decor.
 */
function filled(stage: StageIndex, rings: number, desks: number, teams: Dept[] = ['eng', 'product', 'marketing']): OfficeState {
  const o = buildOffice(stage, rings)
  for (let i = 0; i < desks; i++) {
    const team = teams[i % teams.length]!
    const p = autoPlace(o, { slotType: 'desk', size: 1 }, { team })
    if (!p) break
    const a = putItem(o, p, 'desk-basic', { slotType: 'desk', size: 1 })
    a.rotation = p.rotation
    if (i < desks - 2) {
      a.occupantId = `${team}-${i}`
      a.team = team
    }
  }
  for (const [itemId, slotType, size] of [['coffee', 'common', 1], ['meeting', 'room', 2]] as const) {
    const p = autoPlace(o, { slotType, size })
    if (p) putItem(o, p, itemId, { slotType, size }).rotation = p.rotation
  }
  if (stage >= 1) o.decor!.push({ id: 'd1', kind: 'plantPot', pos: { x: -1, z: 2 }, rotation: 0 }, { id: 'd2', kind: 'rug', pos: { x: 2, z: -2 }, rotation: 0 })
  o.decor = o.decor!.filter((_, i) => {
    const t = { ...o, decor: o.decor!.slice(0, i + 1) }
    return validateLayout(t).ok
  })
  expect(validateLayout(o)).toEqual({ ok: true, bad: [] })
  return o
}

const DESKS_BY_RING = [0, 4, 8, 12, 21, 28, 36]

function applied(o: OfficeState, d: LayoutSnapshot | null): OfficeState {
  expect(d).not.toBeNull()
  const res = applySnapshot(o, d!)
  if ('error' in res) throw new Error(res.error)
  return res.office
}

const founderOf = (o: OfficeState) => o.slots.find((s) => s.id === FOUNDER_SLOT_ID)
const seats = (o: OfficeState) => o.slots.filter((s) => s.occupantId !== undefined).map((s) => s.occupantId!).sort()
const items = (o: OfficeState) => o.slots.filter((s) => s.itemId !== undefined && s.spanOf === undefined && s.id !== FOUNDER_SLOT_ID).map((s) => s.itemId!).sort()

describe('presets and Otomatik düzenle', () => {
  for (let stage = 0 as StageIndex; stage <= 6; stage++) {
    for (let rings = 1; rings <= stageRingCount(stage); rings++) {
      it(`stage ${stage}, ${rings} ring(s) open: every plan is legal, free, keeps people, pieces and the founder desk`, () => {
        const o = filled(stage, rings, DESKS_BY_RING[rings]!)
        const plans = [...LAYOUT_PRESETS.map((p) => presetDraft(o, EMPTY, p, deptOf)), autoArrangeDraft(o, EMPTY, deptOf)]
        for (const d of plans) {
          const res = applySnapshot(o, d!)
          expect('error' in res ? res.error : null).toBeNull()
          if ('error' in res) continue
          expect(res.cost).toBe(0)
          expect(validateLayout(res.office).ok).toBe(true)
          expect(founderOf(res.office)).toEqual(founderOf(o))
          expect(seats(res.office)).toEqual(seats(o))
          expect(items(res.office)).toEqual(items(o))
        }
      })
    }
  }

  it('Klasik is today\'s default: an auto-filled office stays on its ring slots', () => {
    const o = filled(3, 4, 21)
    const c = applied(o, presetDraft(o, EMPTY, 'classic', deptOf))
    expect(c.slots.filter((s) => s.free)).toEqual([])
  })

  it('islands, open office and rows seat teams side by side for the +3% (a full Series A office)', () => {
    const o = filled(3, 4, 21)
    const base = islandHeads(o, deptOf)
    for (const p of ['islands', 'open', 'rows'] as const) {
      const heads = islandHeads(applied(o, presetDraft(o, EMPTY, p, deptOf)), deptOf)
      // 19 people in three teams of 6-7: nearly everyone in an island.
      expect(heads, p).toBeGreaterThanOrEqual(15)
      expect(heads, p).toBeGreaterThan(base)
    }
    expect(islandHeads(applied(o, autoArrangeDraft(o, EMPTY, deptOf)), deptOf)).toBeGreaterThan(base)
  })

  it('Ekip adaları gives every team its own pod: no two teams share an island block', () => {
    const o = filled(4, 5, 28, ['eng', 'sales'])
    const a = applied(o, presetDraft(o, EMPTY, 'islands', deptOf))
    // Desks labelled for one team never touch a desk of the other team.
    const desks = a.slots.filter((s) => s.type === 'desk' && s.team && s.occupantId && s.id !== FOUNDER_SLOT_ID)
    for (const x of desks) for (const y of desks) if (x.team !== y.team) expect(Math.max(Math.abs(x.pos.x - y.pos.x), Math.abs(x.pos.z - y.pos.z))).toBeGreaterThan(1)
  })

  it('is deterministic and builds on the open draft (its decor stays where it fits)', () => {
    const o = filled(2, 3, 12)
    expect(presetDraft(o, EMPTY, 'open', deptOf)).toEqual(presetDraft(o, EMPTY, 'open', deptOf))
    const d = presetDraft(o, EMPTY, 'rows', deptOf)!
    // Decor is kept by id (free) or goes to storage, never bought.
    for (const p of d.decor) expect(o.decor!.some((q) => q.id === p.id && q.kind === p.kind)).toBe(true)
    // Applying a preset over another preset's draft works the same as over the live office.
    const twice = presetDraft(o, d, 'classic', deptOf)
    expect(twice).not.toBeNull()
    expect(validateLayout(applied(o, twice)).ok).toBe(true)
  })
})

describe('saved layouts', () => {
  it('a saved layout comes back exactly on the same office', () => {
    const o = filled(3, 4, 21)
    const shaped = applied(o, presetDraft(o, EMPTY, 'islands', deptOf))
    const saved = captureLayout(shaped, 'Adalar')
    expect(saved.stage).toBe(3)
    const back = applied(o, savedDraft(o, EMPTY, saved, deptOf)!.draft)
    const cells = (x: OfficeState) => x.slots.filter((s) => s.itemId !== undefined && s.spanOf === undefined).map((s) => `${s.itemId}@${s.pos.x},${s.pos.z}/${s.rotation}`).sort()
    expect(cells(back)).toEqual(cells(shaped))
    expect(islandHeads(back, deptOf)).toBe(islandHeads(shaped, deptOf))
    expect(savedDraft(o, EMPTY, saved, deptOf)!.missing).toEqual([])
  })

  it('applies after a stage move; pieces the company does not own are missing, never bought', () => {
    const o = filled(2, 3, 12)
    o.decor!.push({ id: 'd9', kind: 'panel', pos: { x: 4, z: 4 }, rotation: 0 })
    o.walls = [{ wall: 'left', seg: 1, kind: 'poster' }]
    expect(validateLayout(o).ok).toBe(true)
    const saved = captureLayout(applied(o, presetDraft(o, { slots: {}, decor: o.decor!, walls: o.walls }, 'open', deptOf)), 'Seed')
    // A desk sold and a coffee machine gone before the move; the poster went to storage with the walls.
    const fewer = { ...o, slots: o.slots.map((s) => (s.itemId === 'coffee' ? { ...s, itemId: undefined } : { ...s })) }
    const next = relocateOffice(fewer, 3)
    const res = savedDraft(next, EMPTY, saved, deptOf)!
    expect(res).not.toBeNull()
    expect(res.missing).toEqual([{ kind: 'coffee', n: 1, item: true }])
    const done = applySnapshot(next, res.draft)
    if ('error' in done) throw new Error(done.error)
    expect(done.cost).toBe(0)
    // The poster came back out of storage onto its wall.
    expect(done.office.walls).toContainEqual({ wall: 'left', seg: 1, kind: 'poster' })
  })

  it('a decor piece neither placed nor stored is missing', () => {
    const o = filled(3, 4, 8)
    const saved = captureLayout({ ...o, decor: [...o.decor!, { id: 'x', kind: 'arcade', pos: { x: 6, z: 6 }, rotation: 0 }] }, 'Oyun')
    expect(savedDraft(o, EMPTY, saved, deptOf)!.missing).toEqual([{ kind: 'arcade', n: 1, item: false }])
  })
})

describe('plans over an open draft', () => {
  it('a piece the draft moved and the plan keeps stays where the draft put it', () => {
    const o = filled(2, 3, 12)
    const coffee = o.slots.find((s) => s.itemId === 'coffee')!
    // Move the coffee corner by hand to the first legal free cell, then ask for Otomatik düzenle (it keeps non-desk pieces).
    let moved: LayoutSnapshot | null = null
    for (let x = -5; x <= 5 && !moved; x++) {
      for (let z = -5; z <= 5 && !moved; z++) {
        const d: LayoutSnapshot = { slots: { [coffee.id]: { x, z, r: 0 } }, decor: o.decor! }
        const res = previewSnapshot(o, d)
        if (!('error' in res) && res.check.ok && (x !== coffee.pos.x || z !== coffee.pos.z)) moved = d
      }
    }
    expect(moved).not.toBeNull()
    const b = applied(o, autoArrangeDraft(o, moved!, deptOf))
    const cp = moved!.slots[coffee.id]!
    expect(b.slots.find((s) => s.itemId === 'coffee')!.pos).toEqual({ x: cp.x, z: cp.z })
  })
})

describe('saveLayout / deleteLayout actions', () => {
  it('saves the draft by name (max 3, replace, delete), outside the draft and free; the save keeps them', () => {
    const api = createEngine(fakeContent())
    let s = api.createGame({ seed: 3 })
    s.office = filled(2, 3, 6)
    const cash = s.stats.cash
    const save = (name: string, replace?: number) => api.applyAction(s, { type: 'saveLayout', name, draft: EMPTY, ...(replace !== undefined ? { replace } : {}) })
    expect(save('   ').ok).toBe(false)
    for (const n of ['  Bir   iki ', 'B', 'C']) {
      const r = save(n)
      expect(r.ok).toBe(true)
      s = r.state
    }
    expect(s.office.saved!.map((x) => x.name)).toEqual(['Bir iki', 'B', 'C'])
    const full = save('D')
    expect(full.ok ? null : full.error).toBe('officeFull')
    const r = save('D', 1)
    expect(r.ok).toBe(true)
    s = r.state
    expect(s.office.saved!.map((x) => x.name)).toEqual(['Bir iki', 'D', 'C'])
    expect(s.stats.cash).toBe(cash)
    const d = api.applyAction(s, { type: 'deleteLayout', index: 0 })
    expect(d.ok).toBe(true)
    s = d.state
    expect(deserialize(serialize(s))!.office.saved!.map((x) => x.name)).toEqual(['D', 'C'])
    // A draft that is not a legal layout is refused.
    const founder = api.applyAction(s, { type: 'saveLayout', name: 'X', draft: { slots: { nope: { x: 0, z: 0, r: 0 } }, decor: [] } })
    expect(founder.ok).toBe(false)
  })
})

describe('missingPieces', () => {
  it('lists what the saved layout lacks and drops a piece once the draft has it', () => {
    const o = filled(3, 4, 8)
    const saved = captureLayout({ ...o, decor: [...o.decor!, { id: 'x', kind: 'arcade', pos: { x: 6, z: 6 }, rotation: 0 }] }, 'Oyun')
    const res = savedDraft(o, EMPTY, saved, deptOf)!
    expect(missingPieces(o, res.draft, saved)).toEqual([{ kind: 'arcade', n: 1, item: false }])
    const bought = { ...res.draft, decor: [...res.draft.decor, { id: 'new1', kind: 'arcade', pos: { x: 6, z: 6 }, rotation: 0 as const }] }
    expect(missingPieces(o, bought, saved)).toEqual([])
  })
})
