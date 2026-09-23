import { describe, expect, it } from 'vitest'
import { STAGES } from '../../content/index'
import * as B from '../balance'
import { createEngine } from '../index'
import { applyEffects } from '../effects'
import { buildOffice, findAutoSlot, findAutoSlotFor, relocateOffice } from '../office'
import { deserialize, serialize } from '../save'
import type { Action, GameState, TimedAction } from '../types'
import { fakeCard, fakeConcept, fakeContent } from './fixtures'

const dist2 = (p: { x: number; z: number }) => p.x * p.x + p.z * p.z

const api = createEngine(fakeContent({ decisions: [fakeCard('c1')] }))

function run(seed: number, script: TimedAction[], days: number): GameState {
  let s = api.createGame({ seed })
  let i = 0
  for (let d = 0; d < days; d += 0.25) {
    while (i < script.length && script[i]!.atDay <= d) {
      s = api.applyAction(s, script[i]!.action).state
      i++
    }
    s = api.step(s, 0.25)
  }
  return s
}

const SCRIPT = (s0: GameState): TimedAction[] => [
  { atDay: 0, action: { type: 'startProject', category: 'web' } },
  { atDay: 0, action: { type: 'hire', candidateId: s0.candidates[0]!.id } },
  { atDay: 1, action: { type: 'founderAction', kind: 'findUsers' } },
  { atDay: 5, action: { type: 'hire', candidateId: s0.candidates[1]!.id } },
]

describe('determinism', () => {
  it('same seed + same actions ⇒ identical state', () => {
    const s0 = api.createGame({ seed: 7 })
    const a = run(7, SCRIPT(s0), 90)
    const b = run(7, SCRIPT(s0), 90)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
  it('different seeds diverge', () => {
    expect(api.createGame({ seed: 1 }).candidates).not.toEqual(api.createGame({ seed: 2 }).candidates)
  })
  it('step(1) equals four step(0.25)', () => {
    let s = api.createGame({ seed: 3 })
    s = api.applyAction(s, { type: 'startProject', category: 'api' }).state
    s = api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id }).state
    let a = s
    let b = s
    for (let i = 0; i < 40; i++) a = api.step(a, 1)
    for (let i = 0; i < 160; i++) b = api.step(b, 0.25)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
  it('step and applyAction never mutate their input; state stays JSON-safe', () => {
    const s = api.createGame({ seed: 4 })
    const snap = JSON.stringify(s)
    api.step(s, 10)
    api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id })
    expect(JSON.stringify(s)).toBe(snap)
    const later = api.step(s, 45)
    expect(JSON.parse(JSON.stringify(later))).toEqual(later)
  })
})

describe('actions', () => {
  it('invalid action returns ok:false, an error code and the same state', () => {
    const s = api.createGame({ seed: 1 })
    const cases: [Action, string][] = [
      [{ type: 'hire', candidateId: 'nope' }, 'notFound'],
      [{ type: 'openRing', ring: 3 }, 'notFound'],
      [{ type: 'setPrice', multiplier: 1.2 }, 'notUnlocked'],
      [{ type: 'founderAction', kind: 'salesCall' }, 'notUnlocked'],
      [{ type: 'startRound' }, 'roundNotReady'],
      [{ type: 'placeItem', itemId: 'coffee', slotId: 'r1-s0' }, 'notUnlocked'],
      [{ type: 'placeItem', itemId: 'desk-basic', slotId: 'founder' }, 'invalid'],
    ]
    for (const [a, code] of cases) {
      const r = api.applyAction(s, a)
      expect(r.ok, a.type).toBe(false)
      expect(r.error, a.type).toBe(code)
      expect(r.state).toBe(s)
    }
  })
  it('hire needs a desk item (noDesk), sell unseats', () => {
    let s = api.createGame({ seed: 1 })
    expect(api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id }).error).toBe('noDesk')
    expect(api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id, deskSlotId: 'r1-s0' }).error).toBe('noDesk')
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s1' }).state
    const r = api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id })
    expect(r.ok).toBe(true)
    s = r.state
    expect(s.employees[0]!.deskSlotId).toBe('r1-s1')
    s = api.applyAction(s, { type: 'sellItem', slotId: 'r1-s1' }).state
    expect(s.employees[0]!.deskSlotId).toBeUndefined()
    expect(s.office.slots.find((x) => x.id === 'r1-s1')?.occupantId).toBeUndefined()
  })
  it('hire seats on a free desk, fills slots, then noFreeSlot', () => {
    let s = api.createGame({ seed: 1 })
    for (const id of ['r1-s0', 'r1-s1', 'r1-s2', 'r1-s3']) s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: id }).state
    for (let i = 0; i < 4; i++) {
      const r = api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id })
      expect(r.ok).toBe(true)
      s = r.state
      if (s.candidates.length === 0) s = api.step(s, 7)
    }
    expect(s.employees.every((e) => e.deskSlotId !== undefined)).toBe(true)
    s = api.step(s, 7)
    expect(api.applyAction(s, { type: 'hire', candidateId: s.candidates[0]!.id }).error).toBe('noFreeSlot')
  })
  it('place, upgrade, sell furniture', () => {
    let s = api.createGame({ seed: 1 })
    s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s0' }).state
    expect(s.office.slots.find((x) => x.id === 'r1-s0')?.itemId).toBe('desk-basic')
    expect(api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: 'r1-s0' }).error).toBe('slotOccupied')
    s = api.applyAction(s, { type: 'upgradeItem', slotId: 'r1-s0', toItemId: 'desk-ergo' }).state
    expect(s.office.slots.find((x) => x.id === 'r1-s0')?.itemId).toBe('desk-ergo')
    const cash = s.stats.cash
    s = api.applyAction(s, { type: 'sellItem', slotId: 'r1-s0' }).state
    expect(s.stats.cash).toBe(cash + 750)
  })
  it('founder action spends energy, then cooldown, then yields users', () => {
    let s = api.createGame({ seed: 1 })
    s = api.applyAction(s, { type: 'founderAction', kind: 'findUsers' }).state
    expect(s.founder.energy).toBe(100 - B.FOUNDER_ACTION_DEFS.findUsers.energy)
    expect(api.applyAction(s, { type: 'founderAction', kind: 'findUsers' }).error).toBe('founderBusy')
    s = api.step(s, 1)
    expect(s.stats.users).toBeGreaterThanOrEqual(B.FIND_USERS_MIN)
    expect(s.counters.manualFinds).toBe(1)
    expect(api.applyAction(s, { type: 'founderAction', kind: 'findUsers' }).error).toBe('cooldown')
  })
})

describe('office rings', () => {
  it('slot totals per stage follow PLAN §3.1 (4/10/18/30/44/60)', () => {
    const totals = [0, 1, 2, 3, 4, 5].map((st) => buildOffice(st as 0).slots.filter((x) => x.ring > 0).length)
    expect(totals).toEqual([4, 10, 18, 30, 44, 60])
  })
  it('slot positions are unique and rooms come in adjacent pairs', () => {
    const o = buildOffice(5)
    const keys = new Set(o.slots.map((x) => `${x.pos.x},${x.pos.z}`))
    expect(keys.size).toBe(o.slots.length)
    for (const r of o.slots.filter((x) => x.type === 'room')) {
      const n = o.slots.filter((x) => x.type === 'room' && x.ring === r.ring && Math.abs(x.pos.x - r.pos.x) + Math.abs(x.pos.z - r.pos.z) === 1)
      expect(n.length).toBeGreaterThan(0)
    }
  })
  it('rings open strictly in order and add rent', () => {
    let s = api.createGame({ seed: 1 })
    s = { ...s, stage: 3, office: buildOffice(3), stats: { ...s.stats, cash: 1_000_000 } }
    expect(api.applyAction(s, { type: 'openRing', ring: 3 }).error).toBe('ringOrder')
    expect(api.applyAction(s, { type: 'openRing', ring: 1 }).error).toBe('invalid')
    const before = api.step(s, 0.25).finance.burnBreakdown.rent
    s = api.applyAction(s, { type: 'openRing', ring: 2 }).state
    expect(s.office.rings.find((r) => r.index === 2)?.unlocked).toBe(true)
    expect(s.finance.burnBreakdown.rent).toBeGreaterThan(before)
    expect(api.applyAction(s, { type: 'openRing', ring: 3 }).ok).toBe(true)
  })
  it('relocation keeps furniture and opened rings, adds locked rings', () => {
    const o = buildOffice(1, 2)
    o.slots.find((x) => x.id === 'r2-s0')!.itemId = 'desk-basic'
    const n = relocateOffice(o, 2)
    expect(n.rings.map((r) => r.unlocked)).toEqual([true, true, false])
    expect(n.slots.find((x) => x.id === 'r2-s0')?.itemId).toBe('desk-basic')
  })
})

describe('auto placement (findAutoSlot / placeItem without slotId)', () => {
  it('buy without a slot places on the nearest free desk slot, charges the price, then noFreeSlot', () => {
    let s = api.createGame({ seed: 1 })
    const cash = s.stats.cash
    const r = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' })
    expect(r.ok).toBe(true)
    s = r.state
    expect(s.stats.cash).toBe(cash - 500)
    const placed = s.office.slots.filter((x) => x.itemId === 'desk-basic')
    expect(placed.map((x) => x.ring)).toEqual([1])
    // Ring 1 fills up, ring 2 is locked: skipped, so the fifth desk has nowhere to go.
    for (let i = 0; i < 3; i++) s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    expect(s.office.slots.filter((x) => x.ring === 1 && x.itemId).length).toBe(4)
    const full = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' })
    expect(full.ok).toBe(false)
    expect(full.error).toBe('noFreeSlot')
    expect(full.state).toBe(s)
    expect(findAutoSlot(s, 'desk-basic', fakeContent())).toBeNull()
  })
  it('picks the inner ring first, then the slot closest to the center', () => {
    let s = api.createGame({ seed: 1 })
    s = { ...s, stage: 1, office: buildOffice(1, 1), stats: { ...s.stats, cash: 1e6 } }
    for (let i = 0; i < 4; i++) s = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic' }).state
    expect(findAutoSlot(s, 'desk-basic', fakeContent())).toBeNull()
    const opened = api.applyAction(s, { type: 'openRing', ring: 2 })
    expect(opened.ok).toBe(true)
    s = opened.state
    const slot = findAutoSlot(s, 'desk-basic', fakeContent())
    expect(slot?.ring).toBe(2)
    const ring2Desks = s.office.slots.filter((x) => x.ring === 2 && x.type === 'desk')
    expect(dist2(slot!.pos)).toBe(Math.min(...ring2Desks.map((x) => dist2(x.pos))))
    // Explicit slotId still wins over auto placement.
    const far = ring2Desks.find((x) => dist2(x.pos) > dist2(slot!.pos))!
    const r = api.applyAction(s, { type: 'placeItem', itemId: 'desk-basic', slotId: far.id })
    expect(r.state.office.slots.find((x) => x.id === far.id)?.itemId).toBe('desk-basic')
  })
  it('size-2 rooms need two adjacent free slots; deterministic', () => {
    const office = buildOffice(2, 3)
    const spec = { slotType: 'room' as const, size: 2 as const }
    const a = findAutoSlotFor(office, spec)
    expect(a).not.toBeNull()
    expect(findAutoSlotFor(office, spec)?.id).toBe(a!.id)
    // Block one slot of every pair but one: the remaining pair wins.
    const rooms = office.slots.filter((x) => x.type === 'room')
    expect(rooms.length).toBeGreaterThanOrEqual(4)
    const partnerOf = (id: string) => rooms.find((x) => x.id !== id && Math.abs(x.pos.x - rooms.find((r) => r.id === id)!.pos.x) + Math.abs(x.pos.z - rooms.find((r) => r.id === id)!.pos.z) === 1)!
    const blocked = rooms.find((x) => x.id === a!.id)!
    blocked.itemId = 'x'
    const b = findAutoSlotFor(office, spec)
    expect(b).not.toBeNull()
    expect([a!.id, partnerOf(a!.id).id]).not.toContain(b!.id)
    for (const r of rooms) if (!r.itemId) r.itemId = 'x'
    expect(findAutoSlotFor(office, spec)).toBeNull()
    // A single free slot is not enough for a size-2 room.
    rooms[0]!.itemId = undefined
    delete rooms[0]!.itemId
    expect(findAutoSlotFor(office, spec)).toBeNull()
    expect(findAutoSlotFor(office, { slotType: 'room', size: 1 })?.id).toBe(rooms[0]!.id)
  })
  it('two rooms placed one after another both fit on a 4-slot side (ring 5 / 6)', () => {
    let s = api.createGame({ seed: 1 })
    const office = buildOffice(5, 6)
    // Fill rings below 5 so auto placement goes to the 4-slot sides.
    for (const x of office.slots) if (x.type === 'room' && x.ring < 5) x.itemId = 'x'
    s = { ...s, stage: 5, office, stats: { ...s.stats, cash: 1e7 } }
    const free = () => s.office.slots.filter((x) => x.type === 'room' && x.itemId === undefined && office.rings.some((r) => r.index === x.ring && r.unlocked)).length
    const total = free()
    expect(total % 2).toBe(0)
    // Every free room slot must end up used: no orphan single slots.
    for (let i = 0; i < total / 2; i++) {
      const r = api.applyAction(s, { type: 'placeItem', itemId: 'meeting' })
      expect(r.ok, `room ${i + 1} of ${total / 2}`).toBe(true)
      s = r.state
    }
    expect(free()).toBe(0)
  })
  it('auto placement of a size-2 item spans two slots', () => {
    let s = api.createGame({ seed: 1 })
    s = { ...s, stage: 2, office: buildOffice(2, 3), stats: { ...s.stats, cash: 1e6 } }
    const r = api.applyAction(s, { type: 'placeItem', itemId: 'meeting' })
    expect(r.ok).toBe(true)
    const held = r.state.office.slots.filter((x) => x.itemId === 'meeting')
    expect(held.length).toBe(2)
    expect(held.filter((x) => x.spanOf !== undefined).length).toBe(1)
  })
})

describe('bankruptcy', () => {
  it('60 days of negative cash ends the run with exactly 3 reasons', () => {
    let s = api.createGame({ seed: 1 })
    s = { ...s, stats: { ...s.stats, cash: -1 } }
    s = api.step(s, 59)
    expect(s.gameOver).toBeUndefined()
    expect(s.finance.negativeCashDays).toBe(59)
    s = api.step(s, 1)
    expect(s.gameOver?.kind).toBe('bankrupt')
    expect(s.gameOver?.reasons).toHaveLength(3)
    expect(new Set(s.gameOver?.reasons.map((r) => r.code)).size).toBe(3)
    expect(s.events.some((e) => e.kind === 'gameOver')).toBe(true)
    expect(api.applyAction(s, { type: 'startProject', category: 'web' }).error).toBe('gameOver')
    expect(api.step(s, 5)).toBe(s)
  })
  it('recovering above zero resets the counter', () => {
    let s = api.createGame({ seed: 1 })
    s = api.step({ ...s, stats: { ...s.stats, cash: -1 } }, 10)
    s = api.step({ ...s, stats: { ...s.stats, cash: 50_000 } }, 1)
    expect(s.finance.negativeCashDays).toBe(0)
  })
  it('founder XP raises start cash (+10%/XP, max +40%)', () => {
    expect(api.createGame({ seed: 1, founderXp: 2 }).stats.cash).toBe(36_000)
    expect(api.createGame({ seed: 1, founderXp: 9 }).stats.cash).toBe(42_000)
  })
})

describe('concept queue', () => {
  const concepts = [
    fakeConcept('runway', (s) => s.time.day >= 2, { unlocks: 'runway' }),
    fakeConcept('burn', (s) => s.time.day >= 2, { unlocks: 'burnBreakdown' }),
    fakeConcept('pricing', () => true, { stage: 2, unlocks: 'priceControl' }),
  ]
  const capi = createEngine(fakeContent({ concepts }))

  it('max one active bubble, rest queued; stage filter; once per run', () => {
    let s = capi.step(capi.createGame({ seed: 1 }), 3)
    expect(s.concepts.active?.id).toBe('runway')
    expect(s.concepts.queue).toEqual(['burn'])
    expect(s.concepts.triggered).not.toContain('pricing')
    s = capi.step(s, 5)
    expect(s.concepts.triggered.filter((x) => x === 'runway')).toHaveLength(1)
  })
  it('open → learned + widget, next is promoted; minimize keeps icon', () => {
    let s = capi.step(capi.createGame({ seed: 1 }), 3)
    s = capi.applyAction(s, { type: 'openConcept', conceptId: 'runway' }).state
    expect(s.concepts.learned).toContain('runway')
    expect(s.unlockedWidgets).toContain('runway')
    expect(s.concepts.active?.id).toBe('burn')
    s = capi.applyAction(s, { type: 'minimizeConcept', conceptId: 'burn' }).state
    expect(s.concepts.minimized).toEqual(['burn'])
    expect(s.concepts.active).toBeUndefined()
    s = capi.applyAction(s, { type: 'openConcept', conceptId: 'burn' }).state
    expect(s.concepts.minimized).toEqual([])
    expect(s.unlockedWidgets).toContain('burnBreakdown')
    expect(capi.applyAction(s, { type: 'openConcept', conceptId: 'pmf' }).ok).toBe(false)
  })
  it('stores the "where" text at trigger time and unlocks every listed item', () => {
    const wapi = createEngine(
      fakeContent({ concepts: [fakeConcept('pricing', (s) => s.time.day >= 2, { card: { what: 'w', where: (s) => `gün ${Math.floor(s.time.day)}`, rule: 'r' }, unlocks: ['priceControl', 'arpu'] })] }),
    )
    let s = wapi.step(wapi.createGame({ seed: 1 }), 3)
    const saved = s.concepts.where?.pricing
    expect(saved).toBe('gün 2')
    s = wapi.step(s, 10)
    expect(s.concepts.where?.pricing).toBe(saved)
    s = wapi.applyAction(s, { type: 'openConcept', conceptId: 'pricing' }).state
    expect(s.unlockedTools).toContain('priceControl')
    expect(s.unlockedWidgets).toContain('arpu')
  })
  it('tool unlocks go to unlockedTools', () => {
    let s = capi.createGame({ seed: 1 })
    s = capi.step({ ...s, stage: 2 }, 1)
    expect(s.concepts.active?.id).toBe('pricing')
    s = capi.applyAction(s, { type: 'openConcept', conceptId: 'pricing' }).state
    expect(s.unlockedTools).toContain('priceControl')
  })
})

describe('decisions', () => {
  it('shows a card, applies effects and delayed effects', () => {
    let s = api.createGame({ seed: 1 })
    for (let i = 0; i < 60 && !s.decisions.active; i++) s = api.step(s, 1)
    expect(s.decisions.active?.cardId).toBe('c1')
    expect(s.visitors.some((v) => v.purpose === 'decision')).toBe(true)
    const users = s.stats.users
    s = api.applyAction(s, { type: 'answerDecision', cardId: 'c1', optionIndex: 1 }).state
    expect(s.decisions.pending).toHaveLength(1)
    expect(s.decisions.lastAnswer?.optionIndex).toBe(1)
    s = api.step(s, 6)
    expect(s.decisions.pending).toHaveLength(0)
    expect(s.stats.users).toBeGreaterThanOrEqual(users + 49)
    // once: never shown again
    s = api.step(s, 60)
    expect(s.decisions.active).toBeUndefined()
  })
  it('a repeatable card with a lingering condition waits between shows and has a cap', () => {
    const rapi = createEngine(fakeContent({ decisions: [fakeCard('crisis', { once: false, condition: () => true })] }))
    let s = rapi.createGame({ seed: 3 })
    const shownDays: number[] = []
    for (let d = 0; d < 600; d++) {
      s = rapi.step(s, 1)
      if (s.decisions.active) {
        shownDays.push(s.time.day)
        s = rapi.applyAction(s, { type: 'answerDecision', cardId: 'crisis', optionIndex: 0 }).state
      }
      if (s.gameOver) break
    }
    expect(shownDays.length).toBeGreaterThan(1)
    expect(shownDays.length).toBeLessThanOrEqual(B.REPEAT_CARD_MAX)
    for (let i = 1; i < shownDays.length; i++) expect(shownDays[i]! - shownDays[i - 1]!).toBeGreaterThanOrEqual(B.REPEAT_CARD_COOLDOWN_DAYS)
  })
  it('cashPercent is capped', () => {
    const dapi = createEngine(fakeContent({ decisions: [fakeCard('greedy', { options: [{ label: 'x', tradeoff: { gain: '', cost: '' }, effects: { cashPercent: 5 }, reflection: '' }] })] }))
    let s = dapi.createGame({ seed: 1 })
    s = { ...s, decisions: { ...s.decisions, active: { cardId: 'greedy', shownDay: 0 } } }
    const cash = s.stats.cash
    s = dapi.applyAction(s, { type: 'answerDecision', cardId: 'greedy', optionIndex: 0 }).state
    expect(s.stats.cash).toBeCloseTo(cash * (1 + B.CASH_PERCENT_CAP))
  })
})

describe('balance ↔ content stage table', () => {
  it('stays in sync with content STAGES', () => {
    STAGES.forEach((st, i) => {
      expect(st.targetValuation, st.key).toBe(B.STAGE_TARGET_VALUATION[i])
      expect(st.roundAmount, st.key).toBe(B.ROUND_AMOUNT[i])
      expect(st.roundEquity, st.key).toBe(B.ROUND_EQUITY[i])
      expect(st.totalSlots, st.key).toBe(B.STAGE_SLOTS[i])
      expect(st.rings, st.key).toBe(B.STAGE_RINGS[i])
      expect([...(st.unlockTools ?? [])], st.key).toEqual([...(B.STAGE_UNLOCK_TOOLS[i] ?? [])])
    })
  })
})

describe('save', () => {
  it('round-trips and accepts the bare scaffold format', () => {
    const s = api.step(api.createGame({ seed: 5 }), 12)
    expect(deserialize(serialize(s))).toEqual(s)
    expect(deserialize(JSON.stringify(s))).toEqual(s)
    expect(deserialize(JSON.stringify({ version: 999, state: s }))).toBeNull()
    expect(deserialize('garbage')).toBeNull()
  })
})

describe('effects', () => {
  it('setFlag accepts a list; crunch bumps the crunches counter; reputation change shows the widget', () => {
    const content = fakeContent()
    const s = createEngine(content).createGame({ seed: 1 })
    applyEffects(s, content, { setFlag: ['crunch', 'rushedProject'], reputation: 3 }, 'test')
    expect(s.flags['crunch']).toBe(true)
    expect(s.flags['rushedProject']).toBe(true)
    expect(s.counters.crunches).toBe(1)
    expect(s.unlockedWidgets).toContain('reputation')
  })
})
