// DOM side of the bubble layout (no three/drei imports so it can be unit-tested with fake elements).
// The registry holds one entry per managed <BubbleAnchor>. `runLayout` measures every bubble and
// runs layoutBubbles (~10×/s); `applyFrame` eases each bubble to its slot and writes transform,
// stem and visibility straight to the DOM every frame (writes only, no layout reads).
import { isAnchored, layoutBubbles, type BubbleBox, type BubbleKind, type Placement, type Viewport } from './bubbleLayout'

/** Where a speaker's head is (mirrors sceneRegistry's SpeakerPos; kept structural for tests). */
export interface AnchorPos {
  x: number
  y: number
  z: number
  /** False while the character is outside (walked out of the door). */
  visible: boolean
  /** On the way somewhere (or queued at the door). */
  walking?: boolean
  /** A walking visitor's reserved spot (sceneRegistry.SpeakerPos.dest). */
  dest?: { x: number; z: number } | null
}

/**
 * Which head a bubble floats above. Ambient lines follow their speaker and hide while the speaker is
 * outside. Any other bubble (decision, desk, staff, visitor, reflection…) must never disappear: if its
 * speaker is gone or outside (e.g. the visitor already left), it moves to the founder's desk, then the
 * founder, and when neither is there, to the scene centre (`pos: null` = use the anchor's fallback
 * point). `visible` is always true for those. `anchorId` is the head the bubble actually sits above
 * ('desk' / 'founder' after the fallback, CENTER_ANCHOR for the scene centre): layout groups bubbles
 * by it, so the founder's own ambient line is suppressed while a moved decision floats above them.
 * A visitor's own ask (decision, pitch) stays on that visitor while they wait at the door or walk in: it rides the
 * door instead of floating over the desk with a stem to nobody (QA: "Bora · Yatırımcı sunum bekliyor" over the desk
 * while Bora stood in the doorway).
 */
export function resolveAnchor(
  speakerId: string,
  kind: BubbleKind | undefined,
  positions: ReadonlyMap<string, AnchorPos>,
): { pos: AnchorPos | null; visible: boolean; anchorId: string; ahead?: true } {
  const own = positions.get(speakerId)
  if (own && kind && rideVisitor(kind) && own.dest && (own.walking || !own.visible)) {
    // Still walking in: wait above the spot they walk to (a pill riding a walker slides out from under the thumb, QA:
    // 20 missed taps on pills over visitors still crossing the room). No stem (nobody is under it yet).
    return { pos: { x: own.dest.x, y: own.y, z: own.dest.z, visible: true }, visible: true, anchorId: speakerId, ahead: true }
  }
  if (own?.visible) return { pos: own, visible: true, anchorId: speakerId }
  if (own && kind && rideVisitor(kind)) return { pos: own, visible: true, anchorId: speakerId }
  const founder = positions.get('founder')
  if (kind && isAnchored(kind)) {
    for (const id of ANCHOR_FALLBACK) {
      const p = id === speakerId ? undefined : positions.get(id)
      if (p?.visible) return { pos: p, visible: true, anchorId: id }
    }
    return { pos: null, visible: true, anchorId: CENTER_ANCHOR }
  }
  const p = own ?? founder ?? null
  return { pos: p, visible: !p || p.visible, anchorId: speakerId }
}

/** Asks that belong to the person, not the company: they follow their speaker even outside the door. */
const rideVisitor = (k: BubbleKind): boolean => k === 'decision' || k === 'visitor'

/** Layout speaker id for a bubble parked at the scene centre (no visible head). */
export const CENTER_ANCHOR = '@center'

/** Where a bubble goes when its own speaker is not there, in order (then CENTER_ANCHOR). */
const ANCHOR_FALLBACK = ['desk', 'founder'] as const

/** Takes part in layout / may be shown. Only ambient lines hide for an absent speaker. */
const present = (e: Entry): boolean => e.speakerVisible || isAnchored(e.kind)

/** Minimal element surface the driver touches (HTMLElement in the app, plain objects in tests). */
export interface BubbleEl {
  style: Partial<Record<'transform' | 'transition' | 'opacity' | 'scale' | 'visibility' | 'display' | 'height' | 'left' | 'pointerEvents', string>>
  /** `data-detached` (CSS hides the bubble's tail); optional so tests can pass plain objects. */
  toggleAttribute?: (name: string, force?: boolean) => boolean
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
  /** Removed from the bubble list: fades out (still holds its slot) until WorldBubbles unmounts it. */
  exiting: boolean
  /** Takes clicks while shown (restored after an exit is cancelled). */
  interactive: boolean
  /** Stops the ResizeObserver (set by observeResize). */
  unobserve?: () => void
  /** Waits above where its speaker is walking to (resolveAnchor `ahead`): no stem, no tail until they arrive. */
  ahead?: boolean
  /** Changed size (pill ↔ card): jump to the next placement instead of easing, so a 340px card never starts from the
   *  pill's slot half off screen (QA 390px: card at x = −21, focus then scrolled the scene). */
  snap?: boolean
}

export class BubbleLayoutRegistry {
  entries = new Map<string, Entry>()
  placements = new Map<string, Placement>()
  dirty = true
  lastLayout = 0
  /** ui.bubbleOpen: that bubble is laid out first (bubbleLayout OPEN_PRIORITY). */
  openKey: string | null = null
  /** A card or screen covers the scene (stage-up, victory, statistics…): every bubble fades out until it closes. */
  covered = false
}

/** Re-lay out within a frame when a bubble changes size (collapsed → expanded), not on the next timed pass. */
export function observeResize(reg: BubbleLayoutRegistry, e: Entry, el: Element): void {
  if (typeof ResizeObserver === 'undefined') return
  const ro = new ResizeObserver(() => {
    reg.dirty = true
    e.snap = true
  })
  ro.observe(el)
  e.unobserve = () => ro.disconnect()
}

/** Drops an entry (BubbleAnchor unmount). */
export function removeEntry(reg: BubbleLayoutRegistry, e: Entry): void {
  e.unobserve?.()
  e.unobserve = undefined
  if (reg.entries.get(e.key) === e) reg.entries.delete(e.key)
  reg.dirty = true
}

/** 50 ms: a bubble above a walking visitor never drifts more than a few px into a neighbour between passes. */
export const LAYOUT_INTERVAL_MS = 50
/** Matches the `animate-ambient` CSS animation (3 s fade in, hold, fade out). */
export const AMBIENT_VISIBLE_MS = 3_000
/** An ambient line that cannot find space within this long is dropped for good. */
export const AMBIENT_WAIT_MS = 1_000
/** Enter / exit: opacity 0↔1 and scale .96↔1 (the separate CSS `scale` property, so the eased translate stays ours). */
export const FADE_MS = 180
const HIDDEN_T = `opacity ${FADE_MS}ms ease-out, scale ${FADE_MS}ms ease-out, visibility 0s linear ${FADE_MS}ms`
const SHOWN_T = `opacity ${FADE_MS}ms ease-out, scale ${FADE_MS}ms cubic-bezier(.2,.9,.3,1.2), visibility 0s`
export const ENTER_SCALE = '0.96'

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
    exiting: false,
    interactive: !!init.interactive,
  }
}

/** Natural (unshifted) boxes of every bubble that takes part in the layout. Reads only. */
export function measure(reg: BubbleLayoutRegistry): BubbleBox[] {
  const out: BubbleBox[] = []
  for (const e of reg.entries.values()) {
    if (!present(e) || e.frames < 2 || e.done) continue
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
  reg.placements = layoutBubbles(measure(reg), vp(), reg.placements, { openKey: reg.openKey })
}

/** Marks a bubble as leaving (fade out, no clicks) or back (an exit cancelled because it returned). */
export function setExiting(reg: BubbleLayoutRegistry, e: Entry, exiting: boolean): void {
  if (e.exiting === exiting) return
  e.exiting = exiting
  e.el.style.pointerEvents = !exiting && e.interactive ? 'auto' : 'none'
  reg.dirty = true
}

function setShown(e: Entry, show: boolean): void {
  e.shown = show
  const v = show ? 'visible' : 'hidden'
  e.el.style.transition = show ? SHOWN_T : HIDDEN_T
  e.el.style.opacity = show ? '1' : '0'
  e.el.style.scale = show ? '1' : ENTER_SCALE
  e.el.style.visibility = v
  for (const w of e.wraps) w.style.visibility = v
  if (!show) {
    // Juice measures stems as bubbles: a hidden bubble leaves none behind; the next frame shown redraws it.
    e.stem.style.display = 'none'
    e.written = ''
  }
}

/** Restart the ambient fade so a line that waited for space plays its full 3 s. */
function restartAnimations(el: MeasuredEl): void {
  for (const a of el.getAnimations?.({ subtree: true }) ?? []) {
    a.currentTime = 0
    a.play()
  }
}

/**
 * Bumped whenever a bubble is shown, hidden or moved on screen: scene juice (yieldToBubbles) re-measures on the next
 * frame instead of on its 150 ms timer, so the release banner slides off a pill as it lands, not ~350 ms later (QA).
 */
export const bubbleMotion = { epoch: 0 }

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
    const show = !reg.covered && present(e) && !e.done && !e.exiting && !!p && !p.hidden
    if (show && p) {
      if (!e.shown || e.snap) {
        e.cur.dx = p.dx
        e.cur.dy = p.dy
        e.snap = false
      } else {
        e.cur.dx += (p.dx - e.cur.dx) * k
        e.cur.dy += (p.dy - e.cur.dy) * k
        if (Math.abs(p.dx - e.cur.dx) < 0.3) e.cur.dx = p.dx
        if (Math.abs(p.dy - e.cur.dy) < 0.3) e.cur.dy = p.dy
      }
    }
    if (show !== e.shown) {
      bubbleMotion.epoch++
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
    // Stem follows the eased position: from the bubble's bottom edge (above the head when it can, else
    // the nearest point) to the speaker's head, tilted when the bubble was moved sideways.
    // The head sits under the natural (unshifted) bubble's centre: w/2 − dx from the current left edge.
    const headX = e.w / 2 - dx
    const sx = Math.min(Math.max(6, e.w - 6), Math.max(6, headX))
    const drop = -dy
    const len = p.stem > 0 && drop > 0 && !e.ahead ? Math.round(Math.hypot(headX - sx, drop)) : 0
    const stemX = len > 0 ? Math.round(sx) : 0
    const tilt = len > 0 && Math.abs(headX - sx) > 0.5 ? Math.round(((Math.atan2(-(headX - sx), drop) * 180) / Math.PI) * 10) / 10 : 0
    const lift = len
    // Lifted without a stem (a bubble sits between it and the head): no tail, so it never points at the bubble below.
    const detached = (!!p.detached && dy < -2) || !!e.ahead
    const sig = `${dx},${dy},${lift},${stemX},${tilt},${detached ? 1 : 0}`
    if (sig === e.written) continue
    e.written = sig
    bubbleMotion.epoch++
    e.el.toggleAttribute?.('data-detached', detached)
    e.el.style.transform = `translate(${dx}px, calc(-50% + ${dy}px))`
    e.off.dx = dx
    e.off.dy = dy
    const s = e.stem.style
    if (lift > 0) {
      s.display = 'block'
      s.height = `${lift}px`
      s.left = `${stemX}px`
      s.transform = tilt ? `rotate(${tilt}deg)` : ''
    } else if (s.display !== 'none') s.display = 'none'
  }
}
