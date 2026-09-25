// Panel tabs: Mağaza · Ekip · Projeler · Büyüme · Metrikler · Kazanımlar. They live in the bottom bar
// (layout/BottomBar.tsx, docs/LAYOUT.md §1); the tab content opens in the single RightPanel (a tab replaces whatever
// the panel showed, the same tab again closes it). Badges (§4.1): counters in brand, a leaving employee in warning.
import { useGameStore } from '../store/gameStore'
import type { DockTab } from '../store/types'
import { unseenMetrics } from '../store/metricPins'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { cx } from './primitives'

export interface DockTabDef {
  id: DockTab
  icon: IconName
  /** Desktop keyboard shortcut (lowercase). */
  key: string
}

export const DOCK_TABS: DockTabDef[] = [
  { id: 'shop', icon: 'bag', key: 'm' },
  { id: 'team', icon: 'users', key: 'e' },
  { id: 'projects', icon: 'rocket', key: 'p' },
  { id: 'growth', icon: 'growth', key: 'b' },
  { id: 'metrics', icon: 'bars', key: 'g' },
  { id: 'journal', icon: 'book', key: 'k' },
]

type BadgeTone = 'brand' | 'warn'

function useBadges(): Partial<Record<DockTab, { n: number; tone: BadgeTone }>> {
  const leaving = useGameStore((s) => s.state.employees.filter((e) => e.status === 'leaving').length)
  const waiting = useGameStore((s) => s.state.concepts.minimized.length)
  const fresh = useGameStore((s) => unseenMetrics(s.state.unlockedWidgets, s.ui.seenMetrics).length)
  return {
    team: { n: leaving, tone: 'warn' },
    journal: { n: waiting, tone: 'brand' },
    metrics: { n: fresh, tone: 'brand' },
  }
}

/**
 * The tab buttons. `bar`: desktop bottom bar, h40, icon + label; labels drop to icons below a 1240px bar
 * (container query on the bar), the active tab keeps its label. `mobile`: phone row, icon 20 + 10px label, h48.
 * `touch` (landscape phone bar): the `bar` row with 44px targets. The row always keeps to the bar's right end.
 */
export function DockTabs({ variant, touch = false }: { variant: 'bar' | 'mobile'; touch?: boolean }) {
  const active = useGameStore((s) => s.ui.panel?.kind)
  const togglePanel = useGameStore((s) => s.togglePanel)
  const badges = useBadges()

  if (variant === 'mobile') {
    return (
      <div className="ui-scroll flex h-12 min-w-0 items-stretch gap-1 overflow-x-auto" role="tablist" aria-label={t('bottom.tabs')}>
        {DOCK_TABS.map((d) => {
          const on = active === d.id
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => togglePanel(d.id)}
              className={cx('relative flex min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-control text-[10px] font-semibold', on ? 'bg-brand-soft text-brand-ink' : 'text-ink-2')}
            >
              <Icon name={d.icon} size={20} />
              <span className="whitespace-nowrap leading-none">{t(`dock.${d.id}`)}</span>
              <Badge b={badges[d.id]} inset />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-1" role="tablist" aria-label={t('bottom.tabs')}>
      {DOCK_TABS.map((d) => {
        const on = active === d.id
        const label = t(`dock.${d.id}`)
        return (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => togglePanel(d.id)}
            aria-label={label}
            title={`${label} (${d.key.toUpperCase()})`}
            className={cx(
              'relative flex items-center justify-center gap-2 rounded-control text-[13px] font-semibold transition-colors',
              touch ? 'h-11 min-w-11' : 'h-10 min-w-10',
              on ? 'bg-brand px-3 text-on-ink' : 'px-2.5 text-ink-2 hover:bg-surface-2 hover:text-ink @min-[1240px]:px-3',
            )}
          >
            <Icon name={d.icon} size={18} className="shrink-0" />
            <span className={cx('whitespace-nowrap', !on && 'hidden @min-[1240px]:inline')}>{label}</span>
            <Badge b={badges[d.id]} />
          </button>
        )
      })}
    </div>
  )
}

/** `inset`: inside the button (phone row scrolls sideways, which would clip a badge that sticks out). */
function Badge({ b, inset }: { b?: { n: number; tone: BadgeTone }; inset?: boolean }) {
  if (!b?.n) return null
  return (
    <span
      className={cx(
        inset ? 'right-[calc(50%-20px)] top-0.5' : '-right-1 -top-1',
        'tabular absolute grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold leading-4 ring-2 ring-surface',
        b.tone === 'warn' ? 'bg-energy-ink text-on-ink' : 'bg-brand text-on-ink',
      )}
    >
      {b.n}
    </span>
  )
}
