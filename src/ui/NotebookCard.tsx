// Defter card (docs/GAMEPLAY_V2.md §10.6): the rule (≤ 10 words) is the one sentence, the player's own numbers preview
// "Sen nerede gördün?", "Açıldı: X" is a pill. Ne? / Nerede? and the speaker's line fold under "▸ daha": at most 20
// words show when the card opens.
import { useState, type ReactNode } from 'react'
import type { ConceptId, GameState } from '../engine/types'
import { HUD_WIDGETS, TOOL_IDS } from '../engine/types'
import { NPC_TEXT, type Concept } from '../content'
import { useGameStore } from '../store/gameStore'
import { Icon } from './icons'
import { t } from './i18n'
import { Button, IconBadge, Label, Pill } from './primitives'
import { conceptById } from './uiActions'
import { conceptTitle } from './panels/JournalPanel'
import { castName } from './bubbles/speaker'

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

/** Unit words kept with the number before them ("4.2 ay", "12 gün"). */
const UNITS: ReadonlySet<string> = new Set(['ay', 'gün', 'kişi', 'hafta'])
const trimPunct = (w: string): string => w.replace(/[.,;:!?)]+$/, '')

/** The numbers of "Sen nerede gördün?" in order ("$1.2K", "4.2 ay"): the card's preview, at most `max`. */
export function whereNumbers(where: string, max = 2): string[] {
  const words = where.split(/\s+/)
  const out: string[] = []
  for (let i = 0; i < words.length && out.length < max; i++) {
    const w = trimPunct(words[i] ?? '')
    if (!/\d/.test(w)) continue
    const unit = trimPunct(words[i + 1] ?? '')
    out.push(UNITS.has(unit) ? `${w} ${unit}` : w)
  }
  return out
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
  const cast = useGameStore((st) => st.state.cast)
  const [more, setMore] = useState(false)
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
  const unlock = unlockLabel(concept.unlocks)
  const numbers = where ? whereNumbers(where) : []
  return (
    <article className="relative overflow-hidden rounded-card bg-surface" aria-label={t('journal.cardLabel')}>
      <div className="flex flex-col gap-3 p-4 @lg:p-5">
        <header className="flex min-w-0 items-center gap-2.5">
          {/* The book's own shelf colour: a small tinted book badge (the spine on the shelf is solid). */}
          <IconBadge icon="book" size={28} color={concept.shelfColor} />
          <h2 className="min-w-0 text-lg font-semibold leading-tight tracking-tight text-ink">{conceptTitle(concept.id)}</h2>
        </header>
        <p className="font-text text-[15px] font-semibold leading-snug text-ink">{concept.card.rule}</p>
        {numbers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" title={where ?? undefined}>
            <Icon name="search" size={14} className="text-g-users" />
            {numbers.map((n, i) => (
              <span key={i} className="tabular rounded-md bg-surface-2 px-2 py-0.5 text-[15px] font-semibold text-ink">
                {n}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
          className="inline-flex min-h-9 w-fit items-center gap-1 text-xs font-semibold text-ink-2 transition-colors hover:text-ink max-md:min-h-11"
        >
          <Icon name={more ? 'chevronDown' : 'chevronRight'} size={13} />
          {more ? t('notebook.less') : t('notebook.more')}
        </button>
        {more && (
          <div className="flex flex-col gap-1 border-y border-border py-1 animate-fade-in">
            <Row label={t('journal.what')} icon="sparkle" color="var(--color-kind-concept)">
              {concept.card.what}
            </Row>
            {where !== null && (
              <Row label={t('journal.where')} icon="search" color="var(--color-g-users)">
                {where}
              </Row>
            )}
            <Row label={`${castName({ cast }, concept.speaker)} · ${NPC_TEXT[concept.speaker].title}`} icon="chat" color="var(--color-ink-2)">
              “{concept.bubble}”
            </Row>
          </div>
        )}
        {(unlock || onClose) && (
          <footer className="flex flex-wrap items-center justify-between gap-2">
            {unlock ? (
              <Pill tint="var(--color-brand)" className="text-brand-ink">
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

function Row({ label, icon, color, children }: { label: string; icon: 'sparkle' | 'search' | 'chat'; color: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <IconBadge icon={icon} size={24} color={color} />
      <div className="min-w-0">
        <Label>{label}</Label>
        <div className="font-text mt-0.5 text-sm leading-relaxed text-ink">{children}</div>
      </div>
    </div>
  )
}
