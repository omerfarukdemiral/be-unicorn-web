// Desktop keyboard shortcuts: Space pause/resume, 1/2/3 speed, M/E/P/B/G panel tabs (G = Metrikler, 'gösterge') (again = close),
// K Kazanımlar, L Liderlik, I İstatistik / Y Kanun Kitabı / H Pazar haritası (again = close), Esc closes (an open scene bubble first), +/- zoom. A center screen (statistics…) does not
// block the keys: time and the other shortcuts keep working under it (docs/GAMEPLAY_V2.md §14.3).
// O opens the office edit mode (PC only, layoutEditGate). While it is open the edit keys own the keyboard
// (layoutEditKey: Ctrl/Cmd+Z undo, Ctrl+Shift+Z / Ctrl+Y redo, R turn, Del takes the piece away, 1–5 team label, Enter / O Bitti, Esc), every
// other key is swallowed: time is held and no other panel may open over the draft.
import { useEffect } from 'react'
import { DEPTS, type GameSpeed } from '../engine/types'
import { blockingOverlay, resumeSpeed, useGameStore } from '../store/gameStore'
import type { CenterKind, DockTab, ZoomLevel } from '../store/types'
import { editorHover, isDirty } from '../store/layoutEdit'
import { isTypingTarget } from './hooks'
import { tryBeginLayoutEdit } from './layoutEditGate'

/** Liderlik panel (not a dock tab; checked against the dock keys in shortcuts.test.ts). */
export const LEADERBOARD_KEY = 'l'

/** Kazanımlar (top-bar book icon; the journal panel, no longer a dock tab). */
export const ACHIEVEMENTS_KEY = 'k'

/**
 * Center screens by key: I İstatistik, Y Kanun Kitabı ('yasa'), H Pazar haritası. The plan's L / M are Liderlik and
 * Mağaza, so the plan names Y and H instead (GAMEPLAY_V2 §14.3; shortcuts.test.ts keeps every key unique).
 */
export const CENTER_KEYS: Readonly<Record<string, CenterKind>> = { i: 'stats', y: 'lawbook', h: 'market' }

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

/** Esc on an expanded scene bubble closes it (the world resumes) before any other Esc behaviour. true = handled. */
export function escapeBubble(): boolean {
  const st = useGameStore.getState()
  if (!st.ui.bubbleOpen) return false
  st.setBubbleOpen(null)
  return true
}

const SPEED_KEYS: Record<string, GameSpeed> = { '1': 1, '2': 2, '3': 4 }

/** Ofisi düzenle (O for Ofis; B is the shop). Again = Bitti. */
export const LAYOUT_KEY = 'o'

/** Esc in the edit mode: the piece in the hand goes back, then the armed piece, the selection, then (with changes) one armed press, then Vazgeç. */
export function escapeLayoutEdit(): void {
  const st = useGameStore.getState()
  const e = st.ui.layoutEdit
  if (!e) return
  if (e.carry) st.layoutEditOp({ kind: 'drop' })
  else if (e.armed) st.layoutEditOp({ kind: 'arm', armed: null })
  else if (e.selected) st.layoutEditOp({ kind: 'select', id: null })
  else if (e.decorSel) st.layoutEditOp({ kind: 'selectDecor', id: null })
  else if (e.wallSel) st.layoutEditOp({ kind: 'selectWall', at: null })
  else if (isDirty(e) && !e.armedCancel) st.layoutEditOp({ kind: 'armCancel', on: true })
  else st.cancelLayoutEdit()
}

/**
 * Keys while the office edit mode is open. true = the key belongs to the edit mode (handled or swallowed). Runs before
 * the normal shortcuts, which skip Ctrl / Meta (so undo lives only here).
 */
export function layoutEditKey(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'preventDefault'> & { target?: EventTarget | null }): boolean {
  const st = useGameStore.getState()
  if (!st.ui.layoutEdit) return false
  const key = e.key.toLowerCase()
  const mod = e.ctrlKey || e.metaKey
  if (mod && (key === 'z' || key === 'y')) {
    e.preventDefault()
    st.layoutEditOp({ kind: key === 'y' || e.shiftKey ? 'redo' : 'undo' })
    return true
  }
  // Browser / OS combos (reload, devtools, copy) stay theirs.
  if (mod || e.altKey) return false
  // Enter on a focused panel button presses that button (Geri al must not also commit).
  if (key === 'enter' && (e.target as Element | null)?.closest?.('button')) return true
  if (key === 'escape') escapeLayoutEdit()
  else if (key === 'enter' || key === LAYOUT_KEY) st.commitLayoutEdit()
  else if (key === 'r') st.layoutEditOp({ kind: 'rotate' })
  else if (key === 'delete' || key === 'backspace') {
    // The piece in the hand, else the one under the pointer, else the selected one.
    const target = st.ui.layoutEdit.carry ?? editorHover.current
    st.layoutEditOp(target ? { kind: 'remove', target } : { kind: 'remove' })
  }
  else if (/^[1-5]$/.test(key)) st.layoutEditOp({ kind: 'team', team: DEPTS[Number(key) - 1]! })
  else if (key === '+' || key === '=') st.setZoom(Math.min(2, st.ui.zoom + 1) as ZoomLevel)
  else if (key === '-' || key === '_') st.setZoom(Math.max(0, st.ui.zoom - 1) as ZoomLevel)
  if (e.code === 'Space') e.preventDefault()
  return true
}

export function useKeyboardShortcuts(tabKeys: Record<string, DockTab>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e)) return
      if (layoutEditKey(e)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = useGameStore.getState()
      const blocking = blockingOverlay(st.ui) !== null
      const key = e.key.toLowerCase()

      if (key === 'escape') {
        if (escapeBubble()) return
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
        // Resume to the player's own speed (N6): a pause during a moment's 1× still hands 4× back.
        if (speed === 0) st.dispatch({ type: 'setSpeed', speed: resumeSpeed(st) })
        else st.dispatch({ type: 'setSpeed', speed: 0 })
        return
      }
      const sp = SPEED_KEYS[key]
      if (sp !== undefined) {
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
      if (key === LAYOUT_KEY) {
        tryBeginLayoutEdit()
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
