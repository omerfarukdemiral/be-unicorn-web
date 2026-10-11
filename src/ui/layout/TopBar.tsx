// Top bar (docs/LAYOUT.md §1.2–§1.4). Desktop ("dört köşe", T03): no strip, two corner islands over the scene:
//   top-left: stage · date · progress · round                top-right: speed │ zoom (TR) ⚙ (two islands)
// The gauges live in the bottom-left money island (MoneyIsland, mounted by BottomStack). Phones: portrait = a gauge
// island + a round ⏸ island in one row (T06), the stage as a tag under it; landscape = the same islands in one row (T23).
// Positions itself (absolute, EDGE 8 from the top of its parent, which already carries the safe-area padding
// like GameUI's root). Root carries `data-scene-top` (sceneInset + BubbleAnchor read it): on desktop it is the
// pointer-transparent row that holds the islands, so the inset is the islands' height, as before.
import { useSyncExternalStore, type ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { cx } from '../primitives'
import { useLayoutMode } from '../hooks'
import { NextStepChip, useNextStep } from '../NextStepChip'
import { nextStepShown } from './stripRules'
import { StageProgressLine, StageSection } from './StageSection'
import { CashChip, MoraleChip, RunwayChip, UsersChip } from './TopMetrics'
import { SpeedControl } from './SpeedControl'
import { ViewControls } from './ViewControls'
import { LANDSCAPE_BAR_H, MOBILE_TOP_H } from './tokens'

function subscribeResize(cb: () => void): () => void {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

/** Viewport width (one number, re-read on resize). */
function useViewportWidth(): number {
  return useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 1440)
}

/** One corner island: the soft card, h56, content centred. */
function Island({ className, children }: { className?: string; children: ReactNode }) {
  return <div data-scene-island="" className={cx('ui-card pointer-events-auto flex h-14 shrink-0 items-center', className)}>{children}</div>
}

/**
 * The garage's next step (T05, was the strip's resting row): a small card hanging under the stage island, like a
 * sim's objective tag. Absolutely placed, so the scene inset stays the islands' height. Same rules as the strip had.
 */
function GoalChip() {
  const step = useNextStep()
  const shown = nextStepShown({ hasStep: !!step.step, startCall: step.startCall, stepId: step.step?.id, canStartRound: step.canStartRound, over: step.over, sheetOpen: false })
  if (!shown) return null
  return (
    // Absolute, so the header's rect leaves it out: an obstacle of its own for the bubble layout.
    <div data-scene-obstacle="" className="ui-card pointer-events-auto absolute left-0 top-[calc(100%+8px)] flex h-10 w-max max-w-[360px] items-center overflow-hidden px-2">
      <NextStepChip />
    </div>
  )
}

export function TopBar() {
  const mode = useLayoutMode()
  const w = useViewportWidth()

  if (mode === 'landscape') return <LandscapeBar />
  if (mode === 'portrait') return <MobileBar />

  return (
    <header
      data-scene-top
      aria-label={t('top.label')}
      className="pointer-events-none absolute inset-x-2 top-2 z-30 flex items-start justify-between gap-2"
    >
      <div className="relative min-w-0">
        <Island className="min-w-0 px-3">
          <StageSection variant={w >= 1280 ? 'wide' : 'narrow'} />
        </Island>
        <GoalChip />
      </div>
      <div className="flex shrink-0 items-start gap-2">
        <Island className="px-1.5">
          {/* No hold label: the red ⏸ / green speed segment already say it, and the island keeps one width. */}
          <SpeedControl showLabel={false} />
        </Island>
        {/* TR (placeholder, opens Settings) only on a wide screen: the stage island needs the row below 1536. */}
        <Island className="px-1.5">
          <ViewControls size={36} showLanguage={w >= 1536} showZoom />
        </Island>
      </div>
    </header>
  )
}

/**
 * Phone / tablet portrait (T06, "tek sıra"): one row of islands, the gauge island (content-sized cells spread edge to
 * edge) and the round ⏸ island; the stage (name · date · round · progress) hangs under it as a small tag, absolutely
 * placed so the scene inset stays the row's 52px. Kazanımlar, İstatistik and ⚙ live behind the tab island's ⋯
 * (BottomBar › MoreMenu); zoom is pinch + Settings. The full-page sheet covers the tag, so it hides then.
 */
function MobileBar() {
  const sheetOpen = useGameStore((s) => s.ui.panel !== null)
  return (
    <header
      data-scene-top
      aria-label={t('top.label')}
      className="pointer-events-none absolute inset-x-2 top-2 z-30 flex items-start gap-2"
      style={{ height: MOBILE_TOP_H }}
    >
      <div className="relative min-w-0 flex-1">
        {/* Cells keep their natural width (a cut "$216…" reads as a bug); 360px leaves ~4px spare, hence the 48px ⏸. */}
        <div data-scene-island="" className="ui-card pointer-events-auto flex min-w-0 items-center px-1" style={{ height: MOBILE_TOP_H }}>
          <GaugeRow className="flex-1 [&>*]:shrink-0" />
        </div>
        {!sheetOpen && (
          <div data-scene-obstacle="" data-scene-island="" className="ui-card pointer-events-auto absolute left-0 top-[calc(100%+8px)] flex max-w-full flex-col px-2.5 pb-1.5">
            <StageSection variant="mobile" />
            <StageProgressLine className="-mt-1" />
          </div>
        )}
      </div>
      <div data-scene-island="" className="ui-card pointer-events-auto grid w-12 shrink-0 place-items-center rounded-full" style={{ height: MOBILE_TOP_H }}>
        <SpeedControl compact />
      </div>
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

/**
 * Phone landscape (T23): one row of islands, h52, like the portrait row: stage | gauges | round ⏸. Kazanımlar,
 * İstatistik and ⚙ live behind the tab island's ⋯ (BottomBar › MoreMenu), as in portrait.
 */
function LandscapeBar() {
  return (
    <header
      data-scene-top
      aria-label={t('top.label')}
      className="pointer-events-none absolute inset-x-2 top-2 z-30 flex min-w-0 items-start gap-2"
      style={{ height: LANDSCAPE_BAR_H }}
    >
      <div data-scene-island="" className="ui-card pointer-events-auto flex h-full min-w-0 max-w-[300px] flex-1 flex-col justify-center px-2.5 pb-1">
        <StageSection variant="mobile" />
        <StageProgressLine className="-mt-1.5" />
      </div>
      <div data-scene-island="" className="ui-card pointer-events-auto ml-auto flex h-full shrink-0 items-center px-1">
        <GaugeRow className="gap-2 [&>*]:shrink-0" />
      </div>
      <div data-scene-island="" className="ui-card pointer-events-auto grid h-full w-12 shrink-0 place-items-center rounded-full">
        <SpeedControl compact />
      </div>
    </header>
  )
}
