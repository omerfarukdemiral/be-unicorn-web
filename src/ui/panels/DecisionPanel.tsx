// Decision card in the single panel (opened from its scene bubble; never a blocking modal).
// After a choice the same panel shows the one-sentence reflection + Defter link.
import type { DecisionCardId } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { Button } from '../primitives'
import { DecisionCardView, decisionById, ReflectionView } from '../bubbles/DecisionBubble'

export function DecisionPanel({ cardId, answered }: { cardId: DecisionCardId; answered?: number }) {
  const card = decisionById(cardId)
  const stillActive = useGameStore((s) => s.state.decisions.active?.cardId === cardId)
  const dispatch = useGameStore((s) => s.dispatch)
  const openPanel = useGameStore((s) => s.openPanel)
  const closePanel = useGameStore((s) => s.closePanel)
  if (!card) return <p className="font-text text-sm text-ink-2">{t('decision.expired')}</p>

  if (answered !== undefined) {
    return (
      <div className="flex animate-pop-in flex-col gap-4">
        <ReflectionView card={card} optionIndex={answered} />
        <Button tone="primary" onClick={closePanel}>
          {t('common.ok')}
        </Button>
      </div>
    )
  }
  if (!stillActive) return <p className="font-text text-sm text-ink-2">{t('decision.expired')}</p>
  return (
    <DecisionCardView
      card={card}
      stacked
      onChoose={(optionIndex) => {
        const r = dispatch({ type: 'answerDecision', cardId, optionIndex })
        if (r.ok) openPanel({ kind: 'decision', cardId, answered: optionIndex }, { replace: true })
      }}
    />
  )
}
