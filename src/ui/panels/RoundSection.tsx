// Funding round block (PLAN §5.9) inside the Büyüme panel: start confirmation or live progress.
import { useShallow } from 'zustand/react/shallow'
import { STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Bar, Button, IconBadge, Stat } from '../primitives'


/** Funding round block of the Büyüme panel (was a modal): confirm, or progress while it runs. */
export function RoundSection() {
  const s = useGameStore(
    useShallow((st) => ({
      stage: st.state.stage,
      round: st.state.round,
      canStart: st.state.derived.canStartRound,
      valuation: st.state.finance.valuation,
      equity: st.state.stats.equity,
      runway: st.state.finance.runway,
    })),
  )
  const dispatch = useGameStore((st) => st.dispatch)
  const next = STAGES[s.stage + 1]
  const active = s.round?.active ? s.round : undefined

  return (
    <section id="round-section" className="flex scroll-mt-2 flex-col gap-4 border-t border-border-strong pt-4">
        <header className="flex items-center gap-3">
          <IconBadge icon={active ? 'timer' : 'rocket'} size={40} filled />
          <div>
            <h2 className="text-lg font-semibold leading-tight tracking-wide">{active ? t('round.activeTitle') : t('round.confirmTitle', { stage: next?.name ?? '' })}</h2>
            <p className="font-text text-xs text-ink-2">{active ? t('round.activeSub') : t('round.confirmSub')}</p>
          </div>
        </header>

        {active ? (
          <>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-ink-2">
                <span className="ui-label">{t('round.progress')}</span>
                <span className="tabular">{t('round.weeks', { done: fixed(Math.max(0, active.weeksTotal - active.weeksLeft), 0), total: fixed(active.weeksTotal, 0) })}</span>
              </div>
              <Bar value={active.weeksTotal > 0 ? 1 - active.weeksLeft / active.weeksTotal : 0} height={6} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t('round.amount')} value={money(active.offer.amount)} />
              <Stat label={t('round.equitySold')} value={pct(active.offer.equity, 1)} />
              <Stat label={t('round.preMoney')} value={money(active.offer.preMoney)} />
            </div>
            <p className="font-text rounded-control border border-dashed border-border-strong px-3 py-2 text-xs leading-relaxed text-ink-2">{t('round.coffeeHint')}</p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t('round.amount')} value={money(next?.roundAmount ?? 0)} />
              <Stat label={t('round.equitySold')} value={pct(next?.roundEquity ?? 0)} />
              <Stat label={t('round.valuationNow')} value={money(s.valuation)} />
              <Stat label={t('round.yourEquity')} value={pct(s.equity, 1)} />
            </div>
            <ul className="font-text flex flex-col gap-1.5 text-xs leading-relaxed text-ink">
              <li className="flex gap-2">
                <Icon name="timer" size={14} className="mt-0.5 shrink-0 text-ink-2" />
                {t('round.takesWeeks')}
              </li>
              <li className="flex gap-2">
                <Icon name="trend" size={14} className="mt-0.5 shrink-0 text-ink-2" />
                {t('round.metricsMatter')}
              </li>
              {s.runway !== null && (
                <li className="flex gap-2">
                  <Icon name="hourglass" size={14} className="mt-0.5 shrink-0 text-ink-2" />
                  {t('round.runwayNow', { v: fixed(s.runway, 1) })}
                </li>
              )}
            </ul>
            <Button tone="primary" icon="rocket" disabled={!s.canStart} onClick={() => dispatch({ type: 'startRound' })}>
              {s.canStart ? t('round.start') : t('round.notReady')}
            </Button>
          </>
        )}
    </section>
  )
}

