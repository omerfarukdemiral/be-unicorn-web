// Bottom-left activity line: newest ActivityEntry rendered from ACTIVITY_TEXT; tap to expand history.
import { useShallow } from 'zustand/react/shallow'
import { FOUNDER_ACTIONS, type ActivityEntry } from '../engine/types'
import { ACTIVITY_TEXT, FURNITURE, GOALS, STAGES, UI_TEXT } from '../content'
import { useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { fill, t } from './i18n'
import { money, num } from './format'
import { cx } from './primitives'
import { useExclusiveExpander } from './hooks'

/** Turns raw engine params (ids, numbers) into display strings. */
export function activityText(entry: ActivityEntry): string {
  const raw = entry.params ?? {}
  const params: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(raw)) params[k] = formatParam(k, v)
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

export function ActivityLine() {
  const activity = useGameStore(useShallow((s) => s.state.activity))
  // History list is part of the one-thing-open rule: opening a panel closes it and vice versa.
  const [open, setOpen] = useExclusiveExpander()
  const last = activity[activity.length - 1]
  if (!last) return null
  const history = activity.slice(-8).reverse()
  return (
    <div className="pointer-events-auto flex w-full max-w-[min(420px,100%)] flex-col items-start gap-1">
      {open && (
        <ul className="ui-card ui-scroll max-h-56 w-full animate-slide-up divide-y divide-border px-1 py-1 text-xs">
          {history.map((e) => (
            <li key={e.id} className="flex gap-2.5 px-2 py-1.5">
              <span className="ui-label tabular w-12 shrink-0 pt-px">{t('activity.day', { d: Math.floor(e.day) + 1 })}</span>
              <span className="font-text leading-snug text-ink">{activityText(e)}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="ui-card flex min-h-10 max-w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink transition-colors hover:bg-surface-2 max-md:min-h-11"
      >
        <span className={cx('size-1.5 shrink-0 rounded-full bg-brand', 'animate-pulse')} />
        <span key={last.id} className="font-text min-w-0 animate-fade-in truncate">
          {activityText(last)}
        </span>
        <Icon name={open ? 'chevronDown' : 'chevronUp'} size={14} className="shrink-0 text-ink-3" />
      </button>
    </div>
  )
}
