// Horizon strip (docs/CORE_LOOP.md §5 "Ufuk şeridi"): a thin time line of the next 6 weeks under the stage bar.
// Markers: payday (projected lump), delayed decision effects (with the source option), release ETAs, the round.
// The engine lists them (state.derived.horizon); this only places them on the line.
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { HorizonItem } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { money } from './format'
import { cx } from './primitives'
import { soft } from './theme'
import { optionLabel, releaseName } from './loopUi'

const SPAN_DAYS = 42

const KIND: Record<HorizonItem['kind'], { icon: IconName; color: string }> = {
  payday: { icon: 'cash', color: 'var(--color-g-burn)' },
  delayed: { icon: 'hourglass', color: 'var(--color-kind-decision)' },
  release: { icon: 'rocket', color: 'var(--color-brand)' },
  roundClose: { icon: 'handshake', color: 'var(--color-brand)' },
  roundReady: { icon: 'rocket', color: 'var(--color-positive)' },
}

export function horizonLabel(h: HorizonItem, projectName: (id: string | undefined) => string): string {
  switch (h.kind) {
    case 'payday':
      return t('horizon.payday', { v: `−${money(h.amount ?? 0)}` })
    case 'delayed': {
      const label = optionLabel(h.cardId, h.optionIndex)
      return label ? t('horizon.delayed', { v: label }) : t('horizon.delayedNote')
    }
    case 'release':
      return t('horizon.release', { project: projectName(h.projectId), level: releaseName(h.level ?? 1, h.update) })
    case 'roundClose':
      return t('horizon.roundClose')
    case 'roundReady':
      return t('horizon.roundReady')
  }
}

function whenLabel(days: number): string {
  return days < 0.5 ? t('horizon.today') : t('horizon.inDays', { v: Math.max(1, Math.round(days)) })
}

/** Phone form, the number first: "30g · −$1.5K" (the icon already says payday / release / decision). */
export function horizonShort(h: HorizonItem, days: number, projectName: (id: string | undefined) => string): string {
  const when = days < 0.5 ? t('horizon.today') : t('horizon.inDaysShort', { v: Math.max(1, Math.round(days)) })
  const what = h.kind === 'payday' ? `−${money(h.amount ?? 0)}` : h.kind === 'release' ? releaseName(h.level ?? 1, h.update) : horizonLabel(h, projectName)
  return `${when} · ${what}`
}

function useHorizon() {
  return useGameStore(
    useShallow((s) => ({
      items: s.state.derived.horizon,
      day: s.state.time.day,
      projects: s.state.projects,
      tight: s.state.finance.runway !== null && s.state.finance.runway < 3,
    })),
  )
}

/** Desktop: the line with markers + one caption (hovered marker, else the nearest one). */
export function HorizonStrip({ className }: { className?: string }) {
  const { items, day, projects, tight } = useHorizon()
  const [hover, setHover] = useState<number | null>(null)
  if (!items) return null
  const name = (id: string | undefined) => projects.find((p) => p.id === id)?.name ?? ''
  const shown = items.slice(0, 8)
  const focus = hover !== null ? shown[hover] : shown[0]
  return (
    <div className={cx('pointer-events-auto ui-card flex items-center gap-2 px-2.5 py-1', className)}>
      <span className="ui-label shrink-0 leading-none" title={t('horizon.span')}>
        {t('horizon.title')}
      </span>
      <div className="relative h-5 min-w-[120px] flex-1" onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-strong" />
        {/* Week ticks. */}
        {[1, 2, 3, 4, 5].map((w) => (
          <span key={w} aria-hidden="true" className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-border-strong" style={{ left: `${((w * 7) / SPAN_DAYS) * 100}%` }} />
        ))}
        {shown.map((h, i) => {
          const k = KIND[h.kind]
          const x = Math.max(0, Math.min(1, (h.day - day) / SPAN_DAYS))
          const warn = h.kind === 'payday' && tight
          const c = warn ? 'var(--color-negative)' : k.color
          return (
            <button
              key={`${h.kind}-${i}-${Math.round(h.day)}`}
              type="button"
              aria-label={`${whenLabel(h.day - day)} · ${horizonLabel(h, name)}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className={cx('absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border transition-transform hover:scale-125', hover === i && 'scale-125')}
              style={{ left: `${x * 100}%`, color: c, background: `color-mix(in oklab, ${c} 14%, var(--color-surface))`, borderColor: soft(c, 55) }}
            >
              <Icon name={k.icon} size={11} />
            </button>
          )
        })}
      </div>
      <span className="tabular min-w-0 max-w-[48%] shrink truncate text-[11px] font-medium text-ink-2">
        {focus ? (
          <>
            <span className="font-semibold text-ink">{whenLabel(focus.day - day)}</span> · {horizonLabel(focus, name)}
          </>
        ) : (
          t('horizon.empty')
        )}
      </span>
    </div>
  )
}

/** Phone: just the nearest item, one line. */
export function HorizonNext({ className }: { className?: string }) {
  const { items, day, projects, tight } = useHorizon()
  const first = items?.[0]
  if (!first) return null
  const name = (id: string | undefined) => projects.find((p) => p.id === id)?.name ?? ''
  const k = KIND[first.kind]
  const c = first.kind === 'payday' && tight ? 'var(--color-negative)' : k.color
  return (
    <span className={cx('pointer-events-auto ui-card tabular flex min-h-11 min-w-0 items-center gap-1.5 px-2 text-[11px] font-medium text-ink-2', className)} title={horizonLabel(first, name)}>
      <span className="grid size-5 shrink-0 place-items-center rounded-full" style={{ color: c, background: soft(c, 16) }}>
        <Icon name={k.icon} size={11} />
      </span>
      <span className="min-w-0 truncate font-semibold text-ink">{horizonShort(first, first.day - day, name)}</span>
    </span>
  )
}
