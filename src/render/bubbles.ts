// Contract between render (positions world bubbles) and ui (draws their content).
// Render decides WHICH bubbles exist and WHERE; a BubbleRenderer (from ui, passed to
// <GameCanvas renderBubble>) decides HOW they look. Without one, render's DefaultBubble is used.
import type { ReactNode } from 'react'
import type { ConceptId, DecisionCardId, NpcRole } from '../engine/types'

interface BubbleBase {
  /** Stable React key. */
  key: string
  /** Employee id, visitor id or 'founder' the bubble floats above. */
  speakerId: string
}

export type WorldBubble =
  /** Short ambient office line (non-clickable, ~3 s). */
  | (BubbleBase & { kind: 'ambient'; bubbleId: string; lineId: string; text: string })
  /** Active concept bubble (PLAN §2 "Adlandır"). Click → onOpen (opens card + dispatches openConcept). */
  | (BubbleBase & { kind: 'concept'; conceptId: ConceptId; role: NpcRole; text: string; onOpen: () => void })
  /** Concept bubble shrunk to an icon after 20 s (PLAN §6.1). */
  | (BubbleBase & { kind: 'conceptIcon'; conceptId: ConceptId; role: NpcRole; onOpen: () => void })
  /** Active decision card's short question. Click → onOpen (opens decision overlay). */
  | (BubbleBase & { kind: 'decision'; cardId: DecisionCardId; role: NpcRole; text: string; onOpen: () => void })

export type BubbleRenderer = (bubble: WorldBubble) => ReactNode
