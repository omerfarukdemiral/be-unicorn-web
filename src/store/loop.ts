// Fixed-tick driver: rAF feeds real elapsed seconds into store.tick (which steps the engine in
// FIXED_STEP_DAYS chunks). Stops while the tab is hidden; autosaves periodically and on hide.
// F5: one throwing step never freezes the game (the next frame is always armed; three in a row pause it), and every
// autosave refreshes the run mark and the exit note (store/session.ts) so a reload resumes the run and names the cause.
import { useGameStore } from './gameStore'
import { markRunOnScreen, noteExit } from './session'

const AUTOSAVE_MS = 10_000
/** Clamp long frames (tab switch, debugger) so a hitch never fast-forwards the sim. */
const MAX_FRAME_S = 0.25
/** Consecutive throwing frames before the loop pauses the world instead of spinning on the same error. */
export const MAX_TICK_ERRORS = 3

let raf = 0
let last = 0
let lastSave = 0
let running = false
let tickErrors = 0

function errText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e)
}

/** Saves and refreshes the run mark + exit note (never throws). */
function checkpoint(hidden: boolean): void {
  const store = useGameStore.getState()
  try {
    store.save()
  } catch (e) {
    console.error('[loop] save failed', e)
  }
  const day = store.state.time.day
  markRunOnScreen(day)
  noteExit({ day: Math.floor(day), hidden })
}

/** One frame's work; exported for tests. A throw is logged and counted, never propagated. */
export function runFrame(dt: number, now: number): void {
  const store = useGameStore.getState()
  try {
    store.tick(dt)
    tickErrors = 0
  } catch (e) {
    tickErrors++
    console.error('[loop] tick failed', e)
    noteExit({ err: `tick: ${errText(e)}` })
    if (tickErrors >= MAX_TICK_ERRORS) {
      tickErrors = 0
      try {
        store.dispatch({ type: 'setSpeed', speed: 0 })
      } catch {
        /* the world stays where it is */
      }
    }
  }
  if (now - lastSave > AUTOSAVE_MS) {
    lastSave = now
    checkpoint(false)
  }
}

function frame(now: number) {
  if (!running) return
  const dt = Math.min(MAX_FRAME_S, Math.max(0, (now - last) / 1000))
  last = now
  // Armed first: whatever this frame does, the next one comes.
  raf = requestAnimationFrame(frame)
  runFrame(dt, now)
}

function resume() {
  if (!running || raf) return
  last = performance.now()
  raf = requestAnimationFrame(frame)
}

function suspend() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

function onVisibility() {
  if (document.hidden) {
    suspend()
    checkpoint(true)
  } else {
    noteExit({ hidden: false })
    resume()
  }
}

function onPageHide() {
  checkpoint(true)
}

function onError(e: ErrorEvent) {
  noteExit({ err: e.message || errText(e.error) })
}

function onRejection(e: PromiseRejectionEvent) {
  noteExit({ err: `promise: ${errText(e.reason)}` })
}

/** Starts the loop; returns a stop function (idempotent). */
export function startLoop(): () => void {
  if (running) return stopLoop
  running = true
  tickErrors = 0
  lastSave = performance.now()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  if (!document.hidden) resume()
  return stopLoop
}

export function stopLoop(): void {
  if (!running) return
  running = false
  suspend()
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('error', onError)
  window.removeEventListener('unhandledrejection', onRejection)
}
