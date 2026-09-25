// The one writer of store.ui.sceneInset (docs/LAYOUT.md §6): the screen area the fixed UI covers, so the camera
// (render/OfficeScene › CameraRig) and the bubble layout (render/BubbleAnchor › sceneViewport) use the free rest.
// Measured from the DOM markers:
//   [data-scene-top]    top bar                    → top    = bar bottom + GAP
//   [data-scene-bottom] strip slot + bottom bar    → bottom = vh − min(stack top, sheet top) + GAP
//   [data-scene-right]  side panel <aside>         → right  = vw − panel left + GAP  (desktop + landscape phone)
//   [data-scene-sheet]  portrait sheet <section>   → (bottom, above; the strip floats at `bottom` on top of it)
import { useEffect, useSyncExternalStore } from 'react'
import { useGameStore } from '../../store/gameStore'
import { useLayoutMode, type LayoutMode } from '../hooks'
import { GAP, PANEL_NARROW_BELOW, PANEL_W, PANEL_W_LANDSCAPE, PANEL_W_NARROW } from './tokens'

/**
 * Side panel width: desktop 400, or 360 below 1280; landscape phone min(360, 46% of the width), so the scene keeps
 * more than half the screen. (Portrait uses the full-width bottom sheet instead.)
 */
export function panelWidth(vw: number, mode: LayoutMode = 'desktop'): number {
  if (mode === 'landscape') return Math.min(PANEL_W_LANDSCAPE, Math.round(vw * 0.46))
  return vw < PANEL_NARROW_BELOW ? PANEL_W_NARROW : PANEL_W
}

function subscribeResize(cb: () => void): () => void {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

/** Current side panel width for this layout mode (re-renders across the 1280 breakpoint / on resize). */
export function usePanelWidth(mode: LayoutMode = 'desktop'): number {
  return useSyncExternalStore(subscribeResize, () => panelWidth(window.innerWidth, mode), () => PANEL_W)
}

/**
 * Layout box in viewport px, transforms ignored (offset chain): the panel's slide-in and the sheet's slide-up
 * animate `transform`, and the inset must be where they land, not where the animation is right now.
 */
function layoutRect(sel: string): { left: number; top: number; bottom: number } | null {
  const el = document.querySelector<HTMLElement>(sel)
  if (!el) return null
  let left = 0
  let top = 0
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
    left += n.offsetLeft
    top += n.offsetTop
  }
  return { left, top, bottom: top + el.offsetHeight }
}

function measure(): void {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const rect = layoutRect
  const top = rect('[data-scene-top]')
  const stack = rect('[data-scene-bottom]')
  const side = rect('[data-scene-right]')
  const sheet = rect('[data-scene-sheet]')
  const bottomEdge = Math.min(stack?.top ?? vh, sheet?.top ?? vh)
  useGameStore.getState().setSceneInset({
    top: top ? Math.round(top.bottom + GAP) : 0,
    right: side ? Math.max(0, Math.round(vw - side.left + GAP)) : 0,
    bottom: bottomEdge < vh ? Math.max(0, Math.round(vh - bottomEdge + GAP)) : 0,
  })
}

/**
 * Keeps sceneInset in step with the bars, the panel and the sheet. Mount once (GameUI). Re-arms when the panel
 * opens / closes (its element comes and goes); a ResizeObserver catches bar height changes (phone rows, sheet
 * without the action row) and a late second pass waits for the sheet's slide-in.
 */
export function useSceneInset(): void {
  const panelOpen = useGameStore((s) => s.ui.panel !== null)
  // Desktop ↔ portrait ↔ landscape swap the bar elements: observe the new ones.
  const mode = useLayoutMode()
  useEffect(() => {
    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    measure()
    const ro = new ResizeObserver(schedule)
    for (const sel of ['[data-scene-top]', '[data-scene-bottom]', '[data-scene-right]', '[data-scene-sheet]']) {
      const el = document.querySelector(sel)
      if (el) ro.observe(el)
    }
    window.addEventListener('resize', schedule)
    const late = window.setTimeout(measure, 350)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      window.clearTimeout(late)
    }
  }, [panelOpen, mode])
}
