// Module caps (MV2d): the real values, set so a product filled with modules keeps the Unicorn pace in the sim window.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { CONTENT } from '../../content'
import { MODULE_KINDS, categoryModules, moduleEstimate, moduleGain, moduleMinus, moduleMult } from '../modules'
import { company, withModules } from './moduleFixtures'
import { PROJECT_CATEGORIES, type Project } from '../types'

describe('module caps', () => {
  it('every kind has a cap on the right side of 1 (floors below, ceilings above)', () => {
    for (const k of MODULE_KINDS) {
      const cap = B.MODULE_MULT_CAP[k]
      expect(cap, k).toBeDefined()
      if (B.MODULE_MULT_FLOOR_KINDS.includes(k)) expect(cap!, k).toBeLessThan(1)
      else expect(cap!, k).toBeGreaterThan(1)
    }
  })

  it('a product with every module of its category stays inside the caps', () => {
    for (const category of PROJECT_CATEGORIES) {
      const p = { category, modules: categoryModules(category).map((d) => ({ id: d.id, day: 0 })) } as unknown as Project
      for (const k of MODULE_KINDS) {
        const v = moduleMult(p, k, 0)
        const cap = B.MODULE_MULT_CAP[k]!
        if (B.MODULE_MULT_FLOOR_KINDS.includes(k)) expect(v, `${category} ${k}`).toBeGreaterThanOrEqual(Math.min(cap, 1) - 1e-9)
        else expect(v, `${category} ${k}`).toBeLessThanOrEqual(cap + 1e-9)
      }
    }
  })

  it('no single module fills a kind on its own (the next one still counts): at most 80 % of the way to the cap', () => {
    for (const category of PROJECT_CATEGORIES) {
      for (const d of categoryModules(category)) {
        const p = { category, modules: [{ id: d.id, day: 0 }] } as unknown as Project
        for (const k of MODULE_KINDS) {
          const cap = B.MODULE_MULT_CAP[k]!
          const v = moduleMult(p, k, 0)
          // A gain with its best partner would add its k; the offers show that, so test the partner-boosted gain too.
          const syn = (d.synergies ?? []).filter((x) => x.kind === k).reduce((a, x) => a + x.k, 0)
          const boosted = 1 + (v - 1) * (1 + syn)
          expect(Math.abs(boosted - 1), `${category} ${d.id} ${k}`).toBeLessThanOrEqual(Math.abs(cap - 1) * 0.8 + 1e-9)
        }
      }
    }
  })

  it('with the real caps a kind that is full reads "capped" on the next offer (Şu an etkisi yok)', () => {
    const ids = categoryModules('mobile').map((d) => d.id).filter((id) => id !== 'aso')
    const full = withModules(company(['mobile'], 3), 0, ids)
    const p = full.projects[0]!
    expect(moduleMult(p, 'organic', full.time.day)).toBeCloseTo(B.MODULE_MULT_CAP.organic!, 9)
    expect(moduleEstimate(full, p, 'aso', CONTENT).zero).toBe('capped')
    // One module in: the same offer still counts.
    const one = withModules(company(['mobile'], 3), 0, ['referral'])
    expect(moduleEstimate(one, one.projects[0]!, 'aso', CONTENT).zero).toBeUndefined()
  })

  it('the scale keeps gains and minuses in the same ratio', () => {
    const d = categoryModules('web').find((m) => m.id === 'referral')!
    expect(moduleGain(d, 'organic', 'web')).toBeCloseTo(1 + (d.gains.organic! - 1) * B.MODULE_EFFECT_SCALE)
    expect(moduleMinus(d, 'arpu')).toBeCloseTo(1 + (d.minus!.arpu! - 1) * B.MODULE_EFFECT_SCALE)
  })
})
