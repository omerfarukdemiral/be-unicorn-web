// Positions HTML content above a character's head (drei <Html>). Content is supplied by the caller.
// With a `layout` registry (WorldBubbles), the bubble joins screen-space overlap resolution
// (bubbleLayout.ts): the driver (bubbleDriver.ts) measures every visible bubble ~10×/s, then writes
// offsets, a stem back to the speaker and visibility straight to the DOM (no React state per frame).
// drei's wrapper divs never take pointer events; only clickable bubble content does, so a moved or
// hidden bubble leaves no invisible click blocker behind. Bubbles fade + scale in when first laid out
// and fade out while `exiting` (WorldBubbles keeps a removed bubble mounted that long).
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import { Vector3, type Camera } from 'three'
import type * as THREE from 'three'
import { applyFrame, BubbleLayoutRegistry, createEntry, ENTER_SCALE, observeResize, removeEntry, resolveAnchor, setExiting, shiftBubble, runLayout, type Entry } from './bubbleDriver'
import { freeBubbleHeight, OPEN_PRIORITY, priorityOf, type BubbleKind, type Viewport } from './bubbleLayout'
import { useHtmlPortal } from './htmlPortal'
import { speakerPositions } from './sceneRegistry'
import { storeApi } from './source'

// ---------------------------------------------------------------------------
// Layout driver
// ---------------------------------------------------------------------------

export { BubbleLayoutRegistry }

/** UI surfaces that may sit over the scene area (strip over a phone sheet, side panel, the start call…). */
const OBSTACLES = '[data-scene-bottom],[data-scene-sheet],[data-scene-right],[data-scene-obstacle]'
/** Scene juice (release banner, "+N" floats): it steps aside for actionable bubbles; read-only ones keep off it. */
const JUICE = '[data-juice-banner],[data-juice-float]'

/** Shown on screen (juice fades to opacity 0 when it has no free height; a hidden surface blocks nothing). */
function onScreen(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true
  if (el.style.opacity === '0' || el.style.visibility === 'hidden') return false
  return getComputedStyle(el).visibility !== 'hidden'
}

function sceneViewport(canvas: HTMLCanvasElement): Viewport {
  const c = canvas.getBoundingClientRect()
  const inset = storeApi().ui.sceneInset
  const hud = document.querySelector('[data-scene-top]')?.getBoundingClientRect()
  const hudBottom = hud ? Math.min(hud.bottom, window.innerHeight * 0.4) : 0
  const m = 8
  const obstacles: { left: number; top: number; right: number; bottom: number }[] = []
  for (const el of document.querySelectorAll(OBSTACLES)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && onScreen(el)) obstacles.push({ left: r.left - 2, top: r.top - 2, right: r.right + 2, bottom: r.bottom + 2 })
  }
  const juice: { left: number; top: number; right: number; bottom: number }[] = []
  for (const el of document.querySelectorAll(JUICE)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && onScreen(el)) juice.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
  }
  const vp: Viewport = {
    left: c.left + m,
    right: Math.min(c.right, window.innerWidth - inset.right) - m,
    top: Math.max(c.top, inset.top, hudBottom) + m,
    bottom: Math.min(c.bottom, window.innerHeight - inset.bottom) - m,
    obstacles,
    juice,
  }
  // Open cards cap their option list at this (ui/bubbles/Expandable); written only when it moves.
  const free = `${Math.round(freeBubbleHeight(vp))}px`
  const root = document.documentElement
  if (root.style.getPropertyValue('--scene-free-h') !== free) root.style.setProperty('--scene-free-h', free)
  return vp
}

/** Runs the layout (throttled) and eases every bubble to its slot. Call once, after the anchors mount. */
export function useBubbleLayoutDriver(reg: BubbleLayoutRegistry): void {
  const canvas = useThree((s) => s.gl.domElement)
  useFrame((_, dt) => {
    const now = performance.now()
    runLayout(reg, () => sceneViewport(canvas), now)
    applyFrame(reg, dt, now)
  })
}

// ---------------------------------------------------------------------------
// Anchor
// ---------------------------------------------------------------------------

const tmp = new Vector3()
const prevPos = new Vector3()
/** An anchor moving more than this (world units, squared) in one frame teleported; walking is far slower. */
const TELEPORT_SQ = 0.6 * 0.6
/** World point → CSS px inside the canvas (same math as drei <Html>'s default calculatePosition). */
function toScreen(v: Vector3, camera: Camera, size: { width: number; height: number }): [number, number] {
  tmp.copy(v).project(camera)
  return [(tmp.x + 1) * (size.width / 2), (1 - tmp.y) * (size.height / 2)]
}

export interface BubbleAnchorProps {
  /** Employee id, visitor id, 'founder' or 'desk'. Falls back to the desk, the founder, then `fallback` (see resolveAnchor). */
  speakerId: string
  /** Extra height above the head (world units), e.g. to stack icons. */
  offsetY?: number
  /** World XZ used when the speaker has no position yet. */
  fallback?: [number, number]
  /** Stay above this desk (world XZ) while the speaker is in the building, however they walk. */
  pinAt?: [number, number]
  /** Clickable content? (sets pointer-events). */
  interactive?: boolean
  /** Join screen-space overlap resolution (needs `kind` and `layoutKey`). */
  layout?: BubbleLayoutRegistry
  kind?: BubbleKind
  layoutKey?: string
  /** ui.bubbleOpen: the bubble with this key is drawn above all others. */
  openKey?: string | null
  /** Removed from the list: fade out (WorldBubbles unmounts it shortly after). */
  exiting?: boolean
  children: ReactNode
}

/** drei maps camera distance into this z-index range; one band per priority keeps decisions (and the open bubble) on top. */
const zRange = (kind: BubbleKind | undefined, open: boolean): [number, number] => {
  const base = 10 + (open ? OPEN_PRIORITY : kind ? priorityOf({ key: '', kind }) : 1) * 10
  return [base + 9, base]
}

/** drei's wrapper divs are click-through (the inner bubble opts back in when interactive). */
const NO_POINTER = { pointerEvents: 'none' } as const

export function BubbleAnchor({ speakerId, pinAt, offsetY = 0, fallback = [0, 0], interactive = false, layout, kind, layoutKey, openKey = null, exiting = false, children }: BubbleAnchorProps) {
  const group = useRef<THREE.Group>(null)
  const inner = useRef<HTMLDivElement>(null)
  const stem = useRef<HTMLDivElement>(null)
  const entry = useRef<Entry | null>(null)
  const portal = useHtmlPortal()
  // A mouse over a clickable bubble holds its anchor still (a pill above a walking visitor would slide away from
  // the cursor); it follows its speaker again on leave.
  const hovered = useRef(false)

  const managed = !!(layout && kind && layoutKey)
  // drei renders <Html> children in its own root, so the refs are set a little later than our
  // effects run: register lazily from useFrame, unregister here.
  useEffect(() => {
    return () => {
      const e = entry.current
      if (layout && e) removeEntry(layout, e)
      else if (layout) layout.dirty = true
      entry.current = null
    }
  }, [layout, layoutKey])

  // Priority -1: the group moves before drei's <Html> projects it this frame (no one-frame lag).
  useFrame((state) => {
    // Clickable bubbles whose speaker is gone (or outside, except a visitor's own ask) move to the desk, the founder or
    // the scene centre.
    const r = resolveAnchor(speakerId, kind ?? (interactive ? 'decision' : undefined), speakerPositions)
    const { visible: show, anchorId, ahead } = r
    let p = r.pos
    const own = speakerPositions.get(speakerId)
    if (pinAt && own?.visible && p) p = { ...p, x: pinAt[0], z: pinAt[1] }
    // A hidden bubble gets no pointerleave: never stay frozen behind a fade.
    if (hovered.current && entry.current && !entry.current.shown) hovered.current = false
    const g = group.current
    if (g && !(hovered.current && interactive && entry.current)) {
      const e0 = entry.current
      const was = e0 && layout ? prevPos.copy(g.position) : null
      if (p) g.position.set(p.x, p.y + 0.35 + offsetY, p.z)
      else g.position.set(fallback[0], 1.4 + offsetY, fallback[1])
      if (e0 && layout) {
        const jumped = was !== null && was.distanceToSquared(g.position) > TELEPORT_SQ
        if (jumped) {
          // The anchor teleported (new speaker, or the speaker's position just appeared): keep
          // the bubble where it is on screen and let it glide to its new slot instead of snapping.
          const before = toScreen(was, state.camera, state.size)
          const after = toScreen(g.position, state.camera, state.size)
          shiftBubble(e0, after[0] - before[0], after[1] - before[1])
          layout.dirty = true
        }
        if (!!e0.ahead !== !!ahead) {
          e0.ahead = !!ahead
          e0.written = ''
        }
        // Layout groups by the head the bubble sits above (after any founder / centre fallback).
        if (e0.speakerId !== anchorId) {
          e0.speakerId = anchorId
          layout.dirty = true
        }
      }
    }
    if (layout && kind && layoutKey && !entry.current && inner.current && stem.current) {
      const wraps: HTMLElement[] = []
      for (let w = inner.current.parentElement; w && wraps.length < 2; w = w.parentElement) wraps.push(w)
      const e = createEntry({ key: layoutKey, kind, speakerId: anchorId, el: inner.current, stem: stem.current, wraps, interactive }, performance.now())
      layout.entries.set(layoutKey, e)
      observeResize(layout, e, inner.current)
      layout.dirty = true
      entry.current = e
    }
    const e = entry.current
    if (e) {
      setExiting(layout!, e, exiting)
      // The speaker (who says it) can change while the bubble stays: update in place, no re-register.
      if (e.speakerVisible !== show) layout!.dirty = true
      e.speakerVisible = show
      return
    }
    const el = inner.current
    if (el) {
      const v = show ? 'visible' : 'hidden'
      if (el.style.visibility !== v) el.style.visibility = v
    }
  }, -1)
  return (
    <group ref={group}>
      <Html portal={portal} center zIndexRange={zRange(kind, openKey !== null && openKey === layoutKey)} style={NO_POINTER} wrapperClass="pointer-events-none">
        <div
          ref={inner}
          data-bubble-key={layoutKey}
          data-bubble-speaker={layoutKey ? speakerId : undefined}
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse') hovered.current = true
          }}
          onPointerLeave={() => {
            hovered.current = false
          }}
          // Managed bubbles start hidden until their first layout pass (no one-frame overlap flash).
          // Only the bubble itself takes clicks, never drei's wrappers.
          style={{ position: 'relative', transform: 'translateY(-50%)', pointerEvents: interactive ? 'auto' : 'none', ...(managed ? { visibility: 'hidden', opacity: 0, scale: ENTER_SCALE } : null) }}
        >
          {children}
          {/* data-bubble-key: scene juice (yieldToBubbles) keeps off the stem too, not only the bubble (QA: the release
              banner sat at the desk under every stem). */}
          <div
            ref={stem}
            data-bubble-key={layoutKey ? `${layoutKey}#stem` : undefined}
            aria-hidden
            style={{ display: 'none', position: 'absolute', top: '100%', width: 2, marginLeft: -1, transformOrigin: '50% 0', borderRadius: 1, background: 'rgba(28, 27, 31, 0.28)', pointerEvents: 'none' }}
          />
        </div>
      </Html>
    </group>
  )
}
