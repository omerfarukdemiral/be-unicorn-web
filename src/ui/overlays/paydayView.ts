// Payday desk view (docs/GAMEPLAY_V2.md §6.1, §10.6): the month waiting on the desk laid out as rows, one per line of
// the receipt, each with its answers and what the picked answer costs, plus what is left after. Pure and tested
// (paydayView.test.ts). It computes nothing of its own: the outcome is the engine's resolvePayday run on a copy
// (applyAction clones the state), the costs are the engine's balance constants and the modifier it would write.
import { applyAction } from '../../engine'
import * as B from '../../engine/balance'
import type { GameState, PaydayChoice } from '../../engine/types'

export type PaydayLine = keyof PaydayChoice

/** Receipt order on the desk (the default order pays salaries first, §6.1). */
export const PAYDAY_LINES: readonly PaydayLine[] = ['salaries', 'infra', 'rent', 'founder', 'ads']

/** Answers per line, in segment order (ads cannot be deferred: pay or cut). */
export const PAYDAY_OPTIONS: { readonly [K in PaydayLine]: readonly PaydayChoice[K][] } = {
  salaries: ['full', 'half', 'defer'],
  infra: ['pay', 'defer'],
  rent: ['pay', 'defer'],
  founder: ['pay', 'skip'],
  ads: ['pay', 'cut'],
}

/** What a picked answer costs, as an icon + number (the overlay prints it; no sentence). */
export type PaydayCost =
  | { kind: 'morale'; value: number }
  | { kind: 'capacity'; value: number }
  | { kind: 'rent'; n: number; max: number }
  | { kind: 'energy'; value: number }
  | { kind: 'ads' }

export interface PaydayRow {
  line: PaydayLine
  /** The month's cost of the line (the ledger as the engine accrued it). */
  amount: number
  options: readonly string[]
  pick: string
  cost?: PaydayCost
}

export interface PaydayDesk {
  /** The payday and the desk's last day (PAYDAY_DECIDE_DAYS later the default order applies). */
  day: number
  deadline: number
  rows: PaydayRow[]
  /** Older deferrals waiting with interest (0 = none). */
  oldDebt: number
  /** Interest on what is deferred (DEFER_INTEREST), the price of every "Ertele". */
  interest: number
  cashNow: number
  /** What resolvePayday would leave: cash, what stays owed, and whether the bankruptcy clock starts. */
  cashAfter: number
  owedAfter: number
  clock: boolean
}

/**
 * The desk for `choice`, or null when no month waits. The outcome is the engine's own answer on a copy of the state,
 * so the overlay shows exactly what "Onayla" will do.
 */
export function paydayView(state: GameState, choice: PaydayChoice): PaydayDesk | null {
  const p = state.finance.pendingPayday
  if (!p) return null
  const r = applyAction(state, { type: 'resolvePayday', choice })
  const after = r.ok ? r.state : state
  const l = p.ledger
  const amount: Record<PaydayLine, number> = { salaries: l.salaries, infra: l.infra, rent: l.rent, founder: l.founder ?? 0, ads: l.ads }
  const rows = PAYDAY_LINES.map((line): PaydayRow => {
    const pick = choice[line]
    const cost = costOf(line, pick, after)
    return { line, amount: amount[line], options: PAYDAY_OPTIONS[line], pick, ...(cost ? { cost } : {}) }
  })
  return {
    day: p.day,
    deadline: p.day + B.PAYDAY_DECIDE_DAYS,
    rows,
    oldDebt: p.deferredBefore,
    interest: B.DEFER_INTEREST,
    cashNow: state.stats.cash,
    cashAfter: after.stats.cash,
    owedAfter: after.finance.deferred ?? 0,
    clock: !!after.finance.payrollMissed && !state.finance.payrollMissed,
  }
}

/** The picked answer's price: balance constants, the capacity modifier and rent count the engine would write. */
function costOf(line: PaydayLine, pick: string, after: GameState): PaydayCost | undefined {
  switch (line) {
    case 'salaries':
      if (pick === 'half') return { kind: 'morale', value: B.PAYDAY_HALF_MORALE }
      if (pick === 'defer') return { kind: 'morale', value: B.PAYDAY_DEFER_MORALE }
      return undefined
    case 'infra': {
      if (pick !== 'defer') return undefined
      const mod = after.modifiers.find((m) => m.source === 'paydayInfra')
      return { kind: 'capacity', value: mod?.value ?? B.INFRA_DEFER_CAPACITY[0]! }
    }
    case 'rent':
      if (pick !== 'defer') return undefined
      // An eviction resets the count: show the last step then.
      return { kind: 'rent', n: Number(after.flags['rentDeferredMonths'] ?? B.EVICTION_MONTHS), max: B.EVICTION_MONTHS }
    case 'founder':
      return pick === 'skip' ? { kind: 'energy', value: B.FOUNDER_SKIP_ENERGY } : undefined
    case 'ads':
      return pick === 'cut' ? { kind: 'ads' } : undefined
  }
}
