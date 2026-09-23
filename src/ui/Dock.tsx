// Bottom dock: Mağaza · Ekip · Projeler · Büyüme · Defter. Desktop = floating bar + panel above,
// mobile = fixed bottom icon bar + full-width sheet.
import type { ComponentType } from 'react'
import { useGameStore } from '../store/gameStore'
import type { DockTab } from '../store/types'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { cx, IconButton } from './primitives'
import { useIsMobile } from './hooks'
import { ShopPanel } from './panels/ShopPanel'
import { TeamPanel } from './panels/TeamPanel'
import { ProjectsPanel } from './panels/ProjectsPanel'
import { GrowthPanel } from './panels/GrowthPanel'
import { JournalPanel } from './panels/JournalPanel'

export interface DockTabDef {
  id: DockTab
  icon: IconName
  /** Desktop keyboard shortcut (lowercase). */
  key: string
  Panel: ComponentType
}

export const DOCK_TABS: DockTabDef[] = [
  { id: 'shop', icon: 'bag', key: 'm', Panel: ShopPanel },
  { id: 'team', icon: 'users', key: 'e', Panel: TeamPanel },
  { id: 'projects', icon: 'rocket', key: 'p', Panel: ProjectsPanel },
  { id: 'growth', icon: 'growth', key: 'b', Panel: GrowthPanel },
  { id: 'journal', icon: 'book', key: 'd', Panel: JournalPanel },
]

function useBadges(): Partial<Record<DockTab, number>> {
  const leaving = useGameStore((s) => s.state.employees.filter((e) => e.status === 'leaving').length)
  const waiting = useGameStore((s) => s.state.concepts.minimized.length)
  return { team: leaving, journal: waiting }
}

export function Dock() {
  const tab = useGameStore((s) => s.ui.dockTab)
  const setDockTab = useGameStore((s) => s.setDockTab)
  const select = useGameStore((s) => s.select)
  const hasDetail = useGameStore((s) => s.ui.selection !== null)
  const mobile = useIsMobile()
  const badges = useBadges()
  const active = DOCK_TABS.find((d) => d.id === tab)
  const toggle = (id: DockTab) => {
    // Phones: one sheet at a time, the dock sheet replaces the detail sheet.
    if (mobile && tab !== id) select(null)
    setDockTab(tab === id ? null : id)
  }

  if (mobile) {
    return (
      <>
        {active && (
          <div className="pointer-events-auto fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] z-20 flex max-h-[62vh] animate-slide-up flex-col rounded-t-[var(--radius-card)] border-t border-cream-300 bg-cream-50 shadow-[var(--shadow-pop)] landscape:max-h-[72vh]">
            <PanelHeader tab={active} onClose={() => setDockTab(null)} />
            <div className="ui-scroll min-h-0 flex-1 px-3 pb-3">
              <active.Panel />
            </div>
          </div>
        )}
        <nav
          className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 border-t border-cream-300 bg-cream-50/95 backdrop-blur safe-bottom safe-x"
          aria-label={t('dock.label')}
        >
          <div className="flex h-16 items-stretch justify-around">
            {DOCK_TABS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggle(d.id)}
                aria-pressed={tab === d.id}
                className={cx('relative flex min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold', tab === d.id ? 'text-ink-900' : 'text-ink-600')}
              >
                <span className={cx('grid h-8 w-12 place-items-center rounded-full transition-colors', tab === d.id && 'bg-lilac-100 text-lilac-500')}>
                  <Icon name={d.icon} size={20} />
                </span>
                {t(`dock.${d.id}`)}
                <Badge n={badges[d.id]} />
              </button>
            ))}
          </div>
        </nav>
      </>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3">
      {active && (
        <div
          className={cx(
            'pointer-events-auto ui-card flex max-h-[min(58vh,560px)] animate-slide-up flex-col overflow-hidden',
            // With the right detail panel open (380px + gutter), shift left so the two never overlap.
            hasDetail ? 'w-[min(720px,calc(100vw-380px-3rem))] self-start' : 'w-[min(720px,calc(100vw-2rem))]',
          )}
        >
          <PanelHeader tab={active} onClose={() => setDockTab(null)} />
          <div className="ui-scroll min-h-0 flex-1 px-4 pb-4">
            <active.Panel />
          </div>
        </div>
      )}
      <nav className="pointer-events-auto ui-card flex items-center gap-1 p-1.5" aria-label={t('dock.label')}>
        {DOCK_TABS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => toggle(d.id)}
            aria-pressed={tab === d.id}
            title={`${t(`dock.${d.id}`)} (${d.key.toUpperCase()})`}
            className={cx(
              'relative flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors',
              tab === d.id ? 'bg-ink-900 text-cream-50' : 'text-ink-700 hover:bg-cream-200/80',
            )}
          >
            <Icon name={d.icon} size={18} />
            {t(`dock.${d.id}`)}
            <kbd className={cx('hidden rounded px-1 text-[10px] font-bold xl:inline', tab === d.id ? 'bg-ink-700 text-cream-200' : 'bg-cream-200 text-ink-600')}>{d.key.toUpperCase()}</kbd>
            <Badge n={badges[d.id]} />
          </button>
        ))}
      </nav>
    </div>
  )
}

function PanelHeader({ tab, onClose }: { tab: DockTabDef; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
        <Icon name={tab.icon} size={18} className="text-lilac-500" />
        {t(`dock.${tab.id}`)}
      </h2>
      <IconButton icon="close" label={t('common.close')} onClick={onClose} />
    </div>
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
