// Desktop keyboard shortcuts: Space pause/resume, 1/2/3 speed, M/E/P/B/G panel tabs (G = Metrikler, 'gösterge') (again = close),
// K Kazanımlar, L Liderlik, I İstatistik (again = close), Esc closes, +/- zoom. A center screen (statistics…) does not
// block the keys: time and the other shortcuts keep working under it (docs/GAMEPLAY_V2.md §14.3).
import { useEffect, useRef } from 'react'
import type { GameSpeed } from '../engine/types'
import { blockingOverlay, useGameStore } from '../store/gameStore'
import type { CenterKind, DockTab, ZoomLevel } from '../store/types'
import { isTypingTarget } from './hooks'

/** Liderlik panel (not a dock tab; checked against the dock keys in shortcuts.test.ts). */
export const LEADERBOARD_KEY = 'l'

/** Kazanımlar (top-bar book icon; the journal panel, no longer a dock tab). */
export const ACHIEVEMENTS_KEY = 'k'

/**
 * Center screens by key. Kanun Kitabı and Pazar haritası get theirs with their screens (H5b): the planned L / M are
 * Liderlik and Mağaza today, so the plan now names Y (Kanun) and H (Pazar haritası) (shortcuts.test.ts keeps every key unique).
 */
export const CENTER_KEYS: Readonly<Record<string, CenterKind>> = { i: 'stats' }

/** Book icon / K: opens Kazanımlar, again closes it. */
export function toggleAchievements(): void {
  const { ui, openPanel, closePanel } = useGameStore.getState()
  if (ui.panel?.kind === 'journal') closePanel()
  else openPanel({ kind: 'journal' }, { root: true })
}

/** Trophy / L: opens Liderlik, again closes it. */
export function toggleLeaderboard(): void {
  const { ui, openPanel, closePanel } = useGameStore.getState()
  if (ui.panel?.kind === 'leaderboard') closePanel()
  else openPanel({ kind: 'leaderboard' }, { root: true })
}

const SPEED_KEYS: Record<string, GameSpeed> = { '1': 1, '2': 2, '3': 4 }

export function useKeyboardShortcuts(tabKeys: Record<string, DockTab>) {
  const lastSpeed = useRef<GameSpeed>(1)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e)) return
      const st = useGameStore.getState()
      const blocking = blockingOverlay(st.ui) !== null
      const key = e.key.toLowerCase()

      if (key === 'escape') {
        if (blocking) return // OverlayFrame handles it (move scene)
        if (st.ui.overlay) st.closeOverlay() // a center screen
        else if (st.ui.placing) st.setPlacing(null)
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
      if (key === LEADERBOARD_KEY) {
        toggleLeaderboard()
        return
      }
      if (key === ACHIEVEMENTS_KEY) {
        toggleAchievements()
        return
      }
      const center = CENTER_KEYS[key]
      if (center) {
        st.toggleCenter(center)
        return
      }
      if (key === '+' || key === '=') st.setZoom(Math.min(2, st.ui.zoom + 1) as ZoomLevel)
      else if (key === '-' || key === '_') st.setZoom(Math.max(0, st.ui.zoom - 1) as ZoomLevel)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tabKeys])
}
