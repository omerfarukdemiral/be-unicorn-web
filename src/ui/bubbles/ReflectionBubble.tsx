// After an answer (scene-first spec §2 row 3): "Seçtin: …" and the chosen option's chips above the same speaker for a
// few seconds, so the player sees what the choice moved. Not clickable, never a pause; the sentence is the tooltip.
import type { DecisionCardId } from '../../engine/types'
import { OptionEffects } from '../EffectChips'
import { t } from '../i18n'
import { decisionById } from './DecisionBubble'
import { BUBBLE_SHELL, BubbleTail } from './shell'
import { cx } from '../primitives'

export function ReflectionBubble({ cardId, optionIndex }: { cardId: DecisionCardId; optionIndex: number }) {
  const opt = decisionById(cardId)?.options[optionIndex]
  if (!opt) return null
  return (
    <div className="pointer-events-none relative w-max max-w-[min(300px,calc(100vw-32px))] opacity-95">
      <div data-bubble="reflection" title={opt.reflection} className={cx(BUBBLE_SHELL, 'flex flex-col gap-1 overflow-hidden px-2.5 py-2')}>
        <span className="ui-label truncate">{t('bubble.chose', { v: opt.label })}</span>
        <OptionEffects fx={opt.effects} delayed={opt.delayed} quiet />
      </div>
      <BubbleTail />
    </div>
  )
}
