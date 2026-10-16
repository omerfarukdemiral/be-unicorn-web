// B2 module diversity: the concentration metric, the slot geometry that leaves room for it, and bots that differ by seed
// and by style (the report's "Modül yoğunlaşması" line is the full measure, over every good-bot run).
import { describe, expect, it } from 'vitest'
import { CONTENT } from '../../src/content/index'
import { categoryModules, moduleDef, slotsAt } from '../../src/engine/modules'
import { PROJECT_CATEGORIES, type ProjectModuleId } from '../../src/engine/types'
import { playBot } from '../bots'
import { CONCENTRATION_MAX, moduleConcentration } from '../moduleStats'

describe('moduleConcentration', () => {
  it('shares per category, the modules over the bar, distinct first threes, used and per-run shares', () => {
    const runs = [
      { projectsEnd: [{ category: 'web', ids: ['paywall', 'seo', 'feedback', 'referral'] }, { category: 'api', ids: ['docs'] }] },
      { projectsEnd: [{ category: 'web', ids: ['seo', 'paywall', 'feedback'] }] },
      { projectsEnd: [{ category: 'web', ids: ['seo', 'analytics', 'referral'] }] },
      { projectsEnd: [{ category: 'web', ids: ['seo', 'templates', 'teamPlans'] }] },
      { projectsEnd: [{ category: 'web', ids: ['seo', 'analytics', 'cicd'] }] },
    ]
    const c = moduleConcentration(runs)
    const web = c.categories.find((x) => x.category === 'web')!
    expect(web.projects).toBe(5)
    expect(web.share.seo).toBe(1)
    expect(web.share.paywall).toBeCloseTo(0.4, 12)
    expect(web.over).toEqual(['seo'])
    // {paywall, seo, feedback} twice, then three others.
    expect(web.firstThreeSets).toBe(4)
    expect(c.categories.find((x) => x.category === 'api')!.over).toEqual(['docs'])
    expect(c.used).toBe(9)
    expect(c.unused).not.toContain('seo')
    expect(c.perRun.seo).toBe(1)
    expect(c.perRun.docs).toBeCloseTo(0.2, 12)
  })
})

describe('slot geometry (B2)', () => {
  it('a random filler under slotsAt leaves every module under the bar in every category', () => {
    let seed = 7
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296
    for (const cat of PROJECT_CATEGORIES) {
      const pool = categoryModules(cat)
      const count = new Map<string, number>()
      const N = 2000
      for (let i = 0; i < N; i++) {
        const has: ProjectModuleId[] = []
        for (let v = 1; v <= 6; v++) {
          while (has.length < slotsAt(v)) {
            const open = pool.filter((d) => !has.includes(d.id) && d.tier <= v && (d.requires ?? []).every((r) => has.includes(r)) && !has.some((h) => d.excludes?.includes(h) || moduleDef(h)?.excludes?.includes(d.id)))
            if (!open.length) break
            has.push(open[Math.floor(rnd() * open.length)]!.id)
          }
        }
        for (const id of has) count.set(id, (count.get(id) ?? 0) + 1)
      }
      const max = Math.max(...[...count.values()].map((n) => n / N))
      expect(max, cat).toBeLessThan(CONCENTRATION_MAX)
    }
  })
})

describe('bots pick by style and seed (B2)', () => {
  const firstThree = (kind: 'bootstrap' | 'vcRocket', seed: number) =>
    playBot(kind, seed, CONTENT, 1200, undefined, 'best', { firstCategory: 'web', extraCategories: [] }).projectsEnd[0]!.ids.slice(0, 3).join(',')

  it('one bot on three seeds does not open the same way every time; two styles on one seed differ', { timeout: 240_000 }, () => {
    const boot = [1, 2, 3].map((seed) => firstThree('bootstrap', seed))
    for (const ids of boot) expect(ids.split(',')).toHaveLength(3)
    expect(new Set(boot).size).toBeGreaterThan(1)
    const vc = [1, 2, 3].map((seed) => firstThree('vcRocket', seed))
    expect(vc.some((ids, i) => ids !== boot[i])).toBe(true)
  })
})
