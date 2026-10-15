// Grid step 5 (design §5): team islands. Same-label desks at Chebyshev ≤ 1, ≥ 3 of them, each seating someone of
// that team, give +TEAM_ADJ_BONUS speed. It replaced the +10% dept cluster (radius 2); the two never stack. Auto
// seating grows islands on its own (phones and bots only buy onto ring slots), and old saves keep working.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { computeOutputs } from '../derive'
import { createEngine } from '../index'
import { autoSeat, stageFixtures, validateLayout } from '../layout'
import { buildOffice, relocateOffice, teamClusteredEmployees, teamClusters, teamIslands, type TeamDesk } from '../office'
import { deserialize, migrate, serialize } from '../save'
import { FOUNDER_SLOT_ID, type Candidate, type Dept, type Employee, type GameState, type OfficeState, type Slot } from '../types'
import { clone } from '../util'
import { fakeContent } from './fixtures'
import saveV4 from './data/saveV4.json'

const content = fakeContent()
const api = createEngine(content)

const desk = (id: string, x: number, z: number, team?: Dept, occupantId?: string): TeamDesk => ({ id, pos: { x, z }, ...(team ? { team } : {}), ...(occupantId ? { occupantId } : {}) })
/** Every occupant id's dept is its prefix: "eng1" → eng. */
const deptOf = (id: string): Dept | undefined => (['eng', 'product', 'sales', 'marketing', 'support'] as Dept[]).find((d) => id.startsWith(d))
const active = (desks: TeamDesk[]) => teamIslands(desks, deptOf).filter((c) => c.active).map((c) => c.slotIds.slice().sort())

describe('the island rule', () => {
  it('3 in a row is an island, 2 is not', () => {
    expect(active([desk('a', 0, 0, 'eng', 'eng1'), desk('b', 1, 0, 'eng', 'eng2')])).toEqual([])
    expect(active([desk('a', 0, 0, 'eng', 'eng1'), desk('b', 1, 0, 'eng', 'eng2'), desk('c', 2, 0, 'eng', 'eng3')])).toEqual([['a', 'b', 'c']])
  })

  it('diagonals link (Chebyshev 1); a one-cell gap breaks the island (the old radius 2 does not count)', () => {
    expect(active([desk('a', 0, 0, 'eng', 'eng1'), desk('b', 1, 1, 'eng', 'eng2'), desk('c', 2, 2, 'eng', 'eng3')])).toEqual([['a', 'b', 'c']])
    expect(active([desk('a', 0, 0, 'eng', 'eng1'), desk('b', 1, 0, 'eng', 'eng2'), desk('c', 3, 0, 'eng', 'eng3')])).toEqual([])
    expect(active([desk('a', 0, 0, 'eng', 'eng1'), desk('b', 2, 0, 'eng', 'eng2'), desk('c', 0, 2, 'eng', 'eng3')])).toEqual([])
  })

  it('mixed labels, unlabelled desks, empty desks and a sitter from another team never count', () => {
    // Two eng and a sales desk side by side.
    expect(active([desk('a', 0, 0, 'eng', 'eng1'), desk('b', 1, 0, 'eng', 'eng2'), desk('c', 2, 0, 'sales', 'sales1')])).toEqual([])
    // An unlabelled desk between two eng desks is a gap.
    expect(active([desk('a', 0, 0, 'eng', 'eng1'), desk('b', 1, 0, undefined, 'eng2'), desk('c', 2, 0, 'eng', 'eng3')])).toEqual([])
    // An empty eng desk is no teammate.
    expect(active([desk('a', 0, 0, 'eng', 'eng1'), desk('b', 1, 0, 'eng'), desk('c', 2, 0, 'eng', 'eng3')])).toEqual([])
    // A sales hire on an eng-labelled desk is no teammate either.
    expect(active([desk('a', 0, 0, 'eng', 'eng1'), desk('b', 1, 0, 'eng', 'sales1'), desk('c', 2, 0, 'eng', 'eng3')])).toEqual([])
    // Two teams of three: two islands.
    expect(
      active([
        desk('a', 0, 0, 'eng', 'eng1'), desk('b', 1, 0, 'eng', 'eng2'), desk('c', 2, 0, 'eng', 'eng3'),
        desk('d', 0, 1, 'sales', 'sales1'), desk('e', 1, 1, 'sales', 'sales2'), desk('f', 2, 1, 'sales', 'sales3'),
      ]),
    ).toEqual([['a', 'b', 'c'], ['d', 'e', 'f']])
  })

  it('the founder desk is never part of an island', () => {
    const o = buildOffice(0, 1)
    const founder = o.slots.find((s) => s.id === FOUNDER_SLOT_ID)!
    Object.assign(founder, { team: 'eng', occupantId: 'eng0', itemId: 'desk-basic' })
    // r1-s0 (0,-1) and r1-s2 (1,0) touch each other and the founder (0,0).
    for (const [id, who] of [['r1-s0', 'eng1'], ['r1-s2', 'eng2']] as const) Object.assign(o.slots.find((s) => s.id === id)!, { itemId: 'desk-basic', team: 'eng', occupantId: who })
    expect(teamClusters(o, deptOf).filter((c) => c.active)).toEqual([])
    Object.assign(o.slots.find((s) => s.id === 'r1-s1')!, { itemId: 'desk-basic', team: 'eng', occupantId: 'eng3' })
    // r1-s1 is (0,1): it touches r1-s2 (1,0) diagonally, so the ring desks alone make three.
    expect(teamClusters(o, deptOf).filter((c) => c.active).map((c) => c.slotIds.sort())).toEqual([['r1-s0', 'r1-s1', 'r1-s2']])
  })
})

// ---------------------------------------------------------------------------
// Output: +TEAM_ADJ_BONUS, and nothing of the old +10% dept cluster
// ---------------------------------------------------------------------------

function employee(id: string, dept: Dept, deskSlotId: string): Employee {
  return { id, name: id, dept, quality: 1, salary: 3000, status: 'working', statusSinceDay: 0, hiredDay: 0, morale: 70, deskSlotId }
}

/** A Garage company whose desks and sitters are given as [slot id, employee id, dept, label?]. */
function seated(rows: [string, string, Dept, Dept?][], office: OfficeState = buildOffice(0, 1)): GameState {
  const s = clone(api.createGame({ seed: 5 }))
  s.office = office
  s.employees = rows.map(([slot, id, dept]) => employee(id, dept, slot))
  for (const [slot, id, , team] of rows) {
    const x = s.office.slots.find((q) => q.id === slot)!
    x.itemId = 'desk-basic'
    x.occupantId = id
    if (team) x.team = team
  }
  return s
}

describe('output', () => {
  it('a person in an island works TEAM_ADJ_BONUS faster than the same person alone; the bonus is light (3–5%)', () => {
    expect(B.TEAM_ADJ_BONUS).toBeGreaterThanOrEqual(0.03)
    expect(B.TEAM_ADJ_BONUS).toBeLessThanOrEqual(0.05)
    const island = seated([['r1-s0', 'a', 'eng', 'eng'], ['r1-s2', 'b', 'eng', 'eng'], ['r1-s1', 'c', 'eng', 'eng']])
    const apart = seated([['r1-s0', 'a', 'eng', 'eng'], ['r1-s2', 'b', 'eng', 'sales'], ['r1-s1', 'c', 'eng', 'eng']])
    expect([...teamClusteredEmployees(island)].sort()).toEqual(['a', 'b', 'c'])
    expect(teamClusteredEmployees(apart).size).toBe(0)
    const on = computeOutputs(island, content).perEmployee
    const off = computeOutputs(apart, content).perEmployee
    expect(on['a']! / off['a']!).toBeCloseTo(1 + B.TEAM_ADJ_BONUS, 9)
  })

  it('the old dept cluster (same dept within radius 2, no labels) gives nothing now: no stacking', () => {
    // Three eng people on unlabelled ring desks, all within Chebyshev 2: the old rule paid +10% here.
    const old = seated([['r1-s0', 'a', 'eng'], ['r1-s2', 'b', 'eng'], ['r1-s1', 'c', 'eng']])
    const lone = seated([['r1-s0', 'a', 'eng'], ['r1-s2', 'b', 'sales'], ['r1-s1', 'c', 'product']])
    expect(teamClusteredEmployees(old).size).toBe(0)
    expect(computeOutputs(old, content).perEmployee['a']! / computeOutputs(lone, content).perEmployee['a']!).toBeCloseTo(1, 9)
    expect(Object.keys(B)).not.toContain('DEPT_CLUSTER_BONUS')
    // In an island the factor is exactly 1 + TEAM_ADJ_BONUS, never 1 + 0.10 + TEAM_ADJ_BONUS.
    const both = seated([['r1-s0', 'a', 'eng', 'eng'], ['r1-s2', 'b', 'eng', 'eng'], ['r1-s1', 'c', 'eng', 'eng']])
    expect(computeOutputs(both, content).perEmployee['a']! / computeOutputs(lone, content).perEmployee['a']!).toBeCloseTo(1 + B.TEAM_ADJ_BONUS, 9)
  })
})

// ---------------------------------------------------------------------------
// Auto layout earns it (phones and bots: buys go onto ring slots, hires are auto seated)
// ---------------------------------------------------------------------------

function candidate(id: string, dept: Dept): Candidate {
  return { id, name: id, dept, quality: 1, salary: 3000, expiresDay: 9999 }
}

/** A rich Seed company with every ring desk bought by auto placement, then `depts` hired in order. */
function autoOffice(depts: Dept[]): GameState {
  let s = clone(api.createGame({ seed: 9 }))
  s.stage = 2
  s.office = buildOffice(2, 3)
  s.stats.cash = 1e9
  for (;;) {
    const r = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' })
    if (!r.ok) break
    s = r.state
  }
  depts.forEach((d, i) => {
    s = clone(s)
    s.candidates = [candidate(`c${i}`, d)]
    const r = api.applyAction(s, { type: 'hire', candidateId: `c${i}` })
    expect(r.ok).toBe(true)
    s = r.state
  })
  return s
}

describe('auto seating groups each team', () => {
  it('interleaved hires of three teams end in three islands: everyone gets the bonus', () => {
    const depts: Dept[] = ['eng', 'sales', 'marketing', 'eng', 'sales', 'marketing', 'eng', 'sales', 'marketing']
    const s = autoOffice(depts)
    expect(s.employees.every((e) => e.deskSlotId !== undefined)).toBe(true)
    expect(teamClusteredEmployees(s).size).toBe(9)
    expect(validateLayout(s.office).ok).toBe(true)
    // Today's ring slots and their aisles stay buyable: no desk moved onto a ring slot of another kind.
    for (const x of s.office.slots.filter((q) => !q.free && q.type !== 'desk')) expect(x.itemId).toBeUndefined()
  })

  it('a bigger team keeps one island as it grows (12 hires, Seed desk cap)', () => {
    const depts: Dept[] = ['eng', 'eng', 'product', 'eng', 'sales', 'eng', 'product', 'eng', 'sales', 'product', 'eng', 'sales']
    const s = autoOffice(depts)
    const islands = teamClusters(s.office, (id) => s.employees.find((e) => e.id === id)?.dept).filter((c) => c.active)
    expect(islands.find((c) => c.team === 'eng')?.slotIds.length).toBe(6)
    expect(teamClusteredEmployees(s).size).toBe(12)
  })

  it('a labelled spare desk is never carried off; the hire still sits', () => {
    const s = clone(autoOffice(['eng']))
    for (const x of s.office.slots) if (x.type === 'desk' && x.itemId && !x.occupantId) x.team = 'sales'
    const before = s.office.slots.map((x: Slot) => [x.id, x.pos.x, x.pos.z, x.itemId])
    expect(autoSeat(s.office, 'eng')).toBeDefined()
    expect(s.office.slots.map((x: Slot) => [x.id, x.pos.x, x.pos.z, x.itemId])).toEqual(before)
  })
})

describe('stage moves keep every desk', () => {
  it('two desks on the next office’s columns are both re-placed with their sitters (none is lost)', () => {
    const o = buildOffice(3, 4)
    // (1,-3) and (4,-3) are free cells at Series A and column cells at Series B.
    for (const [id, x, z, who] of [['f1', 1, -3, 'e1'], ['f2', 4, -3, 'e2']] as const) {
      expect(stageFixtures(4).noPiece.has(`${x},${z}`)).toBe(true)
      o.slots.push({ id, ring: x === 1 ? 2 : 3, type: 'desk', pos: { x, z }, rotation: 0, itemId: 'desk-basic', occupantId: who, team: 'eng', free: true })
    }
    const next = relocateOffice(o, 4)
    const seats = next.slots.filter((s) => s.occupantId !== undefined).map((s) => s.occupantId).sort()
    expect(seats).toEqual(['e1', 'e2'])
    expect(next.slots.filter((s) => s.itemId === 'desk-basic')).toHaveLength(2)
  })

  it('auto seating never carries a desk onto a cell a later office blocks', () => {
    const s = autoOffice(['eng', 'sales', 'marketing', 'eng', 'sales', 'marketing', 'eng', 'sales', 'marketing', 'eng', 'sales', 'product'])
    for (let st = 3; st <= 6; st++) {
      const fx = stageFixtures(st as 3 | 4 | 5 | 6)
      for (const x of s.office.slots.filter((q) => q.free)) expect(fx.noPiece.has(`${x.pos.x},${x.pos.z}`) || fx.blocked.has(`${x.pos.x},${x.pos.z}`)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

describe('save compatibility', () => {
  it('a v4 save of a same-team ring loads with labels and its island; a mixed one loads with none', () => {
    const raw = structuredClone(saveV4) as unknown as { version: number; state: GameState }
    for (const e of raw.state.employees) e.dept = 'eng'
    const s = migrate(raw)!
    expect(s.office.slots.filter((x) => x.occupantId).every((x) => x.team === 'eng')).toBe(true)
    expect(teamClusteredEmployees(s).size).toBe(3)
    const mixed = migrate(structuredClone(saveV4) as unknown as { version: number; state: GameState })!
    expect(teamClusteredEmployees(mixed).size).toBe(0)
    const o = computeOutputs(mixed, content).perEmployee
    expect(Object.values(o).every((v) => Number.isFinite(v) && v > 0)).toBe(true)
  })

  it('islands survive a save round trip (labels are saved, nothing new to store)', () => {
    const s = autoOffice(['eng', 'eng', 'eng', 'sales'])
    const back = deserialize(serialize(s))!
    expect([...teamClusteredEmployees(back)].sort()).toEqual([...teamClusteredEmployees(s)].sort())
    expect(teamClusteredEmployees(back).size).toBe(3)
  })
})
