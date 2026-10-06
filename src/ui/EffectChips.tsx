// An effect bundle as icon + signed number chips (playtest 2026-10-06: the player weighs a choice by its numbers,
// before choosing, not by a sentence after it). Green = good for the player, red = bad, the gauge's own icon in front.
// Temporary modifiers read "icon ±% · 30g"; a delayed part sits behind an hourglass with its day count. What the
// engine keeps hidden (flags, queued cards) never shows; an option with nothing visible gets a single "?".
import type { EffectBundle, ModifierKind } from '../engine/types'
import { useShallow } from 'zustand/react/shallow'
import { loanAmount } from '../engine'
import { useGameStore } from '../store/gameStore'
import { Icon, type IconName } from './icons'
import { fixed, money, num, pct } from './format'
import { t } from './i18n'
import { cx } from './primitives'

export interface Chip {
  icon: IconName
  text: string
  /** true = good for the player, false = bad, null = neutral. */
  good: boolean | null
  title: string
}

const sign = (v: number, f: (x: number) => string): string => (v > 0 ? `+${f(v)}` : `−${f(-v)}`)

const MOD_ICON: Record<ModifierKind, IconName> = {
  churn: 'leak',
  arpu: 'coin',
  production: 'rocket',
  morale: 'heart',
  cac: 'magnet',
  organic: 'trend',
  roundSpeed: 'timer',
  multipleCap: 'scale',
  diligenceMom: 'search',
  capacity: 'users',
  rent: 'building',
}

/** Modifier kinds where a bigger multiplier hurts. */
const MOD_BAD_UP: ReadonlySet<ModifierKind> = new Set(['churn', 'cac', 'rent'])

/** The visible chips of a bundle; `burn` turns cashBurnMonths / a loan into money. */
export function effectChips(fx: EffectBundle, ctx: { burn: number; loan?: number }): Chip[] {
  const out: Chip[] = []
  const add = (icon: IconName, v: number | undefined, f: (x: number) => string, label: string, badUp = false) => {
    if (!v) return
    out.push({ icon, text: sign(v, f), good: badUp ? v < 0 : v > 0, title: label })
  }
  const cash = (fx.cash ?? 0) + (fx.cashBurnMonths ? Math.round(Math.max(0, ctx.burn) * fx.cashBurnMonths) : 0)
  add('cash', cash, money, t('hud.cash'))
  if (fx.cashPercent) add('cash', fx.cashPercent, (x) => pct(x), t('hud.cash'))
  if (fx.loan && ctx.loan) out.push({ icon: 'coin', text: `+${money(ctx.loan)}`, good: null, title: t('loan.title') })
  add('users', fx.users, num, t('hud.users'))
  if (fx.usersPercent) add('users', fx.usersPercent, (x) => pct(x), t('hud.users'))
  add('heart', fx.morale, (x) => fixed(x, 0), t('hud.morale'))
  add('megaphone', fx.reputation, (x) => fixed(x, 0), t('hud.reputation'))
  add('rocket', fx.maturity, (x) => pct(x), t('growth.avgMaturity'))
  add('bolt', fx.energy, (x) => fixed(x, 0), t('fx.energyLabel'))
  add('key', fx.equity, (x) => pct(x, 1), t('hud.founderStake'))
  add('bug', fx.techDebt, (x) => fixed(x, 0), t('hud.techDebt'), true)
  // Fewer weeks on the round is the good direction.
  if (fx.roundWeeks) out.push({ icon: 'timer', text: sign(fx.roundWeeks, (x) => t('fx.weeksShort', { v: num(x) })), good: fx.roundWeeks < 0, title: t('fx.roundLabel') })
  for (const m of fx.modifiers ?? []) {
    const delta = m.kind === 'morale' ? m.value : m.value - 1
    if (!delta) continue
    const text = m.kind === 'morale' ? sign(delta, (x) => fixed(x, 0)) : sign(delta, (x) => pct(x))
    out.push({ icon: MOD_ICON[m.kind], text: `${text} · ${t('fx.daysShort', { v: m.days })}`, good: MOD_BAD_UP.has(m.kind) ? delta < 0 : delta > 0, title: t(`fx.mod.${m.kind}`) })
  }
  return out
}

export function ChipRow({ chips, className, faded }: { chips: readonly Chip[]; className?: string; faded?: boolean }) {
  return (
    <span className={cx('flex flex-wrap items-center gap-1', faded && 'opacity-70', className)}>
      {chips.map((c, i) => (
        <span
          key={i}
          title={c.title}
          className={cx(
            'tabular inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold leading-none',
            c.good === true ? 'bg-positive/10 text-positive-ink' : c.good === false ? 'bg-negative/10 text-negative-ink' : 'bg-surface-2 text-ink',
          )}
        >
          <Icon name={c.icon} size={12} />
          {c.text}
        </span>
      ))}
    </span>
  )
}

/** What an option does, as chips: now, then (⌛ N g) the delayed part; "?" when nothing is visible. */
export function OptionEffects({ fx, delayed, className }: { fx: EffectBundle; delayed?: { days: number; effects: EffectBundle }; className?: string }) {
  const ctx = useGameStore(useShallow((s) => ({ burn: s.state.finance.burn, loan: fx.loan ? loanAmount(s.state, fx.loan) : undefined })))
  const now = effectChips(fx, ctx)
  const later = delayed ? effectChips(delayed.effects, ctx) : []
  return (
    <span className={cx('flex flex-col gap-1', className)}>
      {now.length > 0 && <ChipRow chips={now} />}
      {delayed && (
        <span className="flex flex-wrap items-center gap-1">
          <span title={t('fx.delayedTitle', { v: delayed.days })} className="tabular inline-flex items-center gap-0.5 text-[11px] font-semibold text-ink-2">
            <Icon name="hourglass" size={12} />
            {t('fx.daysShort', { v: delayed.days })}
          </span>
          {later.length > 0 ? <ChipRow chips={later} faded /> : <span className="text-[12px] font-semibold text-ink-3">?</span>}
        </span>
      )}
      {now.length === 0 && !delayed && <span className="text-[12px] font-semibold text-ink-3">?</span>}
    </span>
  )
}
