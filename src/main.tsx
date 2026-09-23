import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useGameStore } from './store/gameStore'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

// Dev-only handle for debugging and scripted smoke tests.
if (import.meta.env.DEV) (window as unknown as { __store: typeof useGameStore }).__store = useGameStore

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
