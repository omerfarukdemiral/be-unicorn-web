import { describe, expect, it } from 'vitest'
import { buildOffice } from '../../engine/office'
import { shopPlacement } from './shopPlacement'

const DESK = { slotType: 'desk' as const, size: 1 as const }
const ROOM = { slotType: 'room' as const, size: 2 as const }

describe('shopPlacement', () => {
  it('uses the tapped slot when the item fits it', () => {
    const o = buildOffice(1, 2)
    const target = o.slots.find((s) => s.ring === 2 && s.type === 'desk')!
    const p = shopPlacement(o, DESK, target)
    expect(p).toMatchObject({ targeted: true, targetMisfit: false })
    expect(p.slot?.id).toBe(target.id)
  })

  it('falls back to the auto slot and flags a misfit for another slot type', () => {
    const o = buildOffice(1, 2)
    const target = o.slots.find((s) => s.type === 'common')!
    const p = shopPlacement(o, DESK, target)
    expect(p.targeted).toBe(false)
    expect(p.targetMisfit).toBe(true)
    expect(p.slot?.ring).toBe(1)
  })

  it('flags a room slot without a free neighbour as a misfit', () => {
    const o = buildOffice(2, 3)
    const rooms = o.slots.filter((s) => s.type === 'room')
    const target = rooms[0]!
    // Take every neighbour of the target; another pair stays free.
    for (const r of rooms) if (r.id !== target.id && Math.abs(r.pos.x - target.pos.x) + Math.abs(r.pos.z - target.pos.z) === 1) r.itemId = 'x'
    const p = shopPlacement(o, ROOM, target)
    expect(p.targetMisfit).toBe(true)
    expect(p.slot).not.toBeNull()
    expect(p.slot!.id).not.toBe(target.id)
  })

  it('no room: points to the next ring when it has the slot type', () => {
    const o = buildOffice(1, 1)
    for (const s of o.slots) if (s.ring === 1) s.itemId = 'x'
    const p = shopPlacement(o, DESK, undefined)
    expect(p.slot).toBeNull()
    expect(p.nextRing?.index).toBe(2)
    expect(p.roomRing).toBe(2)
  })

  it('no room: finds a later ring of this office when the next one lacks the type (rooms: ring 4 → 5)', () => {
    const o = buildOffice(4, 3)
    for (const s of o.slots) if (s.type === 'room' && s.ring === 3) s.itemId = 'x'
    const p = shopPlacement(o, ROOM, undefined)
    expect(p.slot).toBeNull()
    expect(p.nextRing?.index).toBe(4)
    expect(p.roomRing).toBe(5)
  })

  it('no room anywhere in this office: roomRing is null (next office)', () => {
    const o = buildOffice(2, 3)
    for (const s of o.slots) if (s.type === 'room') s.itemId = 'x'
    expect(shopPlacement(o, ROOM, undefined)).toMatchObject({ slot: null, roomRing: null })
  })

  it('an edited office (suggested cells under decor) previews the free cell the buy really takes', () => {
    const o = buildOffice(0, 1)
    // Every garage desk cell is under a panel: no suggested cell left, but free floor is.
    o.decor = o.slots.filter((s) => s.type === 'desk' && s.id !== 'founder').map((s, i) => ({ id: `d${i + 1}`, kind: 'panel', pos: { ...s.pos }, rotation: 0 as const }))
    const p = shopPlacement(o, DESK, undefined)
    expect(p.slot).not.toBeNull()
    expect(p.slot).toMatchObject({ id: 'new', free: true, ring: 1 })
    expect(o.decor.some((d) => d.pos.x === p.slot!.pos.x && d.pos.z === p.slot!.pos.z)).toBe(false)
  })
})
