import { describe, expect, it } from 'vitest'
import { SLOT_TYPES } from '../../engine/types'
import { FURNITURE } from '../furniture'

const byId = new Map(FURNITURE.map((f) => [f.id, f]))

describe('furniture catalog', () => {
  it('has exactly 30 unique items', () => {
    expect(FURNITURE).toHaveLength(30)
    expect(byId.size).toBe(30)
  })

  it('covers all 4 slot types with the planned split', () => {
    const count = (t: string) => FURNITURE.filter((f) => f.slotType === t).length
    for (const t of SLOT_TYPES) expect(count(t)).toBeGreaterThan(0)
    expect(count('desk')).toBe(8)
    expect(count('common')).toBe(9)
    expect(count('room')).toBe(7)
    expect(count('special')).toBe(6)
  })

  it('rooms take 2 slots, everything else 1', () => {
    for (const f of FURNITURE) expect(f.size).toBe(f.slotType === 'room' ? 2 : 1)
  })

  it('keeps PLAN-required items (helicopter pad, meeting room, server room, bookshelf)', () => {
    for (const id of ['helipad', 'meeting-room', 'server-room', 'bookshelf', 'demo-stage', 'rnd-lab', 'podcast-studio']) {
      expect(byId.has(id)).toBe(true)
    }
    expect(byId.get('meeting-room')!.effects.coordinationFix).toBe(true)
    expect(byId.get('server-room')!.effects.infraMult).toBe(0.8)
  })

  it('desk upgrade chain basic → ergonomic → dual screen', () => {
    expect(byId.get('desk-basic')!.upgradesTo).toBe('desk-ergo')
    expect(byId.get('desk-ergo')!.upgradesTo).toBe('desk-dual')
    for (const f of FURNITURE) {
      if (!f.upgradesTo) continue
      const next = byId.get(f.upgradesTo)
      expect(next).toBeDefined()
      expect(next!.slotType).toBe(f.slotType)
      expect(next!.tier).toBeGreaterThan(f.tier)
      expect(next!.effects.deskQuality ?? 0).toBeGreaterThan(f.effects.deskQuality ?? 0)
    }
  })

  it('has sane numbers', () => {
    for (const f of FURNITURE) {
      expect(f.price).toBeGreaterThan(0)
      expect(f.name.trim().length).toBeGreaterThan(0)
      expect(f.description.trim().length).toBeGreaterThan(0)
      if (f.effects.moraleAura !== undefined) {
        expect(f.effects.moraleAura).toBeGreaterThanOrEqual(3)
        expect(f.effects.moraleAura).toBeLessThanOrEqual(8)
      }
      if (f.slotType === 'desk') expect(f.effects.deskQuality).toBeDefined()
      if (f.slotType === 'common') expect(f.effects.moraleAura).toBeDefined()
      if (f.slotType === 'special') expect(f.stageUnlock).toBe(5)
    }
    // Starter desk is affordable in the garage.
    expect(FURNITURE.some((f) => f.slotType === 'desk' && f.stageUnlock === 0 && f.price <= 1000)).toBe(true)
  })

  it('ships primitive geometry hints for the renderer', () => {
    for (const f of FURNITURE) {
      expect(f.visual.shape.length).toBeGreaterThan(0)
      expect(f.visual.primitives?.length ?? 0).toBeGreaterThan(0)
      expect(f.visual.colors.primary).toMatch(/^#[0-9a-fA-F]{6}$/)
      for (const p of f.visual.primitives ?? []) {
        expect(p.size.every((n) => Number.isFinite(n) && n >= 0)).toBe(true)
        const maxX = f.size === 2 ? 1.5 : 0.5
        expect(p.pos[0]).toBeGreaterThanOrEqual(-0.5)
        expect(p.pos[0]).toBeLessThanOrEqual(maxX)
      }
    }
  })
})
