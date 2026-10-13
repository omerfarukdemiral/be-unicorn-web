// Screen-space placement of world bubbles (pure, no DOM). Input: each visible bubble's natural
// screen rect (where drei <Html> puts it above its speaker) + priority. Output: a pixel offset per
// bubble, or `hidden`. Higher priority is placed first and never moves for a lower one:
// open bubble (5) > decision / visitor (3) > desk / staff / concept (2) > conceptIcon / reflection (1) > ambient (0).
// - Forced bubbles (decision, visitor, desk, staff, concept) are always shown: lifted, pushed down,
//   stacked into the first free gap from the top of the free area, moved sideways, or (no room at all)
//   pinned to the top of the free area; while an expanded bubble fills the screen they wait hidden instead.
// - Concept icons and reflections try the same slots but are hidden when none is free.
// - Ambient lines are only lifted a little; otherwise hidden until the space clears.
// - Reflections ("Seçtin: …") are read-only: they never take a slot an actionable bubble needs, step out of the way
//   of any expanded bubble, and never sit on another bubble's stem.
// Every bubble occupies its box plus the tail under it (`tail`), so the gap is measured from the tail tip.
// A stem (thin line back to the speaker's head) is drawn for lifted bubbles, unless another bubble
// sits between the bubble and its speaker. A displaced forced bubble's stem may run diagonally.

export type BubbleKind = 'decision' | 'visitor' | 'desk' | 'staff' | 'person' | 'concept' | 'conceptIcon' | 'reflection' | 'ambient'

export const BUBBLE_PRIORITY: Record<BubbleKind, number> = {
  decision: 3,
  visitor: 3,
  desk: 2,
  staff: 2,
  person: 2,
  concept: 2,
  conceptIcon: 1,
  reflection: 1,
  ambient: 0,
}

/** Priority of the bubble the player has expanded (ui.bubbleOpen): placed first, never hidden. */
export const OPEN_PRIORITY = 5

/** Takes clicks (ambient lines and reflections are read-only). */
export const isClickable = (k: BubbleKind): boolean => k !== 'ambient' && k !== 'reflection'

/** Keeps an anchor when its speaker is gone (desk → founder → centre) instead of hiding; everything but ambient lines. */
export const isAnchored = (k: BubbleKind): boolean => k !== 'ambient'

/** Must stay visible no matter what (falls back to the top of the free area). */
const isForced = (k: BubbleKind): boolean => k === 'decision' || k === 'visitor' || k === 'desk' || k === 'staff' || k === 'person' || k === 'concept'

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
  /** Screen rects bubbles must never cover (the start call, the strip floating over a sheet…), client px. */
  obstacles?: readonly { left: number; top: number; right: number; bottom: number }[]
  /**
   * Scene juice (release banner, "+N" floats), client px. Read-only bubbles (reflection, ambient, concept icon) keep off
   * it; an actionable bubble keeps its place by the head and the juice steps aside instead (yieldToBubbles).
   */
  juice?: readonly { left: number; top: number; right: number; bottom: number }[]
}

/**
 * Height an open bubble may take: from the top of the free area down to the first obstacle below it (the dock, the
 * runway strip), else to the bottom. A taller card scrolls its option list inside this (landscape phone, 844 x 390:
 * the payday options used to run under the strip and the dock).
 */
export function freeBubbleHeight(vp: Viewport, minTop = 40): number {
  let bottom = vp.bottom
  for (const o of vp.obstacles ?? []) if (o.top > vp.top + minTop && o.top < bottom) bottom = o.top - 4
  // Floor: an obstacle far off to the side must not squeeze the list to nothing.
  return Math.max(MIN_FREE_H, bottom - vp.top)
}

const MIN_FREE_H = 120

export interface Placement {
  dx: number
  dy: number
  hidden: boolean
  /** Stem length below the bubble, px (0 = no stem). */
  stem: number
  /** Stem x from the bubble's left edge, px. */
  stemX: number
  /** Stem tilt, radians (0 = straight down; CSS rotate, clockwise positive). */
  stemAngle?: number
  /** Lifted with no stem back to the head (another bubble sits between): the tail is hidden so it never points at that bubble. */
  detached?: boolean
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
  /** How far the tail reaches below a bubble's box, px; it occupies space like the box itself. */
  tail: number
}

/** Per-call inputs that are not tuning knobs. */
export interface LayoutInputs {
  /** Key of the expanded bubble (ui.bubbleOpen): priority OPEN_PRIORITY. */
  openKey?: string | null
}

// BubbleTail is a 10px square turned 45° on the bottom edge: its tip hangs ~7px below the box. The 8px gap is
// measured from that tip (QA: two stacked "ayrılıyor" pills, the upper tail painted onto the lower pill at 8px).
export const DEFAULT_LAYOUT: LayoutOptions = { gap: 8, maxAmbientLift: 56, hysteresis: 14, showPad: 10, minStem: 8, tail: 7 }

/** A bubble moved beside the one in its way sits this far above the head, so its diagonal stem reads as a link. */
const SIDE_LIFT = 28

const HIDDEN: Placement = { dx: 0, dy: 0, hidden: true, stem: 0, stemX: 0 }

interface Rect {
  l: number
  t: number
  r: number
  b: number
}

const overlaps = (a: Rect, b: Rect, pad: number): boolean => a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Layout priority of one bubble (the open one outranks everything). */
export const priorityOf = (b: Pick<BubbleBox, 'key' | 'kind'>, openKey?: string | null): number =>
  openKey != null && b.key === openKey ? OPEN_PRIORITY : BUBBLE_PRIORITY[b.kind]

/** Placement order: priority first, then the previous order (stability), then key. */
function order(items: readonly BubbleBox[], prev: ReadonlyMap<string, Placement> | undefined, openKey: string | null | undefined): BubbleBox[] {
  const rank = new Map<string, number>()
  if (prev) for (const k of prev.keys()) rank.set(k, rank.size)
  const r = (k: string) => rank.get(k) ?? Number.MAX_SAFE_INTEGER
  return [...items].sort(
    (a, b) => priorityOf(b, openKey) - priorityOf(a, openKey) || r(a.key) - r(b.key) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
}

/** Does the segment (x1,y1)→(x2,y2) cross the rect? Sampled; stems are short and rects are big. The rect's rounded
 *  corners (CORNER px) do not count: a stem grazing a pill's corner still reads as its own. */
const CORNER = 3
function segmentHits(x1: number, y1: number, x2: number, y2: number, q: Rect): boolean {
  const n = 16
  for (let i = 1; i < n; i++) {
    const x = x1 + ((x2 - x1) * i) / n
    const y = y1 + ((y2 - y1) * i) / n
    if (x > q.l + CORNER && x < q.r - CORNER && y > q.t + CORNER && y < q.b - CORNER) return true
  }
  return false
}

/**
 * Lays out bubbles in priority order. `prev` (the last result) adds hysteresis so moving speakers
 * do not make bubbles jump between slots or flip sides. Returns one placement per input key.
 */
export function layoutBubbles(
  items: readonly BubbleBox[],
  vp: Viewport,
  prev?: ReadonlyMap<string, Placement>,
  opts: Partial<LayoutOptions> & LayoutInputs = {},
): Map<string, Placement> {
  const o = { ...DEFAULT_LAYOUT, ...opts }
  const out = new Map<string, Placement>()
  // `rect` is the space taken (box + tail), `body` the box alone: a stem may pass a tail, never a box.
  const placed: { key: string; rect: Rect; body: Rect }[] = (vp.obstacles ?? []).map((r, i) => {
    const rect = { l: r.left, t: r.top, r: r.right, b: r.bottom }
    return { key: `@obstacle${i}`, rect, body: rect }
  })
  // Ambient lines step aside for any other bubble of the same speaker.
  const clickSpeakers = new Set(items.filter((b) => isAnchored(b.kind)).map((b) => b.speakerId))
  const openPlaced = opts.openKey != null && items.some((b) => b.key === opts.openKey)
  // Juice and the stems of lifted bubbles placed so far: read-only bubbles (reflection, ambient, concept icon) never
  // sit on one.
  const stems: { key: string; rect: Rect; body: Rect }[] = (vp.juice ?? []).map((r, i) => {
    const rect = { l: r.left, t: r.top, r: r.right, b: r.bottom }
    return { key: `@juice${i}`, rect, body: rect }
  })

  for (const b of order(items, prev, opts.openKey)) {
    const clickable = isAnchored(b.kind)
    const last = prev?.get(b.key)
    const anchorX = b.left + b.w / 2
    const anchorY = b.top + b.h

    // Ambient: never next to the same speaker's clickable bubble, never for a speaker outside the free area.
    if (!clickable && (clickSpeakers.has(b.speakerId) || anchorX < vp.left || anchorX > vp.right || anchorY < vp.top || anchorY > vp.bottom)) {
      out.set(b.key, HIDDEN)
      continue
    }
    // A reflection waits while the player has a bubble expanded (QA: "Seçtin" laid out under an open desk card's stem).
    if (b.kind === 'reflection' && openPlaced) {
      out.set(b.key, HIDDEN)
      continue
    }
    // What this bubble must keep clear of: every placed box (+ tail), and the stems and juice too unless it is forced.
    const others = isForced(b.kind) ? placed : [...placed, ...stems]
    // Box + tail: the space the bubble takes.
    const h = b.h + o.tail

    const wide = b.w >= vp.right - vp.left
    // Horizontal clamp into the free area (left-aligned when wider than it).
    const baseDx = wide ? vp.left - b.left : clamp(b.left, vp.left, vp.right - b.w) - b.left
    const insideX = (dx: number) => (wide ? Math.abs(dx - baseDx) < 0.5 : b.left + dx >= vp.left - 0.5 && b.left + dx + b.w <= vp.right + 0.5)
    // Vertical range that keeps the bubble on screen.
    const dyMin = vp.top - b.top
    // (The tail may hang into the free area's margin: the box is what must stay on screen.)
    const dyMax = Math.max(dyMin, vp.bottom - (b.top + b.h))
    const rectAt = (dx: number, dy: number): Rect => ({ l: b.left + dx, t: b.top + dy, r: b.left + dx + b.w, b: b.top + dy + h })
    const pad = !clickable && (!last || last.hidden) ? o.gap + o.showPad : o.gap
    // A kept slot may sit exactly on the gap boundary; 1px of slack stops sub-pixel speaker motion
    // from invalidating it (and swapping it for a mirror-image slot).
    const keepable = (dx: number, dy: number) => others.every((p) => !overlaps(rectAt(dx, dy), p.rect, pad - 1))
    const lowest = clickable ? dyMin : Math.max(dyMin, -o.maxAmbientLift)
    const allowed = (dy: number) => dy >= lowest - 0.5 && dy <= dyMax + 0.5

    // Walk upward (or downward) past whatever is in the way until the rect is free.
    const vertical = (dx: number, dir: -1 | 1, from = 0): number | null => {
      let dy = clamp(from, dyMin, dyMax)
      for (let i = 0; i <= others.length; i++) {
        if (!allowed(dy)) return null
        const rc = rectAt(dx, dy)
        const hits = others.filter((p) => overlaps(rc, p.rect, pad))
        if (hits.length === 0) return dy
        dy = dir < 0 ? Math.min(...hits.map((p) => p.rect.t - pad - (b.top + h))) : Math.max(...hits.map((p) => p.rect.b + pad - b.top))
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

    // A lifted bubble whose line back to the head would cross another bubble reads as that bubble's
    // (QA: "Mira boşta" tail resting on "Ebru ayrılıyor"). Clickables prefer a slot with a clear stem.
    const stemClear = (dx: number, dy: number): boolean => {
      if (-dy <= o.minStem) return true
      const rc = rectAt(dx, dy)
      const sx = clamp(anchorX, rc.l + 6, rc.r - 6)
      return placed.every((q) => !segmentHits(sx, b.top + dy + b.h, anchorX, anchorY, q.body))
    }
    // Sideways: just left or right of each bubble in the way, nearest first. With `clear`, only slots lifted far enough
    // to get a (diagonal) stem that reaches the head without crossing another bubble.
    const sideways = (clear: boolean): { dx: number; dy: number } | null => {
      let cost = Infinity
      let found: { dx: number; dy: number } | null = null
      for (const p of others) {
        for (const x of [p.rect.l - pad - b.w, p.rect.r + pad]) {
          const dx = x - b.left
          if (!insideX(dx)) continue
          const dy = clear ? vertical(dx, -1, -SIDE_LIFT) : best(dx)
          if (dy === null || (clear && (-dy <= o.minStem || !stemClear(dx, dy)))) continue
          const c = Math.abs(dx - baseDx) + Math.abs(dy)
          if (c < cost) {
            cost = c
            found = { dx, dy }
          }
        }
      }
      return found
    }

    let slot: { dx: number; dy: number } | null = null
    const dy0 = best(baseDx)
    if (dy0 !== null) {
      slot = { dx: baseDx, dy: dy0 }
      // Stacked on top of another bubble: beside it (diagonal stem to the head) when that stays near.
      if (clickable && isForced(b.kind) && !stemClear(baseDx, dy0)) {
        const side = sideways(true)
        if (side && Math.abs(side.dx - baseDx) + Math.abs(side.dy) <= Math.abs(dy0) + b.w * 1.5) slot = side
      }
    } else if (clickable) slot = sideways(true) ?? sideways(false)

    // Hysteresis: keep the previous slot while it is still valid and not clearly worse than the new
    // one (cost = distance from the natural spot), and never flip above/below or left/right for a
    // near tie (two bubbles of one speaker are exact mirror candidates).
    if (
      slot &&
      last &&
      !last.hidden &&
      (last.dx !== slot.dx || last.dy !== slot.dy) &&
      insideX(last.dx) &&
      allowed(last.dy) &&
      keepable(last.dx, last.dy) &&
      // Never hold on to a stacked slot (stem blocked) when the new one links back to the head.
      (!clickable || stemClear(last.dx, last.dy) || !stemClear(slot.dx, slot.dy))
    ) {
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
      // No slot next to the head: stack into the first free gap from the top of the free area, in the
      // bubble's own column, then flush left, then flush right.
      const cols = wide ? [baseDx] : [baseDx, vp.left - b.left, vp.right - b.w - b.left]
      for (const dx of cols) {
        let dy = dyMin
        for (let i = 0; i <= others.length && dy <= dyMax + 0.5; i++) {
          const hits = others.filter((p) => overlaps(rectAt(dx, dy), p.rect, pad))
          if (hits.length === 0) {
            slot = { dx, dy }
            break
          }
          dy = Math.max(...hits.map((p) => p.rect.b + pad - b.top))
        }
        if (slot) break
      }
      if (!slot && openPlaced && b.key !== opts.openKey) {
        // Truly full because the player expanded a bubble (time is held): wait behind it, never under it.
        out.set(b.key, HIDDEN)
        continue
      }
      // Truly full: stay on screen as high as possible; z-order keeps the higher one readable.
      slot ??= { dx: baseDx, dy: dyMin }
    }
    out.set(b.key, { dx: slot.dx, dy: slot.dy, hidden: false, stem: 0, stemX: 0 })
    const rect = rectAt(slot.dx, slot.dy)
    placed.push({ key: b.key, rect, body: { ...rect, b: rect.b - o.tail } })
    if (clickable && -slot.dy > o.minStem) {
      const l = b.left + slot.dx
      const sx = clamp(anchorX, l + 6, l + b.w - 6)
      const stem = { l: Math.min(sx, anchorX) - 2, t: b.top + slot.dy + b.h, r: Math.max(sx, anchorX) + 2, b: anchorY }
      stems.push({ key: `@stem:${b.key}`, rect: stem, body: stem })
    }
  }

  // Stems for lifted bubbles, skipped when the line would run through another bubble. A forced bubble
  // that was moved sideways keeps a (diagonal) stem from its bottom edge to the head.
  for (const b of items) {
    const p = out.get(b.key)
    if (!p || p.hidden || -p.dy <= o.minStem) continue
    const l = b.left + p.dx
    const x = b.left + b.w / 2
    const top = b.top + p.dy + b.h
    const bottom = b.top + b.h
    const inside = x >= l + 6 && x <= l + b.w - 6
    if (!inside && !isForced(b.kind)) {
      out.set(b.key, { ...p, detached: true })
      continue
    }
    const sx = clamp(x, l + 6, l + b.w - 6)
    const blocked = placed.some((q) => q.key !== b.key && (inside ? x >= q.body.l && x <= q.body.r && q.body.t < bottom && q.body.b > top : segmentHits(sx, top, x, bottom, q.body)))
    if (blocked) {
      out.set(b.key, { ...p, detached: true })
      continue
    }
    const angle = inside ? 0 : Math.atan2(-(x - sx), bottom - top)
    out.set(b.key, { ...p, stem: Math.hypot(x - sx, bottom - top), stemX: sx - l, stemAngle: angle })
  }
  return out
}
