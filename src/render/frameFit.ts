// Default framing (T07): the office as large as the free screen allows. The HUD is corner islands now, not bars, so
// the camera fits the office's projected outline between the islands instead of into the band between two bars:
// the diamond's narrow top and bottom tips may run between the corner islands, which a rectangle fit never allowed.
import * as THREE from 'three'
import { CAMERA_DIR } from './constants'

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export type Pt = readonly [number, number]

export interface FitBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Gap kept between the office outline and a screen edge / island (px). */
export const FIT_MARGIN = 10

const dir = new THREE.Vector3(...CAMERA_DIR).normalize()
const worldUp = new THREE.Vector3(0, 1, 0)
/** Camera basis for the fixed isometric view: screen x = right, screen y (down) = −up. */
const right = new THREE.Vector3().crossVectors(worldUp, dir).normalize()
const up = new THREE.Vector3().crossVectors(dir, right).normalize()

/**
 * The box's outline on screen per unit of zoom, relative to the screen point of its floor centre: the convex hull of
 * the floor corners and the same corners at `height` (walls, heads). Screen y grows downwards.
 */
export function outlineOf(box: FitBox, height: number): Pt[] {
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const pts: Pt[] = []
  for (const x of [box.minX, box.maxX])
    for (const z of [box.minZ, box.maxZ])
      for (const y of [0, height]) {
        const dx = x - cx
        const dz = z - cz
        pts.push([dx * right.x + y * right.y + dz * right.z, -(dx * up.x + y * up.y + dz * up.z)])
      }
  return hull(pts)
}

/**
 * Like outlineOf, for a set of floor points (the team's desks) each grown into a square of half-size `pad`: the hull
 * of their screen projection, relative to the screen point of `center`. A team is a blob, not a box: on a portrait
 * phone the box's bare side corners set the zoom (fix round 2 N2), the desks' own hull does not.
 */
export function outlineOfPoints(points: readonly Pt[], pad: number, height: number, center: Pt): Pt[] {
  const pts: Pt[] = []
  for (const [px, pz] of points)
    for (const x of [px - pad, px + pad])
      for (const z of [pz - pad, pz + pad])
        for (const y of [0, height]) {
          const dx = x - center[0]
          const dz = z - center[1]
          pts.push([dx * right.x + y * right.y + dz * right.z, -(dx * up.x + y * up.y + dz * up.z)])
        }
  return hull(pts)
}

/**
 * outlineOfPoints about the floor point whose screen projection is the middle of the hull's bounding box, so a fit that
 * centres its anchor centres the team itself (a lopsided team no longer wastes one side of a narrow phone).
 */
export function centredOutlineOfPoints(points: readonly Pt[], pad: number, height: number): { outline: Pt[]; center: Pt } {
  let cx = 0
  let cz = 0
  for (const [x, z] of points) {
    cx += x
    cz += z
  }
  cx /= points.length || 1
  cz /= points.length || 1
  const o = outlineOfPoints(points, pad, height, [cx, cz])
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of o) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  // Floor move (dx, dz) → screen (sx, sy): sx = dx·right.x + dz·right.z, sy = −(dx·up.x + dz·up.z). Solve for the box middle.
  const mx = (minX + maxX) / 2
  const my = (minY + maxY) / 2
  const a = right.x
  const b = right.z
  const c = -up.x
  const d = -up.z
  const det = a * d - b * c
  const dx = (mx * d - b * my) / det
  const dz = (a * my - mx * c) / det
  const center: Pt = [cx + dx, cz + dz]
  return { outline: outlineOfPoints(points, pad, height, center), center }
}

/** Andrew's monotone chain; counter-clockwise, no repeated end point. */
export function hull(pts: readonly Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Pt[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: Pt[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/** Separating-axis test: does the convex polygon overlap the rectangle? */
export function polyHitsRect(poly: readonly Pt[], r: Rect): boolean {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of poly) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (maxX <= r.left || minX >= r.right || maxY <= r.top || minY >= r.bottom) return false
  const corners: Pt[] = [
    [r.left, r.top],
    [r.right, r.top],
    [r.right, r.bottom],
    [r.left, r.bottom],
  ]
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const nx = b[1] - a[1]
    const ny = a[0] - b[0]
    let pMin = Infinity
    let pMax = -Infinity
    for (const [x, y] of poly) {
      const d = x * nx + y * ny
      pMin = Math.min(pMin, d)
      pMax = Math.max(pMax, d)
    }
    let rMin = Infinity
    let rMax = -Infinity
    for (const [x, y] of corners) {
      const d = x * nx + y * ny
      rMin = Math.min(rMin, d)
      rMax = Math.max(rMax, d)
    }
    if (rMax <= pMin || rMin >= pMax) return false
  }
  return true
}

export interface FitInput {
  /** Outline per unit zoom (outlineOf). */
  outline: readonly Pt[]
  /** Free screen area (the canvas minus a side panel), px. */
  free: Rect
  /** HUD islands over the scene, px. */
  islands: readonly Rect[]
  /** Share of the outline's width allowed past each side edge (portrait: the bare side tips of the diamond). */
  sideSlack?: number
  /**
   * Share of the outline (about its anchor) whose tips may slip under an island. The diamond's corners are bare floor
   * or a wall's end; held fully clear, a landscape phone's 125px gap between its bottom islands shrinks the office to
   * a third of the screen.
   */
  islandSlack?: number
  /** Screen y (px) the office is centred on when zoom ties; defaults to the middle of `free` (portrait: the middle of the gap between the HUD islands). */
  focusY?: number
  minZoom?: number
  maxZoom?: number
}

export interface Fit {
  zoom: number
  /** Screen point (px) where the box's floor centre lands. */
  x: number
  y: number
}

const ROWS = 13

/**
 * Largest zoom at which the outline stays inside `free` and off every island, trying anchor heights across the free
 * area (centred horizontally). Ties go to the anchor nearest the free area's centre, so the office never drifts for
 * a pixel of gain.
 */
export function fitOutline({ outline, free, islands, sideSlack = 0, islandSlack = 0, focusY, minZoom = 12, maxZoom = 400 }: FitInput): Fit {
  const m = FIT_MARGIN
  const area: Rect = { left: free.left + m, top: free.top + m, right: free.right - m, bottom: free.bottom - m }
  const blocks = islands.map((r) => ({ left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m }))
  let oMinX = Infinity
  let oMaxX = -Infinity
  let oMinY = Infinity
  let oMaxY = -Infinity
  for (const [x, y] of outline) {
    oMinX = Math.min(oMinX, x)
    oMaxX = Math.max(oMaxX, x)
    oMinY = Math.min(oMinY, y)
    oMaxY = Math.max(oMaxY, y)
  }
  const slack = (oMaxX - oMinX) * sideSlack
  const x = (area.left + area.right) / 2
  const midY = focusY === undefined ? (area.top + area.bottom) / 2 : clamp(focusY, area.top, area.bottom)

  const fits = (z: number, y: number): boolean => {
    if (x + (oMinX + slack) * z < area.left || x + (oMaxX - slack) * z > area.right) return false
    if (y + oMinY * z < area.top || y + oMaxY * z > area.bottom) return false
    if (!blocks.length) return true
    const k = z * (1 - islandSlack)
    const poly = outline.map(([px, py]) => [x + px * k, y + py * k] as const)
    return !blocks.some((b) => polyHitsRect(poly, b))
  }

  let best: Fit = { zoom: minZoom, x, y: midY }
  let found = false
  for (let i = 0; i < ROWS; i++) {
    // Rows ordered outward from the centre: 0, +1, −1, +2, …
    const k = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2)
    const y = midY + (k / (ROWS - 1)) * (area.bottom - area.top)
    if (y <= area.top || y >= area.bottom) continue
    if (!fits(minZoom, y)) continue
    let lo = minZoom
    let hi = maxZoom
    if (fits(hi, y)) lo = hi
    else
      for (let it = 0; it < 22 && hi - lo > 0.05; it++) {
        const mid = (lo + hi) / 2
        if (fits(mid, y)) lo = mid
        else hi = mid
      }
    // Rows come outward from the centre: a farther row has to beat the best by 2% to move the office off-centre.
    if (!found || lo > best.zoom * 1.02) {
      best = { zoom: lo, x, y }
      found = true
    }
  }
  return best
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Portrait: the vertical middle of the open gap between the top HUD islands and the bottom ones (the scene the player
 * actually sees), not of the whole canvas. Null when no island sits in either band.
 */
export function gapCenterY(islands: readonly Rect[], height: number): number | null {
  let top = -Infinity
  let bottom = Infinity
  for (const r of islands) {
    if (r.bottom < height * 0.4) top = Math.max(top, r.bottom)
    else if (r.top > height * 0.6) bottom = Math.min(bottom, r.top)
  }
  if (top === -Infinity || bottom === Infinity) return null
  return (top + bottom) / 2
}

/** Viewport rects of the HUD islands (`data-scene-island`), relative to the canvas. Layout boxes: transforms ignored. */
export function measureIslands(canvas: HTMLElement): Rect[] {
  const c = canvas.getBoundingClientRect()
  const out: Rect[] = []
  for (const el of document.querySelectorAll<HTMLElement>('[data-scene-island]')) {
    if (!el.offsetWidth || !el.offsetHeight) continue
    let left = 0
    let top = 0
    for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
      left += n.offsetLeft
      top += n.offsetTop
    }
    out.push({ left: left - c.left, top: top - c.top, right: left - c.left + el.offsetWidth, bottom: top - c.top + el.offsetHeight })
  }
  return out
}
