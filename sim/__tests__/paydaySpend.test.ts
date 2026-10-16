// Bot spends and the month already owed: the vcRocket small-rounds seed 4 bot opened a 1.5M segment one tick before
// payday while profitable (day 1169) and missed payroll. A big spend now leaves the accrued month to payday.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../src/content/index'
import { createEngine, type GameState } from '../../src/engine/index'
import { affordsWithRunway, playBot } from '../bots'

/** A profitable company late in the month: 2.175M in the bank, 1.2M of it owed on payday (the seed-4 numbers). */
function lateMonth(): GameState {
  const s = createEngine(CONTENT).createGame({ seed: 4 })
  s.stats.cash = 2_175_000
  s.finance.net = 753_558
  s.finance.burn = 407_731
  s.finance.ledger = { revenue: 1_066_000, salaries: 62_000, rent: 170_000, infra: 147_000, ads: 811_000, founder: 0, expansion: 8_000 }
  return s
}

describe('bots: spends leave the month owed to payday', () => {
  it('a profitable bot does not buy what the owed month needs', () => {
    const s = lateMonth()
    expect(affordsWithRunway(s, 1_500_000, 40_000, 6)).toBe(false)
    // The same spend right after payday is fine: 675k left covers 6 months of a quarter of the gross burn.
    s.finance.ledger = { revenue: 0, salaries: 0, rent: 0, infra: 0, ads: 0 }
    expect(affordsWithRunway(s, 1_500_000, 40_000, 6)).toBe(true)
  })

  it('vcRocket small rounds, seed 4: no segment bought into a missed payroll', { timeout: 240_000 }, () => {
    const run = playBot('vcRocket', 4, CONTENT, 4500, undefined, 'best', { roundSize: 'small' })
    expect(run.end).not.toBe('bankrupt')
  })
})
