// Positions HTML content above a character's head (drei <Html>). Content is supplied by the caller.
// With a `layout` registry (WorldBubbles), the bubble joins screen-space overlap resolution
// (bubbleLayout.ts): the driver measures every visible bubble ~10×/s, then writes offsets, a stem
// back to the speaker and visibility straight to the DOM (no React state per frame).
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import type * as THREE from 'three'
import { BUBBLE_PRIORITY, layoutBubbles, type BubbleBox, type BubbleKind, type Placement, type Viewport } from './bubbleLayout'
import { speakerPositions } from './sceneRegistry'
import { storeApi } from './source'

// ---------------------------------------------------------------------------
// Layout registry + driver
// ---------------------------------------------------------------------------

interface Entry {
  key: string
  kind: BubbleKind
  speakerId: string
  el: HTMLDivElement
  stem: HTMLDivElement
  /** Speaker is in the office (not walked out). */
  speakerVisible: boolean
  /** Frames since mount: drei positions the element on its first frame, so skip measuring until then. */
  frames: number
  /** Offset currently written to the DOM (eased toward the target). */
  cur: { dx: number; dy: number }
  shown: boolean
  written: string
}

export class BubbleLayoutRegistry {
  entries = new Map<string, Entry>()
  placements = new Map<string, Placement>()
  dirty = true
  lastLayout = 0
}

const LAYOUT_INTERVAL_MS = 100
const HIDDEN_T = 'opacity 160ms ease-out, visibility 0s linear 160ms'
const SHOWN_T = 'opacity 160ms ease-out, visibility 0s'

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

function measure(reg: BubbleLayoutRegistry): BubbleBox[] {
  const out: BubbleBox[] = []
  for (const e of reg.entries.values()) {
    if (!e.speakerVisible || e.frames < 2) continue
    const r = e.el.getBoundingClientRect()
    const w = e.el.offsetWidth
    const h = e.el.offsetHeight
    if (w === 0 || h === 0) continue
    // Natural box = measured box minus the offset we applied ourselves (transforms keep the center).
    const cx = r.left + r.width / 2 - e.cur.dx
    const cy = r.top + r.height / 2 - e.cur.dy
    out.push({ key: e.key, speakerId: e.speakerId, kind: e.kind, left: cx - w / 2, top: cy - h / 2, w, h })
  }
  return out
}

/** Runs the layout (throttled) and eases every bubble to its slot. Call once, after the anchors mount. */
export function useBubbleLayoutDriver(reg: BubbleLayoutRegistry): void {
  const canvas = useThree((s) => s.gl.domElement)
  useFrame((_, dt) => {
    const now = performance.now()
    if (reg.dirty || now - reg.lastLayout >= LAYOUT_INTERVAL_MS) {
      reg.dirty = false
      reg.lastLayout = now
      reg.placements = layoutBubbles(measure(reg), sceneViewport(canvas), reg.placements)
    }
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 14)
    for (const e of reg.entries.values()) {
      if (++e.frames === 2) reg.dirty = true
      const p = reg.placements.get(e.key)
      const show = e.speakerVisible && !!p && !p.hidden
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
        e.shown = show
        e.el.style.transition = show ? SHOWN_T : HIDDEN_T
        e.el.style.opacity = show ? '1' : '0'
        e.el.style.visibility = show ? 'visible' : 'hidden'
      }
      if (!show) continue
      const dx = Math.round(e.cur.dx * 10) / 10
      const dy = Math.round(e.cur.dy * 10) / 10
      const sig = `${dx},${dy}`
      if (sig === e.written) continue
      e.written = sig
      e.el.style.transform = `translate(${dx}px, calc(-50% + ${dy}px))`
      // Stem from the lifted bubble back down to the speaker's head.
      const lift = -dy
      const s = e.stem.style
      if (lift > 8) {
        const w = e.el.offsetWidth
        s.display = 'block'
        s.height = `${lift}px`
        s.left = `${Math.min(w - 10, Math.max(10, w / 2 - dx))}px`
      } else if (s.display !== 'none') s.display = 'none'
    }
  })
}

// ---------------------------------------------------------------------------
// Anchor
// ---------------------------------------------------------------------------

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
  }, [layout, kind, layoutKey, speakerId])

  useFrame(() => {
    const p = speakerPositions.get(speakerId) ?? speakerPositions.get('founder')
    const g = group.current
    if (g) {
      if (p) g.position.set(p.x, p.y + 0.35 + offsetY, p.z)
      else g.position.set(fallback[0], 1.4 + offsetY, fallback[1])
    }
    if (layout && kind && layoutKey && !entry.current && inner.current && stem.current) {
      const e: Entry = { key: layoutKey, kind, speakerId, el: inner.current, stem: stem.current, speakerVisible: true, frames: 0, cur: { dx: 0, dy: 0 }, shown: false, written: '' }
      layout.entries.set(layoutKey, e)
      layout.dirty = true
      entry.current = e
    }
    const show = !p || p.visible
    const e = entry.current
    if (e) {
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
      <Html center zIndexRange={zRange(kind)} pointerEvents={interactive ? 'auto' : 'none'}>
        <div
          ref={inner}
          // Managed bubbles start hidden until their first layout pass (no one-frame overlap flash).
          style={{ position: 'relative', transform: 'translateY(-50%)', ...(managed ? { visibility: 'hidden', opacity: 0 } : null) }}
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
