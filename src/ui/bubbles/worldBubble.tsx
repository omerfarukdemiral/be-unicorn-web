// UI look for render's world-anchored bubbles. Integrate wires it as
// <GameCanvas renderBubble={renderWorldBubble} /> together with <GameUI worldBubbles />.
// The param type mirrors render/bubbles.ts `WorldBubble` structurally (ui may not import render).
// Scene-first (spec §0–§2): every prompt that wants an answer is a bubble above whoever it concerns: a decision above
// its visitor or the founder's desk, people above the employee, the founder's own calls (payday, round, pitch,
// renewal, hiring, first product, founder actions) at the desk, a tapped employee's card beside them (T14), the weekly pitch above the round's investor. Each one
// starts collapsed; expanding it holds the world (ui.bubbleOpen), acting resumes it. A concept draws nothing in the
// scene: it lands on the Kazanımlar badge (docs/GAMEPLAY_V2.md §12). Office lines pass the daily budget.
import type { ReactNode } from 'react'
import type { ConceptId, DecisionCardId, NpcRole } from '../../engine/types'
import { useGameStore } from '../../store/gameStore'
import { AmbientBubbleView, officeLineShown } from './AmbientBubble'
import { DecisionWorldBubble } from './DecisionWorldBubble'
import { DeskBubble, type DeskTopic } from './DeskBubble'
import { PersonBubble } from './PersonBubble'
import { ReflectionBubble } from './ReflectionBubble'
import { speakerName } from './speaker'
import { StaffBubble, type StaffNeed } from './StaffBubble'
import { VisitorBubble, type VisitorTopic } from './VisitorBubble'

interface Base {
  key: string
  speakerId: string
}

export type WorldBubbleLike =
  | (Base & { kind: 'ambient'; bubbleId: string; lineId: string; text: string })
  | (Base & { kind: 'concept'; conceptId: ConceptId; role: NpcRole; text: string; onOpen: () => void })
  | (Base & { kind: 'conceptIcon'; conceptId: ConceptId; role: NpcRole; onOpen: () => void })
  | (Base & { kind: 'decision'; cardId: DecisionCardId; role: NpcRole; text: string; onOpen: () => void })
  | (Base & { kind: 'staff'; need: StaffNeed })
  | (Base & { kind: 'person' })
  | (Base & { kind: 'desk'; topic: DeskTopic; refId?: string })
  | (Base & { kind: 'visitor'; topic: VisitorTopic; visitorId: string })
  | (Base & { kind: 'reflection'; cardId: DecisionCardId; optionIndex: number })

/** An office line in the scene: who says it on top (same speaker line as every other bubble), 13px text. */
function AmbientWorldLine({ text, speakerId }: { text: string; speakerId: string }) {
  const name = useGameStore((s) => speakerName(s.state, speakerId))
  return <AmbientBubbleView text={text} speaker={name || undefined} className={WORLD_W} tail large />
}

/** drei <Html> gives content a shrink-to-fit box; w-max keeps lines from collapsing to one word. */
const WORLD_W = 'w-max max-w-[min(260px,60vw)]'

export function renderWorldBubble(b: WorldBubbleLike): ReactNode {
  switch (b.kind) {
    case 'ambient':
      return officeLineShown(b.bubbleId, b.lineId) ? <AmbientWorldLine text={b.text} speakerId={b.speakerId} /> : null
    case 'concept':
    case 'conceptIcon':
      return null
    case 'decision':
      return <DecisionWorldBubble bubbleKey={b.key} cardId={b.cardId} role={b.role} />
    case 'staff':
      return <StaffBubble bubbleKey={b.key} employeeId={b.speakerId} need={b.need} />
    case 'person':
      return <PersonBubble bubbleKey={b.key} employeeId={b.speakerId} />
    case 'desk':
      return <DeskBubble bubbleKey={b.key} topic={b.topic} refId={b.refId} />
    case 'visitor':
      return <VisitorBubble bubbleKey={b.key} topic={b.topic} visitorId={b.visitorId} />
    case 'reflection':
      return <ReflectionBubble cardId={b.cardId} optionIndex={b.optionIndex} />
  }
}
