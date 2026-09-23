// Fixed-tick driver: rAF feeds real elapsed seconds into store.tick (which steps the engine in
// FIXED_STEP_DAYS chunks). Stops while the tab is hidden; autosaves periodically and on hide.
import { useGameStore } from './gameStore'

const AUTOSAVE_MS = 10_000
/** Clamp long frames (tab switch, debugger) so a hitch never fast-forwards the sim. */
const MAX_FRAME_S = 0.25

let raf = 0
let last = 0
let lastSave = 0
let running = false

function frame(now: number) {
  if (!running) return
  const dt = Math.min(MAX_FRAME_S, Math.max(0, (now - last) / 1000))
  last = now
  const store = useGameStore.getState()
  store.tick(dt)
  if (now - lastSave > AUTOSAVE_MS) {
    lastSave = now
    store.save()
  }
  raf = requestAnimationFrame(frame)
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
    useGameStore.getState().save()
  } else resume()
}

function onPageHide() {
  useGameStore.getState().save()
}

/** Starts the loop; returns a stop function (idempotent). */
export function startLoop(): () => void {
  if (running) return stopLoop
  running = true
  lastSave = performance.now()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  if (!document.hidden) resume()
  return stopLoop
}

export function stopLoop(): void {
  if (!running) return
  running = false
  suspend()
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
}
