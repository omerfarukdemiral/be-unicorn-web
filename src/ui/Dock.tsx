// Dock: Mağaza · Ekip · Projeler · Büyüme · Defter. Only the tab bar lives here; the tab content opens in
// the single RightPanel (a tab replaces whatever the panel showed, the same tab again closes it).
// Desktop = floating bar at the bottom of the scene area, mobile = fixed bottom icon bar.
import { useGameStore } from '../store/gameStore'
import type { DockTab } from '../store/types'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { cx } from './primitives'
import { useIsMobile } from './hooks'

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
  { id: 'journal', icon: 'book', key: 'd' },
]

function useBadges(): Partial<Record<DockTab, number>> {
  const leaving = useGameStore((s) => s.state.employees.filter((e) => e.status === 'leaving').length)
  const waiting = useGameStore((s) => s.state.concepts.minimized.length)
  return { team: leaving, journal: waiting }
}

export function Dock({ compact }: { /** Desktop with the panel open and little room: icons only below lg. */ compact?: boolean }) {
  const active = useGameStore((s) => s.ui.panel?.kind)
  const togglePanel = useGameStore((s) => s.togglePanel)
  const mobile = useIsMobile()
  const badges = useBadges()

  if (mobile) {
    return (
      <nav className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 border-t border-cream-300 bg-cream-50/95 backdrop-blur safe-bottom safe-x" aria-label={t('dock.label')}>
        <div className="flex h-16 items-stretch justify-around">
          {DOCK_TABS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => togglePanel(d.id)}
              aria-pressed={active === d.id}
              className={cx('relative flex min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold', active === d.id ? 'text-ink-900' : 'text-ink-600')}
            >
              <span className={cx('grid h-8 w-12 place-items-center rounded-full transition-colors', active === d.id && 'bg-lilac-100 text-lilac-500')}>
                <Icon name={d.icon} size={20} />
              </span>
              {t(`dock.${d.id}`)}
              <Badge n={badges[d.id]} />
            </button>
          ))}
        </div>
      </nav>
    )
  }

  return (
    <nav className="pointer-events-auto ui-card flex items-center gap-1 p-1.5" aria-label={t('dock.label')}>
      {DOCK_TABS.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => togglePanel(d.id)}
          aria-pressed={active === d.id}
          aria-label={t(`dock.${d.id}`)}
          title={`${t(`dock.${d.id}`)} (${d.key.toUpperCase()})`}
          className={cx(
            'relative flex h-11 items-center gap-2 rounded-full text-sm font-bold transition-colors',
            compact ? 'px-3 lg:px-4' : 'px-4',
            active === d.id ? 'bg-ink-900 text-cream-50' : 'text-ink-700 hover:bg-cream-200/80',
          )}
        >
          <Icon name={d.icon} size={18} />
          <span className={cx(compact && 'hidden lg:inline')}>{t(`dock.${d.id}`)}</span>
          <kbd className={cx('hidden rounded px-1 text-[10px] font-bold', !compact && 'xl:inline', active === d.id ? 'bg-ink-700 text-cream-200' : 'bg-cream-200 text-ink-600')}>{d.key.toUpperCase()}</kbd>
          <Badge n={badges[d.id]} />
        </button>
      ))}
    </nav>
  )
}

function Badge({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold leading-4 text-cream-50 md:-right-1 md:-top-1">
      {n}
    </span>
  )
}
