import { describe, expect, it } from 'vitest'
import { CONCEPT_IDS, type EffectBundle } from '../../engine/types'
import { DECISIONS } from '../decisions'
import { makeBusyState, makeState, sentenceCount, wordCount } from './fixture'

// PLAN §6.3 v1 selection.
const PLAN_IDS = [
  'early-focus', 'early-channel', 'early-sidegig', 'early-burnout', 'early-feedback', 'early-equity-split', 'friends-family',
  'angel-1', 'accelerator-invite', 'grant-opportunity', 'key-hire', 'cofounder-conflict', 'advisor-equity', 'pmf-hypothesis-width',
  'seed-termsheet', 'press-launch', 'negative-review', 'pricing-change', 'feature-request-flood', 'remote-vs-office',
  'culture-values', 'hiring-bar-vs-speed', 'd7-retention-drop', 'server-crash',
  'vc-board-seat', 'ad-spend-temptation', 'growth-hack', 'viral-tiktok', 'technical-debt-vote', 'star-resign',
  'crunch-vs-launch', 'b2b-opportunity', 'custom-feature-trap', 'blitzscale-pressure',
  'enterprise-rfp', 'whale-churn', 'gdpr-audit', 'cloud-bill-shock', 'talent-raid', 'international-launch', 'market-downturn',
  'acquisition-offer', 'strategic-investor', 'secondary-sale', 'founder-burnout', 'ipo-vs-stay-private',
  'payroll-risk', 'vc-bridge-loan', 'emergency-bridge',
  'rival-price-war', 'rival-talent-raid', 'rival-copycat-feature',
]

// Words that would scold the player; cards must stay non-judgmental.
const SCOLDING = /\b(hata yaptın|yanlış seçim|aptal|kötü karar|bunu yapmamalıydın|suçlu sensin)\b/i

const allEffects = (fx: EffectBundle[]): EffectBundle[] => fx
const conceptSet = new Set<string>(CONCEPT_IDS)
const cardIds = new Set(DECISIONS.map((d) => d.id))

describe('decision cards', () => {
  it('match the PLAN v1 id list exactly (and ids are unique)', () => {
    expect(new Set(DECISIONS.map((d) => d.id)).size).toBe(DECISIONS.length)
    expect([...DECISIONS.map((d) => d.id)].sort()).toEqual([...PLAN_IDS].sort())
  })

  it('has the priority sets fully written: Garaj 7, Pre-seed 7, Kriz 3', () => {
    const garage = DECISIONS.filter((d) => d.category === 'normal' && d.stage === 0)
    const preseed = DECISIONS.filter((d) => d.category === 'normal' && d.stage === 1)
    const crisis = DECISIONS.filter((d) => d.category === 'crisis')
    const rival = DECISIONS.filter((d) => d.category === 'rival')
    expect(garage).toHaveLength(7)
    expect(preseed).toHaveLength(7)
    expect(crisis).toHaveLength(3)
    expect(rival).toHaveLength(3)
  })

  it.each(DECISIONS.map((d) => [d.id, d] as const))('%s follows the text rules', (_id, d) => {
    expect(sentenceCount(d.question)).toBeGreaterThanOrEqual(1)
    expect(sentenceCount(d.question)).toBeLessThanOrEqual(2)
    expect(d.options.length).toBeGreaterThanOrEqual(2)
    expect(d.options.length).toBeLessThanOrEqual(3)
    if (d.maxStage !== undefined) expect(d.maxStage).toBeGreaterThanOrEqual(d.stage)
    for (const o of d.options) {
      expect(o.label.trim().length).toBeGreaterThan(0)
      expect(wordCount(o.label)).toBeLessThanOrEqual(6)
      expect(o.tradeoff.gain.trim().length).toBeGreaterThan(0)
      expect(o.tradeoff.cost.trim().length).toBeGreaterThan(0)
      expect(sentenceCount(o.reflection)).toBe(1)
      expect(o.reflection).not.toMatch(SCOLDING)
      expect(o.conceptId).toBeDefined()
      expect(conceptSet.has(o.conceptId!)).toBe(true)
    }
  })

  it('keeps farmable effects capped and references valid ids', () => {
    for (const d of DECISIONS) {
      for (const o of d.options) {
        const bundles = allEffects([o.effects, ...(o.delayed ? [o.delayed.effects] : [])])
        for (const fx of bundles) {
          if (fx.cashPercent !== undefined) expect(Math.abs(fx.cashPercent)).toBeLessThanOrEqual(0.25)
          if (fx.usersPercent !== undefined) expect(Math.abs(fx.usersPercent)).toBeLessThanOrEqual(0.3)
          if (fx.equity !== undefined) expect(fx.equity).toBeGreaterThanOrEqual(-0.1)
          if (fx.queueCard) expect(cardIds.has(fx.queueCard)).toBe(true)
          if (fx.queueConcept) expect(conceptSet.has(fx.queueConcept)).toBe(true)
          for (const m of fx.modifiers ?? []) expect(m.days).toBeGreaterThan(0)
        }
        if (o.delayed) {
          expect(o.delayed.days).toBeGreaterThan(0)
          if (o.delayed.note) expect(sentenceCount(o.delayed.note)).toBe(1)
        }
      }
    }
  })

  it('has some delayed consequences', () => {
    const delayed = DECISIONS.flatMap((d) => d.options).filter((o) => o.delayed)
    expect(delayed.length).toBeGreaterThanOrEqual(8)
  })

  it('conditions are pure booleans on empty and busy states', () => {
    for (const d of DECISIONS) {
      if (!d.condition) continue
      for (const s of [makeState(), makeBusyState()]) expect(typeof d.condition(s)).toBe('boolean')
    }
  })

  it('crisis cards only show in a real crisis', () => {
    const calm = makeState((s) => {
      s.finance.net = 5000
      s.finance.runway = null
      s.stats.cash = 50_000
    })
    for (const d of DECISIONS.filter((x) => x.category === 'crisis')) expect(d.condition?.(calm)).toBe(false)
    const broke = makeState((s) => (s.stats.cash = -100))
    expect(DECISIONS.find((d) => d.id === 'emergency-bridge')!.condition!(broke)).toBe(true)
  })

  it('the crunch option counts as a crunch (tech-debt trigger) and a rushed project', () => {
    const crunch = DECISIONS.find((d) => d.id === 'crunch-vs-launch')!.options[0]!.effects.setFlag
    expect(crunch).toEqual(['crunch', 'rushedProject'])
  })
})
