// Grid A* over the office floor so characters walk around furniture instead of through it.
// Purely cosmetic: built lazily from the render layout and cached per layout object.
import type { Box, OfficeLayout, XZ } from './layout'

/** Nav cell size in world units. */
const RES = 0.25
/** Character body radius; obstacles and walls are inflated by this. */
const RADIUS = 0.2
/** A blocked goal this close to free floor (a seat tucked under a desk) is still walked to exactly. */
const SNAP_REACH = 0.6

interface NavGrid {
  x0: number
  z0: number
  w: number
  h: number
  blocked: Uint8Array
}

const cache = new WeakMap<OfficeLayout, NavGrid>()

function inside(b: Box, x: number, z: number, pad: number): boolean {
  return x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad
}

function gridOf(layout: OfficeLayout): NavGrid {
  const hit = cache.get(layout)
  if (hit) return hit
  const b = layout.bounds
  const w = Math.max(1, Math.ceil((b.maxX - b.minX) / RES))
  const h = Math.max(1, Math.ceil((b.maxZ - b.minZ) / RES))
  const blocked = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = b.minX + (i + 0.5) * RES
      const z = b.minZ + (j + 0.5) * RES
      const nearWall = x < b.minX + RADIUS || x > b.maxX - RADIUS || z < b.minZ + RADIUS || z > b.maxZ - RADIUS
      if (nearWall || layout.obstacles.some((o) => inside(o, x, z, RADIUS))) blocked[j * w + i] = 1
    }
  }
  const grid = { x0: b.minX, z0: b.minZ, w, h, blocked }
  cache.set(layout, grid)
  return grid
}

function cellOf(g: NavGrid, p: XZ): [number, number] {
  const i = Math.min(g.w - 1, Math.max(0, Math.floor((p[0] - g.x0) / RES)))
  const j = Math.min(g.h - 1, Math.max(0, Math.floor((p[1] - g.z0) / RES)))
  return [i, j]
}

function centerOf(g: NavGrid, idx: number): XZ {
  return [g.x0 + ((idx % g.w) + 0.5) * RES, g.z0 + (Math.floor(idx / g.w) + 0.5) * RES]
}

/** Nearest free cell to `p` (BFS), or -1 when the whole grid is blocked. */
function nearestFree(g: NavGrid, p: XZ): number {
  const [i, j] = cellOf(g, p)
  const start = j * g.w + i
  if (!g.blocked[start]) return start
  const seen = new Uint8Array(g.w * g.h)
  const queue = [start]
  seen[start] = 1
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!
    if (!g.blocked[c]) return c
    const ci = c % g.w
    const cj = Math.floor(c / g.w)
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = ci + di
      const nj = cj + dj
      if (ni < 0 || nj < 0 || ni >= g.w || nj >= g.h) continue
      const n = nj * g.w + ni
      if (!seen[n]) {
        seen[n] = 1
        queue.push(n)
      }
    }
  }
  return -1
}

/** True when the straight segment a→b stays on free cells. */
function clear(g: NavGrid, a: XZ, b: XZ): boolean {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (RES * 0.4))
  for (let k = 0; k <= steps; k++) {
    const t = steps === 0 ? 0 : k / steps
    const [i, j] = cellOf(g, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    if (g.blocked[j * g.w + i]) return false
  }
  return true
}

/** 8-connected A* between free cells (no corner cutting). Returns cell indices start..goal, or null. */
function astar(g: NavGrid, start: number, goal: number): number[] | null {
  const n = g.w * g.h
  const gScore = new Float32Array(n).fill(Infinity)
  const from = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const gi = goal % g.w
  const gj = Math.floor(goal / g.w)
  const heur = (c: number) => {
    const dx = Math.abs((c % g.w) - gi)
    const dz = Math.abs(Math.floor(c / g.w) - gj)
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)
  }
  // Binary heap of [f, cell].
  const heap: [number, number][] = []
  const push = (f: number, c: number) => {
    heap.push([f, c])
    let k = heap.length - 1
    while (k > 0) {
      const p = (k - 1) >> 1
      if (heap[p]![0] <= heap[k]![0]) break
      ;[heap[p], heap[k]] = [heap[k]!, heap[p]!]
      k = p
    }
  }
  const pop = (): number => {
    const top = heap[0]!
    const last = heap.pop()!
    if (heap.length > 0) {
      heap[0] = last
      let k = 0
      for (;;) {
        const l = k * 2 + 1
        const r = l + 1
        let m = k
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r
        if (m === k) break
        ;[heap[m], heap[k]] = [heap[k]!, heap[m]!]
        k = m
      }
    }
    return top[1]
  }
  gScore[start] = 0
  push(heur(start), start)
  while (heap.length > 0) {
    const c = pop()
    if (c === goal) {
      const out = [c]
      for (let k = from[c]!; k !== -1; k = from[k]!) out.push(k)
      return out.reverse()
    }
    if (closed[c]) continue
    closed[c] = 1
    const ci = c % g.w
    const cj = Math.floor(c / g.w)
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = ci + di
        const nj = cj + dj
        if (ni < 0 || nj < 0 || ni >= g.w || nj >= g.h) continue
        const nc = nj * g.w + ni
        if (g.blocked[nc] || closed[nc]) continue
        if (di && dj && (g.blocked[cj * g.w + ni] || g.blocked[nj * g.w + ci])) continue
        const ng = gScore[c]! + (di && dj ? Math.SQRT2 : 1)
        if (ng < gScore[nc]!) {
          gScore[nc] = ng
          from[nc] = c
          push(ng + heur(nc), nc)
        }
      }
    }
  }
  return null
}

/** Waypoints (excluding `a`) from a to b that avoid furniture. Falls back to a straight line. */
export function findPath(a: XZ, b: XZ, layout: OfficeLayout): XZ[] {
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) return [b]
  const g = gridOf(layout)
  const s = nearestFree(g, a)
  const t = nearestFree(g, b)
  if (s < 0 || t < 0) return [b]
  const cells = astar(g, s, t)
  if (!cells) return [b]
  const tEnd = centerOf(g, t)
  // Blocked goals far from free floor (e.g. a random wander point inside a desk) stop at the free edge.
  const goal: XZ = g.blocked[cellOf(g, b)[1] * g.w + cellOf(g, b)[0]] && Math.hypot(b[0] - tEnd[0], b[1] - tEnd[1]) > SNAP_REACH ? tEnd : b
  const raw: XZ[] = cells.map((c) => centerOf(g, c))
  // String-pull: keep only the waypoints needed for line of sight.
  const pts: XZ[] = []
  let anchor: XZ = s === cellOf(g, a)[1] * g.w + cellOf(g, a)[0] ? a : raw[0]!
  if (anchor !== a) pts.push(anchor)
  let k = 0
  while (k < raw.length - 1) {
    let far = k + 1
    for (let m = raw.length - 1; m > k + 1; m--) {
      if (clear(g, anchor, raw[m]!)) {
        far = m
        break
      }
    }
    anchor = raw[far]!
    pts.push(anchor)
    k = far
  }
  // The last cell centre is replaced by the exact goal when it is directly reachable.
  const last = pts[pts.length - 1]
  if (last && clear(g, pts.length > 1 ? pts[pts.length - 2]! : a, goal) && goal !== tEnd) pts[pts.length - 1] = goal
  else if (!last || Math.hypot(last[0] - goal[0], last[1] - goal[1]) > 0.01) pts.push(goal)
  return pts
}
