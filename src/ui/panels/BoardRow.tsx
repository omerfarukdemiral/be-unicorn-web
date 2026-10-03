// Kurul row in Büyüme (docs/GAMEPLAY_V2.md §8.3, §10.5): the quarter's MRR target and the days left, a thin bar of
// today's MRR against it, and the quarters missed / the multiple's penalty as pills. A known exam, not a warning:
// no red here (the one red rule). Absent before Series A (derived.board).
import { useShallow } from 'zustand/react/shallow'
import { BOARD_CAP_PENALTY } from '../../engine/balance'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { fixed, money } from '../format'
import { Pill } from '../primitives'
import { WIDGET_COLOR } from '../theme'
import { boardRow } from '../center/centerData'

export function BoardRow() {
  const b = useGameStore(useShallow((s) => boardRow(s.state.derived.board, s.state.time.day)))
  if (!b) return null
  return (
    <li data-board-row className="flex min-h-9 flex-col gap-1 rounded-control bg-surface-2/60 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <Icon name="building" size={16} className="shrink-0 text-ink-2" />
        <span className="ui-label min-w-0 flex-1 truncate">{t('board.title')}</span>
        {b.missed > 0 && <Pill className="tabular text-ink">{t('board.missed', { n: b.missed })}</Pill>}
        {b.streak > 1 && <Pill className="tabular text-ink">{t('board.streak', { n: b.streak })}</Pill>}
        {b.penalty && <Pill className="tabular text-ink">{t('board.penalty', { v: fixed(BOARD_CAP_PENALTY, 1) })}</Pill>}
        <span className="tabular shrink-0 text-[15px] font-semibold text-ink">{t('growth.row.boardValue', { v: money(b.target), d: b.days })}</span>
      </div>
      <span className="h-1 w-full overflow-hidden rounded-full bg-surface" title={t('board.progressTitle')}>
        <span className="block h-full rounded-full" style={{ width: `${Math.round(b.progress * 100)}%`, background: WIDGET_COLOR.cash }} />
      </span>
    </li>
  )
}
