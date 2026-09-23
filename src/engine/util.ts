// Shared engine helpers: content context, id/activity/event writers, modifier queries.
import type { ContentBundle, FurnitureItem } from '../content/index'
import { ACTIVITY_MAX, EVENTS_MAX } from './balance'
import type { ActivityKind, GameEvent, GameState, ModifierKind } from './types'

/** The slice of content the engine reads. Tests inject fakes. */
export type EngineContent = Pick<ContentBundle, 'concepts' | 'decisions' | 'furniture' | 'officeLines' | 'employeeNames' | 'goals'>

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

export function furnitureById(content: EngineContent, id: string | undefined): FurnitureItem | undefined {
  if (id === undefined) return undefined
  return content.furniture.find((f) => f.id === id)
}

export function uniquePush<T>(list: T[], v: T): boolean {
  if (list.includes(v)) return false
  list.push(v)
  return true
}
