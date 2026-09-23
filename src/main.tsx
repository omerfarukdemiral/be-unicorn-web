import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initAudio } from './audio'
import { useGameStore } from './store/gameStore'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

// iOS Safari: block page pinch-zoom on HUD/dock/sheets (the canvas has its own discrete pinch zoom).
for (const type of ['gesturestart', 'gesturechange'] as const) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
}

// Dev-only handle for debugging and scripted smoke tests.
if (import.meta.env.DEV) {
  const w = window as unknown as { __store: typeof useGameStore; __replay: () => unknown }
  w.__store = useGameStore
  // Seed + actions of this run, for reproducible bug reports (PLAN §8.3).
  w.__replay = () => useGameStore.getState().exportReplay()
}

initAudio()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
