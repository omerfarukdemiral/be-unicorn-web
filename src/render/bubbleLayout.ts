// Screen-space placement of world bubbles (pure, no DOM). Input: each visible bubble's natural
// screen rect (where drei <Html> puts it above its speaker) + priority. Output: a pixel offset per
// bubble, or `hidden`. Higher priority is placed first and never moves for a lower one:
// decision > concept > conceptIcon > ambient.
// - Decision/concept bubbles are always shown: lifted, pushed down, moved sideways, or (no room at
//   all) pinned to the top of the free area.
// - Concept icons try the same slots but are hidden when none is free (the Defter badge lists them).
// - Ambient lines are only lifted a little; otherwise hidden until the space clears.
// A stem (thin line back to the speaker's head) is drawn for lifted bubbles, unless another bubble
// sits between the bubble and its speaker.

export type BubbleKind = 'decision' | 'concept' | 'conceptIcon' | 'ambient'

export const BUBBLE_PRIORITY: Record<BubbleKind, number> = { decision: 3, concept: 2, conceptIcon: 1, ambient: 0 }

export const isClickable = (k: BubbleKind): boolean => k !== 'ambient'

/** Must stay visible no matter what (falls back to overlapping at the top of the free area). */
const isForced = (k: BubbleKind): boolean => k === 'decision' || k === 'concept'

export interface BubbleBox {
  key: string
  speakerId: string
  kind: BubbleKind
  /** Natural (unshifted) client rect of the bubble, px. `top + h` is where the tail meets the head. */
  left: number
  top: number
  w: number
  h: number
}

export interface Viewport {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Placement {
  dx: number
  dy: number
  hidden: boolean
  /** Stem length below the bubble, px (0 = no stem). */
  stem: number
  /** Stem x from the bubble's left edge, px. */
  stemX: number
}

export interface LayoutOptions {
  /** Minimum free space between two bubbles, px. */
  gap: number
  /** How far an ambient line may be lifted above its speaker before it is hidden instead, px. */
  maxAmbientLift: number
  /** Keep the previous offset while it is still valid and within this many px of the ideal one. */
  hysteresis: number
  /** Extra clearance a hidden/new ambient line needs before it (re)appears, px. */
  showPad: number
  /** Minimum lift that gets a stem, px. */
  minStem: number
}

export const DEFAULT_LAYOUT: LayoutOptions = { gap: 6, maxAmbientLift: 56, hysteresis: 14, showPad: 10, minStem: 8 }

const HIDDEN: Placement = { dx: 0, dy: 0, hidden: true, stem: 0, stemX: 0 }

interface Rect {
  l: number
  t: number
  r: number
  b: number
}

const overlaps = (a: Rect, b: Rect, pad: number): boolean => a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Placement order: priority first, then the previous order (stability), then key. */
function order(items: readonly BubbleBox[], prev: ReadonlyMap<string, Placement> | undefined): BubbleBox[] {
  const rank = new Map<string, number>()
  if (prev) for (const k of prev.keys()) rank.set(k, rank.size)
  const r = (k: string) => rank.get(k) ?? Number.MAX_SAFE_INTEGER
  return [...items].sort(
    (a, b) => BUBBLE_PRIORITY[b.kind] - BUBBLE_PRIORITY[a.kind] || r(a.key) - r(b.key) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
}

/**
 * Lays out bubbles in priority order. `prev` (the last result) adds hysteresis so moving speakers
 * do not make bubbles jump between slots or flip sides. Returns one placement per input key.
 */
export function layoutBubbles(
  items: readonly BubbleBox[],
  vp: Viewport,
  prev?: ReadonlyMap<string, Placement>,
  opts: Partial<LayoutOptions> = {},
): Map<string, Placement> {
  const o = { ...DEFAULT_LAYOUT, ...opts }
  const out = new Map<string, Placement>()
  const placed: { key: string; rect: Rect }[] = []
  const clickSpeakers = new Set(items.filter((b) => isClickable(b.kind)).map((b) => b.speakerId))

  for (const b of order(items, prev)) {
    const clickable = isClickable(b.kind)
    const last = prev?.get(b.key)
    const anchorX = b.left + b.w / 2
    const anchorY = b.top + b.h

    // Ambient: never next to the same speaker's clickable bubble, never for a speaker outside the free area.
    if (!clickable && (clickSpeakers.has(b.speakerId) || anchorX < vp.left || anchorX > vp.right || anchorY < vp.top || anchorY > vp.bottom)) {
      out.set(b.key, HIDDEN)
      continue
    }

    const wide = b.w >= vp.right - vp.left
    // Horizontal clamp into the free area (left-aligned when wider than it).
    const baseDx = wide ? vp.left - b.left : clamp(b.left, vp.left, vp.right - b.w) - b.left
    const insideX = (dx: number) => (wide ? Math.abs(dx - baseDx) < 0.5 : b.left + dx >= vp.left - 0.5 && b.left + dx + b.w <= vp.right + 0.5)
    // Vertical range that keeps the bubble on screen.
    const dyMin = vp.top - b.top
    const dyMax = Math.max(dyMin, vp.bottom - (b.top + b.h))
    const rectAt = (dx: number, dy: number): Rect => ({ l: b.left + dx, t: b.top + dy, r: b.left + dx + b.w, b: b.top + dy + b.h })
    const pad = !clickable && (!last || last.hidden) ? o.gap + o.showPad : o.gap
    // A kept slot may sit exactly on the gap boundary; 1px of slack stops sub-pixel speaker motion
    // from invalidating it (and swapping it for a mirror-image slot).
    const keepable = (dx: number, dy: number) => placed.every((p) => !overlaps(rectAt(dx, dy), p.rect, pad - 1))
    const lowest = clickable ? dyMin : Math.max(dyMin, -o.maxAmbientLift)
    const allowed = (dy: number) => dy >= lowest - 0.5 && dy <= dyMax + 0.5

    // Walk upward (or downward) past whatever is in the way until the rect is free.
    const vertical = (dx: number, dir: -1 | 1): number | null => {
      let dy = clamp(0, dyMin, dyMax)
      for (let i = 0; i <= placed.length; i++) {
        if (!allowed(dy)) return null
        const rc = rectAt(dx, dy)
        const hits = placed.filter((p) => overlaps(rc, p.rect, pad))
        if (hits.length === 0) return dy
        dy = dir < 0 ? Math.min(...hits.map((p) => p.rect.t - pad - (b.top + b.h))) : Math.max(...hits.map((p) => p.rect.b + pad - b.top))
      }
      return null
    }

    // Keep the side (above/below) a bubble was on; only switch when that side has no room.
    const wasBelow = !!last && !last.hidden && last.dy > 0.5
    const dirs: (-1 | 1)[] = clickable ? (wasBelow ? [1, -1] : [-1, 1]) : [-1]
    const best = (dx: number): number | null => {
      for (const d of dirs) {
        const dy = vertical(dx, d)
        if (dy !== null) return dy
      }
      return null
    }

    let slot: { dx: number; dy: number } | null = null
    const dy0 = best(baseDx)
    if (dy0 !== null) slot = { dx: baseDx, dy: dy0 }
    else if (clickable) {
      // Sideways: just left or right of each bubble in the way, nearest first.
      let cost = Infinity
      for (const p of placed) {
        for (const x of [p.rect.l - pad - b.w, p.rect.r + pad]) {
          const dx = x - b.left
          if (!insideX(dx)) continue
          const dy = best(dx)
          if (dy === null) continue
          const c = Math.abs(dx - baseDx) + Math.abs(dy)
          if (c < cost) {
            cost = c
            slot = { dx, dy }
          }
        }
      }
    }

    // Hysteresis: keep the previous slot while it is still valid and not clearly worse than the new
    // one (cost = distance from the natural spot), and never flip above/below or left/right for a
    // near tie (two bubbles of one speaker are exact mirror candidates).
    if (slot && last && !last.hidden && (last.dx !== slot.dx || last.dy !== slot.dy) && insideX(last.dx) && allowed(last.dy) && keepable(last.dx, last.dy)) {
      const cost = (dx: number, dy: number) => Math.abs(dx - baseDx) + Math.abs(dy)
      const near = Math.abs(last.dx - slot.dx) <= o.hysteresis && Math.abs(last.dy - slot.dy) <= o.hysteresis
      const sideFlip = slot.dy !== 0 && last.dy !== 0 && Math.sign(slot.dy) !== Math.sign(last.dy)
      if (near || sideFlip || cost(last.dx, last.dy) <= cost(slot.dx, slot.dy) + o.hysteresis) slot = { dx: last.dx, dy: last.dy }
    }

    if (!slot) {
      if (!isForced(b.kind)) {
        out.set(b.key, HIDDEN)
        continue
      }
      // No free slot at all: stay on screen as high as possible; z-order keeps the higher one readable.
      slot = { dx: baseDx, dy: dyMin }
    }
    out.set(b.key, { dx: slot.dx, dy: slot.dy, hidden: false, stem: 0, stemX: 0 })
    placed.push({ key: b.key, rect: rectAt(slot.dx, slot.dy) })
  }

  // Stems for lifted bubbles, skipped when the line would run through another bubble.
  for (const b of items) {
    const p = out.get(b.key)
    if (!p || p.hidden || -p.dy <= o.minStem) continue
    const l = b.left + p.dx
    const x = b.left + b.w / 2
    if (x < l + 6 || x > l + b.w - 6) continue
    const top = b.top + p.dy + b.h
    const bottom = b.top + b.h
    const blocked = placed.some((q) => q.key !== b.key && x >= q.rect.l && x <= q.rect.r && q.rect.t < bottom && q.rect.b > top)
    if (!blocked) out.set(b.key, { ...p, stem: bottom - top, stemX: x - l })
  }
  return out
}
