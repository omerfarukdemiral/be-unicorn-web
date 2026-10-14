// Anti-coast gate (W2b): a profitable company that stops growing must never reach Unicorn, modules or not. The
// 'coasterModules' bot is the coaster that also fills every module slot and keeps them fresh once profitable; if it
// ever gets through, lower MODULE_MULT_CAP.arpu (now 1.09), never MULTIPLE_MAX_BY_STAGE.
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../src/content/index'
import { PLAN_GROWTH, PLAN_MONEY, PLAN_REACH, PLAN_RETENTION, playBot } from '../bots'

const DAYS = 4500
/** Stage index C = Series C. */
const SERIES_C = 5
const SEEDS = [1, 2, 3]

describe('anti-coast: coasterModules', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: no Unicorn, stuck at Series C or below, growth under 3 %/month`, { timeout: 240_000 }, () => {
      let momAtEnd = 0
      const run = playBot('coasterModules', seed, CONTENT, DAYS, (s) => {
        momAtEnd = s.derived.valuationParts?.momAvg ?? 0
      })
      expect(run.stageDays[6] ?? null).toBeNull()
      const stage = run.stageDays.reduce<number>((a, d, i) => (d !== null && d !== undefined ? i : a), 0)
      expect(stage).toBeLessThanOrEqual(SERIES_C)
      expect(momAtEnd).toBeLessThan(0.03)
      expect(Object.keys(run.moduleIds).length).toBeGreaterThan(0)
    })
  }
})

describe('bots: modules off', () => {
  it('a run with no module list builds nothing', { timeout: 60_000 }, () => {
    const run = playBot('bootstrap', 1, CONTENT, 600, undefined, 'best', { modules: {} })
    expect(run.modulesBuilt.reduce((a, b) => a + b, 0)).toBe(0)
    expect(run.refreshes).toBe(0)
  })
})

describe('bots: kind-weight module plans (MV2d)', () => {
  it('the plans value different kinds, and a plan run builds modules through moduleEstimate', { timeout: 120_000 }, () => {
    expect(PLAN_MONEY.arpu).toBeGreaterThan(PLAN_GROWTH.arpu!)
    expect(PLAN_GROWTH.organic).toBeGreaterThan(PLAN_MONEY.organic!)
    expect(PLAN_RETENTION.churn).toBeGreaterThan(PLAN_REACH.churn!)
    const run = playBot('bootstrap', 1, CONTENT, 1200, undefined, 'best', { modules: PLAN_RETENTION })
    expect(run.modulesBuilt.reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
    expect(run.projectsEnd.length).toBeGreaterThan(0)
    expect(run.projectsEnd.every((p) => p.modules <= p.slots)).toBe(true)
  })
})
