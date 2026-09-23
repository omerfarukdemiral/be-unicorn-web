// Wires sound cues to the game: engine events (own cursor over state.events), panel changes,
// speed/pause, action errors, game over — plus a soft tap for any UI button press.
import type { GameEvent, GameEventKind, GameState } from '../engine/types'
import { useGameStore } from '../store/gameStore'
import type { GameStore } from '../store/types'
import { usePrefs } from '../ui/hooks'
import { playCue, setAudioEnabled, unlockAudio, type CueId } from './synth'

export { playCue } from './synth'

/** Engine event → cue. Unlisted kinds stay silent (too frequent or covered elsewhere). */
const EVENT_CUES: Partial<Record<GameEventKind, CueId>> = {
  hired: 'hired',
  fired: 'left',
  resigned: 'left',
  itemPlaced: 'itemPlaced',
  itemSold: 'itemSold',
  itemMoved: 'itemMoved',
  ringOpened: 'ringOpened',
  projectLaunched: 'projectLaunched',
  milestone: 'milestone',
  roundStarted: 'roundStarted',
  roundClosed: 'roundClosed',
  stageUp: 'stageUp',
  conceptQueued: 'conceptQueued',
  conceptLearned: 'conceptLearned',
  decisionShown: 'decisionShown',
  decisionAnswered: 'decisionAnswered',
  visitorArrived: 'visitor',
  founderActionStarted: 'actionStart',
  founderActionDone: 'actionDone',
  bankruptWarning: 'warning',
}

/** Higher plays first; one batch of new events plays only its most important cue. */
const PRIORITY: Partial<Record<CueId, number>> = {
  stageUp: 10,
  roundClosed: 9,
  projectLaunched: 8,
  milestone: 7,
  warning: 7,
  ringOpened: 6,
  hired: 5,
  left: 5,
  roundStarted: 5,
  conceptLearned: 4,
  decisionShown: 4,
  itemPlaced: 4,
  itemSold: 4,
  itemMoved: 4,
  decisionAnswered: 3,
  actionDone: 3,
  actionStart: 2,
  conceptQueued: 1,
  visitor: 1,
}

/** The single cue to play for a batch of new engine events (null = stay quiet). */
export function cueForEvents(events: readonly GameEvent[]): CueId | null {
  let best: CueId | null = null
  for (const e of events) {
    const cue = EVENT_CUES[e.kind]
    if (cue && (best === null || (PRIORITY[cue] ?? 0) > (PRIORITY[best] ?? 0))) best = cue
  }
  return best
}

// A button tap waits a moment; any meaningful cue triggered by the same press replaces it.
let pendingTap = 0

function cue(id: CueId): void {
  if (pendingTap) {
    window.clearTimeout(pendingTap)
    pendingTap = 0
  }
  playCue(id)
}

const TAPPABLE = 'button, [role="button"], a[href], input[type="checkbox"], summary'

function onClick(e: MouseEvent): void {
  const el = (e.target as Element | null)?.closest?.(TAPPABLE) as HTMLButtonElement | null
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return
  if (pendingTap) window.clearTimeout(pendingTap)
  pendingTap = window.setTimeout(() => {
    pendingTap = 0
    playCue('tap')
  }, 30)
}

const maxEventId = (s: GameState) => s.events.reduce((m, e) => Math.max(m, e.id), 0)

function onStore(next: GameStore, prev: GameStore): void {
  const s = next.state
  const p = prev.state

  // New game / load: skip history; a fresh run gets its own jingle.
  if (next.ui.generation !== prev.ui.generation) {
    cursor = maxEventId(s)
    if (s.time.day < 1) cue('start')
    return
  }

  // Game over replaces everything else in the same update.
  if (s.gameOver && !p.gameOver) {
    cursor = maxEventId(s)
    cue(s.gameOver.kind === 'unicorn' ? 'victory' : 'gameOver')
    return
  }

  if (s.events !== p.events) {
    const fresh = s.events.filter((e) => e.id > cursor)
    cursor = Math.max(cursor, maxEventId(s))
    const c = cueForEvents(fresh)
    if (c) cue(c)
  }

  if (s.projects.length > p.projects.length) cue('projectStarted')

  if (next.ui.lastError && next.ui.lastError.at !== prev.ui.lastError?.at) cue('error')

  // Player speed changes only (overlays pause the game themselves).
  if (s.time.speed !== p.time.speed && next.ui.overlay === null && prev.ui.overlay === null) {
    if (s.time.speed === 0) cue('pause')
    else if (p.time.speed === 0) cue('resume')
    else cue('speed')
  }

  const a = next.ui.panel
  const b = prev.ui.panel
  if (a !== b && a?.kind !== b?.kind && a?.kind !== 'decision') {
    if (a && !b) cue('panelOpen')
    else if (!a && b) cue('panelClose')
    else if (a) cue('panelOpen')
  }
}

let cursor = 0
let started = false

/** Installs listeners once (idempotent). Call at startup. */
export function initAudio(): void {
  if (started || typeof window === 'undefined') return
  started = true
  cursor = maxEventId(useGameStore.getState().state)
  setAudioEnabled(usePrefs.getState().sound)
  usePrefs.subscribe((p) => setAudioEnabled(p.sound))
  // Browsers unlock audio only inside a user gesture.
  const unlock = () => unlockAudio()
  window.addEventListener('pointerdown', unlock, { capture: true })
  window.addEventListener('keydown', unlock, { capture: true })
  document.addEventListener('click', onClick, { capture: true })
  useGameStore.subscribe(onStore)
}
