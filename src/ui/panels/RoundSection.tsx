// Funding round block (PLAN §5.9) inside the Büyüme panel: start confirmation or live progress.
import { useShallow } from 'zustand/react/shallow'
import { STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Bar, Button, Stat } from '../primitives'


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
    <section id="round-section" className="flex scroll-mt-2 flex-col gap-4 rounded-2xl border border-lilac-300/60 bg-lilac-100/40 p-3">
        <header className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-lilac-100 text-lilac-500">
            <Icon name={active ? 'timer' : 'rocket'} size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{active ? t('round.activeTitle') : t('round.confirmTitle', { stage: next?.name ?? '' })}</h2>
            <p className="text-xs text-ink-600">{active ? t('round.activeSub') : t('round.confirmSub')}</p>
          </div>
        </header>

        {active ? (
          <>
            <div>
              <div className="mb-1 flex justify-between text-xs font-semibold text-ink-600">
                <span>{t('round.progress')}</span>
                <span className="tabular">{t('round.weeks', { done: fixed(Math.max(0, active.weeksTotal - active.weeksLeft), 0), total: fixed(active.weeksTotal, 0) })}</span>
              </div>
              <Bar value={active.weeksTotal > 0 ? 1 - active.weeksLeft / active.weeksTotal : 0} height={10} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t('round.amount')} value={money(active.offer.amount)} />
              <Stat label={t('round.equitySold')} value={pct(active.offer.equity, 1)} />
              <Stat label={t('round.preMoney')} value={money(active.offer.preMoney)} />
            </div>
            <p className="rounded-2xl bg-lemon-100 px-3 py-2 text-xs text-ink-700">{t('round.coffeeHint')}</p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t('round.amount')} value={money(next?.roundAmount ?? 0)} />
              <Stat label={t('round.equitySold')} value={pct(next?.roundEquity ?? 0)} />
              <Stat label={t('round.valuationNow')} value={money(s.valuation)} />
              <Stat label={t('round.yourEquity')} value={pct(s.equity, 1)} />
            </div>
            <ul className="flex flex-col gap-1.5 text-xs text-ink-700">
              <li className="flex gap-2">
                <Icon name="timer" size={14} className="mt-px shrink-0 text-lilac-500" />
                {t('round.takesWeeks')}
              </li>
              <li className="flex gap-2">
                <Icon name="trend" size={14} className="mt-px shrink-0 text-lilac-500" />
                {t('round.metricsMatter')}
              </li>
              {s.runway !== null && (
                <li className="flex gap-2">
                  <Icon name="hourglass" size={14} className="mt-px shrink-0 text-lilac-500" />
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

