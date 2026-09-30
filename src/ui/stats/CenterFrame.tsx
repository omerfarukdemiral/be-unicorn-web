// Center screen shell (docs/GAMEPLAY_V2.md §14.5): statistics, Kanun Kitabı and Pazar haritası open here, in the
// middle of the scene area between the bars (store.ui.sceneInset, viewport px: hence `fixed`), at most 960px wide.
// z-45: above the bottom stack (41), under the blocking modals (50) and the time frame (55), so the green / red
// frame stays visible and the bars stay clickable. Time keeps flowing (§14.1); a click on the scene around the card
// or Esc (shortcuts.ts) closes it. Title strip = the content kind's hue (identity, never a warning).
import type { ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'
import type { CenterKind, StatsTab } from '../../store/types'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { Empty, IconButton } from '../primitives'
import { StatsScreen } from './StatsScreen'
import { GAP } from '../layout/tokens'

const KIND: Record<CenterKind, { icon: IconName; color: string }> = {
  stats: { icon: 'trend', color: 'var(--color-g-sky)' },
  lawbook: { icon: 'book', color: 'var(--color-g-equity)' },
  market: { icon: 'pie', color: 'var(--color-g-users)' },
}

/** Width cap of the center card (the scene stays visible around it on a wide screen). */
export const CENTER_MAX_W = 960

export function CenterFrame({ kind, tab, onClose, children }: { kind: CenterKind; tab?: StatsTab; onClose: () => void; children?: ReactNode }) {
  const inset = useGameStore((s) => s.ui.sceneInset)

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
        className="relative flex h-full w-full min-w-0 animate-rise flex-col overflow-hidden rounded-card border border-border bg-surface shadow-panel"
        style={{ maxWidth: CENTER_MAX_W }}
      >
        <div aria-hidden="true" className="h-[3px] w-full shrink-0" style={{ background: k.color }} />
        <header className="flex shrink-0 items-center gap-2 px-3 pt-2">
          <span aria-hidden="true" style={{ color: k.color }}>
            <Icon name={k.icon} size={20} />
          </span>
          <h2 id="center-title" className="min-w-0 flex-1 truncate text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
            {t(`center.${kind}`)}
          </h2>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} size={36} />
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children ?? <CenterContent kind={kind} tab={tab} />}</div>
      </section>
    </div>
  )
}

/** What each kind shows. Kanun Kitabı and Pazar haritası land with their mechanics (H5b): a placeholder until then. */
function CenterContent({ kind, tab }: { kind: CenterKind; tab?: StatsTab }) {
  if (kind === 'stats') return <StatsScreen tab={tab ?? 'money'} />
  return <Empty text={t('center.soon')} icon={KIND[kind].icon} />
}
