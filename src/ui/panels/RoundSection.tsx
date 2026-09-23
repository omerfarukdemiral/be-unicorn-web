// Funding round block of the Büyüme panel (docs/CORE_LOOP.md §4.3 "Tur penceresi"):
// before the round: the early window (60% of target), the size choice (12 / 18 / 24 months ↔ equity) and the
// investor's due-diligence list; while it runs: the live offer, the checklist and this week's pitch.
// Every number comes from state.derived.round / state.round (the engine computes, the panel only shows).
// Open as {kind:'growth', section:'round'} while a choice waits, it is the `offer` focus pause.
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ROUND_SIZES, type DiligenceItem, type PitchOption, type RoundPitch, type RoundSize } from '../../engine/types'
import { STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Bar, Button, cx, IconBadge, Stat } from '../primitives'

const PITCH_ICON: Record<RoundPitch, IconName> = { metrics: 'bars', story: 'chat', coinvestor: 'handshake' }

function ddValue(d: DiligenceItem): string {
  if (d.id === 'runway') return t('unit.months', { v: fixed(d.value, 1) })
  if (d.id === 'growth') return pct(d.value, 1)
  return fixed(d.value, 0)
}

function ddTarget(d: DiligenceItem): string {
  if (d.id === 'growth') return pct(d.target, 0)
  return fixed(d.target, 0)
}

function Diligence({ items }: { items: readonly DiligenceItem[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="ui-label">{t('round.diligenceTitle')}</div>
      <ul className="flex flex-col gap-1">
        {items.map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-xs">
            <span
              className={cx('grid size-5 shrink-0 place-items-center rounded-full', d.met ? 'bg-positive/15 text-positive-ink' : 'bg-negative/15 text-negative-ink')}
              aria-hidden="true"
            >
              <Icon name={d.met ? 'check' : 'close'} size={12} />
            </span>
            <span className="font-semibold text-ink">{t(`round.dd.${d.id}`, { t: ddTarget(d) })}</span>
            <span className="tabular ml-auto text-ink-2">{t('round.dd.now', { v: ddValue(d) })}</span>
          </li>
        ))}
      </ul>
      <p className="font-text text-[11px] leading-snug text-ink-2">{t('round.diligenceHint')}</p>
    </div>
  )
}

export function RoundSection() {
  const s = useGameStore(
    useShallow((st) => ({
      stage: st.state.stage,
      round: st.state.round,
      view: st.state.derived.round,
      canStart: st.state.derived.canStartRound,
      valuation: st.state.finance.valuation,
      equity: st.state.stats.equity,
      mom: st.state.derived.momGrowth,
      progress: st.state.derived.stageProgress,
    })),
  )
  const dispatch = useGameStore((st) => st.dispatch)
  const [size, setSize] = useState<RoundSize>('target')
  const active = s.round?.active ? s.round : undefined
  const view = s.view
  const next = STAGES[(active?.targetStage ?? s.stage + 1) as number]
  if (!view && !active) return null

  return (
    <section id="round-section" className="flex scroll-mt-2 flex-col gap-4 border-t border-border-strong pt-4">
      <header className="flex items-center gap-3">
        <IconBadge icon={active ? 'timer' : 'rocket'} size={40} color="var(--color-brand)" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight tracking-wide">{active ? t('round.activeTitle') : t('round.windowTitle', { stage: next?.name ?? '' })}</h2>
          <p className="font-text text-xs text-ink-2">
            {active ? t('round.activeSub') : s.canStart ? t('round.windowOpen') : t('round.windowClosed', { v: money(view?.windowAt ?? 0) })}
          </p>
        </div>
      </header>

      {active ? (
        <ActiveRound
          weeksTotal={active.weeksTotal}
          weeksLeft={active.weeksLeft}
          amount={active.offer.amount}
          equity={active.offer.equity}
          preMoney={active.offer.preMoney}
          lastMove={active.lastMove}
          projected={view?.projected}
          diligence={view?.diligence ?? active.diligence ?? []}
          pitchDue={active.pitchDue}
          pitches={active.pitches ?? []}
          options={view?.pitchOptions ?? []}
          growthAsk={view?.growthAsk ?? 0}
          mom={s.mom}
          onPitch={(pitch) => dispatch({ type: 'roundPitch', pitch })}
        />
      ) : view ? (
        <>
          {!s.canStart ? (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-ink-2">
                <span className="ui-label">{t('round.progress')}</span>
                <span className="tabular">{t('round.windowProgress', { v: money(s.valuation), w: money(view.windowAt) })}</span>
              </div>
              <Bar value={view.windowAt > 0 ? Math.min(1, s.valuation / view.windowAt) : 0} height={6} />
            </div>
          ) : (
            <p className="font-text rounded-control bg-brand-soft px-3 py-2 text-xs leading-relaxed text-brand-ink">
              <span className="font-semibold">{t('round.priceNow', { p: pct(s.progress, 0), f: fixed(view.factor, 2) })}</span>
              <br />
              {t('round.priceHint')}
            </p>
          )}

          {view.sizes && (
            <div className="flex flex-col gap-1.5">
              <div className="ui-label">{t('round.sizeTitle')}</div>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t('round.sizeTitle')}>
                {ROUND_SIZES.map((k) => {
                  const o = view.sizes!.find((x) => x.size === k)
                  if (!o) return null
                  const on = size === k
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSize(k)}
                      className={cx(
                        'flex min-w-0 flex-col items-start gap-0.5 rounded-control border px-2 py-2 text-left transition-colors',
                        on ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-2',
                      )}
                    >
                      <span className={cx('text-[13px] font-semibold', on ? 'text-brand-ink' : 'text-ink')}>{t(`round.size.${k}`)}</span>
                      <span className="tabular text-[11px] text-ink-2">{t('round.sizeMonths', { v: o.months })}</span>
                      <span className="tabular text-[12px] font-semibold text-ink">{t('round.sizeAmount', { v: money(o.offer) })}</span>
                      <span className="tabular text-[11px] text-ink-2">{t('round.sizeEquity', { v: pct(o.equity, 1) })}</span>
                    </button>
                  )
                })}
              </div>
              <p className="font-text text-[11px] leading-snug text-ink-2">{t('round.sizeHint')}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('round.valuationNow')} value={money(s.valuation)} />
            <Stat label={t('round.yourEquity')} value={pct(s.equity, 1)} />
          </div>

          <Diligence items={view.diligence} />

          <ul className="font-text flex flex-col gap-1.5 text-xs leading-relaxed text-ink">
            <li className="flex gap-2">
              <Icon name="timer" size={14} className="mt-0.5 shrink-0 text-ink-2" />
              {t('round.takesWeeks')}
            </li>
            <li className="flex gap-2">
              <Icon name="trend" size={14} className="mt-0.5 shrink-0 text-ink-2" />
              {t('round.metricsMatter')}
            </li>
          </ul>
          <Button tone="primary" icon="rocket" disabled={!s.canStart} onClick={() => dispatch({ type: 'startRound', size })}>
            {s.canStart ? t('round.startSize', { v: t(`round.size.${size}`) }) : t('round.notReady')}
          </Button>
        </>
      ) : null}
    </section>
  )
}

function ActiveRound(p: {
  weeksTotal: number
  weeksLeft: number
  amount: number
  equity: number
  preMoney: number
  lastMove?: { week: number; from: number; to: number }
  projected?: number
  diligence: readonly DiligenceItem[]
  pitchDue?: number
  pitches: readonly { week: number; pitch: RoundPitch; delta: number }[]
  options: readonly PitchOption[]
  growthAsk: number
  mom: number
  onPitch: (pitch: RoundPitch) => void
}) {
  const up = p.lastMove ? p.lastMove.to >= p.lastMove.from : true
  const signed = (v: number) => (v >= 0 ? `+${pct(v, 1)}` : `−${pct(-v, 1)}`)
  const pitchDesc = (o: PitchOption): string => {
    if (o.pitch === 'metrics') return t('pitch.metrics.desc', { t: pct(p.growthAsk, 0), d: signed(o.delta), v: pct(p.mom, 1) })
    if (o.pitch === 'story') return t('pitch.story.desc', { v: signed(o.delta), e: o.energy })
    return t('pitch.coinvestor.desc', { w: o.weeks, e: pct(o.equity, 0) })
  }
  const lastPitch = p.pitches[p.pitches.length - 1]
  return (
    <>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-ink-2">
          <span className="ui-label">{t('round.progress')}</span>
          <span className="tabular">{t('round.weeks', { done: fixed(Math.max(0, p.weeksTotal - p.weeksLeft), 0), total: fixed(p.weeksTotal, 0) })}</span>
        </div>
        <Bar value={p.weeksTotal > 0 ? 1 - p.weeksLeft / p.weeksTotal : 0} height={6} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2 rounded-control border border-border px-3 py-2">
        <div className="min-w-0">
          <div className="ui-label">{t('round.liveOffer')}</div>
          <div className="tabular text-2xl font-bold leading-tight text-ink">{money(p.amount)}</div>
          {p.projected !== undefined && Math.abs(p.projected - p.amount) > 0.5 && (
            <div className="tabular text-[11px] text-ink-2">{t('round.projected', { v: money(p.projected) })}</div>
          )}
        </div>
        {p.lastMove && (
          <span
            className={cx('tabular inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold', up ? 'bg-positive/15 text-positive-ink' : 'bg-negative/15 text-negative-ink')}
          >
            <Icon name="arrowUp" size={11} className={up ? undefined : 'rotate-180'} />
            {t('round.liveMove', { w: p.lastMove.week, a: money(p.lastMove.from), b: money(p.lastMove.to) })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('round.equitySold')} value={pct(p.equity, 1)} />
        <Stat label={t('round.preMoney')} value={money(p.preMoney)} />
      </div>

      {p.pitchDue !== undefined ? (
        <div className="flex flex-col gap-1.5 rounded-control border border-brand/40 bg-brand-soft/60 p-2">
          <div>
            <div className="text-[13px] font-semibold text-brand-ink">{t('round.pitchTitle', { w: p.pitchDue })}</div>
            <p className="font-text text-[11px] text-ink-2">{t('round.pitchSub')}</p>
          </div>
          {p.options.map((o) => {
            const k = o.pitch
            return (
              <button
                key={k}
                type="button"
                disabled={!o.ok}
                onClick={() => p.onPitch(k)}
                className="flex items-start gap-2 rounded-control border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:border-brand disabled:opacity-50"
              >
                <Icon name={PITCH_ICON[k]} size={16} className="mt-0.5 shrink-0 text-brand-ink" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">{t(`pitch.${k}`)}</span>
                  <span className="font-text block text-[11px] leading-snug text-ink-2">{pitchDesc(o)}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="font-text text-xs text-ink-2">
          {lastPitch
            ? t('round.pitchDone', { w: lastPitch.week, p: t(`pitch.${lastPitch.pitch}`), d: lastPitch.delta === 0 ? '±0' : signed(lastPitch.delta) })
            : t('round.pitchWait')}
        </p>
      )}

      <Diligence items={p.diligence} />
      <p className="font-text rounded-control border border-dashed border-border-strong px-3 py-2 text-xs leading-relaxed text-ink-2">{t('round.coffeeHint')}</p>
    </>
  )
}
