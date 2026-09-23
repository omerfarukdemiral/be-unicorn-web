// Render lane entry point: full-size <Canvas> with the isometric office.
// Desktop: click = select/place, wheel = zoom step, right-click = cancel. Keyboard lives in ui/shortcuts.ts.
// Touch: tap = select, pinch = zoom step. DPR capped at 2, cheaper shadows in low-power mode.
import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react'
import { NeutralToneMapping } from 'three'
import type { GameState } from '../engine/types'
import type { ZoomLevel } from '../store/types'
import type { BubbleRenderer } from './bubbles'
import { detectLowPower } from './constants'
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

export function GameCanvas({ renderBubble, mockState, className, ambientBubbles = true }: GameCanvasProps = {}) {
  const [lowPower, setLowPower] = useState(detectLowPower)
  const gestures = useZoomGestures()

  return (
    <div
      className={className ?? 'absolute inset-0'}
      // isolation keeps world bubbles (drei <Html>) below the UI layer.
      style={{ isolation: 'isolate', touchAction: 'none' }}
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
        shadows="percentage"
        dpr={lowPower ? [1, 1.5] : [1, 2]}
        gl={{ antialias: !lowPower, powerPreference: 'high-performance' }}
        // Neutral (Khronos PBR Neutral) instead of R3F's default ACES: ACES greys out light pastels (the warm
        // ground rendered khaki, pastel walls grey). Neutral keeps hue and saturation of the palette.ts colours.
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping
        }}
        onPointerMissed={(e) => {
          if (e.button !== 0) return
          const api = storeApi()
          if (!api.ui.placing) {
            api.select(null)
            api.setHoverSlot(null)
          }
        }}
      >
        <RenderStateProvider state={mockState}>
          <PerformanceMonitor onDecline={() => setLowPower(true)} />
          <OfficeScene lowPower={lowPower} renderBubble={renderBubble} ambientBubbles={ambientBubbles} />
        </RenderStateProvider>
      </Canvas>
    </div>
  )
}
