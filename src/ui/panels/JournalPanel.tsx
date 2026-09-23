// Defter: bookshelf of learned concepts (one book per card), plus waiting (minimized) bubbles.
import { useShallow } from 'zustand/react/shallow'
import { CONCEPT_IDS, type ConceptId } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx, Dot, Empty, SectionTitle } from '../primitives'
import { conceptById, openConceptCard } from '../uiActions'
import { NotebookCard } from '../NotebookCard'

const PER_SHELF = 9

export function conceptTitle(id: ConceptId): string {
  return t(`concept.${id}`)
}

/** Defter shelf; `conceptId` shows that card on top (opened from a bubble, a decision or the shelf). */
export function JournalPanel({ conceptId }: { conceptId?: ConceptId }) {
  const openPanel = useGameStore((s) => s.openPanel)
  const { learned, minimized } = useGameStore(useShallow((s) => ({ learned: s.state.concepts.learned, minimized: s.state.concepts.minimized })))
  const waiting = minimized.filter((id) => !learned.includes(id))

  // Fixed shelf order (catalog order) so books keep their place.
  const slots = CONCEPT_IDS.map((id) => ({ id, learned: learned.includes(id) }))
  const shelves: (typeof slots)[] = []
  for (let i = 0; i < slots.length; i += PER_SHELF) shelves.push(slots.slice(i, i + PER_SHELF))

  return (
    <div className="flex flex-col gap-4">
      {conceptId && (
        <div key={conceptId} className="animate-pop-in overflow-hidden rounded-card border border-border shadow-card">
          <NotebookCard conceptId={conceptId} onClose={() => openPanel({ kind: 'journal' }, { replace: true })} />
        </div>
      )}
      {waiting.length > 0 && (
        <section>
          <SectionTitle>{t('journal.waiting')}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {waiting.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => openConceptCard(id)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-border px-3 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <Icon name="chat" size={14} className="animate-wiggle text-ink-2" />
                {conceptTitle(id)}
              </button>
            ))}
          </div>
        </section>
      )}
      <section>
        <SectionTitle right={<span className="tabular text-[11px] font-semibold text-ink-2">{t('journal.count', { n: learned.length, total: CONCEPT_IDS.length })}</span>}>
          {t('journal.shelf')}
        </SectionTitle>
        {learned.length === 0 && <Empty text={t('journal.empty')} icon="book" />}
        <div className="flex flex-col gap-3">
          {shelves.map((shelf, i) => (
            <div key={i} className="relative">
              <div className="flex h-28 items-end gap-1 px-2">
                {shelf.map((b, j) => {
                  const c = conceptById(b.id)
                  const h = 90 + ((j * 37 + i * 13) % 5) * 5
                  return b.learned ? (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openConceptCard(b.id)}
                      title={conceptTitle(b.id)}
                      aria-label={conceptTitle(b.id)}
                      className="group relative flex w-9 shrink-0 flex-col items-center gap-1.5 rounded-t-md rounded-b-sm border border-border-strong bg-surface px-0.5 pb-2 pt-2 transition-[transform,background-color] hover:-translate-y-1.5 hover:bg-surface-2"
                      style={{ height: h }}
                    >
                      {/* The book's own colour survives only as a small mark on the spine. */}
                      <Dot color={c?.shelfColor ?? 'var(--color-ink-3)'} size={6} />
                      {/* One line, bottom-to-top; a title longer than the spine ends in an ellipsis (full title in aria-label/title). */}
                      <span aria-hidden="true" className="min-h-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] font-semibold leading-none tracking-[0.02em] text-ink [writing-mode:vertical-rl] rotate-180">
                        {conceptTitle(b.id)}
                      </span>
                    </button>
                  ) : (
                    <span key={b.id} aria-hidden="true" className={cx('w-9 shrink-0 rounded-t-md border border-dashed border-border-strong')} style={{ height: h - 10 }} />
                  )
                })}
              </div>
              <div className="h-1 rounded-full bg-border-strong" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
