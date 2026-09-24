// Bottom bar + the notification strip above it (docs/LAYOUT.md §1.2, §1.4, §3, §6).
// Desktop: one full-width bar h56 (EDGE 8 from the sides and the bottom): founder energy + labelled actions on the
// left, panel tabs on the right (labels drop to icons below a 1240px bar, container query). The strip (h40, content
// max 760, centred) sits 8px above it, left of the panel when the panel is open.
// Phone: the bar has two rows (actions 44 + tabs 48 = h104); with the sheet open only the tab row stays (h56) and the
// strip floats 8px above the sheet (it then takes no part in the scene inset). Landscape phone: one row h52.
// The wrapper carries `data-scene-bottom` for useSceneInset; the strip's height is reserved even when it is empty
// so the camera does not jump with each message.
import { useSyncExternalStore } from 'react'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { useIsMobile } from '../hooks'
import { cx } from '../primitives'
import { DockTabs } from '../Dock'
import { FounderBar } from './FounderBar'
import { NotificationStrip } from './NotificationStrip'
import { BAR_H, EDGE, GAP, MOBILE_BOTTOM_H, STRIP_H, STRIP_H_MOBILE } from './tokens'
import { panelWidth } from './useSceneInset'

/** Landscape phone: one-row bar (docs/LAYOUT.md §1.4). */
const LANDSCAPE_BAR_H = 52

const LANDSCAPE_PHONE = '(pointer: coarse) and (max-height: 500px)'

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', cb)
  const mq = window.matchMedia?.(LANDSCAPE_PHONE)
  mq?.addEventListener('change', cb)
  return () => {
    window.removeEventListener('resize', cb)
    mq?.removeEventListener('change', cb)
  }
}

/** Viewport width (panel width breakpoint) and landscape-phone flag. */
function useViewport(): { vw: number; landscape: boolean } {
  const vw = useSyncExternalStore(subscribe, () => window.innerWidth, () => 1440)
  const landscape = useSyncExternalStore(subscribe, () => !!window.matchMedia?.(LANDSCAPE_PHONE).matches, () => false)
  return { vw, landscape }
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
      <nav aria-label={t('bottom.label')} className="@container ui-card pointer-events-auto flex h-[52px] items-center justify-between gap-2 bg-surface/95 px-1 backdrop-blur-sm">
        {!sheetOpen && <FounderBar variant="mobile" className="min-w-0 shrink" />}
        <DockTabs variant="bar" />
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
 * Reads the panel state itself: desktop strip stays left of the open panel, phone strip goes above the sheet.
 */
export function BottomStack() {
  const mobile = useIsMobile()
  const { vw, landscape } = useViewport()
  const panelOpen = useGameStore((s) => s.ui.panel !== null)
  // Phone: the sheet's top edge + GAP, as measured into the scene inset (only used while the sheet is open).
  const sheetInset = useGameStore((s) => s.ui.sceneInset.bottom)
  const layout = mobile ? (landscape ? 'landscape' : 'mobile') : 'desktop'
  const sheetOpen = mobile && panelOpen
  const stripH = mobile ? STRIP_H_MOBILE : STRIP_H
  const stripRight = !mobile && panelOpen ? panelWidth(vw) + GAP : 0

  const barH = layout === 'desktop' ? BAR_H : layout === 'landscape' ? LANDSCAPE_BAR_H : MOBILE_BOTTOM_H
  const bottom = `max(${EDGE}px, env(safe-area-inset-bottom, 0px))`

  return (
    <>
      <div data-scene-bottom="" className="pointer-events-none absolute z-[41] flex flex-col" style={{ left: EDGE, right: EDGE, bottom, gap: GAP }}>
        {/* Reserved strip slot: kept even when the strip is empty so the camera does not jump with each message.
            Phone with the sheet open: the strip floats above the sheet and takes no part in the inset. */}
        {!sheetOpen && <div aria-hidden="true" style={{ height: stripH }} />}
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
        <NotificationStrip mobile={mobile} sheetOpen={sheetOpen} className="max-w-[760px]" />
      </div>
    </>
  )
}
