// Reklam odağı (W3): the one company ad budget promotes one launched product. A chip row under the budget steps
// (Şirket = balanced), what the chosen focus does to the channels as up to 3 delta chips, the warm-up while it settles.
import { useShallow } from 'zustand/react/shallow'
import * as B from '../../engine/balance'
import { adFocusProject, adFocusWarmup, focusEffects } from '../../engine/modules'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx } from '../primitives'
import { CATEGORY_COLOR, CATEGORY_ICON } from './ProjectsPanel'

/** Signed percent of a ratio ("+6%", "−3%"), null under 1% (nothing to say). */
function delta(ratio: number): { text: string; sign: number } | null {
  const v = Math.round((ratio - 1) * 100)
  if (v === 0) return null
  return { text: `${v > 0 ? '+' : '−'}${Math.abs(v)}%`, sign: Math.sign(v) }
}

const KINDS = [
  { key: 'arpu', icon: 'coin', good: 1 },
  { key: 'organic', icon: 'trend', good: 1 },
  { key: 'cac', icon: 'scale', good: -1 },
  { key: 'churn', icon: 'leak', good: -1 },
] as const

export function AdFocusRow() {
  const projects = useGameStore((s) => s.state.projects)
  const budget = useGameStore((s) => s.state.finance.adBudget)
  const focus = useGameStore((s) => adFocusProject(s.state)?.id ?? null)
  const warm = useGameStore((s) => Math.ceil(B.AD_FOCUS_WARMUP_DAYS - (s.state.time.day - (s.state.finance.adFocusDay ?? -99))))
  const warming = useGameStore((s) => adFocusWarmup(s.state) > 1)
  const fx = useGameStore(useShallow((s) => (focus ? focusEffects(s.state, focus) : null)))
  const dispatch = useGameStore((s) => s.dispatch)
  const live = projects.filter((p) => p.launched)
  if (live.length < 2 || budget <= 0) return null
  const chips = fx
    ? KINDS.map((k) => ({ ...k, d: delta(fx[k.key]) }))
        .filter((k) => k.d)
        .sort((a, b) => Math.abs(parseInt(b.d!.text.replace('−', '-'))) - Math.abs(parseInt(a.d!.text.replace('−', '-'))))
        .slice(0, 3)
    : []
  return (
    <div className="mt-3" data-ad-focus>
      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
        <Icon name="megaphone" size={13} />
        {t('ads.focus')}
      </div>
      <div className="ui-scroll -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={t('ads.focus')}>
        <FocusChip on={focus === null} label={t('ads.focusCompany')} onClick={() => dispatch({ type: 'setAdFocus', projectId: null })} />
        {live.map((p) => (
          <FocusChip key={p.id} on={focus === p.id} label={p.name} color={CATEGORY_COLOR[p.category]} icon={CATEGORY_ICON[p.category]} onClick={() => dispatch({ type: 'setAdFocus', projectId: p.id })} />
        ))}
      </div>
      {(focus ? chips.length > 0 || warming : warming) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {chips.map((k) => (
            <span key={k.key} className={cx('tabular inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-bold', k.d!.sign * k.good > 0 ? 'text-positive-ink' : 'text-negative-ink')}>
              <Icon name={k.icon} size={12} />
              {t(`ads.delta.${k.key}`, { v: k.d!.text })}
            </span>
          ))}
          {warming && (
            <span className="tabular inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-bold text-ink-2">
              <Icon name="hourglass" size={12} />
              {t('ads.warmup', { d: Math.max(1, warm) })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function FocusChip({ on, label, color, icon, onClick }: { on: boolean; label: string; color?: string; icon?: Parameters<typeof Icon>[0]['name']; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx('ui-key ui-key-sm inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold', on ? 'ui-key-soft' : 'ui-key-routine')}
    >
      {icon && <Icon name={icon} size={14} style={color ? { color } : undefined} />}
      <span className="max-w-[9rem] truncate">{label}</span>
    </button>
  )
}

/** ProjectDetail: the focused product wears the chip, the others offer the switch. */
export function AdFocusToggle({ projectId }: { projectId: string }) {
  const on = useGameStore((s) => adFocusProject(s.state)?.id === projectId)
  const show = useGameStore((s) => s.state.finance.adBudget > 0 && s.state.projects.filter((p) => p.launched).length >= 2)
  const dispatch = useGameStore((s) => s.dispatch)
  if (!show) return null
  return on ? (
    <span className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-full bg-brand-soft px-3 text-[12px] font-bold text-brand-ink">
      <Icon name="megaphone" size={13} />
      {t('ads.focusOn')}
    </span>
  ) : (
    <button type="button" onClick={() => dispatch({ type: 'setAdFocus', projectId })} className="ui-key ui-key-sm ui-key-routine inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-3 text-[13px] font-semibold">
      <Icon name="megaphone" size={14} />
      {t('ads.focusThis')}
    </button>
  )
}

/** The project card's mark. */
export function AdFocusMark({ projectId }: { projectId: string }) {
  const on = useGameStore((s) => adFocusProject(s.state)?.id === projectId)
  return on ? <Icon name="megaphone" size={14} className="shrink-0 text-brand-ink" aria-label={t('ads.focusOn')} /> : null
}
