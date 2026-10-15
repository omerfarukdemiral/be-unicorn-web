// Office golden scenarios (grid step 2): canonical offices, auto placement order, stage moves and scene layouts.
// data/officeGolden.json (JSON.stringify(goldenNow())) and data/saveV4.json (v4Save()) were written on master 2fca964,
// before the free grid; officeGrid.test.ts
// replays the same scenarios on the current engine and expects a deep-equal result (no player-visible change).
import { computeLayout, type OfficeLayout } from '../../render/layout'
import { createMockState } from '../../render/mockState'
import { buildOffice, relocateOffice, stageRingCount } from '../office'
import { createGame, applyAction, serialize } from '../index'
import type { GameState, OfficeState, StageIndex } from '../types'

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6

function plain(v: unknown): unknown {
  if (typeof v === 'number') return r6(v)
  if (v instanceof Map) return [...v.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, x]) => [k, plain(x)])
  if (Array.isArray(v)) return v.map(plain)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, plain(x)]))
  return v
}

export function layoutOf(office: OfficeState): unknown {
  const L: OfficeLayout = computeLayout(office.slots, office.rings, office.stage)
  return plain(L)
}

const slotsOf = (o: OfficeState) => o.slots.map((s) => ({ id: s.id, ring: s.ring, type: s.type, pos: s.pos, rotation: s.rotation, itemId: s.itemId, spanOf: s.spanOf, occupantId: s.occupantId }))

const ITEM_BY_TYPE = [['desk', 'desk-basic', 0], ['common', 'plants', 1], ['room', 'meeting-room', 2], ['special', 'demo-stage', 5]] as const

/** Every unlocked ring bought, then items bought with no slot (auto placement) in type rotation until all refuse. */
export function autoFill(stage: StageIndex): { order: [string, string][]; state: GameState } {
  let s = createGame({ seed: 1 })
  s = { ...s, stage, office: buildOffice(stage, stageRingCount(stage)), stats: { ...s.stats, cash: 1e12 } }
  const order: [string, string][] = []
  for (let guard = 0; guard < 200; guard++) {
    let any = false
    for (const [, id, unlock] of ITEM_BY_TYPE) {
      if (unlock > stage) continue
      const before = new Set(s.office.slots.filter((x) => x.itemId).map((x) => x.id))
      const r = applyAction(s, { type: 'placeItem', itemId: id })
      if (!r.ok) continue
      any = true
      s = r.state
      for (const x of s.office.slots) if (x.itemId && !before.has(x.id)) order.push([id, x.id])
    }
    if (!any) break
  }
  return { order, state: s }
}

/** Garage with four desks, then each stage move with one more ring bought before it. */
export function moveChain(): unknown[] {
  let o = buildOffice(0, 1)
  for (const x of o.slots) if (x.ring === 1) x.itemId = 'desk-basic'
  const out: unknown[] = [slotsOf(o)]
  for (let st = 1; st <= 6; st++) {
    o = relocateOffice(o, st as StageIndex)
    const next = o.rings.find((r) => !r.unlocked)
    if (next) next.unlocked = true
    out.push({ rings: o.rings, slots: slotsOf(o) })
  }
  return out
}

export function goldenNow(): unknown {
  const stages = [0, 1, 2, 3, 4, 5, 6] as StageIndex[]
  return {
    canonical: stages.map((st) => slotsOf(buildOffice(st, stageRingCount(st)))),
    autoFill: stages.map((st) => {
      const { order, state } = autoFill(st)
      return { order, layout: layoutOf(state.office) }
    }),
    moveChain: moveChain(),
    mock: stages.map((st) => layoutOf(createMockState(st).office)),
  }
}

/** A small v4 game (desks, a common item, three hires, 40 days) for the v4 → v5 migration test. */
export function v4Save(): string {
  let s = createGame({ seed: 3 })
  s = { ...s, stats: { ...s.stats, cash: 1e6 } }
  for (const a of [{ type: 'placeItem', itemId: 'desk-basic' }, { type: 'placeItem', itemId: 'desk-basic' }, { type: 'placeItem', itemId: 'desk-basic' }] as const) s = applyAction(s, a).state
  for (let i = 0; i < 3; i++) {
    const c = s.candidates[0]
    if (c) s = applyAction(s, { type: 'hire', candidateId: c.id }).state
  }
  return serialize(s)
}

