// HUD widget registry (PLAN §2 "Kullan"): each unlocked HudWidget maps to a small chip.
// Widgets only display engine numbers; no formulas beyond presentation (shares, 1 − churn).
// Look (docs/DESIGN.md): neutral chip on a warm card; each gauge owns a hue (WIDGET_COLOR) used on its
// icon (on a ~12% tile) and on its thin bar / sparkline / stacked ramp. Values stay ink (AA); only
// warnings turn a number red.
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { HudWidget } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { compact, fixed, money, num, pct, signedMoney } from './format'
import { Bar, cx, Dot } from './primitives'
import { iconTone, soft, WIDGET_COLOR } from './theme'
import { useTween } from './time'
import { effectiveSpeed } from '../store/gameStore'
import { useFreshEvents } from './loopUi'

export type WidgetTier = 'primary' | 'secondary' | 'hidden'

export interface WidgetDef {
  id: HudWidget
  icon: IconName
  /** Gauge hue (CSS colour): icon, icon tile and bar. */
  color: string
  tier: WidgetTier
  /** Renders the chip, or null when nothing to show right now. */
  Component: ComponentType<{ compact?: boolean }>
}

// ---------------------------------------------------------------------------
// Chip shell
// ---------------------------------------------------------------------------

export function WidgetChip({
  icon,
  color = 'var(--color-ink-2)',
  label,
  value,
  sub,
  alert,
  warn,
  children,
  title,
  compact: isCompact,
  className,
}: {
  icon: IconName
  /** Gauge hue (WIDGET_COLOR[id]). */
  color?: string
  label: string
  value: ReactNode
  sub?: ReactNode
  /** Warning state: a tiny red mark next to the label (no fills). */
  alert?: boolean
  /** Early warning (e.g. morale drifting into the tired band): a hollow red ring, quieter than `alert`. */
  warn?: boolean
  children?: ReactNode
  title?: string
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cx('flex min-w-0 items-start rounded-control', isCompact ? 'gap-1.5 px-1.5 py-1' : 'gap-2 px-2 py-1.5', className)}
      title={title ?? label}
    >
      <span
        aria-hidden="true"
        className={cx('grid shrink-0 place-items-center rounded-[7px]', isCompact ? 'mt-px size-5' : 'size-7')}
        style={{ color: iconTone(color), background: soft(color) }}
      >
        <Icon name={icon} size={isCompact ? 12 : 15} />
      </span>
      <div className="min-w-0 flex-1">
        {!isCompact && (
          // Label never truncates (a cut label loses its meaning): tighter tracking, wraps to 2 lines if needed.
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="ui-label line-clamp-2 leading-[14px] tracking-[0.04em]">{label}</span>
            <StatusMark alert={alert} warn={warn} size={6} />
          </div>
        )}
        {isCompact ? (
          // Phones: value on its own line, sub (e.g. monthly net) below it.
          <>
            <div className="tabular flex min-w-0 items-center gap-1 text-sm font-semibold leading-tight text-ink">
              <span className="min-w-0 truncate">{value}</span>
              <StatusMark alert={alert} warn={warn} size={5} />
            </div>
            {sub && <div className="tabular truncate text-[10px] font-medium leading-tight text-ink-2">{sub}</div>}
          </>
        ) : (
          // Values stay short (number + unit); the sub wraps under them when the column is narrow.
          // Nothing is ellipsised: touch screens have no tooltip to recover a cut value.
          <div className="tabular mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold leading-tight text-ink">
            <span className="max-w-full break-words">{value}</span>
            {sub && <span className="max-w-full break-words text-[11px] font-medium text-ink-2">{sub}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

function StatusMark({ alert, warn, size }: { alert?: boolean; warn?: boolean; size: number }) {
  if (alert) return <Dot color="var(--color-negative)" size={size} />
  if (warn) return <span aria-hidden="true" className="inline-block shrink-0 rounded-full border-[1.5px] border-negative" style={{ width: size, height: size }} />
  return null
}

/** Stacked share bar ramp: one gauge hue in four strengths (100 / 70 / 45 / 25% over the surface). */
function ramp(color: string): [string, string, string, string] {
  const at = (p: number) => `color-mix(in oklab, ${color} ${p}%, var(--color-surface))`
  return [color, at(70), at(45), at(25)]
}

function StackBar({ parts }: { parts: { value: number; color: string; label: string }[] }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0)
  return (
    <div className="mt-1.5 flex h-1 w-full gap-px overflow-hidden rounded-full bg-border">
      {total > 0 &&
        parts.map((p) =>
          p.value > 0 ? (
            <div key={p.label} title={`${p.label}: ${compact(p.value)}`} style={{ width: `${(Math.max(0, p.value) / total) * 100}%`, background: p.color }} />
          ) : null,
        )}
    </div>
  )
}

function Spark({ values, line, color }: { values: number[]; line?: number; color: string }) {
  const w = 72
  const h = 18
  const pts = values.slice(-12)
  const max = Math.max(1, line ?? 0, ...pts)
  const path = pts.map((v, i) => `${pts.length === 1 ? 0 : (i / (pts.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="mt-1 overflow-visible" aria-hidden="true">
      {line !== undefined && <line x1={0} x2={w} y1={h - (line / max) * h} y2={h - (line / max) * h} stroke="var(--color-ink-3)" strokeDasharray="3 2" />}
      {pts.length > 0 && <polyline points={path} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" />}
    </svg>
  )
}

function Pie({ fraction, color }: { fraction: number; color: string }) {
  const r = 7
  const c = 2 * Math.PI * r
  return (
    <svg width={14} height={14} viewBox="0 0 18 18" className="-rotate-90" aria-hidden="true">
      <circle cx={9} cy={9} r={r} fill={soft(color, 22)} />
      <circle cx={9} cy={9} r={r / 2} fill="none" stroke={color} strokeWidth={r} strokeDasharray={`${(fraction * c) / 2} ${c}`} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

/**
 * Kasa value with enough digits that a single day's burn moves it ("$29.98K" → "$29.97K"): the compact
 * convention (K/M/B, '.' decimal), one or two more decimals than money().
 */
function ledgerMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const body = a < 1e3 ? `${Math.round(a)}` : a < 1e5 ? `${(a / 1e3).toFixed(2)}K` : a < 1e6 ? `${(a / 1e3).toFixed(1)}K` : a < 1e9 ? `${(a / 1e6).toFixed(a < 1e8 ? 2 : 1)}M` : `${(a / 1e9).toFixed(2)}B`
  return `${sign}$${body}`
}

/** Months of runway under which the Kasa chip pulses red. */
const RUNWAY_CRITICAL = 3

/**
 * Kasa: the value counts smoothly. Revenue flows in every day (a green "+$X" floats out of the value); salaries,
 * rent and infra pile up and leave in one lump on payday (the 1st): the value shakes, flashes red and drops a big
 * "−$X" (docs/CORE_LOOP.md §5 "Maaş günü"). The pill counts what has piled up and the days left to payday.
 */
function CashWidget({ compact: c }: { compact?: boolean }) {
  const { cash, net, mrr, owed, debt, runway, day, flowing } = useGameStore(
    useShallow((s) => {
      const l = s.state.finance.ledger
      return {
        cash: s.state.stats.cash,
        net: s.state.finance.net,
        mrr: s.state.finance.mrr,
        owed: l ? l.salaries + l.rent + l.infra + l.ads + (l.founder ?? 0) : 0,
        debt: s.state.finance.debt,
        runway: s.state.finance.runway,
        day: Math.floor(s.state.time.day),
        flowing: effectiveSpeed(s) > 0,
      }
    }),
  )
  const shown = useTween(cash)
  const perDay = net / 30
  const critical = cash < 0 || (runway !== null && runway < RUNWAY_CRITICAL)
  const tone = perDay >= 0 ? 'text-positive-ink' : 'text-negative-ink'
  const toPayday = 30 - (day % 30)

  // Floating deltas: the day's revenue (small, green) and payday's lump (big, red). Each fades on its own.
  const [drops, setDrops] = useState<{ id: number; text: string; up: boolean; big?: boolean }[]>([])
  const pushDrop = (d: { id: number; text: string; up: boolean; big?: boolean }, ms: number) => {
    setDrops((cur) => [...cur.slice(-2), d])
    // No cleanup: at 4× the next day lands before this one has faded (a late setState after unmount is a no-op).
    window.setTimeout(() => setDrops((cur) => cur.filter((x) => x.id !== d.id)), ms)
  }
  const lastDay = useRef(day)
  useEffect(() => {
    if (day === lastDay.current) return
    const fresh = day > lastDay.current && flowing
    lastDay.current = day
    const inflow = mrr / 30
    if (!fresh || inflow < 0.5) return
    pushDrop({ id: day, text: signedMoney(inflow), up: true }, 1200)
  }, [day]) // eslint-disable-line react-hooks/exhaustive-deps

  const [payFlash, setPayFlash] = useState(0)
  useFreshEvents((events) => {
    for (const e of events) {
      if (e.kind !== 'payday' || !(e.value !== undefined && e.value > 0.5)) continue
      setPayFlash(e.id)
      pushDrop({ id: -e.id, text: `−${money(e.value)}`, up: false, big: true }, 1800)
    }
  })

  return (
    <WidgetChip
      compact={c}
      color={WIDGET_COLOR.cash}
      icon="cash"
      label={t('hud.cash')}
      alert={critical}
      className={cx('relative', critical && 'animate-danger-pulse')}
      value={
        <span className="relative inline-block">
          <span key={payFlash} className={cx(shown < 0 && 'text-negative-ink', payFlash > 0 && 'inline-block animate-payday')}>
            {ledgerMoney(shown)}
          </span>
          {drops.map((d) => (
            <span
              key={d.id}
              aria-hidden="true"
              className={cx(
                'pointer-events-none absolute left-full top-0 ml-1 whitespace-nowrap font-bold',
                d.big ? 'animate-payday-drop text-[15px]' : 'animate-cash-rise text-[11px]',
                d.up ? 'text-positive-ink' : 'text-negative-ink',
              )}
            >
              {d.text}
            </span>
          ))}
        </span>
      }
      sub={
        c ? (
          <span className={tone}>{t('time.perDay', { v: signedMoney(perDay) })}</span>
        ) : (
          <span className={tone}>{t('hud.perMonth', { v: signedMoney(net) })}</span>
        )
      }
      title={debt > 0 ? t('hud.debtTitle', { v: money(debt) }) : t('hud.cashTitle')}
    >
      {!c && (
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <span
            className={cx('tabular inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold', tone)}
            style={{ background: soft(perDay >= 0 ? 'var(--color-positive)' : 'var(--color-negative)', 12) }}
          >
            <Icon name="arrowUp" size={11} className={perDay >= 0 ? undefined : 'rotate-180'} />
            {t('time.perDay', { v: signedMoney(perDay) })}
          </span>
          {owed > 0.5 && (
            <span className="tabular text-[10.5px] font-medium text-ink-2" title={t('cash.paydayTitle')}>
              {t('cash.owed', { d: toPayday, v: `−${money(owed)}` })}
            </span>
          )}
        </span>
      )}
    </WidgetChip>
  )
}

function UsersWidget({ compact: c }: { compact?: boolean }) {
  const users = useGameStore((s) => s.state.stats.users)
  const overload = useGameStore((s) => s.state.derived.overload)
  return (
    <WidgetChip
      compact={c}
      color={WIDGET_COLOR.users}
      icon="users"
      label={t('hud.users')}
      alert={overload > 0}
      value={num(users)}
      sub={overload > 0 ? t('hud.overload') : undefined}
    />
  )
}

function MoraleWidget({ compact: c }: { compact?: boolean }) {
  const morale = useGameStore((s) => s.state.stats.morale)
  const critical = morale < 28
  // 28–50 = the tired band: an early, quieter mark before it turns critical.
  const tired = !critical && morale < 50
  return (
    <WidgetChip compact={c} color={WIDGET_COLOR.morale} icon="heart" label={t('hud.morale')} alert={critical} warn={tired} value={<span className={critical ? 'text-negative-ink' : undefined}>{Math.round(morale)}</span>}>
      {!c && <Bar className="mt-1.5" height={4} value={Math.max(0, Math.min(100, morale)) / 100} color={critical ? 'var(--color-negative)' : WIDGET_COLOR.morale} />}
    </WidgetChip>
  )
}

function RunwayWidget({ compact: c }: { compact?: boolean }) {
  const runway = useGameStore((s) => s.state.finance.runway)
  const danger = runway !== null && runway < 6
  return (
    <WidgetChip
      compact={c}
      color={WIDGET_COLOR.runway}
      icon="hourglass"
      label={t('hud.runway')}
      alert={danger}
      value={runway === null ? '∞' : <span className={danger ? 'text-negative-ink' : undefined}>{t('unit.months', { v: fixed(runway, 1) })}</span>}
      sub={runway === null ? t('hud.profitable') : undefined}
    />
  )
}

function BurnWidget({ compact: c }: { compact?: boolean }) {
  const b = useGameStore(useShallow((s) => ({ burn: s.state.finance.burn, ...s.state.finance.burnBreakdown })))
  const RAMP = ramp(WIDGET_COLOR.burnBreakdown)
  return (
    <WidgetChip compact={c} color={WIDGET_COLOR.burnBreakdown} icon="flame" label={t('hud.burn')} value={t('hud.perMonthPlain', { v: money(b.burn) })}>
      <StackBar
        parts={[
          { value: b.salaries, color: RAMP[0], label: t('burn.salaries') },
          { value: b.rent, color: RAMP[1], label: t('burn.rent') },
          { value: b.infra, color: RAMP[2], label: t('burn.infra') },
          { value: b.ads, color: RAMP[3], label: t('burn.ads') },
        ]}
      />
    </WidgetChip>
  )
}

function RetentionWidget({ compact: c }: { compact?: boolean }) {
  const churn = useGameStore((s) => s.state.stats.churn)
  return <WidgetChip compact={c} color={WIDGET_COLOR.retention} icon="magnet" label={t('hud.retention')} value={pct(1 - churn, 1)} sub={t('hud.monthly')} />
}

function ProfitWidget({ compact: c }: { compact?: boolean }) {
  const { hist, burn, net } = useGameStore(useShallow((s) => ({ hist: s.state.finance.mrrHistory, burn: s.state.finance.burn, net: s.state.finance.net })))
  return (
    <WidgetChip
      compact={c}
      color={WIDGET_COLOR.profitProjection}
      icon="trend"
      label={t('hud.profitProjection')}
      value={net >= 0 ? t('hud.profitable') : money(-net)}
      sub={net >= 0 ? undefined : t('hud.gapSub')}
    >
      {!c && <Spark values={hist} line={burn} color={WIDGET_COLOR.profitProjection} />}
    </WidgetChip>
  )
}

function CapTableWidget({ compact: c }: { compact?: boolean }) {
  const equity = useGameStore((s) => s.state.stats.equity)
  return (
    <WidgetChip compact={c} color={WIDGET_COLOR.capTable} icon="pie" label={t('hud.capTable')} value={<span className="inline-flex items-center gap-1.5"><Pie fraction={equity} color={WIDGET_COLOR.capTable} />{pct(equity)}</span>} sub={t('hud.yours')} />
  )
}

function RoundTimerWidget({ compact: c }: { compact?: boolean }) {
  const round = useGameStore(useShallow((s) => (s.state.round?.active ? { left: s.state.round.weeksLeft, total: s.state.round.weeksTotal } : null)))
  if (!round) return <WidgetChip compact={c} color={WIDGET_COLOR.roundTimer} icon="timer" label={t('hud.roundTimer')} value={<span className="text-ink-2">{t('hud.noRound')}</span>} />
  return (
    <WidgetChip compact={c} color={WIDGET_COLOR.roundTimer} icon="timer" label={t('hud.roundTimer')} value={t('unit.weeksLeft', { v: fixed(Math.max(0, round.left), 0) })}>
      {!c && <Bar className="mt-1.5" height={4} value={round.total > 0 ? 1 - round.left / round.total : 0} color={WIDGET_COLOR.roundTimer} />}
    </WidgetChip>
  )
}

function ChurnWidget({ compact: c }: { compact?: boolean }) {
  const churn = useGameStore((s) => s.state.stats.churn)
  const high = churn > 0.08
  return <WidgetChip compact={c} color={WIDGET_COLOR.churn} icon="leak" label={t('hud.churn')} alert={high} value={<span className={high ? 'text-negative-ink' : undefined}>{pct(churn, 1)}</span>} sub={t('hud.monthly')} />
}

function ArpuWidget({ compact: c }: { compact?: boolean }) {
  const arpu = useGameStore((s) => s.state.stats.arpu)
  return <WidgetChip compact={c} color={WIDGET_COLOR.arpu} icon="coin" label={t('hud.arpu')} value={`$${fixed(arpu, 2)}`} sub={t('hud.perUser')} />
}

function ReputationWidget({ compact: c }: { compact?: boolean }) {
  const rep = useGameStore((s) => s.state.stats.reputation)
  return <WidgetChip compact={c} color={WIDGET_COLOR.reputation} icon="megaphone" label={t('hud.reputation')} value={Math.round(rep)} sub="/100" />
}

/** Founder control (cap-table-health): exact stake and whether the founder still holds a majority. */
function EquityWidget({ compact: c }: { compact?: boolean }) {
  const equity = useGameStore((s) => s.state.stats.equity)
  const majority = equity >= 0.5
  return (
    <WidgetChip
      compact={c}
      color={WIDGET_COLOR.equity}
      icon="key"
      label={t('hud.founderStake')}
      alert={!majority}
      value={pct(equity, 1)}
      sub={majority ? t('hud.control') : t('hud.controlShared')}
    />
  )
}

/** Moral haritası (morale-compounds): how many people sit in each morale band; the office floor tints to match. */
function MoraleMapWidget({ compact: c }: { compact?: boolean }) {
  const bands = useGameStore(
    useShallow((s) => {
      let low = 0
      let mid = 0
      let high = 0
      for (const e of s.state.employees) {
        if (e.morale < 28) low++
        else if (e.morale < 50) mid++
        else high++
      }
      return { low, mid, high }
    }),
  )
  return (
    <WidgetChip compact={c} color={WIDGET_COLOR.moraleHeatmap} icon="grid" label={t('hud.moraleMap')} alert={bands.low > 0} value={`${bands.low}/${bands.mid}/${bands.high}`} sub={t('hud.moraleMapSub')} title={t('hud.moraleMapValue', bands)}>
      {!c && (
        <StackBar
          parts={[
            // Burnout band reads red; tired = faded morale hue; fine = full morale hue.
            { value: bands.low, color: 'var(--color-negative)', label: t('status.burnout') },
            { value: bands.mid, color: ramp(WIDGET_COLOR.moraleHeatmap)[2], label: t('status.tired') },
            { value: bands.high, color: WIDGET_COLOR.moraleHeatmap, label: t('status.working') },
          ]}
        />
      )}
    </WidgetChip>
  )
}

function LtvCacWidget({ compact: c }: { compact?: boolean }) {
  const r = useGameStore((s) => s.state.derived.ltvCac)
  const bad = r !== null && r < 3
  return (
    <WidgetChip
      compact={c}
      color={WIDGET_COLOR.ltvCac}
      icon="scale"
      label={t('hud.ltvCac')}
      alert={bad}
      value={r === null ? <span className="text-ink-2">—</span> : <span className={bad ? 'text-negative-ink' : 'text-positive-ink'}>{`${fixed(r, 1)}×`}</span>}
      sub={r !== null ? (bad ? t('hud.ltvLow') : t('hud.ltvOk')) : undefined}
    />
  )
}

function ChannelsWidget({ compact: c }: { compact?: boolean }) {
  const ch = useGameStore(useShallow((s) => s.state.derived.channels))
  const total = ch.organic + ch.paid + ch.manual + ch.enterprise
  const RAMP = ramp(WIDGET_COLOR.channelBreakdown)
  return (
    <WidgetChip compact={c} color={WIDGET_COLOR.channelBreakdown} icon="branch" label={t('hud.channels')} value={t('hud.perMonthPlain', { v: `+${num(total)}` })}>
      <StackBar
        parts={[
          { value: ch.organic, color: RAMP[0], label: t('channel.organic') },
          { value: ch.paid, color: RAMP[1], label: t('channel.paid') },
          { value: ch.manual, color: RAMP[2], label: t('channel.manual') },
          { value: ch.enterprise, color: RAMP[3], label: t('channel.enterprise') },
        ]}
      />
    </WidgetChip>
  )
}

function DebtWidget({ compact: c }: { compact?: boolean }) {
  const debt = useGameStore((s) => s.state.techDebt)
  const high = debt > 50
  return <WidgetChip compact={c} color={WIDGET_COLOR.debtCounter} icon="bug" label={t('hud.techDebt')} alert={high} value={<span className={high ? 'text-negative-ink' : undefined}>{fixed(debt, 0)}</span>} />
}

function CoordinationWidget({ compact: c }: { compact?: boolean }) {
  const coord = useGameStore((s) => s.state.derived.coordination)
  if (coord >= 0.999) return <WidgetChip compact={c} color={WIDGET_COLOR.coordinationWarning} icon="network" label={t('hud.coordination')} value={t('hud.coordinationOk')} sub={t('hud.coordinationOkSub')} />
  return <WidgetChip compact={c} color={WIDGET_COLOR.coordinationWarning} icon="network" label={t('hud.coordination')} alert value={<span className="text-negative-ink">{`−${pct(1 - coord)}`}</span>} sub={t('hud.output')} />
}

function CultureWidget({ compact: c }: { compact?: boolean }) {
  const team = useGameStore((s) => s.state.derived.teamSize)
  return <WidgetChip compact={c} color={WIDGET_COLOR.cultureBadge} icon="flag" label={t('hud.culture')} value={t('hud.cultureValue', { n: team })} />
}

function RevenueDistWidget({ compact: c }: { compact?: boolean }) {
  const { mrr, customers } = useGameStore(useShallow((s) => ({ mrr: s.state.finance.mrr, customers: s.state.finance.enterpriseCustomers })))
  const top = customers.reduce((a, x) => Math.max(a, x.mrr), 0)
  const share = mrr > 0 ? top / mrr : 0
  const concentrated = share > 0.3
  const RAMP = ramp(WIDGET_COLOR.revenueDistribution)
  return (
    <WidgetChip compact={c} color={WIDGET_COLOR.revenueDistribution} icon="bars" label={t('hud.revenueDist')} alert={concentrated} value={pct(share)} sub={t('hud.topCustomerSub')}>
      {!c && (
        <StackBar
          parts={[
            ...customers.map((cu, i) => ({ value: cu.mrr, color: i % 2 ? RAMP[1] : RAMP[0], label: cu.name })),
            { value: Math.max(0, mrr - customers.reduce((a, x) => a + x.mrr, 0)), color: RAMP[3], label: t('hud.selfServe') },
          ]}
        />
      )}
    </WidgetChip>
  )
}

function ArchetypeWidget({ compact: c }: { compact?: boolean }) {
  const a = useGameStore((s) => s.state.archetype)
  if (!a) return <WidgetChip compact={c} color={WIDGET_COLOR.archetypeBadge} icon="compass" label={t('hud.archetype')} value={<span className="text-ink-2">{t('hud.archetypeUnknown')}</span>} />
  return <WidgetChip compact={c} color={WIDGET_COLOR.archetypeBadge} icon="compass" label={t('hud.archetype')} value={t(`archetype.${a}`)} />
}

const Nothing = () => null

export const WIDGETS: Record<HudWidget, WidgetDef> = {
  cash: { id: 'cash', color: WIDGET_COLOR.cash, icon: 'cash', tier: 'primary', Component: CashWidget },
  users: { id: 'users', color: WIDGET_COLOR.users, icon: 'users', tier: 'primary', Component: UsersWidget },
  morale: { id: 'morale', color: WIDGET_COLOR.morale, icon: 'heart', tier: 'primary', Component: MoraleWidget },
  runway: { id: 'runway', color: WIDGET_COLOR.runway, icon: 'hourglass', tier: 'secondary', Component: RunwayWidget },
  burnBreakdown: { id: 'burnBreakdown', color: WIDGET_COLOR.burnBreakdown, icon: 'flame', tier: 'secondary', Component: BurnWidget },
  retention: { id: 'retention', color: WIDGET_COLOR.retention, icon: 'magnet', tier: 'secondary', Component: RetentionWidget },
  profitProjection: { id: 'profitProjection', color: WIDGET_COLOR.profitProjection, icon: 'trend', tier: 'secondary', Component: ProfitWidget },
  capTable: { id: 'capTable', color: WIDGET_COLOR.capTable, icon: 'pie', tier: 'secondary', Component: CapTableWidget },
  roundTimer: { id: 'roundTimer', color: WIDGET_COLOR.roundTimer, icon: 'timer', tier: 'secondary', Component: RoundTimerWidget },
  // Shown in the Team panel instead of the HUD.
  candidateQuality: { id: 'candidateQuality', color: WIDGET_COLOR.candidateQuality, icon: 'star', tier: 'hidden', Component: Nothing },
  moraleHeatmap: { id: 'moraleHeatmap', color: WIDGET_COLOR.moraleHeatmap, icon: 'grid', tier: 'secondary', Component: MoraleMapWidget },
  churn: { id: 'churn', color: WIDGET_COLOR.churn, icon: 'leak', tier: 'secondary', Component: ChurnWidget },
  arpu: { id: 'arpu', color: WIDGET_COLOR.arpu, icon: 'coin', tier: 'secondary', Component: ArpuWidget },
  reputation: { id: 'reputation', color: WIDGET_COLOR.reputation, icon: 'megaphone', tier: 'secondary', Component: ReputationWidget },
  equity: { id: 'equity', color: WIDGET_COLOR.equity, icon: 'key', tier: 'secondary', Component: EquityWidget },
  ltvCac: { id: 'ltvCac', color: WIDGET_COLOR.ltvCac, icon: 'scale', tier: 'secondary', Component: LtvCacWidget },
  channelBreakdown: { id: 'channelBreakdown', color: WIDGET_COLOR.channelBreakdown, icon: 'branch', tier: 'secondary', Component: ChannelsWidget },
  debtCounter: { id: 'debtCounter', color: WIDGET_COLOR.debtCounter, icon: 'bug', tier: 'secondary', Component: DebtWidget },
  coordinationWarning: { id: 'coordinationWarning', color: WIDGET_COLOR.coordinationWarning, icon: 'network', tier: 'secondary', Component: CoordinationWidget },
  cultureBadge: { id: 'cultureBadge', color: WIDGET_COLOR.cultureBadge, icon: 'flag', tier: 'secondary', Component: CultureWidget },
  revenueDistribution: { id: 'revenueDistribution', color: WIDGET_COLOR.revenueDistribution, icon: 'bars', tier: 'secondary', Component: RevenueDistWidget },
  archetypeBadge: { id: 'archetypeBadge', color: WIDGET_COLOR.archetypeBadge, icon: 'compass', tier: 'secondary', Component: ArchetypeWidget },
}
