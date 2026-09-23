// Bubble exports. Presentational views (…View) can be embedded by render in drei <Html>;
// BubbleTray is the screen-space fallback shown by GameUI (toggle: prefs.screenBubbles / prop).
import { useIsMobile } from '../hooks'
import { cx } from '../primitives'
import { AmbientBubbles } from './AmbientBubble'
import { ConceptBubble, MinimizedConcepts } from './ConceptBubble'
import { DecisionBubble } from './DecisionBubble'

export { AmbientBubbleView, AmbientBubbles, AMBIENT_MS } from './AmbientBubble'
export { ConceptBubbleView, ConceptIconView, ConceptBubble, MinimizedConcepts, CONCEPT_MINIMIZE_MS } from './ConceptBubble'
export { DecisionBubble, DecisionCardView, ReflectionView, decisionById, REFLECTION_MS } from './DecisionBubble'

/** Non-blocking bubble area. Concept + decision always (they need clicks); ambient lines optional. */
export function BubbleTray({ ambient }: { ambient: boolean }) {
  const mobile = useIsMobile()
  return (
    <div
      className={cx(
        'pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2',
        mobile ? 'top-[calc(env(safe-area-inset-top,0px)+128px)] w-[calc(100vw-1rem)]' : 'top-[84px] w-[min(560px,46vw)]',
      )}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <DecisionBubble />
        <div className="flex items-end gap-2">
          <ConceptBubble />
          <MinimizedConcepts />
        </div>
      </div>
      {ambient && <AmbientBubbles />}
    </div>
  )
}

export { renderWorldBubble, type WorldBubbleLike } from './worldBubble'
