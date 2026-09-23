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
  type GameEventKind,
  type GameState,
  type ProjectCategory,
  type RoundPitch,
  type RoundSize,
} from '../src/engine/index'

/**
 * 'careless': a bootstrap-style player who ignores runway when hiring, answers cards at random, picks a random round
 * size and never takes the round window early on a stall (docs/CORE_LOOP.md §10 Faz 3 "dikkatsiz bot iflas %10–25").
 * 'random': chaos (random valid-looking actions), only checked for "no bankruptcy before 4 min".
 */
export type BotKind = Archetype | 'idle' | 'random' | 'careless'

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
  /** Start a round only when valuation ≥ target × this (or runway is short). The window opens at 0.6. */
  roundEagerness: number
  /** Round size (12 / 18 / 24 months of runway ↔ equity). */
  roundSize: RoundSize
  /** Weekly pitch when the numbers are weak ('metrics' is always picked when MoM meets the diligence ask). */
  weakPitch: RoundPitch
  /** Spend on morale furniture / desk upgrades only above this many months of burn in the bank. */
  furnishReserveMonths: number
  useSalesCalls: boolean
  weights: { cash: number; users: number; morale: number; equity: number; reputation: number }
  /** Careless: buys furniture on impulse without looking at the cash (probability per day). */
  impulseBuy?: number
}

const ALL_CAP = [4, 8, 12, 21, 32, 44, 44]

export const BOTS: Record<Archetype, BotConfig> = {
  // Low burn, early revenue, late and few rounds, protects equity.
  bootstrap: {
    kind: 'bootstrap', firstCategory: 'web', extraCategories: [],
    buildMix: { eng: 2, product: 1, marketing: 1 }, growMix: { eng: 2, product: 1, marketing: 3, sales: 2, ops: 1 },
    minRunwayToHire: 5, teamCap: [3, 7, 11, 18, 30, 40, 40], adAggression: 0.25, minLtvCac: 3, price: 1.25,
    roundEagerness: 1, roundSize: 'target', weakPitch: 'story', furnishReserveMonths: 4, useSalesCalls: true,
    weights: { cash: 1, users: 20, morale: 200, equity: 3e6, reputation: 300 },
  },
  // Aggressive hiring, ads, earliest rounds.
  vcRocket: {
    kind: 'vcRocket', firstCategory: 'mobile', extraCategories: ['ai'],
    buildMix: { eng: 3, product: 1, marketing: 2 }, growMix: { eng: 3, product: 1, marketing: 4, sales: 1, ops: 2 },
    minRunwayToHire: 3, teamCap: ALL_CAP, adAggression: 0.6, minLtvCac: 1.5, price: 1,
    roundEagerness: 1, roundSize: 'large', weakPitch: 'coinvestor', furnishReserveMonths: 3, useSalesCalls: false,
    weights: { cash: 1, users: 80, morale: 100, equity: 5e5, reputation: 500 },
  },
  // One project, high price, small senior team, enterprise deals.
  niche: {
    kind: 'niche', firstCategory: 'api', extraCategories: [],
    buildMix: { eng: 2, marketing: 1, sales: 1 }, growMix: { eng: 2, product: 1, marketing: 3, sales: 2, ops: 1 },
    minRunwayToHire: 4, teamCap: [4, 8, 11, 18, 28, 36, 36], adAggression: 0.2, minLtvCac: 3, price: 1.5,
    roundEagerness: 1, roundSize: 'target', weakPitch: 'story', furnishReserveMonths: 3, useSalesCalls: true,
    weights: { cash: 1, users: 30, morale: 150, equity: 2e6, reputation: 400 },
  },
  // Many projects, eng/ops heavy.
  platform: {
    kind: 'platform', firstCategory: 'marketplace', extraCategories: ['api', 'web'],
    buildMix: { eng: 3, product: 1, marketing: 1 }, growMix: { eng: 3, product: 1, marketing: 3, sales: 1, ops: 2 },
    minRunwayToHire: 4, teamCap: ALL_CAP, adAggression: 0.45, minLtvCac: 2.5, price: 1.1,
    roundEagerness: 1, roundSize: 'target', weakPitch: 'story', furnishReserveMonths: 3, useSalesCalls: false,
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
  /** Successful actions by type (founder actions as `founderAction:<kind>`). */
  actionCounts: Record<string, number>
  /** Longest stretch (game days) without a world beat while a round was running. */
  roundGapMaxDays: number
  /** Rounds closed: amount vs the old fixed table, and the size picked. */
  rounds: { stage: number; amount: number; table: number; equity: number }[]
  /**
   * Dead time (docs/CORE_LOOP.md §10): gaps (game days) between consecutive meaningful moments — a world beat the
   * player sees or a meaningful action of the bot — in the first 5 minutes, and over the whole run.
   */
  gaps5: number[]
  gapsAll: number[]
  /** Paydays that could not be paid (bankruptcy clock started). */
  payrollMissed: number
  /** Runway (months, capped at 99 for profitable) on each payday, with the stage it was paid in. */
  paydayRunway: { stage: number; runway: number }[]
  /** Releases (versions + updates) shipped per stage (index = stage). */
  releasesByStage: number[]
  /** Per closed round: metrics part at its ceiling, pitch bonus at its cap, and what decided the amount. */
  roundCloses: { metricsAtCeil: boolean; pitchAtCap: boolean; by: string }[]
  /** Share of all successful actions taken by the most frequent one. */
  topActionShare: number
  /** Cards that ran out their 60 days and applied the default. */
  decisionsDefaulted: number
}

/** How the bot answers decision cards: its weighted best (default), its worst, or always the first option. */
export type DecisionPolicy = 'best' | 'worst' | 'first'

/** World beats the player sees (not their own clicks): the dead-time metric during rounds counts gaps between these. */
const BEAT_KINDS: ReadonlySet<GameEventKind> = new Set<GameEventKind>([
  'roundStarted', 'roundWeek', 'roundClosed', 'payday', 'release', 'decisionShown', 'conceptQueued', 'milestone',
  'goalDone', 'delayedEffect', 'projectLaunched', 'resigned', 'bankruptWarning', 'roundWindow', 'payrollMissed',
])
/** Beats of the dead-time metric: world beats + the founder's own move landing, a hire walking in, a visitor. */
const MOMENT_KINDS: ReadonlySet<GameEventKind> = new Set<GameEventKind>([...BEAT_KINDS, 'founderActionDone', 'hired', 'visitorArrived', 'stageUp'])
/** Bot actions that count as a meaningful player move (not background knob-twiddling like ad/price/assign). */
const MOVE_ACTIONS: ReadonlySet<string> = new Set(['startProject', 'hire', 'placeItem', 'openRing', 'founderAction', 'startRound', 'roundPitch', 'answerDecision', 'openConcept', 'fire', 'upgradeItem'])

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
function housekeeping(c: Ctx, cfg: BotConfig | null, rng?: Rng, policy: DecisionPolicy = 'best'): void {
  const { act, content } = c
  for (let i = 0; i < 5 && c.s.concepts.active; i++) if (!act({ type: 'openConcept', conceptId: c.s.concepts.active.id })) break
  const active = c.s.decisions.active
  const card = active && content.decisions.find((c) => c.id === active.cardId)
  if (card) {
    let best = 0
    if (cfg && policy !== 'first') {
      const sign = policy === 'worst' ? -1 : 1
      card.options.forEach((_, i) => { if (sign * scoreOption(c.s, card, i, cfg) > sign * scoreOption(c.s, card, best, cfg)) best = i })
    } else if (!cfg && rng) best = rng.int(0, card.options.length - 1)
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

function neededDept(s: GameState, cfg: BotConfig, mem?: Record<string, number>): Dept[] {
  const building = s.projects.some((p) => p.maturity < 0.6)
  const mix = building ? cfg.buildMix : cfg.growMix
  const total = Object.values(mix).reduce((a, b) => a + (b ?? 0), 0)
  const team = s.employees.length + 1
  const gap = (d: Dept) => ((mix[d] ?? 0) / total) * team - s.derived.deptCounts[d]
  const order = (Object.keys(mix) as Dept[]).sort((a, b) => gap(b) - gap(a))
  if (s.time.day < (mem?.preferMarketingUntil ?? -1)) return ['marketing', ...order.filter((d) => d !== 'marketing')]
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

const GARAGE_MIN_RUNWAY = 2.5

function hiring(c: Ctx, cfg: BotConfig): void {
  const { act } = c
  const runway = c.s.finance.runway ?? 99
  // Servers overflowing: an engineer is a need, not growth — the soft team cap gives way (up to +50%).
  const overloaded = c.s.derived.capacity < c.s.stats.users * 1.05
  // A valuation stuck below the window (the growth trough) makes a sensible player hire past the plan: +2 per stall.
  const stallBonus = c.mem.progStage === c.s.stage ? 2 * Math.floor((c.s.time.day - (c.mem.bestDay ?? c.s.time.day)) / STALL_DAYS) : 0
  const cap = (cfg.teamCap[c.s.stage] ?? 99) * (overloaded ? 1.5 : 1) + stallBonus
  // The garage is a survival level: the first small team is hired on thin runway (the round is the way out).
  const minRunway = c.s.stage === 0 ? Math.min(cfg.minRunwayToHire, GARAGE_MIN_RUNWAY) : cfg.minRunwayToHire
  if (runway <= minRunway || c.s.employees.length >= cap) return
  const reserve = Math.max(5_000, c.s.finance.burn * 3)
  if (freeDesks(c.s) === 0) {
    const ring = nextLockedRing(c.s.office)
    const cost = c.s.office.rings.find((r) => r.index === ring)?.openCost ?? Infinity
    if (ring !== null && c.s.stats.cash > cost * 2 + reserve) act({ type: 'openRing', ring })
    if (freeDesks(c.s) === 0) return
  }
  // A hire needs a desk item on a free slot (PLAN §4.2).
  const deskFree = (s: GameState) => s.office.slots.some((x) => x.type === 'desk' && x.id !== 'founder' && x.itemId !== undefined && x.occupantId === undefined && s.office.rings.some((r) => r.index === x.ring && r.unlocked))
  if (!deskFree(c.s)) {
    const slot = c.s.office.slots.find((x) => x.type === 'desk' && x.id !== 'founder' && x.itemId === undefined && x.occupantId === undefined && c.s.office.rings.some((r) => r.index === x.ring && r.unlocked))
    const basic = c.content.furniture.filter((f) => f.slotType === 'desk' && f.size === 1 && f.stageUnlock <= c.s.stage && !f.effects.deptBonus).sort((a, b) => a.price - b.price)[0]
    if (slot && basic) act({ type: 'placeItem', itemId: basic.id, slotId: slot.id })
    if (!deskFree(c.s)) return
  }
  const order = neededDept(c.s, cfg, c.mem)
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
  // Growth trough with a full office: swap a non-growth seat for a marketer (organic reach is what moves MoM).
  const stalledDays = c.mem.progStage === s.stage ? s.time.day - (c.mem.bestDay ?? s.time.day) : 0
  if (s.stage <= 2 && freeDesks(s) === 0 && stalledDays >= STALL_DAYS && s.time.day - (c.mem.rebalanceDay ?? -99) >= 30 && s.derived.overload < 0.3) {
    const pool = s.employees.filter((e) => e.dept === 'ops' || (e.dept === 'sales' && !cfg.useSalesCalls) || (e.dept === 'product' && s.projects.every((p) => p.maturity >= 1)))
    const victim = pool.sort((a, b) => a.quality - b.quality)[0]
    if (victim && c.act({ type: 'fire', employeeId: victim.id })) {
      c.mem.rebalanceDay = s.time.day
      c.mem.preferMarketingUntil = s.time.day + 30
      return
    }
  }
  if (freeDesks(s) > 0 || nextLockedRing(s.office) !== null || s.projects.some((p) => p.maturity < 0.6)) return
  if (s.time.day - (c.mem.rebalanceDay ?? -99) < 30) return
  const mix = cfg.growMix
  const total = Object.values(mix).reduce((a, b) => a + (b ?? 0), 0)
  const team = s.employees.length + 1
  const surplus = (d: Dept) => s.derived.deptCounts[d] - ((mix[d] ?? 0) / total) * team
  // Overloaded servers: trade a non-engineer for an engineer.
  const overloaded = s.derived.overload > 0.2
  const worst = (Object.keys(s.derived.deptCounts) as Dept[]).filter((d) => !overloaded || d !== 'eng').sort((a, b) => surplus(b) - surplus(a))[0]!
  // Overloaded servers are worth one swap a month even from a dept at its mix share (the mix is a guide, not a rule).
  if (!overloaded && surplus(worst) < 1.5) return
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
  // Deals saturate within a month (half, then a quarter): a sensible player stops at half.
  if (cfg.useSalesCalls && (c.s.derived.salesCall?.factor ?? 1) >= 0.5 && act({ type: 'founderAction', kind: 'salesCall' })) return
  if (c.s.projects.some((p) => p.maturity < 1) && act({ type: 'founderAction', kind: 'talkToUsers' })) return
  // A sensible player stops once the circle is used up ("tanıdık çevren tükeniyor").
  if (c.s.stage <= 1 && (c.s.derived.findUsers?.factor ?? 1) >= 0.5) act({ type: 'founderAction', kind: 'findUsers' })
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
    // A stalled valuation (no progress for STALL_DAYS) makes the bot accept a thinner LTV/CAC: growth is the way out.
    const stalled = c.mem.progStage === c.s.stage && c.s.time.day - (c.mem.bestDay ?? c.s.time.day) >= STALL_DAYS
    const minLtvCac = cfg.minLtvCac * (stalled ? 0.75 : 1)
    const ok = (c.s.derived.ltvCac ?? 0) >= minLtvCac && (c.s.finance.runway ?? 99) > 6 && c.s.derived.overload < 1
    const t = ok ? Math.round(cfg.adAggression * (c.s.finance.mrr + Math.max(0, c.s.stats.cash) / 24)) : 0
    if (Math.abs(t - c.s.finance.adBudget) > 0.2 * Math.max(1, c.s.finance.adBudget)) act({ type: 'setAdBudget', amount: Math.max(0, t) })
  }
}

/** Days without new progress after which a bot takes the open round window. */
const STALL_DAYS = 60

function fundraise(c: Ctx, cfg: BotConfig, careless = false): void {
  const { act } = c
  const r = c.s.round
  if (r?.active) {
    if (r.pitchDue === undefined) return
    const good = (c.s.derived.round?.pitchOptions?.find((o) => o.pitch === 'metrics')?.delta ?? 0) > 0
    const pitch: RoundPitch = good ? 'metrics' : cfg.weakPitch
    if (!act({ type: 'roundPitch', pitch }) && pitch === 'story') act({ type: 'roundPitch', pitch: 'metrics' })
    return
  }
  // Track the best progress of this stage: a valuation that stopped climbing (the multiple follows 3-month growth)
  // is the "şimdi mi, biraz daha mı?" answer a sensible player gives: now.
  const p = c.s.derived.stageProgress
  if (c.mem.progStage !== c.s.stage || p > (c.mem.bestProg ?? 0) + 0.01) {
    c.mem.progStage = c.s.stage
    c.mem.bestProg = p
    c.mem.bestDay = c.s.time.day
  }
  if (!c.s.derived.canStartRound) return
  const short = (c.s.finance.runway ?? 99) < (careless ? 2 : 6)
  const stalled = !careless && c.s.time.day - (c.mem.bestDay ?? c.s.time.day) >= STALL_DAYS
  if (short || stalled || p >= cfg.roundEagerness) act({ type: 'startRound', size: cfg.roundSize })
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
    case 6: act({ type: 'startRound', size: rng.pick(['small', 'target', 'large'] as const) }) || act({ type: 'roundPitch', pitch: rng.pick(['metrics', 'story', 'coinvestor'] as const) }); break
    case 7: { const r = nextLockedRing(c.s.office); if (r !== null) act({ type: 'openRing', ring: r }); break }
  }
}

/** Careless player: bootstrap's plan without the care (see BotKind). */
const CARELESS: BotConfig = { ...BOTS.bootstrap, kind: 'careless', minRunwayToHire: 0, teamCap: ALL_CAP, furnishReserveMonths: 0, impulseBuy: 0.15 }

export function playBot(
  kind: BotKind,
  seed: number,
  content: EngineContent,
  maxDays = 2700,
  onDay?: (s: GameState) => void,
  policy: DecisionPolicy = 'best',
  overrides: Partial<BotConfig> = {},
): BotRun {
  const base = kind === 'idle' || kind === 'random' ? null : kind === 'careless' ? CARELESS : BOTS[kind]
  const cfg = base ? { ...base, ...overrides } : null
  const careless = kind === 'careless'
  const api = createEngine(content)
  let s = api.createGame({ seed })
  const botRng = new Rng(createRngState(seed * 7919 + 17))
  const stageDays: (number | null)[] = [0, null, null, null, null, null, null]
  let c5 = 0
  let c10 = 0
  const actionCounts: Record<string, number> = {}
  const rounds: BotRun['rounds'] = []
  let lastMoment = 0
  const gaps5: number[] = []
  const gapsAll: number[] = []
  const moment = (day: number) => {
    const g = day - lastMoment
    if (g > 1e-9) {
      gapsAll.push(g)
      if (day <= DAYS_5_MIN) gaps5.push(g)
    }
    lastMoment = Math.max(lastMoment, day)
  }
  const ctx: Ctx = {
    get s() { return s },
    act: (a: Action): boolean => {
      const r = api.applyAction(s, a)
      if (r.ok) {
        s = r.state
        const key = a.type === 'founderAction' ? `founderAction:${a.kind}` : a.type
        actionCounts[key] = (actionCounts[key] ?? 0) + 1
        if (MOVE_ACTIONS.has(a.type)) moment(s.time.day)
      }
      return r.ok
    },
    content,
    mem: {},
  }

  if (cfg) ctx.act({ type: 'startProject', category: cfg.firstCategory })
  let inRound = false
  let lastBeat = 0
  let roundGapMax = 0
  let seenId = 0
  let payrollMissed = 0
  let defaulted = 0

  const paydayRunway: BotRun['paydayRunway'] = []
  const releasesByStage = [0, 0, 0, 0, 0, 0, 0]
  const roundCloses: BotRun['roundCloses'] = []

  while (!s.gameOver && s.time.day < maxDays) {
    if (cfg && careless) {
      // Random card answers (no weighing), otherwise the bootstrap routine without runway care.
      housekeeping(ctx, null, botRng)
      if (!c10Skip(botRng)) {
        // Impulse buy: a random item it can pay for right now, on a random open slot, reserve or not.
        if (botRng.next() < (cfg.impulseBuy ?? 0)) {
          const item = botRng.pick(content.furniture.filter((f) => f.stageUnlock <= s.stage && f.price <= s.stats.cash))
          const open = new Set(s.office.rings.filter((r) => r.unlocked).map((r) => r.index))
          const slots = s.office.slots.filter((x) => x.type === item?.slotType && !x.itemId && x.spanOf === undefined && x.id !== 'founder' && open.has(x.ring))
          if (item && slots.length) ctx.act({ type: 'placeItem', itemId: item.id, slotId: botRng.pick(slots).id })
        }
        furnish(ctx, cfg)
        hiring(ctx, cfg)
        growth(ctx, cfg)
        founder(ctx, cfg)
        fundraise(ctx, { ...cfg, roundSize: botRng.pick(['small', 'target', 'large'] as const) }, true)
      }
    } else if (cfg) {
      housekeeping(ctx, cfg, undefined, policy)
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
    const before = s
    s = api.step(s, 1)
    for (let st = prev + 1; st <= s.stage; st++) stageDays[st] = Math.round(s.time.day)
    // Dead time inside a round: gap between world beats while the round runs.
    for (const e of s.events) {
      if (e.id <= seenId) continue
      if (MOMENT_KINDS.has(e.kind)) moment(e.day)
      if (e.kind === 'payrollMissed') payrollMissed++
      if (e.kind === 'decisionDefaulted') defaulted++
      if (e.kind === 'payday') paydayRunway.push({ stage: s.stage, runway: Math.min(99, s.finance.lastReceipt?.runwayAfter ?? 99) })
      if (e.kind === 'release') releasesByStage[s.stage] = (releasesByStage[s.stage] ?? 0) + 1
      if (e.kind === 'roundClosed' && before.round) {
        const rv = before.derived.round
        roundCloses.push({
          metricsAtCeil: rv ? rv.factor - rv.pitchBonus >= balance.ROUND_OFFER_CEIL - 1e-6 : false,
          pitchAtCap: (before.round.pitchBonus ?? 0) >= balance.PITCH_BONUS_CAP - 1e-6,
          by: before.round.amountBy ?? 'floor',
        })
      }
      if (!BEAT_KINDS.has(e.kind)) continue
      if (e.kind === 'roundClosed' && before.round) {
        rounds.push({ stage: before.round.targetStage, amount: e.value ?? 0, table: balance.ROUND_AMOUNT[before.round.targetStage] ?? 0, equity: before.round.offer.equity })
      }
      if (inRound || e.kind === 'roundStarted') {
        if (inRound) roundGapMax = Math.max(roundGapMax, e.day - lastBeat)
        lastBeat = e.day
      }
      if (e.kind === 'roundStarted') inRound = true
      if (e.kind === 'roundClosed') inRound = false
    }
    seenId = s.events[s.events.length - 1]?.id ?? seenId
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
    actionCounts,
    roundGapMaxDays: roundGapMax,
    rounds,
    gaps5,
    gapsAll,
    payrollMissed,
    decisionsDefaulted: defaulted,
    paydayRunway,
    releasesByStage,
    roundCloses,
    topActionShare: topShare(actionCounts),
  }
}

function topShare(counts: Record<string, number>): number {
  const vals = Object.values(counts)
  const total = vals.reduce((a, b) => a + b, 0)
  return total > 0 ? Math.max(...vals) / total : 0
}

/** The careless player skips 30% of days entirely. */
function c10Skip(rng: Rng): boolean {
  return rng.next() < 0.3
}

