// UI root: full-screen HTML layer above the canvas. Root is pointer-events-none; interactive parts opt in with
// pointer-events-auto. Desktop: corner islands over the scene (docs/LAYOUT.md §1, "dört köşe"): stage top-left, time
// top-right, money + gauges bottom-left, founder actions bottom centre, panel tabs bottom-right; the single right panel
// and the notification strip above the founder island. Phones: a top bar (stage · gauges · time), the bottom sheet
// and the bottom bar (founder actions · panel tabs) with the strip just above it. The office is framed in the area between them (store.ui.sceneInset, layout/useSceneInset).
// Only move scene / post-mortem / victory are centered modals (ModalHost); the center screens (statistics…) share the
// overlay slot but never pause, and the K / I keys reach Kazanımlar and İstatistik (shortcuts.ts).
import { useEffect, useMemo } from 'react'
import type { DockTab } from '../store/types'
import { useGameStore } from '../store/gameStore'
import { DOCK_TABS } from './Dock'
import type { RenderPreview } from './DetailPanel'
import { RightPanel } from './RightPanel'
import { ErrorCatch } from './ErrorCatch'
import { BubbleTray } from './bubbles'
import { ModalHost } from './ModalHost'
import { useKeyboardShortcuts } from './shortcuts'
import { usePrefs } from './hooks'
import { installMock, mockRequested } from './mock'
import { PauseVeil, ScreenFrame, StartCall } from './time'
import { usePinnedMetrics } from './widgets'
import { TopBar } from './layout/TopBar'
import { PraiseCard } from './PraiseCard'
// P5 first-run hints: a store watcher, no component of its own.
import './firstHints'
import { BottomStack } from './layout/BottomBar'
import { useSceneInset } from './layout/useSceneInset'

export interface GameUIProps {
  /** Close-up 3D for the detail panel, e.g. `(t) => <ObjectPreview target={t} />` from render. */
  renderPreview?: RenderPreview
  /** True when render draws concept/decision/ambient bubbles in the 3D world (drei <Html>). */
  worldBubbles?: boolean
  /** Force mock state (also enabled by `?mock` in the URL during dev). */
  mock?: boolean
}

/** Money island "+N" / pinned overflow → Metrikler (again closes it, like the tab). */
function openMetrics() {
  useGameStore.getState().togglePanel('metrics')
}

export function GameUI({ renderPreview, worldBubbles = false, mock }: GameUIProps = {}) {
  const screenAmbient = usePrefs((p) => p.screenBubbles)
  const pinned = usePinnedMetrics()
  const tabKeys = useMemo(() => Object.fromEntries(DOCK_TABS.map((d) => [d.key, d.id])) as Record<string, DockTab>, [])
  useKeyboardShortcuts(tabKeys)
  useSceneInset()

  useEffect(() => {
    if (mock || mockRequested()) installMock()
  }, [mock])

  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-clip safe-top safe-x text-ink">
      {/* Still world (paused, decision / Kazanımlar card open): the scene fades a little, under every UI surface. */}
      <PauseVeil />
      <div className="relative h-full w-full">
        {/* Paused start: one clear Başlat call in the middle of the scene area. */}
        <StartCall />
        {!worldBubbles && <BubbleTray ambient={screenAmbient} />}
        <ErrorCatch where="panel">
          <RightPanel renderPreview={renderPreview} />
        </ErrorCatch>
        <TopBar />
        <PraiseCard />
        <BottomStack pinned={pinned} onOpenMetrics={openMetrics} />
      </div>
      <ModalHost worldBubbles={worldBubbles} />
      {/* Viewport edge in the time colour (above modals' backdrop, never takes pointer events). */}
      <ScreenFrame />
    </div>
  )
}

export default GameUI
