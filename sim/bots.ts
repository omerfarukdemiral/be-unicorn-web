// Archetype bots for the balance simulator (PLAN §8.3). They only use step/applyAction, like a player.
import type { DecisionCard } from '../src/content/index'
import { createEngine, nextLockedRing, type Action, type Archetype, type Dept, type EngineApi, type EngineContent, type GameState, type ProjectCategory } from '../src/engine/index'

export interface BotConfig {
  archetype: Archetype
  firstCategory: ProjectCategory
  extraCategories: ProjectCategory[]
  deptMix: Partial<Record<Dept, number>>
  minRunwayToHire: number
  /** Share of monthly MRR (+ cash/24) spent on ads once unlocked. */
  adAggression: number
  price: number
  /** Card option scoring weights. */
  weights: { cash: number; users: number; morale: number; equity: number; reputation: number }
}

export const BOTS: Record<Archetype, BotConfig> = {
  bootstrap: {
    archetype: 'bootstrap', firstCategory: 'web', extraCategories: [], deptMix: { eng: 3, product: 1, marketing: 1, sales: 1, ops: 1 },
    minRunwayToHire: 8, adAggression: 0.1, price: 1.2, weights: { cash: 1, users: 20, morale: 200, equity: 3e6, reputation: 300 },
  },
  vcRocket: {
    archetype: 'vcRocket', firstCategory: 'mobile', extraCategories: ['ai'], deptMix: { eng: 3, product: 1, marketing: 2, sales: 1, ops: 1 },
    minRunwayToHire: 4, adAggression: 0.6, price: 1, weights: { cash: 1, users: 80, morale: 100, equity: 5e5, reputation: 500 },
  },
  niche: {
    archetype: 'niche', firstCategory: 'api', extraCategories: [], deptMix: { eng: 2, product: 1, marketing: 1, sales: 2, ops: 1 },
    minRunwayToHire: 6, adAggression: 0.15, price: 1.4, weights: { cash: 1, users: 30, morale: 150, equity: 2e6, reputation: 400 },
  },
  platform: {
    archetype: 'platform', firstCategory: 'marketplace', extraCategories: ['api', 'web'], deptMix: { eng: 4, product: 2, marketing: 1, sales: 1, ops: 1 },
    minRunwayToHire: 5, adAggression: 0.3, price: 1.1, weights: { cash: 1, users: 50, morale: 150, equity: 1e6, reputation: 300 },
  },
}

export interface BotRun {
  archetype: Archetype
  seed: number
  stageDays: (number | null)[]
  end: 'bankrupt' | 'teamLost' | 'unicorn' | 'timeout'
  endDay: number
  conceptsBy10Min: number
  conceptsBy5Min: number
  finalValuation: number
  equity: number
}

function scoreOption(s: GameState, card: DecisionCard, i: number, cfg: BotConfig): number {
  const fx = card.options[i]!.effects
  const w = cfg.weights
  return (
    w.cash * ((fx.cash ?? 0) + (fx.cashPercent ?? 0) * Math.max(0, s.stats.cash)) +
    w.users * ((fx.users ?? 0) + (fx.usersPercent ?? 0) * s.stats.users) +
    w.morale * (fx.morale ?? 0) +
    w.equity * (fx.equity ?? 0) +
    w.reputation * (fx.reputation ?? 0)
  )
}

function neededDept(s: GameState, cfg: BotConfig): Dept[] {
  const total = Object.values(cfg.deptMix).reduce((a, b) => a + (b ?? 0), 0)
  const team = Math.max(1, s.employees.length + 1)
  return (Object.keys(cfg.deptMix) as Dept[]).sort((a, b) => {
    const gap = (d: Dept) => ((cfg.deptMix[d] ?? 0) / total) * team - s.derived.deptCounts[d]
    return gap(b) - gap(a)
  })
}

export function playBot(cfg: BotConfig, seed: number, content: EngineContent, maxDays = 2700): BotRun {
  const api: EngineApi = createEngine(content)
  let s = api.createGame({ seed })
  const stageDays: (number | null)[] = [0, null, null, null, null, null, null]
  let conceptsBy10Min = 0
  let conceptsBy5Min = 0
  const act = (a: Action): boolean => {
    const r = api.applyAction(s, a)
    if (r.ok) s = r.state
    return r.ok
  }
  const desk = content.furniture.find((f) => f.slotType === 'desk' && f.tier === 1 && f.stageUnlock === 0)
  const meeting = content.furniture.find((f) => f.effects.coordinationFix)

  act({ type: 'startProject', category: cfg.firstCategory })

  while (!s.gameOver && s.time.day < maxDays) {
    if (s.concepts.active) act({ type: 'openConcept', conceptId: s.concepts.active.id })
    const active = s.decisions.active
    const card = active && content.decisions.find((c) => c.id === active.cardId)
    if (card) {
      let best = 0
      card.options.forEach((_, i) => {
        if (scoreOption(s, card, i, cfg) > scoreOption(s, card, best, cfg)) best = i
      })
      act({ type: 'answerDecision', cardId: card.id, optionIndex: best })
    }
    for (const e of s.employees) {
      if (e.status === 'leaving') act({ type: 'respondResignation', employeeId: e.id, response: 'talk' }) || act({ type: 'respondResignation', employeeId: e.id, response: 'raise' })
    }

    const runway = s.finance.runway ?? 99
    const reserve = Math.max(5_000, s.finance.burn * 3)
    // Furnish empty desks.
    if (desk) {
      for (const slot of s.office.slots) {
        if (slot.type !== 'desk' || slot.id === 'founder' || slot.itemId || s.stats.cash < reserve + desk.price) continue
        act({ type: 'placeItem', itemId: desk.id, slotId: slot.id })
      }
    }
    if (meeting && s.employees.length > 6 && s.derived.coordination < 1 && s.stats.cash > reserve + meeting.price) {
      const slot = s.office.slots.find((x) => x.type === 'room' && !x.itemId && s.office.rings.find((r) => r.index === x.ring)?.unlocked)
      if (slot) act({ type: 'placeItem', itemId: meeting.id, slotId: slot.id })
    }
    // Hire when runway allows; open the next ring when desks run out.
    if (runway > cfg.minRunwayToHire && s.candidates.length) {
      const order = neededDept(s, cfg)
      const pick = order.map((d) => s.candidates.filter((c) => c.dept === d).sort((a, b) => b.quality - a.quality)[0]).find((c) => c)
      if (pick && !act({ type: 'hire', candidateId: pick.id })) {
        const ring = nextLockedRing(s.office)
        const cost = s.office.rings.find((r) => r.index === ring)?.openCost ?? Infinity
        if (ring !== null && s.stats.cash > cost * 2 + reserve) act({ type: 'openRing', ring })
      }
    }
    // Extra products.
    if (s.stage >= 2 && cfg.extraCategories.length && s.projects.length < 1 + cfg.extraCategories.length && s.projects.every((p) => p.maturity > 0.5)) {
      act({ type: 'startProject', category: cfg.extraCategories[s.projects.length - 1]! })
    }
    // Growth tools.
    if (s.unlockedTools.includes('priceControl') && s.finance.priceMultiplier !== cfg.price) act({ type: 'setPrice', multiplier: cfg.price })
    if (s.unlockedTools.includes('adBudget')) {
      const good = (s.derived.ltvCac ?? 0) > 2 || cfg.archetype === 'vcRocket'
      const target = good ? Math.round(cfg.adAggression * (s.finance.mrr + Math.max(0, s.stats.cash) / 24)) : 0
      if (Math.abs(target - s.finance.adBudget) > 0.2 * Math.max(1, s.finance.adBudget)) act({ type: 'setAdBudget', amount: Math.max(0, target) })
    }
    // Founder.
    if (!s.founder.currentAction) {
      if (s.founder.energy < 20) act({ type: 'founderAction', kind: 'rest' })
      else if (s.round?.active && act({ type: 'founderAction', kind: 'investorCoffee' })) void 0
      else if (s.stats.morale < 50 && act({ type: 'founderAction', kind: 'motivateTeam' })) void 0
      else if (cfg.archetype === 'niche' && act({ type: 'founderAction', kind: 'salesCall' })) void 0
      else act({ type: 'founderAction', kind: 'findUsers' }) || act({ type: 'founderAction', kind: 'talkToUsers' })
    }
    if (s.derived.canStartRound) act({ type: 'startRound' })

    const prevStage = s.stage
    s = api.step(s, 1)
    if (s.stage > prevStage) stageDays[s.stage] = Math.round(s.time.day)
    if (s.time.day <= 150) conceptsBy5Min = s.concepts.triggered.length
    if (s.time.day <= 300) conceptsBy10Min = s.concepts.triggered.length
  }
  return {
    archetype: cfg.archetype,
    seed,
    stageDays,
    end: s.gameOver ? s.gameOver.kind : 'timeout',
    endDay: Math.round(s.time.day),
    conceptsBy5Min,
    conceptsBy10Min,
    finalValuation: s.finance.valuation,
    equity: s.stats.equity,
  }
}
