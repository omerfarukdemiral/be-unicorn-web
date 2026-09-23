// UI root: full-screen HTML layer above the canvas. Root is pointer-events-none;
// interactive parts opt in with pointer-events-auto.
import { useEffect, useMemo } from 'react'
import type { DockTab } from '../store/types'
import { Hud } from './Hud'
import { Dock, DOCK_TABS } from './Dock'
import { DetailPanel, type RenderPreview } from './DetailPanel'
import { FounderActions } from './FounderActions'
import { ActivityLine } from './ActivityLine'
import { BubbleTray } from './bubbles'
import { ModalHost } from './ModalHost'
import { ErrorToast, PlacingBanner } from './Feedback'
import { useKeyboardShortcuts } from './shortcuts'
import { useIsMobile, usePrefs } from './hooks'
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

        {/* Center-bottom transient feedback */}
        <div className={mobile ? 'absolute inset-x-0 bottom-[calc(200px+env(safe-area-inset-bottom,0px))] flex flex-col items-center gap-2 px-2' : 'absolute inset-x-0 bottom-[84px] flex flex-col items-center gap-2'}>
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

        <DetailPanel renderPreview={renderPreview} />
        <Dock />
      </div>
      <ModalHost />
    </div>
  )
}

export default GameUI
