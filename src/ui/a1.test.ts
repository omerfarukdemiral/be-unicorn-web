// A1 (round 3 §3): the ad lines the player reads: Turkish case endings on names, the CAC reason, the focus chips in
// absolute numbers, the receipt's ad users.
import { describe, expect, it } from 'vitest'
import { withCase } from '../content/format'
import { recomputeDerived } from '../engine/derive'
import { company, content } from '../engine/__tests__/moduleFixtures'
import { clone } from '../engine/util'
import { cacReasonText } from './loopUi'
import { adUsersText } from './Moments'
import { focusChips } from './panels/AdFocus'

describe('withCase', () => {
  it('dative and locative after a name, by the last vowel heard', () => {
    expect(['Tılsım', 'Pano', 'Yakamoz', 'Gündelik', 'Kedi'].map((n) => withCase(n, 'dat'))).toEqual(["Tılsım'a", "Pano'ya", "Yakamoz'a", "Gündelik'e", "Kedi'ye"])
    expect(['Garaj', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Unicorn'].map((n) => withCase(n, 'loc'))).toEqual([
      "Garaj'da",
      "Pre-seed'de",
      "Seed'de",
      "Series A'da",
      "Series B'de",
      "Series C'de",
      "Unicorn'da",
    ])
    expect(withCase('Kitap', 'loc')).toBe("Kitap'ta")
  })

  it('a name ending in a number reads the number (A1 fix: "Pano 2\'ye", not "Pano 2\'e")', () => {
    expect(['Pano 2', 'Kasa 10', 'Tılsım 3', 'Ajans 300', 'Pano2'].map((n) => withCase(n, 'dat'))).toEqual(["Pano 2'ye", "Kasa 10'a", "Tılsım 3'e", "Ajans 300'e", "Pano2'ye"])
    expect(withCase('Pano 4', 'loc')).toBe("Pano 4'te")
  })
})

describe('cacReasonText', () => {
  it('names the crisis, the stage and the spend; null when nothing stands out', () => {
    const s = company(['web', 'mobile'], 2)
    s.stageStart = { ...s.stageStart!, day: s.time.day - 365 }
    s.finance.adBudget = 0
    s.derived.avgMaturity = 1
    s.derived.penetration = 0
    expect(cacReasonText(s)).toBeNull()
    const war = clone(s)
    war.modifiers.push({ id: 'm', kind: 'cac', value: 1.6, untilDay: war.time.day + 30, source: 'crisis:cac-war' })
    expect(cacReasonText(war)).toBe('CAC ×1.6: Reklam savaşı')
    // A decision card's modifier has no crisis name.
    war.modifiers[war.modifiers.length - 1]!.source = 'some-card'
    expect(cacReasonText(war)).toBe('CAC ×1.6: verdiğin bir karar')
    const up = clone(s)
    up.stageStart = { ...up.stageStart!, day: up.time.day - 5 }
    expect(cacReasonText(up)).toBe("CAC ×1.7: Seed'de reklam pahalı")
    const spend = clone(s)
    spend.finance.adBudget = 2 * Math.max(spend.finance.mrr, 10_000)
    expect(cacReasonText(spend)).toMatch(/^CAC ×\d\.\d: bütçe MRR'ı aştı, reklam doyuyor$/)
  })

  it('"aştı" only when the budget passed the MRR; a top factor with no words hands the line to the next (A1 fix)', () => {
    const s = company(['web', 'mobile'], 2)
    s.stageStart = { ...s.stageStart!, day: s.time.day - 365 }
    s.derived.avgMaturity = 1
    s.derived.penetration = 0
    s.finance.mrr = 200_000
    s.finance.adBudget = 120_000
    expect(cacReasonText(s)).toBe('CAC ×1.3: bütçe büyüdü, reklam doyuyor')
    // A policy multiplier with no adopted policy behind it is bigger but has nothing to name.
    s.derived.policies = { available: [], adopted: [], nextSignDay: 0, mult: { cac: 1.8 }, movesBonus: 0, burnAsk: 0, payLater: 0 }
    expect(cacReasonText(s)).toBe('CAC ×1.3: bütçe büyüdü, reklam doyuyor')
  })
})

describe('focusChips', () => {
  it('the focused product gains paid users, the other loses them, in whole numbers; the same focus says nothing', () => {
    const s = company(['web', 'game'], 2)
    s.finance.adBudget = 0.5 * s.finance.mrr
    recomputeDerived(s, content)
    const [a, b] = s.projects
    expect(focusChips(s, null, null)).toMatchObject({ gain: null, loss: null, mrr: 0 })
    const c = focusChips(s, b!.id, null)
    expect(c.gain).toBe(b!.name)
    expect(c.loss).toBe(a!.name)
    // Weight 3 of 4 against 1 of 2: a quarter of the paid channel moves.
    expect(c.gainN).toBe(Math.round(s.derived.channels.paid * 0.25))
    expect(c.lossN).toBe(c.gainN)
    expect(Number.isInteger(c.mrr)).toBe(true)
  })
})

describe('receipt ad users', () => {
  it('"Reklam: +n kullanıcı" from one user up', () => {
    expect(adUsersText({ adUsers: 42 })).toBe('Reklam: +42 kullanıcı')
    expect(adUsersText({ adUsers: 0.4 })).toBeNull()
    expect(adUsersText({})).toBeNull()
  })
})
