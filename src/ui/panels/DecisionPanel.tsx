// Decision card in the single panel (opened from its scene bubble; never a blocking modal).
// After a choice the same panel shows the one-sentence reflection + Defter link.
// A loan offer (GAMEPLAY V2 §6.2) adds one number row per loan option: amount, monthly rate, term, covenant.
import { defaultAfterDaysOf, defaultOptionOf } from '../../engine/decisions'
import { loanAmount } from '../../engine'
import type { DecisionCardId, LoanTerms } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Button, Empty, Label } from '../primitives'
import { DecisionCardView, decisionById, ReflectionView } from '../bubbles/DecisionBubble'

export function DecisionPanel({ cardId, answered }: { cardId: DecisionCardId; answered?: number }) {
  const card = decisionById(cardId)
  const stillActive = useGameStore((s) => s.state.decisions.active?.cardId === cardId)
  const dispatch = useGameStore((s) => s.dispatch)
  const openPanel = useGameStore((s) => s.openPanel)
  const closePanel = useGameStore((s) => s.closePanel)

  if (card && answered !== undefined) {
    return (
      <div className="flex animate-pop-in flex-col gap-4">
        <ReflectionView card={card} optionIndex={answered} />
        <Button tone="primary" onClick={closePanel}>
          {t('common.ok')}
        </Button>
      </div>
    )
  }
  if (!card || !stillActive) return <Empty text={t('decision.expired')} icon="chat" />
  const def = card.options[defaultOptionOf(card)]
  const loans = card.options.flatMap((o, i) => (o.effects.loan ? [{ i, label: o.label, terms: o.effects.loan }] : []))
  return (
    <div className="flex flex-col gap-3">
      <DecisionCardView
        card={card}
        stacked
        onChoose={(optionIndex) => {
          const r = dispatch({ type: 'answerDecision', cardId, optionIndex })
          if (r.ok) openPanel({ kind: 'decision', cardId, answered: optionIndex }, { replace: true })
        }}
      />
      {loans.map((l) => (
        <LoanRow key={l.i} label={l.label} terms={l.terms} />
      ))}
      {def && <p className="font-text text-xs text-ink-3">{t('decision.defaultAfter', { d: defaultAfterDaysOf(card), v: def.label })}</p>}
    </div>
  )
}

/** The loan's terms as numbers: what lands in the till today, the monthly rate, the term, the covenant (runway months). */
function LoanRow({ label, terms }: { label: string; terms: LoanTerms }) {
  const amount = useGameStore((s) => loanAmount(s.state, terms))
  return (
    <div data-loan-row className="flex flex-col gap-1 rounded-control bg-surface-2/60 px-2 py-1.5">
      <span className="flex items-center gap-1.5">
        <Icon name="coin" size={14} className="shrink-0 text-ink-2" />
        <Label className="truncate">{label}</Label>
      </span>
      <div className="grid grid-cols-4 gap-2">
        <LoanStat label={t('loan.amount')} value={money(amount)} />
        <LoanStat label={t('loan.rate')} value={pct(terms.rate, 1)} />
        <LoanStat label={t('loan.term')} value={t('unit.months', { v: terms.months })} />
        {terms.covenantRunway !== undefined && <LoanStat label={t('loan.covenant')} value={t('unit.months', { v: fixed(terms.covenantRunway, 1) })} />}
      </div>
    </div>
  )
}

function LoanStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="tabular truncate text-[15px] font-semibold leading-tight text-ink">{value}</span>
      <span className="ui-label truncate">{label}</span>
    </span>
  )
}
