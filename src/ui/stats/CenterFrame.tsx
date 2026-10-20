// Center screen shell (docs/GAMEPLAY_V2.md §14.5): statistics, Kanun Kitabı and Pazar haritası open here, in the
// middle of the scene area between the bars (store.ui.sceneInset, viewport px: hence `fixed`), at most 960px wide.
// z-45: above the bottom stack (41), under the blocking modals (50) and the time frame (55), so the green / red
// frame stays visible and the bars stay clickable. Time keeps flowing (§14.1); a click on the scene around the card
// or Esc (shortcuts.ts) closes it. A board dealt onto the table, not a web dialog: the shared card material (.ui-card +
// --shadow-panel), the kind as a duotone sticker (identity, never a warning), no header bar and no visible title (the
// active tab names the board).
// One menu for the whole board (owner playtest: a tab strip on top plus the stats rail beside it read as two scattered
// menus): Para, Büyüme, Ekip, Profil, then Kanun Kitabı and Pazar haritası. From 900px it is a rail on the left, below
// that one scrolling strip on top. Switches never close the frame and are static (only the first open is dealt).
import type { ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'
import type { CenterKind, StatsTab } from '../../store/types'
import type { IconName } from '../icons'
import { t } from '../i18n'
import { Chip, cx, IconButton, Segmented } from '../primitives'
import { LawbookScreen } from '../center/LawbookScreen'
import { MarketScreen } from '../center/MarketScreen'
import { STATS_TABS, StatsScreen } from './StatsScreen'
import { GAP } from '../layout/tokens'
import { useMoneyIslandClearance } from '../layout/moneyClearance'

const KIND: Record<CenterKind, { icon: IconName; color: string }> = {
  stats: { icon: 'trend', color: 'var(--color-g-sky)' },
  lawbook: { icon: 'book', color: 'var(--color-g-equity)' },
  market: { icon: 'pie', color: 'var(--color-g-users)' },
}

/** Screen order. */
export const CENTER_TABS: readonly CenterKind[] = ['stats', 'lawbook', 'market']

const STATS_ICON: Record<StatsTab, IconName> = { money: 'cash', growth: 'trend', team: 'users', profile: 'compass' }

/** The menu's items: the four stats pages, then the other two boards. */
const NAV: readonly { kind: CenterKind; tab?: StatsTab; icon: IconName; text: string }[] = [
  ...STATS_TABS.map((tab) => ({ kind: 'stats' as const, tab, icon: STATS_ICON[tab], text: `stats.tab.${tab}` })),
  { kind: 'lawbook', icon: KIND.lawbook.icon, text: 'center.lawbook' },
  { kind: 'market', icon: KIND.market.icon, text: 'center.market' },
]

/** Width cap of the center card (the scene stays visible around it on a wide screen). */
export const CENTER_MAX_W = 960

export function CenterFrame({ kind, tab, onClose, children }: { kind: CenterKind; tab?: StatsTab; onClose: () => void; children?: ReactNode }) {
  const inset = useGameStore((s) => s.ui.sceneInset)
  const money = useMoneyIslandClearance()
  const openOverlay = useGameStore((s) => s.openOverlay)

  const at = kind === 'stats' ? (tab ?? 'money') : undefined
  return (
    <div
      data-center-frame={kind}
      className="pointer-events-auto fixed z-[45] flex justify-center"
      style={{ top: inset.top, bottom: inset.bottom > money ? inset.bottom : money, left: GAP, right: Math.max(GAP, inset.right) }}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-labelledby="center-title"
        onClick={(e) => e.stopPropagation()}
        // One fixed size for every page (owner playtest: the board grew and shrank with each menu click): the scene
        // height up to 680px, each page scrolls inside it.
        className={cx(
          'relative flex h-[min(100%,680px)] w-full min-w-0 flex-col self-center overflow-hidden animate-deal min-[900px]:flex-row',
          'ui-card shadow-panel',
        )}
        style={{ maxWidth: CENTER_MAX_W }}
      >
        {/* Named for screen readers only: the active item already says which board this is. */}
        <h2 id="center-title" className="sr-only">
          {t(`center.${kind}`)}
        </h2>
        <nav className="mr-11 shrink-0 overflow-x-auto py-2 pl-3 pr-3 [scrollbar-width:none] min-[900px]:mr-0 min-[900px]:overflow-visible min-[900px]:py-3 min-[900px]:pr-0">
          <Segmented label={t('center.tabs')} className="min-[900px]:w-[168px] min-[900px]:flex-col min-[900px]:items-stretch">
            {NAV.map((n, i) => (
              <span key={n.text} className={cx('contents', i === STATS_TABS.length && 'min-[900px]:[&>button]:mt-3')}>
                <Chip
                  segment
                  active={n.kind === kind && n.tab === at}
                  icon={n.icon}
                  onClick={() => (n.kind !== kind || n.tab !== at) && openOverlay(n.kind === 'stats' ? { kind: 'stats', tab: n.tab } : { kind: n.kind })}
                >
                  {t(n.text)}
                </Chip>
              </span>
            ))}
          </Segmented>
        </nav>
        <div className="absolute right-1.5 top-1.5 z-10">
          <IconButton icon="close" label={t('common.close')} onClick={onClose} size={36} />
        </div>
        {/* From 900px the close button sits in its own gutter on the right, clear of each screen's header. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col min-[900px]:pr-9 min-[900px]:pt-3">{children ?? <CenterContent kind={kind} tab={tab} />}</div>
      </section>
    </div>
  )
}

/** What each kind shows. */
function CenterContent({ kind, tab }: { kind: CenterKind; tab?: StatsTab }) {
  if (kind === 'stats') return <StatsScreen tab={tab ?? 'money'} />
  if (kind === 'lawbook') return <LawbookScreen />
  return <MarketScreen />
}
