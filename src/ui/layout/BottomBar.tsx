// Bottom bar + the notification strip above it (docs/LAYOUT.md §1.2, §1.4, §3, §6).
// Desktop ("dört köşe", T04): no bar. The money island holds the bottom-left corner (MoneyIsland); right of it the
// founder island (energy + moves + 44px ability slots, names only in tooltips, docs/GAMEPLAY_V2.md §10.4) is centred
// and the panel tabs sit in the bottom-right corner, icon only. No strip band (T05): a message pill (h40, max 560)
// floats 8px above the founder island only while it speaks; the next step hangs under the stage island and the
// horizon (payday clock, upcoming) sits in the money island.
// Portrait phone (T06): the founder island over the tab island (h56 each, h120); with the full-page sheet open only the
// tab island stays and the strip floats over the sheet's foot (it then takes no part in the scene inset).
// Landscape phone (T23): the same two islands in one row h52, 44px tabs, a side panel (no sheet) and the strip
// overlaying the scene's bottom edge (no reserved slot).
// The wrapper carries `data-scene-bottom` for useSceneInset; on desktop / portrait the strip's height is reserved
// even when it is empty so the camera does not jump with each message. The layout mode comes from useLayoutMode.
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { HudWidget } from '../../engine/types'
import { useGameStore, waitingConcepts } from '../../store/gameStore'
import { t } from '../i18n'
import { useExclusiveExpander, useLayoutMode } from '../hooks'
import { Icon } from '../icons'
import { cx } from '../primitives'
import { DockTabs } from '../Dock'
import { FounderBar } from './FounderBar'
import { MoneyIsland } from './MoneyIsland'
import { NotificationStrip } from './NotificationStrip'
import { ViewControls } from './ViewControls'
import { BAR_H, EDGE, GAP, LANDSCAPE_BAR_H, MOBILE_BOTTOM_H, MOBILE_BOTTOM_TABS_H, STRIP_H, STRIP_H_MOBILE } from './tokens'
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
export function BottomBar({ layout, sheetOpen = false, narrow = false }: { layout: 'desktop' | 'mobile' | 'landscape'; sheetOpen?: boolean; narrow?: boolean }) {
  if (layout === 'mobile') {
    // Portrait (T06): two islands on a pointer-transparent column, the founder island over the tab island (icon keys + ⋯),
    // both h56 and centred. The full-page sheet keeps only the tab island.
    return (
      <nav aria-label={t('bottom.label')} className="pointer-events-none flex flex-col items-center gap-2">
        {!sheetOpen && (
          <div data-scene-island="" className="ui-card pointer-events-auto flex h-14 max-w-full items-center px-2">
            <FounderBar variant="mobile" className="h-11" />
          </div>
        )}
        <div data-scene-island="" className="ui-card pointer-events-auto relative flex h-14 items-center gap-1 px-1">
          <DockTabs variant="mobile" labels={false} />
          <MoreMenu />
        </div>
      </nav>
    )
  }
  if (layout === 'landscape') {
    return (
      // T23: the portrait islands side by side: founder island left (shrinks, its slots scroll), tab island right (44px
      // keys, no locked silhouettes, ⋯ for the top-right tools).
      <nav aria-label={t('bottom.label')} className="pointer-events-none flex items-center justify-between gap-2" style={{ height: LANDSCAPE_BAR_H }}>
        <div data-scene-island="" className="ui-card pointer-events-auto flex h-full min-w-0 shrink items-center px-2">
          <FounderBar variant="mobile" className="min-w-0" />
        </div>
        <div data-scene-island="" className="ui-card pointer-events-auto relative flex h-full shrink-0 items-center gap-1 px-1">
          <DockTabs variant="bar" touch locked={false} />
          <MoreMenu />
        </div>
      </nav>
    )
  }
  // Desktop (T04): two islands on a pointer-transparent row: founder actions centred in the room left of the tabs, the
  // tabs (icon only, 44px keys) in the bottom-right corner. Both h56 (BAR_H unchanged, so is the scene inset).
  return (
    <nav aria-label={t('bottom.label')} className="@container pointer-events-none flex items-end gap-2" style={{ height: BAR_H }}>
      {/* 5px top/bottom + the 1px hairline: the 44px slots fit the 56px island. */}
      <div data-scene-island="" className="ui-card pointer-events-auto mx-auto flex h-full min-w-0 items-center px-2 py-[5px]">
        <FounderBar variant="bar" trim={narrow} className="min-w-0" />
      </div>
      {/* Below 1280 the locked-tool silhouettes go (founder slots keep only the next one): the row fits beside the money island. */}
      <div data-tabs-island="" data-scene-island="" className="ui-card pointer-events-auto flex h-full shrink-0 items-center px-1.5">
        <DockTabs variant="bar" labels={false} locked={!narrow} />
      </div>
    </nav>
  )
}

/**
 * ⋯ on the portrait tab island: Kazanımlar, İstatistik, Liderlik and ⚙ (the desktop top-right tools) in a small
 * island above it. A dot on ⋯ while concepts wait to be read (the book's badge). Any pick closes it.
 */
function MoreMenu() {
  const [open, setOpen] = useExclusiveExpander()
  const waiting = useGameStore((s) => waitingConcepts(s.state).length > 0)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('bottom.more')}
        className={cx('relative grid size-12 shrink-0 place-items-center rounded-control', open ? 'bg-brand-soft text-brand-ink' : 'text-ink-2')}
      >
        <Icon name="more" size={22} />
        {waiting && !open && <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand ring-2 ring-surface" />}
      </button>
      {open && (
        <div className="ui-card pointer-events-auto absolute bottom-[calc(100%+8px)] right-0 flex animate-slide-up p-1" onClickCapture={() => setTimeout(() => setOpen(false))}>
          <ViewControls size={44} showZoom={false} />
        </div>
      )}
    </>
  )
}

/**
 * Strip + bottom bar, positioned. Mount once inside GameUI's full-screen layer (z-30; the strip sits at z-40).
 * Reads the panel state itself: with a side panel (desktop, landscape phone) the strip stays left of it; with the
 * portrait full-page sheet the strip floats over its foot.
 */
export function BottomStack({ pinned, onOpenMetrics }: { pinned: HudWidget[]; onOpenMetrics?: () => void }) {
  const mode = useLayoutMode()
  const vw = useVw()
  // Desktop: the money island holds the bottom-left corner; the founder island and the strip start right of it.
  const moneyRef = useRef<HTMLDivElement>(null)
  const [moneyW, setMoneyW] = useState(0)
  // …and the tabs island the right corner: the message pill centres over the founder island between the two.
  const [tabsW, setTabsW] = useState(0)
  useLayoutEffect(() => {
    const el = moneyRef.current
    const tabs = document.querySelector<HTMLElement>('[data-tabs-island]')
    if (!el || !tabs) {
      setMoneyW(0)
      setTabsW(0)
      return
    }
    const read = () => {
      setMoneyW(Math.round(el.offsetWidth))
      setTabsW(Math.round(tabs.offsetWidth))
    }
    const ro = new ResizeObserver(read)
    ro.observe(el)
    ro.observe(tabs)
    read()
    return () => ro.disconnect()
  }, [mode])
  const left = mode === 'desktop' ? EDGE + moneyW + GAP : EDGE
  const panelOpen = useGameStore((s) => s.ui.panel !== null)
  const layout = mode === 'portrait' ? 'mobile' : mode
  const compact = mode !== 'desktop'
  const sheetOpen = mode === 'portrait' && panelOpen
  const stripH = compact ? STRIP_H_MOBILE : STRIP_H
  // The payday desk docks into the panel's slot (OverlayFrame place="dock"): the strip re-centres in the scene left of
  // it as it does for the panel, instead of running under the desk's edge.
  const deskOpen = useGameStore((s) => s.ui.overlay?.kind === 'payday')
  const stripRight = mode !== 'portrait' && (panelOpen || deskOpen) ? panelWidth(vw, mode) + GAP : 0
  // Reserved strip slot (the camera does not jump with each message), except on a landscape phone: 44px of a
  // ~390px-tall screen is worth more to the scene, so there the strip overlays the scene's bottom edge.
  // Desktop (T05) reserves nothing either: no band, the message pill floats over the scene only while it speaks.
  const reserve = mode === 'portrait' && !sheetOpen

  const barH = mode === 'desktop' ? BAR_H : mode === 'landscape' ? LANDSCAPE_BAR_H : MOBILE_BOTTOM_H
  const bottom = `max(${EDGE}px, env(safe-area-inset-bottom, 0px))`

  return (
    <>
      {mode === 'desktop' && <MoneyIsland ref={moneyRef} pinned={pinned} onOpenMetrics={onOpenMetrics} vw={vw} />}
      <div data-scene-bottom="" className="pointer-events-none absolute z-[41] flex flex-col" style={{ left, right: EDGE, bottom, gap: GAP }}>
        {reserve && <div aria-hidden="true" style={{ height: stripH }} />}
        <BottomBar layout={layout} sheetOpen={sheetOpen} narrow={vw < 1280} />
      </div>
      {/* One strip instance (its queue survives the sheet opening); only its position changes. Floating over the
          scene (above a sheet, landscape) it is a scene obstacle: world bubbles keep clear of it. */}
      <div
        data-scene-obstacle={reserve ? undefined : ''}
        className="pointer-events-none absolute z-40 flex justify-center"
        style={{
          left,
          right: EDGE + Math.max(stripRight, mode === 'desktop' ? tabsW + GAP : 0),
          height: stripH,
          bottom: `calc(${bottom} + ${(sheetOpen ? MOBILE_BOTTOM_TABS_H : barH) + GAP}px)`,
        }}
      >
        <NotificationStrip mobile={compact} sheetOpen={sheetOpen} island={mode === 'desktop'} className={mode === 'desktop' ? 'max-w-[560px]' : 'max-w-[760px]'} />
      </div>
    </>
  )
}
