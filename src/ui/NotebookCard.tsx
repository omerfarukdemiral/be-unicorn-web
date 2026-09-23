// Defter card: Ne? / Sen nerede gördün? / Kural (PLAN §2, ≤ 50 words, filled with the player's numbers).
import type { ReactNode } from 'react'
import type { ConceptId, GameState } from '../engine/types'
import { HUD_WIDGETS, TOOL_IDS } from '../engine/types'
import { NPC_TEXT, type Concept } from '../content'
import { useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { t } from './i18n'
import { Button, Pill } from './primitives'
import { conceptById } from './uiActions'
import { conceptTitle } from './panels/JournalPanel'

function safeWhere(c: Concept, s: GameState): string {
  try {
    return c.card.where(s)
  } catch {
    return '—'
  }
}

/** "Sen nerede gördün?": the text captured when the concept fired. Null if it never fired. */
function whereOf(c: Concept, s: GameState): string | null {
  const saved = s.concepts.where?.[c.id]
  if (saved !== undefined) return saved
  // Saves from before snapshots existed: fall back to the live numbers.
  return s.concepts.triggered.includes(c.id) ? safeWhere(c, s) : null
}

function oneLabel(u: string): string {
  if ((HUD_WIDGETS as readonly string[]).includes(u)) return t(`widget.${u}`)
  if ((TOOL_IDS as readonly string[]).includes(u)) return t(`tool.${u}`)
  return u
}

export function unlockLabel(u: Concept['unlocks']): string | null {
  if (!u) return null
  if (typeof u === 'string') return oneLabel(u)
  return u.length ? u.map(oneLabel).join(', ') : null
}

export function NotebookCard({ conceptId, onClose }: { conceptId: ConceptId; onClose?: () => void }) {
  const concept = conceptById(conceptId)
  const where = useGameStore((st) => (concept ? whereOf(concept, st.state) : null))
  if (!concept) {
    return (
      <div className="p-6 text-center text-sm text-ink-600">
        {t('journal.missing', { id: conceptId })}
        {onClose && (
          <div className="mt-4">
            <Button onClick={onClose}>{t('common.close')}</Button>
          </div>
        )}
      </div>
    )
  }
  const speaker = NPC_TEXT[concept.speaker]
  const unlock = unlockLabel(concept.unlocks)
  return (
    <article className="relative overflow-hidden rounded-[var(--radius-card)] bg-cream-50">
      <div className="h-3" style={{ background: concept.shelfColor }} />
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-600">
              <Icon name="book" size={14} />
              {t('journal.cardLabel')}
            </div>
            <h2 className="mt-0.5 text-xl font-extrabold tracking-tight">{conceptTitle(concept.id)}</h2>
            <p className="mt-1 text-sm italic text-ink-600">
              “{concept.bubble}” <span className="not-italic">— {speaker.name}, {speaker.title}</span>
            </p>
          </div>
        </header>
        <Row label={t('journal.what')} tone="bg-sky-100 text-sky-600" icon="sparkle">
          {concept.card.what}
        </Row>
        {where !== null && (
          <Row label={t('journal.where')} tone="bg-lemon-100 text-lemon-600" icon="search">
            {where}
          </Row>
        )}
        <Row label={t('journal.rule')} tone="bg-mint-100 text-mint-600" icon="check">
          <strong>{concept.card.rule}</strong>
        </Row>
        {(unlock || onClose) && (
          <footer className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {unlock ? (
              <Pill className="bg-lilac-100 text-lilac-500">
                <Icon name="plus" size={12} />
                {t('journal.unlocked', { v: unlock })}
              </Pill>
            ) : (
              <span />
            )}
            {onClose && (
              <Button tone="primary" onClick={onClose} autoFocus>
                {t('journal.gotIt')}
              </Button>
            )}
          </footer>
        )}
      </div>
    </article>
  )
}

function Row({ label, tone, icon, children }: { label: string; tone: string; icon: 'sparkle' | 'search' | 'check'; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${tone}`}>
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-600">{label}</div>
        <p className="text-sm leading-relaxed text-ink-900">{children}</p>
      </div>
    </div>
  )
}
