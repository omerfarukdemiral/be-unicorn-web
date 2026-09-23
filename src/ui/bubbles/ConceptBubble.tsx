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

export const CONCEPT_MINIMIZE_MS = 20_000

/** Presentational bubble; render may embed this inside a drei <Html>. */
export function ConceptBubbleView({ text, speaker, onClick, className }: { text: string; speaker?: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group relative flex max-w-[min(340px,86vw)] animate-pop-in items-start gap-2 rounded-3xl rounded-bl-md border border-lemon-300 bg-cream-50 px-3.5 py-2.5 text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5',
        className,
      )}
    >
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-lemon-300 text-ink-900">
        <Icon name="chat" size={13} />
      </span>
      <span className="min-w-0">
        {speaker && <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-600">{speaker}</span>}
        <span className="block text-sm font-semibold leading-snug text-ink-900">{text}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-lilac-500">
          <Icon name="book" size={12} />
          {t('bubble.openNotebook')}
        </span>
      </span>
    </button>
  )
}

/** Minimized concept: a small pulsing icon (kept until opened). */
export function ConceptIconView({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-11 animate-pop-in place-items-center rounded-full border border-lemon-300 bg-lemon-100 text-lemon-600 shadow-[var(--shadow-card)]"
    >
      <Icon name="chat" size={18} className="animate-wiggle" />
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
