// UI look for render's world-anchored bubbles. Integrate wires it as
// <GameCanvas renderBubble={renderWorldBubble} /> together with <GameUI worldBubbles />.
// The param type mirrors render/bubbles.ts `WorldBubble` structurally (ui may not import render).
import type { ReactNode } from 'react'
import type { ConceptId, DecisionCardId, NpcRole } from '../../engine/types'
import { NPC_TEXT } from '../../content'
import { Icon } from '../icons'
import { AmbientBubbleView } from './AmbientBubble'
import { ConceptBubbleView, ConceptIconView } from './ConceptBubble'
import { conceptTitle } from '../panels/JournalPanel'

interface Base {
  key: string
  speakerId: string
}

export type WorldBubbleLike =
  | (Base & { kind: 'ambient'; bubbleId: string; lineId: string; text: string })
  | (Base & { kind: 'concept'; conceptId: ConceptId; role: NpcRole; text: string; onOpen: () => void })
  | (Base & { kind: 'conceptIcon'; conceptId: ConceptId; role: NpcRole; onOpen: () => void })
  | (Base & { kind: 'decision'; cardId: DecisionCardId; role: NpcRole; text: string; onOpen: () => void })

/** drei <Html> gives content a shrink-to-fit box; w-max keeps lines from collapsing to one word. */
const WORLD_W = 'w-max max-w-[min(260px,60vw)]'

export function renderWorldBubble(b: WorldBubbleLike): ReactNode {
  switch (b.kind) {
    case 'ambient':
      return <AmbientBubbleView text={b.text} className={WORLD_W} />
    case 'concept':
      return <ConceptBubbleView text={b.text} speaker={NPC_TEXT[b.role].name} onClick={b.onOpen} className={WORLD_W} />
    case 'conceptIcon':
      return <ConceptIconView label={conceptTitle(b.conceptId)} onClick={b.onOpen} />
    case 'decision':
      return (
        <button
          type="button"
          onClick={b.onOpen}
          className="flex w-max max-w-[min(300px,60vw)] animate-pop-in items-center gap-2 rounded-3xl rounded-bl-md border border-sky-300 bg-cream-50 px-3 py-2 text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-600">
            <Icon name="chat" size={13} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-600">{NPC_TEXT[b.role].name}</span>
            <span className="line-clamp-2 block text-sm font-semibold leading-snug">{b.text}</span>
          </span>
        </button>
      )
  }
}
