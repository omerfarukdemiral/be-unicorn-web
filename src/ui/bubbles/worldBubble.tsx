// UI look for render's world-anchored bubbles. Integrate wires it as
// <GameCanvas renderBubble={renderWorldBubble} /> together with <GameUI worldBubbles />.
// The param type mirrors render/bubbles.ts `WorldBubble` structurally (ui may not import render).
// Clicks open the single right panel (Defter card / decision), never a blocking modal.
import type { ReactNode } from 'react'
import type { ConceptId, DecisionCardId, NpcRole } from '../../engine/types'
import { NPC_TEXT } from '../../content'
import { Icon } from '../icons'
import { AmbientBubbleView } from './AmbientBubble'
import { ConceptBubbleView, ConceptIconView } from './ConceptBubble'
import { conceptTitle } from '../panels/JournalPanel'
import { useGameStore } from '../../store/gameStore'
import { openConceptCard } from '../uiActions'
import { t } from '../i18n'
import { cx } from '../primitives'
import { BUBBLE_HOVER, BUBBLE_SHELL, BubbleTail, BubbleText, SpeakerLine } from './shell'

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
      return <AmbientBubbleView text={b.text} className={WORLD_W} tail />
    case 'concept':
      return <ConceptBubbleView text={b.text} speaker={NPC_TEXT[b.role].name} onClick={() => openConceptCard(b.conceptId)} className={WORLD_W} tail />
    case 'conceptIcon':
      return <ConceptIconView label={conceptTitle(b.conceptId)} onClick={() => openConceptCard(b.conceptId)} />
    case 'decision':
      // Mark: orange chat tile + "Karar" (vs. the concept's violet book); neutral body.
      return (
        <button
          type="button"
          onClick={() => useGameStore.getState().openPanel({ kind: 'decision', cardId: b.cardId })}
          // Appears with a short nudge + orange glow (3×) so a new decision is noticed; time keeps flowing
          // until the player opens it (the panel then holds time still).
          className={cx(BUBBLE_SHELL, BUBBLE_HOVER, 'group flex w-max max-w-[min(300px,60vw)] animate-attention items-center gap-2 py-2 pl-3 pr-2 text-left')}
        >
          <span className="flex min-w-0 flex-col gap-1">
            <SpeakerLine icon="chat" color="var(--color-kind-decision)" speaker={`${t('decision.title')} · ${NPC_TEXT[b.role].name}`} />
            <BubbleText className="line-clamp-2">{b.text}</BubbleText>
          </span>
          <Icon name="chevronRight" size={14} className="shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
          <BubbleTail />
        </button>
      )
  }
}
