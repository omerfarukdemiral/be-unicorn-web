// DOM side of the bubble layout (no three/drei imports so it can be unit-tested with fake elements).
// The registry holds one entry per managed <BubbleAnchor>. `runLayout` measures every bubble and
// runs layoutBubbles (~10×/s); `applyFrame` eases each bubble to its slot and writes transform,
// stem and visibility straight to the DOM every frame (writes only, no layout reads).
import { layoutBubbles, type BubbleBox, type BubbleKind, type Placement, type Viewport } from './bubbleLayout'

/** Minimal element surface the driver touches (HTMLElement in the app, plain objects in tests). */
export interface BubbleEl {
  style: Partial<Record<'transform' | 'transition' | 'opacity' | 'visibility' | 'display' | 'height' | 'left' | 'pointerEvents', string>>
}
export interface MeasuredEl extends BubbleEl {
  getBoundingClientRect(): { left: number; top: number; width: number; height: number }
  offsetWidth: number
  offsetHeight: number
  getAnimations?: (opts?: { subtree?: boolean }) => { currentTime: number | null | CSSNumberish; play(): void }[]
}

export interface Entry {
  key: string
  kind: BubbleKind
  speakerId: string
  /** Bubble content wrapper (inner div). */
  el: MeasuredEl
  stem: BubbleEl
  /** drei's wrapper divs: hidden together with the bubble so they never block clicks. */
  wraps: BubbleEl[]
  /** Speaker is in the office (not walked out). */
  speakerVisible: boolean
  /** Frames since mount: drei positions the element on its first frame, so skip measuring until then. */
  frames: number
  /** Eased offset (moves toward the target placement every frame). */
  cur: { dx: number; dy: number }
  /** Offset actually in the DOM transform (cur, rounded when written). */
  off: { dx: number; dy: number }
  /** Last measured size, px. */
  w: number
  h: number
  shown: boolean
  written: string
  /** Ambient only: when the line (re)started its fade-in / started waiting for space (ms). */
  shownAt: number
  waitingSince: number
  /** Ambient only: finished (faded out or never found space); stays hidden, not measured. */
  done: boolean
}

export class BubbleLayoutRegistry {
  entries = new Map<string, Entry>()
  placements = new Map<string, Placement>()
  dirty = true
  lastLayout = 0
}

export const LAYOUT_INTERVAL_MS = 100
/** Matches the `animate-ambient` CSS animation (3 s fade in, hold, fade out). */
export const AMBIENT_VISIBLE_MS = 3_000
/** An ambient line that cannot find space within this long is dropped for good. */
export const AMBIENT_WAIT_MS = 1_000
const HIDDEN_T = 'opacity 160ms ease-out, visibility 0s linear 160ms'
const SHOWN_T = 'opacity 160ms ease-out, visibility 0s'

export function createEntry(
  init: Pick<Entry, 'key' | 'kind' | 'speakerId' | 'el' | 'stem'> & { wraps?: BubbleEl[]; interactive?: boolean },
  now: number,
): Entry {
  const wraps = init.wraps ?? []
  for (const w of wraps) w.style.pointerEvents = 'none'
  init.el.style.pointerEvents = init.interactive ? 'auto' : 'none'
  return {
    key: init.key,
    kind: init.kind,
    speakerId: init.speakerId,
    el: init.el,
    stem: init.stem,
    wraps,
    speakerVisible: true,
    frames: 0,
    cur: { dx: 0, dy: 0 },
    off: { dx: 0, dy: 0 },
    w: 0,
    h: 0,
    shown: false,
    written: '',
    shownAt: 0,
    waitingSince: now,
    done: false,
  }
}

/** Natural (unshifted) boxes of every bubble that takes part in the layout. Reads only. */
export function measure(reg: BubbleLayoutRegistry): BubbleBox[] {
  const out: BubbleBox[] = []
  for (const e of reg.entries.values()) {
    if (!e.speakerVisible || e.frames < 2 || e.done) continue
    const r = e.el.getBoundingClientRect()
    const w = e.el.offsetWidth
    const h = e.el.offsetHeight
    e.w = w
    e.h = h
    if (w === 0 || h === 0) continue
    // Natural box = measured box minus the offset we applied ourselves (transforms keep the center).
    const cx = r.left + r.width / 2 - e.off.dx
    const cy = r.top + r.height / 2 - e.off.dy
    out.push({ key: e.key, speakerId: e.speakerId, kind: e.kind, left: cx - w / 2, top: cy - h / 2, w, h })
  }
  return out
}

/**
 * The bubble's anchor jumped by (`jumpX`, `jumpY`) screen px (new speaker, or the speaker's
 * position just appeared). Offset the bubble by the opposite amount right away so it stays where it
 * is on screen; `applyFrame` then eases it to its new slot instead of snapping.
 */
export function shiftBubble(e: Entry, jumpX: number, jumpY: number): void {
  if (!e.shown || !Number.isFinite(jumpX) || !Number.isFinite(jumpY)) return
  e.cur.dx -= jumpX
  e.cur.dy -= jumpY
  const dx = Math.round(e.cur.dx * 10) / 10
  const dy = Math.round(e.cur.dy * 10) / 10
  e.el.style.transform = `translate(${dx}px, calc(-50% + ${dy}px))`
  e.off.dx = dx
  e.off.dy = dy
  e.written = ''
  e.stem.style.display = 'none'
}

/** Measures and lays out when due (dirty or every LAYOUT_INTERVAL_MS). */
export function runLayout(reg: BubbleLayoutRegistry, vp: () => Viewport, now: number): void {
  if (!reg.dirty && now - reg.lastLayout < LAYOUT_INTERVAL_MS) return
  reg.dirty = false
  reg.lastLayout = now
  reg.placements = layoutBubbles(measure(reg), vp(), reg.placements)
}

function setShown(e: Entry, show: boolean): void {
  e.shown = show
  const v = show ? 'visible' : 'hidden'
  e.el.style.transition = show ? SHOWN_T : HIDDEN_T
  e.el.style.opacity = show ? '1' : '0'
  e.el.style.visibility = v
  for (const w of e.wraps) w.style.visibility = v
}

/** Restart the ambient fade so a line that waited for space plays its full 3 s. */
function restartAnimations(el: MeasuredEl): void {
  for (const a of el.getAnimations?.({ subtree: true }) ?? []) {
    a.currentTime = 0
    a.play()
  }
}

/** Eases every bubble toward its placement and writes the result. Writes only. */
export function applyFrame(reg: BubbleLayoutRegistry, dt: number, now: number): void {
  const k = 1 - Math.exp(-Math.min(dt, 0.1) * 14)
  for (const e of reg.entries.values()) {
    if (++e.frames === 2) reg.dirty = true
    const ambient = e.kind === 'ambient'
    if (ambient && !e.done) {
      if (e.shown && now - e.shownAt >= AMBIENT_VISIBLE_MS) e.done = true
      else if (!e.shown && now - e.waitingSince >= AMBIENT_WAIT_MS) e.done = true
      if (e.done) reg.dirty = true
    }
    const p = reg.placements.get(e.key)
    const show = e.speakerVisible && !e.done && !!p && !p.hidden
    if (show && p) {
      if (!e.shown) {
        e.cur.dx = p.dx
        e.cur.dy = p.dy
      } else {
        e.cur.dx += (p.dx - e.cur.dx) * k
        e.cur.dy += (p.dy - e.cur.dy) * k
        if (Math.abs(p.dx - e.cur.dx) < 0.3) e.cur.dx = p.dx
        if (Math.abs(p.dy - e.cur.dy) < 0.3) e.cur.dy = p.dy
      }
    }
    if (show !== e.shown) {
      setShown(e, show)
      if (ambient) {
        if (show) {
          e.shownAt = now
          restartAnimations(e.el)
        } else e.waitingSince = now
      }
    }
    if (!show || !p) continue
    const dx = Math.round(e.cur.dx * 10) / 10
    const dy = Math.round(e.cur.dy * 10) / 10
    // Stem follows the eased position: from the bubble's bottom down to the speaker's head.
    const lift = p.stem > 0 ? Math.round(-dy) : 0
    const stemX = lift > 0 ? Math.round(Math.min(Math.max(6, e.w - 6), Math.max(6, p.stemX + p.dx - dx))) : 0
    const sig = `${dx},${dy},${lift},${stemX}`
    if (sig === e.written) continue
    e.written = sig
    e.el.style.transform = `translate(${dx}px, calc(-50% + ${dy}px))`
    e.off.dx = dx
    e.off.dy = dy
    const s = e.stem.style
    if (lift > 0) {
      s.display = 'block'
      s.height = `${lift}px`
      s.left = `${stemX}px`
    } else if (s.display !== 'none') s.display = 'none'
  }
}
