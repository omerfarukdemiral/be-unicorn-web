import { describe, expect, it } from 'vitest'
import { computeLayout, deskPoints, furnishedBox } from './layout'
import { createMockState } from './mockState'
import { centredOutlineOfPoints, fitOutline, gapCenterY, hull, outlineOf, polyHitsRect, type Pt } from './frameFit'

const box = { minX: -6, maxX: 6, minZ: -6, maxZ: 6 }
const screen = { left: 0, top: 0, right: 1440, bottom: 900 }

function extent(outline: readonly Pt[]) {
  const xs = outline.map((p) => p[0])
  const ys = outline.map((p) => p[1])
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), top: Math.min(...ys) }
}

describe('frameFit', () => {
  it('projects a square floor to a wide diamond with the walls above it', () => {
    const o = outlineOf(box, 2.2)
    const e = extent(o)
    expect(e.w).toBeGreaterThan(e.h)
    // The walls lift the top: the outline reaches further up than down.
    expect(-e.top).toBeGreaterThan(e.h / 2)
  })

  it('hull keeps the convex corners only', () => {
    const h = hull([
      [0, 0],
      [2, 0],
      [1, 1],
      [2, 2],
      [0, 2],
    ])
    expect(h).toHaveLength(4)
  })

  it('separating axis: a rect in the diamond notch does not hit it', () => {
    const diamond: Pt[] = [
      [0, -10],
      [10, 0],
      [0, 10],
      [-10, 0],
    ]
    expect(polyHitsRect(diamond, { left: 6, top: -10, right: 10, bottom: -6 })).toBe(false)
    expect(polyHitsRect(diamond, { left: -1, top: -1, right: 1, bottom: 1 })).toBe(true)
  })

  it('corner islands leave the office bigger than bars across the whole width would', () => {
    const outline = outlineOf(box, 2.2)
    const corners = [
      { left: 8, top: 8, right: 360, bottom: 64 },
      { left: 1050, top: 8, right: 1432, bottom: 64 },
      { left: 8, top: 790, right: 298, bottom: 892 },
      { left: 1180, top: 836, right: 1432, bottom: 892 },
    ]
    const islands = fitOutline({ outline, free: screen, islands: corners })
    const bars = fitOutline({ outline, free: { ...screen, top: 72, bottom: 780 }, islands: [] })
    expect(islands.zoom).toBeGreaterThan(bars.zoom * 1.1)
    // Fitted outline stays on screen.
    const o = outline.map(([x, y]) => [islands.x + x * islands.zoom, islands.y + y * islands.zoom] as const)
    for (const [x, y] of o) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(1440)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(900)
    }
    for (const r of corners) expect(polyHitsRect(o, r)).toBe(false)
  })

  it('respects the zoom cap and stays centred without islands', () => {
    const f = fitOutline({ outline: outlineOf(box, 2.2), free: screen, islands: [], maxZoom: 30 })
    expect(f.zoom).toBe(30)
    expect(f.x).toBe(720)
    expect(f.y).toBe(450)
  })
})

describe('gapCenterY', () => {
  it('centres between the top and bottom islands, null without both', () => {
    const top = { left: 8, top: 8, right: 380, bottom: 64 }
    const bottom = { left: 8, top: 716, right: 380, bottom: 836 }
    expect(gapCenterY([top, bottom], 844)).toBe(390)
    expect(gapCenterY([top], 844)).toBeNull()
  })

  it('focusY moves the office towards the gap; unset keeps the centred fit', () => {
    const outline = outlineOf(box, 2.2)
    const free = { left: 0, top: 0, right: 390, bottom: 844 }
    const base = fitOutline({ outline, free, islands: [] })
    expect(base.y).toBeCloseTo(422, 0)
    const biased = fitOutline({ outline, free, islands: [], focusY: 520 })
    expect(biased.y).toBeGreaterThan(base.y)
    expect(biased.zoom).toBeCloseTo(base.zoom, 0)
  })
})

describe('portrait ring framing', () => {
  const ring = { minX: -5, maxX: 5, minZ: -4, maxZ: 4 }
  it('390x844: the ring fills at least 70% of the free width and its centre sits in the gap between the islands', () => {
    const islands = [
      { left: 8, top: 8, right: 330, bottom: 64 },
      { left: 8, top: 716, right: 382, bottom: 836 },
    ]
    const outline = outlineOf(ring, 2.2)
    const fit = fitOutline({ outline, free: { left: 0, top: 0, right: 390, bottom: 844 }, islands, sideSlack: 0.04, islandSlack: 0.1, focusY: gapCenterY(islands, 844) ?? undefined })
    const w = extent(outline).w * fit.zoom
    expect(w).toBeGreaterThanOrEqual(390 * 0.7)
    expect(fit.y).toBeGreaterThan(64)
    expect(fit.y).toBeLessThan(716)
  })

  it('390x844 stage 3: the real furnished box fills the free width and is centred in the gap', () => {
    const st = createMockState(3)
    const L = computeLayout(st.office.slots, st.office.rings, st.office.stage)
    const fb = furnishedBox(L, st.office.slots)!
    const islands = [
      { left: 8, top: 8, right: 330, bottom: 64 },
      { left: 8, top: 716, right: 382, bottom: 836 },
    ]
    const outline = outlineOf({ minX: fb.minX, maxX: fb.maxX, minZ: fb.minZ, maxZ: fb.maxZ }, 2.2)
    const fit = fitOutline({ outline, free: { left: 0, top: 0, right: 390, bottom: 844 }, islands, sideSlack: 0.04, islandSlack: 0.1, focusY: gapCenterY(islands, 844) ?? undefined })
    expect(extent(outline).w * fit.zoom).toBeGreaterThanOrEqual(390 * 0.7)
    expect(fit.y).toBeGreaterThan(64)
    expect(fit.y).toBeLessThan(716)
  })

  it('desktop 1440x900 without focusY is unchanged', () => {
    const fit = fitOutline({ outline: outlineOf(box, 2.2), free: screen, islands: [], islandSlack: 0.1 })
    // Values the fit produced before focusY existed.
    expect(fit.x).toBe(720)
    expect(fit.y).toBeCloseTo(523.3333, 3)
    expect(fit.zoom).toBeCloseTo(72.4829, 3)
  })
})

describe('portrait team hull (fix round 2 N2)', () => {
  it('390x844 Series C: every desk stays on screen and clear of the HUD, centred in the gap', () => {
    const st = createMockState(5)
    const L = computeLayout(st.office.slots, st.office.rings, st.office.stage)
    const pts = deskPoints(L, st.office.slots)
    const { outline } = centredOutlineOfPoints(pts, 0.75, 2)
    const xs = outline.map((p) => p[0])
    const ys = outline.map((p) => p[1])
    const e = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    // Centred: the hull's middle is its anchor.
    expect(Math.abs(e.minX + e.maxX)).toBeLessThan(1e-6)
    const islands = [
      { left: 8, top: 8, right: 330, bottom: 64 },
      { left: 8, top: 716, right: 382, bottom: 836 },
    ]
    const fit = fitOutline({ outline, free: { left: 0, top: 0, right: 390, bottom: 844 }, islands, focusY: gapCenterY(islands, 844) ?? undefined, maxZoom: 390 / 5.5 })
    expect(fit.x + e.minX * fit.zoom).toBeGreaterThanOrEqual(0)
    expect(fit.x + e.maxX * fit.zoom).toBeLessThanOrEqual(390)
    expect(fit.y + e.minY * fit.zoom).toBeGreaterThanOrEqual(64)
    expect(fit.y + e.maxY * fit.zoom).toBeLessThanOrEqual(716)
    // The team fills the width (the binding side on a phone).
    expect((e.maxX - e.minX) * fit.zoom).toBeGreaterThan(390 * 0.85)
  })
})
