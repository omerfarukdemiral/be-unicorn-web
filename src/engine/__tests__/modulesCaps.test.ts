// Module caps (MV2d): the real values, set so a product filled with modules keeps the Unicorn pace in the sim window.
import { describe, expect, it } from 'vitest'
import * as B from '../balance'
import { MODULE_KINDS, categoryModules, moduleMult } from '../modules'
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

  it('the tuned values: the money kinds under +12 %, retention under −10 %', () => {
    expect(B.MODULE_MULT_CAP.arpu!).toBeLessThanOrEqual(1.12)
    expect(B.MODULE_MULT_CAP.organic!).toBeLessThanOrEqual(1.12)
    expect(B.MODULE_MULT_CAP.churn!).toBeGreaterThanOrEqual(0.9)
  })
})
