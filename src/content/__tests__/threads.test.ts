// GAMEPLAY V2 §9.2 / §9.4: card threads, secret cards and teasers (content side; the engine gate is decisions.ts).
import { describe, expect, it } from 'vitest'
import { STAGE_KEYS } from '../../engine/types'
import { CONTENT, SECRET_CARDS, TEASERS, THREAD_CARDS, THREAD_IDS, type DecisionCard } from '../index'
import { NPC_NAMES, RIVAL_NAMES } from '../names'
import { makeBusyState, makeState, wordCount } from './fixture'

const threadCards = CONTENT.decisions.filter((c) => c.thread)
const stepsOf = (id: string) => threadCards.filter((c) => c.thread!.id === id)

/** Every text a card shows. */
const texts = (c: DecisionCard): string[] => [c.question, ...c.options.flatMap((o) => [o.label, o.tradeoff.gain, o.tradeoff.cost, o.reflection, o.delayed?.note ?? ''])]

describe('card threads', () => {
  it('5 threads, ≈ 22 new cards in threads.ts, each a thread card of weight 3', () => {
    expect(new Set(threadCards.map((c) => c.thread!.id))).toEqual(new Set(THREAD_IDS))
    expect(THREAD_CARDS.length).toBeGreaterThanOrEqual(20)
    expect(THREAD_CARDS.length).toBeLessThanOrEqual(24)
    for (const c of THREAD_CARDS) {
      expect(c.category).toBe('thread')
      expect(c.weight ?? 3).toBe(3)
    }
  })

  it.each(THREAD_IDS.map((id) => [id]))('%s: steps run 1..n without gaps, stages never go back', (id) => {
    const cards = stepsOf(id)
    const steps = [...new Set(cards.map((c) => c.thread!.step))].sort((a, b) => a - b)
    expect(steps).toEqual(steps.map((_, i) => i + 1))
    for (const c of cards) {
      for (const prev of cards.filter((p) => p.thread!.step === c.thread!.step - 1)) expect(prev.stage).toBeLessThanOrEqual(c.stage)
    }
  })

  it.each(THREAD_IDS.map((id) => [id]))('%s: `after` points at real options, and every option of a step leads on', (id) => {
    const cards = stepsOf(id)
    const last = Math.max(...cards.map((c) => c.thread!.step))
    for (const c of cards) {
      const prev = cards.filter((p) => p.thread!.step === c.thread!.step - 1)
      const maxOptions = Math.max(0, ...prev.map((p) => p.options.length))
      for (const i of c.thread!.after ?? []) {
        expect(Number.isInteger(i)).toBe(true)
        expect(i).toBeGreaterThanOrEqual(0)
        expect(i).toBeLessThan(maxOptions)
      }
    }
    // No dead end: each option of a step < last is covered by some next-step card.
    for (const c of cards.filter((x) => x.thread!.step < last)) {
      const next = cards.filter((n) => n.thread!.step === c.thread!.step + 1)
      c.options.forEach((_, i) => expect(next.some((n) => n.thread!.after === undefined || n.thread!.after.includes(i)), `${c.id}#${i}`).toBe(true))
    }
  })

  it('the existing exit and rival cards are steps: investor 5 (acquisition-offer), rival 3', () => {
    const byId = new Map(CONTENT.decisions.map((c) => [c.id, c]))
    expect(byId.get('acquisition-offer')!.thread).toEqual({ id: 'investor', step: 5 })
    // One card per thread per stage: a second step 5 would hide the exit offer, and step 4 leaves Series C free.
    expect(byId.get('ipo-vs-stay-private')!.thread).toBeUndefined()
    expect(byId.get('investor-target')!.maxStage).toBeLessThan(byId.get('acquisition-offer')!.stage)
    for (const id of ['rival-price-war', 'rival-talent-raid', 'rival-copycat-feature']) expect(byId.get(id)!.thread).toEqual({ id: 'rival', step: 3 })
  })

  it('investor: each step closes a stage before the next, so the chain always reaches the Series C exit offer', () => {
    const last = (step: number) => Math.max(...stepsOf('investor').filter((c) => c.thread!.step === step).map((c) => c.maxStage ?? 6))
    for (let step = 2; step <= 5; step++) expect(last(step - 1), `step ${step - 1}`).toBeLessThan(last(step))
    expect(last(5)).toBeGreaterThanOrEqual(5)
  })

  it('rival-buy-them marks the offer with a flag (acquireRival, T17)', () => {
    const buy = THREAD_CARDS.find((c) => c.id === 'rival-buy-them')!
    expect(buy.options[0]!.effects.setFlag).toBe('rivalBuyIntent')
  })
})

describe('thread and secret card text', () => {
  const fresh = [...THREAD_CARDS, ...SECRET_CARDS]

  it.each(fresh.map((c) => [c.id, c] as const))('%s: question ≤ 12, label ≤ 5, reflection ≤ 10 words', (_id, c) => {
    expect(wordCount(c.question)).toBeLessThanOrEqual(12)
    expect(c.options.length).toBeGreaterThanOrEqual(2)
    expect(c.options.length).toBeLessThanOrEqual(3)
    for (const o of c.options) {
      expect(wordCount(o.label)).toBeLessThanOrEqual(5)
      expect(wordCount(o.reflection)).toBeLessThanOrEqual(10)
    }
  })

  it('no card names a speaker or a rival (the UI fills the cast name)', () => {
    const names = [...Object.values(NPC_NAMES).flat(), ...RIVAL_NAMES]
    const hits: string[] = []
    for (const c of CONTENT.decisions) {
      for (const t of texts(c)) for (const n of names) if (new RegExp(`(^|[^\\p{L}])${n}($|[^\\p{L}])`, 'u').test(t)) hits.push(`${c.id}: ${n}`)
    }
    expect(hits).toEqual([])
  })

  it('ids are unique across the deck', () => {
    const ids = CONTENT.decisions.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeLessThanOrEqual(65)
  })
})

describe('secret cards', () => {
  const byId = new Map(SECRET_CARDS.map((c) => [c.id, c]))
  const fire = (id: string, patch: Parameters<typeof makeState>[0]) => byId.get(id)!.condition!(makeState(patch))
  const receipt = (month: number, users: number, morale: number) =>
    ({ month, day: (month + 1) * 30, users, morale, revenue: 0, salaries: 0, rent: 0, infra: 0, ads: 0, paid: 0, net: 0, cashAfter: 0, runwayBefore: null, runwayAfter: null, mom: 0, multiple: 0, mrr: 0 })
  const team = (n: number, morale = 50) => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, name: 'X', dept: 'eng' as const, quality: 1, salary: 1, status: 'working' as const, statusSinceDay: 0, hiredDay: 0, morale }))

  it('4 secret cards, each with a condition', () => {
    expect([...byId.keys()].sort()).toEqual(['founder-burnout', 'rival-dies', 'team-mutiny', 'viral-spike'])
    for (const c of SECRET_CARDS) {
      expect(c.secret).toBe(true)
      expect(c.condition).toBeDefined()
      for (const s of [makeState(), makeBusyState()]) expect(c.condition!(s)).toBe(false)
    }
  })

  it('viral-spike: users doubled within a month (last two), with its floor (users ≥ 2000, Seed+, reputation ≥ 35)', () => {
    const viral = (stage: 0 | 2, users: number, rep: number) => (s: ReturnType<typeof makeState>) => {
      s.stage = stage
      s.stats.users = users
      s.stats.reputation = rep
      s.finance.receipts = [receipt(4, 1200, 70), receipt(5, 2600, 70)]
    }
    expect(fire('viral-spike', viral(2, 2600, 72))).toBe(true)
    expect(fire('viral-spike', viral(0, 2600, 72))).toBe(false)
    expect(fire('viral-spike', viral(2, 1900, 72))).toBe(false)
    expect(fire('viral-spike', viral(2, 2600, 30))).toBe(false)
    const later = (s: ReturnType<typeof makeState>) => {
      viral(2, 2700, 72)(s)
      s.finance.receipts = [receipt(3, 1200, 70), receipt(4, 2600, 70), receipt(5, 2700, 70)]
    }
    expect(fire('viral-spike', later)).toBe(true)
    const slow = (s: ReturnType<typeof makeState>) => {
      viral(2, 2700, 72)(s)
      s.finance.receipts = [receipt(3, 1500, 70), receipt(4, 2100, 70), receipt(5, 2700, 70)]
    }
    expect(fire('viral-spike', slow)).toBe(false)
  })

  it('team-mutiny: morale < 45 for two month ends and today; team ≥ 4', () => {
    const mutiny = (n: number, moraleNow: number, older: number) => (s: ReturnType<typeof makeState>) => {
      s.employees = team(n)
      s.stats.morale = moraleNow
      s.finance.receipts = [receipt(4, 10, older), receipt(5, 10, 40)]
    }
    expect(fire('team-mutiny', mutiny(4, 40, 42))).toBe(true)
    expect(fire('team-mutiny', mutiny(3, 40, 42))).toBe(false)
    expect(fire('team-mutiny', mutiny(4, 40, 46))).toBe(false)
    expect(fire('team-mutiny', mutiny(4, 46, 42))).toBe(false)
    // One bad day is not a mutiny: the month ends must hold it too.
    expect(fire('team-mutiny', (s) => (s.employees = team(6, 20)))).toBe(false)
  })

  it('rival-dies: the thread\'s rival (first born) worn under 0.25 for three month ends, or far behind; once', () => {
    const rival = (strength: number, bornDay: number, mrr = 0) => (s: ReturnType<typeof makeState>) => {
      s.time.day = 400
      s.finance.mrr = 100_000
      s.rivals = [{ id: 'r1', name: 'R', bornDay, strength, share: 0, mrr, valuation: 0, momentum: -1 }]
    }
    expect(fire('rival-dies', rival(0.21, 100))).toBe(true)
    expect(fire('rival-dies', rival(0.24, 100))).toBe(false)
    expect(fire('rival-dies', rival(0.2, 350))).toBe(false)
    expect(fire('rival-dies', rival(0.6, 100, 10_000))).toBe(true)
    expect(fire('rival-dies', rival(0.6, 100, 20_000))).toBe(false)
    // A later, weaker rival is not the one the thread follows.
    expect(fire('rival-dies', (s) => {
      rival(0.6, 100, 50_000)(s)
      s.rivals!.push({ id: 'r2', name: 'S', bornDay: 150, strength: 0.2, share: 0, mrr: 1_000, valuation: 0, momentum: -1 })
    })).toBe(false)
    expect(fire('rival-dies', (s) => ((rival(0.21, 100)(s)), (s.flags['rivalGone'] = true)))).toBe(false)
  })

  it('rival-dies closes the rival thread: both options mark the rival gone, steps 4 and 5 wait for it', () => {
    for (const o of byId.get('rival-dies')!.options) expect(o.effects.setFlag).toBe('rivalGone')
    for (const id of ['rival-buy-them', 'rival-buys-you', 'rival-ipo-race']) {
      const c = THREAD_CARDS.find((x) => x.id === id)!
      expect(c.condition!(makeState())).toBe(true)
      expect(c.condition!(makeState((s) => (s.flags['rivalGone'] = true)))).toBe(false)
    }
  })

  it('founder-burnout: energy at 0, six months without rest from Seed on with energy < 40, or six months of crunch culture', () => {
    expect(fire('founder-burnout', (s) => (s.founder.energy = 0))).toBe(true)
    expect(fire('founder-burnout', (s) => (s.founder.energy = 5))).toBe(false)
    const tired = (stage: 0 | 2, energy: number, restDay?: number) => (s: ReturnType<typeof makeState>) => {
      s.stage = stage
      s.time.day = 400
      s.founder.energy = energy
      if (restDay !== undefined) s.founder.cooldowns.rest = restDay
    }
    expect(fire('founder-burnout', tired(2, 35))).toBe(true)
    expect(fire('founder-burnout', tired(2, 35, 210))).toBe(true)
    expect(fire('founder-burnout', tired(2, 35, 230))).toBe(false)
    expect(fire('founder-burnout', tired(2, 45))).toBe(false)
    expect(fire('founder-burnout', tired(0, 35))).toBe(false)
    expect(fire('founder-burnout', (s) => ((s.time.day = 400), (s.flags['crunchCultureDay'] = 200)))).toBe(true)
    expect(fire('founder-burnout', (s) => ((s.time.day = 300), (s.flags['crunchCultureDay'] = 200)))).toBe(false)
  })
})

describe('teasers', () => {
  it('one per stage, ≤ 6 words', () => {
    expect(Object.keys(TEASERS)).toHaveLength(STAGE_KEYS.length)
    for (const t of Object.values(TEASERS)) {
      expect(t.trim().length).toBeGreaterThan(0)
      expect(wordCount(t)).toBeLessThanOrEqual(6)
    }
  })
})
