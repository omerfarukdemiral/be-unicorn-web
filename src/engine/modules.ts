// Project modules (W2a): what a launched, finished (1.0) product grows into. Catalogue + pure math; the actions live
// in actions.ts, the build in tick.progressProjects, the delivery in loop.checkReleases, the mix in derive.ts.
// A1: every product holds its share of the company's users (p.users); the gains are multipliers on its own numbers and
// the company mixes weigh the products by those shares.
import * as B from './balance'
import { recomputeDerived } from './derive'
import { actionEnergy, movesError } from './founder'
import { updateWave } from './loop'
import {
  PROJECT_MODULE_IDS,
  type ActionErrorCode,
  type GameState,
  type ModuleEffectKind,
  type Project,
  type ProjectCategory,
  type ProjectMixView,
  type ModuleCounters,
  type ModuleMeasureBase,
  type ProjectModule,
  type ProjectId,
  type ProjectModuleId,
} from './types'
import { clone, type EngineContent } from './util'

type Mults = Partial<Record<ModuleEffectKind, number>>

export const MODULE_KINDS: readonly ModuleEffectKind[] = ['churn', 'arpu', 'organic', 'cac', 'tam', 'wave', 'updateWork', 'talk', 'infra']

/** A module's tier: it opens at that version of the project (MV2a; MODULE_TIER_MAX). */
export type ModuleTier = 1 | 2 | 3 | 4 | 5

/** While `with` sits on the same project, this module's gain on `kind` is 1 + (x − 1) × (1 + k) (before staleness and caps). */
export interface ModuleSynergy {
  with: ProjectModuleId
  kind: ModuleEffectKind
  k: number
}

export interface ModuleDef {
  id: ProjectModuleId
  /** Opens at this version of the project (v1 = the first 1.0). */
  tier: ModuleTier
  /** Only on these categories (none = any). */
  categories?: readonly ProjectCategory[]
  /** Cannot sit on the same project. */
  excludes?: readonly ProjectModuleId[]
  /** Must already be installed on the project. */
  requires?: readonly ProjectModuleId[]
  synergies?: readonly ModuleSynergy[]
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
  /** Tech debt on delivery; negative pays debt off (techDebt stays ≥ 0). */
  debt: number
}

const stageScaled = (base: number) => (s: GameState) => base * B.MODULE_COST_GROWTH ** s.stage
const syn = (w: ProjectModuleId, kind: ModuleEffectKind, k: number): ModuleSynergy => ({ with: w, kind, k })

/**
 * The catalogue (MV2a, design §1.4): a shared core of 15 (the 9 round-2 ids kept) plus 8–9 per category, tiers 1–5,
 * prerequisites, synergies and forks. Every module has a minus (upkeep, debt, a negative multiplier, heavier updates or
 * a prerequisite that costs a slot).
 * B2 (module diversity): ~20 modules sat on nearly every project. With 10 slots (MODULE_SLOTS_AT) a project now keeps
 * under half its catalogue; the pricing model is a fork per category (paywall against freemium, usagePricing and the
 * category's own seller: inAppPurchase, shop, promotedListings; usagePricing against teamPlans on web); the cheap
 * staples that every plan took first were trimmed (paywall 1.15 → 1.1, referral 1.22 → 1.15, feedback churn .94 → .96
 * and $600 → $900, onboarding churn .9 → .96, the category ARPU sellers 1.12–1.15 → 1.08–1.1, docs, sdks, reviews,
 * search, leaderboard, dailyRewards, templates, liveEvents) and the upkeep modules that never paid got cheaper bills
 * (analytics, support, notifications, cicd, seo, landingPages, sandbox, slaPlans, localization, multiRegion,
 * aiAssistant 6 → 4 %). notifications, support and cicd open at v1, so v1's 3 slots choose among ~10. Each pricing path
 * keeps a later ARPU step: adminPanel no longer needs teamPlans (the usagePricing path on web), battlePass needs
 * liveEvents instead of shop (a premium game sells a season pass too).
 */
export const MODULES: readonly ModuleDef[] = [
  // Core: the round-2 nine (same ids and effects; onboarding's upkeep 100 → 60, tiers instead of stages).
  { id: 'feedback', tier: 1, synergies: [syn('support', 'churn', 0.5)], work: 0.1, cashBase: 900, gains: { churn: 0.96, wave: 1.25, talk: 1.5 }, minus: { updateWork: 1.25 }, sizeAdd: 0, debt: 0 },
  { id: 'referral', tier: 1, synergies: [syn('onboarding', 'organic', 0.5)], work: 0.12, cashBase: 1_000, gains: { organic: 1.15 }, minus: { arpu: 0.93 }, catBoost: { game: 1.4, marketplace: 1.2 }, sizeAdd: 1, debt: 0 },
  { id: 'paywall', tier: 1, excludes: ['freemium', 'usagePricing', 'inAppPurchase', 'shop', 'promotedListings'], synergies: [syn('abTest', 'arpu', 0.5)], work: 0.1, cashBase: 600, gains: { arpu: 1.1 }, minus: { organic: 0.85, churn: 1.05 }, sizeAdd: 0, debt: 0 },
  { id: 'onboarding', tier: 2, synergies: [syn('referral', 'churn', 0.3)], work: 0.15, cashBase: 2_000, gains: { churn: 0.96, cac: 0.95 }, upkeep: stageScaled(80), sizeAdd: 1, debt: 1 },
  { id: 'analytics', tier: 1, synergies: [syn('landingPages', 'cac', 0.5)], work: 0.12, cashBase: 1_500, gains: { cac: 0.88, organic: 1.05 }, upkeep: stageScaled(90), sizeAdd: 0, debt: 0 },
  {
    id: 'freemium', tier: 2, excludes: ['paywall'], synergies: [syn('referral', 'organic', 0.3)], work: 0.15, cashBase: 1_500, gains: { organic: 1.3 }, minus: { arpu: 0.9 },
    upkeep: (s, w) => (s.stats.users / 1000) * w * 0.5 * (B.INFRA_PER_1000_BY_STAGE[s.stage] ?? 0), sizeAdd: 0, debt: 0,
  },
  { id: 'openApi', tier: 3, synergies: [syn('webhooks', 'churn', 0.5), syn('integrations', 'churn', 0.5)], work: 0.3, cashBase: 6_000, gains: { churn: 0.88, tam: 1.1 }, catBoost: { api: 1.5 }, sizeAdd: 2, debt: 3 },
  { id: 'localization', tier: 4, synergies: [syn('cityLaunch', 'tam', 0.3), syn('multiRegion', 'tam', 0.3)], work: 0.25, cashBase: 8_000, gains: { tam: 1.25 }, minus: { cac: 1.08 }, upkeep: stageScaled(200), sizeAdd: 0, debt: 0 },
  { id: 'aiAssistant', tier: 4, synergies: [syn('rag', 'arpu', 0.3)], work: 0.35, cashBase: 15_000, gains: { arpu: 1.12, churn: 0.95 }, catBoost: { ai: 1.5 }, upkeep: (_s, w, mrr) => mrr * w * 0.04, sizeAdd: 0, debt: 3 },
  // Core, new in MV2a.
  { id: 'notifications', tier: 1, synergies: [syn('dailyRewards', 'churn', 0.5)], work: 0.1, cashBase: 1_200, gains: { churn: 0.93, wave: 1.15 }, upkeep: stageScaled(50), sizeAdd: 0, debt: 0 },
  { id: 'support', tier: 1, synergies: [syn('feedback', 'churn', 0.3)], work: 0.08, cashBase: 1_500, gains: { churn: 0.92, talk: 1.3 }, upkeep: stageScaled(90), sizeAdd: 0, debt: 0 },
  { id: 'cicd', tier: 1, synergies: [syn('feedback', 'updateWork', 0.5)], work: 0.15, cashBase: 1_200, gains: { updateWork: 0.85 }, upkeep: stageScaled(30), sizeAdd: 0, debt: -1 },
  { id: 'abTest', tier: 3, requires: ['analytics'], synergies: [syn('paywall', 'arpu', 0.5)], work: 0.12, cashBase: 3_000, gains: { arpu: 1.08, cac: 0.95 }, minus: { updateWork: 1.1 }, sizeAdd: 0, debt: 0 },
  { id: 'security', tier: 3, work: 0.15, cashBase: 5_000, gains: { churn: 0.96, tam: 1.06 }, minus: { updateWork: 1.05 }, sizeAdd: 0, debt: -4 },
  { id: 'sso', tier: 5, categories: ['web', 'api', 'ai', 'marketplace'], requires: ['security'], work: 0.2, cashBase: 20_000, gains: { tam: 1.08, arpu: 1.06 }, minus: { updateWork: 1.1 }, sizeAdd: 1, debt: 2 },
  // Mobil
  { id: 'aso', tier: 1, categories: ['mobile'], work: 0.06, cashBase: 600, gains: { organic: 1.12 }, minus: { updateWork: 1.05 }, sizeAdd: 0, debt: 0 },
  { id: 'crashReports', tier: 1, categories: ['mobile'], synergies: [syn('feedback', 'churn', 0.5)], work: 0.06, cashBase: 500, gains: { churn: 0.95 }, upkeep: stageScaled(50), sizeAdd: 0, debt: 0 },
  { id: 'deepLinks', tier: 2, categories: ['mobile'], synergies: [syn('referral', 'organic', 0.5)], work: 0.1, cashBase: 1_000, gains: { organic: 1.08 }, minus: { updateWork: 1.05 }, sizeAdd: 0, debt: 0 },
  { id: 'offlineMode', tier: 2, categories: ['mobile'], work: 0.15, cashBase: 1_500, gains: { churn: 0.92 }, minus: { updateWork: 1.15 }, sizeAdd: 1, debt: 1 },
  { id: 'inAppPurchase', tier: 2, categories: ['mobile'], excludes: ['paywall'], work: 0.12, cashBase: 1_500, gains: { arpu: 1.08 }, minus: { organic: 0.96 }, sizeAdd: 0, debt: 0 },
  { id: 'widgets', tier: 3, categories: ['mobile'], synergies: [syn('notifications', 'churn', 0.3)], work: 0.12, cashBase: 3_000, gains: { churn: 0.94, wave: 1.1 }, minus: { updateWork: 1.1 }, sizeAdd: 0, debt: 0 },
  { id: 'tabletApp', tier: 3, categories: ['mobile'], work: 0.2, cashBase: 4_000, gains: { tam: 1.1 }, minus: { updateWork: 1.15 }, sizeAdd: 1, debt: 0 },
  { id: 'watchApp', tier: 4, categories: ['mobile'], requires: ['widgets'], work: 0.2, cashBase: 8_000, gains: { churn: 0.95, tam: 1.04 }, minus: { updateWork: 1.2 }, sizeAdd: 1, debt: 0 },
  // Web
  { id: 'seo', tier: 1, categories: ['web'], synergies: [syn('templates', 'organic', 0.5)], work: 0.08, cashBase: 600, gains: { organic: 1.15 }, upkeep: stageScaled(60), sizeAdd: 0, debt: 0 },
  { id: 'landingPages', tier: 1, categories: ['web'], synergies: [syn('analytics', 'cac', 0.5)], work: 0.06, cashBase: 600, gains: { cac: 0.92 }, upkeep: stageScaled(30), sizeAdd: 0, debt: 0 },
  { id: 'templates', tier: 2, categories: ['web'], work: 0.1, cashBase: 1_500, gains: { organic: 1.06, churn: 0.97 }, minus: { updateWork: 1.08 }, sizeAdd: 0, debt: 0 },
  { id: 'teamPlans', tier: 2, categories: ['web'], excludes: ['usagePricing'], synergies: [syn('paywall', 'arpu', 0.3)], work: 0.12, cashBase: 1_500, gains: { arpu: 1.08 }, minus: { organic: 0.95 }, sizeAdd: 0, debt: 0 },
  { id: 'integrations', tier: 3, categories: ['web'], synergies: [syn('openApi', 'churn', 0.5)], work: 0.2, cashBase: 4_000, gains: { churn: 0.92, tam: 1.04 }, sizeAdd: 1, debt: 2 },
  { id: 'adminPanel', tier: 3, categories: ['web'], work: 0.15, cashBase: 4_000, gains: { arpu: 1.06, churn: 0.95 }, minus: { updateWork: 1.1 }, sizeAdd: 0, debt: 0 },
  { id: 'pwa', tier: 4, categories: ['web'], work: 0.2, cashBase: 6_000, gains: { tam: 1.15 }, minus: { updateWork: 1.15 }, sizeAdd: 1, debt: 0 },
  { id: 'auditLog', tier: 5, categories: ['web'], requires: ['adminPanel'], work: 0.2, cashBase: 12_000, gains: { tam: 1.1, churn: 0.95 }, minus: { updateWork: 1.05 }, sizeAdd: 0, debt: 2 },
  // Yapay Zekâ (usagePricing is shared with api and web)
  { id: 'evals', tier: 1, categories: ['ai'], work: 0.08, cashBase: 1_000, gains: { churn: 0.95, wave: 1.1 }, minus: { updateWork: 1.15 }, sizeAdd: 0, debt: 0 },
  { id: 'usagePricing', tier: 1, categories: ['ai', 'api', 'web'], excludes: ['paywall', 'teamPlans'], work: 0.08, cashBase: 800, gains: { arpu: 1.12 }, minus: { churn: 1.04 }, sizeAdd: 0, debt: 0 },
  { id: 'rag', tier: 2, categories: ['ai'], synergies: [syn('evals', 'churn', 0.5)], work: 0.15, cashBase: 1_500, gains: { churn: 0.9 }, upkeep: stageScaled(120), sizeAdd: 1, debt: 0 },
  { id: 'modelRouter', tier: 2, categories: ['ai'], work: 0.12, cashBase: 1_500, gains: { infra: 0.85 }, minus: { churn: 1.02 }, sizeAdd: 0, debt: 0 },
  { id: 'guardrails', tier: 3, categories: ['ai'], synergies: [syn('evals', 'tam', 0.3)], work: 0.15, cashBase: 4_000, gains: { tam: 1.1, churn: 0.97 }, minus: { updateWork: 1.1 }, sizeAdd: 0, debt: 0 },
  { id: 'voiceMode', tier: 3, categories: ['ai'], work: 0.2, cashBase: 5_000, gains: { organic: 1.1, tam: 1.05 }, minus: { infra: 1.1 }, sizeAdd: 1, debt: 0 },
  { id: 'fineTune', tier: 4, categories: ['ai'], requires: ['evals'], work: 0.3, cashBase: 10_000, gains: { arpu: 1.1, churn: 0.93 }, upkeep: stageScaled(400), sizeAdd: 1, debt: 2 },
  { id: 'agents', tier: 5, categories: ['ai'], requires: ['rag'], work: 0.35, cashBase: 20_000, gains: { arpu: 1.12, organic: 1.08 }, minus: { infra: 1.15 }, sizeAdd: 2, debt: 3 },
  // API
  { id: 'docs', tier: 1, categories: ['api'], work: 0.06, cashBase: 1_200, gains: { cac: 0.96, churn: 0.97 }, minus: { updateWork: 1.05 }, sizeAdd: 0, debt: 0 },
  { id: 'rateLimit', tier: 1, categories: ['api'], work: 0.06, cashBase: 600, gains: { infra: 0.85 }, minus: { churn: 1.03 }, sizeAdd: 0, debt: 0 },
  { id: 'sdks', tier: 2, categories: ['api'], synergies: [syn('docs', 'organic', 0.5)], work: 0.15, cashBase: 1_800, gains: { organic: 1.08, churn: 0.97 }, minus: { updateWork: 1.15 }, sizeAdd: 1, debt: 0 },
  { id: 'webhooks', tier: 2, categories: ['api'], work: 0.1, cashBase: 1_200, gains: { churn: 0.92 }, sizeAdd: 0, debt: 1 },
  { id: 'sandbox', tier: 2, categories: ['api'], work: 0.1, cashBase: 1_200, gains: { cac: 0.9, organic: 1.05 }, upkeep: stageScaled(50), sizeAdd: 0, debt: 0 },
  { id: 'usageDashboard', tier: 3, categories: ['api'], synergies: [syn('usagePricing', 'churn', 0.5)], work: 0.12, cashBase: 3_000, gains: { churn: 0.94, arpu: 1.03 }, minus: { updateWork: 1.05 }, sizeAdd: 0, debt: 0 },
  { id: 'slaPlans', tier: 3, categories: ['api'], synergies: [syn('multiRegion', 'arpu', 0.3)], work: 0.1, cashBase: 4_000, gains: { arpu: 1.06, tam: 1.05 }, upkeep: stageScaled(150), sizeAdd: 0, debt: 0 },
  { id: 'multiRegion', tier: 4, categories: ['api'], requires: ['rateLimit'], work: 0.3, cashBase: 10_000, gains: { tam: 1.12, churn: 0.95 }, upkeep: stageScaled(300), sizeAdd: 1, debt: 2 },
  // Oyun
  { id: 'leaderboard', tier: 1, categories: ['game'], synergies: [syn('guilds', 'churn', 0.5)], work: 0.06, cashBase: 1_000, gains: { churn: 0.97, organic: 1.05 }, minus: { infra: 1.08 }, sizeAdd: 0, debt: 0 },
  { id: 'dailyRewards', tier: 1, categories: ['game'], synergies: [syn('notifications', 'churn', 0.5)], work: 0.06, cashBase: 600, gains: { churn: 0.93 }, minus: { arpu: 0.96 }, sizeAdd: 0, debt: 0 },
  { id: 'liveEvents', tier: 2, categories: ['game'], work: 0.1, cashBase: 1_200, gains: { wave: 1.25, churn: 0.97 }, minus: { updateWork: 1.15 }, sizeAdd: 0, debt: 0 },
  { id: 'shop', tier: 2, categories: ['game'], excludes: ['paywall'], synergies: [syn('battlePass', 'arpu', 0.3)], work: 0.12, cashBase: 1_500, gains: { arpu: 1.1 }, minus: { organic: 0.94 }, sizeAdd: 0, debt: 0 },
  { id: 'battlePass', tier: 3, categories: ['game'], requires: ['liveEvents'], work: 0.15, cashBase: 3_500, gains: { arpu: 1.08, churn: 0.96 }, minus: { updateWork: 1.2 }, sizeAdd: 0, debt: 0 },
  { id: 'guilds', tier: 3, categories: ['game'], work: 0.2, cashBase: 4_000, gains: { churn: 0.9, organic: 1.05 }, minus: { infra: 1.1 }, sizeAdd: 1, debt: 0 },
  { id: 'ugcEditor', tier: 4, categories: ['game'], work: 0.25, cashBase: 8_000, gains: { organic: 1.1, churn: 0.94 }, sizeAdd: 1, debt: 2 },
  { id: 'crossPlay', tier: 4, categories: ['game'], work: 0.3, cashBase: 9_000, gains: { tam: 1.15 }, minus: { updateWork: 1.1 }, sizeAdd: 1, debt: 3 },
  { id: 'esports', tier: 5, categories: ['game'], requires: ['leaderboard', 'guilds'], work: 0.25, cashBase: 18_000, gains: { organic: 1.12, tam: 1.05 }, upkeep: stageScaled(300), sizeAdd: 0, debt: 0 },
  // Pazar Yeri
  { id: 'reviews', tier: 1, categories: ['marketplace'], synergies: [syn('search', 'organic', 0.3)], work: 0.08, cashBase: 800, gains: { organic: 1.06 }, minus: { updateWork: 1.05 }, sizeAdd: 0, debt: 0 },
  { id: 'payments', tier: 1, categories: ['marketplace'], synergies: [syn('buyerProtection', 'churn', 0.3)], work: 0.1, cashBase: 800, gains: { churn: 0.93, arpu: 1.05 }, upkeep: stageScaled(100), sizeAdd: 0, debt: 0 },
  { id: 'sellerDashboard', tier: 2, categories: ['marketplace'], work: 0.15, cashBase: 1_500, gains: { tam: 1.1, churn: 0.95 }, minus: { updateWork: 1.1 }, sizeAdd: 1, debt: 0 },
  { id: 'search', tier: 2, categories: ['marketplace'], synergies: [syn('reviews', 'arpu', 0.5)], work: 0.12, cashBase: 2_000, gains: { arpu: 1.04, cac: 0.95 }, minus: { infra: 1.1 }, sizeAdd: 0, debt: 0 },
  { id: 'promotedListings', tier: 2, categories: ['marketplace'], excludes: ['paywall'], work: 0.08, cashBase: 1_200, gains: { arpu: 1.08 }, minus: { organic: 0.95 }, sizeAdd: 0, debt: 0 },
  { id: 'buyerProtection', tier: 3, categories: ['marketplace'], requires: ['payments'], work: 0.1, cashBase: 3_000, gains: { churn: 0.9 }, minus: { arpu: 0.97 }, sizeAdd: 0, debt: 0 },
  { id: 'shipping', tier: 3, categories: ['marketplace'], synergies: [syn('sellerDashboard', 'tam', 0.3)], work: 0.2, cashBase: 4_000, gains: { tam: 1.1, churn: 0.95 }, upkeep: stageScaled(150), sizeAdd: 1, debt: 1 },
  { id: 'recommendations', tier: 4, categories: ['marketplace'], requires: ['search'], work: 0.25, cashBase: 9_000, gains: { arpu: 1.1, organic: 1.05 }, minus: { infra: 1.1 }, sizeAdd: 1, debt: 0 },
  { id: 'cityLaunch', tier: 5, categories: ['marketplace'], synergies: [syn('localization', 'tam', 0.3)], work: 0.2, cashBase: 15_000, gains: { tam: 1.15 }, minus: { cac: 1.06 }, sizeAdd: 0, debt: 0 },
]

const MODULE_BY_ID = new Map<string, ModuleDef>(MODULES.map((m) => [m.id, m]))

export function moduleDef(id: ProjectModuleId | string): ModuleDef | undefined {
  return MODULE_BY_ID.get(id)
}

/** The module can sit on a project of this category (core ones everywhere unless they name categories). */
export function moduleOnCategory(def: ModuleDef, category: ProjectCategory): boolean {
  return !def.categories || def.categories.includes(category)
}

/** The catalogue a project of this category sees, in catalogue order. */
export function categoryModules(category: ProjectCategory): ModuleDef[] {
  return MODULES.filter((m) => moduleOnCategory(m, category))
}

export function isModuleId(id: unknown): id is ProjectModuleId {
  return typeof id === 'string' && (PROJECT_MODULE_IDS as readonly string[]).includes(id)
}

/**
 * Flags the desk bubble (W2c) keeps: the last version a project was asked about (MV2a: once per version; a new key, so
 * a round-2 save's stage-valued `modulePrompt:` flag does not silence it), and a stale module already asked about.
 */
export const modulePromptFlag = (projectId: string) => `modulePromptV:${projectId}`
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
  return 1 + (x - 1) * k * B.MODULE_EFFECT_SCALE
}

/** A module's minus on a kind, scaled like its gains (1 = none). */
export function moduleMinus(def: ModuleDef, kind: ModuleEffectKind): number {
  const x = def.minus?.[kind]
  return x === undefined ? 1 : 1 + (x - 1) * B.MODULE_EFFECT_SCALE
}

function capped(kind: ModuleEffectKind, v: number): number {
  const cap = B.MODULE_MULT_CAP[kind]
  if (cap === undefined) return v
  return B.MODULE_MULT_FLOOR_KINDS.includes(kind) ? Math.max(cap, v) : Math.min(cap, v)
}

/** Σ k of a module's synergies on `kind` whose partner is in `modules` (0 = none active). */
export function synergyK(def: ModuleDef, kind: ModuleEffectKind, modules: readonly { id: ProjectModuleId }[]): number {
  let k = 0
  for (const x of def.synergies ?? []) if (x.kind === kind && modules.some((m) => m.id === x.with)) k += x.k
  return k
}

/**
 * The capped product of a project's modules for one kind on `day` (gains faded by staleness, minuses fixed). 1 with none.
 * MV2a: a gain whose synergy partner sits in `modules` is 1 + (x − 1) × (1 + k), before staleness and the cap.
 */
export function moduleMult(p: Project, kind: ModuleEffectKind, day: number, modules: readonly ProjectModule[] | undefined = p.modules): number {
  if (!modules?.length) return 1
  let v = 1
  for (const m of modules) {
    const def = moduleDef(m.id)
    if (!def) continue
    let gain = moduleGain(def, kind, p.category)
    if (gain !== 1) {
      const k = def.synergies ? synergyK(def, kind, modules) : 0
      if (k !== 0) gain = 1 + (gain - 1) * (1 + k)
      v *= 1 + (gain - 1) * moduleStrength(m, day)
    }
    v *= moduleMinus(def, kind)
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

/** The launched project the ads promote, or undefined (no focus, or it points at a missing / unlaunched one: ignored). */
export function adFocusProject(s: GameState): Project | undefined {
  const id = s.finance.adFocus
  return id === undefined ? undefined : s.projects.find((p) => p.id === id && p.launched)
}

// A1 per-product users -----------------------------------------------------------------------------------------------

/**
 * Each launched project's share of the company's users (p.users / Σ). Equal while nobody holds any users yet (an old
 * save, the first launch): `equal` says so, and the weights then stay exactly 1 (the old flat mean, bit for bit).
 */
export function projectShares(s: GameState): { shares: { p: Project; share: number }[]; equal: boolean } {
  const live = s.projects.filter((p) => p.launched)
  let total = 0
  for (const p of live) total += Math.max(0, p.users ?? 0)
  if (!(total > 0)) return { shares: live.map((p) => ({ p, share: 1 / live.length })), equal: true }
  return { shares: live.map((p) => ({ p, share: Math.max(0, p.users ?? 0) / total })), equal: false }
}

/**
 * The launched projects and their weight in the company's ARPU / churn / organic / TAM mix: (1 − b) / n + b × share
 * (b = MIX_SHARE_BLEND). Before anyone holds users: 1 each, the flat mean.
 */
export function projectWeights(s: GameState): { p: Project; w: number }[] {
  const { shares, equal } = projectShares(s)
  if (equal) return shares.map(({ p }) => ({ p, w: 1 }))
  const b = B.MIX_SHARE_BLEND
  const n = shares.length
  return shares.map(({ p, share }) => ({ p, w: (1 - b) / n + b * share }))
}

/**
 * Ad weights: AD_FOCUS_WEIGHT for the focus, 1 for the others. They split the paid users and weigh the CAC's module mix.
 * `focus` overrides s.finance.adFocus (null = the whole company) for the previews.
 */
export function adWeights(s: GameState, focus?: ProjectId | null): { p: Project; w: number }[] {
  const id = focus === undefined ? adFocusProject(s)?.id : focus ?? undefined
  return s.projects.filter((p) => p.launched).map((p) => ({ p, w: p.id === id ? B.AD_FOCUS_WEIGHT : 1 }))
}

/** CAC factor of the focus change still settling: AD_FOCUS_WARMUP_CAC on the day, linear to 1 at AD_FOCUS_WARMUP_DAYS. */
export function adFocusWarmup(s: GameState): number {
  const day = s.finance.adFocusDay
  if (day === undefined) return 1
  const left = 1 - (s.time.day - day) / B.AD_FOCUS_WARMUP_DAYS
  return left > 0 ? 1 + (B.AD_FOCUS_WARMUP_CAC - 1) * Math.min(1, left) : 1
}

/** One product's part of today's flows: fractions of the paid and organic users (each sums to 1 over the launched). */
export interface FlowPart {
  p: Project
  paid: number
  organic: number
}

/**
 * How new users split over the launched products: paid by ad weight; organic by (share + ORGANIC_SHARE_FLOOR) ×
 * category organic × organic modules. `focus` as in adWeights.
 */
export function flowSplit(s: GameState, focus?: ProjectId | null): FlowPart[] {
  const ads = adWeights(s, focus)
  const { shares } = projectShares(s)
  const day = s.time.day
  let adTotal = 0
  for (const a of ads) adTotal += a.w
  const org = shares.map(({ p, share }) => (share + B.ORGANIC_SHARE_FLOOR) * (B.CATEGORY_ORGANIC[p.category] ?? 1) * moduleMult(p, 'organic', day))
  let orgTotal = 0
  for (const o of org) orgTotal += o
  return ads.map(({ p, w }, i) => ({ p, paid: adTotal > 0 ? w / adTotal : 0, organic: orgTotal > 0 ? org[i]! / orgTotal : 0 }))
}

/**
 * Keeps Σ p.users = stats.users (A1): any direct change to the company's users (a card's effect, a percent, a rival
 * bought) lands on the products in proportion; with nobody holding users yet, they split equally among the launched
 * ones. Unlaunched projects hold none. Called at the start of every tick's user flow.
 */
export function syncProjectUsers(s: GameState): void {
  const live = s.projects.filter((p) => p.launched)
  if (live.length === 0) return
  const want = Math.max(0, s.stats.users)
  let total = 0
  for (const p of live) total += Math.max(0, p.users ?? 0)
  if (Math.abs(total - want) <= 1e-9 * Math.max(1, want) && live.every((p) => p.users !== undefined)) return
  if (total > 0) {
    const k = want / total
    for (const p of live) p.users = Math.max(0, p.users ?? 0) * k
  } else {
    for (const p of live) p.users = want / live.length
  }
}

/** Users that walk into one product (a release wave, a manual find): its stock and its acquired counter. */
export function addProjectUsers(p: Project, n: number): void {
  if (!(n > 0)) return
  p.users = (p.users ?? 0) + n
  p.acq = (p.acq ?? 0) + n
}

/**
 * One tick of the user flow per product (A1): paid by ad weight, organic by flowSplit, churn by users × the product's
 * churn modules (normalized so Σ = the company's churned users), revenue by users × its ARPU factors (Σ = self-serve
 * revenue). Writes p.users / acq / lost / rev; the company stock is moved by the caller.
 */
export function flowProjectUsers(s: GameState, paid: number, organic: number, lost: number, revenue: number): void {
  const parts = flowSplit(s)
  if (parts.length === 0) return
  const day = s.time.day
  let churnW = 0
  let revW = 0
  const cw: number[] = []
  const rw: number[] = []
  for (const { p } of parts) {
    const u = Math.max(0, p.users ?? 0)
    const c = u * moduleMult(p, 'churn', day)
    const r = u * (B.CATEGORY_ARPU[p.category] ?? 1) * moduleMult(p, 'arpu', day)
    cw.push(c)
    rw.push(r)
    churnW += c
    revW += r
  }
  parts.forEach((part, i) => {
    const p = part.p
    const inflow = paid * part.paid + organic * part.organic
    const out = churnW > 0 ? (lost * cw[i]!) / churnW : 0
    p.users = Math.max(0, (p.users ?? 0) + inflow - out)
    p.acq = (p.acq ?? 0) + inflow
    p.lost = (p.lost ?? 0) + out
    if (revenue > 0 && revW > 0) p.rev = (p.rev ?? 0) + (revenue * rw[i]!) / revW
  })
}

/** Month end (A1): each launched product's counters, whole numbers, the last PROJECT_SNAPS_MAX kept. */
export function snapProjects(s: GameState): void {
  for (const p of s.projects) {
    if (!p.launched || p.acq === undefined) continue
    const list = (p.snaps ??= [])
    list.push({ day: Math.floor(s.time.day), acq: Math.round(p.acq), lost: Math.round(p.lost ?? 0), rev: Math.round(p.rev ?? 0) })
    if (list.length > B.PROJECT_SNAPS_MAX) list.splice(0, list.length - B.PROJECT_SNAPS_MAX)
  }
}

/**
 * Paid users a month under `focus`: today's paid channel at the CAC the focus's ad weights give, module mix × category
 * factor per product as derive.ts weighs them (B1: web's cheaper ads move the chip too); the warm-up is left out on
 * both sides.
 */
export function focusPaidTotal(s: GameState, focus: ProjectId | null): number {
  const day = s.time.day
  const paid = s.derived.channels.paid
  const cacMix = (ws: { p: Project; w: number }[]) => wMean(ws, (p) => moduleMult(p, 'cac', day)) * wMean(ws, (p) => B.CATEGORY_CAC[p.category] ?? 1)
  const cur = cacMix(adWeights(s))
  const next = cacMix(adWeights(s, focus))
  return next > 0 ? (paid * cur) / next : paid
}

/** Each launched product's paid users a month under `focus` (the focus chips: "Tılsım'a +40 kullanıcı/30g"). */
export function focusPaidSplit(s: GameState, focus: ProjectId | null): Record<string, number> {
  const total = focusPaidTotal(s, focus)
  const out: Record<string, number> = {}
  for (const part of flowSplit(s, focus)) out[part.p.id] = total * part.paid
  return out
}

/**
 * Estimated MRR `months` from now if the ads promoted `focus` (null = the company), no warm-up and no tick: each
 * product's users go forward with its own acquisition (paid by the focus's ad weights at the CAC its module mix gives,
 * organic as today), its own churn and its own ARPU. 0 months = today's MRR. For the focus chips and the bots.
 */
export function focusPreview(s: GameState, focus: ProjectId | null, months = 3): number {
  const parts = flowSplit(s, focus)
  const enterprise = s.finance.enterpriseCustomers.reduce((a, e) => a + e.mrr, 0)
  if (parts.length === 0) return s.finance.mrr
  const day = s.time.day
  const ch = s.derived.channels
  const paid = focusPaidTotal(s, focus)
  const { shares } = projectShares(s)
  const ws = projectWeights(s)
  const arpuRel = (p: Project) => (B.CATEGORY_ARPU[p.category] ?? 1) * moduleMult(p, 'arpu', day)
  const churnRel = (p: Project) => moduleMult(p, 'churn', day)
  const arpuMix = wMean(ws, arpuRel)
  const churnMix = wMean(ws, churnRel)
  const users = shares.map(({ p, share }) => (p.users !== undefined ? Math.max(0, p.users) : share * s.stats.users))
  const arpu = parts.map(({ p }) => (arpuMix > 0 ? (s.stats.arpu * arpuRel(p)) / arpuMix : s.stats.arpu))
  const churn = parts.map(({ p }) => Math.min(1, churnMix > 0 ? (s.stats.churn * churnRel(p)) / churnMix : s.stats.churn))
  for (let m = 0; m < months; m++) {
    parts.forEach((part, i) => {
      users[i] = Math.max(0, users[i]! * (1 - churn[i]!) + paid * part.paid + (ch.organic + ch.manual) * part.organic)
    })
  }
  let mrr = enterprise
  parts.forEach((_, i) => (mrr += users[i]! * arpu[i]!))
  return mrr
}

/**
 * Σ w_p × f(p) / Σ w_p over the launched projects (1 before the first launch). With equal weights (no modules, equal
 * shares) this is categoryMix bit for bit: the same running sum divided by n.
 */
export function wMean(ws: readonly { p: Project; w: number }[], f: (p: Project) => number): number {
  if (ws.length === 0) return 1
  const w0 = ws[0]!.w
  if (ws.every((x) => x.w === w0)) {
    let sum = 0
    for (const { p } of ws) sum += f(p)
    return sum / ws.length
  }
  let sum = 0
  let total = 0
  for (const { p, w } of ws) {
    sum += w * f(p)
    total += w
  }
  return sum / total
}

/**
 * derived.projectMix (once a project is live): each launched project's normalized mix weight, its capped multipliers
 * (≠ 1 only), its upkeep, and (A1) its users, share and today's paid / organic users a month (`paid` / `organic`: the
 * company's channels).
 */
export function projectMix(s: GameState, mrr = s.finance.mrr, ws = projectWeights(s), paid = s.derived.channels?.paid ?? 0, organic = s.derived.channels?.organic ?? 0): Record<string, ProjectMixView> {
  const total = ws.reduce((a, x) => a + x.w, 0)
  const { shares } = projectShares(s)
  const split = flowSplit(s)
  const out: Record<string, ProjectMixView> = {}
  ws.forEach(({ p, w }, i) => {
    const weight = w / total
    const mult: Partial<Record<ModuleEffectKind, number>> = {}
    for (const kind of p.modules?.length ? MODULE_KINDS : []) {
      const v = moduleMult(p, kind, s.time.day)
      if (v !== 1) mult[kind] = v
    }
    const part = split[i]!
    out[p.id] = {
      weight,
      mult,
      upkeep: p.modules?.length ? moduleUpkeep(s, p, weight, mrr) : 0,
      users: Math.round(Math.max(0, p.users ?? shares[i]!.share * s.stats.users)),
      share: shares[i]!.share,
      paidPerMonth: paid * part.paid,
      organicPerMonth: organic * part.organic,
    }
  })
  return out
}

// MV2a version cycle ----------------------------------------------------------------------------------------------

/** Slots a project has in all at version v (MODULE_SLOTS_AT, flat past its last entry; 0 before v1). */
export function slotsAt(v: number): number {
  const at = B.MODULE_SLOTS_AT
  return at[Math.max(0, Math.min(at.length - 1, Math.floor(v)))]!
}

/** Slots version v opens on its release (3 at v1 and v2, then fewer; 0 past the cap). */
export function slotsOpened(v: number): number {
  return Math.max(0, slotsAt(v) - slotsAt(v - 1))
}

/**
 * The project's version: 0 before its first 1.0, then 1, 2 … (checkReleases writes p.version). An old save at 1.0
 * without the field reads as the smallest v whose slots hold its modules and a running new build (at least 1, at
 * most the slot cap's version), so what it was allowed under the old stage table always fits. B2: a save that
 * installed more than the cap keeps them all; only a new build meets noFreeSlot.
 */
export function projectVersion(p: Project): number {
  if (p.version !== undefined) return p.version
  if (!p.launched || p.maturity < 1) return 0
  const used = (p.modules?.length ?? 0) + (p.build && !p.build.refresh ? 1 : 0)
  const last = B.MODULE_SLOTS_AT.length - 1
  let v = 1
  while (v < last && slotsAt(v) < used) v++
  return v
}

/** Updates the line after version v needs: min(VERSION_UPDATES_MAX, VERSION_UPDATES_BASE^v) (v1 → v2: 2). */
export function versionUpdates(v: number): number {
  return Math.min(B.VERSION_UPDATES_MAX, B.VERSION_UPDATES_BASE ** Math.max(0, v))
}

/** 0–1 through the current version line: (lineUpdates + updateProgress / updateSize) / versionUpdates(v). 0 for v 0. */
export function versionProgress(s: GameState, p: Project): number {
  const v = projectVersion(p)
  if (v === 0) return 0
  const size = updateSize(p, s.time.day)
  const part = size > 0 ? Math.min(1, Math.max(0, p.updateProgress ?? 0) / size) : 0
  return Math.min(1, ((p.lineUpdates ?? 0) + part) / versionUpdates(v))
}

/** What the project bar shows: p.maturity before v1, then VERSION_FLOOR + (1 − VERSION_FLOOR) × versionProgress. */
export function displayMaturity(s: GameState, p: Project): number {
  if (projectVersion(p) === 0) return p.maturity
  return B.VERSION_FLOOR + (1 - B.VERSION_FLOOR) * versionProgress(s, p)
}

/**
 * Slots on a project: used (installed + a new build) of total (slotsAt(version)). An old save above the cap shows
 * used = total (the extra modules stay installed, no new one fits).
 */
export function projectSlots(_s: GameState, p: Project): { used: number; total: number } {
  const total = slotsAt(projectVersion(p))
  const used = Math.min(total, (p.modules?.length ?? 0) + (p.build && !p.build.refresh ? 1 : 0))
  return { used, total }
}

/** Why a module is not open on this project yet (or never): the UI names it ("v3'te", "Önce Analitik", "Paywall ile olmaz"). */
export type ModuleLock = { kind: 'version'; v: number } | { kind: 'requires'; ids: ProjectModuleId[] } | { kind: 'excluded'; by: ProjectModuleId }

/**
 * The lock on a module for this project, or null (open, or installed). Order: excluded by an installed module (for
 * good), the version its tier needs, then the prerequisites still missing. Category is not a lock: other categories'
 * modules are simply not offered.
 */
export function moduleLock(_s: GameState, p: Project, id: ProjectModuleId): ModuleLock | null {
  const def = moduleDef(id)
  if (!def) return null
  const mods = p.modules ?? []
  if (mods.some((m) => m.id === id)) return null
  const by = mods.find((m) => def.excludes?.includes(m.id) || moduleDef(m.id)?.excludes?.includes(id))
  if (by) return { kind: 'excluded', by: by.id }
  if (projectVersion(p) < def.tier) return { kind: 'version', v: def.tier }
  const missing = (def.requires ?? []).filter((r) => !mods.some((m) => m.id === r))
  if (missing.length) return { kind: 'requires', ids: missing }
  return null
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
 * project), invalid (unknown, wrong category, already there, excluded), notUnlocked (not live and 1.0; a new build also
 * below its tier's version or with a prerequisite missing), slotOccupied (a build runs), noFreeSlot (build only),
 * insufficientCash, noEnergy (garage) / noMoves. Pure: offers and actions share it.
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
    if (!moduleOnCategory(def, p.category)) return 'invalid'
    if (has) return 'invalid'
    if (mods.some((m) => def.excludes?.includes(m.id) || moduleDef(m.id)?.excludes?.includes(id))) return 'invalid'
  }
  if (!p.launched || p.maturity < 1 || projectVersion(p) < 1) return 'notUnlocked'
  // An installed module refreshes whatever its tier (an old save may hold one above its version).
  if (!refresh && (projectVersion(p) < def.tier || def.requires?.some((r) => !mods.some((m) => m.id === r)))) return 'notUnlocked'
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

/** Every module of the project's category: the ones it lacks (build) and the ones it has (refresh), each priced and checked. */
export function moduleOffers(s: GameState, p: Project): ModuleOffer[] {
  const rate = s.derived.maturityPerDay?.[p.id] ?? 0
  const has = new Set((p.modules ?? []).map((m) => m.id))
  return categoryModules(p.category).map((def) => {
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
  // MV2a: the servers' share of the MRR prices an infra module.
  const servers = Math.min(1, (s.finance.burnBreakdown?.infra ?? 0) / Math.max(mrr, 1))
  const gain = (d('arpu') - 1) + 1.5 * (1 - d('churn')) + 0.5 * (d('organic') - 1) + ads * (1 - d('cac')) + pen * (d('tam') - 1) + servers * (1 - d('infra'))
  return (weight * gain) / (cost / Math.max(mrr, 1))
}

/**
 * The one module the desk suggests for a project (a hint, not a rule): among those it can build now, the best
 * weight × [(arpu − 1) + 1.5 (1 − churn) + 0.5 (organic − 1) + ads (1 − cac) + pen (tam − 1) + servers (1 − infra)] per
 * month of MRR it costs,
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

const LOWER_IS_BETTER: readonly ModuleEffectKind[] = ['churn', 'cac', 'updateWork', 'infra']

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
  const minuses = MODULE_KINDS.flatMap((k): [ModuleEffectKind, number][] => (def.minus?.[k] !== undefined ? [[k, moduleMinus(def, k)]] : []))
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
 * product at 1.0 with a free slot, no build running and a module the till affords, not asked yet at this version
 * (flags modulePromptV:{id} < version; MV2a: was once per stage), or an installed module under MODULE_ASK_STRENGTH not asked about at this build
 * (flags moduleStale:{id}:{module} ≠ its day). Pure: the world bubble and its content both read it.
 */
export function moduleAsk(s: GameState): ModuleAsk | null {
  for (const p of s.projects) {
    if (!p.launched || p.maturity < 1 || p.build) continue
    for (const m of p.modules ?? []) {
      if (moduleStrength(m, s.time.day) >= MODULE_ASK_STRENGTH || s.flags[moduleStaleFlag(p.id, m.id)] === m.day) continue
      if (!moduleError(s, p, m.id, true)) return { projectId: p.id, moduleId: m.id, stale: true }
    }
    if (Number(s.flags[modulePromptFlag(p.id)] ?? -1) >= projectVersion(p)) continue
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

/** A module's monthly upkeep if it were built on this project now, at its weight in the mix (0 for modules with none). */
export function moduleUpkeepHint(s: GameState, p: Project, id: ProjectModuleId): number {
  const ws = projectWeights(s)
  const total = ws.reduce((a, x) => a + x.w, 0)
  const weight = total > 0 ? (ws.find((x) => x.p.id === p.id)?.w ?? 0) / total : 0
  return Math.round(moduleDef(id)?.upkeep?.(s, weight, s.finance.mrr) ?? 0)
}

// MV2a estimate (§2.1) --------------------------------------------------------------------------------------------

/** What a module would do to the company now: the offer card's numbers (design §2.1). */
export interface ModuleEstimate {
  /** Users per month gained (organic + paid change + users kept by lower churn). Negative = lost. */
  users: number
  /** MRR change now (ARPU change on today's users), $ per month. */
  mrr: number
  /** Infra saved (+) or added (−), $ per month, without the module's own upkeep. */
  infra: number
  /** Market size change, people. */
  tam: number
  /** Users per update wave on this project. */
  wave: number
  /** Monthly upkeep it adds. */
  upkeep: number
  /** users × ARPU + mrr + infra − upkeep: the one $ figure the player compares. */
  net: number
  /** Why the headline gain is ~0 right now, if it is. */
  zero?: 'organicZero' | 'noAds' | 'capped' | 'noUsers' | 'gapBound'
  /** Points a synergy adds (for "X ile +%N"), and the partner (installed first, else one the category offers). */
  synergy?: { with: ProjectModuleId; pct: number }
}

interface EstimateBase {
  s: GameState
  memo: Map<string, ModuleEstimate>
}

/**
 * Per state object: the recomputed base clone and the estimates already made (the key carries what they read). The key
 * leaves out cash, techDebt, the team mix and modifiers: the store hands a new state object every tick, so it only goes
 * stale if a caller mutates one state in place within a day and asks again.
 */
const ESTIMATES = new WeakMap<GameState, { key: string; base: EstimateBase }>()

function estimateKey(s: GameState): string {
  const mods = s.projects.map((p) => `${p.id}:${(p.modules ?? []).map((m) => `${m.id}@${m.day}`).join(',')}:${p.users ?? ''}:${p.updateProgress ?? ''}`).join('|')
  return `${s.time.day}|${s.stats.users}|${s.finance.adBudget}|${s.finance.adFocus ?? ''}|${s.stage}|${mods}`
}

function estimateBase(s: GameState, content: EngineContent): EstimateBase {
  const key = estimateKey(s)
  const hit = ESTIMATES.get(s)
  if (hit && hit.key === key) return hit.base
  const b = clone(s)
  recomputeDerived(b, content)
  const base = { s: b, memo: new Map<string, ModuleEstimate>() }
  ESTIMATES.set(s, { key, base })
  return base
}

/** The synergy chip for a module on this project: an installed partner first, else the first one its category offers. */
function estimateSynergy(p: Project, def: ModuleDef): ModuleEstimate['synergy'] {
  let pick: ModuleSynergy | undefined
  for (const x of def.synergies ?? []) {
    const partner = moduleDef(x.with)
    if (!partner || !moduleOnCategory(partner, p.category)) continue
    if (p.modules?.some((m) => m.id === x.with)) {
      pick = x
      break
    }
    pick ??= x
  }
  if (!pick) return undefined
  const x = moduleGain(def, pick.kind, p.category)
  return { with: pick.with, pct: Math.max(1, Math.round(Math.abs(x - 1) * pick.k * 100)) }
}

/**
 * The counterfactual (design §2.1): the company recomputed with the module on this project against the company without
 * it, both on clones (recomputeDerived; nothing ticks). A module the project lacks is added today; an installed one is
 * taken out of the "before" side, so the slot can show what it does now (the infra line). users = Δ(organic + paid) +
 * users × −Δchurn, mrr = users × ΔARPU, infra = −Δ servers (the module's own upkeep apart), tam = ΔTAM, wave =
 * Δ updateWave on this project. `zero` names why the headline gain is ~0 (only when |users| < 0.5 and
 * |net + upkeep| < $1). Memoized per state.
 */
export function moduleEstimate(s: GameState, p: Project, id: ProjectModuleId, content: EngineContent): ModuleEstimate {
  const base = estimateBase(s, content)
  const memoKey = `${p.id}|${id}`
  const hit = base.memo.get(memoKey)
  if (hit) return hit
  const def = moduleDef(id)
  const cur = base.s
  const cp = cur.projects.find((x) => x.id === p.id)
  if (!cp || !def) {
    const none: ModuleEstimate = { users: 0, mrr: 0, infra: 0, tam: 0, wave: 0, upkeep: 0, net: 0 }
    base.memo.set(memoKey, none)
    return none
  }
  const installed = cp.modules?.some((m) => m.id === id) === true
  const other = clone(cur)
  const op = other.projects.find((x) => x.id === p.id)!
  if (installed) op.modules = op.modules!.filter((m) => m.id !== id)
  else (op.modules ??= []).push({ id, day: other.time.day })
  recomputeDerived(other, content)
  const [b, bp, a, ap] = installed ? [other, op, cur, cp] : [cur, cp, other, op]
  const users = b.stats.users
  const flow = (x: GameState) => x.derived.channels.organic + x.derived.channels.paid
  const dUsers = flow(a) - flow(b) + users * (b.stats.churn - a.stats.churn)
  const mrr = users * (a.stats.arpu - b.stats.arpu)
  const weight = a.derived.projectMix?.[p.id]?.weight ?? 0
  const upkeep = def.upkeep?.(a, weight, a.finance.mrr) ?? 0
  const infra = b.finance.burnBreakdown.infra - (a.finance.burnBreakdown.infra - upkeep)
  const tam = (a.derived.tam ?? 0) - (b.derived.tam ?? 0)
  const wave = updateWave(a, ap) - updateWave(b, bp)
  const net = dUsers * b.stats.arpu + mrr + infra - upkeep
  const out: ModuleEstimate = { users: dUsers, mrr, infra, tam, wave, upkeep, net }
  if (Math.abs(dUsers) < 0.5 && Math.abs(net + upkeep) < 1) {
    const zero = estimateZero(b, bp, def, ap.modules ?? [])
    if (zero) out.zero = zero
  }
  const synergy = estimateSynergy(bp, def)
  if (synergy) out.synergy = synergy
  base.memo.set(memoKey, out)
  return out
}

/** First match: organic with no word of mouth, cac with no ads, a product with < 1% of the users, a capped kind, an update gap. */
function estimateZero(s: GameState, p: Project, def: ModuleDef, after: readonly ProjectModule[]): ModuleEstimate['zero'] {
  const kind = moduleHeadlines(def.id, p.category).gain?.kind
  if (!kind) return undefined
  if (kind === 'organic' && s.derived.channels.organic < 0.5) return 'organicZero'
  if (kind === 'cac' && !(s.finance.adBudget > 0)) return 'noAds'
  const share = projectShares(s).shares.find((x) => x.p.id === p.id)?.share ?? 0
  if (s.stats.users <= 0 || share < 0.01) return 'noUsers'
  const day = s.time.day
  const now = moduleMult(p, kind, day)
  if (Math.abs(moduleMult(p, kind, day, after) - now) < 0.001 * now) return 'capped'
  if (kind === 'updateWork' && (p.updateProgress ?? 0) >= updateSize(p, day) - 1e-9) return 'gapBound'
  return undefined
}

// MV2a measured effect (§2.2) ----------------------------------------------------------------------------------------

const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * A new build's "before" (finishModule): the product's counters today (whole numbers) and their 30-day rate from the
 * oldest month-end snapshot at least MODULE_MEASURE_MIN_DAYS old (null when the product is too young for one).
 */
export function moduleMeasureBase(s: GameState, p: Project): ModuleMeasureBase {
  const day = Math.floor(s.time.day)
  const now: ModuleCounters = { acq: Math.round(p.acq ?? 0), lost: Math.round(p.lost ?? 0), rev: Math.round(p.rev ?? 0) }
  let rate: ModuleCounters | null = null
  for (const snap of p.snaps ?? []) {
    const span = day - snap.day
    if (span < B.MODULE_MEASURE_MIN_DAYS) continue
    const k = B.MODULE_MEASURE_DAYS / span
    rate = { acq: round2((now.acq - snap.acq) * k), lost: round2((now.lost - snap.lost) * k), rev: round2((now.rev - snap.rev) * k) }
    break
  }
  return { day, ...now, rate }
}

/** What the slot shows (MV2c): the counters gained since delivery (frozen after MODULE_MEASURE_DAYS) and the rate before. */
export interface ModuleMeasured {
  /** 'live' inside the first MODULE_MEASURE_DAYS, 'frozen' after. */
  phase: 'live' | 'frozen'
  /** Days measured so far (MODULE_MEASURE_DAYS once frozen). */
  days: number
  /** Users acquired, users lost and revenue ($) since delivery. */
  delta: ModuleCounters
  /** The 30-day rate before delivery, or null (too young: drop "öncesi"). */
  before: ModuleCounters | null
}

/** null for a module without a base (built before MV2a, or a refresh-only history). */
export function moduleMeasured(s: GameState, p: Project, m: ProjectModule): ModuleMeasured | null {
  const base = m.base
  if (!base) return null
  const at = m.after ?? { acq: p.acq ?? 0, lost: p.lost ?? 0, rev: p.rev ?? 0 }
  return {
    phase: m.after ? 'frozen' : 'live',
    days: m.after ? B.MODULE_MEASURE_DAYS : Math.max(0, Math.min(B.MODULE_MEASURE_DAYS, Math.floor(s.time.day) - base.day)),
    delta: { acq: Math.round(at.acq - base.acq), lost: Math.round(at.lost - base.lost), rev: Math.round(at.rev - base.rev) },
    before: base.rate,
  }
}
