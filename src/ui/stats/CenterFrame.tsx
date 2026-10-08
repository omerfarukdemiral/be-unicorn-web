// Center screen shell (docs/GAMEPLAY_V2.md §14.5): statistics, Kanun Kitabı and Pazar haritası open here, in the
// middle of the scene area between the bars (store.ui.sceneInset, viewport px: hence `fixed`), at most 960px wide.
// z-45: above the bottom stack (41), under the blocking modals (50) and the time frame (55), so the green / red
// frame stays visible and the bars stay clickable. Time keeps flowing (§14.1); a click on the scene around the card
// or Esc (shortcuts.ts) closes it. A board dealt onto the table, not a web dialog: the shared card material (.ui-card +
// --shadow-panel), the kind as a duotone sticker (identity, never a warning), no header bar and no visible title (the
// active tab names the board).
// The header's tab strip switches between the three screens (İstatistik | Kanun Kitabı | Pazar haritası) without
// closing the frame; tab switches are static (only the first open is dealt).
import type { ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'
import type { CenterKind, StatsTab } from '../../store/types'
import type { IconName } from '../icons'
import { t } from '../i18n'
import { Chip, cx, IconBadge, IconButton, Segmented } from '../primitives'
import { LawbookScreen } from '../center/LawbookScreen'
import { MarketScreen } from '../center/MarketScreen'
import { StatsScreen } from './StatsScreen'
import { GAP } from '../layout/tokens'

const KIND: Record<CenterKind, { icon: IconName; color: string }> = {
  stats: { icon: 'trend', color: 'var(--color-g-sky)' },
  lawbook: { icon: 'book', color: 'var(--color-g-equity)' },
  market: { icon: 'pie', color: 'var(--color-g-users)' },
}

/** Tab strip order. */
export const CENTER_TABS: readonly CenterKind[] = ['stats', 'lawbook', 'market']

/** Width cap of the center card (the scene stays visible around it on a wide screen). */
export const CENTER_MAX_W = 960

export function CenterFrame({ kind, tab, onClose, children }: { kind: CenterKind; tab?: StatsTab; onClose: () => void; children?: ReactNode }) {
  const inset = useGameStore((s) => s.ui.sceneInset)
  const openOverlay = useGameStore((s) => s.openOverlay)

  const k = KIND[kind]
  return (
    <div
      data-center-frame={kind}
      className="pointer-events-auto fixed z-[45] flex justify-center"
      style={{ top: inset.top, bottom: inset.bottom, left: GAP, right: Math.max(GAP, inset.right) }}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-labelledby="center-title"
        onClick={(e) => e.stopPropagation()}
        // The board hugs its content (the office shows under a short lawbook or market); past the scene height its own
        // scroller takes over. Stats keeps a tall floor so its charts do not jump between tabs.
        className={cx(
          'ui-card shadow-panel relative flex max-h-full w-full min-w-0 flex-col self-center overflow-hidden animate-deal',
          kind === 'stats' && 'min-h-[70%]',
        )}
        style={{ maxWidth: CENTER_MAX_W }}
      >
        <header className="flex shrink-0 items-center gap-2 px-3 pt-2">
          <IconBadge icon={k.icon} size={24} color={k.color} />
          {/* Named for screen readers only: the active tab already says which board this is. */}
          <h2 id="center-title" className="sr-only">
            {t(`center.${kind}`)}
          </h2>
          <Segmented label={t('center.tabs')} className="max-[639px]:flex-1 max-[639px]:justify-between">
            {CENTER_TABS.map((id) => (
              <Chip key={id} segment active={kind === id} icon={KIND[id].icon} label={t(`center.${id}`)} onClick={() => kind !== id && openOverlay({ kind: id })}>
                <span className="hidden min-[900px]:inline">{t(`center.${id}`)}</span>
              </Chip>
            ))}
          </Segmented>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} size={36} className="ml-auto" />
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children ?? <CenterContent kind={kind} tab={tab} />}</div>
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
