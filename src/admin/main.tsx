// The admin panel's own entry (admin.html, served at /admin): none of the game's code or 3D is loaded here.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { AdminApp } from './AdminApp'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
