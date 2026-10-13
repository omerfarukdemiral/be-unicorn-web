// Project modules (W2a): what a launched, finished (1.0) product grows into. Catalogue + pure math; the actions live
// in actions.ts, the build in tick.progressProjects, the delivery in loop.checkReleases, the mix in derive.ts.
// No per-project user stock: every gain is a multiplier on the company's existing channels, weighted over the projects.
import * as B from './balance'
import { actionEnergy, movesError } from './founder'
import {
  PROJECT_MODULE_IDS,
  type ActionErrorCode,
  type GameState,
  type ModuleEffectKind,
  type Project,
  type ProjectCategory,
  type ProjectMixView,
  type ProjectModule,
  type ProjectId,
  type ProjectModuleId,
  type StageIndex,
} from './types'

type Mults = Partial<Record<ModuleEffectKind, number>>

export const MODULE_KINDS: readonly ModuleEffectKind[] = ['churn', 'arpu', 'organic', 'cac', 'tam', 'wave', 'updateWork', 'talk']

export interface ModuleDef {
  id: ProjectModuleId
  minStage: StageIndex
  /** Only on these categories (none = any). */
  categories?: readonly ProjectCategory[]
  /** Cannot sit on the same project. */
  excludes?: readonly ProjectModuleId[]
  /** Maturity-equivalent work at the category's base size. */
  work: number
  /** Cash at stage 0; × MODULE_COST_GROWTH^stage. */
  cashBase: number
  /** Gains: fade with staleness, boosted on catBoost's categories. */
  gains: Mults
  /** Minuses: fixed for good. */
  minus?: Mults
  /** On these categories every gain is 1 + (x − 1) × k. */
  catBoost?: Partial<Record<ProjectCategory, number>>
  /** Monthly upkeep (infra) at the project's weight in the mix, on this month's MRR. */
  upkeep?: (s: GameState, weight: number, mrr: number) => number
  sizeAdd: number
  debt: number
}

const stageScaled = (base: number) => (s: GameState) => base * B.MODULE_COST_GROWTH ** s.stage

/** Every module has a minus (upkeep, debt, a negative multiplier or heavier updates); the garage opens three axes. */
export const MODULES: readonly ModuleDef[] = [
  { id: 'feedback', minStage: 0, work: 0.1, cashBase: 600, gains: { churn: 0.94, wave: 1.25, talk: 1.5 }, minus: { updateWork: 1.25 }, sizeAdd: 0, debt: 0 },
  { id: 'referral', minStage: 0, work: 0.12, cashBase: 800, gains: { organic: 1.22 }, minus: { arpu: 0.95 }, catBoost: { game: 1.4, mobile: 1.4, marketplace: 1.4 }, sizeAdd: 1, debt: 0 },
  { id: 'paywall', minStage: 0, excludes: ['freemium'], work: 0.1, cashBase: 600, gains: { arpu: 1.15 }, minus: { organic: 0.85, churn: 1.04 }, sizeAdd: 0, debt: 0 },
  { id: 'onboarding', minStage: 1, work: 0.15, cashBase: 1_000, gains: { churn: 0.9, cac: 0.95 }, upkeep: stageScaled(100), sizeAdd: 1, debt: 1 },
  { id: 'analytics', minStage: 1, work: 0.12, cashBase: 1_500, gains: { cac: 0.88, organic: 1.05 }, upkeep: stageScaled(150), sizeAdd: 0, debt: 0 },
  {
    id: 'freemium', minStage: 2, excludes: ['paywall'], work: 0.15, cashBase: 1_500, gains: { organic: 1.35 }, minus: { arpu: 0.85 },
    upkeep: (s, w) => (s.stats.users / 1000) * w * 0.5 * (B.INFRA_PER_1000_BY_STAGE[s.stage] ?? 0), sizeAdd: 0, debt: 0,
  },
  { id: 'openApi', minStage: 3, work: 0.3, cashBase: 6_000, gains: { churn: 0.88, tam: 1.1 }, catBoost: { api: 1.5 }, sizeAdd: 2, debt: 3 },
  { id: 'localization', minStage: 3, work: 0.25, cashBase: 8_000, gains: { tam: 1.25 }, minus: { cac: 1.08 }, upkeep: stageScaled(300), sizeAdd: 0, debt: 0 },
  { id: 'aiAssistant', minStage: 4, work: 0.35, cashBase: 15_000, gains: { arpu: 1.12, churn: 0.95 }, catBoost: { ai: 1.5 }, upkeep: (_s, w, mrr) => mrr * w * 0.06, sizeAdd: 0, debt: 3 },
]

export function moduleDef(id: ProjectModuleId | string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id)
}

export function isModuleId(id: unknown): id is ProjectModuleId {
  return typeof id === 'string' && (PROJECT_MODULE_IDS as readonly string[]).includes(id)
}

/** Flags the desk bubble (W2c) keeps: the last stage a project was asked about, and a stale module already asked about. */
export const modulePromptFlag = (projectId: string) => `modulePrompt:${projectId}`
export const moduleStaleFlag = (projectId: string, moduleId: ProjectModuleId) => `moduleStale:${projectId}:${moduleId}`

/** 1 while fresh, then linear to MODULE_STALE_FLOOR between MODULE_FRESH_DAYS and MODULE_STALE_DAYS of age. */
export function moduleStrength(m: ProjectModule, day: number): number {
  const age = day - m.day
  if (age <= B.MODULE_FRESH_DAYS) return 1
  const t = Math.min(1, (age - B.MODULE_FRESH_DAYS) / (B.MODULE_STALE_DAYS - B.MODULE_FRESH_DAYS))
  return 1 - (1 - B.MODULE_STALE_FLOOR) * t
}

/** A module's gain for a kind on a category before staleness (1 = none). */
export function moduleGain(def: ModuleDef, kind: ModuleEffectKind, category: ProjectCategory): number {
  const x = def.gains[kind]
  if (x === undefined) return 1
  const k = def.catBoost?.[category] ?? 1
  return 1 + (x - 1) * k
}

function capped(kind: ModuleEffectKind, v: number): number {
  const cap = B.MODULE_MULT_CAP[kind]
  if (cap === undefined) return v
  return B.MODULE_MULT_FLOOR_KINDS.includes(kind) ? Math.max(cap, v) : Math.min(cap, v)
}

/** The capped product of a project's modules for one kind on `day` (gains faded by staleness, minuses fixed). 1 with none. */
export function moduleMult(p: Project, kind: ModuleEffectKind, day: number, modules: readonly ProjectModule[] | undefined = p.modules): number {
  if (!modules?.length) return 1
  let v = 1
  for (const m of modules) {
    const def = moduleDef(m.id)
    if (!def) continue
    const gain = moduleGain(def, kind, p.category)
    if (gain !== 1) v *= 1 + (gain - 1) * moduleStrength(m, day)
    const minus = def.minus?.[kind]
    if (minus !== undefined) v *= minus
  }
  return capped(kind, v)
}

/** Work of one update on this project (feedback makes them heavier). */
export function updateSize(p: Project, day: number): number {
  return B.RELEASE_UPDATE_SIZE * moduleMult(p, 'updateWork', day)
}

/** Monthly upkeep of a project's modules at its weight in the mix (aiAssistant's inference bill reads `mrr`). */
export function moduleUpkeep(s: GameState, p: Project, weight: number, mrr = s.finance.mrr): number {
  let sum = 0
  for (const m of p.modules ?? []) sum += moduleDef(m.id)?.upkeep?.(s, weight, mrr) ?? 0
  return sum
}

/** How hard the ads lean on the focus: ads against last month's MRR (the month-end snapshot, so this tick's own growth cannot feed back). */
export function adIntensity(s: GameState): number {
  const floor = B.CAC_SPEND_FLOOR[Math.min(B.CAC_SPEND_FLOOR.length - 1, s.stage)]!
  const prev = s.finance.mrrHistory[s.finance.mrrHistory.length - 1] ?? 0
  return Math.min(1, Math.max(0, s.finance.adBudget / Math.max(prev, floor)))
}

/** The launched project the ads promote, or undefined (no focus, or it points at a missing / unlaunched one: ignored). */
export function adFocusProject(s: GameState): Project | undefined {
  const id = s.finance.adFocus
  return id === undefined ? undefined : s.projects.find((p) => p.id === id && p.launched)
}

/**
 * The launched projects and their weight in the mix: equal (the flat mean), the ad focus 1 + AD_FOCUS_TILT × adIntensity.
 * `focus` overrides s.finance.adFocus (null = the whole company) for the previews.
 */
export function projectWeights(s: GameState, focus?: ProjectId | null): { p: Project; w: number }[] {
  const id = focus === undefined ? s.finance.adFocus : focus ?? undefined
  const tilt = id === undefined ? 0 : B.AD_FOCUS_TILT * adIntensity(s)
  return s.projects.filter((p) => p.launched).map((p) => ({ p, w: p.id === id ? 1 + tilt : 1 }))
}

/** CAC factor of the focus change still settling: AD_FOCUS_WARMUP_CAC on the day, linear to 1 at AD_FOCUS_WARMUP_DAYS. */
export function adFocusWarmup(s: GameState): number {
  const day = s.finance.adFocusDay
  if (day === undefined) return 1
  const left = 1 - (s.time.day - day) / B.AD_FOCUS_WARMUP_DAYS
  return left > 0 ? 1 + (B.AD_FOCUS_WARMUP_CAC - 1) * Math.min(1, left) : 1
}

export interface FocusEffects {
  /** Company multipliers (focus / balanced), ≠ 1 only where the products differ. */
  arpu: number
  organic: number
  cac: number
  churn: number
}

/** What a focus does to the company's channels against the balanced mean: the weighted means' ratios (cheap, no tick). */
export function focusEffects(s: GameState, focus: ProjectId | null): FocusEffects {
  const day = s.time.day
  const flat = projectWeights(s, null)
  const tilted = projectWeights(s, focus)
  const ratio = (f: (p: Project) => number) => wMean(tilted, f) / wMean(flat, f)
  return {
    arpu: ratio((p) => (B.CATEGORY_ARPU[p.category] ?? 1) * moduleMult(p, 'arpu', day)),
    organic: ratio((p) => (B.CATEGORY_ORGANIC[p.category] ?? 1) * moduleMult(p, 'organic', day)),
    cac: ratio((p) => moduleMult(p, 'cac', day)),
    churn: ratio((p) => moduleMult(p, 'churn', day)),
  }
}

/**
 * Estimated MRR a month from now if the ads promoted `focus` (null = the company): the derived channels moved from the
 * current focus to that one (the multipliers' ratios), no warm-up. users × (1 − churn) + new, at the new ARPU. For bots
 * and previews, not the tick.
 */
export function focusPreview(s: GameState, focus: ProjectId | null): number {
  const cur = focusEffects(s, adFocusProject(s)?.id ?? null)
  const next = focusEffects(s, focus)
  const d = s.derived
  const ch = d.channels
  const paid = next.cac > 0 ? ch.paid * cur.cac / next.cac : ch.paid
  const organic = ch.organic / cur.organic * next.organic
  const churn = s.stats.churn / cur.churn * next.churn
  const arpu = s.stats.arpu / cur.arpu * next.arpu
  const users = Math.max(0, s.stats.users * (1 - churn) + organic + paid + ch.manual)
  return users * arpu + s.finance.enterpriseCustomers.reduce((a, e) => a + e.mrr, 0)
}

/**
 * Σ w_p × f(p) / Σ w_p over the launched projects (1 before the first launch). With equal weights and no modules this
 * is categoryMix bit for bit (the same running sum divided by n). `ws`: projectWeights(s), computed once per derive.
 */
export function wMean(ws: readonly { p: Project; w: number }[], f: (p: Project) => number): number {
  if (ws.length === 0) return 1
  let sum = 0
  let total = 0
  for (const { p, w } of ws) {
    sum += w * f(p)
    total += w
  }
  return sum / total
}

/** derived.projectMix (written once a project has a module): each launched project's normalized weight, its capped multipliers (≠ 1 only) and upkeep. */
export function projectMix(s: GameState, mrr = s.finance.mrr, ws = projectWeights(s)): Record<string, ProjectMixView> {
  const total = ws.reduce((a, x) => a + x.w, 0)
  const out: Record<string, ProjectMixView> = {}
  for (const { p, w } of ws) {
    const weight = w / total
    const mult: Partial<Record<ModuleEffectKind, number>> = {}
    if (!p.modules?.length) {
      out[p.id] = { weight, mult, upkeep: 0 }
      continue
    }
    for (const kind of MODULE_KINDS) {
      const v = moduleMult(p, kind, s.time.day)
      if (v !== 1) mult[kind] = v
    }
    out[p.id] = { weight, mult, upkeep: moduleUpkeep(s, p, weight, mrr) }
  }
  return out
}

/** Slots on a project at the current stage: used (installed + a new build) of total. */
export function projectSlots(s: GameState, p: Project): { used: number; total: number } {
  const total = B.MODULE_SLOTS_BY_STAGE[Math.min(B.MODULE_SLOTS_BY_STAGE.length - 1, s.stage)] ?? 0
  const used = (p.modules?.length ?? 0) + (p.build && !p.build.refresh ? 1 : 0)
  return { used, total }
}

export function moduleCost(s: GameState, def: ModuleDef, refresh = false): number {
  return Math.round(def.cashBase * B.MODULE_COST_GROWTH ** s.stage * (refresh ? B.MODULE_REFRESH_SHARE : 1))
}

/** Work a build needs: the module's work × the project's scope (p.size / base size), × MODULE_REFRESH_SHARE on a refresh. */
export function moduleWork(p: Project, def: ModuleDef, refresh = false): number {
  return def.work * (p.size / B.PROJECT_SIZE[p.category]) * (refresh ? B.MODULE_REFRESH_SHARE : 1)
}

/**
 * Why buildModule (refresh = false) or refreshModule cannot start now, or null. Order: notFound (refresh: not on the
 * project), invalid (unknown, wrong category, already there, excluded), notUnlocked (not live and 1.0, stage), slotOccupied
 * (a build runs), noFreeSlot (build only), insufficientCash, noEnergy (garage) / noMoves. Pure: offers and actions share it.
 */
export function moduleError(s: GameState, p: Project | undefined, id: ProjectModuleId, refresh = false): ActionErrorCode | null {
  if (!p) return 'notFound'
  const def = moduleDef(id)
  const mods = p.modules ?? []
  const has = mods.some((m) => m.id === id)
  if (refresh) {
    if (!def || !has) return 'notFound'
  } else {
    if (!def) return 'invalid'
    if (def.categories && !def.categories.includes(p.category)) return 'invalid'
    if (has) return 'invalid'
    if (mods.some((m) => def.excludes?.includes(m.id) || moduleDef(m.id)?.excludes?.includes(id))) return 'invalid'
  }
  if (!p.launched || p.maturity < 1 || s.stage < def.minStage) return 'notUnlocked'
  if (p.build) return 'slotOccupied'
  if (!refresh && mods.length >= projectSlots(s, p).total) return 'noFreeSlot'
  if (s.stats.cash < moduleCost(s, def, refresh)) return 'insufficientCash'
  if (s.founder.energy < actionEnergy(s, B.MODULE_ENERGY)) return 'noEnergy'
  return movesError(s, refresh ? B.MOVE_COST.refreshModule : B.MOVE_COST.buildModule)
}

export interface ModuleOffer {
  id: ProjectModuleId
  /** An installed module's rebuild (refreshModule). */
  refresh: boolean
  cost: number
  /** Days at today's build speed (derived.maturityPerDay); null when nobody builds it. */
  days: number | null
  error: ActionErrorCode | null
}

/** Every module for a project: the ones it lacks (build) and the ones it has (refresh), each priced and checked. */
export function moduleOffers(s: GameState, p: Project): ModuleOffer[] {
  const rate = s.derived.maturityPerDay?.[p.id] ?? 0
  const has = new Set((p.modules ?? []).map((m) => m.id))
  return MODULES.map((def) => {
    const refresh = has.has(def.id)
    const work = moduleWork(p, def, refresh)
    return { id: def.id, refresh, cost: moduleCost(s, def, refresh), days: rate > 0 ? Math.ceil(work / rate) : null, error: moduleError(s, p, def.id, refresh) }
  })
}

/** Gain terms of the suggestion score: the change one module makes to the project's capped multipliers, weighted. */
function moduleScore(s: GameState, p: Project, id: ProjectModuleId, cost: number): number {
  const ws = projectWeights(s)
  const total = ws.reduce((a, x) => a + x.w, 0)
  const weight = total > 0 ? (ws.find((x) => x.p.id === p.id)?.w ?? 0) / total : 0
  const mrr = s.finance.mrr
  const floor = B.CAC_SPEND_FLOOR[Math.min(B.CAC_SPEND_FLOOR.length - 1, s.stage)]!
  const ads = Math.min(1, Math.max(0, s.finance.adBudget / Math.max(mrr, floor)))
  const pen = s.derived.penetration ?? 0
  const day = s.time.day
  const after = [...(p.modules ?? []), { id, day }]
  const d = (kind: ModuleEffectKind) => moduleMult(p, kind, day, after) / moduleMult(p, kind, day)
  const gain = (d('arpu') - 1) + 1.5 * (1 - d('churn')) + 0.5 * (d('organic') - 1) + ads * (1 - d('cac')) + pen * (d('tam') - 1)
  return (weight * gain) / (cost / Math.max(mrr, 1))
}

/**
 * The one module the desk suggests for a project (a hint, not a rule): among those it can build now, the best
 * weight × [(arpu − 1) + 1.5 (1 − churn) + 0.5 (organic − 1) + ads (1 − cac) + pen (tam − 1)] per month of MRR it costs,
 * each term the change it makes to the project's capped multiplier. null when none helps.
 */
export function suggestModule(s: GameState, p: Project): ProjectModuleId | null {
  let best: ProjectModuleId | null = null
  let bestScore = 0
  for (const offer of moduleOffers(s, p)) {
    if (offer.refresh || offer.error) continue
    const score = moduleScore(s, p, offer.id, offer.cost)
    if (score > bestScore) {
      bestScore = score
      best = offer.id
    }
  }
  return best
}

/** Why a build can wait without leaving the list: the player can fix these (cash, energy, moves, a running build). */
const SOFT_ERRORS: readonly ActionErrorCode[] = ['insufficientCash', 'noEnergy', 'noMoves', 'slotOccupied']

/**
 * The project panel's rows (W2c): up to `n` modules the project can take, best suggestion score first. Unlike
 * suggestModule it keeps the ones a fixable reason blocks (their `error` says why); stage-locked, wrong-category and
 * excluded ones stay out (the folded "Tüm modüller" list shows those).
 */
export function suggestModules(s: GameState, p: Project, n = 3): ModuleOffer[] {
  return moduleOffers(s, p)
    .filter((o) => !o.refresh && (!o.error || SOFT_ERRORS.includes(o.error)))
    .map((o) => ({ o, score: moduleScore(s, p, o.id, o.cost) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.o)
}

/** A module's two headline numbers for the chips: the biggest gain and the biggest minus, as multipliers on one kind. */
export interface ModuleHeadline {
  kind: ModuleEffectKind
  /** The multiplier on `kind` (0.94 = −6%). */
  mult: number
  /** true = good for the player (a lower churn, a higher arpu); updateWork above 1 is bad. */
  good: boolean
}

const LOWER_IS_BETTER: readonly ModuleEffectKind[] = ['churn', 'cac', 'updateWork']

function headline(entries: [ModuleEffectKind, number][]): ModuleHeadline | undefined {
  let best: ModuleHeadline | undefined
  let size = 0
  for (const [kind, mult] of entries) {
    const d = Math.abs(mult - 1)
    if (d > size + 1e-9) {
      size = d
      best = { kind, mult, good: LOWER_IS_BETTER.includes(kind) ? mult < 1 : mult > 1 }
    }
  }
  return best
}

/** The biggest gain (boosted on the project's category) and the biggest minus of a module. Either can be missing. */
export function moduleHeadlines(id: ProjectModuleId, category: ProjectCategory): { gain?: ModuleHeadline; minus?: ModuleHeadline } {
  const def = moduleDef(id)
  if (!def) return {}
  const gains = MODULE_KINDS.flatMap((k): [ModuleEffectKind, number][] => (def.gains[k] !== undefined ? [[k, moduleGain(def, k, category)]] : []))
  const minuses = MODULE_KINDS.flatMap((k): [ModuleEffectKind, number][] => (def.minus?.[k] !== undefined ? [[k, def.minus[k]!]] : []))
  const gain = headline(gains)
  const minus = headline(minuses)
  return { ...(gain ? { gain } : {}), ...(minus ? { minus } : {}) }
}

/** One module question for the desk: which project, which module, and whether it is a refresh of a stale one. */
export interface ModuleAsk {
  projectId: string
  moduleId: ProjectModuleId
  stale: boolean
}

/** Below this strength an installed module is stale enough for the desk to ask for a refresh. */
export const MODULE_ASK_STRENGTH = 0.75

/**
 * The one module question the desk asks now (oldest project first; a stale module before a new one): a launched
 * product at 1.0 with a free slot, no build running and a module the till affords, not asked yet this stage
 * (flags modulePrompt:{id} < stage), or an installed module under MODULE_ASK_STRENGTH not asked about at this build
 * (flags moduleStale:{id}:{module} ≠ its day). Pure: the world bubble and its content both read it.
 */
export function moduleAsk(s: GameState): ModuleAsk | null {
  for (const p of s.projects) {
    if (!p.launched || p.maturity < 1 || p.build) continue
    for (const m of p.modules ?? []) {
      if (moduleStrength(m, s.time.day) >= MODULE_ASK_STRENGTH || s.flags[moduleStaleFlag(p.id, m.id)] === m.day) continue
      if (!moduleError(s, p, m.id, true)) return { projectId: p.id, moduleId: m.id, stale: true }
    }
    if (Number(s.flags[modulePromptFlag(p.id)] ?? -1) >= s.stage) continue
    if ((p.modules?.length ?? 0) >= projectSlots(s, p).total) continue
    const id = suggestModule(s, p)
    if (id) return { projectId: p.id, moduleId: id, stale: false }
  }
  return null
}

/** The running build as the UI shows it: how far along (0–1) and the days left at today's build speed (null when nobody builds). */
export function buildStatus(s: GameState, p: Project): { id: ProjectModuleId; refresh: boolean; fraction: number; days: number | null } | null {
  const b = p.build
  const def = b && moduleDef(b.id)
  if (!b || !def) return null
  const work = moduleWork(p, def, b.refresh === true)
  const rate = s.derived.maturityPerDay?.[p.id] ?? 0
  return { id: b.id, refresh: b.refresh === true, fraction: Math.min(1, b.progress / work), days: rate > 0 ? Math.ceil(Math.max(0, work - b.progress) / rate) : null }
}

/** A module's monthly upkeep if it were built on this project now (0 for modules with none). */
export function moduleUpkeepHint(s: GameState, p: Project, id: ProjectModuleId): number {
  const ws = projectWeights(s)
  const weight = ws.length > 0 ? (ws.some((x) => x.p.id === p.id) ? 1 : 0) / ws.length : 0
  return Math.round(moduleDef(id)?.upkeep?.(s, weight, s.finance.mrr) ?? 0)
}
