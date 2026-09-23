// Archetype bots for the balance simulator (PLAN §8.3). They only use createGame/applyAction/step, like a player.
import type { DecisionCard, FurnitureItem } from '../src/content/index'
import {
  FOUNDER_ACTIONS,
  PROJECT_CATEGORIES,
  Rng,
  balance,
  createEngine,
  createRngState,
  nextLockedRing,
  type Action,
  type Archetype,
  type Dept,
  type EngineContent,
  type GameState,
  type ProjectCategory,
} from '../src/engine/index'

export type BotKind = Archetype | 'idle' | 'random'

export interface BotConfig {
  kind: BotKind
  firstCategory: ProjectCategory
  /** Extra projects, started from Seed on once current ones are mature. */
  extraCategories: ProjectCategory[]
  /** Team mix while products are being built / once they are mature. */
  buildMix: Partial<Record<Dept, number>>
  growMix: Partial<Record<Dept, number>>
  /** Hire only while runway (months) is above this; profitable = always. */
  minRunwayToHire: number
  /** Soft team cap per stage (index = stage). */
  teamCap: readonly number[]
  /** Monthly ad budget as a share of (MRR + cash/24), when LTV:CAC allows. */
  adAggression: number
  minLtvCac: number
  price: number
  /** Start a round only when valuation ≥ target × this (or runway is short). */
  roundEagerness: number
  /** Spend on morale furniture / desk upgrades only above this many months of burn in the bank. */
  furnishReserveMonths: number
  useSalesCalls: boolean
  weights: { cash: number; users: number; morale: number; equity: number; reputation: number }
}

const ALL_CAP = [4, 8, 12, 21, 28, 36, 36]

export const BOTS: Record<Archetype, BotConfig> = {
  // Low burn, early revenue, late and few rounds, protects equity.
  bootstrap: {
    kind: 'bootstrap', firstCategory: 'web', extraCategories: [],
    buildMix: { eng: 2, product: 1, marketing: 1 }, growMix: { eng: 2, product: 1, marketing: 3, sales: 2, ops: 1 },
    minRunwayToHire: 9, teamCap: [3, 7, 11, 18, 25, 32, 32], adAggression: 0.15, minLtvCac: 3, price: 1.25,
    roundEagerness: 1.15, furnishReserveMonths: 4, useSalesCalls: true,
    weights: { cash: 1, users: 20, morale: 200, equity: 3e6, reputation: 300 },
  },
  // Aggressive hiring, ads, earliest rounds.
  vcRocket: {
    kind: 'vcRocket', firstCategory: 'mobile', extraCategories: ['ai'],
    buildMix: { eng: 3, product: 1, marketing: 2 }, growMix: { eng: 3, product: 1, marketing: 4, sales: 1, ops: 2 },
    minRunwayToHire: 4, teamCap: ALL_CAP, adAggression: 0.6, minLtvCac: 1.5, price: 1,
    roundEagerness: 1, furnishReserveMonths: 3, useSalesCalls: false,
    weights: { cash: 1, users: 80, morale: 100, equity: 5e5, reputation: 500 },
  },
  // One project, high price, small senior team, enterprise deals.
  niche: {
    kind: 'niche', firstCategory: 'api', extraCategories: [],
    buildMix: { eng: 2, product: 1, sales: 1 }, growMix: { eng: 2, product: 1, marketing: 3, sales: 2, ops: 1 },
    minRunwayToHire: 6, teamCap: [4, 8, 11, 18, 24, 30, 30], adAggression: 0.2, minLtvCac: 3, price: 1.5,
    roundEagerness: 1, furnishReserveMonths: 3, useSalesCalls: true,
    weights: { cash: 1, users: 30, morale: 150, equity: 2e6, reputation: 400 },
  },
  // Many projects, eng/ops heavy.
  platform: {
    kind: 'platform', firstCategory: 'marketplace', extraCategories: ['api', 'web'],
    buildMix: { eng: 3, product: 1, marketing: 1 }, growMix: { eng: 3, product: 1, marketing: 3, sales: 1, ops: 2 },
    minRunwayToHire: 5, teamCap: ALL_CAP, adAggression: 0.35, minLtvCac: 2.5, price: 1.1,
    roundEagerness: 1, furnishReserveMonths: 3, useSalesCalls: false,
    weights: { cash: 1, users: 50, morale: 150, equity: 1e6, reputation: 300 },
  },
}

export interface BotRun {
  kind: BotKind
  seed: number
  /** Day each stage was reached (index = stage). */
  stageDays: (number | null)[]
  end: 'bankrupt' | 'teamLost' | 'unicorn' | 'timeout'
  endDay: number
  conceptsBy5Min: number
  conceptsBy10Min: number
  finalValuation: number
  equity: number
  peakTeam: number
}

/** 1x: 1 day = 2 s → 5 min = 150 days, 10 min = 300 days. */
export const DAYS_5_MIN = 150
export const DAYS_10_MIN = 300

type Ctx = { s: GameState; act: (a: Action) => boolean; content: EngineContent; mem: Record<string, number> }

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

/** Concepts, decision cards and resignation windows: the "answer the bubbles" part of play. */
function housekeeping(c: Ctx, cfg: BotConfig | null, rng?: Rng): void {
  const { act, content } = c
  for (let i = 0; i < 5 && c.s.concepts.active; i++) if (!act({ type: 'openConcept', conceptId: c.s.concepts.active.id })) break
  const active = c.s.decisions.active
  const card = active && content.decisions.find((c) => c.id === active.cardId)
  if (card) {
    let best = 0
    if (cfg) card.options.forEach((_, i) => { if (scoreOption(c.s, card, i, cfg) > scoreOption(c.s, card, best, cfg)) best = i })
    else if (rng) best = rng.int(0, card.options.length - 1)
    act({ type: 'answerDecision', cardId: card.id, optionIndex: best })
  }
  for (const e of c.s.employees) {
    if (e.status === 'leaving') act({ type: 'respondResignation', employeeId: e.id, response: 'talk' }) || act({ type: 'respondResignation', employeeId: e.id, response: 'raise' })
  }
}

function freeDesks(s: GameState): number {
  const open = new Set(s.office.rings.filter((r) => r.unlocked).map((r) => r.index))
  return s.office.slots.filter((x) => x.type === 'desk' && x.id !== 'founder' && open.has(x.ring) && x.occupantId === undefined).length
}

function neededDept(s: GameState, cfg: BotConfig): Dept[] {
  const building = s.projects.some((p) => p.maturity < 0.6)
  const mix = building ? cfg.buildMix : cfg.growMix
  const total = Object.values(mix).reduce((a, b) => a + (b ?? 0), 0)
  const team = s.employees.length + 1
  const gap = (d: Dept) => ((mix[d] ?? 0) / total) * team - s.derived.deptCounts[d]
  const order = (Object.keys(mix) as Dept[]).sort((a, b) => gap(b) - gap(a))
  // Capacity first: users near the server limit need engineers.
  if (s.derived.capacity < s.stats.users * 1.15) return ['eng', ...order.filter((d) => d !== 'eng')]
  return order
}

function affordable(s: GameState, reserve: number, price: number): boolean {
  return s.stats.cash > reserve + price
}

/** Desks, desk upgrades, common-area auras and rooms. */
function furnish(c: Ctx, cfg: BotConfig): void {
  const { act, content } = c
  const reserve = Math.max(5_000, c.s.finance.burn * 3)
  const rich = Math.max(10_000, c.s.finance.burn * cfg.furnishReserveMonths)
  const open = new Set(c.s.office.rings.filter((r) => r.unlocked).map((r) => r.index))
  const avail = (f: FurnitureItem) => f.stageUnlock <= c.s.stage
  const desks = content.furniture.filter((f) => f.slotType === 'desk' && f.size === 1 && avail(f) && !f.effects.deptBonus).sort((a, b) => a.price - b.price)
  const basic = desks[0]
  for (const slot of c.s.office.slots) {
    if (!open.has(slot.ring) || slot.id === 'founder') continue
    if (slot.type === 'desk' && !slot.itemId && basic && affordable(c.s, reserve, basic.price)) act({ type: 'placeItem', itemId: basic.id, slotId: slot.id })
  }
  // Upgrade occupied desks when cash is comfortable.
  for (const slot of c.s.office.slots) {
    if (slot.type !== 'desk' || !slot.itemId || slot.occupantId === undefined) continue
    const cur = content.furniture.find((f) => f.id === slot.itemId)
    const next = cur?.upgradesTo ? content.furniture.find((f) => f.id === cur.upgradesTo) : undefined
    if (next && avail(next) && affordable(c.s, rich, next.price)) act({ type: 'upgradeItem', slotId: slot.id, toItemId: next.id })
  }
  // Common areas: best affordable aura.
  const commons = content.furniture.filter((f) => f.slotType === 'common' && avail(f)).sort((a, b) => (b.effects.moraleAura ?? 0) - (a.effects.moraleAura ?? 0))
  for (const slot of c.s.office.slots) {
    if (slot.type !== 'common' || slot.itemId || !open.has(slot.ring)) continue
    const item = commons.find((f) => affordable(c.s, rich, f.price))
    if (item) act({ type: 'placeItem', itemId: item.id, slotId: slot.id })
  }
  // Rooms: meeting room once the team passes 6, then the rest by priority.
  const want = [
    c.s.employees.length > 5 ? 'meeting-room' : '',
    'bookshelf',
    cfg.useSalesCalls || cfg.growMix.sales ? 'phone-booth' : '',
    'server-room',
    'training-room',
    'studio',
    'rest-room',
  ].filter(Boolean)
  const placed = new Set(c.s.office.slots.map((x) => x.itemId).filter(Boolean))
  for (const id of want) {
    if (placed.has(id)) continue
    const item = content.furniture.find((f) => f.id === id)
    if (!item || !avail(item) || !affordable(c.s, id === 'meeting-room' ? reserve : rich, item.price)) continue
    const slot = c.s.office.slots.find((x) => x.type === 'room' && !x.itemId && x.spanOf === undefined && open.has(x.ring))
    if (!slot) break
    if (act({ type: 'placeItem', itemId: id, slotId: slot.id })) placed.add(id)
  }
  // Special slots (Series C).
  for (const slot of c.s.office.slots) {
    if (slot.type !== 'special' || slot.itemId || !open.has(slot.ring)) continue
    const item = content.furniture
      .filter((f) => f.slotType === 'special' && avail(f) && !placed.has(f.id) && affordable(c.s, rich * 2, f.price))
      .sort((a, b) => a.price - b.price)[0]
    if (item && act({ type: 'placeItem', itemId: item.id, slotId: slot.id })) placed.add(item.id)
  }
}

function hiring(c: Ctx, cfg: BotConfig): void {
  const { act } = c
  const runway = c.s.finance.runway ?? 99
  if (runway <= cfg.minRunwayToHire || c.s.employees.length >= (cfg.teamCap[c.s.stage] ?? 99)) return
  const reserve = Math.max(5_000, c.s.finance.burn * 3)
  if (freeDesks(c.s) === 0) {
    const ring = nextLockedRing(c.s.office)
    const cost = c.s.office.rings.find((r) => r.index === ring)?.openCost ?? Infinity
    if (ring !== null && c.s.stats.cash > cost * 2 + reserve) act({ type: 'openRing', ring })
    if (freeDesks(c.s) === 0) return
  }
  const order = neededDept(c.s, cfg)
  const want = order[0]!
  const pickFor = (d: Dept) => c.s.candidates.filter((c) => c.dept === d).sort((a, b) => b.quality - a.quality)[0]
  let pick = pickFor(want)
  if (!pick && c.s.stats.cash > reserve * 2) {
    act({ type: 'refreshCandidates' })
    pick = pickFor(want)
  }
  pick ??= order.slice(1, 3).map(pickFor).find((c) => c)
  if (pick) act({ type: 'hire', candidateId: pick.id })
}

/** Office full and products built: swap one surplus builder for a growth hire (at most monthly). */
function rebalance(c: Ctx, cfg: BotConfig): void {
  const s = c.s
  if (freeDesks(s) > 0 || nextLockedRing(s.office) !== null || s.projects.some((p) => p.maturity < 0.6)) return
  if (s.time.day - (c.mem.rebalanceDay ?? -99) < 30) return
  const mix = cfg.growMix
  const total = Object.values(mix).reduce((a, b) => a + (b ?? 0), 0)
  const team = s.employees.length + 1
  const surplus = (d: Dept) => s.derived.deptCounts[d] - ((mix[d] ?? 0) / total) * team
  // Overloaded servers: trade a non-engineer for an engineer.
  const overloaded = s.derived.overload > 0.5
  const worst = (Object.keys(s.derived.deptCounts) as Dept[]).filter((d) => !overloaded || d !== 'eng').sort((a, b) => surplus(b) - surplus(a))[0]!
  if (surplus(worst) < (overloaded ? 0 : 1.5)) return
  if (worst === 'eng' && s.derived.capacity - balance.CAPACITY_PER_ENG < s.stats.users * 1.2) return
  const victim = s.employees.filter((e) => e.dept === worst).sort((a, b) => a.quality - b.quality)[0]
  if (victim && c.act({ type: 'fire', employeeId: victim.id })) c.mem.rebalanceDay = s.time.day
}

function founder(c: Ctx, cfg: BotConfig): void {
  const { act } = c
  if (c.s.founder.currentAction) return
  if (c.s.founder.energy < 25) { act({ type: 'founderAction', kind: 'rest' }); return }
  if (c.s.round?.active && act({ type: 'founderAction', kind: 'investorCoffee' })) return
  if (c.s.stats.morale < 50 && act({ type: 'founderAction', kind: 'motivateTeam' })) return
  if (cfg.useSalesCalls && act({ type: 'founderAction', kind: 'salesCall' })) return
  if (c.s.projects.some((p) => p.maturity < 1) && act({ type: 'founderAction', kind: 'talkToUsers' })) return
  if (c.s.stage <= 1) act({ type: 'founderAction', kind: 'findUsers' })
}

function growth(c: Ctx, cfg: BotConfig): void {
  const { act } = c
  if (c.s.stage >= 2 && cfg.extraCategories.length && c.s.projects.length < 1 + cfg.extraCategories.length && c.s.projects.every((p) => p.maturity > 0.6)) {
    act({ type: 'startProject', category: cfg.extraCategories[c.s.projects.length - 1]! })
  }
  // Idle builders (finished projects) move to the least mature project.
  const target = [...c.s.projects].filter((p) => p.maturity < 1).sort((a, b) => a.maturity - b.maturity)[0]
  if (target) {
    for (const e of c.s.employees) {
      if ((e.dept === 'eng' || e.dept === 'product') && (e.projectId === undefined || (c.s.projects.find((p) => p.id === e.projectId)?.maturity ?? 1) >= 1)) {
        act({ type: 'assign', employeeId: e.id, projectId: target.id })
      }
    }
  }
  if (c.s.unlockedTools.includes('priceControl') && c.s.finance.priceMultiplier !== cfg.price) act({ type: 'setPrice', multiplier: cfg.price })
  if (c.s.unlockedTools.includes('adBudget')) {
    const ok = (c.s.derived.ltvCac ?? 0) >= cfg.minLtvCac && (c.s.finance.runway ?? 99) > 6 && c.s.derived.overload < 1
    const t = ok ? Math.round(cfg.adAggression * (c.s.finance.mrr + Math.max(0, c.s.stats.cash) / 24)) : 0
    if (Math.abs(t - c.s.finance.adBudget) > 0.2 * Math.max(1, c.s.finance.adBudget)) act({ type: 'setAdBudget', amount: Math.max(0, t) })
  }
}

function fundraise(c: Ctx, cfg: BotConfig): void {
  const { act } = c
  if (!c.s.derived.canStartRound) return
  const short = (c.s.finance.runway ?? 99) < 6
  if (short || c.s.derived.stageProgress >= cfg.roundEagerness) act({ type: 'startRound' })
}

/** Careless player: a random valid-looking action on some days, random card answers, ignores bubbles half the time. */
function randomTurn(c: Ctx, rng: Rng): void {
  const { act, content } = c
  if (rng.next() < 0.5) housekeeping(c, null, rng)
  if (rng.next() > 0.3) return
  const roll = rng.int(0, 7)
  const slot = rng.pick(c.s.office.slots)
  switch (roll) {
    case 0: if (c.s.candidates.length) act({ type: 'hire', candidateId: rng.pick(c.s.candidates).id }); break
    case 1: { const f = rng.pick(content.furniture); if (slot) act({ type: 'placeItem', itemId: f.id, slotId: slot.id }); break }
    case 2: if (rng.next() < 0.3) act({ type: 'startProject', category: rng.pick(PROJECT_CATEGORIES) }); break
    case 3: act({ type: 'founderAction', kind: rng.pick(FOUNDER_ACTIONS) }); break
    case 4: act({ type: 'setAdBudget', amount: rng.int(0, 5_000) }); break
    case 5: act({ type: 'setPrice', multiplier: rng.range(0.7, 1.6) }); break
    case 6: act({ type: 'startRound' }); break
    case 7: { const r = nextLockedRing(c.s.office); if (r !== null) act({ type: 'openRing', ring: r }); break }
  }
}

export function playBot(kind: BotKind, seed: number, content: EngineContent, maxDays = 2700, onDay?: (s: GameState) => void): BotRun {
  const cfg = kind === 'idle' || kind === 'random' ? null : BOTS[kind]
  const api = createEngine(content)
  let s = api.createGame({ seed })
  const botRng = new Rng(createRngState(seed * 7919 + 17))
  const stageDays: (number | null)[] = [0, null, null, null, null, null, null]
  let c5 = 0
  let c10 = 0
  const ctx: Ctx = {
    get s() { return s },
    act: (a: Action): boolean => {
      const r = api.applyAction(s, a)
      if (r.ok) s = r.state
      return r.ok
    },
    content,
    mem: {},
  }

  if (cfg) ctx.act({ type: 'startProject', category: cfg.firstCategory })

  while (!s.gameOver && s.time.day < maxDays) {
    if (cfg) {
      housekeeping(ctx, cfg)
      furnish(ctx, cfg)
      rebalance(ctx, cfg)
      hiring(ctx, cfg)
      growth(ctx, cfg)
      founder(ctx, cfg)
      fundraise(ctx, cfg)
    } else if (kind === 'random') {
      randomTurn(ctx, botRng)
    }
    const prev = s.stage
    s = api.step(s, 1)
    for (let st = prev + 1; st <= s.stage; st++) stageDays[st] = Math.round(s.time.day)
    if (s.time.day <= DAYS_5_MIN) c5 = s.concepts.learned.length
    if (s.time.day <= DAYS_10_MIN) c10 = s.concepts.learned.length
    onDay?.(s)
  }
  return {
    kind,
    seed,
    stageDays,
    end: s.gameOver ? s.gameOver.kind : 'timeout',
    endDay: Math.round(s.time.day),
    conceptsBy5Min: c5,
    conceptsBy10Min: c10,
    finalValuation: s.finance.valuation,
    equity: s.stats.equity,
    peakTeam: s.counters.peakTeam ?? 0,
  }
}

