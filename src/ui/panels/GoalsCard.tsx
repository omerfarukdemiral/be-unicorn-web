// Stage goals card (docs/CORE_LOOP.md §4.3): ★ the next stage's valuation (required) + two ☆ optional goals.
// Plus "Kararın → sonucu": delayed decision effects that have landed, with the option that caused them (§6).
import { useShallow } from 'zustand/react/shallow'
import { goalsOfStage, STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { money } from '../format'
import { Bar, cx, SectionTitle } from '../primitives'
import { Icon } from '../icons'
import { effectSummary, optionLabel } from '../loopUi'

export function GoalsCard() {
  const g = useGameStore(
    useShallow((s) => ({
      stage: s.state.stage,
      valuation: s.state.finance.valuation,
      progress: s.state.derived.stageProgress,
      done: s.state.goalsDone ?? [],
    })),
  )
  const next = STAGES[g.stage + 1]
  const goals = goalsOfStage(g.stage)
  const stars = goals.filter((x) => g.done.includes(x.id)).length
  return (
    <section>
      <SectionTitle right={goals.length ? <span className="tabular text-[11px] font-semibold text-ink-2">{t('goals.stars', { a: stars, b: goals.length })}</span> : undefined}>
        {t('goals.title')}
      </SectionTitle>
      <ul className="flex flex-col gap-1.5">
        {next?.targetValuation ? (
          <li className="rounded-control border border-brand/30 bg-brand-soft/60 px-2.5 py-2">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Icon name="star" size={15} className="shrink-0 text-brand" fill="currentColor" />
              <span className="min-w-0 flex-1">{t('goals.main', { stage: next.name })}</span>
              <span className="tabular shrink-0 text-[11px] font-medium text-ink-2">
                {money(g.valuation)} / {money(next.targetValuation)}
              </span>
            </div>
            <Bar className="mt-1.5" height={4} value={Math.max(0, Math.min(1, g.progress))} />
          </li>
        ) : (
          <li className="font-text text-xs text-ink-2">{t('goals.final')}</li>
        )}
        {goals.map((goal) => {
          const done = g.done.includes(goal.id)
          return (
            <li key={goal.id} className={cx('flex items-start gap-2 rounded-control border px-2.5 py-1.5', done ? 'border-positive/40 bg-positive/8' : 'border-border')}>
              <Icon name={done ? 'check' : 'star'} size={14} className={cx('mt-0.5 shrink-0', done ? 'text-positive-ink' : 'text-ink-3')} />
              <span className="min-w-0 flex-1">
                <span className={cx('block text-[12.5px] font-semibold leading-snug', done ? 'text-positive-ink' : 'text-ink')}>{goal.text}</span>
                <span className="font-text block text-[11px] leading-snug text-ink-2">{goal.hint}</span>
              </span>
              {done && <span className="ui-label shrink-0 text-positive-ink">{t('goals.done')}</span>}
            </li>
          )
        })}
      </ul>
      {goals.length > 0 && <p className="font-text mt-1.5 text-[11px] leading-snug text-ink-3">{t('goals.reward')}</p>}
    </section>
  )
}

/** Last landed delayed decision effects of this run, newest first. */
export function DecisionOutcomes() {
  const outcomes = useGameStore(useShallow((s) => s.state.decisions.outcomes ?? []))
  const recent = outcomes.slice(-4).reverse()
  return (
    <section>
      <SectionTitle>{t('outcome.title')}</SectionTitle>
      {recent.length === 0 ? (
        <p className="font-text text-xs text-ink-2">{t('outcome.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {recent.map((o, i) => (
            <li key={`${o.cardId}-${o.day}-${i}`} className="flex items-start gap-2 rounded-control border border-border px-2.5 py-1.5">
              <Icon name="hourglass" size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-kind-decision)' }} />
              <span className="font-text min-w-0 flex-1 text-[12px] leading-snug text-ink">
                {t('outcome.line', { option: optionLabel(o.cardId, o.optionIndex) ?? o.cardId, effects: effectSummary(o.effects) })}
              </span>
              <span className="ui-label tabular shrink-0">{t('outcome.day', { d: Math.floor(o.day) + 1 })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
