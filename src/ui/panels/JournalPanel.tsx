// Kazanımlar (top-bar book icon, K; docs/GAMEPLAY_V2.md §12): the concept grid (an icon tile per learned concept, a
// glowing tile per concept waiting to be read, a lock for the rest) and Keşif: every thread step and secret card as a
// cell, a silhouette until seen in some run ("23/64" over those cells; store ui.codex, outside the engine, §9.2).
// Stage goals moved to Yol haritası (2026-10-06).
import { useShallow } from 'zustand/react/shallow'
import { CONCEPT_IDS, type ConceptId, type NpcRole } from '../../engine/types'
import { DECISIONS, THREAD_IDS, type DecisionCard, type ThreadId } from '../../content'
import { codexCount, useGameStore, waitingConcepts } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { cx, SectionTitle } from '../primitives'
import { soft } from '../theme'
import { conceptById, openConceptCard } from '../uiActions'
import { NotebookCard } from '../NotebookCard'
import { castName } from '../bubbles/speaker'

/** Each concept's glyph on its tile and card (the colour is its shelfColor). */
const CONCEPT_ICON: Record<ConceptId, IconName> = {
  runway: 'hourglass',
  burn: 'flame',
  'dont-scale': 'door',
  pmf: 'magnet',
  focus: 'compass',
  'default-alive': 'trend',
  dilution: 'pie',
  safe: 'key',
  'fundraise-time': 'timer',
  'hire-bar': 'users',
  'morale-compounds': 'heart',
  churn: 'leak',
  pricing: 'tag',
  'feature-vs-product': 'grid',
  'premature-scaling': 'rocket',
  'ltv-cac': 'scale',
  'organic-vs-paid': 'branch',
  'tech-debt': 'bug',
  'ten-x-myth': 'star',
  'culture-freezes': 'building',
  concentration: 'handshake',
  compliance: 'flag',
  trough: 'refresh',
  'cap-table-health': 'coin',
  'no-single-path': 'network',
  'founder-burnout': 'bed',
  'failure-is-data': 'search',
}

export function conceptIcon(id: ConceptId): IconName {
  return CONCEPT_ICON[id] ?? 'book'
}

export function conceptTitle(id: ConceptId): string {
  return t(`concept.${id}`)
}

/** Kazanımlar; `conceptId` shows that card on top (opened from the badge list, a visitor, a decision or the grid). */
export function JournalPanel({ conceptId }: { conceptId?: ConceptId }) {
  const openPanel = useGameStore((s) => s.openPanel)
  const learned = useGameStore((s) => s.state.concepts.learned)
  const waiting = useGameStore(useShallow((s) => waitingConcepts(s.state)))

  return (
    <div className="flex flex-col gap-4">
      {conceptId && (
        <div key={conceptId} className="animate-pop-in overflow-hidden rounded-card border border-border shadow-card">
          <NotebookCard conceptId={conceptId} onClose={() => openPanel({ kind: 'journal' }, { replace: true })} />
        </div>
      )}
      <section>
        <SectionTitle right={<span className="tabular text-[11px] font-semibold text-ink-2">{t('journal.count', { n: learned.length, total: CONCEPT_IDS.length })}</span>}>
          {t('journal.shelf')}
        </SectionTitle>
        {/* Fixed catalog order so a tile keeps its place; a waiting (unread) one glows until it is opened. */}
        <ul className="grid grid-cols-4 gap-1.5">
          {CONCEPT_IDS.map((id) => (
            <li key={id}>
              <ConceptTile id={id} state={learned.includes(id) ? 'learned' : waiting.includes(id) ? 'new' : 'locked'} open={id === conceptId} />
            </li>
          ))}
        </ul>
      </section>
      <DiscoveryGrid />
    </div>
  )
}

function ConceptTile({ id, state, open }: { id: ConceptId; state: 'learned' | 'new' | 'locked'; open: boolean }) {
  if (state === 'locked') {
    return (
      <span aria-hidden="true" className="grid h-[72px] place-items-center rounded-control border border-dashed border-border-strong text-ink-3/60">
        <Icon name="lock" size={14} />
      </span>
    )
  }
  const c = conceptById(id)
  const color = c?.shelfColor ?? 'var(--color-kind-concept)'
  const title = conceptTitle(id)
  return (
    <button
      type="button"
      onClick={() => openConceptCard(id)}
      title={title}
      aria-label={state === 'new' ? `${title} · ${t('journal.new')}` : title}
      aria-current={open || undefined}
      className={cx(
        'relative flex h-[72px] w-full flex-col items-center justify-center gap-1 rounded-control border px-1 transition-[transform,background-color] hover:-translate-y-0.5',
        state === 'new' ? 'animate-cta-glow border-brand bg-brand-soft' : open ? 'border-ink/30 bg-surface-2' : 'border-border bg-surface hover:bg-surface-2',
      )}
    >
      <span className="grid size-7 place-items-center rounded-[8px]" style={{ color, background: soft(color, 18) }}>
        <Icon name={conceptIcon(id)} size={15} />
      </span>
      <span className="line-clamp-2 w-full text-center text-[10.5px] font-semibold leading-tight text-ink">{title}</span>
      {state === 'new' && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 animate-pulse rounded-full bg-brand" />}
    </button>
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
