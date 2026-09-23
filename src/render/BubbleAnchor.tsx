// Positions HTML content above a character's head (drei <Html>). Content is supplied by the caller.
// With a `layout` registry (WorldBubbles), the bubble joins screen-space overlap resolution
// (bubbleLayout.ts): the driver (bubbleDriver.ts) measures every visible bubble ~10×/s, then writes
// offsets, a stem back to the speaker and visibility straight to the DOM (no React state per frame).
// drei's wrapper divs never take pointer events; only clickable bubble content does, so a moved or
// hidden bubble leaves no invisible click blocker behind.
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import { Vector3, type Camera } from 'three'
import type * as THREE from 'three'
import { applyFrame, BubbleLayoutRegistry, createEntry, shiftBubble, runLayout, type Entry } from './bubbleDriver'
import { BUBBLE_PRIORITY, type BubbleKind, type Viewport } from './bubbleLayout'
import { speakerPositions } from './sceneRegistry'
import { storeApi } from './source'

// ---------------------------------------------------------------------------
// Layout driver
// ---------------------------------------------------------------------------

export { BubbleLayoutRegistry }

function sceneViewport(canvas: HTMLCanvasElement): Viewport {
  const c = canvas.getBoundingClientRect()
  const inset = storeApi().ui.sceneInset
  const hud = document.querySelector('[data-scene-top]')?.getBoundingClientRect()
  const hudBottom = hud ? Math.min(hud.bottom, window.innerHeight * 0.4) : 0
  const m = 8
  return {
    left: c.left + m,
    right: Math.min(c.right, window.innerWidth - inset.right) - m,
    top: Math.max(c.top, inset.top, hudBottom) + m,
    bottom: Math.min(c.bottom, window.innerHeight - inset.bottom) - m,
  }
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
  /** Employee id, visitor id or 'founder'. Falls back to the founder, then `fallback`. */
  speakerId: string
  /** Extra height above the head (world units), e.g. to stack icons. */
  offsetY?: number
  /** World XZ used when the speaker has no position yet. */
  fallback?: [number, number]
  /** Clickable content? (sets pointer-events). */
  interactive?: boolean
  /** Join screen-space overlap resolution (needs `kind` and `layoutKey`). */
  layout?: BubbleLayoutRegistry
  kind?: BubbleKind
  layoutKey?: string
  children: ReactNode
}

/** drei maps camera distance into this z-index range; one band per priority keeps decisions on top. */
const zRange = (kind: BubbleKind | undefined): [number, number] => {
  const base = 10 + (kind ? BUBBLE_PRIORITY[kind] : 1) * 10
  return [base + 9, base]
}

/** drei's wrapper divs are click-through (the inner bubble opts back in when interactive). */
const NO_POINTER = { pointerEvents: 'none' } as const

export function BubbleAnchor({ speakerId, offsetY = 0, fallback = [0, 0], interactive = false, layout, kind, layoutKey, children }: BubbleAnchorProps) {
  const group = useRef<THREE.Group>(null)
  const inner = useRef<HTMLDivElement>(null)
  const stem = useRef<HTMLDivElement>(null)
  const entry = useRef<Entry | null>(null)

  const managed = !!(layout && kind && layoutKey)
  // drei renders <Html> children in its own root, so the refs are set a little later than our
  // effects run: register lazily from useFrame, unregister here.
  useEffect(() => {
    return () => {
      const e = entry.current
      if (layout && e && layout.entries.get(e.key) === e) layout.entries.delete(e.key)
      if (layout) layout.dirty = true
      entry.current = null
    }
  }, [layout, layoutKey])

  useFrame((state) => {
    const p = speakerPositions.get(speakerId) ?? speakerPositions.get('founder')
    const g = group.current
    if (g) {
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
        if (e0.speakerId !== speakerId) {
          e0.speakerId = speakerId
          layout.dirty = true
        }
      }
    }
    if (layout && kind && layoutKey && !entry.current && inner.current && stem.current) {
      const wraps: HTMLElement[] = []
      for (let w = inner.current.parentElement; w && wraps.length < 2; w = w.parentElement) wraps.push(w)
      const e = createEntry({ key: layoutKey, kind, speakerId, el: inner.current, stem: stem.current, wraps, interactive }, performance.now())
      layout.entries.set(layoutKey, e)
      layout.dirty = true
      entry.current = e
    }
    const show = !p || p.visible
    const e = entry.current
    if (e) {
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
  })
  return (
    <group ref={group}>
      <Html center zIndexRange={zRange(kind)} style={NO_POINTER} wrapperClass="pointer-events-none">
        <div
          ref={inner}
          data-bubble={layoutKey}
          // Managed bubbles start hidden until their first layout pass (no one-frame overlap flash).
          // Only the bubble itself takes clicks, never drei's wrappers.
          style={{ position: 'relative', transform: 'translateY(-50%)', pointerEvents: interactive ? 'auto' : 'none', ...(managed ? { visibility: 'hidden', opacity: 0 } : null) }}
        >
          {children}
          <div
            ref={stem}
            aria-hidden
            style={{ display: 'none', position: 'absolute', top: '100%', width: 2, marginLeft: -1, borderRadius: 1, background: 'rgba(60, 52, 80, 0.35)', pointerEvents: 'none' }}
          />
        </div>
      </Html>
    </group>
  )
}
