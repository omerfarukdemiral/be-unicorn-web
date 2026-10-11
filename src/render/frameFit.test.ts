import { describe, expect, it } from 'vitest'
import { fitOutline, hull, outlineOf, polyHitsRect, type Pt } from './frameFit'

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
