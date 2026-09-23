// HUD widget registry (PLAN §2 "Kullan"): each unlocked HudWidget maps to a small chip.
// Widgets only display engine numbers; no formulas beyond presentation (shares, 1 − churn).
import type { ComponentType, ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { HudWidget } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import { Icon, type IconName } from './icons'
import { t } from './i18n'
import { compact, fixed, money, num, pct, signedMoney } from './format'
import { cx } from './primitives'

export type WidgetTier = 'primary' | 'secondary' | 'hidden'

export interface WidgetDef {
  id: HudWidget
  icon: IconName
  tier: WidgetTier
  /** Renders the chip, or null when nothing to show right now. */
  Component: ComponentType<{ compact?: boolean }>
}

// ---------------------------------------------------------------------------
// Chip shell
// ---------------------------------------------------------------------------

export function WidgetChip({
  icon,
  label,
  value,
  sub,
  tone,
  children,
  title,
  compact: isCompact,
}: {
  icon: IconName
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: string
  children?: ReactNode
  title?: string
  compact?: boolean
}) {
  return (
    <div
      className={cx('flex min-w-0 items-center rounded-2xl bg-cream-50/70', isCompact ? 'gap-1 px-1.5 py-1' : 'gap-2 px-2.5 py-1.5')}
      title={title ?? label}
    >
      <span className={cx('grid shrink-0 place-items-center rounded-full', isCompact ? 'size-5' : 'size-7', tone ?? 'bg-cream-200 text-ink-700')}>
        <Icon name={icon} size={isCompact ? 12 : 15} />
      </span>
      <div className="min-w-0 flex-1">
        {!isCompact && <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-ink-600">{label}</div>}
        {isCompact ? (
          // Phones: value on its own line, sub (e.g. monthly net) below it.
          <>
            <div className="tabular truncate text-sm font-bold leading-tight text-ink-900">{value}</div>
            {sub && <div className="tabular truncate text-[10px] font-semibold leading-tight">{sub}</div>}
          </>
        ) : (
          <div className="tabular flex min-w-0 items-baseline gap-1.5 text-sm font-bold leading-tight text-ink-900">
            <span className="min-w-0 truncate">{value}</span>
            {sub && <span className="min-w-0 truncate text-[11px] font-semibold">{sub}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

function StackBar({ parts }: { parts: { value: number; color: string; label: string }[] }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0)
  return (
    <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-cream-200">
      {total > 0 &&
        parts.map((p) => (
          <div key={p.label} title={`${p.label}: ${compact(p.value)}`} style={{ width: `${(Math.max(0, p.value) / total) * 100}%`, background: p.color }} />
        ))}
    </div>
  )
}

function Spark({ values, line }: { values: number[]; line?: number }) {
  const w = 72
  const h = 18
  const pts = values.slice(-12)
  const max = Math.max(1, line ?? 0, ...pts)
  const path = pts.map((v, i) => `${pts.length === 1 ? 0 : (i / (pts.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="mt-0.5 overflow-visible" aria-hidden="true">
      {line !== undefined && <line x1={0} x2={w} y1={h - (line / max) * h} y2={h - (line / max) * h} stroke="var(--color-rose-300)" strokeDasharray="3 2" />}
      {pts.length > 0 && <polyline points={path} fill="none" stroke="var(--color-mint-600)" strokeWidth={1.8} strokeLinejoin="round" />}
    </svg>
  )
}

function Pie({ fraction }: { fraction: number }) {
  const r = 7
  const c = 2 * Math.PI * r
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" className="-rotate-90" aria-hidden="true">
      <circle cx={9} cy={9} r={r} fill="var(--color-cream-200)" />
      <circle cx={9} cy={9} r={r / 2} fill="none" stroke="var(--color-lilac-500)" strokeWidth={r} strokeDasharray={`${(fraction * c) / 2} ${c}`} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

function CashWidget({ compact: c }: { compact?: boolean }) {
  const { cash, net, debt } = useGameStore(useShallow((s) => ({ cash: s.state.stats.cash, net: s.state.finance.net, debt: s.state.finance.debt })))
  return (
    <WidgetChip
      compact={c}
      icon="cash"
      label={t('hud.cash')}
      tone={cash < 0 ? 'bg-rose-100 text-rose-600' : 'bg-mint-100 text-mint-600'}
      value={<span className={cash < 0 ? 'text-rose-600' : undefined}>{money(cash)}</span>}
      sub={<span className={net >= 0 ? 'text-mint-600' : 'text-rose-600'}>{t('hud.perMonth', { v: signedMoney(net) })}</span>}
      title={debt > 0 ? t('hud.debtTitle', { v: money(debt) }) : t('hud.cashTitle')}
    />
  )
}

function UsersWidget({ compact: c }: { compact?: boolean }) {
  const users = useGameStore((s) => s.state.stats.users)
  const overload = useGameStore((s) => s.state.derived.overload)
  return (
    <WidgetChip
      compact={c}
      icon="users"
      label={t('hud.users')}
      tone="bg-sky-100 text-sky-600"
      value={num(users)}
      sub={overload > 0 ? <span className="text-rose-600">{t('hud.overload')}</span> : undefined}
    />
  )
}

function MoraleWidget({ compact: c }: { compact?: boolean }) {
  const morale = useGameStore((s) => s.state.stats.morale)
  const tone = morale < 28 ? 'bg-rose-100 text-rose-600' : morale < 50 ? 'bg-lemon-100 text-lemon-600' : 'bg-rose-100 text-rose-300'
  return (
    <WidgetChip compact={c} icon="heart" label={t('hud.morale')} tone={tone} value={Math.round(morale)}>
      {!c && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-cream-200">
          <div className={cx('h-full rounded-full', morale < 28 ? 'bg-rose-300' : morale < 50 ? 'bg-lemon-300' : 'bg-mint-300')} style={{ width: `${Math.max(0, Math.min(100, morale))}%` }} />
        </div>
      )}
    </WidgetChip>
  )
}

function RunwayWidget({ compact: c }: { compact?: boolean }) {
  const runway = useGameStore((s) => s.state.finance.runway)
  const danger = runway !== null && runway < 6
  return (
    <WidgetChip
      compact={c}
      icon="hourglass"
      label={t('hud.runway')}
      tone={danger ? 'bg-rose-100 text-rose-600' : 'bg-lemon-100 text-lemon-600'}
      value={runway === null ? '∞' : t('unit.months', { v: fixed(runway, 1) })}
      sub={runway === null ? <span className="text-mint-600">{t('hud.profitable')}</span> : undefined}
    />
  )
}

function BurnWidget({ compact: c }: { compact?: boolean }) {
  const b = useGameStore(useShallow((s) => ({ burn: s.state.finance.burn, ...s.state.finance.burnBreakdown })))
  return (
    <WidgetChip compact={c} icon="flame" label={t('hud.burn')} tone="bg-peach-100 text-peach-600" value={t('hud.perMonthPlain', { v: money(b.burn) })}>
      <StackBar
        parts={[
          { value: b.salaries, color: '#9cc9f5', label: t('burn.salaries') },
          { value: b.rent, color: '#c9a7f5', label: t('burn.rent') },
          { value: b.infra, color: '#9fe0c3', label: t('burn.infra') },
          { value: b.ads, color: '#ffc1a1', label: t('burn.ads') },
        ]}
      />
    </WidgetChip>
  )
}

function RetentionWidget({ compact: c }: { compact?: boolean }) {
  const churn = useGameStore((s) => s.state.stats.churn)
  return <WidgetChip compact={c} icon="magnet" label={t('hud.retention')} tone="bg-mint-100 text-mint-600" value={pct(1 - churn, 1)} sub={t('hud.monthly')} />
}

function ProfitWidget({ compact: c }: { compact?: boolean }) {
  const { hist, burn, net } = useGameStore(useShallow((s) => ({ hist: s.state.finance.mrrHistory, burn: s.state.finance.burn, net: s.state.finance.net })))
  return (
    <WidgetChip
      compact={c}
      icon="trend"
      label={t('hud.profitProjection')}
      tone="bg-mint-100 text-mint-600"
      value={net >= 0 ? <span className="text-mint-600">{t('hud.profitable')}</span> : t('hud.gap', { v: money(-net) })}
    >
      {!c && <Spark values={hist} line={burn} />}
    </WidgetChip>
  )
}

function CapTableWidget({ compact: c }: { compact?: boolean }) {
  const equity = useGameStore((s) => s.state.stats.equity)
  return (
    <WidgetChip compact={c} icon="pie" label={t('hud.capTable')} tone="bg-lilac-100 text-lilac-500" value={<span className="inline-flex items-center gap-1.5"><Pie fraction={equity} />{pct(equity)}</span>} sub={t('hud.yours')} />
  )
}

function RoundTimerWidget({ compact: c }: { compact?: boolean }) {
  const round = useGameStore(useShallow((s) => (s.state.round?.active ? { left: s.state.round.weeksLeft, total: s.state.round.weeksTotal } : null)))
  if (!round) return <WidgetChip compact={c} icon="timer" label={t('hud.roundTimer')} tone="bg-cream-200 text-ink-700" value={t('hud.noRound')} />
  return (
    <WidgetChip compact={c} icon="timer" label={t('hud.roundTimer')} tone="bg-lilac-100 text-lilac-500" value={t('unit.weeksLeft', { v: fixed(Math.max(0, round.left), 0) })}>
      {!c && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-cream-200">
          <div className="h-full rounded-full bg-lilac-300" style={{ width: `${round.total > 0 ? (1 - round.left / round.total) * 100 : 0}%` }} />
        </div>
      )}
    </WidgetChip>
  )
}

function ChurnWidget({ compact: c }: { compact?: boolean }) {
  const churn = useGameStore((s) => s.state.stats.churn)
  return <WidgetChip compact={c} icon="leak" label={t('hud.churn')} tone={churn > 0.08 ? 'bg-rose-100 text-rose-600' : 'bg-cream-200 text-ink-700'} value={pct(churn, 1)} sub={t('hud.monthly')} />
}

function ArpuWidget({ compact: c }: { compact?: boolean }) {
  const arpu = useGameStore((s) => s.state.stats.arpu)
  return <WidgetChip compact={c} icon="coin" label={t('hud.arpu')} tone="bg-lemon-100 text-lemon-600" value={`$${fixed(arpu, 2)}`} sub={t('hud.perUser')} />
}

function ReputationWidget({ compact: c }: { compact?: boolean }) {
  const rep = useGameStore((s) => s.state.stats.reputation)
  return <WidgetChip compact={c} icon="megaphone" label={t('hud.reputation')} tone="bg-sky-100 text-sky-600" value={Math.round(rep)} sub="/100" />
}

/** Founder control (cap-table-health): exact stake and whether the founder still holds a majority. */
function EquityWidget({ compact: c }: { compact?: boolean }) {
  const equity = useGameStore((s) => s.state.stats.equity)
  const majority = equity >= 0.5
  return (
    <WidgetChip
      compact={c}
      icon="key"
      label={t('widget.equity')}
      tone={majority ? 'bg-lilac-100 text-lilac-500' : 'bg-peach-100 text-peach-600'}
      value={pct(equity, 1)}
      sub={<span className={majority ? 'text-lilac-500' : 'text-peach-600'}>{majority ? t('hud.control') : t('hud.controlShared')}</span>}
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
    <WidgetChip compact={c} icon="grid" label={t('hud.moraleMap')} tone={bands.low > 0 ? 'bg-rose-100 text-rose-600' : 'bg-mint-100 text-mint-600'} value={t('hud.moraleMapValue', bands)}>
      {!c && (
        <StackBar
          parts={[
            { value: bands.low, color: '#f4a3a8', label: t('status.burnout') },
            { value: bands.mid, color: '#f7dc8b', label: t('status.tired') },
            { value: bands.high, color: '#9fe0c3', label: t('status.working') },
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
      icon="scale"
      label={t('hud.ltvCac')}
      tone={r === null ? 'bg-cream-200 text-ink-700' : bad ? 'bg-rose-100 text-rose-600' : 'bg-mint-100 text-mint-600'}
      value={r === null ? '—' : `${fixed(r, 1)}×`}
      sub={r !== null ? <span className={bad ? 'text-rose-600' : 'text-mint-600'}>{bad ? t('hud.ltvLow') : t('hud.ltvOk')}</span> : undefined}
    />
  )
}

function ChannelsWidget({ compact: c }: { compact?: boolean }) {
  const ch = useGameStore(useShallow((s) => s.state.derived.channels))
  const total = ch.organic + ch.paid + ch.manual + ch.enterprise
  return (
    <WidgetChip compact={c} icon="branch" label={t('hud.channels')} tone="bg-sky-100 text-sky-600" value={t('hud.perMonthPlain', { v: `+${num(total)}` })}>
      <StackBar
        parts={[
          { value: ch.organic, color: '#9fe0c3', label: t('channel.organic') },
          { value: ch.paid, color: '#ffc1a1', label: t('channel.paid') },
          { value: ch.manual, color: '#c9a7f5', label: t('channel.manual') },
          { value: ch.enterprise, color: '#9cc9f5', label: t('channel.enterprise') },
        ]}
      />
    </WidgetChip>
  )
}

function DebtWidget({ compact: c }: { compact?: boolean }) {
  const debt = useGameStore((s) => s.state.techDebt)
  return <WidgetChip compact={c} icon="bug" label={t('hud.techDebt')} tone={debt > 50 ? 'bg-rose-100 text-rose-600' : 'bg-peach-100 text-peach-600'} value={fixed(debt, 0)} />
}

function CoordinationWidget({ compact: c }: { compact?: boolean }) {
  const coord = useGameStore((s) => s.state.derived.coordination)
  if (coord >= 0.999) return <WidgetChip compact={c} icon="network" label={t('hud.coordination')} tone="bg-mint-100 text-mint-600" value={t('hud.coordinationOk')} sub={t('hud.coordinationOkSub')} />
  return <WidgetChip compact={c} icon="network" label={t('hud.coordination')} tone="bg-rose-100 text-rose-600" value={`−${pct(1 - coord)}`} sub={t('hud.output')} />
}

function CultureWidget({ compact: c }: { compact?: boolean }) {
  const team = useGameStore((s) => s.state.derived.teamSize)
  return <WidgetChip compact={c} icon="flag" label={t('hud.culture')} tone="bg-lilac-100 text-lilac-500" value={t('hud.cultureValue', { n: team })} />
}

function RevenueDistWidget({ compact: c }: { compact?: boolean }) {
  const { mrr, customers } = useGameStore(useShallow((s) => ({ mrr: s.state.finance.mrr, customers: s.state.finance.enterpriseCustomers })))
  const top = customers.reduce((a, x) => Math.max(a, x.mrr), 0)
  const share = mrr > 0 ? top / mrr : 0
  return (
    <WidgetChip
      compact={c}
      icon="bars"
      label={t('hud.revenueDist')}
      tone={share > 0.3 ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-600'}
      value={t('hud.topCustomer', { v: pct(share) })}
    >
      {!c && (
        <StackBar
          parts={[
            ...customers.map((cu, i) => ({ value: cu.mrr, color: i % 2 ? '#9cc9f5' : '#7fb6ee', label: cu.name })),
            { value: Math.max(0, mrr - customers.reduce((a, x) => a + x.mrr, 0)), color: '#9fe0c3', label: t('hud.selfServe') },
          ]}
        />
      )}
    </WidgetChip>
  )
}

function ArchetypeWidget({ compact: c }: { compact?: boolean }) {
  const a = useGameStore((s) => s.state.archetype)
  if (!a) return <WidgetChip compact={c} icon="compass" label={t('hud.archetype')} tone="bg-cream-200 text-ink-700" value={t('hud.archetypeUnknown')} />
  return <WidgetChip compact={c} icon="compass" label={t('hud.archetype')} tone="bg-lemon-100 text-lemon-600" value={t(`archetype.${a}`)} />
}

const Nothing = () => null

export const WIDGETS: Record<HudWidget, WidgetDef> = {
  cash: { id: 'cash', icon: 'cash', tier: 'primary', Component: CashWidget },
  users: { id: 'users', icon: 'users', tier: 'primary', Component: UsersWidget },
  morale: { id: 'morale', icon: 'heart', tier: 'primary', Component: MoraleWidget },
  runway: { id: 'runway', icon: 'hourglass', tier: 'secondary', Component: RunwayWidget },
  burnBreakdown: { id: 'burnBreakdown', icon: 'flame', tier: 'secondary', Component: BurnWidget },
  retention: { id: 'retention', icon: 'magnet', tier: 'secondary', Component: RetentionWidget },
  profitProjection: { id: 'profitProjection', icon: 'trend', tier: 'secondary', Component: ProfitWidget },
  capTable: { id: 'capTable', icon: 'pie', tier: 'secondary', Component: CapTableWidget },
  roundTimer: { id: 'roundTimer', icon: 'timer', tier: 'secondary', Component: RoundTimerWidget },
  // Shown in the Team panel instead of the HUD.
  candidateQuality: { id: 'candidateQuality', icon: 'star', tier: 'hidden', Component: Nothing },
  moraleHeatmap: { id: 'moraleHeatmap', icon: 'grid', tier: 'secondary', Component: MoraleMapWidget },
  churn: { id: 'churn', icon: 'leak', tier: 'secondary', Component: ChurnWidget },
  arpu: { id: 'arpu', icon: 'coin', tier: 'secondary', Component: ArpuWidget },
  reputation: { id: 'reputation', icon: 'megaphone', tier: 'secondary', Component: ReputationWidget },
  equity: { id: 'equity', icon: 'key', tier: 'secondary', Component: EquityWidget },
  ltvCac: { id: 'ltvCac', icon: 'scale', tier: 'secondary', Component: LtvCacWidget },
  channelBreakdown: { id: 'channelBreakdown', icon: 'branch', tier: 'secondary', Component: ChannelsWidget },
  debtCounter: { id: 'debtCounter', icon: 'bug', tier: 'secondary', Component: DebtWidget },
  coordinationWarning: { id: 'coordinationWarning', icon: 'network', tier: 'secondary', Component: CoordinationWidget },
  cultureBadge: { id: 'cultureBadge', icon: 'flag', tier: 'secondary', Component: CultureWidget },
  revenueDistribution: { id: 'revenueDistribution', icon: 'bars', tier: 'secondary', Component: RevenueDistWidget },
  archetypeBadge: { id: 'archetypeBadge', icon: 'compass', tier: 'secondary', Component: ArchetypeWidget },
}
