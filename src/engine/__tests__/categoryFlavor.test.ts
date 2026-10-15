// B1: game and web reach Unicorn under every bot without losing their flavor. Game stays the poorest payer with the
// best word of mouth and grows in hits (a 2× update wave); web stays below mobile per user but buys users cheaper.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { cacFactors } from '../ads'
import { recomputeDerived } from '../derive'
import { updateWave } from '../loop'
import type { GameState, ProjectCategory } from '../types'
import { clone } from '../util'
import { TRAITS } from '../../ui/panels/ProjectsPanel'
import { company, content } from './moduleFixtures'

/** The same company with project 0 recast as `cat` (users, maturity, team unchanged). */
function as(s: GameState, cat: ProjectCategory): GameState {
  const c = clone(s)
  c.projects[0]!.category = cat
  recomputeDerived(c, content)
  return c
}

describe('category flavor (B1)', () => {
  it('ARPU order: game < web < mobile; game keeps the best word of mouth', () => {
    expect(B.CATEGORY_ARPU.game).toBeLessThan(B.CATEGORY_ARPU.web)
    expect(B.CATEGORY_ARPU.web).toBeLessThan(B.CATEGORY_ARPU.mobile)
    expect(B.CATEGORY_ORGANIC.game).toBe(Math.max(...Object.values(B.CATEGORY_ORGANIC)))
  })

  it("a game project's update wave is CATEGORY_WAVE.game × a mobile one's at the same state", () => {
    const s = company(['mobile'], 3)
    s.stats.users = 40_000
    const g = as(s, 'game')
    const raw = updateWave(s, s.projects[0]!)
    expect(B.CATEGORY_WAVE.game).toBe(2)
    expect(raw).toBeGreaterThan(100)
    // Both round the same unrounded wave: ×2 before rounding lands within one user of 2 × the rounded mobile wave.
    expect(Math.abs(updateWave(g, g.projects[0]!) - 2 * raw)).toBeLessThanOrEqual(1)
    expect(updateWave(g)).toBe(updateWave(s))
  })

  it("an ad-run web product's CAC is CATEGORY_CAC.web × the same state as mobile, and the factor list carries it", () => {
    const s = company(['mobile'], 3)
    s.finance.adBudget = 5_000
    recomputeDerived(s, content)
    const w = as(s, 'web')
    expect(B.CATEGORY_CAC.web).toBe(0.85)
    expect(w.derived.cac / s.derived.cac).toBeCloseTo(B.CATEGORY_CAC.web, 9)
    expect(cacFactors(w).find((f) => f.key === 'category')!.value).toBeCloseTo(0.85, 9)
    expect(cacFactors(s).find((f) => f.key === 'category')!.value).toBe(1)
  })

  it('the Projects panel still shows web and game with one coin pip', () => {
    const arpu = TRAITS.find((t) => t.key === 'arpu')!
    expect(arpu.of('web')).toBe(1)
    expect(arpu.of('game')).toBe(1)
    expect(arpu.of('mobile')).toBe(2)
  })
})
