// Screen-space placement of world bubbles (pure, no DOM). Input: each visible bubble's natural
// screen rect (where drei <Html> puts it above its speaker) + priority. Output: a pixel offset per
// bubble, or `hidden`. Higher priority is placed first and never moves for a lower one:
// decision > concept > conceptIcon > ambient. Lower bubbles are lifted straight up (the stem keeps
// them tied to the speaker); ambient lines that do not fit are hidden until the space clears.
// Clickable bubbles are always placed (lifted, or pushed down below the others if the top is full).

export type BubbleKind = 'decision' | 'concept' | 'conceptIcon' | 'ambient'

export const BUBBLE_PRIORITY: Record<BubbleKind, number> = { decision: 3, concept: 2, conceptIcon: 1, ambient: 0 }

export const isClickable = (k: BubbleKind): boolean => k !== 'ambient'

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
}

export const DEFAULT_LAYOUT: LayoutOptions = { gap: 6, maxAmbientLift: 56, hysteresis: 14, showPad: 10 }

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
  const seen = prev ? [...prev.keys()] : []
  const rank = (k: string) => {
    const i = seen.indexOf(k)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return [...items].sort(
    (a, b) => BUBBLE_PRIORITY[b.kind] - BUBBLE_PRIORITY[a.kind] || rank(a.key) - rank(b.key) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
}

/**
 * Lays out bubbles in priority order. `prev` (the last result) adds hysteresis so moving speakers
 * do not make bubbles jump between slots. Returns one placement per input key.
 */
export function layoutBubbles(
  items: readonly BubbleBox[],
  vp: Viewport,
  prev?: ReadonlyMap<string, Placement>,
  opts: Partial<LayoutOptions> = {},
): Map<string, Placement> {
  const o = { ...DEFAULT_LAYOUT, ...opts }
  const out = new Map<string, Placement>()
  const placed: Rect[] = []
  const clickSpeakers = new Set(items.filter((b) => isClickable(b.kind)).map((b) => b.speakerId))

  for (const b of order(items, prev)) {
    const clickable = isClickable(b.kind)
    const last = prev?.get(b.key)
    const anchorX = b.left + b.w / 2
    const anchorY = b.top + b.h

    // Ambient: never next to the same speaker's clickable bubble, never for an off-screen speaker.
    if (!clickable && (clickSpeakers.has(b.speakerId) || anchorX < vp.left || anchorX > vp.right || anchorY < vp.top || anchorY > vp.bottom + b.h)) {
      out.set(b.key, { dx: 0, dy: 0, hidden: true })
      continue
    }

    // Horizontal clamp into the free area (left-aligned when wider than it).
    const dx = b.w >= vp.right - vp.left ? vp.left - b.left : clamp(b.left, vp.left, vp.right - b.w) - b.left
    const l = b.left + dx
    const r = l + b.w
    // Vertical range that keeps the bubble on screen.
    const dyMin = vp.top - b.top
    const dyMax = Math.max(dyMin, vp.bottom - (b.top + b.h))
    const rectAt = (dy: number): Rect => ({ l, t: b.top + dy, r, b: b.top + dy + b.h })
    const pad = !clickable && (!last || last.hidden) ? o.gap + o.showPad : o.gap
    const free = (dy: number) => placed.every((p) => !overlaps(rectAt(dy), p, pad))
    const lowest = clickable ? dyMin : Math.max(dyMin, -o.maxAmbientLift)
    const allowed = (dy: number) => dy >= lowest - 0.5 && dy <= dyMax + 0.5

    // Walk upward (or downward) past whatever is in the way until the rect is free.
    const search = (dir: -1 | 1): number | null => {
      let dy = clamp(0, dyMin, dyMax)
      for (let i = 0; i <= placed.length; i++) {
        if (!allowed(dy)) return null
        const rc = rectAt(dy)
        const hits = placed.filter((p) => overlaps(rc, p, pad))
        if (hits.length === 0) return dy
        dy = dir < 0 ? Math.min(...hits.map((p) => p.t - pad - (b.top + b.h))) : Math.max(...hits.map((p) => p.b + pad - b.top))
      }
      return null
    }

    let dy = search(-1)
    if (dy === null && clickable) dy = search(1)
    // Hysteresis: keep the previous slot while it is still valid and close enough to the ideal.
    if (dy !== null && last && !last.hidden && last.dy !== dy && allowed(last.dy) && free(last.dy) && Math.abs(last.dy) <= Math.abs(dy) + o.hysteresis) {
      dy = last.dy
    }
    if (dy === null) {
      if (!clickable) {
        out.set(b.key, { dx: 0, dy: 0, hidden: true })
        continue
      }
      // No free slot at all: stay on screen as high as possible; z-order keeps the higher one readable.
      dy = dyMin
    }
    out.set(b.key, { dx, dy, hidden: false })
    placed.push(rectAt(dy))
  }
  return out
}
