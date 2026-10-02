import { describe, expect, it } from 'vitest'
import { CONCEPT_IDS, type EffectBundle } from '../../engine/types'
import { DECISIONS as CARD_DECISIONS } from '../decisions'
import { CONTENT, SECRET_CARDS, THREAD_CARDS } from '../index'
import { makeBusyState, makeState, sentenceCount, wordCount } from './fixture'

// PLAN §6.3 v1 selection, after the GAMEPLAY V2 §3 md.11 retirement (threads.ts brought as many cards in).
const PLAN_IDS = [
  'early-focus', 'early-sidegig', 'early-equity-split',
  'angel-1', 'cofounder-conflict', 'pmf-hypothesis-width',
  'pricing-change', 'remote-vs-office', 'culture-values', 'server-crash',
  'technical-debt-vote', 'star-resign', 'crunch-vs-launch',
  'gdpr-audit', 'cloud-bill-shock', 'talent-raid', 'international-launch',
  'acquisition-offer', 'secondary-sale', 'ipo-vs-stay-private',
  'payroll-risk', 'vc-bridge-loan', 'emergency-loan',
  // GAMEPLAY V2 §5.2: the one-time angel (engine-brought only).
  'angel-lifeline',
  'rival-price-war', 'rival-talent-raid', 'rival-copycat-feature',
]

/** Retired for the thread cards (GAMEPLAY V2 §9.2); none may come back without retiring another. */
const RETIRED = [
  'early-channel', 'early-burnout', 'early-feedback', 'friends-family',
  'accelerator-invite', 'grant-opportunity', 'advisor-equity', 'key-hire',
  'seed-termsheet', 'press-launch', 'negative-review', 'feature-request-flood', 'hiring-bar-vs-speed', 'd7-retention-drop',
  'vc-board-seat', 'ad-spend-temptation', 'growth-hack', 'viral-tiktok', 'b2b-opportunity', 'custom-feature-trap', 'blitzscale-pressure',
  'enterprise-rfp', 'whale-churn', 'market-downturn', 'strategic-investor',
]

// Words that would scold the player; cards must stay non-judgmental.
const SCOLDING = /\b(hata yaptın|yanlış seçim|aptal|kötü karar|bunu yapmamalıydın|suçlu sensin)\b/i

const allEffects = (fx: EffectBundle[]): EffectBundle[] => fx
/** The cards this lane writes: the rolled deck, the thread steps and the secret cards (crisis cards live in crises.ts). */
const DECISIONS = [...CARD_DECISIONS, ...THREAD_CARDS, ...SECRET_CARDS]
const conceptSet = new Set<string>(CONCEPT_IDS)
const cardIds = new Set(CONTENT.decisions.map((d) => d.id))

describe('decision cards', () => {
  it('match the PLAN v1 id list exactly (and ids are unique)', () => {
    expect(new Set(CARD_DECISIONS.map((d) => d.id)).size).toBe(CARD_DECISIONS.length)
    expect([...CARD_DECISIONS.map((d) => d.id)].sort()).toEqual([...PLAN_IDS].sort())
  })

  it('the whole deck stays within the card budget: ≤ 65 cards, unique ids, the retired ones gone (§3 md.11)', () => {
    const ids = CONTENT.decisions.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeLessThanOrEqual(65)
    expect(RETIRED.filter((id) => ids.includes(id))).toEqual([])
    // As many weak cards went out as thread / secret cards came in (the secret founder-burnout is the old card moved).
    const added = THREAD_CARDS.length + SECRET_CARDS.filter((c) => c.id !== 'founder-burnout').length
    expect(RETIRED.length).toBeGreaterThanOrEqual(added)
  })

  it('has the priority sets written: Garaj 3, Pre-seed 3, Kriz 3, Rakip 3 (+ the one-time angel)', () => {
    const garage = CARD_DECISIONS.filter((d) => d.category === 'normal' && d.stage === 0)
    const preseed = CARD_DECISIONS.filter((d) => d.category === 'normal' && d.stage === 1)
    const crisis = CARD_DECISIONS.filter((d) => d.category === 'crisis' && d.id !== 'angel-lifeline')
    const rival = CARD_DECISIONS.filter((d) => d.category === 'rival')
    expect(garage).toHaveLength(3)
    expect(preseed).toHaveLength(3)
    expect(crisis).toHaveLength(3)
    expect(rival).toHaveLength(3)
  })

  it('every card fits the V2 text budgets: question ≤ 12 words, label ≤ 5, reflection ≤ 10 (§3 md.5)', () => {
    const over = (xs: [string, string][], max: number) => xs.filter(([, t]) => wordCount(t) > max).map(([k, t]) => `${k}: ${t}`)
    expect(over(DECISIONS.map((d) => [d.id, d.question]), 12)).toEqual([])
    expect(over(DECISIONS.flatMap((d) => d.options.map((o, i) => [`${d.id}#${i}`, o.label] as [string, string])), 5)).toEqual([])
    const fresh = [...THREAD_CARDS, ...SECRET_CARDS]
    expect(over(fresh.flatMap((d) => d.options.map((o, i) => [`${d.id}#${i}`, o.reflection] as [string, string])), 10)).toEqual([])
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
    expect(DECISIONS.find((d) => d.id === 'emergency-loan')!.condition!(broke)).toBe(true)
  })

  it('the crunch option counts as a crunch (tech-debt trigger) and a rushed project', () => {
    const crunch = DECISIONS.find((d) => d.id === 'crunch-vs-launch')!.options[0]!.effects.setFlag
    expect(crunch).toEqual(['crunch', 'rushedProject'])
  })
})
