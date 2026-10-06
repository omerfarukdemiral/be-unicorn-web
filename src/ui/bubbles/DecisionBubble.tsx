// Decision bubble (PLAN §6.3): non-blocking. Question + options with their effects as icon + number chips (the
// trade-off sentence is the option's tooltip), then what the choice did as the same chips + a book icon to the related Defter card; the reflection sentence is the tooltip
// (docs/GAMEPLAY_V2.md §11). One reading line per bubble: the question is the only paragraph.
import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { DecisionCardId, NpcRole } from '../../engine/types'
import { DECISIONS, type DecisionCard } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx, Dot, IconBadge, IconButton } from '../primitives'
import { useIsMobile } from '../hooks'
import { openConceptCard } from '../uiActions'
import { conceptTitle } from '../panels/JournalPanel'
import { OptionEffects } from '../EffectChips'
import { castName, npcLabel } from './speaker'
import { soft } from '../theme'

export const REFLECTION_MS = 12_000

export function decisionById(id: DecisionCardId): DecisionCard | undefined {
  return DECISIONS.find((d) => d.id === id)
}

/** Shared card body (screen bubble + panel). Kind mark = orange tile (crisis = red tile + dot). */
export function DecisionCardView({ card, onChoose, dense, stacked }: { card: DecisionCard; onChoose: (optionIndex: number) => void; dense?: boolean; /** One option per row (narrow panel). */ stacked?: boolean }) {
  const crisis = card.category === 'crisis'
  // The run's cast speaks (GAMEPLAY V2 §9.1): a thread card's role becomes this run's name.
  const cast = useGameStore((s) => s.state.cast)
  const memory = useGameStore((s) => lastWith(s.state.decisions.history, card))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <span className="relative">
          {/* The speaker's face: initials in the role's hue; the kind (crisis / rival) rides on it as a small mark. */}
          <Portrait role={card.speaker} name={castName({ cast }, card.speaker)} />
          {crisis ? (
            <Dot color="var(--color-negative)" size={9} className="absolute -right-0.5 -top-0.5 ring-2 ring-surface" />
          ) : card.category === 'rival' ? (
            <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-surface ring-1 ring-border" style={{ color: 'var(--color-kind-decision)' }}>
              <Icon name="flag" size={10} />
            </span>
          ) : null}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="ui-label">{npcLabel(card.speaker, cast)}</span>
            {/* They remember: the last thing you chose with them, as a short tag (no sentence). */}
            {memory && (
              <span title={t('decision.memoryTitle', { v: memory })} className="inline-flex max-w-[180px] items-center gap-0.5 rounded-md bg-surface-2 px-1.5 py-px text-[10.5px] font-semibold text-ink-2">
                <Icon name="refresh" size={10} className="shrink-0" />
                <span className="truncate">{memory}</span>
              </span>
            )}
          </div>
          <p className={cx('font-text mt-0.5 font-semibold leading-snug text-ink', dense ? 'text-sm' : 'text-base')}>{card.question}</p>
        </div>
      </div>
      <div className={cx('grid gap-2', !stacked && (card.options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'))}>
        {card.options.map((o, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChoose(i)}
            // The trade-off in words stays as the tooltip; the option shows its numbers (playtest 2026-10-06).
            title={`+ ${o.tradeoff.gain}\n− ${o.tradeoff.cost}`}
            className="group flex min-h-11 flex-col gap-2 rounded-control border border-border bg-transparent p-3 text-left transition-colors hover:border-brand hover:bg-brand-soft/60"
          >
            <span className="font-text text-sm font-semibold leading-snug text-ink">{o.label}</span>
            <OptionEffects fx={o.effects} delayed={o.delayed} />
          </button>
        ))}
      </div>
    </div>
  )
}

const ROLE_COLOR: Record<NpcRole, string> = {
  mentor: 'var(--color-kind-concept)',
  cofounder: 'var(--color-brand)',
  accountant: 'var(--color-g-cash)',
  engineer: 'var(--color-g-users)',
  investor: 'var(--color-g-equity)',
  customer: 'var(--color-g-morale)',
  journalist: 'var(--color-g-runway)',
}

function Portrait({ role, name }: { role: NpcRole; name: string }) {
  const initials = name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr')
  const c = ROLE_COLOR[role]
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full border-2 text-[13px] font-bold tracking-wide" style={{ color: c, borderColor: c, background: soft(c, 14) }}>
      {initials}
    </span>
  )
}

/** The option label of the last card this speaker brought that the player answered (not this card). */
function lastWith(history: readonly { cardId: string; optionIndex: number }[], card: DecisionCard): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]!
    if (h.cardId === card.id) continue
    const c = DECISIONS.find((d) => d.id === h.cardId)
    if (c?.speaker === card.speaker) return c.options[h.optionIndex]?.label ?? null
  }
  return null
}

/** After a choice: the choice, its numbers (Oxanium) and a book icon to the Defter card. The sentence is the tooltip. */
export function ReflectionView({ card, optionIndex, onClose }: { card: DecisionCard; optionIndex: number; onClose?: () => void }) {
  const opt = card.options[optionIndex]
  if (!opt) return null
  return (
    <div className="flex items-center gap-2.5" title={opt.reflection}>
      <IconBadge icon="sparkle" size={32} color="var(--color-kind-concept)" />
      <div className="min-w-0 flex-1">
        <div className="ui-label truncate">{t('decision.youChose', { v: opt.label })}</div>
        <OptionEffects fx={opt.effects} delayed={opt.delayed} className="mt-1" />
      </div>
      {opt.conceptId && (
        <button
          type="button"
          onClick={() => {
            onClose?.()
            if (opt.conceptId) openConceptCard(opt.conceptId)
          }}
          title={t('decision.notebookLink', { v: conceptTitle(opt.conceptId) })}
          aria-label={t('decision.notebookLink', { v: conceptTitle(opt.conceptId) })}
          className="grid size-9 shrink-0 place-items-center rounded-control text-kind-concept transition-colors hover:bg-surface-2 max-md:size-11"
        >
          <Icon name="book" size={18} />
        </button>
      )}
      {onClose && <IconButton icon="close" label={t('common.close')} onClick={onClose} size={44} />}
    </div>
  )
}

/**
 * Connected non-blocking bubble for `state.decisions.active`, then the reflection. It appears collapsed (time keeps
 * flowing); expanding it to read the card is a `decision` focus pause (store ui.decisionExpanded).
 */
export function DecisionBubble() {
  const active = useGameStore(useShallow((s) => s.state.decisions.active))
  const last = useGameStore(useShallow((s) => s.state.decisions.lastAnswer))
  const dispatch = useGameStore((s) => s.dispatch)
  const panel = useGameStore((s) => s.ui.panel)
  const mobile = useIsMobile()
  const setDecisionExpanded = useGameStore((s) => s.setDecisionExpanded)
  const [expanded, setExpanded] = useState(false)
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

  // A new card arrives collapsed: its appearance never stops time.
  useEffect(() => setExpanded(false), [active?.cardId])

  const card = active ? decisionById(active.cardId) : undefined
  // The same card open in the panel: do not duplicate it.
  const inPanel = panel?.kind === 'decision' && panel.cardId === (active?.cardId ?? reflection?.cardId)
  // Reading the card in the scene holds time still, like the panel does.
  const reading = expanded && !!card && !inPanel
  useEffect(() => {
    setDecisionExpanded(reading)
  }, [reading, setDecisionExpanded])
  useEffect(() => () => setDecisionExpanded(false), [setDecisionExpanded])

  if (card && active && !inPanel) {
    return (
      <div key={card.id} className="ui-card w-[min(560px,calc(100vw-1rem))] animate-attention p-3">
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
