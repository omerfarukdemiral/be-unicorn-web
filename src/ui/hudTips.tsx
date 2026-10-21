// What each HUD number's tooltip says (P5): name + what raises / lowers it + the live main source. Rendered only while
// a tip is open (ui/Tip.tsx), so the live lines cost nothing until asked for. Text: content/tipText.ts.
import { useShallow } from 'zustand/react/shallow'
import * as B from '../engine/balance'
import type { BurnBreakdown, GameState, HudWidget } from '../engine/types'
import { STAGES, UI_TEXT } from '../content'
import { useGameStore } from '../store/gameStore'
import { cashFlow } from './cashflow'
import { fixed, money, signedMoney, signedNum } from './format'
import { t } from './i18n'
import { valuationLine } from './loopUi'
import { TipBody, type TipContent } from './Tip'

const BURN_PART: Record<keyof BurnBreakdown, string> = {
  salaries: 'maaşlar',
  rent: 'kira',
  infra: 'sunucu',
  ads: 'reklam',
  founder: 'kurucu geçimi',
  expansion: 'yeni pazarlar',
}

const CHANNEL: Record<'organic' | 'paid' | 'manual' | 'enterprise', string> = {
  organic: 'organik',
  paid: 'reklam',
  manual: 'saha',
  enterprise: 'kurumsal satış',
}

/** The biggest monthly cost line: ["maaşlar", 1200] (null = no costs yet). */
export function biggestCost(bb: BurnBreakdown | undefined): [string, number] | null {
  if (!bb) return null
  let best: [string, number] | null = null
  for (const [k, v] of Object.entries(bb) as [keyof BurnBreakdown, number | undefined][]) {
    if (v !== undefined && v > 0.5 && (!best || v > best[1])) best = [BURN_PART[k], v]
  }
  return best
}

/** The channel bringing the most users a month: ["reklam", 40] (null = none). */
export function biggestChannel(c: GameState['derived']['channels'] | undefined): [string, number] | null {
  if (!c) return null
  let best: [string, number] | null = null
  for (const k of Object.keys(CHANNEL) as (keyof typeof CHANNEL)[]) {
    const v = c[k]
    if (v >= 1 && (!best || v > best[1])) best = [CHANNEL[k], v]
  }
  return best
}

export function CashTip() {
  const s = useGameStore(useShallow((st) => {
    const f = cashFlow(st.state)
    return { owed: f.owed, bank: f.bank, bb: st.state.finance.burnBreakdown, debt: st.state.finance.debt, missed: !!st.state.finance.payrollMissed, negDays: st.state.finance.negativeCashDays }
  }))
  const top = biggestCost(s.bb)
  const c: TipContent = {
    name: t('tip.cash.name'),
    value: s.owed > 0.5 ? t('tip.cash.value', { bank: money(s.bank), owed: money(s.owed) }) : undefined,
    up: t('tip.cash.up'),
    down: t('tip.cash.down'),
    live: [top ? t('tip.cash.live', { what: top[0], v: money(-top[1]) }) : '', s.debt > 0 ? t('top.debt', { v: money(s.debt) }) : ''].filter(Boolean).join(' · ') || undefined,
    alert: s.missed ? t('top.bankrupt', { v: Math.max(0, 60 - s.negDays) }) : undefined,
  }
  return <TipBody {...c} />
}

export function NetTip() {
  const s = useGameStore(useShallow((st) => ({ mrr: st.state.finance.mrr, burn: st.state.finance.burn })))
  return <TipBody name={t('tip.net.name')} up={t('tip.net.up')} down={t('tip.net.down')} live={t('tip.net.live', { in: signedMoney(s.mrr), out: money(-s.burn) })} />
}

export function RunwayTip() {
  const runway = useGameStore((st) => st.state.finance.runway)
  const live = runway === null ? t('tip.runway.profit') : t('tip.runway.live', { v: fixed(runway, 1) })
  return <TipBody name={t('tip.runway.name')} up={t('tip.runway.up')} down={t('tip.runway.down')} live={live} alert={runway !== null && runway < 3 ? t('tip.runway.danger') : undefined} />
}

export function UsersTip() {
  const s = useGameStore(useShallow((st) => ({ ch: st.state.derived.channels, overload: st.state.derived.overload })))
  const top = biggestChannel(s.ch)
  return (
    <TipBody
      name={t('tip.users.name')}
      up={t('tip.users.up')}
      down={t('tip.users.down')}
      live={top ? t('tip.users.live', { what: top[0], v: signedNum(Math.round(top[1])) }) : undefined}
      alert={s.overload > 0 ? t('tip.users.overload') : undefined}
    />
  )
}

export function MoraleTip() {
  const why = useGameStore((st) => st.state.derived.moraleWhy)
  const morale = useGameStore((st) => st.state.stats.morale)
  const drags: [string, number][] = why
    ? [
        ['aşırı yük', why.overload],
        ['eksi kasa', why.cash ?? 0],
        ['ödenmeyen maaş', why.wages ?? 0],
        ['sıkılma', -(why.bored ?? 0)],
      ]
    : []
  const drag = drags.filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1])[0]
  const live = why ? [t('tip.morale.live', { v: Math.round(why.team ?? why.target) }), drag ? t('tip.morale.drag', { what: drag[0], v: signedNum(-Math.round(drag[1])) }) : ''].filter(Boolean).join(' · ') : undefined
  return (
    <TipBody
      name={t('tip.morale.name')}
      up={t('tip.morale.up')}
      down={t('tip.morale.down')}
      live={live}
      alert={why && morale < why.quitAt + 10 ? t('tip.morale.danger', { v: Math.round(why.quitAt) }) : undefined}
    />
  )
}

export function EnergyTip() {
  return <TipBody name={t('tip.energy.name')} up={t('tip.energy.up', { v: B.ENERGY_REGEN_PER_DAY })} down={t('tip.energy.down')} />
}

export function MovesTip() {
  const s = useGameStore(useShallow((st) => ({ moves: st.state.derived.moves, day: st.state.time.day })))
  const d = s.moves ? Math.max(1, Math.ceil(s.moves.resetDay - s.day)) : 0
  return <TipBody name={t('tip.moves.name')} up={t('tip.moves.up')} down={t('tip.moves.down')} live={s.moves ? t('tip.moves.live', { d }) : undefined} />
}

/** Payday countdown: days, what leaves, what is in the till. */
export function paydayTip(d: number, pay: number, cash: number): TipContent {
  return { name: t('tip.payday.name'), value: t('tip.payday.value', { d, pay: money(pay), cash: money(cash) }), down: t('tip.payday.down') }
}

export function StageTip() {
  const s = useGameStore(useShallow((st) => ({ stage: st.state.stage, valuation: st.state.finance.valuation, parts: st.state.derived.valuationParts })))
  const next = STAGES[s.stage + 1]
  const live = next ? t('top.progressTitle', { stage: next.name, v: money(s.valuation), target: money(next.targetValuation ?? 0) }) : t('top.lastStage')
  const parts = valuationLine(s.parts)
  return <TipBody name={t('tip.stage.name')} value={parts || undefined} up={t('tip.stage.up')} down={t('tip.stage.down')} live={live} />
}

export function DateTip() {
  const day = useGameStore((st) => st.state.time.day)
  return <TipBody name={t('tip.date.name')} value={t('tip.date.value', { m: Math.floor(day / 30) + 1, d: Math.floor(day % 30) + 1 })} />
}

/** A pinned gauge: its name, value and the up / down lines when the table has them. */
export function widgetTip(id: HudWidget, label: string, value?: string): TipContent {
  const line = (k: string) => (UI_TEXT[k] !== undefined ? t(k) : undefined)
  return { name: label, value, up: line(`tip.${id}.up`), down: line(`tip.${id}.down`) }
}
