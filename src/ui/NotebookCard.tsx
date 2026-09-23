// Defter card: Ne? / Sen nerede gördün? / Kural (PLAN §2, ≤ 50 words, filled with the player's numbers).
import type { ReactNode } from 'react'
import type { ConceptId, GameState } from '../engine/types'
import { HUD_WIDGETS, TOOL_IDS } from '../engine/types'
import { NPC_TEXT, type Concept } from '../content'
import { useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { t } from './i18n'
import { Button, cx, Dot, IconBadge, Label, Pill } from './primitives'
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
      <div className="font-text p-6 text-center text-sm text-ink-2">
        {t('journal.missing', { id: conceptId })}
        {onClose && (
          <div className="mt-4 font-ui">
            <Button onClick={onClose}>{t('common.close')}</Button>
          </div>
        )}
      </div>
    )
  }
  const speaker = NPC_TEXT[concept.speaker]
  const unlock = unlockLabel(concept.unlocks)
  return (
    <article className="relative overflow-hidden rounded-card bg-surface">
      <div className="flex flex-col gap-4 p-4 @lg:p-6">
        <header className="min-w-0">
          <div className="flex items-center gap-1.5">
            {/* Shelf colour survives only as a tiny mark (was a full-width colour strip). */}
            <Dot color={concept.shelfColor} size={7} />
            <Label>{t('journal.cardLabel')}</Label>
          </div>
          <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-tight text-ink">{conceptTitle(concept.id)}</h2>
          <p className="font-text mt-1.5 text-sm leading-snug text-ink-2">
            “{concept.bubble}”{' '}
            <span className="font-ui text-xs text-ink-2">
              — {speaker.name}, {speaker.title}
            </span>
          </p>
        </header>
        <div className="flex flex-col divide-y divide-border border-y border-border">
          <Row label={t('journal.what')} icon="sparkle">
            {concept.card.what}
          </Row>
          {where !== null && (
            <Row label={t('journal.where')} icon="search">
              {where}
            </Row>
          )}
          <Row label={t('journal.rule')} icon="check" emphasis>
            {concept.card.rule}
          </Row>
        </div>
        {(unlock || onClose) && (
          <footer className="flex flex-wrap items-center justify-between gap-2">
            {unlock ? (
              <Pill className="text-ink">
                <Icon name="plus" size={12} className="text-ink-2" />
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

function Row({ label, icon, emphasis, children }: { label: string; icon: 'sparkle' | 'search' | 'check'; emphasis?: boolean; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <IconBadge icon={icon} size={28} />
      <div className="min-w-0">
        <Label>{label}</Label>
        <p className={cx('font-text mt-0.5 text-sm leading-relaxed text-ink', emphasis && 'font-semibold')}>{children}</p>
      </div>
    </div>
  )
}
