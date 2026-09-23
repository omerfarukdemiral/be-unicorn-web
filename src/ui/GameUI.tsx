// UI root: full-screen HTML layer above the canvas. Root is pointer-events-none;
// interactive parts opt in with pointer-events-auto. One panel at a time (RightPanel), the office stays
// visible in the middle; only move scene / post-mortem / victory are centered modals (ModalHost).
import { useEffect, useMemo } from 'react'
import type { DockTab } from '../store/types'
import { Hud } from './Hud'
import { Dock, DOCK_TABS } from './Dock'
import type { RenderPreview } from './DetailPanel'
import { RightPanel, PANEL_RESERVE } from './RightPanel'
import { FounderActions } from './FounderActions'
import { ActivityLine } from './ActivityLine'
import { BubbleTray } from './bubbles'
import { ModalHost } from './ModalHost'
import { ErrorToast, PlacingBanner } from './Feedback'
import { useKeyboardShortcuts } from './shortcuts'
import { cx } from './primitives'
import { useIsMobile, usePrefs } from './hooks'
import { useGameStore } from '../store/gameStore'
import { installMock, mockRequested } from './mock'

export interface GameUIProps {
  /** Close-up 3D for the detail panel, e.g. `(t) => <ObjectPreview target={t} />` from render. */
  renderPreview?: RenderPreview
  /** True when render draws concept/decision/ambient bubbles in the 3D world (drei <Html>). */
  worldBubbles?: boolean
  /** Force mock state (also enabled by `?mock` in the URL during dev). */
  mock?: boolean
}

export function GameUI({ renderPreview, worldBubbles = false, mock }: GameUIProps = {}) {
  const mobile = useIsMobile()
  const panelOpen = useGameStore((s) => s.ui.panel !== null)
  // Desktop: bottom-center UI (dock, toasts) stays in the scene area left of the open panel.
  const sceneRight = !mobile && panelOpen ? PANEL_RESERVE : 0
  const screenAmbient = usePrefs((p) => p.screenBubbles)
  const tabKeys = useMemo(() => Object.fromEntries(DOCK_TABS.map((d) => [d.key, d.id])) as Record<string, DockTab>, [])
  useKeyboardShortcuts(tabKeys)

  useEffect(() => {
    if (mock || mockRequested()) installMock()
  }, [mock])

  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden safe-top safe-x text-ink-900">
      <div className="relative h-full w-full">
        <Hud />
        {!worldBubbles && <BubbleTray ambient={screenAmbient} />}

        {/* Bottom of the scene area: transient feedback. z-40 = above the panel/sheet (z-20/30), below blocking modals (z-50). */}
        <div
          className={mobile ? 'pointer-events-none absolute inset-x-0 bottom-[calc(200px+env(safe-area-inset-bottom,0px))] z-40 flex flex-col items-center gap-2 px-2' : 'pointer-events-none absolute bottom-[84px] left-0 z-40 flex flex-col items-center gap-2 px-3'}
          style={mobile ? undefined : { right: sceneRight }}
        >
          <PlacingBanner />
          <ErrorToast />
        </div>

        {/* Bottom-left: founder actions + activity line */}
        {mobile ? (
          <div className="absolute inset-x-2 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] flex flex-col items-start gap-1.5">
            <ActivityLine />
            <FounderActions />
          </div>
        ) : (
          <div className="absolute bottom-[80px] left-3 flex flex-col items-start gap-2 safe-bottom xl:bottom-3">
            <FounderActions />
            <ActivityLine />
          </div>
        )}

        <RightPanel renderPreview={renderPreview} />
        {mobile ? (
          <Dock />
        ) : (
          // With the panel open the dock hugs the panel's left edge, clear of the founder actions (bottom-left).
          <div className={cx('pointer-events-none absolute bottom-0 left-0 flex p-3', panelOpen ? 'justify-end' : 'justify-center')} style={{ right: sceneRight ? sceneRight - 12 : 0 }}>
            <Dock compact={panelOpen} />
          </div>
        )}
      </div>
      <ModalHost />
    </div>
  )
}

export default GameUI
