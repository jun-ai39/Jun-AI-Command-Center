import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadAndApplyDisplayPreferences } from './features/display-preferences/displayPreferences'

loadAndApplyDisplayPreferences()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
