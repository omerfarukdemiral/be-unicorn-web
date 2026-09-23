// Defter: bookshelf of learned concepts (one book per card), plus waiting (minimized) bubbles.
import { useShallow } from 'zustand/react/shallow'
import { CONCEPT_IDS, type ConceptId } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { cx, Empty, SectionTitle } from '../primitives'
import { conceptById, openConceptCard } from '../uiActions'

const PER_SHELF = 9

export function conceptTitle(id: ConceptId): string {
  return t(`concept.${id}`)
}

export function JournalPanel() {
  const { learned, minimized } = useGameStore(useShallow((s) => ({ learned: s.state.concepts.learned, minimized: s.state.concepts.minimized })))
  const waiting = minimized.filter((id) => !learned.includes(id))

  // Fixed shelf order (catalog order) so books keep their place.
  const slots = CONCEPT_IDS.map((id) => ({ id, learned: learned.includes(id) }))
  const shelves: (typeof slots)[] = []
  for (let i = 0; i < slots.length; i += PER_SHELF) shelves.push(slots.slice(i, i + PER_SHELF))

  return (
    <div className="flex flex-col gap-4">
      {waiting.length > 0 && (
        <section>
          <SectionTitle>{t('journal.waiting')}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {waiting.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => openConceptCard(id)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-lemon-100 px-3 text-xs font-bold text-lemon-600 hover:bg-lemon-300/60"
              >
                <Icon name="chat" size={14} className="animate-wiggle" />
                {conceptTitle(id)}
              </button>
            ))}
          </div>
        </section>
      )}
      <section>
        <SectionTitle right={<span className="tabular text-[11px] font-semibold text-ink-600">{t('journal.count', { n: learned.length, total: CONCEPT_IDS.length })}</span>}>
          {t('journal.shelf')}
        </SectionTitle>
        {learned.length === 0 && <Empty text={t('journal.empty')} icon="book" />}
        <div className="flex flex-col gap-3">
          {shelves.map((shelf, i) => (
            <div key={i} className="relative">
              <div className="flex h-24 items-end gap-1 px-2">
                {shelf.map((b, j) => {
                  const c = conceptById(b.id)
                  const h = 70 + ((j * 37 + i * 13) % 5) * 5
                  return b.learned ? (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openConceptCard(b.id)}
                      title={conceptTitle(b.id)}
                      className="group relative flex w-9 shrink-0 items-center justify-center rounded-t-md rounded-b-sm shadow-[inset_-3px_0_0_rgb(0_0_0/0.08)] transition-transform hover:-translate-y-1.5"
                      style={{ height: h, background: c?.shelfColor ?? '#c9a7f5' }}
                    >
                      <span className="max-h-full overflow-hidden text-[10px] font-extrabold text-ink-900/80 [writing-mode:vertical-rl] rotate-180">{conceptTitle(b.id)}</span>
                      <span className="absolute inset-x-1 top-2 h-0.5 rounded bg-cream-50/60" />
                    </button>
                  ) : (
                    <span key={b.id} aria-hidden="true" className={cx('w-9 shrink-0 rounded-t-md border border-dashed border-cream-300 bg-cream-100/50')} style={{ height: h - 10 }} />
                  )
                })}
              </div>
              <div className="h-2.5 rounded-full bg-[#caa983] shadow-[0_3px_0_#a8865f]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
