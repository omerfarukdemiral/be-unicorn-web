// Top bar, section B: the four fixed gauges (Kasa, Runway, Kullanıcı, Moral). Pins: widgets.tsx › PinnedMetric.
// Each value has ONE home here (docs/LAYOUT.md §2): Kasa shows usable money + the daily NET flow only
// (monthly net → Metrikler › Kâr tahmini, burn → Metrikler › Burn, runway → its own chip).
// Red only for real danger (§4.1): runway < 3, usable cash < 0 / missed payroll, morale < 28. Other thresholds amber.
// HUD grammar (docs/GAMEPLAY_V2.md §10.4, §11): a finished founder action pops the gauge it fed once (a find → Kullanıcı) (`pop-once`), and
// the garage's "users" step draws a goal notch under Kullanıcı (guidance.ts).
import { useState, type ComponentType, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { FounderActionKind } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { Icon, type IconName } from '../icons'
import { t } from '../i18n'
import { fixed, money, num, signedMoney } from '../format'
import { cx } from '../primitives'
import { soft, WIDGET_COLOR } from '../theme'
import { useTween } from '../time'
import { GoalNotch, ledgerMoney, runwayTone } from '../widgets'
import { cashFlow } from '../cashflow'
import { useFreshEvents } from '../loopUi'
import { guidedGoal } from '../guidance'
import { Tip } from '../Tip'
import { FLOAT_SHOW_MS, useSourceFloat, type FloatGauge } from '../sourceFloats'
import { CashTip, MoraleTip, NetTip, RunwayTip, UsersTip } from '../hudTips'

/** Counts finished founder actions of `kinds` (a fresh count re-keys the value: one `pop-once`). */
function useActionPop(kinds: readonly FounderActionKind[]): number {
  const [n, setN] = useState(0)
  useFreshEvents((events) => {
    if (events.some((e) => e.kind === 'founderActionDone' && kinds.includes(e.refId as FounderActionKind))) setN((v) => v + 1)
  })
  return n
}

/** The value, popped once per count (0 = never popped: no animation on mount). */
function Pop({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span key={n} className={cx('inline-block origin-left', n > 0 && 'animate-pop-once')}>
      {children}
    </span>
  )
}


/** full = value over label (desktop ≥1280); tight = value only, sub under it (1024–1279); mobile = 44px cells. */
export type MetricDensity = 'full' | 'tight' | 'mobile'

type Mark = 'danger' | 'warn' | null

const DANGER = 'var(--color-negative)'
const WARN = 'var(--color-energy)'

function StatusMark({ mark }: { mark: Mark }) {
  if (mark === 'danger') return <span aria-hidden="true" className="inline-block size-[7px] shrink-0 rounded-full ring-[1.5px] ring-surface" style={{ background: DANGER }} />
  if (mark === 'warn') return <span aria-hidden="true" className="inline-block size-[7px] shrink-0 rounded-full border-2" style={{ borderColor: WARN }} />
  return null
}

/**
 * One gauge cell of the bar: a bare duotone sticker in the gauge's hue + the value (desktop: no word label, T08; the name is the tooltip)
 * (the number is the biggest thing; docs/GAMEPLAY_V2.md §10.1 D1). h40 on desktop, h44 on phones; no frame or tile of
 * its own. The value's span carries the only colour a value may take.
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
  ariaValue,
  className,
  hero = false,
  tip,
  tipId,
  float,
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
  /** Spoken value when `value` is not a plain string (a popped value). */
  ariaValue?: string
  className?: string
  /** Desktop money island: the value is the screen's hero number (32px, docs/LAYOUT.md §1.2); full density only. */
  hero?: boolean
  /** P5 tooltip body (ui/Tip.tsx): replaces the native title. */
  tip?: ComponentType
  /** First-run hint id (ui/firstHints.ts). */
  tipId?: string
  /** P5 source float slot: "Reklam +40" over (desktop) / under (phones) this gauge. */
  float?: FloatGauge
  children?: ReactNode
}) {
  const mobile = density === 'mobile'
  const rootClass = cx('relative flex min-w-0 items-center rounded-control', mobile ? 'h-11 gap-1 px-0.5' : density === 'tight' ? 'h-10 gap-1.5 px-1' : hero ? 'gap-2.5 px-1' : 'h-10 gap-2 px-1', className)
  const aria = ariaValue !== undefined ? `${label}: ${ariaValue}` : typeof value === 'string' ? `${label}: ${value}` : undefined
  const body = (
    <>
      <BarChipBody {...{ icon, color, value, sub, mark, density, hero, children }} />
      {float && <SourceFloatTag gauge={float} below={density !== 'full'} />}
    </>
  )
  if (tip)
    return (
      <Tip block id={tipId} content={tip} ariaLabel={aria} className={rootClass}>
        {body}
      </Tip>
    )
  return (
    <div className={rootClass} title={title ?? label} aria-label={aria}>
      {body}
    </div>
  )
}

/** The one source float on screen, if it is this gauge's turn. Never takes pointer events. */
function SourceFloatTag({ gauge, below }: { gauge: FloatGauge; below: boolean }) {
  const f = useSourceFloat(gauge)
  if (!f) return null
  return (
    <span
      key={f.id}
      aria-live="polite"
      data-source-float={gauge}
      className={cx(
        'tabular animate-rise-float pointer-events-none absolute left-1 z-10 whitespace-nowrap rounded-full bg-surface px-2 text-[12px] font-bold leading-5 shadow-card',
        below ? 'top-[calc(100%+2px)]' : 'bottom-[calc(100%+2px)]',
        f.good ? 'text-positive-ink' : 'text-negative-ink',
      )}
      style={{ animationDuration: `${FLOAT_SHOW_MS}ms` }}
    >
      {f.text}
    </span>
  )
}

function BarChipBody({
  icon,
  color,
  value,
  sub,
  mark,
  density,
  hero,
  children,
}: {
  icon: IconName
  color: string
  value: ReactNode
  sub?: ReactNode
  mark: Mark
  density: MetricDensity
  hero: boolean
  children?: ReactNode
}) {
  const mobile = density === 'mobile'
  return (
    <>
      <Icon name={icon} tone={color} size={hero ? 30 : mobile ? 18 : density === 'tight' ? 20 : 22} className={cx('shrink-0', hero && 'self-start mt-1')} />
      {/* Every cell has the same fixed rows (value alone on desktop, value / sub on compact bars), so the four
          values share one baseline whether or not a cell has a sub line or Moral's bar. */}
      <div className="relative min-w-0 flex-1">
        {density === 'full' ? (
          <>
            {/* The sub (Kasa's daily net) is a small coloured delta after the value: a number, not a phrase.
                17px below 1440 keeps "$10.2M net −$270/gün" + "+N" inside a 1280 bar (Bricolage tabular digits are ~0.62em at 700). */}
            <div
              className={cx(
                'ui-num flex items-baseline gap-1.5 whitespace-nowrap text-ink',
                hero ? 'h-9 text-[32px] leading-9 tracking-[-0.01em]' : 'h-[22px] text-[17px] leading-[22px] min-[1440px]:text-[18px]',
              )}
            >
              {value}
              {sub && <span className={cx('text-[12px]', hero && 'flex self-center')}>{sub}</span>}
              {/* No word label (T08): the icon says which gauge, the name is the tooltip and the aria-label. */}
              <StatusMark mark={mark} />
            </div>
            {/* Extras (Moral's bar, the goal notch) hang under the value and take no width: inline they cost a 1280
                bar ~46px, which pushed the pinned gauge out (Bricolage tabular digits are ~0.62em at 700, the row has no slack left). */}
            {children && <div className="absolute inset-x-0 top-full mt-0.5">{children}</div>}
          </>
        ) : (
          <>
            <div className={cx('ui-num flex min-w-0 items-center gap-1 whitespace-nowrap text-ink', mobile ? 'h-[18px] text-[15px] leading-[18px]' : 'h-5 text-[16px] leading-5')}>
              <span className="min-w-0 truncate">{value}</span>
              <StatusMark mark={mark} />
            </div>
            <div className={cx('tabular min-w-0 truncate font-bold text-ink-2', mobile ? 'h-3 text-[10.5px] leading-3' : 'h-3.5 text-[11px] leading-[14px]')}>
              {sub ?? children}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Kasa
// ---------------------------------------------------------------------------

/** Founder actions whose return lands on a gauge: a find is users. A sales call's contract is MRR, which has no
 *  gauge up here (its floating number says "/ay"), so nothing pops for it. */
const USERS_ACTIONS: readonly FounderActionKind[] = ['findUsers']

/**
 * Kasa: usable money (cash − what payday already owes, tweened) + "net −$270/gün" on the sub line. No floating
 * deltas: the daily net already has its one home in the sub line, and payday's lump is the strip's month receipt.
 * Red only when the usable money is below zero or payroll was missed.
 */
export function CashChip({ density, hero = false }: { density: MetricDensity; hero?: boolean }) {
  const f = useGameStore(useShallow((s) => cashFlow(s.state)))
  const { debt, missed, negDays } = useGameStore(
    useShallow((s) => ({
      debt: s.state.finance.debt,
      missed: !!s.state.finance.payrollMissed,
      negDays: s.state.finance.negativeCashDays,
    })),
  )
  const shown = useTween(f.usable)
  const danger = f.usable < 0 || missed
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
      hero={hero}
      icon="cash"
      color={WIDGET_COLOR.cash}
      label={t('hud.cash')}
      mark={danger ? 'danger' : null}
      title={title}
      tip={CashTip}
      tipId="cash"
      float="cash"
      value={<span className={danger ? 'text-negative-ink' : undefined}>{ledgerMoney(shown)}</span>}
      // Burning is normal, so a negative net never turns red (red is for real danger only, LAYOUT §4.1): the money
      // island (hero) wears it as a soft pill in the burn hue with its flame, green when profitable (T09); phones keep
      // the plain sub line.
      // P5: the sign is the colour (+ green, − red), spelled "/gün" where there is room.
      sub={hero ? <BurnPill netDay={f.netDay} text={t('top.netPerDayPill', { v: net })} /> : <span className={f.netDay > 0.5 ? 'text-positive-ink' : f.netDay < -0.5 ? 'text-negative-ink' : 'text-ink-2'}>{t('top.netDelta', { v: net })}</span>}
    />
  )
}

/** The daily net next to the hero Kasa: a soft pill, flame + burn hue while burning, trend + green in profit. */
function BurnPill({ netDay, text }: { netDay: number; text: string }) {
  const color = netDay > 0 ? 'var(--color-positive-ink)' : 'var(--color-negative-ink)'
  return (
    <Tip id="net" content={NetTip} className="self-center">
      <span
        data-burn-pill=""
        className="inline-flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 text-[14px] font-bold leading-5"
        style={{ color, background: soft(color, 12) }}
      >
        <Icon name={netDay > 0 ? 'trend' : 'flame'} size={15} className="shrink-0" />
        {text}
      </span>
    </Tip>
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
      tip={RunwayTip}
      tipId="runway"
      className={danger ? 'animate-danger-pulse' : undefined}
      value={<span className={danger ? 'text-negative-ink' : warn ? 'text-energy-ink' : undefined}>{value}</span>}
    />
  )
}

export function UsersChip({ density }: { density: MetricDensity }) {
  const { users, overload } = useGameStore(useShallow((s) => ({ users: s.state.stats.users, overload: s.state.derived.overload })))
  const goal = useGameStore((s) => guidedGoal(s.state, 'users'))
  const pop = useActionPop(USERS_ACTIONS)
  const over = overload > 0
  return (
    <BarChip
      density={density}
      icon="users"
      color={WIDGET_COLOR.users}
      label={t('hud.users')}
      mark={over ? 'warn' : null}
      title={over ? `${t('top.usersTitle', { v: num(users) })}\n${t('top.usersOverload')}` : t('top.usersTitle', { v: num(users) })}
      tip={UsersTip}
      tipId="users"
      float="users"
      value={<Pop n={pop}>{num(users)}</Pop>}
      ariaValue={num(users)}
    >
      {goal !== null && (
        <GoalNotch goal={goal} color={WIDGET_COLOR.users} className={density === 'full' ? 'w-10' : cx(density === 'mobile' ? 'w-full min-w-6 max-w-14' : 'w-14', 'mt-[5px]')} />
      )}
    </BarChip>
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
      tip={MoraleTip}
      tipId="morale"
      value={<span className={danger ? 'text-negative-ink' : undefined}>{v}</span>}
    >
      <div
        className={cx('h-1 overflow-hidden rounded-full', density === 'full' ? 'w-10' : density === 'mobile' ? 'w-full min-w-6 max-w-14' : 'w-14', density !== 'full' && 'mt-[5px]')}
        style={{ background: soft(WIDGET_COLOR.morale, 20) }}
        aria-hidden="true"
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, morale))}%`, background: danger ? DANGER : WIDGET_COLOR.morale }} />
      </div>
    </BarChip>
  )
}
