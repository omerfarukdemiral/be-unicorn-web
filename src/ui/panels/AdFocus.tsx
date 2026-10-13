// Reklam odağı (W3, A1): the one company ad budget promotes one launched product. A chip row under the budget steps
// (Şirket = balanced). Under it, what the shown focus moves in absolute numbers: who gains paid users, who loses, the
// MRR 3 months out, and the warm-up while it settles. Shown = the hovered chip (mouse), else the chosen one; the chosen
// one is measured against Şirket, a hovered one against the current focus.
import { useState, type PointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import * as B from '../../engine/balance'
import { adFocusProject, adFocusWarmup, focusPaidSplit, focusPreview } from '../../engine/modules'
import type { GameState } from '../../engine/types'
import { withCase } from '../../content/format'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { money, num } from '../format'
import { cx } from '../primitives'
import { CATEGORY_COLOR, CATEGORY_ICON } from './ProjectsPanel'

/** The focus chips' numbers (flat, for useShallow): the biggest paid gainer and loser a month, the MRR change 3 months out. */
export interface FocusChips {
  gain: string | null
  gainN: number
  loss: string | null
  lossN: number
  mrr: number
}

const NO_CHIPS: FocusChips = { gain: null, gainN: 0, loss: null, lossN: 0, mrr: 0 }

/** `shown` against `base` (null = Şirket). Nothing when they are the same. Whole users and dollars only. */
export function focusChips(s: GameState, shown: string | null, base: string | null): FocusChips {
  if (shown === base) return NO_CHIPS
  const a = focusPaidSplit(s, shown)
  const b = focusPaidSplit(s, base)
  const out = { ...NO_CHIPS }
  for (const p of s.projects) {
    if (!(p.id in a)) continue
    const d = a[p.id]! - (b[p.id] ?? 0)
    if (d > out.gainN) {
      out.gainN = d
      out.gain = p.name
    }
    if (-d > out.lossN) {
      out.lossN = -d
      out.loss = p.name
    }
  }
  out.gainN = Math.round(out.gainN)
  out.lossN = Math.round(out.lossN)
  if (out.gainN < 1) out.gain = null
  if (out.lossN < 1) out.loss = null
  out.mrr = Math.round(focusPreview(s, shown, 3) - focusPreview(s, base, 3))
  return out
}

export function AdFocusRow() {
  const projects = useGameStore((s) => s.state.projects)
  const budget = useGameStore((s) => s.state.finance.adBudget)
  const focus = useGameStore((s) => adFocusProject(s.state)?.id ?? null)
  const warm = useGameStore((s) => Math.ceil(B.AD_FOCUS_WARMUP_DAYS - (s.state.time.day - (s.state.finance.adFocusDay ?? -99))))
  const warming = useGameStore((s) => adFocusWarmup(s.state) > 1)
  // undefined = nothing hovered; null = the Şirket chip.
  const [hover, setHover] = useState<string | null | undefined>(undefined)
  const shown = hover !== undefined ? hover : focus
  const base = shown === focus ? null : focus
  const fx = useGameStore(useShallow((s) => focusChips(s.state, shown, base)))
  const dispatch = useGameStore((s) => s.dispatch)
  const live = projects.filter((p) => p.launched)
  if (live.length < 2 || budget <= 0) return null
  const hoverProps = (id: string | null) => ({
    onPointerEnter: (e: PointerEvent) => e.pointerType === 'mouse' && setHover(id),
    onPointerLeave: () => setHover(undefined),
  })
  const showMrr = Math.abs(fx.mrr) >= 1
  return (
    <div className="mt-3" data-ad-focus>
      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
        <Icon name="megaphone" size={13} />
        {t('ads.focus')}
      </div>
      <div className="ui-scroll -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={t('ads.focus')}>
        <FocusChip on={focus === null} label={t('ads.focusCompany')} onClick={() => dispatch({ type: 'setAdFocus', projectId: null })} {...hoverProps(null)} />
        {live.map((p) => (
          <FocusChip key={p.id} on={focus === p.id} label={p.name} color={CATEGORY_COLOR[p.category]} icon={CATEGORY_ICON[p.category]} onClick={() => dispatch({ type: 'setAdFocus', projectId: p.id })} {...hoverProps(p.id)} />
        ))}
      </div>
      {(fx.gain || fx.loss || showMrr || warming) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-focus-chips>
          {fx.gain && <DeltaChip good icon="users" text={t('ads.focusGain', { project: withCase(fx.gain, 'dat'), n: num(fx.gainN) })} />}
          {fx.loss && <DeltaChip good={false} icon="users" text={t('ads.focusLoss', { project: withCase(fx.loss, 'dat'), n: num(fx.lossN) })} />}
          {showMrr && <DeltaChip good={fx.mrr > 0} icon="coin" text={t('ads.focusMrr', { v: `${fx.mrr > 0 ? '+' : '−'}${money(Math.abs(fx.mrr))}` })} />}
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

function DeltaChip({ good, icon, text }: { good: boolean; icon: Parameters<typeof Icon>[0]['name']; text: string }) {
  return (
    <span className={cx('tabular inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-bold', good ? 'text-positive-ink' : 'text-negative-ink')}>
      <Icon name={icon} size={12} />
      {text}
    </span>
  )
}

function FocusChip({
  on,
  label,
  color,
  icon,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: {
  on: boolean
  label: string
  color?: string
  icon?: Parameters<typeof Icon>[0]['name']
  onClick: () => void
  onPointerEnter?: (e: PointerEvent) => void
  onPointerLeave?: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
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
