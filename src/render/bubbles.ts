// Contract between render (positions world bubbles) and ui (draws their content).
// Render decides WHICH bubbles exist and WHERE; a BubbleRenderer (from ui, passed to
// <GameCanvas renderBubble>) decides HOW they look. Without one, render's DefaultBubble is used.
// Three anchors carry actionable bubbles: the founder's desk ('desk'), an employee, a visitor NPC.
// `key` is stable and is also the value of ui.bubbleOpen while the bubble is expanded.
import type { ReactNode } from 'react'
import type { ConceptId, DecisionCardId, NpcRole } from '../engine/types'

interface BubbleBase {
  /** Stable React key (decision:{cardId}, staff:{id}, person:{id}, desk:{topic}, desk:renewal:{id}, desk:module:{projectId}, visitor:pitch:{id}, reflection:{cardId}, amb:{id}). */
  key: string
  /** Employee id, visitor id, 'founder' or 'desk' the bubble floats above. */
  speakerId: string
}

/** Why an employee asks for the player: walking out, burnt out, tired, bored (E3), or a builder with nothing to build. */
export type StaffNeed = 'leaving' | 'burnout' | 'tired' | 'bored' | 'calmBack' | 'idle'

/** ui.bubbleOpen key of an employee's scene card (tapping them opens it, T14). */
export const personKey = (employeeId: string): string => `person:${employeeId}`

/** What the founder's desk asks about (one at a time, in this priority order; 'actions' only while open). */
export type DeskTopic = 'payday' | 'round' | 'pitch' | 'renewal' | 'hire' | 'module' | 'project' | 'actions'

/** What a visitor NPC asks about (the weekly pitch to the round investor). */
export type VisitorTopic = 'pitch'

export type WorldBubble =
  /** Short ambient office line (non-clickable, ~3 s). */
  | (BubbleBase & { kind: 'ambient'; bubbleId: string; lineId: string; text: string })
  /** Active concept bubble (PLAN §2 "Adlandır"). Click → onOpen (opens card + dispatches openConcept). */
  | (BubbleBase & { kind: 'concept'; conceptId: ConceptId; role: NpcRole; text: string; onOpen: () => void })
  /** Concept bubble shrunk to an icon after 20 s (PLAN §6.1). */
  | (BubbleBase & { kind: 'conceptIcon'; conceptId: ConceptId; role: NpcRole; onOpen: () => void })
  /** Active decision card; speaker = its investor/customer/journalist visitor, else 'desk'. onOpen opens the deeper panel. */
  | (BubbleBase & { kind: 'decision'; cardId: DecisionCardId; role: NpcRole; text: string; onOpen: () => void })
  /** An employee who needs the player right there in the scene (leaving / idle builder); speakerId = employee id. */
  | (BubbleBase & { kind: 'staff'; need: StaffNeed })
  /** The card of an employee the player tapped in the scene (T14), beside them; only while open (ui.bubbleOpen = key). */
  | (BubbleBase & { kind: 'person' })
  /** The founder's own call, asked at the central desk; speakerId = 'desk'. `refId`: the renewal's contract id, or the project a module question is about. */
  | (BubbleBase & { kind: 'desk'; topic: DeskTopic; refId?: string })
  /** A visitor waiting for an answer (round investor's pitch); speakerId = visitorId. */
  | (BubbleBase & { kind: 'visitor'; topic: VisitorTopic; visitorId: string })
  /** "Seçtin: …" right after a decision is answered (non-clickable, 4 s), above the card's speaker. */
  | (BubbleBase & { kind: 'reflection'; cardId: DecisionCardId; optionIndex: number })

export type BubbleRenderer = (bubble: WorldBubble) => ReactNode
