// Render lane entry point: full-size <Canvas> with the isometric office.
// Desktop: click = select/place, wheel = zoom step, right-click = cancel. Keyboard lives in ui/shortcuts.ts.
// Touch: tap = select, pinch = zoom step. DPR capped at 2; low-power mode follows renderBudget (no shadow pass).
import { LayoutKeyHint } from './LayoutEditor'
import { fromBubble } from './bubbleHit'
import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react'
import { NeutralToneMapping } from 'three'
import { noteExit } from '../store/session'
import { GL_LOSSES_TO_LOW_POWER, watchContextLoss } from './contextLoss'
import type { GameState } from '../engine/types'
import type { ZoomLevel } from '../store/types'
import type { BubbleRenderer } from './bubbles'
import { detectLowPower, renderBudget } from './constants'
import { OfficeScene } from './OfficeScene'
import { RenderStateProvider, storeApi } from './source'

export interface GameCanvasProps {
  /** Draws world-bubble content (ui lane). Defaults to render's DefaultBubble. */
  renderBubble?: BubbleRenderer
  /** Render this state instead of the store's (previews, tests, before the engine is wired). */
  mockState?: GameState | null
  className?: string
  /** Show ambient office lines above characters (ui pref "Ofis sohbetlerini göster"). */
  ambientBubbles?: boolean
  /** WebGL context lost (F5): App writes the save while a run is on screen (never the title screen's placeholder). */
  onContextLost?: () => void
}

function stepZoom(delta: 1 | -1): void {
  const api = storeApi()
  const z = Math.max(0, Math.min(2, api.ui.zoom + delta)) as ZoomLevel
  if (z !== api.ui.zoom) api.setZoom(z)
}

/** Pinch (two pointers) and wheel → discrete zoom levels. */
function useZoomGestures() {
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<number | null>(null)
  const wheelLock = useRef(0)

  const dist = () => {
    const [a, b] = [...pointers.current.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  return {
    onPointerDown(e: RPointerEvent) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 2) pinchStart.current = dist()
    },
    onPointerMove(e: RPointerEvent) {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size === 2 && pinchStart.current) {
        const ratio = dist() / pinchStart.current
        if (ratio > 1.3) {
          stepZoom(1)
          pinchStart.current = dist()
        } else if (ratio < 0.77) {
          stepZoom(-1)
          pinchStart.current = dist()
        }
      }
    },
    onPointerUp(e: RPointerEvent) {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size < 2) pinchStart.current = null
    },
    onWheel(e: RWheelEvent) {
      const now = performance.now()
      if (now - wheelLock.current < 280 || Math.abs(e.deltaY) < 4) return
      wheelLock.current = now
      stepZoom(e.deltaY < 0 ? 1 : -1)
    },
  }
}

/** Dev only: ?power=full never drops to lowPower (a software-GL screenshot run would otherwise always decline). */
const FORCE_FULL_POWER = import.meta.env.DEV && new URLSearchParams(location.search).get('power') === 'full'

export function GameCanvas({ renderBubble, mockState, className, ambientBubbles = true, onContextLost }: GameCanvasProps = {}) {
  // onCreated runs once: read the latest callback through a ref.
  const lostRef = useRef(onContextLost)
  lostRef.current = onContextLost
  const [lowPower, setLowPower] = useState(() => !FORCE_FULL_POWER && detectLowPower())
  const gestures = useZoomGestures()
  // Canvas-level settings do not depend on the stage (only the street traffic does, read in the scene).
  const budget = renderBudget(lowPower, 0)

  return (
    <div
      className={className ?? 'absolute inset-0'}
      // isolation keeps world bubbles (drei <Html>) below the UI layer.
      // overflow clip (not hidden): a clipped box cannot be scrolled, so focus or scrollIntoView on a bubble button
      // past the edge never shifts the whole scene sideways (QA 390px: scene + bubbles stuck ~100px left).
      style={{ isolation: 'isolate', touchAction: 'none', overflow: 'clip' }}
      onPointerDown={gestures.onPointerDown}
      onPointerMove={gestures.onPointerMove}
      onPointerUp={gestures.onPointerUp}
      onPointerCancel={gestures.onPointerUp}
      onPointerLeave={gestures.onPointerUp}
      onWheel={gestures.onWheel}
      onContextMenu={(e) => {
        e.preventDefault()
        storeApi().setPlacing(null)
      }}
    >
      <Canvas
        shadows={lowPower ? 'basic' : 'percentage'}
        dpr={budget.dpr}
        gl={{ antialias: budget.antialias, powerPreference: 'high-performance' }}
        // R3F's wrapper is overflow:hidden (scrollable by script); bubbles portal into it (htmlPortal), so clip it too.
        style={{ overflow: 'clip' }}
        // Neutral (Khronos PBR Neutral) instead of R3F's default ACES: ACES greys out light pastels (the warm
        // ground rendered khaki, pastel walls grey). Neutral keeps hue and saturation of the palette.ts colours.
        onCreated={(state) => {
          state.gl.toneMapping = NeutralToneMapping
          watchContextLoss(state.gl.domElement, {
            onLost: (n) => {
              console.warn('[render] WebGL context lost', n)
              noteExit({ glLost: n })
              lostRef.current?.()
              if (n >= GL_LOSSES_TO_LOW_POWER && !FORCE_FULL_POWER) setLowPower(true)
            },
            onRestored: () => state.invalidate(),
          })
          // Dev only: perf probes (draw calls, mesh counts) read the renderer and scene from here.
          if (import.meta.env.DEV) (window as unknown as { __r3f?: unknown }).__r3f = state
        }}
        onPointerMissed={(e) => {
          if (e.button !== 0 || fromBubble(e)) return
          const api = storeApi()
          // The edit mode picks by cell on its own (LayoutEditor).
          if (api.ui.layoutEdit) return
          if (!api.ui.placing) {
            api.select(null)
            api.setHoverSlot(null)
          }
        }}
      >
        <RenderStateProvider state={mockState}>
          <PerformanceMonitor onDecline={() => !FORCE_FULL_POWER && setLowPower(true)} />
          <OfficeScene lowPower={lowPower} renderBubble={renderBubble} ambientBubbles={ambientBubbles} />
        </RenderStateProvider>
      </Canvas>
      {!mockState && <LayoutKeyHint />}
    </div>
  )
}
