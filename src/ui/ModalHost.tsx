// Renders store.ui.overlay (max one blocking), drains the UI queue, turns engine events
// (stageUp / gameOver / victory) into overlays, and pauses the game while a modal is open.
import { useCallback, useEffect, useRef } from 'react'
import type { GameSpeed } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import type { Overlay } from '../store/types'
import { requestOverlay, useModalQueue } from './modalQueue'
import {
  ConceptCardOverlay,
  DecisionOverlay,
  MoveSceneOverlay,
  PostMortemOverlay,
  ReflectionOverlay,
  RoundOverlay,
  SettingsOverlay,
  VictoryOverlay,
} from './overlays/Overlays'

function gameOverOverlay(kind: 'bankrupt' | 'teamLost' | 'unicorn'): Overlay {
  return kind === 'unicorn' ? { kind: 'victory' } : { kind: 'postMortem' }
}

export function ModalHost() {
  const overlay = useGameStore((s) => s.ui.overlay)
  const closeOverlay = useGameStore((s) => s.closeOverlay)
  const openOverlay = useGameStore((s) => s.openOverlay)
  const queueLen = useModalQueue((q) => q.queue.length)

  const close = useCallback(() => {
    closeOverlay()
    const next = useModalQueue.getState().shift()
    if (next) openOverlay(next)
  }, [closeOverlay, openOverlay])

  // Drain the queue whenever nothing is open.
  useEffect(() => {
    if (!overlay && queueLen > 0) {
      const next = useModalQueue.getState().shift()
      if (next) openOverlay(next)
    }
  }, [overlay, queueLen, openOverlay])

  useEngineEventOverlays()
  usePauseWhileModal(overlay)

  if (!overlay) return null
  switch (overlay.kind) {
    case 'conceptCard':
      return <ConceptCardOverlay conceptId={overlay.conceptId} onClose={close} />
    case 'decision':
      return <DecisionOverlay cardId={overlay.cardId} onClose={close} />
    case 'reflection':
      return <ReflectionOverlay cardId={overlay.cardId} optionIndex={overlay.optionIndex} onClose={close} />
    case 'round':
      return <RoundOverlay onClose={close} />
    case 'moveScene':
      return <MoveSceneOverlay onClose={close} />
    case 'postMortem':
      return <PostMortemOverlay />
    case 'victory':
      return <VictoryOverlay />
    case 'settings':
      return <SettingsOverlay onClose={close} />
  }
}

/** Own event cursor (render keeps using ui.lastSeenEventId for its effects). */
function useEngineEventOverlays() {
  const cursor = useRef<number | null>(null)
  const events = useGameStore((s) => s.state.events)
  const gameOver = useGameStore((s) => s.state.gameOver)
  const runIndex = useGameStore((s) => s.state.meta.runIndex)

  // New game / load: skip event history.
  useEffect(() => {
    cursor.current = useGameStore.getState().state.events.reduce((m, e) => Math.max(m, e.id), 0)
  }, [runIndex])

  useEffect(() => {
    if (cursor.current === null) return
    // Ring buffer: a new game restarts ids; resync if we are ahead.
    const maxId = events.reduce((m, e) => Math.max(m, e.id), 0)
    if (maxId < cursor.current) cursor.current = 0
    for (const e of events) {
      if (e.id <= cursor.current) continue
      if (e.kind === 'stageUp') requestOverlay({ kind: 'moveScene' })
      else if (e.kind === 'victory') requestOverlay({ kind: 'victory' })
    }
    cursor.current = Math.max(cursor.current, maxId)
  }, [events])

  // gameOver may appear without an event (e.g. engine sets it directly).
  const shown = useRef<string | null>(null)
  useEffect(() => {
    if (!gameOver) {
      shown.current = null
      return
    }
    const key = `${gameOver.kind}:${gameOver.day}`
    if (shown.current === key) return
    shown.current = key
    requestOverlay(gameOverOverlay(gameOver.kind))
  }, [gameOver])
}

/** Blocking modal = paused world; restore the previous speed when all modals are gone. */
function usePauseWhileModal(overlay: Overlay | null) {
  const pausedFrom = useRef<GameSpeed | null>(null)
  const open = overlay !== null
  useEffect(() => {
    const { state, dispatch } = useGameStore.getState()
    if (open) {
      if (pausedFrom.current === null && state.time.speed !== 0 && !state.gameOver) {
        pausedFrom.current = state.time.speed
        dispatch({ type: 'setSpeed', speed: 0 })
      }
      return
    }
    const prev = pausedFrom.current
    pausedFrom.current = null
    if (prev !== null && state.time.speed === 0 && !state.gameOver) dispatch({ type: 'setSpeed', speed: prev })
  }, [open])
}
