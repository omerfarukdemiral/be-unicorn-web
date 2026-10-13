import { describe, expect, it } from 'vitest'
import { FURNITURE } from '../content'
import type { StageBand } from '../content/stageBand'
import { stageBand } from '../content/stageBand'
import { FOUNDER_SLOT_ID, type Slot, type StageIndex } from '../engine/types'
import { employeeLook, founderLook, FOUNDER_LOOK } from './Character'
import { CELL } from './constants'
import { placeItems } from './Furniture'
import { resolveFurniture } from './furnitureCatalog'
import { computeLayout } from './layout'
import { createMockState } from './mockState'
import { npcLook } from './Npc'
import { DEPT_COLORS } from './palette'
import {
  FINISH,
  LEGS_BY_BAND,
  MAX_EXTRAS_IN_SCENE,
  MAX_EXTRAS_PER_ITEM,
  STARTER_ITEMS,
  SUN,
  WALL_MIN_Y,
  extrasFor,
  founderDeskExtras,
  furnitureBand,
  pickExtras,
  seedDecorPlan,
  sunFor,
} from './stageLook'
import { DEPTS } from '../engine/types'

const BANDS: StageBand[] = [0, 1, 2, 3]

describe('furniture finish (G2)', () => {
  it('is cached per band and hands back the same object', () => {
    for (const b of BANDS) expect(resolveFurniture('desk-dual', 'desk', b)).toBe(resolveFurniture('desk-dual', 'desk', b))
    expect(resolveFurniture('desk-dual', 'desk', 2)).not.toBe(resolveFurniture('desk-dual', 'desk', 3))
  })

  it('never mutates the catalog hints', () => {
    const before = JSON.stringify(FURNITURE.map((f) => f.visual))
    for (const f of FURNITURE) for (const b of BANDS) resolveFurniture(f.id, f.slotType, b)
    expect(JSON.stringify(FURNITURE.map((f) => f.visual))).toBe(before)
  })

  it('band 1 is the catalog look: no extras, catalog colours; the default band is 1', () => {
    for (const f of FURNITURE) {
      const r = resolveFurniture(f.id, f.slotType, 1)
      expect(r.extras).toEqual([])
      expect(r.colors).toEqual(f.visual.colors)
      expect(resolveFurniture(f.id, f.slotType)).toBe(r)
    }
  })

  it('non-starter items keep their colours at every band', () => {
    for (const f of FURNITURE.filter((x) => !STARTER_ITEMS.has(x.id))) {
      for (const b of BANDS) expect(resolveFurniture(f.id, f.slotType, b).colors).toEqual(f.visual.colors)
    }
  })

  it('starter items are repainted from the next catalog tiers', () => {
    const [basic, ergo, dual] = ['desk-basic', 'desk-ergo', 'desk-dual'].map((id) => FURNITURE.find((f) => f.id === id)!)
    expect(resolveFurniture('desk-basic', 'desk', 2).colors).toEqual(ergo!.visual.colors)
    expect(resolveFurniture('desk-basic', 'desk', 3).colors).toEqual(dual!.visual.colors)
    expect(resolveFurniture('desk-basic', 'desk', 0).colors).toEqual(basic!.visual.colors)
  })

  it('extras only from band 2, at most 6 meshes per item', () => {
    for (const f of FURNITURE) {
      expect(resolveFurniture(f.id, f.slotType, 0).extras).toEqual([])
      for (const b of BANDS) expect(resolveFurniture(f.id, f.slotType, b).extras.length).toBeLessThanOrEqual(MAX_EXTRAS_PER_ITEM)
    }
    for (const per of Object.values(FINISH)) for (const list of Object.values(per ?? {})) expect(list!.length).toBeLessThanOrEqual(MAX_EXTRAS_PER_ITEM)
    expect(resolveFurniture('desk-dual', 'desk', 2).extras.length).toBeGreaterThan(0)
    expect(resolveFurniture('desk-dual', 'desk', 3).extras.length).toBeGreaterThan(0)
  })

  it('lowPower gets no extras, no repaint and no nameplate', () => {
    expect(extrasFor('desk', 3, true)).toEqual([])
    expect(furnitureBand(3, true)).toBe(1)
    expect(founderDeskExtras(3, true)).toEqual([])
    expect(founderDeskExtras(3).length).toBe(1)
    expect(founderDeskExtras(2)).toEqual([])
  })

  it('the worst-case scene stays within the mesh budget, and a band change keeps every key', () => {
    const s = createMockState(6)
    const slots: Slot[] = s.office.slots.map((x): Slot => {
      if (x.spanOf) return x
      const id = x.type === 'desk' ? (x.id === FOUNDER_SLOT_ID ? undefined : 'desk-dual') : x.type === 'common' ? ['coffee-corner', 'plants', 'sofa'][x.id.length % 3] : x.type === 'room' ? 'meeting-room' : 'demo-stage'
      return { ...x, itemId: id }
    })
    const layout = computeLayout(slots, s.office.rings, 6)
    const at2 = placeItems(slots, layout, 2)
    const at3 = placeItems(slots, layout, 3)
    const count = (list: typeof at2) => list.reduce((n, p) => n + p.resolved.extras.length, 0)
    expect(at2.length).toBeGreaterThan(20)
    expect(count(at2)).toBeLessThanOrEqual(MAX_EXTRAS_IN_SCENE)
    expect(count(at3)).toBeLessThanOrEqual(MAX_EXTRAS_IN_SCENE)
    expect(count(at3)).toBeGreaterThan(0)
    // Same React keys across bands: PlacedItem is re-rendered in place, never remounted.
    expect(at3.map((p) => p.key)).toEqual(at2.map((p) => p.key))
    expect(placeItems(slots, layout, 1).every((p) => p.resolved.extras.length === 0)).toBe(true)
  })

  it('pickExtras is stable and respects the budget', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, count: 6 }))
    const a = pickExtras(items)
    expect([...a].length * 6).toBeLessThanOrEqual(MAX_EXTRAS_IN_SCENE)
    expect(pickExtras([...items].reverse())).toEqual(a)
  })
})

describe('sun (G2)', () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
  }
  it('every band is within 3% of the baseline brightness; band 1 is the baseline', () => {
    expect(SUN[1]).toEqual({ color: '#fff0dc', radius: 5 })
    for (const b of BANDS) expect(Math.abs(lum(SUN[b].color) / lum(SUN[1].color) - 1)).toBeLessThan(0.03)
  })
  it('lowPower keeps the cheap blur', () => {
    expect(sunFor(3, true).radius).toBe(2)
    expect(sunFor(3, false)).toEqual(SUN[3])
  })
})

describe('wardrobe (G2)', () => {
  it('is deterministic; the shirt is always the department colour', () => {
    for (const dept of DEPTS) for (const b of BANDS) {
      expect(employeeLook('e1', dept, b)).toEqual(employeeLook('e1', dept, b))
      expect(employeeLook('e1', dept, b).body).toBe(DEPT_COLORS[dept])
    }
  })
  it('band 1 is the legacy look (hash-picked trousers); other bands dress the whole team alike', () => {
    expect(employeeLook('e1', 'eng')).toEqual(employeeLook('e1', 'eng', 1))
    expect(LEGS_BY_BAND[1]).toBeUndefined()
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      expect(employeeLook(id, 'eng', 0).legs).toBe('#3d5378')
      expect(employeeLook(id, 'eng', 2).legs).toBe('#6b5641')
      expect(employeeLook(id, 'eng', 3).legs).toBe('#34323f')
    }
  })
  it('the founder wears a tie at the top band only; visitors dress for the company', () => {
    expect(founderLook(1)).toBe(FOUNDER_LOOK)
    expect(founderLook(2)).toBe(FOUNDER_LOOK)
    expect(founderLook(3).accessories).toContain('tie')
    expect(npcLook('v', 'investor', 1).accessories).toEqual(['tie', 'briefcase'])
    expect(npcLook('v', 'investor', 2).accessories).toEqual(['tie', 'briefcase'])
    expect(npcLook('v', 'investor', 0).accessories).toEqual([])
    expect(npcLook('v', 'customer', 1).accessories).toEqual(['cap'])
    expect(npcLook('v', 'customer', 2).accessories).toEqual([])
    expect(stageBand(2)).toBe(1)
  })
})

describe('Seed wall decor (G2)', () => {
  it.each([2, 1, 3] as StageIndex[])('stage %i layout: hangs on the back wall, clear of slots, door lane, walkers and columns', (stage) => {
    const s = createMockState(stage)
    const L = computeLayout(s.office.slots, s.office.rings, stage)
    const pieces = seedDecorPlan(L.bounds, L.door)
    if (stage === 2) expect(pieces.length).toBeGreaterThanOrEqual(9)
    const dl = L.door.pos[0] - L.door.width / 2
    const dr = L.door.pos[0] + L.door.width / 2
    for (const p of pieces) {
      const [w, h] = p.round ? [p.size[0], p.size[2]] : [p.size[0], p.size[1]]
      const yMin = p.pos[1] - h / 2
      expect(yMin).toBeGreaterThanOrEqual(WALL_MIN_Y - 1e-9)
      expect(p.pos[1] + h / 2).toBeLessThan(2.16)
      // a flat piece on the wall: never deeper than 0.08 into the room
      expect(p.pos[2] + (p.round ? p.size[1] : p.size[2]) / 2 - L.bounds.minZ).toBeLessThan(0.08)
      expect(p.pos[0] - w / 2).toBeGreaterThanOrEqual(L.bounds.minX)
      expect(p.pos[0] + w / 2).toBeLessThanOrEqual(L.bounds.maxX)
      // the door opening itself (below the lintel) is never covered
      if (yMin < 1.42) expect(p.pos[0] + w / 2 < dl || p.pos[0] - w / 2 > dr).toBe(true)
      // nothing hangs in a slot cell, obstacle or column footprint (wall strip: z within 0.08 of the wall)
      const x0 = p.pos[0] - w / 2
      const x1 = p.pos[0] + w / 2
      const wallStrip = { minZ: L.bounds.minZ, maxZ: L.bounds.minZ + 0.08 }
      for (const c of L.slotWorld.values()) {
        const hit = x1 > c[0] - CELL / 2 && x0 < c[0] + CELL / 2 && wallStrip.maxZ > c[1] - CELL / 2 && wallStrip.minZ < c[1] + CELL / 2
        expect(hit).toBe(false)
      }
      for (const o of L.obstacles) expect(x1 > o.minX && x0 < o.maxX && wallStrip.maxZ > o.minZ && wallStrip.minZ < o.maxZ).toBe(false)
      for (const [cx, cz] of L.columns) expect(x1 > cx - 0.11 && x0 < cx + 0.11 && wallStrip.maxZ > cz - 0.11 && wallStrip.minZ < cz + 0.11).toBe(false)
    }
  })
})
