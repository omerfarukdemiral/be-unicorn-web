// UI look for render's world-anchored bubbles. Integrate wires it as
// <GameCanvas renderBubble={renderWorldBubble} /> together with <GameUI worldBubbles />.
// The param type mirrors render/bubbles.ts `WorldBubble` structurally (ui may not import render).
// Clicks open the single right panel (decision), never a blocking modal. A concept draws nothing in the scene: it
// lands on the Kazanımlar badge and its visitor stands silently (docs/GAMEPLAY_V2.md §12). Office lines pass the
// daily budget (AmbientBubble officeLineShown). A card's speaker is the run's cast name (state.cast, §9.1).
import type { ReactNode } from 'react'
import type { ConceptId, DecisionCardId, NpcRole } from '../../engine/types'
import { Icon } from '../icons'
import { AmbientBubbleView, officeLineShown } from './AmbientBubble'
import { useGameStore } from '../../store/gameStore'
import { t } from '../i18n'
import { cx } from '../primitives'
import { BUBBLE_HOVER, BUBBLE_SHELL, BubbleTail, BubbleText, SpeakerLine } from './shell'
import { castName } from './speaker'

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
      return officeLineShown(b.bubbleId, b.lineId) ? <AmbientBubbleView text={b.text} className={WORLD_W} tail /> : null
    case 'concept':
    case 'conceptIcon':
      return null
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
            <SpeakerLine icon="chat" color="var(--color-kind-decision)" speaker={`${t('decision.title')} · ${castName(useGameStore.getState().state, b.role)}`} />
            <BubbleText className="line-clamp-2">{b.text}</BubbleText>
          </span>
          <Icon name="chevronRight" size={14} className="shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
          <BubbleTail />
        </button>
      )
  }
}
