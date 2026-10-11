// Scene juice (release banner, "+N" floats) is drawn outside the bubble layout: it steps out of the way of the world
// bubbles instead of printing under them. A few times a second it measures itself against every shown bubble and
// slides to the nearest free height (fades out when there is none); bubbles never move for it.
import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import { bubbleMotion } from './bubbleDriver'

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** Heights tried, nearest first (px; negative = up). */
const STEPS = [0, -44, 44, -88, 88, -132, 132, -176]
const PAD = 6
const hits = (a: Box, b: Box) => a.left < b.right + PAD && b.left < a.right + PAD && a.top < b.bottom + PAD && b.top < a.bottom + PAD

/**
 * Vertical offset that keeps `own` (its unshifted rect) clear of `others` inside `bounds`, or null when no step is free.
 * The current offset is kept while it is still free, so the banner does not hop between two equal heights.
 */
export function freeOffset(own: Box, others: readonly Box[], bounds: Box, current = 0): number | null {
  const ok = (dy: number) => {
    const r = { left: own.left, right: own.right, top: own.top + dy, bottom: own.bottom + dy }
    return r.top >= bounds.top && r.bottom <= bounds.bottom && !others.some((o) => hits(r, o))
  }
  if (ok(current)) return current
  for (const dy of STEPS) if (ok(dy)) return dy
  return null
}

const MEASURE_MS = 150
/** A bubble just appeared or moved (bubbleMotion): measure again this soon instead of waiting for MEASURE_MS. */
const MOTION_MS = 40

function shownBubbles(also?: string): Box[] {
  const out: Box[] = []
  for (const el of document.querySelectorAll<HTMLElement>(also ? `[data-bubble-key],${also}` : '[data-bubble-key]')) {
    if (el.style.visibility === 'hidden' || el.style.opacity === '0') continue
    const r = el.getBoundingClientRect()
    if (r.width > 0) out.push(r)
  }
  return out
}

/** Moves `ref` (inside a drei <Html>) to a height no world bubble (nor `also`) covers; fades it when none is free. */
export function useYieldToBubbles(ref: RefObject<HTMLElement | null>, also?: string): void {
  const state = useRef({ last: 0, dy: 0, hidden: false, epoch: -1 })
  useFrame(({ gl }) => {
    const el = ref.current
    const st = state.current
    const now = performance.now()
    const moved = st.epoch !== bubbleMotion.epoch
    if (!el || now - st.last < (moved ? MOTION_MS : MEASURE_MS)) return
    st.last = now
    st.epoch = bubbleMotion.epoch
    // Natural rect: drei's wrapper keeps the unshifted box (our `translate` moves only the child, and may be mid-slide).
    const r = (el.parentElement ?? el).getBoundingClientRect()
    if (r.width === 0) return
    const own = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    const c = gl.domElement.getBoundingClientRect()
    const top = document.querySelector('[data-scene-top]')?.getBoundingClientRect().bottom ?? c.top
    const dy = freeOffset(own, shownBubbles(also), { left: c.left, right: c.right, top: Math.max(c.top, top), bottom: c.bottom }, st.dy)
    const hidden = dy === null
    const next = dy ?? st.dy
    if (next === st.dy && hidden === st.hidden) return
    st.dy = next
    st.hidden = hidden
    el.style.transition = 'translate 200ms ease-out, opacity 160ms ease-out'
    el.style.translate = `0 ${next}px`
    el.style.opacity = hidden ? '0' : ''
  })
}
