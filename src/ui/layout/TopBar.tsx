// Top bar (docs/LAYOUT.md §1.2–§1.4): ONE full-width strip, h56 on desktop, 2 rows (h96) on phones.
//   A: stage · date · progress · round   |   B: Kasa Runway Kullanıcı Moral │ pinned ≤ 2   |   C: speed │ zoom (TR) ⚙
// Positions itself (absolute, EDGE 8 from the top of its parent, which already carries the safe-area padding
// like GameUI's root). Root carries `data-scene-top` (sceneInset + BubbleAnchor read it).
// Contract: `pinned` comes from the caller (Integrate binds ui.pinnedMetrics); this file never reads it.
import { useSyncExternalStore } from 'react'
import type { HudWidget } from '../../engine/types'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx } from '../primitives'
import { useLayoutMode } from '../hooks'
import { PIN_VISIBLE } from './tokens'
import { StageProgressLine, StageSection } from './StageSection'
import { CashChip, MoraleChip, RunwayChip, UsersChip, type MetricDensity } from './TopMetrics'
import { PinnedMetric, visiblePins } from '../widgets'
import { SpeedControl } from './SpeedControl'
import { ViewControls } from './ViewControls'

/** Always-on gauges of the bar: never pinnable, never in Metrikler. */
const FIXED: readonly HudWidget[] = ['cash', 'runway', 'users', 'morale']

function subscribeResize(cb: () => void): () => void {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

/** Viewport size as "w×h" (one string so the snapshot stays stable between resizes). */
function useViewport(): { w: number; h: number } {
  const key = useSyncExternalStore(
    subscribeResize,
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => '1440x900',
  )
  const [w, h] = key.split('x').map(Number)
  return { w: w ?? 1440, h: h ?? 900 }
}

function Rule() {
  return <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />
}

export interface TopBarProps {
  /** Effective pinned metric ids, oldest first (widgets.tsx › usePinnedMetrics). The newest ones win the room. */
  pinned: HudWidget[]
  /** Opens Metrikler (the "+N" button when the width shows fewer pins than there are). */
  onOpenMetrics?: () => void
}

export function TopBar({ pinned, onOpenMetrics }: TopBarProps) {
  const mode = useLayoutMode()
  const { w } = useViewport()
  // The caller passes the effective pins (usePinnedMetrics: pinned ∩ unlocked); fixed gauges and repeats are skipped.
  const pins = pinned.filter((id, i) => !FIXED.includes(id) && pinned.indexOf(id) === i).slice(-2)

  if (mode === 'landscape') return <LandscapeBar />
  if (mode === 'portrait') return <MobileBar />

  const wide = w >= 1280
  const density: MetricDensity = wide ? 'full' : 'tight'
  const visible = visiblePins(pins, PIN_VISIBLE(w))
  const hidden = pins.length - visible.length

  return (
    <header
      data-scene-top
      aria-label={t('top.label')}
      className="ui-card pointer-events-auto absolute inset-x-2 top-2 z-30 flex h-14 items-center gap-2 px-2"
    >
      <StageSection variant={wide ? 'wide' : 'narrow'} />
      <Rule />
      <div className="flex min-w-0 flex-1 items-center justify-center-safe overflow-hidden">
        {/* Cells size to their content (labels and values never cut); min widths keep them from jumping per tick. */}
        <div className={cx('shrink-0', wide ? 'min-w-32' : 'min-w-28')}>
          <CashChip density={density} />
        </div>
        <div className={cx('shrink-0 empty:hidden', wide && 'min-w-[88px]')}>
          <RunwayChip density={density} />
        </div>
        <div className={cx('shrink-0', wide && 'min-w-[88px]')}>
          <UsersChip density={density} />
        </div>
        <div className="shrink-0">
          <MoraleChip density={density} />
        </div>
        {(visible.length > 0 || hidden > 0) && <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />}
        {visible.map((id) => (
          <PinnedMetric key={id} id={id} className="h-10 max-w-[136px] shrink-0 overflow-hidden" />
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={onOpenMetrics}
            title={visible.length > 0 ? t('top.pinnedMore', { n: hidden }) : t('top.pinnedAll', { n: hidden })}
            aria-label={visible.length > 0 ? t('top.pinnedMore', { n: hidden }) : t('top.pinnedAll', { n: hidden })}
            className="tabular inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-0.5 rounded-control px-1.5 text-[11px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="bars" size={16} />
            {visible.length > 0 ? `+${hidden}` : hidden}
          </button>
        )}
      </div>
      <Rule />
      {/* Below 1440 the status label lives in the segments' title (the dashed chosen speed + neutral ⏸ still show it):
          at 1280 the label would push the pinned metric out. */}
      <SpeedControl showLabel={w >= 1440} />
      <Rule />
      {/* TR (placeholder, opens Settings) needs ≥1536: at 1440 a running round + 2 pins already fill the bar. */}
      <ViewControls size={wide ? 40 : 36} showLanguage={w >= 1536} />
    </header>
  )
}

/**
 * Phone / tablet portrait: row 1 stage · date · round | speed ⚙ (44px targets; zoom is pinch + Settings, which frees
 * the room the stage name and date need at 360–390px); 2px progress; row 2 the four gauges, content-sized cells
 * spread edge to edge (a long value like "$10.2M" or "999.9K" takes the room a short "∞" leaves).
 */
function MobileBar() {
  return (
    <header
      data-scene-top
      aria-label={t('top.label')}
      className="ui-card pointer-events-auto absolute inset-x-2 top-2 z-30 flex flex-col px-1 py-0.5"
    >
      <div className="flex h-11 min-w-0 items-center gap-1 pl-1.5">
        <StageSection variant="mobile" />
        <SpeedControl compact />
        <ViewControls size={44} showZoom={false} />
      </div>
      <StageProgressLine className="mx-1.5" />
      <GaugeRow />
    </header>
  )
}

/** The four gauges on a compact bar: auto-width cells, spread with equal gaps; an empty Runway slot takes no room. */
function GaugeRow({ className }: { className?: string }) {
  return (
    <div className={cx('flex h-11 min-w-0 items-center justify-between gap-0.5', className)}>
      <CashChip density="mobile" />
      <RunwayChip density="mobile" />
      <UsersChip density="mobile" />
      <MoraleChip density="mobile" />
    </div>
  )
}

/** Phone landscape: one row (stage · 4 gauges · speed · ⚙), h52. */
function LandscapeBar() {
  return (
    <header
      data-scene-top
      aria-label={t('top.label')}
      className="ui-card pointer-events-auto absolute inset-x-2 top-2 z-30 flex h-[52px] min-w-0 items-center gap-1 px-1.5"
    >
      <div className="flex min-w-0 max-w-[30%] flex-1 items-center">
        <StageSection variant="mobile" />
      </div>
      <GaugeRow className="flex-[2]" />
      <SpeedControl compact />
      <ViewControls size={44} showZoom={false} />
    </header>
  )
}
