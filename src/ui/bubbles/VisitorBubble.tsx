// A visitor who came for an answer (scene-first spec §2 row 4): the round's investor asks for this week's pitch right
// above their head. Same rows as the desk's pitch (DeskBubble PitchBubble), spoken by the run's investor.
import { PitchBubble, useInvestorName } from './DeskBubble'

/** Mirrors render/bubbles.ts VisitorTopic (ui may not import render). */
export type VisitorTopic = 'pitch'

export function VisitorBubble({ bubbleKey, topic }: { bubbleKey: string; topic: VisitorTopic; visitorId: string }) {
  const investor = useInvestorName()
  switch (topic) {
    case 'pitch':
      return <PitchBubble bubbleKey={bubbleKey} kind="visitor" speaker={investor} />
  }
}
