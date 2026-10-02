// Funding round block of the Büyüme panel (docs/CORE_LOOP.md §4.3 "Tur penceresi", GAMEPLAY V2 §6.3, §10.5):
// before the round: the early window, the size choice (8 / 12 / 16 months ↔ equity), the one-time down round after a
// failed round, the investor's due-diligence list; while it runs: the live offer, the strikes, the checklist and this
// week's pitch. HUD grammar: the offer factor and the round-end runway are Stats (the runway red in the danger band),
// each diligence row carries its +5% / −10% pill, the pitches are icon + number buttons. One sentence (the header).
// Every number comes from state.derived.round / state.round / the engine selectors (the panel only shows them).
// Open as {kind:'growth', section:'round'} while a choice waits, it is the `offer` focus pause.
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ROUND_SIZES, type DiligenceItem, type PitchOption, type RoundPitch, type RoundSize, type RoundSizeOption } from '../../engine/types'
import { BURN_MULTIPLE_MAX, DILIGENCE_MET, DILIGENCE_UNMET, ROUND_FAIL_STRIKES } from '../../engine/balance'
import { roundEndRunway } from '../../engine/loopSelectors'
import { STAGES } from '../../content'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed, money, pct } from '../format'
import { Bar, Button, CostPreview, cx, Dot, IconBadge, Pill, Stat } from '../primitives'
import { RUNWAY_DANGER_MONTHS } from '../theme'
import { useSpendPreview } from '../widgets'

const PITCH_ICON: Record<RoundPitch, IconName> = { metrics: 'bars', story: 'chat', coinvestor: 'handshake' }

function ddValue(d: DiligenceItem): string {
  if (d.id === 'runway') return t('unit.months', { v: fixed(d.value, 1) })
  if (d.id === 'growth') return pct(d.value, 1)
  // Burn multiple: capped at BURN_MULTIPLE_MAX = no net-new ARR yet, shown as a dash.
  if (d.id === 'burn') return d.value >= BURN_MULTIPLE_MAX ? '—' : fixed(d.value, 1)
  return fixed(d.value, 0)
}

function ddTarget(d: DiligenceItem): string {
  if (d.id === 'growth') return pct(d.target, 0)
  if (d.id === 'burn') return fixed(d.target, 1)
  return fixed(d.target, 0)
}

const signed = (v: number) => (v >= 0 ? `+${pct(v, 1)}` : `−${pct(-v, 1)}`)

/** Diligence rows: met mark, the ask, today's value, what the row does to the offer (+5% / −10%). */
function Diligence({ items }: { items: readonly DiligenceItem[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="ui-label">{t('round.diligenceTitle')}</div>
      <ul className="flex flex-col gap-1">
        {items
          .filter((d) => d.asked !== false)
          .map((d) => (
            <li key={d.id} data-dd={d.id} className="flex min-h-9 items-center gap-2 rounded-control bg-surface-2/60 px-2 py-1 text-xs">
              <span className={cx('grid size-5 shrink-0 place-items-center rounded-full', d.met ? 'bg-positive/15 text-positive-ink' : 'bg-energy/15 text-energy-ink')} aria-hidden="true">
                <Icon name={d.met ? 'check' : 'close'} size={12} />
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{t(`round.dd.${d.id}`, { t: ddTarget(d) })}</span>
              <span className="tabular shrink-0 text-[13px] font-semibold text-ink">{ddValue(d)}</span>
              <Pill className={cx('tabular shrink-0', d.met ? 'text-positive-ink' : 'text-energy-ink')}>
                {d.met ? t('round.ddMet', { v: pct(DILIGENCE_MET) }) : t('round.ddMiss', { v: pct(-DILIGENCE_UNMET) })}
              </Pill>
            </li>
          ))}
      </ul>
    </div>
  )
}

/** Months of runway left when the round ends (engine death day vs the close day); ∞ when cash never runs out. */
function RoundEndRunway() {
  const months = useGameStore((s) => roundEndRunway(s.state))
  const danger = months !== null && months < RUNWAY_DANGER_MONTHS
  return (
    <Stat
      label={t('round.endRunway')}
      icon="hourglass"
      color="var(--color-g-runway)"
      value={<span className={danger ? 'text-negative-ink' : undefined}>{months === null ? t('top.runwayInfinite') : t('unit.months', { v: fixed(months, 1) })}</span>}
    />
  )
}

/** Strikes (GAMEPLAY V2 §6.3): one pip per ROUND_FAIL_STRIKES, filled ones amber (a warning, not the red danger). */
function Strikes({ strikes, risk }: { strikes: number; risk: number }) {
  return (
    <div data-risk={fixed(risk, 2)} className="flex items-center gap-1.5" aria-label={`${t('round.strikes')} ${strikes}/${ROUND_FAIL_STRIKES}`}>
      <span className="ui-label">{t('round.strikes')}</span>
      {Array.from({ length: ROUND_FAIL_STRIKES }, (_, i) => (
        <Dot key={i} size={9} color={i < strikes ? 'var(--color-energy)' : 'var(--color-border-strong)'} />
      ))}
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
    })),
  )
  const dispatch = useGameStore((st) => st.dispatch)
  const [size, setSize] = useState<RoundSize>('target')
  const active = s.round?.active ? s.round : undefined
  const view = s.view
  const next = STAGES[(active?.targetStage ?? s.stage + 1) as number]
  if (!view && !active) return null
  const chosen = view?.sizes?.find((x) => x.size === size)

  return (
    <section id="round-section" className="flex scroll-mt-2 flex-col gap-3 border-t border-border-strong pt-3">
      <header className="flex items-center gap-3">
        <IconBadge icon={active ? 'timer' : 'rocket'} size={36} color="var(--color-brand)" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight tracking-wide">{active ? t('round.activeTitle') : t('round.windowTitle', { stage: next?.name ?? '' })}</h2>
          <p className="font-text text-xs text-ink-2">{active ? t('round.activeSub') : s.canStart ? t('round.windowOpen') : t('round.windowClosed', { v: money(view?.windowAt ?? 0) })}</p>
        </div>
      </header>

      {active ? (
        <ActiveRound
          weeksTotal={active.weeksTotal}
          weeksLeft={active.weeksLeft}
          amount={active.offer.amount}
          equity={active.offer.equity}
          preMoney={active.offer.preMoney}
          factor={view?.factor ?? 1}
          lastMove={active.lastMove}
          projected={view?.projected}
          diligence={view?.diligence ?? active.diligence ?? []}
          pitchDue={active.pitchDue}
          pitches={active.pitches ?? []}
          options={view?.pitchOptions ?? []}
          strikes={view?.strikes ?? 0}
          risk={view?.risk ?? 0}
          onPitch={(pitch) => dispatch({ type: 'roundPitch', pitch })}
        />
      ) : view ? (
        <>
          {!s.canStart && (
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="ui-label">{t('round.progress')}</span>
                <span className="tabular text-[15px] font-semibold text-ink">
                  {money(s.valuation)} <span className="text-[12px] text-ink-2">/ {money(view.windowAt)}</span>
                </span>
              </div>
              <Bar value={view.windowAt > 0 ? s.valuation / view.windowAt : 0} height={6} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('round.mult')} icon="scale" color="var(--color-brand)" value={`${fixed(view.factor, 2)}×`} />
            <RoundEndRunway />
          </div>

          {view.sizes && (
            <div className="flex flex-col gap-1">
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
                        'flex min-w-0 flex-col items-start gap-0.5 rounded-control border px-2 py-1.5 text-left transition-colors',
                        on ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-2',
                      )}
                    >
                      <span className={cx('ui-label', on && 'text-brand-ink')}>{t(`round.size.${k}`)}</span>
                      <span className="tabular text-[17px] font-semibold leading-tight text-ink">{money(o.offer)}</span>
                      <span className="tabular text-[11px] text-ink-2">
                        {t('round.sizeEquity', { v: pct(o.equity, 1) })} · {t('unit.months', { v: o.months })}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <Diligence items={view.diligence} />

          <Button tone="commit" icon="rocket" disabled={!s.canStart} onClick={() => dispatch({ type: 'startRound', size })}>
            {s.canStart ? t('round.startSize', { v: t(`round.size.${size}`) }) : t('round.notReady')}
          </Button>
          {view.downRound && chosen?.down && <DownRound option={chosen} retryIn={view.retryIn ?? 0} onStart={() => dispatch({ type: 'startRound', size, down: true })} />}
        </>
      ) : null}
    </section>
  )
}

/** The one-time down round after a failed round (§6.3): less money, more equity, no floor. A commit with its preview. */
function DownRound({ option, retryIn, onStart }: { option: RoundSizeOption; retryIn: number; onStart: () => void }) {
  const down = option.down!
  const preview = useSpendPreview(down.offer, 0)
  const wait = retryIn > 0
  return (
    <div data-down-round="" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control bg-surface-2/60 p-2" title={t('round.downTitle')}>
      <div className="min-w-0 flex-1">
        <div className="ui-label">{t('round.downGo')}</div>
        <div className="tabular text-[22px] font-semibold leading-tight text-ink">{money(down.offer)}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        {wait ? <Pill className="tabular">{t('round.retry', { d: Math.ceil(retryIn) })}</Pill> : <CostPreview preview={preview} cost={t('goals.prize', { v: pct(down.equity, 1) })} />}
        <Button tone="commit" size="sm" icon="rocket" disabled={wait} onClick={onStart}>
          {t('round.downGo')}
        </Button>
      </span>
    </div>
  )
}

/** A pitch as numbers: offer change (a range for the story), weeks off and equity for the co-investor, energy. */
function PitchNumbers({ o }: { o: PitchOption }) {
  return (
    <span className="tabular flex flex-wrap items-center gap-x-2 text-[12px] font-semibold text-ink-2">
      {o.pitch === 'coinvestor' ? (
        <>
          <span className="inline-flex items-center gap-0.5">
            <Icon name="timer" size={12} />−{o.weeks}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Icon name="pie" size={12} />+{pct(o.equity, 0)}
          </span>
        </>
      ) : (
        <span>{o.pitch === 'story' ? `${signed(o.min ?? o.delta)}…${signed(o.max ?? o.delta)}` : signed(o.delta)}</span>
      )}
      {o.energy > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <Icon name="bolt" size={12} />−{o.energy}
        </span>
      )}
    </span>
  )
}

function ActiveRound(p: {
  weeksTotal: number
  weeksLeft: number
  amount: number
  equity: number
  preMoney: number
  factor: number
  lastMove?: { week: number; from: number; to: number }
  projected?: number
  diligence: readonly DiligenceItem[]
  pitchDue?: number
  pitches: readonly { week: number; pitch: RoundPitch; delta: number }[]
  options: readonly PitchOption[]
  strikes: number
  risk: number
  onPitch: (pitch: RoundPitch) => void
}) {
  const up = p.lastMove ? p.lastMove.to >= p.lastMove.from : true
  const lastPitch = p.pitches[p.pitches.length - 1]
  return (
    <>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <Strikes strikes={p.strikes} risk={p.risk} />
          <span className="tabular text-xs font-semibold text-ink-2">{t('round.weeks', { done: fixed(p.weeksTotal - p.weeksLeft, 0), total: fixed(p.weeksTotal, 0) })}</span>
        </div>
        <Bar value={p.weeksTotal > 0 ? 1 - p.weeksLeft / p.weeksTotal : 0} height={6} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2 rounded-control bg-surface-2/60 px-3 py-2">
        <div className="min-w-0">
          <div className="ui-label">{t('round.liveOffer')}</div>
          <div className="tabular text-[28px] font-semibold leading-tight text-ink">{money(p.amount)}</div>
          {p.projected !== undefined && Math.round(p.projected) !== Math.round(p.amount) && (
            <div className="tabular text-[11px] text-ink-2">{t('round.projected', { v: money(p.projected) })}</div>
          )}
        </div>
        {/* Only a real change: "$613K → $613K" says nothing. The week count lives in the progress row alone. */}
        {p.lastMove && Math.round(p.lastMove.from) !== Math.round(p.lastMove.to) && (
          <span className={cx('tabular inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold', up ? 'bg-positive/15 text-positive-ink' : 'bg-energy/15 text-energy-ink')}>
            <Icon name="arrowUp" size={11} className={up ? undefined : 'rotate-180'} />
            {money(p.lastMove.from)} → {money(p.lastMove.to)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('round.mult')} icon="scale" color="var(--color-brand)" value={`${fixed(p.factor, 2)}×`} />
        <RoundEndRunway />
        <Stat label={t('round.equitySold')} value={pct(p.equity, 1)} />
        <Stat label={t('round.preMoney')} value={money(p.preMoney)} />
      </div>

      {p.pitchDue !== undefined ? (
        <div className="flex flex-col gap-1">
          <div className="ui-label text-brand-ink">{t('round.pitchTitle')}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {p.options.map((o) => (
              <button
                key={o.pitch}
                type="button"
                disabled={!o.ok}
                onClick={() => p.onPitch(o.pitch)}
                title={t(`pitch.${o.pitch}`)}
                className="flex min-w-0 flex-col items-start gap-1 rounded-control border border-brand/40 bg-surface px-2 py-1.5 text-left transition-[border-color,transform] duration-[120ms] hover:border-brand active:scale-[0.96] disabled:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-1">
                  <Icon name={PITCH_ICON[o.pitch]} size={15} className="shrink-0 text-brand-ink" />
                  <span className="truncate text-[12px] font-semibold text-ink">{t(`pitch.${o.pitch}`)}</span>
                </span>
                <PitchNumbers o={o} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        lastPitch && (
          <div className="flex items-center gap-1.5 text-xs text-ink-2">
            <Icon name={PITCH_ICON[lastPitch.pitch]} size={14} className="shrink-0" />
            <span className="font-semibold text-ink">{t(`pitch.${lastPitch.pitch}`)}</span>
            <span className="tabular font-semibold">{lastPitch.delta === 0 ? '±0' : signed(lastPitch.delta)}</span>
          </div>
        )
      )}

      <Diligence items={p.diligence} />
    </>
  )
}
