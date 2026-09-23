// Concept bubble (PLAN §6.1): ≤ 12 words, click → Defter card; after 20 s real time
// without a click it shrinks to an icon (dispatch minimizeConcept) and never disappears.
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ConceptId } from '../../engine/types'
import { NPC_TEXT } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx } from '../primitives'
import { conceptById, openConceptCard } from '../uiActions'
import { conceptTitle } from '../panels/JournalPanel'
import { BUBBLE_HOVER, BUBBLE_SHELL, BubbleTail, BubbleText, SpeakerLine } from './shell'

export const CONCEPT_MINIMIZE_MS = 20_000

/** Presentational bubble; render may embed this inside a drei <Html>. Mark: book icon (vs. decision's chat). */
export function ConceptBubbleView({ text, speaker, onClick, className, tail }: { text: string; speaker?: string; onClick: () => void; className?: string; tail?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(BUBBLE_SHELL, BUBBLE_HOVER, 'group flex max-w-[min(340px,86vw)] animate-pop-in flex-col gap-1 px-3 py-2 text-left', className)}
    >
      <SpeakerLine icon="book" speaker={speaker} />
      <BubbleText>{text}</BubbleText>
      <span className="flex items-center gap-1 font-ui text-[11px] font-semibold text-ink-2 transition-colors group-hover:text-ink">
        {t('bubble.openNotebook')}
        <Icon name="chevronRight" size={12} className="transition-transform group-hover:translate-x-0.5" />
      </span>
      {tail && <BubbleTail />}
    </button>
  )
}

/** Minimized concept: a small round icon with a tiny ink mark (kept until opened). */
export function ConceptIconView({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="relative grid size-11 animate-pop-in place-items-center rounded-full border border-border bg-surface text-ink shadow-card transition-colors hover:border-border-strong"
    >
      <Icon name="book" size={17} className="animate-wiggle" />
      <span aria-hidden="true" className="absolute right-2 top-2 size-1.5 rounded-full bg-ink ring-2 ring-surface" />
    </button>
  )
}

/** Connected: current active concept bubble with the 20 s minimize timer. */
export function ConceptBubble() {
  const active = useGameStore(useShallow((s) => s.state.concepts.active))
  const dispatch = useGameStore((s) => s.dispatch)
  const id = active?.id
  const shownDay = active?.shownDay

  useEffect(() => {
    if (!id) return
    const timer = window.setTimeout(() => dispatch({ type: 'minimizeConcept', conceptId: id }), CONCEPT_MINIMIZE_MS)
    return () => window.clearTimeout(timer)
  }, [id, shownDay, dispatch])

  if (!id) return null
  const c = conceptById(id)
  if (!c) return null
  return <ConceptBubbleView text={c.bubble} speaker={NPC_TEXT[c.speaker].name} onClick={() => openConceptCard(id)} />
}

/** Connected: minimized (unopened) concept icons. */
export function MinimizedConcepts() {
  const { minimized, learned } = useGameStore(useShallow((s) => ({ minimized: s.state.concepts.minimized, learned: s.state.concepts.learned })))
  const list = minimized.filter((id) => !learned.includes(id)).slice(-4)
  if (list.length === 0) return null
  return (
    <div className="flex gap-1.5">
      {list.map((id: ConceptId) => (
        <ConceptIconView key={id} label={conceptTitle(id)} onClick={() => openConceptCard(id)} />
      ))}
    </div>
  )
}
