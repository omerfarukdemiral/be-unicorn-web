// Defter card (docs/GAMEPLAY_V2.md §10.6, simplified 2026-10-06): the concept's icon and title, its definition
// (card.what, ≤ 16 words) as the one sentence, the unlock as a tagged label. Nothing folds; nothing else is said.
// It reads as a notebook page (a shelf-coloured margin spine), not an onboarding tooltip.
import type { ConceptId } from '../engine/types'
import { HUD_WIDGETS, TOOL_IDS } from '../engine/types'
import type { Concept } from '../content'
import { Icon } from './icons'
import { t } from './i18n'
import { Button, IconBadge, Label } from './primitives'
import { conceptById } from './uiActions'
import { conceptIcon, conceptTitle } from './panels/JournalPanel'

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
  return (
    <article className="relative overflow-hidden rounded-card bg-surface" aria-label={t('journal.cardLabel')}>
      {/* Page-margin spine in the shelf's hue: the card is a page torn from the Defter. */}
      <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-full" style={{ background: concept.shelfColor }} />
      <div className="flex flex-col gap-3 p-4 pl-5 @lg:p-5 @lg:pl-6">
        <header className="flex min-w-0 items-center gap-2.5">
          <IconBadge icon={conceptIcon(concept.id)} size={32} color={concept.shelfColor} />
          <h2 className="min-w-0 text-lg font-semibold leading-tight tracking-tight text-ink">{conceptTitle(concept.id)}</h2>
        </header>
        {/* The definition is the one sentence; the rule, the player's numbers and the speaker's line are gone (playtest 2026-10-06). */}
        <p className="font-text text-[15px] leading-snug text-ink">{concept.card.what}</p>
        {(unlock || onClose) && (
          <footer className="flex flex-wrap items-center justify-between gap-2">
            {unlock ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="plus" size={12} className="text-brand" />
                <Label className="text-brand-ink">{unlock}</Label>
              </span>
            ) : (
              <span />
            )}
            {onClose && (
              // Routine, not commit: acknowledging spends nothing, and commit is kept for real answers.
              <Button tone="routine" size="md" onClick={onClose} autoFocus>
                {t('journal.gotIt')}
              </Button>
            )}
          </footer>
        )}
      </div>
    </article>
  )
}
