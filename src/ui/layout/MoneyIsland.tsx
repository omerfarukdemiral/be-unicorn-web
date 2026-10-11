// Desktop bottom-left corner island (docs/LAYOUT.md §1.2, "dört köşe"): Kasa as the screen's hero number (32px) over
// the other fixed gauges and the pinned metrics, and under them the horizon row (payday clock, upcoming; T05). Pins wrap to a third row instead of widening the island (max 500: one row with two pins at 1440 once the word labels went, T08).
// Positions itself (absolute, EDGE from the left and the bottom); BottomStack reads its width so the founder island and
// the strip start right of it. Phones keep the gauges in the top bar (TopBar › GaugeRow).
import { forwardRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { ActivityHistory } from '../ActivityLine'
import { useExclusiveExpander } from '../hooks'
import { HorizonDue, HorizonList, HorizonLoan, HorizonMini, PaydayCountdown } from '../Horizon'
import type { HudWidget } from '../../engine/types'
import { Icon } from '../icons'
import { t } from '../i18n'
import { BARE_HOVER, cx } from '../primitives'
import { PinnedMetric, visiblePins } from '../widgets'
import { PaydayCard } from './PaydayCard'
import { CashChip, MoraleChip, RunwayChip, UsersChip } from './TopMetrics'
import { EDGE, PIN_VISIBLE } from './tokens'

/** Always-on gauges of the island: never pinnable, never in Metrikler. */
const FIXED: readonly HudWidget[] = ['cash', 'runway', 'users', 'morale']

export interface MoneyIslandProps {
  /** Effective pinned metric ids, oldest first (widgets.tsx › usePinnedMetrics). The newest ones win the room. */
  pinned: HudWidget[]
  /** Opens Metrikler (the "+N" button when the width shows fewer pins than there are). */
  onOpenMetrics?: () => void
  /** Viewport width (pin room). */
  vw: number
}

export const MoneyIsland = forwardRef<HTMLDivElement, MoneyIslandProps>(function MoneyIsland({ pinned, onOpenMetrics, vw }, ref) {
  const pins = pinned.filter((id, i) => !FIXED.includes(id) && pinned.indexOf(id) === i).slice(-2)
  const visible = visiblePins(pins, PIN_VISIBLE(vw))
  const hidden = pins.length - visible.length
  const more = visible.length > 0 ? t('top.pinnedMore', { n: hidden }) : t('top.pinnedAll', { n: hidden })
  const hasHorizon = useGameStore((s) => !!s.state.derived.horizon?.length)
  const [open, setOpen] = useExclusiveExpander()

  return (
    <div
      ref={ref}
      role="group"
      // Outside the data-scene-bottom wrapper: a bubble laid out under it could not be tapped.
      data-scene-obstacle=""
      data-scene-island=""
      aria-label={t('top.gauges')}
      className="ui-card pointer-events-auto absolute z-[41] flex max-w-[500px] flex-col gap-1 px-2.5 pb-3 pt-2"
      style={{ left: EDGE, bottom: `max(${EDGE}px, env(safe-area-inset-bottom, 0px))` }}
    >
      <PaydayCard />
      <CashChip density="full" hero />
      {/* overflow-visible: Runway's danger-pulse ring, Moral's bar and a value's pop-once swell hang outside the cells. */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-3">
        <div className="shrink-0 empty:hidden">
          <RunwayChip density="full" />
        </div>
        <UsersChip density="full" />
        <MoraleChip density="full" />
        {visible.map((id) => (
          // Natural width (no clip): "+$8.2M/ay" over "Kâr tahmini" is ~150px; the row wraps instead of cutting the cell.
          <PinnedMetric key={id} id={id} className="h-10 shrink-0" />
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={onOpenMetrics}
            title={more}
            aria-label={more}
            className={cx(
              'ui-num inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-0.5 rounded-full px-2 text-[12px] text-ink-2 transition-colors hover:text-ink',
              BARE_HOVER,
            )}
          >
            <Icon name="bars" size={16} />
            {visible.length > 0 ? `+${hidden}` : hidden}
          </button>
        )}
      </div>
      {/* The horizon (T05, from the old strip): payday clock against the till, the desk's deadline, the loan check,
          the nearest upcoming items; the row opens the popover (upcoming + recent). */}
      {hasHorizon && (
        <div className="-mx-1 -mb-1 mt-1 flex h-9 min-w-0 items-center gap-1 border-t border-border pt-1">
          <PaydayCountdown />
          <HorizonDue />
          <HorizonLoan />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={t('strip.more')}
            title={t('strip.more')}
            className={cx('flex h-full min-w-0 flex-1 items-center justify-between gap-1 rounded-md px-1', BARE_HOVER)}
          >
            <HorizonMini max={1} />
            <Icon name={open ? 'chevronDown' : 'chevronUp'} size={16} className="shrink-0 text-ink-2" />
          </button>
        </div>
      )}
      {open && (
        <div className="ui-card ui-scroll absolute bottom-[calc(100%+8px)] left-0 z-10 max-h-[320px] w-[360px] animate-slide-up overflow-y-auto p-1">
          <p className="ui-label px-2 pb-1 pt-1.5">{t('strip.upcoming')}</p>
          <HorizonList />
          <div className="my-1 h-px bg-border" />
          <p className="ui-label px-2 pb-1 pt-1.5">{t('strip.recent')}</p>
          <ActivityHistory />
        </div>
      )}
    </div>
  )
})
