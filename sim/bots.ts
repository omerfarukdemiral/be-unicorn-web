// Archetype bots for the balance simulator (PLAN §8.3). They only use createGame/applyAction/step, like a player.
import type { DecisionCard, FurnitureItem } from '../src/content/index'
import {
  FOUNDER_ACTIONS,
  PROJECT_CATEGORIES,
  Rng,
  balance,
  createEngine,
  createRngState,
  nextCrisis,
  nextLockedRing,
  serialize,
  type Action,
  type Archetype,
  type Dept,
  type EngineContent,
  type GameEventKind,
  type GameState,
  type NextCrisis,
  type ProjectCategory,
  type RoundPitch,
  type RoundSize,
} from '../src/engine/index'

/**
 * 'careless': a bootstrap-style player who ignores runway when hiring, answers cards at random, picks a random round
 * size and never takes the round window early on a stall (docs/CORE_LOOP.md §10 Faz 3 "dikkatsiz bot iflas %10–25").
 * 'random': chaos (random valid-looking actions), only checked for "no bankruptcy before 4 min".
 * GAMEPLAY V2 §15 (autopilot and difficulty probes, see V2_BOTS): 'coaster', 'idleAfterProfit', 'greedyGood',
 * 'burner', 'frugal'.
 */
export type BotKind = Archetype | 'idle' | 'random' | 'careless' | V2BotKind
export type V2BotKind = 'coaster' | 'idleAfterProfit' | 'greedyGood' | 'burner' | 'frugal'
export const V2_BOT_KINDS: readonly V2BotKind[] = ['coaster', 'idleAfterProfit', 'greedyGood', 'burner', 'frugal']

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
  /** Round size (8 / 12 / 16 months of runway ↔ equity). */
  roundSize: RoundSize
  /** Weekly pitch when the numbers are weak ('metrics' is always picked when MoM meets the diligence ask). */
  weakPitch: RoundPitch
  /** Spend on morale furniture / desk upgrades only above this many months of burn in the bank. */
  furnishReserveMonths: number
  useSalesCalls: boolean
  weights: { cash: number; users: number; morale: number; equity: number; reputation: number }
  /** Careless: buys furniture on impulse without looking at the cash (probability per day). */
  impulseBuy?: number
  /**
   * Once profitable (net > 0 with revenue): 'coast' only answers bubbles and doubles the ad budget every
   * COAST_AD_EVERY_DAYS; 'idle' stops acting altogether (GAMEPLAY V2 §15 autopilot probes).
   */
  afterProfit?: 'coast' | 'idle'
  /** "Careless burner" (§4.2 kabul d): spends on ads without looking at cash or runway (only the paid peak caps it). */
  ignoreRunway?: boolean
  /**
   * GAMEPLAY V2 §5.1 preparation mode (default on): from the "?" on the horizon no hires, ads × 0.5, a rent × 3 cash
   * reserve on furniture; once revealed, per kind (lease-hike: the reserve stays; cac-war: ads off; key-account-renewal:
   * the SLA investment on its card; winter: no round into it unless runway < 4); a storm's churn does not cut its ads.
   * careless / greedyGood: off.
   */
  prepareCrisis?: boolean
}

const ALL_CAP = [4, 8, 12, 21, 32, 44, 44]

/*
 * GAMEPLAY V2 §4.3 (B2): CAC now carries spend and market saturation, so the LTV:CAC bars are lower than before
 * (bootstrap / niche 3 → 2, vcRocket 1.5, platform 2.5 → 1.5), and vcRocket / platform keep two sellers in their growth
 * mix: with the paid channel saturating, ARPU (sales) is what carries Series C.
 */

export const BOTS: Record<Archetype, BotConfig> = {
  // Low burn, early revenue, late and few rounds, protects equity.
  bootstrap: {
    kind: 'bootstrap', firstCategory: 'web', extraCategories: [],
    buildMix: { eng: 2, product: 1, marketing: 1 }, growMix: { eng: 2, product: 1, marketing: 3, sales: 2, ops: 1 },
    minRunwayToHire: 5, teamCap: [3, 7, 11, 18, 30, 40, 40], adAggression: 0.25, minLtvCac: 2, price: 1.25,
    roundEagerness: 1, roundSize: 'target', weakPitch: 'story', furnishReserveMonths: 4, useSalesCalls: true,
    weights: { cash: 1, users: 20, morale: 200, equity: 3e6, reputation: 300 },
  },
  // Aggressive hiring, ads, earliest rounds.
  vcRocket: {
    kind: 'vcRocket', firstCategory: 'mobile', extraCategories: ['ai'],
    buildMix: { eng: 3, product: 1, marketing: 2 }, growMix: { eng: 3, product: 1, marketing: 4, sales: 2, ops: 2 },
    minRunwayToHire: 3, teamCap: ALL_CAP, adAggression: 0.6, minLtvCac: 1.5, price: 1,
    roundEagerness: 1, roundSize: 'large', weakPitch: 'coinvestor', furnishReserveMonths: 3, useSalesCalls: false,
    weights: { cash: 1, users: 80, morale: 100, equity: 5e5, reputation: 500 },
  },
  // One project, high price, small senior team, enterprise deals.
  niche: {
    kind: 'niche', firstCategory: 'api', extraCategories: [],
    buildMix: { eng: 2, marketing: 1, sales: 1 }, growMix: { eng: 2, product: 1, marketing: 3, sales: 2, ops: 1 },
    minRunwayToHire: 4, teamCap: [4, 8, 11, 18, 28, 36, 36], adAggression: 0.2, minLtvCac: 2, price: 1.5,
    roundEagerness: 1, roundSize: 'target', weakPitch: 'story', furnishReserveMonths: 3, useSalesCalls: true,
    weights: { cash: 1, users: 30, morale: 150, equity: 2e6, reputation: 400 },
  },
  // Many projects, eng/ops heavy.
  platform: {
    kind: 'platform', firstCategory: 'marketplace', extraCategories: ['api', 'web'],
    buildMix: { eng: 3, product: 1, marketing: 1 }, growMix: { eng: 3, product: 1, marketing: 3, sales: 2, ops: 2 },
    minRunwayToHire: 4, teamCap: ALL_CAP, adAggression: 0.45, minLtvCac: 1.5, price: 1.1,
    roundEagerness: 1, roundSize: 'target', weakPitch: 'story', furnishReserveMonths: 3, useSalesCalls: false,
    weights: { cash: 1, users: 50, morale: 150, equity: 1e6, reputation: 300 },
  },
}

/**
 * GAMEPLAY V2 §15 bots. All play the real engine through the same routine as the archetypes; what differs is config.
 * - coaster / idleAfterProfit: bootstrap until the first profitable day, then autopilot (see BotConfig.afterProfit).
 * - greedyGood: a good policy that takes risks — hires down to 4 months of runway, always the large round, never
 *   prepares for a scheduled crisis (§5.1). // T09 kredi: takes the loan within 3 months of runway once loans exist.
 * - burner / frugal: the same bootstrap plan on the same seeds; burner spends hard but watches runway (hires down to 3
 *   months, heavy ads), frugal hires only on a thick cushion. "Careless burner" = burner with minRunwayToHire 0.
 */
export const V2_BOTS: Record<V2BotKind, BotConfig> = {
  coaster: { ...BOTS.bootstrap, kind: 'coaster', afterProfit: 'coast' },
  idleAfterProfit: { ...BOTS.bootstrap, kind: 'idleAfterProfit', afterProfit: 'idle' },
  greedyGood: { ...BOTS.platform, kind: 'greedyGood', minRunwayToHire: 4, roundSize: 'large', adAggression: 0.6, minLtvCac: 2, prepareCrisis: false },
  burner: { ...BOTS.bootstrap, kind: 'burner', minRunwayToHire: 3, teamCap: ALL_CAP, adAggression: 0.6, minLtvCac: 1 },
  frugal: { ...BOTS.bootstrap, kind: 'frugal', minRunwayToHire: 9, adAggression: 0.1 },
}
/** Coaster doubles its ad budget this often once profitable. */
const COAST_AD_EVERY_DAYS = 90
/** First coast bump when no ads ran yet: ×2 of zero would never spend. */
const COAST_AD_FLOOR = 1_000

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
  // GAMEPLAY V2 §15 measurements. Filled where the engine has the mechanic today; the rest stay at their defaults
  // until their wave lands (loans T09, crises T07, policies, market, rivals, board, threads).
  /** Lowest runway (months, 99 = profitable) seen on a payday, per stage. */
  stageMinRunway: number[]
  /** Paydays with runway < 2 months, per stage. */
  nearDeathPaydays: number[]
  daysRunwayBelow3: number
  /** First profitable payday came before Series B. */
  profitBeforeB: boolean
  /** Paydays that were profitable (net ≥ 0). */
  profitPaydays: number
  paydays: number
  /** profitPaydays / paydays: share of the months spent in profit (autopilot probe, §4.2 kabul b). */
  profitMonthsShare: number
  loansTaken: number
  loanCalled: number
  roundsFailed: number
  crisesFired: number
  crisisNearDeath: number
  /** Alive ≥ 180 days after the first near-death payday (null = never near death). */
  survivedNearDeath: boolean | null
  policiesAdopted: number
  paydayDeferrals: number
  movesUsedShare: number
  segmentsOpened: number
  rivalsAcquired: number
  boardQuarters: { hit: number; missed: number }
  renewals: { offered: number; kept: number }
  refactors: number
  /** Tech debt on the last payday of each stage (index = stage; null = stage never paid a payday). */
  techDebtByStage: (number | null)[]
  peakValuation: number
  /** 1 − final / peak valuation (0 = ended at its peak). */
  valuationDropAfterPeak: number
  /** Market penetration on the last payday of each stage (index = stage; 0 = never reached). */
  penetrationByStage: number[]
  rivalPassedDays: number
  threadSteps: number
  secretsSeen: number
  /** Serialized save at the end of the run (UTF-8 bytes). */
  saveBytes: number
  /** Crises that hit (§5.1): day, stage, whether the bot was preparing, and the lowest payday runway in the window after. */
  crises: CrisisRun[]
  /** Crises the bot was in preparation mode for when they hit. */
  preparedForCrisis: number
  /** Decision cards shown over the run (the card budget, §3 md.11). */
  cardsShown: number
}

export interface CrisisRun {
  day: number
  stage: number
  prepared: boolean
  /** Lowest payday runway (months, 99 = profitable) in the CRISIS_WINDOW_DAYS after it hit. */
  minRunway: number
}

/** The window after a crisis whose paydays count as "kriz sonrası" (the longest crisis modifier lasts 120 days). */
export const CRISIS_WINDOW_DAYS = 120

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
    const prepared = policy === 'best' && prepares(cfg) ? PREP_CARD_OPTION[card.id] : undefined
    if (prepared !== undefined) best = prepared
    else if (cfg && policy !== 'first') {
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

/** Monthly burn without the ad budget: ads can be cut any day, so cash reserves are sized on the fixed costs. */
function fixedBurn(s: GameState): number {
  return Math.max(0, s.finance.burn - s.finance.adBudget)
}

function affordable(s: GameState, reserve: number, price: number): boolean {
  return s.stats.cash > reserve + price
}

/** Desks, desk upgrades, common-area auras and rooms. */
function furnish(c: Ctx, cfg: BotConfig): void {
  const { act, content } = c
  // Preparing for a crisis: rent × 3 stays in the bank (what lease-hike asks at once), until it shows another kind.
  const prep = preparing(c.s, cfg)
  const prepReserve = prep && (prep.hidden || prep.id === 'lease-hike') ? c.s.finance.burnBreakdown.rent * 3 : 0
  const reserve = Math.max(5_000, fixedBurn(c.s) * 3) + prepReserve
  const rich = Math.max(10_000, fixedBurn(c.s) * cfg.furnishReserveMonths) + prepReserve
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

// GAMEPLAY V2 §5.1 bot preparation: the whole value of a known storm is getting ready for it.
/** Ads while preparing: × this of the budget when the "?" appeared. */
const PREP_AD_SHARE = 0.5
/** Crises that price a round down (multiple ceiling, diligence ask): no round is started into them. */
const WINTER_CRISES: ReadonlySet<string> = new Set(['investor-winter', 'market-correction'])
/** Below this runway the round starts anyway, winter or not (the player's dilemma). */
const WINTER_ROUND_RUNWAY = 4

/** §5.1 preparation mode on (one gate for every preparation behaviour: horizon, card, storm ads). */
function prepares(cfg: BotConfig | null): cfg is BotConfig {
  return cfg !== null && cfg.prepareCrisis !== false
}

/** The next crisis once its date is on the horizon ("?", CRISIS_HORIZON_DAYS), for a bot that prepares; else null. */
function preparing(s: GameState, cfg: BotConfig | null): NextCrisis | null {
  if (!prepares(cfg)) return null
  const nc = nextCrisis(s)
  return nc && nc.day - s.time.day <= balance.CRISIS_HORIZON_DAYS ? nc : null
}

/** Card the preparing bot answers with its preparation, not by score (key-account-renewal: the SLA investment). */
const PREP_CARD_OPTION: Readonly<Record<string, number>> = { 'crisis-key-account': 1 }

function hiring(c: Ctx, cfg: BotConfig): void {
  const { act } = c
  // Preparation mode (§5.1): no hires from the "?" to the crisis day.
  if (preparing(c.s, cfg)) return
  const runway = c.s.finance.runway ?? 99
  // Servers overflowing: an engineer is a need, not growth — the soft team cap gives way (up to +50%).
  const overloaded = c.s.derived.capacity < c.s.stats.users * 1.05
  // A valuation stuck below the window (the growth trough) makes a sensible player hire past the plan: +2 per stall.
  const stallBonus = c.mem.progStage === c.s.stage ? 2 * Math.floor((c.s.time.day - (c.mem.bestDay ?? c.s.time.day)) / STALL_DAYS) : 0
  const cap = (cfg.teamCap[c.s.stage] ?? 99) * (overloaded ? 1.5 : 1) + stallBonus
  // The garage is a survival level: the first small team is hired on thin runway (the round is the way out).
  const minRunway = c.s.stage === 0 ? Math.min(cfg.minRunwayToHire, GARAGE_MIN_RUNWAY) : cfg.minRunwayToHire
  if (runway <= minRunway || c.s.employees.length >= cap) return
  const reserve = Math.max(5_000, fixedBurn(c.s) * 3)
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
  // GAMEPLAY V2 §4.2: once debt costs a fifth of the speed, a sensible founder takes the month to refactor.
  if (c.s.techDebt >= REFACTOR_AT_DEBT && act({ type: 'founderAction', kind: 'refactorSprint' })) return
  if (c.s.round?.active && act({ type: 'founderAction', kind: 'investorCoffee' })) return
  if (c.s.stats.morale < 50 && act({ type: 'founderAction', kind: 'motivateTeam' })) return
  // Deals saturate within a month (half, then a quarter): a sensible player stops at half.
  if (cfg.useSalesCalls && (c.s.derived.salesCall?.factor ?? 1) >= 0.5 && act({ type: 'founderAction', kind: 'salesCall' })) return
  if (c.s.projects.some((p) => p.maturity < 1) && act({ type: 'founderAction', kind: 'talkToUsers' })) return
  // A sensible player stops once the circle is used up ("tanıdık çevren tükeniyor").
  if (c.s.stage <= 1 && (c.s.derived.findUsers?.factor ?? 1) >= 0.5) act({ type: 'founderAction', kind: 'findUsers' })
}

/**
 * Ad budget hill climb (GAMEPLAY V2 §4.3): steps, the LTV:CAC margin to keep raising, the share of MRR it starts at,
 * the paid-peak ceiling (× MRR, AD_CAP_BASE + AD_CAP_PER_AGGRESSION × adAggression, at most AD_PEAK_MRR) and the cash
 * ceiling: profit + cash / AD_CASH_MONTHS (AD_CASH_MONTHS_LAST once no round is left).
 */
const AD_STEP_UP = 1.25
const AD_STEP_DOWN = 0.75
const AD_RAISE_MARGIN = 1.1
const AD_START_MRR = 0.25
const AD_PEAK_MRR = 1.5
const AD_CAP_BASE = 0.5
const AD_CAP_PER_AGGRESSION = 2
const AD_CASH_MONTHS = 8
const AD_CASH_MONTHS_LAST = 12
const AD_STOP_RUNWAY = 3
const AD_MIN_SHARE = 0.02

/**
 * Tech debt at which the bot runs a refactor sprint: speed × REFACTOR_AT_SPEED (0.8 → debt 10). Tied to the debt
 * economy the runs really reach (Series C median ≈ 12 without sprints); at 30 no bot ever refactored.
 */
const REFACTOR_AT_SPEED = 0.8
const REFACTOR_AT_DEBT = (1 - REFACTOR_AT_SPEED) / balance.TECH_DEBT_PER_POINT

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
    // GAMEPLAY V2 §4.3: CAC climbs with spend (super-linear) and with the market, so the budget is a hill to climb:
    // raise it while LTV:CAC holds above the bar, back off when it drops below. Two ceilings: stay under the paid
    // peak (ads ≈ 1.9 × MRR), and spend no more than the profit plus cash / N months (longer once no round is left).
    // A prepared bot reads a storm's churn as passing (§5.1): while a crisis' churn is on it judges the channel by the
    // LTV:CAC from before the storm, instead of cutting ads into it.
    const storm = prepares(cfg) && c.s.modifiers.some((m) => m.kind === 'churn' && m.source.startsWith('crisis:'))
    if (!storm) c.mem.calmLtvCac = c.s.derived.ltvCac ?? 0
    const ltvCac = storm ? Math.max(c.s.derived.ltvCac ?? 0, c.mem.calmLtvCac ?? 0) : (c.s.derived.ltvCac ?? 0)
    const ads = c.s.finance.adBudget
    const mrr = c.s.finance.mrr
    const lastRound = c.s.stage >= balance.LAST_STAGE - 1
    const others = c.s.finance.burn - ads
    const cashCap = Math.max(0, mrr - others) + Math.max(0, c.s.stats.cash) / (lastRound ? AD_CASH_MONTHS_LAST : AD_CASH_MONTHS)
    const peakCap = Math.min(AD_PEAK_MRR, AD_CAP_BASE + AD_CAP_PER_AGGRESSION * cfg.adAggression) * mrr
    const cap = cfg.ignoreRunway ? peakCap : Math.min(cashCap, peakCap)
    let t = ads
    if ((!cfg.ignoreRunway && (c.s.finance.runway ?? 99) <= AD_STOP_RUNWAY) || c.s.derived.overload >= 1) t = 0
    else if (ads < 1) t = ltvCac >= minLtvCac ? Math.min(cap, AD_START_MRR * mrr) : 0
    else if (ltvCac >= minLtvCac * AD_RAISE_MARGIN) t = Math.min(cap, ads * AD_STEP_UP)
    else if (ltvCac < minLtvCac) t = ads * AD_STEP_DOWN
    t = Math.min(t, cap)
    // Preparing: half the budget the "?" found; a revealed ad war (cac-war) cuts it, price kept.
    const prep = preparing(c.s, cfg)
    if (prep?.id === 'cac-war') t = 0
    else if (prep) {
      c.mem.prepAds ??= ads
      t = Math.min(t, c.mem.prepAds * PREP_AD_SHARE)
    }
    if (!prep) delete c.mem.prepAds
    t = t < AD_MIN_SHARE * mrr ? 0 : Math.round(t)
    if (Math.abs(t - ads) > 0.2 * Math.max(1, ads)) act({ type: 'setAdBudget', amount: Math.max(0, t) })
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
  // A winter crisis ahead (revealed, the round could not close before it) or on: the round would be priced in it.
  // Wait it out — unless runway is under WINTER_ROUND_RUNWAY months.
  const prep = preparing(c.s, cfg)
  const winterAhead = prep?.id !== undefined && WINTER_CRISES.has(prep.id) && prep.day - c.s.time.day < balance.ROUND_WEEKS_MAX * 7 + 14
  const winterOn = cfg.prepareCrisis !== false && c.s.modifiers.some((m) => m.kind === 'diligenceMom' && m.source.startsWith('crisis:'))
  if ((winterAhead || winterOn) && (c.s.finance.runway ?? 99) >= WINTER_ROUND_RUNWAY) return
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
const CARELESS: BotConfig = { ...BOTS.bootstrap, kind: 'careless', minRunwayToHire: 0, teamCap: ALL_CAP, furnishReserveMonths: 0, impulseBuy: 0.15, prepareCrisis: false }

export function playBot(
  kind: BotKind,
  seed: number,
  content: EngineContent,
  maxDays = 2700,
  onDay?: (s: GameState) => void,
  policy: DecisionPolicy = 'best',
  overrides: Partial<BotConfig> = {},
): BotRun {
  const base = kind === 'idle' || kind === 'random' ? null : kind === 'careless' ? CARELESS : kind in V2_BOTS ? V2_BOTS[kind as V2BotKind] : BOTS[kind as Archetype]
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
  let profitDay: number | null = null
  let coastBumps = 0
  const stageMinRunway = [99, 99, 99, 99, 99, 99, 99]
  const nearDeathPaydays = [0, 0, 0, 0, 0, 0, 0]
  let daysRunwayBelow3 = 0
  let firstProfitStage: number | null = null
  let profitPaydays = 0
  let paydays = 0
  let firstNearDeath: number | null = null
  let peakValuation = 0
  const techDebtByStage: (number | null)[] = [null, null, null, null, null, null, null]
  const penetrationByStage = [0, 0, 0, 0, 0, 0, 0]
  const crises: (CrisisRun & { eventId: number })[] = []
  let cardsShown = 0

  while (!s.gameOver && s.time.day < maxDays) {
    if (cfg && careless) {
      // Random card answers (no weighing), otherwise the bootstrap routine without runway care.
      housekeeping(ctx, null, botRng)
      if (!c10Skip(botRng)) {
        // Impulse buy: a random item it can pay for right now, on a random open slot, reserve or not.
        if (botRng.next() < (cfg.impulseBuy ?? 0)) {
          // Nothing affordable (a crisis can take the cash below every price): no impulse today.
          const affordableNow = content.furniture.filter((f) => f.stageUnlock <= s.stage && f.price <= s.stats.cash)
          const item = affordableNow.length ? botRng.pick(affordableNow) : undefined
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
    } else if (cfg?.afterProfit && profitDay !== null) {
      if (cfg.afterProfit === 'coast') {
        housekeeping(ctx, cfg, undefined, policy)
        if (s.unlockedTools.includes('adBudget') && s.time.day - profitDay >= COAST_AD_EVERY_DAYS * (coastBumps + 1)) {
          coastBumps++
          ctx.act({ type: 'setAdBudget', amount: Math.max(COAST_AD_FLOOR, Math.round(s.finance.adBudget * 2)) })
        }
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
    // An autopilot past its first profit does nothing: it is not preparing even though it could.
    const prepOn = preparing(s, cfg) !== null && !(cfg?.afterProfit && profitDay !== null)
    s = api.step(s, 1)
    if (profitDay === null && s.finance.mrr > 0 && s.finance.net > 0) profitDay = s.time.day
    if ((s.finance.runway ?? 99) < 3) daysRunwayBelow3++
    peakValuation = Math.max(peakValuation, s.finance.valuation)
    for (let st = prev + 1; st <= s.stage; st++) stageDays[st] = Math.round(s.time.day)
    // Dead time inside a round: gap between world beats while the round runs.
    for (const e of s.events) {
      if (e.id <= seenId) continue
      if (MOMENT_KINDS.has(e.kind)) moment(e.day)
      if (e.kind === 'payrollMissed') payrollMissed++
      if (e.kind === 'decisionDefaulted') defaulted++
      if (e.kind === 'decisionShown') cardsShown++
      if (e.kind === 'crisis') crises.push({ day: e.day, stage: s.stage, prepared: prepOn, minRunway: 99, eventId: e.id })
      if (e.kind === 'payday') {
        const rw = Math.min(99, s.finance.lastReceipt?.runwayAfter ?? 99)
        paydayRunway.push({ stage: s.stage, runway: rw })
        paydays++
        stageMinRunway[s.stage] = Math.min(stageMinRunway[s.stage] ?? 99, rw)
        for (const k of crises) if (e.id > k.eventId && e.day - k.day <= CRISIS_WINDOW_DAYS) k.minRunway = Math.min(k.minRunway, rw)
        techDebtByStage[s.stage] = s.techDebt
        penetrationByStage[s.stage] = s.derived.penetration ?? 0
        if (rw < 2) {
          nearDeathPaydays[s.stage] = (nearDeathPaydays[s.stage] ?? 0) + 1
          firstNearDeath ??= s.time.day
        }
        if ((s.finance.lastReceipt?.net ?? -1) >= 0) {
          profitPaydays++
          firstProfitStage ??= s.stage
        }
      }
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
  const failed = s.gameOver?.kind === 'bankrupt' || s.gameOver?.kind === 'teamLost'
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
    stageMinRunway,
    nearDeathPaydays,
    daysRunwayBelow3,
    profitBeforeB: firstProfitStage !== null && firstProfitStage < 4,
    profitPaydays,
    paydays,
    profitMonthsShare: paydays ? profitPaydays / paydays : 0,
    loansTaken: 0,
    loanCalled: 0,
    roundsFailed: 0,
    crisesFired: crises.length,
    crisisNearDeath: crises.filter((k) => k.minRunway < 2).length,
    survivedNearDeath: firstNearDeath === null ? null : !(failed && s.time.day - firstNearDeath < 180),
    policiesAdopted: 0,
    paydayDeferrals: 0,
    movesUsedShare: 0,
    segmentsOpened: 0,
    rivalsAcquired: 0,
    boardQuarters: { hit: 0, missed: 0 },
    renewals: { offered: 0, kept: 0 },
    refactors: s.counters.refactors ?? 0,
    techDebtByStage,
    peakValuation,
    valuationDropAfterPeak: peakValuation > 0 ? Math.max(0, 1 - s.finance.valuation / peakValuation) : 0,
    penetrationByStage,
    rivalPassedDays: 0,
    threadSteps: 0,
    secretsSeen: 0,
    saveBytes: new TextEncoder().encode(serialize(s)).length,
    crises: crises.map(({ eventId: _id, ...k }) => k),
    preparedForCrisis: crises.filter((k) => k.prepared).length,
    cardsShown,
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

