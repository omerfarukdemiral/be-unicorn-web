// Minimal fake content for engine tests (independent of the content lane).
import type { Concept, CrisisDef, DecisionCard, FurnitureItem } from '../../content/index'
import type { StageIndex } from '../types'
import type { EngineContent } from '../util'

export const DESK: FurnitureItem = {
  id: 'desk-basic', name: 'd', description: 'd', slotType: 'desk', size: 1, tier: 1, price: 500, stageUnlock: 0,
  upgradesTo: 'desk-ergo', effects: { deskQuality: 1 }, visual: { shape: 'desk', colors: { primary: '#fff' } },
}
export const DESK_ERGO: FurnitureItem = { ...DESK, id: 'desk-ergo', tier: 2, price: 1500, effects: { deskQuality: 1.15 } }
delete (DESK_ERGO as { upgradesTo?: string }).upgradesTo
export const COFFEE: FurnitureItem = {
  id: 'coffee', name: 'c', description: 'c', slotType: 'common', size: 1, tier: 1, price: 800, stageUnlock: 1,
  effects: { moraleAura: 5 }, visual: { shape: 'coffee', colors: { primary: '#fff' } },
}
export const MEETING: FurnitureItem = {
  id: 'meeting', name: 'm', description: 'm', slotType: 'room', size: 2, tier: 1, price: 4000, stageUnlock: 2,
  effects: { coordinationFix: true }, visual: { shape: 'meeting', colors: { primary: '#fff' } },
}

/** `crises` stays optional (GAMEPLAY V2 §3 md.9): without it the calendar still keeps its dates, quietly. */
export function fakeContent(over: Partial<EngineContent> = {}): EngineContent {
  return {
    concepts: [],
    decisions: [],
    furniture: [DESK, DESK_ERGO, COFFEE, MEETING],
    officeLines: [],
    employeeNames: ['Ada', 'Bora', 'Cem', 'Duru', 'Eda', 'Figen', 'Gül', 'Hale'],
    ...over,
  }
}

export function fakeConcept(id: Concept['id'], trigger: Concept['trigger'], extra: Partial<Concept> = {}): Concept {
  return {
    id, stage: 0, trigger, speaker: 'mentor', bubble: 'b',
    card: { what: 'w', where: () => 'x', rule: 'r' }, shelfColor: '#000', ...extra,
  }
}

export function fakeCard(id: string, extra: Partial<DecisionCard> = {}): DecisionCard {
  return {
    id, stage: 0, category: 'normal', speaker: 'mentor', question: 'q',
    options: [
      { label: 'a', tradeoff: { gain: 'g', cost: 'c' }, effects: { cash: 1000 }, reflection: 'r' },
      { label: 'b', tradeoff: { gain: 'g', cost: 'c' }, effects: { morale: 5 }, delayed: { days: 5, effects: { users: 50 }, note: 'n' }, reflection: 'r' },
    ],
    ...extra,
  }
}

/** A crisis for calendar tests: churn × (1 + 0.5 × severity) for 90 days, and its card `card-<id>`. */
export function fakeCrisis(id: string, stage: StageIndex, extra: Partial<CrisisDef> = {}): CrisisDef {
  return {
    id, stage, name: id, cardId: `card-${id}`,
    effects: (_s, sev) => ({ modifiers: [{ kind: 'churn', value: 1 + 0.5 * sev, days: 90 }] }),
    ...extra,
  }
}
