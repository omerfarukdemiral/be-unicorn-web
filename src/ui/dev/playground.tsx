// Dev-only UI playground (not part of the build): /src/ui/dev/playground.html
// Renders GameUI over a flat floor with mock state, so the UI lane can iterate without render/engine.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { GameUI } from '../GameUI'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(
  <StrictMode>
    <div className="relative h-full w-full bg-canvas-bg">
      <GameUI mock />
    </div>
  </StrictMode>,
)
