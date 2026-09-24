// Top bar, section B: the four fixed gauges (Kasa, Runway, Kullanıcı, Moral). Pins: widgets.tsx › PinnedMetric.
// Each value has ONE home here (docs/LAYOUT.md §2): Kasa shows usable money + the daily NET flow only
// (monthly net → Metrikler › Kâr tahmini, burn → Metrikler › Yakıt, runway → its own chip).
// Red only for real danger (§4.1): runway < 3, usable cash < 0 / missed payroll, morale < 28. Other thresholds amber.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { effectiveSpeed, useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed, money, num, signedMoney } from '../format'
import { cx } from '../primitives'
import { iconTone, soft, WIDGET_COLOR } from '../theme'
import { useTween } from '../time'
import { useFreshEvents } from '../loopUi'
import { ledgerMoney, runwayTone } from '../widgets'
import { cashFlow } from '../cashflow'

/** full = label + value (desktop ≥1280); tight = value only, sub under it (1024–1279); mobile = 44px cells. */
export type MetricDensity = 'full' | 'tight' | 'mobile'

type Mark = 'danger' | 'warn' | null

const DANGER = 'var(--color-negative)'
const WARN = 'var(--color-energy)'

function StatusMark({ mark }: { mark: Mark }) {
  if (mark === 'danger') return <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: DANGER }} />
  if (mark === 'warn') return <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full border-[1.5px]" style={{ borderColor: WARN }} />
  return null
}

/**
 * One gauge cell of the bar: 24px hue tile + (label) + value. h40 on desktop, h44 on phones; no frame of its own
 * (cells are divided by 1px rules in the bar). `valueClass` carries the only colour a value may take.
 */
export function BarChip({
  icon,
  color,
  label,
  value,
  sub,
  mark = null,
  density,
  title,
  className,
  children,
}: {
  icon: IconName
  color: string
  label: string
  value: ReactNode
  sub?: ReactNode
  mark?: Mark
  density: MetricDensity
  title?: string
  className?: string
  children?: ReactNode
}) {
  const mobile = density === 'mobile'
  return (
    <div
      className={cx('relative flex min-w-0 items-center gap-2 rounded-control', mobile ? 'h-11 gap-1.5 px-1.5' : 'h-10 px-2', className)}
      title={title ?? label}
      aria-label={typeof value === 'string' ? `${label}: ${value}` : undefined}
    >
      <span
        aria-hidden="true"
        className={cx('grid shrink-0 place-items-center rounded-[7px]', mobile ? 'size-5' : 'size-6')}
        style={{ color: iconTone(color), background: soft(color) }}
      >
        <Icon name={icon} size={mobile ? 12 : 14} />
      </span>
      <div className="min-w-0 flex-1">
        {density === 'full' ? (
          <>
            {/* The sub (Kasa's daily net) rides on the label line, so the value line stays one short number. */}
            <div className="flex min-w-0 items-center gap-1 whitespace-nowrap">
              <span className="ui-label text-[10px] leading-3">{label}</span>
              <StatusMark mark={mark} />
              {sub && <span className="tabular text-[10.5px] font-medium leading-3 text-ink-2">· {sub}</span>}
            </div>
            <div className="tabular whitespace-nowrap text-[15px] font-semibold leading-5 text-ink">{value}</div>
          </>
        ) : (
          <>
            <div className={cx('tabular flex min-w-0 items-center gap-1 whitespace-nowrap font-semibold text-ink', mobile ? 'text-sm leading-4' : 'text-[15px] leading-5')}>
              <span className="min-w-0 truncate">{value}</span>
              <StatusMark mark={mark} />
            </div>
            {sub && <div className={cx('tabular truncate font-medium text-ink-2', mobile ? 'text-[10px] leading-3' : 'text-[11px] leading-3')}>{sub}</div>}
          </>
        )}
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kasa
// ---------------------------------------------------------------------------

type Drop = { id: number; text: string; up: boolean; big?: boolean }

/**
 * Kasa: usable money (cash − what payday already owes, tweened) + "net −$270/gün". The day's net floats off the
 * value (ink-2 when negative, green when positive); payday's lump drops big and bold in ink (rhythm, not danger).
 * Red only when the usable money is below zero or payroll was missed.
 */
export function CashChip({ density }: { density: MetricDensity }) {
  const f = useGameStore(useShallow((s) => cashFlow(s.state)))
  const { debt, missed, negDays, day, flowing } = useGameStore(
    useShallow((s) => ({
      debt: s.state.finance.debt,
      missed: !!s.state.finance.payrollMissed,
      negDays: s.state.finance.negativeCashDays,
      day: Math.floor(s.state.time.day),
      flowing: effectiveSpeed(s) > 0,
    })),
  )
  const shown = useTween(f.usable)
  const danger = f.usable < 0 || missed
  const mobile = density === 'mobile'

  const [drops, setDrops] = useState<Drop[]>([])
  const pushDrop = (d: Drop, ms: number) => {
    setDrops((cur) => [...cur.slice(-2), d])
    // No cleanup: at 4× the next day lands before this one has faded (a late setState after unmount is a no-op).
    window.setTimeout(() => setDrops((cur) => cur.filter((x) => x.id !== d.id)), ms)
  }
  const lastDay = useRef(day)
  useEffect(() => {
    if (day === lastDay.current) return
    const fresh = day > lastDay.current && flowing
    lastDay.current = day
    if (!fresh || Math.abs(f.netDay) < 0.5) return
    pushDrop({ id: day, text: f.netDay >= 0 ? signedMoney(f.netDay) : `−${money(-f.netDay)}`, up: f.netDay >= 0 }, 1200)
  }, [day]) // eslint-disable-line react-hooks/exhaustive-deps
  useFreshEvents((events) => {
    for (const e of events) {
      if (e.kind !== 'payday' || !(e.value !== undefined && e.value > 0.5)) continue
      pushDrop({ id: -e.id, text: `−${money(e.value)}`, up: false, big: true }, 1800)
    }
  })

  const net = f.netDay >= 0 ? signedMoney(f.netDay) : `−${money(-f.netDay)}`
  const title = [
    f.owed > 0.5 ? t('top.cashTitle', { v: ledgerMoney(f.usable), bank: ledgerMoney(f.bank), owed: money(f.owed) }) : t('top.cashTitleNoOwed', { v: ledgerMoney(f.usable) }),
    debt > 0 ? t('top.debt', { v: money(debt) }) : '',
    missed ? t('top.bankrupt', { v: Math.max(0, 60 - negDays) }) : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <BarChip
      density={density}
      icon="cash"
      color={WIDGET_COLOR.cash}
      label={t('hud.cash')}
      mark={danger ? 'danger' : null}
      title={title}
      value={
        <span className={cx('relative inline-block', danger && 'text-negative-ink')}>
          {ledgerMoney(shown)}
          {drops.map((d) => (
            <span
              key={d.id}
              aria-hidden="true"
              className={cx(
                'pointer-events-none absolute left-full top-0 ml-1 whitespace-nowrap',
                d.big ? cx('animate-payday-drop font-bold text-ink', mobile ? 'text-[11px]' : 'text-[13px]') : cx('animate-cash-rise font-semibold', mobile ? 'text-[10px]' : 'text-[11px]'),
                !d.big && (d.up ? 'text-positive-ink' : 'text-ink-2'),
              )}
            >
              {d.text}
            </span>
          ))}
        </span>
      }
      sub={<span className={f.netDay > 0 ? 'text-positive-ink' : undefined}>{t(mobile ? 'top.netPerDayShort' : 'top.netPerDay', { v: net })}</span>}
    />
  )
}

// ---------------------------------------------------------------------------
// Runway, Kullanıcı, Moral
// ---------------------------------------------------------------------------

/** Runway: its slot stays empty until the concept is learned (Hisset → Adlandır → Kullan). */
export function RunwayChip({ density }: { density: MetricDensity }) {
  const { unlocked, runway } = useGameStore(useShallow((s) => ({ unlocked: s.state.unlockedWidgets.includes('runway'), runway: s.state.finance.runway })))
  if (!unlocked) return null
  const tone = runwayTone(runway)
  const danger = tone === 'red'
  const warn = tone === 'orange'
  const value = runway === null ? t('top.runwayInfinite') : t('top.runway', { v: fixed(runway, 1) })
  const title = runway === null ? t('top.runwayProfitable') : danger ? `${t('top.runwayTitle', { v: value })}\n${t('top.runwayDanger')}` : t('top.runwayTitle', { v: value })
  return (
    <BarChip
      density={density}
      icon="hourglass"
      color={WIDGET_COLOR.runway}
      label={t('hud.runway')}
      mark={danger ? 'danger' : warn ? 'warn' : null}
      title={title}
      className={danger ? 'animate-danger-pulse' : undefined}
      value={<span className={danger ? 'text-negative-ink' : warn ? 'text-energy-ink' : undefined}>{value}</span>}
    />
  )
}

export function UsersChip({ density }: { density: MetricDensity }) {
  const { users, overload } = useGameStore(useShallow((s) => ({ users: s.state.stats.users, overload: s.state.derived.overload })))
  const over = overload > 0
  return (
    <BarChip
      density={density}
      icon="users"
      color={WIDGET_COLOR.users}
      label={t('hud.users')}
      mark={over ? 'warn' : null}
      title={over ? `${t('top.usersTitle', { v: num(users) })}\n${t('top.usersOverload')}` : t('top.usersTitle', { v: num(users) })}
      value={num(users)}
    />
  )
}

export function MoraleChip({ density }: { density: MetricDensity }) {
  const morale = useGameStore((s) => s.state.stats.morale)
  const danger = morale < 28
  const tired = !danger && morale < 50
  const v = Math.round(morale)
  const title = [t('top.moraleTitle', { v }), danger ? t('top.moraleDanger') : tired ? t('top.moraleTired') : ''].filter(Boolean).join('\n')
  return (
    <BarChip
      density={density}
      icon="heart"
      color={WIDGET_COLOR.morale}
      label={t('hud.morale')}
      mark={danger ? 'danger' : tired ? 'warn' : null}
      title={title}
      value={<span className={danger ? 'text-negative-ink' : undefined}>{v}</span>}
    >
      <div className={cx('h-0.5 overflow-hidden rounded-full', density === 'mobile' ? 'w-full max-w-14' : 'w-14', density === 'full' ? 'mt-0.5' : 'mt-px')} style={{ background: soft(WIDGET_COLOR.morale, 18) }} aria-hidden="true">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, morale))}%`, background: danger ? DANGER : WIDGET_COLOR.morale }} />
      </div>
    </BarChip>
  )
}
