// Bottom bar + the notification strip above it (docs/LAYOUT.md §1.2, §1.4, §3, §6).
// Desktop: one full-width bar h56 (EDGE 8 from the sides and the bottom): founder energy + labelled actions on the
// left, panel tabs on the right (labels drop to icons below a 1240px bar, container query). The strip (h40, content
// max 760, centred) sits 8px above it, left of the panel when the panel is open.
// Phone: the bar has two rows (actions 44 + tabs 48 = h104); with the sheet open only the tab row stays (h56) and the
// strip floats 8px above the sheet (it then takes no part in the scene inset). Landscape phone: one row h52, 44px
// tabs, a side panel (no sheet) and the strip overlaying the scene's bottom edge (no reserved slot).
// The wrapper carries `data-scene-bottom` for useSceneInset; on desktop / portrait the strip's height is reserved
// even when it is empty so the camera does not jump with each message. The layout mode comes from useLayoutMode.
import { useSyncExternalStore } from 'react'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { useLayoutMode } from '../hooks'
import { cx } from '../primitives'
import { DockTabs } from '../Dock'
import { FounderBar } from './FounderBar'
import { NotificationStrip } from './NotificationStrip'
import { BAR_H, EDGE, GAP, LANDSCAPE_BAR_H, MOBILE_BOTTOM_H, STRIP_H, STRIP_H_MOBILE } from './tokens'
import { panelWidth } from './useSceneInset'

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

/** Viewport width (panel width breakpoint). */
function useVw(): number {
  return useSyncExternalStore(subscribe, () => window.innerWidth, () => 1440)
}

/** The bar alone. `layout`: desktop row / phone two rows / landscape phone one row. `sheetOpen` hides the action row. */
export function BottomBar({ layout, sheetOpen = false }: { layout: 'desktop' | 'mobile' | 'landscape'; sheetOpen?: boolean }) {
  if (layout === 'mobile') {
    return (
      <nav aria-label={t('bottom.label')} className={cx('ui-card pointer-events-auto flex flex-col gap-0.5 bg-surface/95 backdrop-blur-sm', sheetOpen ? 'px-1 py-[3px]' : 'p-1')}>
        {!sheetOpen && <FounderBar variant="mobile" className="h-11 px-1" />}
        <DockTabs variant="mobile" />
      </nav>
    )
  }
  if (layout === 'landscape') {
    return (
      <nav aria-label={t('bottom.label')} className="@container ui-card pointer-events-auto flex items-center justify-between gap-2 bg-surface/95 px-1 backdrop-blur-sm" style={{ height: LANDSCAPE_BAR_H }}>
        {!sheetOpen && <FounderBar variant="mobile" className="min-w-0 shrink" />}
        <DockTabs variant="bar" touch />
      </nav>
    )
  }
  return (
    <nav
      aria-label={t('bottom.label')}
      className="@container ui-card pointer-events-auto flex items-center justify-between gap-4 bg-surface/95 p-2 backdrop-blur-sm"
      style={{ height: BAR_H }}
    >
      <FounderBar variant="bar" className="min-w-0" />
      <DockTabs variant="bar" />
    </nav>
  )
}

/**
 * Strip + bottom bar, positioned. Mount once inside GameUI's full-screen layer (z-30; the strip sits at z-40).
 * Reads the panel state itself: with a side panel (desktop, landscape phone) the strip stays left of it; with the
 * portrait sheet the strip goes above the sheet.
 */
export function BottomStack() {
  const mode = useLayoutMode()
  const vw = useVw()
  const panelOpen = useGameStore((s) => s.ui.panel !== null)
  // Portrait: the sheet's top edge + GAP, as measured into the scene inset (only used while the sheet is open).
  const sheetInset = useGameStore((s) => s.ui.sceneInset.bottom)
  const layout = mode === 'portrait' ? 'mobile' : mode
  const compact = mode !== 'desktop'
  const sheetOpen = mode === 'portrait' && panelOpen
  const stripH = compact ? STRIP_H_MOBILE : STRIP_H
  const stripRight = mode !== 'portrait' && panelOpen ? panelWidth(vw, mode) + GAP : 0
  // Reserved strip slot (the camera does not jump with each message), except on a landscape phone: 44px of a
  // ~390px-tall screen is worth more to the scene, so there the strip overlays the scene's bottom edge.
  const reserve = mode === 'desktop' || (mode === 'portrait' && !sheetOpen)

  const barH = mode === 'desktop' ? BAR_H : mode === 'landscape' ? LANDSCAPE_BAR_H : MOBILE_BOTTOM_H
  const bottom = `max(${EDGE}px, env(safe-area-inset-bottom, 0px))`

  return (
    <>
      <div data-scene-bottom="" className="pointer-events-none absolute z-[41] flex flex-col" style={{ left: EDGE, right: EDGE, bottom, gap: GAP }}>
        {reserve && <div aria-hidden="true" style={{ height: stripH }} />}
        <BottomBar layout={layout} sheetOpen={sheetOpen} />
      </div>
      {/* One strip instance (its queue survives the sheet opening); only its position changes. */}
      <div
        className="pointer-events-none absolute z-40 flex justify-center"
        style={{
          left: EDGE,
          right: EDGE + stripRight,
          height: stripH,
          bottom: sheetOpen ? sheetInset : `calc(${bottom} + ${barH + GAP}px)`,
        }}
      >
        <NotificationStrip mobile={compact} sheetOpen={sheetOpen} className="max-w-[760px]" />
      </div>
    </>
  )
}
