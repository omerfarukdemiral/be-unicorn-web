// Shared engine helpers: content context, id/activity/event writers, modifier queries.
import type { ContentBundle, FurnitureItem, Policy, PolicyEffect } from '../content/index'
import { ACTIVITY_MAX, EVENTS_MAX, LAST_STAGE, POLICY_NEVER_SIGNED } from './balance'
import type { ActivityKind, GameEvent, GameState, ModifierKind, PolicyKind, PolicyState, StageBaseline } from './types'

/** The slice of content the engine reads. Tests inject fakes. */
export type EngineContent = Pick<ContentBundle, 'concepts' | 'decisions' | 'furniture' | 'officeLines' | 'employeeNames' | 'goals' | 'crises' | 'policies'>

export function clone<T>(v: T): T {
  return structuredClone(v)
}

export function nextId(s: GameState): number {
  const id = s.nextId
  s.nextId += 1
  return id
}

export function newId(s: GameState, prefix: string): string {
  return `${prefix}${nextId(s)}`
}

export function pushActivity(s: GameState, kind: ActivityKind, params?: Record<string, string | number>): void {
  s.activity.push({ id: nextId(s), day: s.time.day, kind, ...(params ? { params } : {}) })
  if (s.activity.length > ACTIVITY_MAX) s.activity.splice(0, s.activity.length - ACTIVITY_MAX)
}

export function pushEvent(s: GameState, ev: Omit<GameEvent, 'id' | 'day'>): void {
  s.events.push({ id: nextId(s), day: s.time.day, ...ev })
  if (s.events.length > EVENTS_MAX) s.events.splice(0, s.events.length - EVENTS_MAX)
}

export function incCounter(s: GameState, key: keyof GameState['counters'], by = 1): void {
  s.counters[key] = (s.counters[key] ?? 0) + by
}

/** Product of active multiplier modifiers of a kind (morale handled separately). */
export function modifierMult(s: GameState, kind: ModifierKind): number {
  let m = 1
  for (const mod of s.modifiers) if (mod.kind === kind && mod.untilDay > s.time.day) m *= mod.value
  return m
}

/** Sum of active additive morale modifiers. */
export function moraleModifierSum(s: GameState): number {
  let sum = 0
  for (const mod of s.modifiers) if (mod.kind === 'morale' && mod.untilDay > s.time.day) sum += mod.value
  return sum
}

/** The Kanun Kitabı, defaulted lazily for older saves (GAMEPLAY V2 §3.1). Mutates: engine paths only. */
export function policiesOf(s: GameState): PolicyState {
  return (s.policies ??= { adopted: [], lastSignedDay: POLICY_NEVER_SIGNED })
}

/**
 * A later round can still close (GAMEPLAY V2 §7.2 deferred-pay): from Series C on no round pays the held wages back,
 * so a payLater policy cannot be signed there and a signed one holds nothing back any more.
 */
export function payLaterOpen(s: GameState): boolean {
  return s.stage < LAST_STAGE - 1
}

/** Signed policies with their content (a signed id the content lacks is skipped: fakes without policies). */
export function adoptedPolicies(s: GameState, content: EngineContent): Policy[] {
  const ids = s.policies?.adopted ?? []
  if (!ids.length || !content.policies?.length) return []
  return content.policies.filter((p) => ids.includes(p.id))
}

/** Product of the signed policies' multipliers of a kind (GAMEPLAY V2 §7.2; 1 = none signed). */
export function policyMult(s: GameState, content: EngineContent, kind: PolicyKind): number {
  let m = 1
  for (const p of adoptedPolicies(s, content)) m *= p.effect.mult?.[kind] ?? 1
  return m
}

type PolicySumKey = 'moraleTarget' | 'movesBonus' | 'candidates' | 'techDebtMonthly' | 'burnAsk'

/** Sum of an additive policy term over the signed policies. */
export function policySum(s: GameState, content: EngineContent, key: PolicySumKey): number {
  let sum = 0
  for (const p of adoptedPolicies(s, content)) sum += (p.effect as Pick<PolicyEffect, PolicySumKey>)[key] ?? 0
  return sum
}

/** A signed policy carries this effect flag (noRaises…). */
export function policyHas(s: GameState, content: EngineContent, key: 'noRaises' | 'payLater'): boolean {
  return adoptedPolicies(s, content).some((p) => p.effect[key] === true)
}

/** Lowest quality ceiling over the signed policies (Infinity = none). */
export function policyQualityCap(s: GameState, content: EngineContent): number {
  let cap = Infinity
  for (const p of adoptedPolicies(s, content)) if (p.effect.qualityCap !== undefined) cap = Math.min(cap, p.effect.qualityCap)
  return cap
}

export function furnitureById(content: EngineContent, id: string | undefined): FurnitureItem | undefined {
  if (id === undefined) return undefined
  return content.furniture.find((f) => f.id === id)
}

export function uniquePush<T>(list: T[], v: T): boolean {
  if (list.includes(v)) return false
  list.push(v)
  return true
}

/** Where the current stage starts: stage goals measure what is done from here (review fix: goals done on arrival). */
export function stageBaseline(s: GameState): StageBaseline {
  return {
    stage: s.stage,
    day: s.time.day,
    users: s.stats.users,
    team: s.employees.length,
    releases: s.releaseCount ?? 0,
    mrr: s.finance.mrr,
    projects: s.projects.length,
  }
}

