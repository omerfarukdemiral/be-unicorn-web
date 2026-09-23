// UI-level flows that combine a dispatch with an overlay request.
import type { ConceptId } from '../engine/types'
import { CONCEPTS } from '../content'
import { useGameStore } from '../store/gameStore'
import { requestOverlay } from './modalQueue'

/** Opens the Defter card; marks the concept learned the first time (unlocks its widget/tool). */
export function openConceptCard(conceptId: ConceptId): void {
  const { state, dispatch } = useGameStore.getState()
  if (!state.concepts.learned.includes(conceptId)) dispatch({ type: 'openConcept', conceptId })
  requestOverlay({ kind: 'conceptCard', conceptId })
}

export function conceptById(id: ConceptId) {
  return CONCEPTS.find((c) => c.id === id)
}
