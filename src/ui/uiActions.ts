// UI-level flows that combine a dispatch with the single panel.
import type { ConceptId } from '../engine/types'
import { CONCEPTS } from '../content'
import { useGameStore } from '../store/gameStore'

/** Opens the Defter card in the panel; marks the concept learned the first time (unlocks its widget/tool). */
export function openConceptCard(conceptId: ConceptId): void {
  const { state, dispatch, openPanel } = useGameStore.getState()
  if (!state.concepts.learned.includes(conceptId)) dispatch({ type: 'openConcept', conceptId })
  openPanel({ kind: 'journal', conceptId })
}

export function conceptById(id: ConceptId) {
  return CONCEPTS.find((c) => c.id === id)
}
