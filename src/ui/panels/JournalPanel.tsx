// Kazanımlar (top-bar book icon, K; docs/GAMEPLAY_V2.md §12): ☆ stage goals, the concept shelf (one book per learned
// card, plus the concepts waiting to be read) and Keşif: every thread step and secret card as a cell, a silhouette
// until seen in some run ("23/64" over those cells; store ui.codex, outside the engine, §9.2).
// Opening it clears the goals part of the badge.
import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CONCEPT_IDS, type ConceptId, type NpcRole } from '../../engine/types'
import { DECISIONS, THREAD_IDS, type DecisionCard, type ThreadId } from '../../content'
import { codexCount, useGameStore, waitingConcepts } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { cx, Empty, SectionTitle } from '../primitives'
import { readableOn, soft } from '../theme'
import { conceptById, openConceptCard } from '../uiActions'
import { NotebookCard } from '../NotebookCard'
import { castName } from '../bubbles/speaker'
import { GoalsCard } from './GoalsCard'

const PER_SHELF = 9

export function conceptTitle(id: ConceptId): string {
  return t(`concept.${id}`)
}

/** Kazanımlar; `conceptId` shows that card on top (opened from the badge list, a visitor, a decision or the shelf). */
export function JournalPanel({ conceptId }: { conceptId?: ConceptId }) {
  const openPanel = useGameStore((s) => s.openPanel)
  const markGoalsSeen = useGameStore((s) => s.markGoalsSeen)
  const learned = useGameStore((s) => s.state.concepts.learned)
  const waiting = useGameStore(useShallow((s) => waitingConcepts(s.state)))
  const goalsDone = useGameStore((s) => s.state.goalsDone)
  // Open = seen: goals reached while it is open never count on the badge either.
  useEffect(() => markGoalsSeen(), [goalsDone, markGoalsSeen])

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
      <GoalsCard />
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
                <Icon name="book" size={14} className="animate-wiggle text-kind-concept" />
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
                  const spine = c?.shelfColor ?? '#8b5cf6'
                  return b.learned ? (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openConceptCard(b.id)}
                      title={conceptTitle(b.id)}
                      aria-label={conceptTitle(b.id)}
                      className="group relative flex w-9 shrink-0 flex-col items-center gap-1.5 rounded-t-md rounded-b-sm px-0.5 pb-2 pt-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08),inset_3px_0_0_rgb(255_255_255/0.18)] transition-[transform,filter] hover:-translate-y-1.5 hover:brightness-105"
                      style={{ height: h, background: spine, color: readableOn(spine) }}
                    >
                      {/* Learned book = a solid spine in its own shelf colour; two thin bands like a binding. */}
                      <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-current opacity-50" />
                      {/* One line, bottom-to-top; a title longer than the spine ends in an ellipsis (full title in aria-label/title). */}
                      <span aria-hidden="true" className="min-h-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] font-semibold leading-none tracking-[0.02em] [writing-mode:vertical-rl] rotate-180">
                        {conceptTitle(b.id)}
                      </span>
                    </button>
                  ) : (
                    <span key={b.id} aria-hidden="true" className={cx('w-9 shrink-0 rounded-t-md border border-dashed border-border-strong')} style={{ height: h - 10 }} />
                  )
                })}
              </div>
              <div className="h-1.5 rounded-full bg-shelf" />
            </div>
          ))}
        </div>
      </section>
      <DiscoveryGrid />
    </div>
  )
}

/** Thread → the role who carries it (the cast name labels the row) and its hue. */
const THREAD_LOOK: Record<ThreadId, { role: NpcRole | null; icon: IconName; color: string }> = {
  mentor: { role: 'mentor', icon: 'compass', color: 'var(--color-kind-concept)' },
  investor: { role: 'investor', icon: 'handshake', color: 'var(--color-g-equity)' },
  customer: { role: 'customer', icon: 'users', color: 'var(--color-g-users)' },
  rival: { role: null, icon: 'flag', color: 'var(--color-kind-decision)' },
  press: { role: 'journalist', icon: 'megaphone', color: 'var(--color-g-retention)' },
}

/** Each thread's cards in step order (branches side by side), and the secret cards. */
const THREAD_CARDS: Record<ThreadId, DecisionCard[]> = Object.fromEntries(
  THREAD_IDS.map((id) => [id, DECISIONS.filter((d) => d.thread?.id === id).sort((a, b) => (a.thread?.step ?? 0) - (b.thread?.step ?? 0))]),
) as Record<ThreadId, DecisionCard[]>
const SECRET_CARDS: DecisionCard[] = DECISIONS.filter((d) => d.secret)

/** Keşif (§9.2, §12): one row per thread (seen steps filled, the rest silhouettes) + the secret row; "23/64" on top. */
function DiscoveryGrid() {
  const codex = useGameStore((s) => s.ui.codex)
  const cast = useGameStore((s) => s.state.cast)
  const { n, total } = codexCount(codex)
  const seen = (id: string) => codex.seenCards.includes(id)
  return (
    <section>
      <SectionTitle right={<span className="tabular text-[11px] font-semibold text-ink-2">{t('codex.count', { n, total })}</span>}>{t('achv.discovery')}</SectionTitle>
      <div className="flex flex-col gap-1">
        {THREAD_IDS.map((id) => {
          const look = THREAD_LOOK[id]
          const cards = THREAD_CARDS[id]
          const done = codex.threadsDone.includes(id)
          const label = look.role ? `${t(`codex.thread.${id}`)} · ${castName({ cast }, look.role)}` : t(`codex.thread.${id}`)
          return (
            <div key={id} className="flex min-h-9 items-center gap-2">
              <span className="font-text w-28 shrink-0 truncate text-xs font-medium text-ink-2" title={label}>
                {label}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {cards.map((c) => (
                  <Cell key={c.id} seen={seen(c.id)} icon={look.icon} color={look.color} />
                ))}
              </div>
              {done && (
                <span title={t('codex.threadDone')} className="shrink-0 text-positive">
                  <Icon name="check" size={14} />
                </span>
              )}
            </div>
          )
        })}
        <div className="flex min-h-9 items-center gap-2">
          <span className="font-text w-28 shrink-0 truncate text-xs font-medium text-ink-2">{t('codex.secret')}</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {SECRET_CARDS.map((c) => (
              <Cell key={c.id} seen={seen(c.id)} icon="sparkle" color="var(--color-brand)" secret />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** A card cell: filled tile once seen, a dashed silhouette before ("?" for a secret). */
function Cell({ seen, icon, color, secret }: { seen: boolean; icon: IconName; color: string; secret?: boolean }) {
  if (seen) {
    return (
      <span className="grid size-6 place-items-center rounded-[6px]" style={{ color, background: soft(color, 16) }}>
        <Icon name={icon} size={13} />
      </span>
    )
  }
  return (
    <span aria-hidden="true" className="grid size-6 place-items-center rounded-[6px] border border-dashed border-border-strong text-[10px] font-bold text-ink-3">
      {secret ? t('codex.locked') : null}
    </span>
  )
}
