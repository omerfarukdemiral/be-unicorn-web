// Bubble exports. Presentational views (…View) can be embedded by render in drei <Html>;
// BubbleTray is the screen-space fallback shown by GameUI (toggle: prefs.screenBubbles / prop).
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '../../store/gameStore'
import { useIsMobile } from '../hooks'
import { cx } from '../primitives'
import { AmbientBubbles } from './AmbientBubble'
import { ConceptBubble, MinimizedConcepts } from './ConceptBubble'
import { DecisionBubble } from './DecisionBubble'

export { AmbientBubbleView, AmbientBubbles, AMBIENT_MS } from './AmbientBubble'
export { ConceptBubbleView, ConceptIconView, ConceptBubble, MinimizedConcepts, CONCEPT_MINIMIZE_DAYS } from './ConceptBubble'
export { DecisionBubble, DecisionCardView, ReflectionView, decisionById, REFLECTION_MS } from './DecisionBubble'

/** Scene height (px, between the bars) under which the tray shows a single bubble. */
const SHORT_SCENE_H = 260

/**
 * Non-blocking bubble area. Concept + decision always (they need clicks); ambient lines optional.
 * Sits 8px under the top bar, centred in the scene area left of the panel (store.ui.sceneInset, viewport px).
 */
export function BubbleTray({ ambient }: { ambient: boolean }) {
  const mobile = useIsMobile()
  const inset = useGameStore(useShallow((s) => ({ top: s.ui.sceneInset.top, right: s.ui.sceneInset.right, bottom: s.ui.sceneInset.bottom })))
  const deciding = useGameStore((s) => s.state.decisions.active !== null && s.state.decisions.active !== undefined)
  // A short scene (landscape phone, ~210px) holds ONE bubble: the decision first, else the concept; no ambient lines.
  const short = typeof window !== 'undefined' && window.innerHeight - inset.top - inset.bottom < SHORT_SCENE_H
  return (
    <div className="pointer-events-none fixed left-0 z-10 flex justify-center px-2" style={{ top: inset.top, right: inset.right }}>
      <div className={cx('flex flex-col items-center gap-2', mobile ? 'w-full' : 'w-[min(560px,100%)]')}>
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <DecisionBubble />
          <div className="flex items-end gap-2">
            {!(short && deciding) && <ConceptBubble />}
            <MinimizedConcepts />
          </div>
        </div>
        {ambient && !short && <AmbientBubbles />}
      </div>
    </div>
  )
}

export { renderWorldBubble, type WorldBubbleLike } from './worldBubble'
