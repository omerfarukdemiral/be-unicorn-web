// One definition of money flow (docs/LAYOUT.md §2.3). Names engine fields, no new formulas.
import type { GameState } from '../engine/types'

export interface CashFlow { mrr: number; burn: number; netMonth: number; netDay: number; owed: number; usable: number; bank: number }

export function cashFlow(s: Pick<GameState, 'stats' | 'finance'>): CashFlow {
  const l = s.finance.ledger
  const owed = l ? l.salaries + l.rent + l.infra + l.ads + (l.founder ?? 0) : 0
  return { mrr: s.finance.mrr, burn: s.finance.burn, netMonth: s.finance.net, netDay: s.finance.net / 30, owed, usable: s.stats.cash - owed, bank: s.stats.cash }
}
