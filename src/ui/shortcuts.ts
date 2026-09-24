// Desktop keyboard shortcuts: Space pause/resume, 1/2/3 speed, M/E/P/B/G/K panel tabs (G = Metrikler, 'gösterge') (again = close), Esc closes, +/- zoom.
import { useEffect, useRef } from 'react'
import type { GameSpeed } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import type { DockTab, ZoomLevel } from '../store/types'
import { isTypingTarget } from './hooks'

const SPEED_KEYS: Record<string, GameSpeed> = { '1': 1, '2': 2, '3': 4 }

export function useKeyboardShortcuts(tabKeys: Record<string, DockTab>) {
  const lastSpeed = useRef<GameSpeed>(1)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e)) return
      const st = useGameStore.getState()
      const blocking = st.ui.overlay !== null
      const key = e.key.toLowerCase()

      if (key === 'escape') {
        if (blocking) return // OverlayFrame handles it (move scene)
        if (st.ui.placing) st.setPlacing(null)
        else if (st.ui.panel) st.closePanel()
        return
      }
      if (blocking || st.state.gameOver) return

      if (e.code === 'Space') {
        e.preventDefault()
        const speed = st.state.time.speed
        if (speed === 0) st.dispatch({ type: 'setSpeed', speed: lastSpeed.current || 1 })
        else {
          lastSpeed.current = speed
          st.dispatch({ type: 'setSpeed', speed: 0 })
        }
        return
      }
      const sp = SPEED_KEYS[key]
      if (sp !== undefined) {
        lastSpeed.current = sp
        st.dispatch({ type: 'setSpeed', speed: sp })
        return
      }
      const tab = tabKeys[key]
      if (tab) {
        st.togglePanel(tab)
        return
      }
      if (key === '+' || key === '=') st.setZoom(Math.min(2, st.ui.zoom + 1) as ZoomLevel)
      else if (key === '-' || key === '_') st.setZoom(Math.max(0, st.ui.zoom - 1) as ZoomLevel)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tabKeys])
}
