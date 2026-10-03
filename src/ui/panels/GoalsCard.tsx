// Stage goals card (docs/CORE_LOOP.md §4.3): ★ the next stage's valuation (required) + two ☆ optional goals.
// Plus "Kararın → sonucu": delayed decision effects that have landed, with the option that caused them (§6).
// HUD grammar (GAMEPLAY V2 §10.5): the valuation formula is a stacked bar of its parts, a ☆ shows its prize as a pill
// (−1% hisse on the next round), the goal's hint is never rendered.
import { useShallow } from 'zustand/react/shallow'
import { GOAL_STAR_EQUITY_DISCOUNT, VAL_PER_LAUNCHED, VAL_PER_RELEASE, VAL_PER_USER, VAL_RELEASE_MAX } from '../../engine/balance'
import type { ValuationBreakdown } from '../../engine/types'
import { goalsOfStage, STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { fixed, money, num, pct } from '../format'
import { Bar, cx, Pill, SectionTitle } from '../primitives'
import { Icon } from '../icons'
import { effectSummary, optionLabel } from '../loopUi'
import { Legend, ramp, WIDGET_COLOR, type LegendPart } from '../theme'
import { StackBar } from '../widgets'

/** Stable empty list: a fresh `[]` inside a useShallow object would change every snapshot (older saves have no goalsDone). */
const NONE: readonly string[] = []

export function GoalsCard() {
  const g = useGameStore(
    useShallow((s) => ({
      stage: s.state.stage,
      valuation: s.state.finance.valuation,
      progress: s.state.derived.stageProgress,
      done: s.state.goalsDone ?? NONE,
      parts: s.state.derived.valuationParts,
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
            <Bar className="mt-1.5" height={4} value={g.progress} />
            {/* Değerleme dökümü: what moves the number (launches / users / releases before revenue, then MRR × multiple). */}
            {g.parts && <ValuationParts parts={g.parts} />}
          </li>
        ) : (
          <li className="text-xs font-semibold text-ink-2">{t('goals.final')}</li>
        )}
        {goals.map((goal) => {
          const done = g.done.includes(goal.id)
          return (
            <li key={goal.id} className={cx('flex items-start gap-2 rounded-control border px-2.5 py-1.5', done ? 'border-positive/40 bg-positive/8' : 'border-border')}>
              <Icon name={done ? 'check' : 'star'} size={14} className={cx('mt-0.5 shrink-0', done ? 'text-positive-ink' : 'text-ink-3')} />
              <span className="min-w-0 flex-1">
                <span className={cx('block text-[12.5px] font-semibold leading-snug', done ? 'text-positive-ink' : 'text-ink')}>{goal.text}</span>
              </span>
              {done ? (
                <span className="ui-label shrink-0 text-positive-ink">{t('goals.done')}</span>
              ) : (
                <Pill className="tabular shrink-0 text-ink">{t('goals.prize', { v: pct(GOAL_STAR_EQUITY_DISCOUNT) })}</Pill>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * The valuation as a stacked bar of what builds it (engine valuationParts); the legend shows count × rate before
 * revenue (playtest LD2: one more launch is a visible +$150K). Also drawn under Büyüme's product block.
 */
export function ValuationParts({ parts: v }: { parts: ValuationBreakdown }) {
  const R = ramp(WIDGET_COLOR.cash)
  const list: LegendPart[] =
    v.mode === 'pre'
      ? [
          { value: v.launchedValue, color: R[0], label: t('goals.part.launchedN', { n: v.launched, r: money(VAL_PER_LAUNCHED) }) },
          { value: v.usersValue, color: R[1], label: t('goals.part.usersN', { n: num(v.users), r: money(VAL_PER_USER) }) },
          { value: v.releasesValue, color: R[2], label: t('goals.part.releasesN', { n: v.releases, m: VAL_RELEASE_MAX, r: money(VAL_PER_RELEASE) }) },
        ]
      : [
          { value: v.total - v.preFade, color: R[0], label: t('goals.part.mrr', { x: fixed(v.multiple, 1) }) },
          { value: v.preFade, color: R[3], label: t('goals.part.fade') },
        ]
  return (
    <div className="mt-1" aria-label={t('goals.parts')}>
      <StackBar parts={list} />
      <Legend parts={list.filter((x) => x.value > 0)} format={money} className="mt-1" />
    </div>
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
