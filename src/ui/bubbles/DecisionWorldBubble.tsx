// A decision card answered in the scene (scene-first spec §2 rows 1–2): above the visitor who brought it (investor /
// customer / journalist), or the founder's desk when it is the founder's own call. Collapsed = the question; open =
// the question and one row per option with its labelled chips (the trade-off sentence is the row's tooltip). Choosing
// dispatches answerDecision; the store closes the bubble and time resumes. Detay opens the card in the panel.
import type { DecisionCardId, NpcRole } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { OptionEffects } from '../EffectChips'
import { decisionById } from './DecisionBubble'
import { ChoiceRow, Expandable } from './Expandable'
import { BubbleText } from './shell'
import { castName } from './speaker'

/**
 * The collapsed pill's line: the question's first sentence (who wants what), not the whole question cut mid-word
 * ("Yıldız çalışanımız rakipten …"); the rest of it is in the open card.
 */
export function pillLine(question: string): string {
  return question.match(/^[^.?!]+[.?!]*/)?.[0].trim() || question
}

export function DecisionWorldBubble({ bubbleKey, cardId, role }: { bubbleKey: string; cardId: DecisionCardId; role: NpcRole }) {
  const cast = useGameStore((s) => s.state.cast)
  const dispatch = useGameStore((s) => s.dispatch)
  const card = decisionById(cardId)
  if (!card) return null
  const crisis = card.category === 'crisis'
  return (
    <Expandable
      bubbleKey={bubbleKey}
      kind="decision"
      attention
      lineInBody
      face={role}
      mark={crisis ? { icon: 'warning', color: 'var(--color-negative)' } : { icon: 'chat', color: 'var(--color-kind-decision)' }}
      speaker={castName({ cast }, role)}
      line={pillLine(card.question)}
      detail={() => useGameStore.getState().openPanel({ kind: 'decision', cardId })}
    >
      <BubbleText className="pb-0.5">{card.question}</BubbleText>
      {card.options.map((o, i) => (
        <ChoiceRow
          key={i}
          label={o.label}
          title={`+ ${o.tradeoff.gain}\n− ${o.tradeoff.cost}`}
          effects={<OptionEffects fx={o.effects} delayed={o.delayed} />}
          onClick={() => dispatch({ type: 'answerDecision', cardId, optionIndex: i })}
        />
      ))}
    </Expandable>
  )
}
