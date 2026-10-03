// Renders store.ui.overlay (max one blocking: move scene, post-mortem, victory), drains the UI queue,
// turns engine events (stageUp / gameOver / victory) into overlays. An open overlay holds time still through
// the store's pause reasons ('modal'), never by rewriting the player's speed. The center screens (CENTER_KINDS:
// statistics, Kanun Kitabı, Pazar haritası) render in the CenterFrame and never pause; a blocking modal replaces them.
// The payday desk (GAMEPLAY V2 §6.1) opens on `paydayShort` (and on a loaded save with a month waiting), takes the place
// of a center screen, and goes ahead of anything queued while a month waits; it holds time through its own `payday`
// pause, and "Sonra" closes it like any overlay (the horizon strip reopens it).
// Everything else (Defter cards, decisions, round, settings) opens in the single right panel.
import { useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import type { GameOverState } from '../engine/types'
import type { Overlay } from '../store/types'
import { requestOverlay, useModalQueue } from './modalQueue'
import { PaydayOverlay } from './overlays/PaydayOverlay'
import { MoveSceneOverlay, PostMortemOverlay, VictoryOverlay } from './overlays/Overlays'
import { CenterFrame } from './stats/CenterFrame'

/** 'acquired' (the sale, GAMEPLAY V2 §8.2) routes to the post-mortem frame, which draws its own AcquiredOverlay screen. */
function gameOverOverlay(kind: GameOverState['kind']): Overlay {
  return kind === 'unicorn' ? { kind: 'victory' } : { kind: 'postMortem' }
}

/** A month waits on the payday desk (and the run goes on). */
function deskWaiting(): boolean {
  const s = useGameStore.getState().state
  return !!s.finance.pendingPayday && !s.gameOver
}

/**
 * requestOverlay with the desk's priority: the desk is not a blocking overlay for the store (it has its own pause), so
 * a move scene arriving while it is open and a month waits queues behind it instead of replacing it. Only the end of
 * the run (post-mortem, or a victory: gameOver is set, no month waits) takes its place.
 */
function requestOverDesk(o: Overlay): void {
  const open = useGameStore.getState().ui.overlay
  if (open?.kind === 'payday' && deskWaiting() && o.kind !== 'postMortem') {
    if (o.kind !== 'payday') useModalQueue.getState().push(o)
    return
  }
  requestOverlay(o)
}

/** Next queued overlay: the payday desk first while a month waits on it; a desk entry with no month left is dropped. */
function takeNext(): Overlay | undefined {
  if (useModalQueue.getState().drop('payday') && deskWaiting()) return { kind: 'payday' }
  return useModalQueue.getState().shift()
}

export function ModalHost() {
  const overlay = useGameStore((s) => s.ui.overlay)
  const closeOverlay = useGameStore((s) => s.closeOverlay)
  const openOverlay = useGameStore((s) => s.openOverlay)
  const queueLen = useModalQueue((q) => q.queue.length)

  const close = useCallback(() => {
    // "Sonra" on the desk must not bring the desk straight back: drop its queued copies first.
    if (useGameStore.getState().ui.overlay?.kind === 'payday') useModalQueue.getState().drop('payday')
    closeOverlay()
    const next = takeNext()
    if (next) openOverlay(next)
  }, [closeOverlay, openOverlay])

  // Drain the queue whenever nothing is open.
  useEffect(() => {
    if (!overlay && queueLen > 0) {
      const next = takeNext()
      if (next) openOverlay(next)
    }
  }, [overlay, queueLen, openOverlay])

  useEngineEventOverlays()

  if (!overlay) return null
  switch (overlay.kind) {
    case 'moveScene':
      return <MoveSceneOverlay onClose={close} />
    case 'postMortem':
      return <PostMortemOverlay />
    case 'victory':
      return <VictoryOverlay />
    case 'payday':
      return <PaydayOverlay onClose={close} />
    case 'stats':
      return <CenterFrame kind="stats" tab={overlay.tab} onClose={closeOverlay} />
    case 'lawbook':
    case 'market':
      return <CenterFrame kind={overlay.kind} onClose={closeOverlay} />
  }
}

/** Own event cursor over state.events (render/Effects keeps its own). */
function useEngineEventOverlays() {
  const cursor = useRef<number | null>(null)
  const events = useGameStore((s) => s.state.events)
  const gameOver = useGameStore((s) => s.state.gameOver)
  const generation = useGameStore((s) => s.ui.generation)

  // New game / load (same run too): skip the loaded event history, never replay it.
  useEffect(() => {
    cursor.current = useGameStore.getState().state.events.reduce((m, e) => Math.max(m, e.id), 0)
    // A save loaded with a month on the desk: the desk is the first thing to answer.
    if (deskWaiting()) requestOverDesk({ kind: 'payday' })
  }, [generation])

  useEffect(() => {
    if (cursor.current === null) return
    const maxId = events.reduce((m, e) => Math.max(m, e.id), 0)
    for (const e of events) {
      if (e.id <= cursor.current) continue
      if (e.kind === 'stageUp') requestOverDesk({ kind: 'moveScene' })
      else if (e.kind === 'victory') requestOverDesk({ kind: 'victory' })
      else if (e.kind === 'paydayShort' && deskWaiting()) requestOverDesk({ kind: 'payday' })
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
    requestOverDesk(gameOverOverlay(gameOver.kind))
  }, [gameOver])
}
