import { describe, expect, it } from 'vitest'
import {
  ARCHETYPES,
  CONCEPT_IDS,
  DEPTS,
  FOUNDER_ACTIONS,
  HUD_WIDGETS,
  SLOT_TYPES,
  STAGE_KEYS,
  TOOL_IDS,
} from '../../engine/types'
import { OFFICE_LINES } from '../officeLines'
import { EMPLOYEE_NAMES, NPC_NAMES } from '../names'
import { STAGES } from '../stages'
import { UI_TEXT } from '../strings'
import { CONTENT } from '../index'
import {
  fillTemplate,
  formatMoney,
  formatMonths,
  formatNumber,
  formatPercent,
  formatRatio,
} from '../format'
import { makeBusyState, makeState, wordCount } from './fixture'

describe('office lines', () => {
  it('has at least 40 unique lines of ≤ 12 words', () => {
    expect(OFFICE_LINES.length).toBeGreaterThanOrEqual(40)
    expect(new Set(OFFICE_LINES.map((l) => l.id)).size).toBe(OFFICE_LINES.length)
    for (const l of OFFICE_LINES) expect(wordCount(l.text)).toBeLessThanOrEqual(12)
  })

  it('milestone lines name their milestone', () => {
    for (const l of OFFICE_LINES) if (l.trigger === 'milestone') expect(l.milestone).toBeDefined()
  })

  it('never panics about runway in a profitable company', () => {
    const profitable = makeState((s) => {
      s.finance.mrr = 20_000
      s.finance.burn = 10_000
      s.finance.net = 10_000
      s.finance.runway = null
    })
    for (const l of OFFICE_LINES.filter((x) => x.trigger === 'lowRunway')) {
      expect(l.condition).toBeDefined()
      expect(l.condition!(profitable)).toBe(false)
    }
    const burning = makeState((s) => {
      s.finance.net = -5000
      s.finance.runway = 1.2
    })
    expect(OFFICE_LINES.filter((x) => x.trigger === 'lowRunway').some((l) => l.condition!(burning))).toBe(true)
  })

  it('conditions are pure booleans', () => {
    for (const l of OFFICE_LINES) {
      if (!l.condition) continue
      for (const s of [makeState(), makeBusyState()]) expect(typeof l.condition(s)).toBe('boolean')
    }
  })
})

describe('stages', () => {
  it('matches PLAN §3.1', () => {
    expect(STAGES.map((s) => s.key)).toEqual([...STAGE_KEYS])
    expect(STAGES.map((s) => s.officeName)).toEqual(['Garaj', 'Coworking köşesi', 'Küçük ofis', 'Açık plan kat', 'İki katlı ofis', 'Bina', 'Kampüs'])
    expect(STAGES.map((s) => s.totalSlots)).toEqual([4, 10, 18, 30, 44, 60, 0])
    expect(STAGES.map((s) => s.targetValuation)).toEqual([null, 500_000, 3_000_000, 15_000_000, 75_000_000, 300_000_000, 1_000_000_000])
    for (const s of STAGES) expect(s.paletteKey).toBeDefined()
  })

  it('unlocks every founder action exactly once', () => {
    const unlocked = STAGES.flatMap((s) => s.unlockActions ?? [])
    expect([...unlocked].sort()).toEqual([...FOUNDER_ACTIONS].sort())
  })
})

describe('names', () => {
  it('has ≥ 60 unique employee names and names for every NPC role', () => {
    expect(EMPLOYEE_NAMES.length).toBeGreaterThanOrEqual(60)
    expect(new Set(EMPLOYEE_NAMES).size).toBe(EMPLOYEE_NAMES.length)
    for (const role of Object.keys(CONTENT.npcText)) expect(NPC_NAMES[role as keyof typeof NPC_NAMES].length).toBeGreaterThan(0)
  })
})

describe('UI text', () => {
  it('has dock tabs, stages and id-keyed tables', () => {
    for (const k of ['dock.shop', 'dock.team', 'dock.projects', 'dock.growth', 'dock.journal']) expect(UI_TEXT[k]).toBeTruthy()
    expect([UI_TEXT['dock.shop'], UI_TEXT['dock.team'], UI_TEXT['dock.projects'], UI_TEXT['dock.growth'], UI_TEXT['dock.journal']]).toEqual([
      'Mağaza', 'Ekip', 'Projeler', 'Büyüme', 'Defter',
    ])
    const groups: [string, readonly string[]][] = [
      ['founder', FOUNDER_ACTIONS],
      ['archetype', ARCHETYPES],
      ['widget', HUD_WIDGETS],
      ['tool', TOOL_IDS],
      ['slot', SLOT_TYPES],
      ['concept', CONCEPT_IDS],
      ['dept', DEPTS],
      ['stage', STAGE_KEYS],
    ]
    for (const [prefix, ids] of groups) for (const id of ids) expect(UI_TEXT[`${prefix}.${id}`], `${prefix}.${id}`).toBeTruthy()
  })

  it('bundle exposes every table', () => {
    expect(CONTENT.concepts).toHaveLength(27)
    expect(CONTENT.furniture).toHaveLength(30)
    expect(CONTENT.uiText['app.title']).toBe('Be Unicorn')
  })
})

describe('format', () => {
  it('prints compact money and numbers like the PLAN examples', () => {
    expect(formatNumber(4200)).toBe('4.2K')
    expect(formatMoney(1_200_000)).toBe('$1.2M')
    expect(formatMoney(11_000)).toBe('$11K')
    expect(formatMoney(950)).toBe('$950')
    expect(formatMoney(-4200)).toBe('−$4.2K')
    expect(formatMoney(999_999)).toBe('$1M')
    expect(formatMoney(1_000_000_000)).toBe('$1B')
    expect(formatMoney(150_000)).toBe('$150K')
  })

  it('prints Turkish percents, months and ratios', () => {
    expect(formatPercent(0.06)).toBe('%6')
    expect(formatPercent(0.125)).toBe('%13')
    expect(formatPercent(0.045)).toBe('%4.5')
    expect(formatMonths(2.63)).toBe('2.6 ay')
    expect(formatMonths(null)).toBe('sonsuz')
    expect(formatRatio(3.24)).toBe('3.2x')
    expect(formatRatio(null)).toBe('—')
  })

  it('fills templates', () => {
    expect(fillTemplate('{name} ekibe katıldı.', { name: 'Mira' })).toBe('Mira ekibe katıldı.')
    expect(fillTemplate('{a} {b}', { a: 1 })).toBe('1 {b}')
  })
})
