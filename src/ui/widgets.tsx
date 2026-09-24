// Gauge registry (PLAN §2 "Kullan", docs/LAYOUT.md §5): each unlocked HudWidget maps to one card. The same component
// draws the Metrikler card (`variant="panel"`) and the top-bar pin (`variant="bar"`, h40, no bars). The four fixed
// gauges (Kasa, Runway, Kullanıcı, Moral) are drawn by the top bar itself (layout/TopMetrics.tsx). Widgets only display engine numbers; money goes through cashFlow() (one definition, §2.3):
// Yakıt = the month's total cost, Kâr tahmini = Gelir − Yakıt, Kasa shows the daily net.
// Look (docs/DESIGN.md): neutral chip on a warm card; each gauge owns a hue (WIDGET_COLOR) used on its icon (on a
// ~12% tile) and on its thin bar / sparkline / stacked ramp. Values stay ink (AA). Red only for real danger
// (LAYOUT §4.1: usable cash < 0, runway < 3, morale < 28); other thresholds are amber (energy / energy-ink).
import type { ComponentType, ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { HudWidget } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { canonicalMetric, effectivePins, MERGED_INTO, PINNABLE } from '../store/metricPins'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { compact, fixed, money, num, pct, signedMoney } from './format'
import { cx, Dot } from './primitives'
import { iconTone, soft, WIDGET_COLOR } from './theme'
import { cashFlow } from './cashflow'

/** 'panel' = Metrikler card (default), 'bar' = top-bar pin (h40, value only). */
export type WidgetVariant = 'panel' | 'bar'
/** Metrikler group; 'top' = the fixed top-bar gauges (Kasa, Runway, Kullanıcı, Moral), never listed in Metrikler. */
export type MetricGroup = 'money' | 'growth' | 'team' | 'path'

export interface WidgetProps {
  variant?: WidgetVariant
}

export interface WidgetDef {
  id: HudWidget
  icon: IconName
  /** Gauge hue (CSS colour): icon, icon tile and bar. */
  color: string
  /** i18n key (hud.*) of the gauge name: strip announcement, pinned chip, Metrikler card. */
  labelKey: string
  group: MetricGroup | 'top' | 'hidden'
  /** May be pinned to the top bar (mirrors src/store/metricPins.ts PINNABLE, checked by widgets.test.ts). */
  pinnable: boolean
  /** Folded into another card (churn → retention, equity → capTable). */
  mergedInto?: HudWidget
  /** Renders the card, or null when nothing to show right now. */
  Component: ComponentType<WidgetProps>
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
  variant,
  className,
}: {
  icon: IconName
  /** Gauge hue (WIDGET_COLOR[id]). */
  color?: string
  label: string
  value: ReactNode
  sub?: ReactNode
  /** Danger (LAYOUT §4.1 only): a tiny red mark next to the label. */
  alert?: boolean
  /** Threshold warning (LTV:CAC < 3, churn > %8, tired morale…): a tiny amber mark. */
  warn?: boolean
  children?: ReactNode
  title?: string
  variant?: WidgetVariant
  className?: string
}) {
  if (variant === 'bar') {
    // Top-bar pin: icon tile + label over value, one line each, 40px tall. No sub, no bars (the card has them).
    return (
      <div className={cx('flex h-10 min-w-0 items-center gap-2 rounded-control px-2', className)} title={title ?? label}>
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-[7px]" style={{ color: iconTone(color), background: soft(color) }}>
          <Icon name={icon} size={14} />
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <span className="ui-label truncate text-[10px] leading-3">{label}</span>
            <StatusMark alert={alert} warn={warn} size={5} />
          </div>
          <div className="tabular mt-0.5 truncate text-sm font-semibold leading-4 text-ink">{value}</div>
        </div>
      </div>
    )
  }
  return (
    <div className={cx('flex min-w-0 items-start gap-2 rounded-control px-2 py-1.5', className)} title={title ?? label}>
      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-[7px]" style={{ color: iconTone(color), background: soft(color) }}>
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        {/* Label never truncates (a cut label loses its meaning): tighter tracking, wraps to 2 lines if needed. */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="ui-label line-clamp-2 leading-[14px] tracking-[0.04em]">{label}</span>
          <StatusMark alert={alert} warn={warn} size={6} />
        </div>
        {/* Values stay short (number + unit); the sub wraps under them when the column is narrow.
            Nothing is ellipsised: touch screens have no tooltip to recover a cut value. */}
        <div className="tabular mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold leading-tight text-ink">
          <span className="max-w-full break-words">{value}</span>
          {sub && <span className="max-w-full break-words text-[11px] font-medium text-ink-2">{sub}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusMark({ alert, warn, size }: { alert?: boolean; warn?: boolean; size: number }) {
  if (alert) return <Dot color="var(--color-negative)" size={size} />
  if (warn) return <Dot color="var(--color-energy)" size={size} />
  return null
}

/** Stacked share bar ramp: one gauge hue in five strengths (100 / 75 / 55 / 38 / 22% over the surface). */
function ramp(color: string): [string, string, string, string, string] {
  const at = (p: number) => `color-mix(in oklab, ${color} ${p}%, var(--color-surface))`
  return [color, at(75), at(55), at(38), at(22)]
}

type Part = { value: number; color: string; label: string }

function StackBar({ parts }: { parts: Part[] }) {
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

/** Panel cards: the stacked bar's parts spelled out (touch screens have no tooltip). */
function Legend({ parts, format }: { parts: Part[]; format: (n: number) => string }) {
  const shown = parts.filter((p) => p.value > 0.5)
  if (shown.length === 0) return null
  return (
    <div className="tabular mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] font-medium text-ink-2">
      {shown.map((p) => (
        <span key={p.label} className="inline-flex items-center gap-1">
          <Dot color={p.color} size={6} />
          {p.label} {format(p.value)}
        </span>
      ))}
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

/** Is this gauge unlocked in the current run (merged cards read their sources separately). */
function useUnlocked(id: HudWidget): boolean {
  return useGameStore((s) => s.state.unlockedWidgets.includes(id))
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

/**
 * Kasa value: whole dollars under $100K ("$14,950", every day's cost moves it: docs/CORE_LOOP.md §4.1), the compact
 * convention above (K/M/B, '.' decimal) with one more decimal than money().
 */
export function ledgerMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  const body =
    a < 1e5
      ? Math.round(a).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : a < 1e6
        ? `${(a / 1e3).toFixed(1)}K`
        : a < 1e9
          ? `${(a / 1e6).toFixed(a < 1e8 ? 2 : 1)}M`
          : `${(a / 1e9).toFixed(2)}B`
  return `${sign}$${body}`
}

/** Months of runway under which Runway turns red (the one danger band, LAYOUT §4.1). */
const RUNWAY_CRITICAL = 3

export type RunwayTone = 'calm' | 'amber' | 'orange' | 'red'

/** Runway colour bands (docs/CORE_LOOP.md §7): > 12 months neutral, 6–12 amber, 3–6 orange, < 3 red (pulses). */
export function runwayTone(runway: number | null): RunwayTone {
  if (runway === null || runway > 12) return 'calm'
  if (runway >= 6) return 'amber'
  if (runway >= RUNWAY_CRITICAL) return 'orange'
  return 'red'
}

/** Yakıt: the month's total cost, founder living cost included. Revenue is NOT subtracted (that is Kâr tahmini). */
function BurnWidget({ variant }: WidgetProps) {
  const b = useGameStore(useShallow((s) => ({ burn: cashFlow(s.state).burn, ...s.state.finance.burnBreakdown })))
  const RAMP = ramp(WIDGET_COLOR.burnBreakdown)
  const parts: Part[] = [
    { value: b.salaries, color: RAMP[0], label: t('burn.salaries') },
    { value: b.rent, color: RAMP[1], label: t('burn.rent') },
    { value: b.founder ?? 0, color: RAMP[2], label: t('burn.founder') },
    { value: b.infra, color: RAMP[3], label: t('burn.infra') },
    { value: b.ads, color: RAMP[4], label: t('burn.ads') },
  ]
  const panel = (variant ?? 'panel') === 'panel'
  return (
    <WidgetChip variant={variant} color={WIDGET_COLOR.burnBreakdown} icon="flame" label={t('hud.burn')} title={t('hud.burnTitle')} value={t('hud.perMonthPlain', { v: money(b.burn) })} sub={panel ? t('hud.burnSub') : undefined}>
      <StackBar parts={parts} />
      {panel && <Legend parts={parts} format={money} />}
    </WidgetChip>
  )
}

/** Tutunma (+ churn once its concept is learned): the same number seen from both sides, one card. */
function RetentionWidget({ variant }: WidgetProps) {
  const churn = useGameStore((s) => s.state.stats.churn)
  const churnKnown = useUnlocked('churn')
  const high = churnKnown && churn > 0.08
  return (
    <WidgetChip
      variant={variant}
      color={WIDGET_COLOR.retention}
      icon="magnet"
      label={t('hud.retention')}
      warn={high}
      value={pct(1 - churn, 1)}
      sub={churnKnown ? <span className={high ? 'text-energy-ink' : undefined}>{t('hud.churnInline', { v: pct(churn, 1) })}</span> : t('hud.monthly')}
    />
  )
}

/** Kâr tahmini: Gelir − Yakıt = net per month (the only place the monthly net is shown). */
function ProfitWidget({ variant }: WidgetProps) {
  const { hist, mrr, burn, net } = useGameStore(
    useShallow((s) => {
      const f = cashFlow(s.state)
      return { hist: s.state.finance.mrrHistory, mrr: f.mrr, burn: f.burn, net: f.netMonth }
    }),
  )
  const panel = (variant ?? 'panel') === 'panel'
  return (
    <WidgetChip
      variant={variant}
      color={WIDGET_COLOR.profitProjection}
      icon="trend"
      label={t('hud.profitProjection')}
      title={t('hud.profitTitle')}
      value={<span className={net >= 0 ? 'text-positive-ink' : undefined}>{t('hud.netPerMonth', { v: signedMoney(net) })}</span>}
      sub={panel ? t('hud.profitFormula', { mrr: money(mrr), burn: money(burn) }) : net >= 0 ? t('hud.profitable') : undefined}
    >
      {panel && <Spark values={hist} line={burn} color={WIDGET_COLOR.profitProjection} />}
    </WidgetChip>
  )
}

/** Cap table (+ founder control once `equity` is learned): one card for the founder's stake. */
function CapTableWidget({ variant }: WidgetProps) {
  const equity = useGameStore((s) => s.state.stats.equity)
  const controlKnown = useUnlocked('equity')
  const majority = equity >= 0.5
  return (
    <WidgetChip
      variant={variant}
      color={WIDGET_COLOR.capTable}
      icon="pie"
      label={t('hud.capTable')}
      warn={controlKnown && !majority}
      value={
        <span className="inline-flex items-center gap-1.5">
          <Pie fraction={equity} color={WIDGET_COLOR.capTable} />
          {pct(equity, controlKnown ? 1 : 0)}
        </span>
      }
      sub={controlKnown ? <span className={majority ? undefined : 'text-energy-ink'}>{majority ? t('hud.control') : t('hud.controlShared')}</span> : t('hud.yours')}
    />
  )
}

/** Tur: its home is the top bar + Büyüme › Tur. The Metrikler card only links there (no number twice). */
function RoundTimerWidget({ variant }: WidgetProps) {
  const round = useGameStore(useShallow((s) => (s.state.round?.active ? { left: s.state.round.weeksLeft, total: s.state.round.weeksTotal } : null)))
  const openPanel = useGameStore((s) => s.openPanel)
  if ((variant ?? 'panel') === 'panel') {
    return (
      <WidgetChip
        color={WIDGET_COLOR.roundTimer}
        icon="timer"
        label={t('hud.roundTimer')}
        value={
          <button type="button" onClick={() => openPanel({ kind: 'growth', section: 'round' })} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand-ink hover:underline">
            {t('metrics.round.link')}
            <Icon name="chevronRight" size={14} />
          </button>
        }
      />
    )
  }
  if (!round) return <WidgetChip variant={variant} color={WIDGET_COLOR.roundTimer} icon="timer" label={t('hud.roundTimer')} value={<span className="text-ink-2">{t('hud.noRound')}</span>} />
  return <WidgetChip variant={variant} color={WIDGET_COLOR.roundTimer} icon="timer" label={t('hud.roundTimer')} value={t('unit.weeksLeft', { v: fixed(Math.max(0, round.left), 0) })} />
}

/** Legacy HUD only: Metrikler shows churn on the Tutunma card. */
function ChurnWidget({ variant }: WidgetProps) {
  const churn = useGameStore((s) => s.state.stats.churn)
  const high = churn > 0.08
  return <WidgetChip variant={variant} color={WIDGET_COLOR.churn} icon="leak" label={t('hud.churn')} warn={high} value={<span className={high ? 'text-energy-ink' : undefined}>{pct(churn, 1)}</span>} sub={t('hud.monthly')} />
}

function ArpuWidget({ variant }: WidgetProps) {
  const arpu = useGameStore((s) => s.state.stats.arpu)
  return <WidgetChip variant={variant} color={WIDGET_COLOR.arpu} icon="coin" label={t('hud.arpu')} value={`$${fixed(arpu, 2)}`} sub={t('hud.perUser')} />
}

function ReputationWidget({ variant }: WidgetProps) {
  const rep = useGameStore((s) => s.state.stats.reputation)
  return <WidgetChip variant={variant} color={WIDGET_COLOR.reputation} icon="megaphone" label={t('hud.reputation')} value={Math.round(rep)} sub="/100" />
}

/** Legacy HUD only: Metrikler shows founder control on the Cap table card. */
function EquityWidget({ variant }: WidgetProps) {
  const equity = useGameStore((s) => s.state.stats.equity)
  const majority = equity >= 0.5
  return <WidgetChip variant={variant} color={WIDGET_COLOR.equity} icon="key" label={t('hud.founderStake')} warn={!majority} value={pct(equity, 1)} sub={majority ? t('hud.control') : t('hud.controlShared')} />
}

/** Ekip morali (morale-compounds): how many people sit in each morale band; the office floor tints to match. */
function MoraleMapWidget({ variant }: WidgetProps) {
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
    <WidgetChip variant={variant} color={WIDGET_COLOR.moraleHeatmap} icon="grid" label={t('hud.moraleMap')} alert={bands.low > 0} value={`${bands.low}/${bands.mid}/${bands.high}`} sub={t('hud.moraleMapSub')} title={t('hud.moraleMapValue', bands)}>
      {variant !== 'bar' && (
        <StackBar
          parts={[
            // Burnout (< 28) is the danger band and reads red; tired = faded morale hue; fine = full morale hue.
            { value: bands.low, color: 'var(--color-negative)', label: t('status.burnout') },
            { value: bands.mid, color: ramp(WIDGET_COLOR.moraleHeatmap)[2], label: t('status.tired') },
            { value: bands.high, color: WIDGET_COLOR.moraleHeatmap, label: t('status.working') },
          ]}
        />
      )}
    </WidgetChip>
  )
}

function LtvCacWidget({ variant }: WidgetProps) {
  const r = useGameStore((s) => s.state.derived.ltvCac)
  const bad = r !== null && r < 3
  return (
    <WidgetChip
      variant={variant}
      color={WIDGET_COLOR.ltvCac}
      icon="scale"
      label={t('hud.ltvCac')}
      warn={bad}
      value={r === null ? <span className="text-ink-2">—</span> : <span className={bad ? 'text-energy-ink' : 'text-positive-ink'}>{`${fixed(r, 1)}×`}</span>}
      sub={r !== null ? (bad ? t('hud.ltvLow') : t('hud.ltvOk')) : undefined}
    />
  )
}

function ChannelsWidget({ variant }: WidgetProps) {
  const ch = useGameStore(useShallow((s) => s.state.derived.channels))
  const total = ch.organic + ch.paid + ch.manual + ch.enterprise
  const RAMP = ramp(WIDGET_COLOR.channelBreakdown)
  const parts: Part[] = [
    { value: ch.organic, color: RAMP[0], label: t('channel.organic') },
    { value: ch.paid, color: RAMP[1], label: t('channel.paid') },
    { value: ch.manual, color: RAMP[2], label: t('channel.manual') },
    { value: ch.enterprise, color: RAMP[3], label: t('channel.enterprise') },
  ]
  const panel = (variant ?? 'panel') === 'panel'
  return (
    <WidgetChip variant={variant} color={WIDGET_COLOR.channelBreakdown} icon="branch" label={t('hud.channels')} value={t('hud.perMonthPlain', { v: `+${num(total)}` })}>
      <StackBar parts={parts} />
      {panel && <Legend parts={parts} format={(n) => `+${num(n)}`} />}
    </WidgetChip>
  )
}

function DebtWidget({ variant }: WidgetProps) {
  const debt = useGameStore((s) => s.state.techDebt)
  const high = debt > 50
  return <WidgetChip variant={variant} color={WIDGET_COLOR.debtCounter} icon="bug" label={t('hud.techDebt')} warn={high} value={<span className={high ? 'text-energy-ink' : undefined}>{fixed(debt, 0)}</span>} sub="/100" />
}

function CoordinationWidget({ variant }: WidgetProps) {
  const coord = useGameStore((s) => s.state.derived.coordination)
  if (coord >= 0.999) return <WidgetChip variant={variant} color={WIDGET_COLOR.coordinationWarning} icon="network" label={t('hud.coordination')} value={t('hud.coordinationOk')} sub={t('hud.coordinationOkSub')} />
  return <WidgetChip variant={variant} color={WIDGET_COLOR.coordinationWarning} icon="network" label={t('hud.coordination')} warn value={<span className="text-energy-ink">{`−${pct(1 - coord)}`}</span>} sub={t('hud.output')} />
}

function CultureWidget({ variant }: WidgetProps) {
  const team = useGameStore((s) => s.state.derived.teamSize)
  return <WidgetChip variant={variant} color={WIDGET_COLOR.cultureBadge} icon="flag" label={t('hud.culture')} value={t('hud.cultureValue', { n: team })} />
}

function RevenueDistWidget({ variant }: WidgetProps) {
  const { mrr, customers } = useGameStore(useShallow((s) => ({ mrr: s.state.finance.mrr, customers: s.state.finance.enterpriseCustomers })))
  const top = customers.reduce((a, x) => Math.max(a, x.mrr), 0)
  const share = mrr > 0 ? top / mrr : 0
  const concentrated = share > 0.3
  const RAMP = ramp(WIDGET_COLOR.revenueDistribution)
  return (
    <WidgetChip variant={variant} color={WIDGET_COLOR.revenueDistribution} icon="bars" label={t('hud.revenueDist')} warn={concentrated} value={<span className={concentrated ? 'text-energy-ink' : undefined}>{pct(share)}</span>} sub={t('hud.topCustomerSub')}>
      {variant !== 'bar' && (
        <StackBar
          parts={[
            ...customers.map((cu, i) => ({ value: cu.mrr, color: i % 2 ? RAMP[1] : RAMP[0], label: cu.name })),
            { value: Math.max(0, mrr - customers.reduce((a, x) => a + x.mrr, 0)), color: RAMP[4], label: t('hud.selfServe') },
          ]}
        />
      )}
    </WidgetChip>
  )
}

function ArchetypeWidget({ variant }: WidgetProps) {
  const a = useGameStore((s) => s.state.archetype)
  if (!a) return <WidgetChip variant={variant} color={WIDGET_COLOR.archetypeBadge} icon="compass" label={t('hud.archetype')} value={<span className="text-ink-2">{t('hud.archetypeUnknown')}</span>} />
  return <WidgetChip variant={variant} color={WIDGET_COLOR.archetypeBadge} icon="compass" label={t('hud.archetype')} value={t(`archetype.${a}`)} />
}

const Nothing = () => null

type Def = Omit<WidgetDef, 'id' | 'color' | 'pinnable' | 'mergedInto'>

/** Registry rows; pinnable / mergedInto come from the store's rules (src/store/metricPins.ts), colour from theme. */
const DEFS: Record<HudWidget, Def> = {
  cash: { icon: 'cash', labelKey: 'hud.cash', group: 'top', Component: Nothing },
  users: { icon: 'users', labelKey: 'hud.users', group: 'top', Component: Nothing },
  morale: { icon: 'heart', labelKey: 'hud.morale', group: 'top', Component: Nothing },
  runway: { icon: 'hourglass', labelKey: 'hud.runway', group: 'top', Component: Nothing },
  burnBreakdown: { icon: 'flame', labelKey: 'hud.burn', group: 'money', Component: BurnWidget },
  profitProjection: { icon: 'trend', labelKey: 'hud.profitProjection', group: 'money', Component: ProfitWidget },
  capTable: { icon: 'pie', labelKey: 'hud.capTable', group: 'money', Component: CapTableWidget },
  equity: { icon: 'key', labelKey: 'hud.founderStake', group: 'money', Component: EquityWidget },
  revenueDistribution: { icon: 'bars', labelKey: 'hud.revenueDist', group: 'money', Component: RevenueDistWidget },
  retention: { icon: 'magnet', labelKey: 'hud.retention', group: 'growth', Component: RetentionWidget },
  churn: { icon: 'leak', labelKey: 'hud.churn', group: 'growth', Component: ChurnWidget },
  arpu: { icon: 'coin', labelKey: 'hud.arpu', group: 'growth', Component: ArpuWidget },
  ltvCac: { icon: 'scale', labelKey: 'hud.ltvCac', group: 'growth', Component: LtvCacWidget },
  channelBreakdown: { icon: 'branch', labelKey: 'hud.channels', group: 'growth', Component: ChannelsWidget },
  reputation: { icon: 'megaphone', labelKey: 'hud.reputation', group: 'growth', Component: ReputationWidget },
  moraleHeatmap: { icon: 'grid', labelKey: 'hud.moraleMap', group: 'team', Component: MoraleMapWidget },
  coordinationWarning: { icon: 'network', labelKey: 'hud.coordination', group: 'team', Component: CoordinationWidget },
  cultureBadge: { icon: 'flag', labelKey: 'hud.culture', group: 'team', Component: CultureWidget },
  debtCounter: { icon: 'bug', labelKey: 'hud.techDebt', group: 'team', Component: DebtWidget },
  roundTimer: { icon: 'timer', labelKey: 'hud.roundTimer', group: 'path', Component: RoundTimerWidget },
  archetypeBadge: { icon: 'compass', labelKey: 'hud.archetype', group: 'path', Component: ArchetypeWidget },
  // Shown in the Team panel instead.
  candidateQuality: { icon: 'star', labelKey: 'widget.candidateQuality', group: 'hidden', Component: Nothing },
}

export const WIDGETS: Record<HudWidget, WidgetDef> = Object.fromEntries(
  (Object.keys(DEFS) as HudWidget[]).map((id) => [id, { ...DEFS[id], id, color: WIDGET_COLOR[id], pinnable: PINNABLE.has(id), mergedInto: MERGED_INTO[id] }]),
) as Record<HudWidget, WidgetDef>

/** Metrikler order: groups, then the order of DEFS inside a group. */
export const METRIC_GROUPS: readonly MetricGroup[] = ['money', 'growth', 'team', 'path']

/** Cards listed in Metrikler (merged gauges and top-bar gauges excluded), in display order. */
export const METRIC_CARDS: readonly HudWidget[] = METRIC_GROUPS.flatMap((g) => (Object.keys(DEFS) as HudWidget[]).filter((id) => DEFS[id].group === g && !MERGED_INTO[id]))

// ---------------------------------------------------------------------------
// Top-bar pins
// ---------------------------------------------------------------------------

/**
 * Which of the pinned gauges the top bar can draw at this width: the NEWEST `visible` ones (the player's latest
 * choice wins the room). Metrikler draws the value of every other pin itself (docs/LAYOUT.md §5.1, no duplicates).
 */
export function visiblePins(pins: readonly HudWidget[], visible: number): HudWidget[] {
  return visible <= 0 ? [] : pins.slice(-visible)
}

/** Pins of this run whose card is unlocked, oldest first (store.ui.pinnedMetrics ∩ unlocked). */
export function usePinnedMetrics(): HudWidget[] {
  return useGameStore(useShallow((s) => effectivePins(s.ui.pinnedMetrics, s.state.unlockedWidgets)))
}

/**
 * One pinned gauge in the top bar: the registry card in its `bar` variant (h40), a button that opens the card in
 * Metrikler. Draws nothing for an unknown, unpinnable or locked gauge.
 */
export function PinnedMetric({ id, className }: { id: HudWidget; className?: string }) {
  const card = canonicalMetric(id)
  const def = WIDGETS[card]
  const unlocked = useGameStore((s) => [card, ...(Object.keys(MERGED_INTO) as HudWidget[]).filter((x) => MERGED_INTO[x] === card)].some((x) => s.state.unlockedWidgets.includes(x)))
  const openPanel = useGameStore((s) => s.openPanel)
  if (!def?.pinnable || !unlocked) return null
  const W = def.Component
  const label = t(def.labelKey)
  return (
    <button
      type="button"
      data-pinned-metric={card}
      onClick={() => openPanel({ kind: 'metrics', focus: card }, { root: true })}
      aria-label={t('metrics.openTitle', { label })}
      className={cx('block min-w-0 max-w-[152px] rounded-control text-left transition-colors hover:bg-surface-2', className)}
    >
      <W variant="bar" />
    </button>
  )
}
