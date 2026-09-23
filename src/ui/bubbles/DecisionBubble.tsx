// Decision bubble (PLAN §6.3): non-blocking. Question + options with visible trade-off,
// then a one-sentence reflection with a link to the related Defter card.
import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { DecisionCardId } from '../../engine/types'
import { DECISIONS, type DecisionCard } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx, Dot, IconBadge, IconButton } from '../primitives'
import { useIsMobile } from '../hooks'
import { openConceptCard } from '../uiActions'
import { conceptTitle } from '../panels/JournalPanel'
import { npcLabel } from './speaker'

export const REFLECTION_MS = 12_000

export function decisionById(id: DecisionCardId): DecisionCard | undefined {
  return DECISIONS.find((d) => d.id === id)
}

/** Shared card body (screen bubble + panel). Kind mark = orange tile (crisis = red tile + dot). */
export function DecisionCardView({ card, onChoose, dense, stacked }: { card: DecisionCard; onChoose: (optionIndex: number) => void; dense?: boolean; /** One option per row (narrow panel). */ stacked?: boolean }) {
  const crisis = card.category === 'crisis'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <span className="relative">
          <IconBadge icon={crisis ? 'warning' : card.category === 'rival' ? 'flag' : 'chat'} size={32} color={crisis ? 'var(--color-negative)' : 'var(--color-kind-decision)'} />
          {crisis && <Dot color="var(--color-negative)" size={7} className="absolute -right-0.5 -top-0.5 ring-2 ring-surface" />}
        </span>
        <div className="min-w-0">
          <div className="ui-label">{npcLabel(card.speaker)}</div>
          <p className={cx('font-text mt-0.5 font-semibold leading-snug text-ink', dense ? 'text-sm' : 'text-base')}>{card.question}</p>
        </div>
      </div>
      <div className={cx('grid gap-2', !stacked && (card.options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'))}>
        {card.options.map((o, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChoose(i)}
            className="group flex min-h-11 flex-col gap-1.5 rounded-control border border-border bg-transparent p-3 text-left transition-colors hover:border-brand hover:bg-brand-soft/60"
          >
            <span className="font-text text-sm font-semibold leading-snug text-ink">{o.label}</span>
            <span className="font-text flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-2">
              <Icon name="plus" size={12} className="mt-px shrink-0 text-positive" />
              {o.tradeoff.gain}
            </span>
            <span className="font-text flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-2">
              <Icon name="minus" size={12} className="mt-px shrink-0 text-negative" />
              {o.tradeoff.cost}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Reflection line after a choice (non-judgmental) + Defter link. */
export function ReflectionView({ card, optionIndex, onClose }: { card: DecisionCard; optionIndex: number; onClose?: () => void }) {
  const opt = card.options[optionIndex]
  if (!opt) return null
  return (
    <div className="flex items-start gap-2.5">
      <IconBadge icon="sparkle" size={32} color="var(--color-kind-concept)" />
      <div className="min-w-0 flex-1">
        <div className="ui-label">{t('decision.youChose', { v: opt.label })}</div>
        <p className="font-text mt-0.5 text-sm leading-snug text-ink">{opt.reflection}</p>
        {opt.conceptId && (
          <button
            type="button"
            onClick={() => {
              onClose?.()
              if (opt.conceptId) openConceptCard(opt.conceptId)
            }}
            className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-ink underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-ink max-md:min-h-11"
          >
            <Icon name="book" size={13} className="text-kind-concept" />
            {t('decision.notebookLink', { v: conceptTitle(opt.conceptId) })}
          </button>
        )}
      </div>
      {onClose && <IconButton icon="close" label={t('common.close')} onClick={onClose} size={44} />}
    </div>
  )
}

/** Connected non-blocking bubble for `state.decisions.active`, then the reflection. */
export function DecisionBubble() {
  const active = useGameStore(useShallow((s) => s.state.decisions.active))
  const last = useGameStore(useShallow((s) => s.state.decisions.lastAnswer))
  const dispatch = useGameStore((s) => s.dispatch)
  const panel = useGameStore((s) => s.ui.panel)
  const mobile = useIsMobile()
  const [expanded, setExpanded] = useState(!mobile)
  const [reflection, setReflection] = useState<{ cardId: string; optionIndex: number; key: string } | null>(null)

  // Show the reflection whenever a new answer lands.
  const lastKey = last ? `${last.cardId}:${last.day}:${last.optionIndex}` : null
  const initialKey = useRef(lastKey)
  useEffect(() => {
    if (!last || !lastKey || lastKey === initialKey.current) return
    setReflection({ cardId: last.cardId, optionIndex: last.optionIndex, key: lastKey })
    const id = window.setTimeout(() => setReflection((r) => (r?.key === lastKey ? null : r)), REFLECTION_MS)
    return () => window.clearTimeout(id)
  }, [lastKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setExpanded(!mobile), [active?.cardId, mobile])

  const card = active ? decisionById(active.cardId) : undefined
  // The same card open in the panel: do not duplicate it.
  const inPanel = panel?.kind === 'decision' && panel.cardId === (active?.cardId ?? reflection?.cardId)

  if (card && active && !inPanel) {
    return (
      <div className="ui-card w-[min(560px,calc(100vw-1rem))] animate-pop-in p-3">
        {expanded ? (
          <>
            <div className="-mt-1 mb-1 flex justify-end">
              <IconButton icon="chevronUp" label={t('bubble.collapse')} onClick={() => setExpanded(false)} size={mobile ? 44 : 32} />
            </div>
            <DecisionCardView card={card} dense onChoose={(optionIndex) => dispatch({ type: 'answerDecision', cardId: card.id, optionIndex })} />
          </>
        ) : (
          <button type="button" onClick={() => setExpanded(true)} className="flex min-h-11 w-full items-center gap-2 text-left">
            <IconBadge icon={card.category === 'crisis' ? 'warning' : 'chat'} size={28} color={card.category === 'crisis' ? 'var(--color-negative)' : 'var(--color-kind-decision)'} />
            <span className="font-text min-w-0 flex-1 truncate text-sm font-semibold text-ink">{card.question}</span>
            <Icon name="chevronDown" size={16} className="shrink-0 text-ink-2" />
          </button>
        )}
      </div>
    )
  }

  if (reflection && !inPanel) {
    const rc = decisionById(reflection.cardId)
    if (!rc) return null
    return (
      <div className="ui-card w-[min(480px,calc(100vw-1rem))] animate-pop-in p-3">
        <ReflectionView card={rc} optionIndex={reflection.optionIndex} onClose={() => setReflection(null)} />
      </div>
    )
  }
  return null
}
