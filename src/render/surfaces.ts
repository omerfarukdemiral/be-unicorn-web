// Painted surfaces: floor and wall materials that climb with the stage (garage concrete → campus walnut), and the
// facades of the street outside. Each is a small canvas texture, drawn once and cached, so a whole floor stays one
// mesh and one draw call. Patterns tile seamlessly (anything crossing an edge is drawn again on the other side).
import * as THREE from 'three'
import { hash01 } from './constants'

/** World units covered by one repeat of a floor texture: two cells (Office.tsx starts it on a cell edge). */
export const FLOOR_TILE = 3
/** World units covered by one horizontal repeat of a wall texture (its height is the whole wall). */
export const WALL_TILE = 2.2

const PX = 512

type Ctx = CanvasRenderingContext2D

function canvas(w = PX, h = PX): [HTMLCanvasElement, Ctx] | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  return ctx ? [c, ctx] : null
}

function tone(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}

/** Seeded 0..1 sequence (mulberry32; consecutive hash01 salts correlate and line the chips up in rows). */
function rng(seed: string) {
  let a = Math.floor(hash01(seed) * 0xffffffff) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Draws `fn` at (x, y) and again shifted by ±size wherever the shape would cross an edge. */
function wrapped(size: number, x: number, y: number, w: number, h: number, fn: (x: number, y: number) => void) {
  for (const dx of [0, -size, size]) {
    if (x + dx > size || x + dx + w < 0) continue
    for (const dy of [0, -size, size]) {
      if (y + dy > size || y + dy + h < 0) continue
      fn(x + dx, y + dy)
    }
  }
}

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------

/**
 * Staggered planks along x: `rows` rows per repeat, random lengths, a soft tone per plank and a hairline joint. A
 * repeat is two cells; planks never cross a cell edge, so every cell reads as one floor tile (the edit grid).
 */
function planks(g: Ctx, base: string, rows: number, seed: string, joint: string) {
  const r = rng(seed)
  const h = PX / rows
  const half = PX / 2
  for (let row = 0; row < rows; row++) {
    for (const x0 of [0, half]) {
      let x = x0
      // The first plank of a run is a part, so the rows stay staggered.
      let len = half * (0.2 + r() * 0.55)
      while (x < x0 + half - 0.5) {
        const w = Math.min(len, x0 + half - x)
        g.fillStyle = tone(base, 0.93 + r() * 0.12)
        g.fillRect(x, row * h, w, h)
        g.fillStyle = joint
        g.fillRect(x, row * h, w, 1.5)
        g.fillRect(x, row * h, 1.5, h)
        // grain
        g.fillStyle = 'rgba(120,80,40,.05)'
        g.fillRect(x + w * 0.1, row * h + h * 0.4, w * 0.6, 1)
        x += w
        len = half * (0.5 + r() * 0.5)
      }
    }
  }
  cellSeams(g, joint)
}

/** A slightly stronger joint on the cell edges (a repeat is two cells): the floor's own grid is the edit grid. */
function cellSeams(g: Ctx, color: string) {
  g.fillStyle = color
  for (const v of [0, PX / 2]) {
    g.fillRect(v, 0, 2.5, PX)
    g.fillRect(0, v, PX, 2.5)
  }
}

/** Herringbone: columns of slanted boards, alternating direction per column (period divides the repeat). */
function herringbone(g: Ctx, base: string, seed: string, joint: string) {
  const r = rng(seed)
  const cols = 12
  const w = PX / cols
  const len = PX / 12
  for (let c = 0; c < cols; c++) {
    const dir = c % 2 ? 1 : -1
    for (let y = -2 * len, i = 0; y < PX + 2 * len; y += len, i++) {
      g.beginPath()
      g.moveTo(c * w, y)
      g.lineTo(c * w + w, y + dir * w)
      g.lineTo(c * w + w, y + dir * w + len)
      g.lineTo(c * w, y + len)
      g.closePath()
      g.fillStyle = tone(base, (i + c) % 2 ? 1.03 : 0.9 + r() * 0.05)
      g.fill()
      g.strokeStyle = joint
      g.lineWidth = 1.2
      g.stroke()
    }
  }
  // Laid in one-cell panels.
  cellSeams(g, joint)
}

function speckle(g: Ctx, colors: readonly string[], n: number, rMin: number, rMax: number, seed: string) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    const x = r() * PX
    const y = r() * PX
    const rx = rMin + r() * (rMax - rMin)
    const ry = rx * (0.6 + r() * 0.4)
    const rot = r() * Math.PI
    g.fillStyle = colors[i % colors.length]!
    wrapped(PX, x - rx, y - rx, rx * 2, rx * 2, (px, py) => {
      g.beginPath()
      g.ellipse(px + rx, py + rx, rx, ry, rot, 0, Math.PI * 2)
      g.fill()
    })
  }
}

function grid(g: Ctx, step: number, color: string, w = 2) {
  g.fillStyle = color
  for (let v = 0; v < PX; v += step) {
    g.fillRect(v, 0, w, PX)
    g.fillRect(0, v, PX, w)
  }
}

/** Marble slabs: veins stay inside each slab, so the slab joints hide every seam. */
function marble(g: Ctx, seed: string) {
  const r = rng(seed)
  g.fillStyle = '#f4f0ea'
  g.fillRect(0, 0, PX, PX)
  const slab = PX / 2
  for (let sx = 0; sx < 2; sx++)
    for (let sy = 0; sy < 2; sy++) {
      g.save()
      g.beginPath()
      g.rect(sx * slab, sy * slab, slab, slab)
      g.clip()
      g.fillStyle = (sx + sy) % 2 ? '#f1ece5' : '#f6f3ee'
      g.fillRect(sx * slab, sy * slab, slab, slab)
      for (let v = 0; v < 5; v++) {
        g.strokeStyle = `rgba(130,125,140,${0.14 + r() * 0.2})`
        g.lineWidth = 1 + r() * 2.5
        g.beginPath()
        let x = sx * slab + r() * slab
        let y = sy * slab + r() * slab
        g.moveTo(x, y)
        for (let k = 0; k < 4; k++) {
          const nx = x + (r() - 0.35) * slab * 0.7
          const ny = y + (r() - 0.5) * slab * 0.5
          g.quadraticCurveTo((x + nx) / 2 + (r() - 0.5) * 40, (y + ny) / 2, nx, ny)
          x = nx
          y = ny
        }
        g.stroke()
      }
      g.restore()
    }
  grid(g, slab, 'rgba(170,160,150,.45)', 2)
}

function drawFloor(g: Ctx, stage: number) {
  switch (stage) {
    case 0: // garage: sealed concrete, saw-cut joints, a few aggregate flecks
      g.fillStyle = '#cfc8bc'
      g.fillRect(0, 0, PX, PX)
      speckle(g, ['rgba(120,110,95,.10)', 'rgba(255,255,255,.18)'], 500, 1, 4, 'f0')
      grid(g, PX / 2, 'rgba(95,85,72,.28)', 2)
      return
    case 1: // coworking: light birch laminate
      planks(g, '#ead5ad', 14, 'f1', 'rgba(120,85,45,.22)')
      return
    case 2: // seed: oak boards
      planks(g, '#ddb37a', 16, 'f2', 'rgba(110,70,35,.26)')
      return
    case 3: // series A: herringbone oak
      herringbone(g, '#d8a76d', 'f3', 'rgba(110,70,35,.28)')
      return
    case 4: // series B: terrazzo
      g.fillStyle = '#efe7dc'
      g.fillRect(0, 0, PX, PX)
      speckle(g, ['#dba58c', '#a5bcae', '#c4bab0', '#e8c98d', '#8f8b98', '#f2b9a7'], 1300, 1.5, 4.5, 'f4')
      grid(g, PX / 2, 'rgba(150,140,128,.4)', 2)
      return
    case 5: // series C: marble slabs
      marble(g, 'f5')
      return
    default: // campus: walnut herringbone
      herringbone(g, '#8a5a3c', 'f6', 'rgba(40,22,12,.35)')
  }
}

const floorCache = new Map<number, THREE.CanvasTexture>()

/** The stage's floor texture (repeat-wrapped, one repeat = FLOOR_TILE world units). Null outside a browser. */
export function floorTexture(stage: number): THREE.CanvasTexture | null {
  const hit = floorCache.get(stage)
  if (hit) return hit
  const cv = canvas()
  if (!cv) return null
  drawFloor(cv[1], stage)
  const tex = finish(new THREE.CanvasTexture(cv[0]))
  floorCache.set(stage, tex)
  return tex
}

// ---------------------------------------------------------------------------
// Walls (inner faces). v = 0 at the floor, 1 at the wall top.
// ---------------------------------------------------------------------------

export type WallSide = 'back' | 'left'

function slats(g: Ctx, y0: number, y1: number, base: string, n: number) {
  const w = PX / n
  for (let i = 0; i < n; i++) {
    g.fillStyle = tone(base, i % 3 === 0 ? 0.9 : i % 3 === 1 ? 1 : 1.05)
    g.fillRect(i * w, y0, w - 3, y1 - y0)
    g.fillStyle = 'rgba(60,35,15,.45)'
    g.fillRect(i * w + w - 3, y0, 3, y1 - y0)
  }
}

function baseboard(g: Ctx, color: string) {
  g.fillStyle = color
  g.fillRect(0, PX - 18, PX, 18)
}

function drawWall(g: Ctx, stage: number, side: WallSide, paint: string, accent: string, trim: string) {
  const back = side === 'back'
  switch (stage) {
    case 0: {
      // breeze block, half-bond courses
      g.fillStyle = '#d3ccc0'
      g.fillRect(0, 0, PX, PX)
      speckle(g, ['rgba(110,100,85,.10)'], 300, 1, 3, `w0${side}`)
      const rows = 11
      const h = PX / rows
      g.fillStyle = 'rgba(110,100,88,.45)'
      for (let r = 0; r < rows; r++) {
        g.fillRect(0, r * h, PX, 2)
        for (let x = (r % 2) * (PX / 4); x < PX; x += PX / 2) g.fillRect(x, r * h, 2, h)
      }
      return
    }
    case 1:
      // white paint with the stage's mint stripe at desk height
      g.fillStyle = '#f7f3ec'
      g.fillRect(0, 0, PX, PX)
      g.fillStyle = trim
      g.fillRect(0, PX * 0.56, PX, PX * 0.05)
      baseboard(g, trim)
      return
    case 2:
      // seed: the back wall in full accent colour, the side wall two-tone
      g.fillStyle = back ? accent : paint
      g.fillRect(0, 0, PX, PX)
      if (!back) {
        g.fillStyle = trim
        g.fillRect(0, PX * 0.66, PX, PX * 0.34)
        g.fillStyle = 'rgba(255,255,255,.5)'
        g.fillRect(0, PX * 0.66, PX, 4)
      }
      baseboard(g, back ? tone(accent, 0.8) : tone(trim, 0.85))
      return
    case 3:
      // series A: paint above, oak slat wainscot below a dark rail
      g.fillStyle = back ? accent : paint
      g.fillRect(0, 0, PX, PX)
      slats(g, PX * 0.58, PX, '#c98f5a', 32)
      g.fillStyle = '#7d5234'
      g.fillRect(0, PX * 0.58 - 8, PX, 8)
      return
    case 4:
      // series B: oak slats floor to ceiling
      g.fillStyle = '#3a2618'
      g.fillRect(0, 0, PX, PX)
      slats(g, 0, PX, '#c58b56', 40)
      return
    default:
      // series C side wall: moss
      g.fillStyle = '#3f7b4d'
      g.fillRect(0, 0, PX, PX)
      speckle(g, ['#5fb85a', '#2e6a41', '#82d27a', '#4c9a55', '#a5dd8e'], 1500, 4, 11, `w5${side}`)
  }
}

const wallCache = new Map<string, THREE.CanvasTexture>()

/** The stage's inner wall texture for one side (repeat-wrapped horizontally, one repeat = WALL_TILE). */
export function wallTexture(stage: number, side: WallSide, paint: string, accent: string, trim: string): THREE.CanvasTexture | null {
  const key = `${stage}:${side}:${paint}:${accent}:${trim}`
  const hit = wallCache.get(key)
  if (hit) return hit
  const cv = canvas()
  if (!cv) return null
  drawWall(cv[1], stage, side, paint, accent, trim)
  const tex = finish(new THREE.CanvasTexture(cv[0]))
  tex.wrapT = THREE.ClampToEdgeWrapping
  wallCache.set(key, tex)
  return tex
}

function finish(tex: THREE.CanvasTexture): THREE.CanvasTexture {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// ---------------------------------------------------------------------------
// Street facades: windows + the sign of a startup-world business (names are invented).
// ---------------------------------------------------------------------------

export interface FacadeSpec {
  /** Facade base colour. */
  body: string
  /** Glass curtain wall instead of punched windows. */
  glass?: boolean
  floors: number
  sign?: { text: string; sub?: string; bg: string; fg: string; logo?: string }
  awning?: [string, string]
}

const facadeCache = new Map<string, THREE.CanvasTexture>()

const SIGN_FONT = '"Bricolage Grotesque Variable", "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif'

/** Front (sign) or side facade of a building `w` wide and `h` tall (world units), drawn at ~64 px per unit. */
export function facadeTexture(spec: FacadeSpec, w: number, h: number, front: boolean): THREE.CanvasTexture | null {
  const key = `${JSON.stringify(spec)}:${w}:${h}:${front}`
  const hit = facadeCache.get(key)
  if (hit) return hit
  const U = 64
  const cv = canvas(Math.round(w * U), Math.round(h * U))
  if (!cv) return null
  const [c, g] = cv
  const draw = () => {
    const W = c.width
    const H = c.height
    g.fillStyle = spec.body
    g.fillRect(0, 0, W, H)
    const floorH = H / spec.floors
    const groundSign = front && spec.sign
    for (let f = 0; f < spec.floors; f++) {
      const y = H - (f + 1) * floorH
      if (spec.glass) {
        g.fillStyle = 'rgba(40,110,150,.55)'
        g.fillRect(6, y + 6, W - 12, floorH - 10)
        g.fillStyle = 'rgba(255,255,255,.22)'
        for (let x = 6; x < W - 12; x += U * 0.9) g.fillRect(x, y + 6, 3, floorH - 10)
        g.fillStyle = 'rgba(255,255,255,.12)'
        g.fillRect(6, y + 6, (W - 12) * 0.35, floorH - 10)
        continue
      }
      if (f === 0 && groundSign) {
        // shop front: one wide pane
        g.fillStyle = 'rgba(60,85,110,.6)'
        g.fillRect(U * 0.3, y + floorH * 0.3, W - U * 0.6, floorH * 0.62)
        continue
      }
      for (let x = U * 0.35; x < W - U * 0.6; x += U * 0.95) {
        g.fillStyle = 'rgba(60,85,110,.55)'
        g.fillRect(x, y + floorH * 0.25, U * 0.55, floorH * 0.5)
        g.fillStyle = 'rgba(255,255,255,.25)'
        g.fillRect(x, y + floorH * 0.25, U * 0.55, 3)
      }
    }
    if (front && spec.awning) {
      const y = H - floorH + floorH * 0.12
      const n = Math.max(4, Math.round(W / (U * 0.4)))
      for (let i = 0; i < n; i++) {
        g.fillStyle = spec.awning[i % 2]!
        g.fillRect((W / n) * i, y, W / n + 1, floorH * 0.16)
      }
    }
    if (front && spec.sign) {
      const s = spec.sign
      const sh = Math.min(U * 0.9, floorH * 0.7)
      const sy = spec.floors > 1 ? H - floorH - sh * 0.6 : H - floorH + 6
      const sw = W * 0.86
      const sx = (W - sw) / 2
      g.fillStyle = s.bg
      g.fillRect(sx, sy, sw, sh)
      let tx = sx + sh * 0.3
      if (s.logo) {
        g.fillStyle = s.logo
        g.beginPath()
        g.arc(tx + sh * 0.32, sy + sh / 2, sh * 0.3, 0, Math.PI * 2)
        g.fill()
        tx += sh * 0.8
      }
      g.fillStyle = s.fg
      g.textBaseline = 'middle'
      const size = Math.round(sh * (s.sub ? 0.46 : 0.58))
      g.font = `800 ${size}px ${SIGN_FONT}`
      const maxW = sx + sw - tx - sh * 0.2
      g.fillText(s.text, tx, sy + sh * (s.sub ? 0.36 : 0.52), maxW)
      if (s.sub) {
        g.font = `600 ${Math.round(sh * 0.24)}px ${SIGN_FONT}`
        g.fillText(s.sub, tx, sy + sh * 0.76, maxW)
      }
    }
  }
  draw()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  // Signs drawn before the webfont arrives would keep a fallback face: redraw once it is ready.
  if (front && spec.sign && typeof document !== 'undefined' && document.fonts?.load) {
    void document.fonts.load(`800 32px ${SIGN_FONT}`).then(() => {
      draw()
      tex.needsUpdate = true
    })
  }
  facadeCache.set(key, tex)
  return tex
}
