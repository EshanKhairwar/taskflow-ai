import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// TaskFlow AI uses a fixed dark workspace theme. No theme toggle is exposed.
document.documentElement.classList.add('dark')
document.documentElement.style.colorScheme = 'dark'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
