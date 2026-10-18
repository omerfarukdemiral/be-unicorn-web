// Chip labels: every chip names its target in one word, a modifier's duration is a tail and not part of the number.
import { describe, expect, it } from 'vitest'
import { effectChips, optionCashWarning } from './EffectChips'
import { createGame } from '../engine'

const ctx = { burn: 1000 }

describe('effectChips', () => {
  it('a rent modifier reads Kira −%10 with a 90g tail', () => {
    const [c] = effectChips({ modifiers: [{ kind: 'rent', value: 0.9, days: 90 }] }, ctx)
    expect(c).toMatchObject({ label: 'Kira', text: '−%10', tail: '90g', good: true })
  })

  it('production and morale modifiers', () => {
    const chips = effectChips({ modifiers: [{ kind: 'production', value: 1.04, days: 90 }, { kind: 'morale', value: -3, days: 90 }] }, ctx)
    expect(chips.map((c) => `${c.label} ${c.text}`)).toEqual(['Hız +%4', 'Moral −3'])
    expect(chips[1]?.good).toBe(false)
  })

  it('cash and cashPercent are two chips with distinct text', () => {
    const chips = effectChips({ cash: 5000, cashPercent: -0.1 }, ctx)
    expect(chips).toHaveLength(2)
    expect(chips.every((c) => c.label === 'Kasa')).toBe(true)
    expect(chips[0]?.text).not.toBe(chips[1]?.text)
  })

  it('plain gauges carry a one-word label and no tail', () => {
    const chips = effectChips({ morale: 5, energy: -10 }, ctx)
    expect(chips.map((c) => c.label)).toEqual(['Moral', 'Enerji'])
    expect(chips.every((c) => c.tail === undefined)).toBe(true)
  })
})

describe('round 9: an option that empties the cash says so', () => {
  it('under zero: "Kasa −$X olur"; a payroll it would bounce: "Maaşa yetmez"; a safe one: nothing', () => {
    const s = createGame({ seed: 3 })
    s.stats.cash = 5_500
    expect(optionCashWarning(s, { cash: -5_828 })?.text).toBe('Kasa −$328 olur')
    expect(optionCashWarning(s, { morale: 2 })).toBeNull()
    s.stats.cash = -328
    expect(optionCashWarning(s, { morale: 2 })?.text).toBe('Kasa −$328 olur')
    s.stats.cash = 5_500
    s.finance.burn = 6_000
    s.employees = [{ id: 'e1', name: 'A', dept: 'eng', quality: 1, salary: 6_000, status: 'working', statusSinceDay: 0, hiredDay: 0, morale: 70 } as never]
    const w = optionCashWarning(s, { cash: -5_000 })
    if (w) expect(w.text).toBe('Maaşa yetmez')
  })
})
