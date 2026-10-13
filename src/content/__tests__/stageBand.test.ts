// Growth feel (G1): stage bands, title / line / card variants, stage system text. Cosmetic: nothing here may change
// the number or order of OFFICE_LINES (the seeded rng draws against that list).
import { describe, expect, it } from 'vitest'
import { DECISIONS, NPC_TEXT, OFFICE_LINES, UI_TEXT } from '../index'
import { NPC_ROLES } from '../../engine/types'
import { cardQuestion, founderSub, lineText, npcTitle, STAGE_TEXT, stageBand, type StageBand } from '../stageBand'
import { stageText } from '../../ui/i18n'
import { wordCount } from './fixture'

const BANDS: readonly string[] = ['0', '1', '2', '3']

describe('stageBand', () => {
  it('maps stages 0 | 1-2 | 3-4 | 5-6', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(stageBand)).toEqual([0, 1, 1, 2, 2, 3, 3])
  })

  it('helpers fall back to the base text (band 1 is today)', () => {
    const line = { text: 'a', variants: { 2: 'b' } as Partial<Record<StageBand, string>> }
    expect([0, 1, 2].map((s) => lineText(line, s))).toEqual(['a', 'a', 'a'])
    expect([3, 4].map((s) => lineText(line, s))).toEqual(['b', 'b'])
    expect(lineText({ text: 'a' }, 5)).toBe('a')
    expect(cardQuestion({ question: 'q' }, 6)).toBe('q')
    expect(npcTitle('mentor', 6)).toBe(NPC_TEXT.mentor.title)
    expect(npcTitle('accountant', 1)).toBe('Muhasebeci')
  })

  it('NPC titles grow with the company', () => {
    expect([1, 3, 5].map((s) => npcTitle('accountant', s))).toEqual(['Muhasebeci', 'Mali işler', 'CFO'])
    expect([1, 3, 5].map((s) => npcTitle('engineer', s))).toEqual(['Mühendis', 'Baş mühendis', 'CTO'])
    expect(npcTitle('customer', 3)).toBe('Kurumsal müşteri')
    expect(npcTitle('journalist', 4)).toBe('Teknoloji muhabiri')
  })

  it('founder sub-label per stage', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(founderSub)).toEqual(['Kurucu', 'Kurucu', 'Kurucu & CEO', 'CEO', 'CEO', 'CEO', 'Unicorn CEO'])
  })
})

describe('variants', () => {
  it('only valid bands, ≤ 12 words, on lines with a reachable trigger', () => {
    for (const l of OFFICE_LINES) {
      for (const [b, text] of Object.entries(l.variants ?? {})) {
        expect(BANDS, l.id).toContain(b)
        expect(wordCount(text!), `${l.id}@${b}`).toBeLessThanOrEqual(12)
      }
      if (l.variants) expect(['hire', 'fire', 'resign'], l.id).toContain(l.trigger)
    }
    expect(OFFICE_LINES.filter((l) => l.variants).length).toBeGreaterThan(0)
  })

  it('card questionBy: valid bands, ≤ 24 words, only on cards spanning 2+ bands, keeps its digits', () => {
    const digits = (s: string) => s.match(/\d+/g)?.join(',') ?? ''
    for (const c of DECISIONS) {
      if (!c.questionBy) continue
      expect(stageBand(c.stage), c.id).not.toBe(stageBand(c.maxStage ?? 6))
      for (const [b, q] of Object.entries(c.questionBy)) {
        expect(BANDS, c.id).toContain(b)
        expect(wordCount(q!), c.id).toBeLessThanOrEqual(24)
        expect(digits(q!), c.id).toBe(digits(c.question))
      }
    }
    expect(DECISIONS.filter((c) => c.questionBy).length).toBeGreaterThan(0)
  })

  it('NPC titleBy: valid bands for known roles', () => {
    for (const r of NPC_ROLES) for (const b of Object.keys(NPC_TEXT[r].titleBy ?? {})) expect(BANDS).toContain(b)
  })

  it('OFFICE_LINES keeps its length and id order (rng draws against it)', () => {
    expect(OFFICE_LINES.length).toBe(OFFICE_LINES_COUNT)
    expect(OFFICE_LINES.map((l) => l.id).slice(0, 9)).toEqual(['hire-1', 'hire-2', 'hire-3', 'hire-4', 'hire-5', 'fire-1', 'fire-2', 'resign-1', 'resign-2'])
  })
})

// Pinned when G1 landed: a new line is a deliberate rng-changing edit, not a side effect of a text pass.
const OFFICE_LINES_COUNT = 53

describe('STAGE_TEXT', () => {
  it('keys exist in UI_TEXT, bands are valid, system voice ≤ 6 words', () => {
    for (const [key, byBand] of Object.entries(STAGE_TEXT)) {
      expect(UI_TEXT[key], key).toBeDefined()
      for (const [b, text] of Object.entries(byBand)) {
        expect(BANDS, key).toContain(b)
        expect(wordCount(text!.replace(/\{\w+\}/g, '')), `${key}@${b}`).toBeLessThanOrEqual(6)
      }
    }
  })

  it('stageText overrides a band and falls back to t(key)', () => {
    expect(stageText('bubble.payday', 1, { v: '$5' })).toBe(UI_TEXT['bubble.payday']!.replace('{v}', '$5'))
    expect(stageText('bubble.payday', 3, { v: '$5' })).toBe('Bordro günü · $5')
    expect(stageText('bubble.payday', 5, { v: '$5' })).toBe('Bordro · $5')
  })
})
