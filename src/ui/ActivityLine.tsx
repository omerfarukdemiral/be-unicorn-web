// Activity text (ACTIVITY_TEXT) + the history list shown in the notification strip popover (docs/LAYOUT.md §3).
// The newest entry is announced by the strip itself (stripRules.STRIP_ACTIVITY).
import { useShallow } from 'zustand/react/shallow'
import { FOUNDER_ACTIONS, type ActivityEntry } from '../engine/types'
import { ACTIVITY_TEXT, FURNITURE, GOALS, STAGES, UI_TEXT } from '../content'
import { useGameStore } from '../store/gameStore'
import { fill, t } from './i18n'
import { money, num } from './format'

/** Turns raw engine params (ids, numbers) into display strings. */
export function activityText(entry: ActivityEntry): string {
  const raw = entry.params ?? {}
  const params: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(raw)) params[k] = formatParam(k, v)
  // An update after 1.0 names itself ("güncelleme 2"), not the version level.
  if (entry.kind === 'release' && typeof raw.update === 'number' && raw.update > 0) params.level = t('release.update', { n: raw.update })
  return fill(ACTIVITY_TEXT[entry.kind] ?? entry.kind, params)
}

function formatParam(key: string, v: string | number): string | number {
  if (key === 'action' && typeof v === 'string' && (FOUNDER_ACTIONS as readonly string[]).includes(v)) return t(`founder.${v}`)
  if (key === 'item' && typeof v === 'string') return FURNITURE.find((f) => f.id === v)?.name ?? v
  if (key === 'stage' && typeof v === 'number') return STAGES[v]?.name ?? v
  if (key === 'milestone' && typeof v === 'string') return t(`milestone.${v}`)
  if (key === 'note' && typeof v === 'string') return UI_TEXT[`note.${v}`] ?? v
  if (key === 'level' && typeof v === 'number') return t(`release.level.${Math.max(1, Math.min(5, v))}`)
  if (key === 'pitch' && typeof v === 'string') return t(`pitch.${v}`)
  if (key === 'goal' && typeof v === 'string') return GOALS.find((g) => g.id === v)?.text ?? v
  if (typeof v === 'number') {
    if (key === 'amount' || key === 'from' || key === 'cash' || key === 'mrr' || key === 'cost') return money(v)
    return num(v)
  }
  return v
}

/** Last `n` entries, newest first (strip popover "Son olaylar"). */
export function ActivityHistory({ n = 8 }: { n?: number }) {
  const activity = useGameStore(useShallow((s) => s.state.activity))
  const history = activity.slice(-n).reverse()
  if (!history.length) return <p className="px-2 py-1.5 text-xs text-ink-2">{t('strip.noRecent')}</p>
  return (
    <ul className="flex flex-col">
      {history.map((e) => (
        <li key={e.id} className="flex gap-2 px-2 py-1.5 text-xs">
          <span className="ui-label tabular w-12 shrink-0 pt-px">{t('activity.day', { d: Math.floor(e.day) + 1 })}</span>
          <span className="font-text min-w-0 leading-snug text-ink">{activityText(e)}</span>
        </li>
      ))}
    </ul>
  )
}
