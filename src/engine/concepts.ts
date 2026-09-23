// Generic concept trigger engine (PLAN §6.1). Content supplies Concept[]; this only schedules them.
// Rules: each concept fires once per run, max 1 active bubble, the rest wait in a FIFO queue.
import type { Concept } from '../content/index'
import { CONCEPT_VISITOR_DAYS } from './balance'
import { unlockAny } from './effects'
import type { ConceptId, GameState } from './types'
import { newId, pushEvent } from './util'

function safeTrigger(c: Concept, s: GameState): boolean {
  try {
    return c.trigger(s) === true
  } catch {
    return false
  }
}

/** Daily: queue every newly-true concept whose stage has been reached. Returns ids queued. */
export function evaluateConcepts(s: GameState, concepts: readonly Concept[]): ConceptId[] {
  const queued: ConceptId[] = []
  for (const c of concepts) {
    if (c.stage > s.stage) continue
    if (s.concepts.triggered.includes(c.id)) continue
    if (!safeTrigger(c, s)) continue
    s.concepts.triggered.push(c.id)
    s.concepts.queue.push(c.id)
    queued.push(c.id)
    pushEvent(s, { kind: 'conceptQueued', refId: c.id })
  }
  promoteConcept(s, concepts)
  return queued
}

/** If no bubble is on screen, show the head of the queue (with its speaker as a visitor). */
export function promoteConcept(s: GameState, concepts: readonly Concept[]): void {
  if (s.concepts.active) return
  const id = s.concepts.queue.shift()
  if (id === undefined) return
  s.concepts.active = { id, shownDay: s.time.day }
  const c = concepts.find((x) => x.id === id)
  if (c) {
    const vid = newId(s, 'v')
    s.visitors.push({ id: vid, role: c.speaker, purpose: 'concept', targetSlotId: 'founder', arriveDay: s.time.day, leaveDay: s.time.day + CONCEPT_VISITOR_DAYS, refId: id })
    pushEvent(s, { kind: 'visitorArrived', refId: vid })
  }
}

function endConceptVisitor(s: GameState, id: ConceptId): void {
  for (const v of s.visitors) if (v.purpose === 'concept' && v.refId === id) v.leaveDay = Math.min(v.leaveDay, s.time.day)
}

/** Player opened the card: learned + unlock. Returns false if the concept was never triggered. */
export function learnConcept(s: GameState, concepts: readonly Concept[], id: ConceptId): boolean {
  if (!s.concepts.triggered.includes(id)) return false
  if (s.concepts.learned.includes(id)) return true
  s.concepts.learned.push(id)
  s.concepts.queue = s.concepts.queue.filter((q) => q !== id)
  s.concepts.minimized = s.concepts.minimized.filter((q) => q !== id)
  if (s.concepts.active?.id === id) s.concepts.active = undefined
  endConceptVisitor(s, id)
  unlockAny(s, concepts.find((c) => c.id === id)?.unlocks)
  pushEvent(s, { kind: 'conceptLearned', refId: id })
  promoteConcept(s, concepts)
  return true
}

/** Bubble shrank to an icon: keep it, free the slot for the next one. */
export function minimizeConcept(s: GameState, concepts: readonly Concept[], id: ConceptId): boolean {
  if (s.concepts.active?.id !== id) return false
  s.concepts.active = undefined
  if (!s.concepts.minimized.includes(id)) s.concepts.minimized.push(id)
  endConceptVisitor(s, id)
  promoteConcept(s, concepts)
  return true
}
