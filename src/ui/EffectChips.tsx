// An effect bundle as icon + signed number chips (playtest 2026-10-06: the player weighs a choice by its numbers,
// before choosing, not by a sentence after it). Green = good for the player, red = bad, the gauge's own icon in front.
// Each chip reads "icon Label ±N" (one word for the target, then the number); a temporary modifier adds a small
// tail ("Kira −%10 90g"). A delayed part sits behind an hourglass with its day count. What the
// engine keeps hidden (flags, queued cards) never shows; an option with nothing visible gets a single "?".
import type { EffectBundle, GameState, ModifierKind } from '../engine/types'
import { previewSpend } from '../engine/loopSelectors'
import { useShallow } from 'zustand/react/shallow'
import { loanAmount } from '../engine'
import { ACQUIRED_FLAG } from '../engine/balance'
import { useGameStore } from '../store/gameStore'
import { Icon, type IconName } from './icons'
import { fixed, money, num, pct } from './format'
import { t } from './i18n'
import { cx } from './primitives'

export interface Chip {
  icon: IconName
  /** One word naming what the number moves (Kasa, Moral, Kira…). */
  label: string
  text: string
  /** Small trailing note, e.g. a modifier's duration. */
  tail?: string
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
  const add = (icon: IconName, v: number | undefined, f: (x: number) => string, title: string, tag: string, badUp = false) => {
    if (!v) return
    out.push({ icon, label: t(tag), text: sign(v, f), good: badUp ? v < 0 : v > 0, title })
  }
  const cash = (fx.cash ?? 0) + (fx.cashBurnMonths ? Math.round(Math.max(0, ctx.burn) * fx.cashBurnMonths) : 0)
  add('cash', cash, money, t('hud.cash'), 'fx.tag.cash')
  if (fx.cashPercent) add('cash', fx.cashPercent, (x) => pct(x), t('hud.cash'), 'fx.tag.cash')
  if (fx.loan && ctx.loan) out.push({ icon: 'coin', label: t('fx.tag.loan'), text: `+${money(ctx.loan)}`, good: null, title: t('loan.title') })
  add('users', fx.users, num, t('hud.users'), 'fx.tag.users')
  if (fx.usersPercent) add('users', fx.usersPercent, (x) => pct(x), t('hud.users'), 'fx.tag.users')
  add('heart', fx.morale, (x) => fixed(x, 0), t('hud.morale'), 'fx.tag.morale')
  add('megaphone', fx.reputation, (x) => fixed(x, 0), t('hud.reputation'), 'fx.tag.reputation')
  add('rocket', fx.maturity, (x) => pct(x), t('growth.avgMaturity'), 'fx.tag.maturity')
  add('bolt', fx.energy, (x) => fixed(x, 0), t('fx.energyLabel'), 'fx.tag.energy')
  add('key', fx.equity, (x) => pct(x, 1), t('hud.founderStake'), 'fx.tag.equity')
  add('bug', fx.techDebt, (x) => fixed(x, 0), t('hud.techDebt'), 'fx.tag.techDebt', true)
  // Fewer weeks on the round is the good direction.
  if (fx.roundWeeks) out.push({ icon: 'timer', label: t('fx.tag.roundWeeks'), text: sign(fx.roundWeeks, (x) => t('fx.weeksShort', { v: num(x) })), good: fx.roundWeeks < 0, title: t('fx.roundLabel') })
  for (const m of fx.modifiers ?? []) {
    const delta = m.kind === 'morale' ? m.value : m.value - 1
    if (!delta) continue
    const text = m.kind === 'morale' ? sign(delta, (x) => fixed(x, 0)) : sign(delta, (x) => pct(x))
    out.push({ icon: MOD_ICON[m.kind], label: t(`fx.tag.mod.${m.kind}`), text, tail: t('fx.daysShort', { v: m.days }), good: MOD_BAD_UP.has(m.kind) ? delta < 0 : delta > 0, title: t(`fx.mod.${m.kind}`) })
  }
  return out
}

export function ChipRow({ chips, className, faded }: { chips: readonly Chip[]; className?: string; faded?: boolean }) {
  return (
    <span className={cx('flex flex-wrap items-center gap-1', faded && 'opacity-70', className)}>
      {chips.map((c, i) => (
        <span
          key={i}
          data-chip=""
          title={c.title}
          className={cx(
            'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-[3px]',
            c.good === true ? 'bg-positive/10 text-positive-ink' : c.good === false ? 'bg-negative/10 text-negative-ink' : 'bg-surface-2 text-ink',
          )}
        >
          <Icon name={c.icon} size={12} />
          {c.label && <span className="text-[11px] font-medium leading-none opacity-80">{c.label}</span>}
          <span className="tabular text-[13px] font-bold leading-none">{c.text}</span>
          {c.tail && <span className="text-[10px] font-medium leading-none opacity-70">{c.tail}</span>}
        </span>
      ))}
    </span>
  )
}

/** What an option does, as chips: now, then (⌛ N g) the delayed part; "?" when nothing is visible. */
/** Round 9: the cash an option leaves (its own cash effects on today's cash; a loan and an angel add). */
export function optionCashAfter(s: GameState, fx: EffectBundle): { cash: number; delta: number } {
  const cash = s.stats.cash
  let delta = fx.cash ?? 0
  if (fx.cashPercent) delta += Math.max(0, cash) * fx.cashPercent
  if (fx.cashBurnMonths) delta += s.finance.burn * fx.cashBurnMonths
  if (fx.loan) delta += loanAmount(s, fx.loan)
  return { cash: cash + delta, delta }
}

/**
 * Round 9 (a "Kabul et" emptied the cash with nothing said): the red line an option carries when it leaves the cash
 * under zero ("Kasa −$328 olur"), or spends so the next payroll bounces ("Maaşa yetmez"). The payroll check is the
 * engine's previewSpend.
 */
export function optionCashWarning(s: GameState, fx: EffectBundle): Chip | null {
  const { cash, delta } = optionCashAfter(s, fx)
  if (cash < 0) {
    const text = t('fx.cashBelow', { v: `−${money(-cash)}` })
    return { icon: 'warning', label: '', text, good: false, title: text }
  }
  if (delta < 0 && previewSpend(s, { cashDelta: delta }).paydayShort) {
    const text = t('team.runwayShort')
    return { icon: 'warning', label: '', text, good: false, title: text }
  }
  return null
}

export function OptionEffects({
  fx,
  delayed,
  className,
  quiet,
}: {
  fx: EffectBundle
  delayed?: { days: number; effects: EffectBundle }
  className?: string
  /** No "?" for an option with nothing visible (the reflection after a choice: a lone "?" reads as a glitch). */
  quiet?: boolean
}) {
  const ctx = useGameStore(useShallow((s) => ({ burn: s.state.finance.burn, loan: fx.loan ? loanAmount(s.state, fx.loan) : undefined })))
  // Round 9: the option that empties the cash says so, in red, before the tap (not on the reflection after it).
  const warn = useGameStore((s) => (quiet ? null : optionCashWarning(s.state, fx)?.text ?? null))
  const now = effectChips(fx, ctx)
  const later = delayed ? effectChips(delayed.effects, ctx) : []
  return (
    <span className={cx('flex flex-col gap-1', className)}>
      {now.length > 0 && <ChipRow chips={now} />}
      {warn && <ChipRow chips={[{ icon: 'warning', label: '', text: warn, good: false, title: warn }]} />}
      {delayed && (
        <span className="flex flex-wrap items-center gap-1">
          <span title={t('fx.delayedTitle', { v: delayed.days })} className="tabular inline-flex shrink-0 flex-nowrap items-center gap-0.5 whitespace-nowrap text-[11px] font-semibold text-ink-2">
            <Icon name="hourglass" size={12} />
            {t('fx.daysShort', { v: delayed.days })}
          </span>
          {later.length > 0 ? <ChipRow chips={later} faded /> : <span className="text-[12px] font-semibold text-ink-3">?</span>}
        </span>
      )}
      {/* Selling the company changes no number: it ends the run, and says so instead of a bare "?" (QA). */}
      {now.length === 0 && [fx.setFlag ?? []].flat().includes(ACQUIRED_FLAG) ? (
        <ChipRow chips={[{ icon: 'flag', label: '', text: t('fx.endsRun'), good: null, title: t('fx.endsRun') }]} />
      ) : (
        now.length === 0 && !delayed && !quiet && <span className="text-[12px] font-semibold text-ink-3">?</span>
      )}
    </span>
  )
}
