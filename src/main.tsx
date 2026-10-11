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
  // ?demo=staff (scene prototype): a run at Pre-seed with one leaver and one idle builder, written as the save so
  // "Devam et" opens it. Dev server only; never in a build.
  if (new URLSearchParams(location.search).get('demo') === 'staff') {
    const [{ runDevPlay }, { writeSave }] = await Promise.all([import('./engine/devPlay'), import('./store/save')])
    const s = runDevPlay({ targetStage: 1 }).state
    const [builder, other] = [s.employees.find((e) => e.dept === 'eng'), s.employees.find((e) => e.dept !== 'eng')]
    if (builder) {
      for (const p of s.projects) p.assignedIds = p.assignedIds.filter((x) => x !== builder.id)
      delete builder.projectId
    }
    if (other) {
      other.status = 'leaving'
      other.statusSinceDay = s.time.day
      other.leaveDay = s.time.day + 30
      other.morale = 25
    }
    writeSave(s)
    history.replaceState(null, '', location.pathname)
  }
}

// ?studio=portraits|items&size=…&page=…: the photo studios (scripts/shoot-portraits.mjs, shoot-items.mjs). Dev only.
const params = new URLSearchParams(location.search)
const studio = import.meta.env.DEV ? params.get('studio') : null
if (studio === 'portraits') {
  const { PortraitStudio } = await import('./render/PortraitStudio')
  document.body.style.background = 'transparent'
  createRoot(root).render(<PortraitStudio size={Number(params.get('size')) || undefined} />)
} else if (studio === 'items') {
  const { ItemStudio } = await import('./render/ItemStudio')
  document.body.style.background = 'transparent'
  createRoot(root).render(<ItemStudio size={Number(params.get('size')) || undefined} page={Number(params.get('page')) || 0} />)
} else {
  initAudio()
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
