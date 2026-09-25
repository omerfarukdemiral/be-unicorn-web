import { describe, expect, it } from 'vitest'
import { PROJECT_CATEGORIES } from '../../engine/types'
import { checkCompanyName, suggestCompanyName } from '../companyName'
import { ROADMAP_STEPS } from '../roadmap'
import { STAGES } from '../stages'
import { PROJECT_CATEGORY_TEXT } from '../text'
import { wordCount } from './fixture'

describe('project category lines', () => {
  it('every category has a line of ≤ 10 words, all different', () => {
    const lines = PROJECT_CATEGORIES.map((c) => PROJECT_CATEGORY_TEXT[c].description)
    for (const l of lines) {
      expect(l.length).toBeGreaterThan(0)
      expect(wordCount(l)).toBeLessThanOrEqual(10)
    }
    expect(new Set(lines).size).toBe(lines.length)
  })
})

describe('company name', () => {
  it('suggestions are valid names', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 200; i++) {
      const n = suggestCompanyName(rand)
      expect(checkCompanyName(n)).toEqual({ ok: true, value: n })
    }
  })

  it('accepts ordinary names and cleans spaces', () => {
    expect(checkCompanyName('  Helio   Studio ')).toEqual({ ok: true, value: 'Helio Studio' })
    for (const n of ['Kervan.io', 'Tohum.app', 'Klasik Labs', 'Gotik Oyun', 'Ar&Ge Works', 'Şimşek Pay', 'Grapes AI']) expect(checkCompanyName(n).ok).toBe(true)
  })

  it('rejects short, long, links, odd characters and bad words', () => {
    expect(checkCompanyName('a')).toEqual({ ok: false, issue: 'short' })
    expect(checkCompanyName('x'.repeat(33))).toEqual({ ok: false, issue: 'long' })
    for (const n of ['https://x.co', 'www.bizim', 'helio.com', 'benim.com.tr', 'a/b', 'ben@site']) expect(checkCompanyName(n)).toEqual({ ok: false, issue: 'url' })
    expect(checkCompanyName('Helio <b>')).toEqual({ ok: false, issue: 'chars' })
    for (const n of ['Siktir Labs', 'amk studio', 'F.u.c.k AI', 'Orosp0 Labs']) expect(checkCompanyName(n).ok).toBe(false)
  })
})

describe('roadmap', () => {
  it('has one unlock line (≤ 6 words) per stage', () => {
    expect(ROADMAP_STEPS.map((r) => r.stage)).toEqual(STAGES.map((s) => s.index))
    for (const r of ROADMAP_STEPS) expect(wordCount(r.unlock)).toBeLessThanOrEqual(6)
  })
})
