import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getBrowserStorage } from './todos/storage'
import { createTodoStore } from './todos/store'

const store = createTodoStore(getBrowserStorage())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
)

// Offline support for the installed app. Only in the production build, so it never caches dev files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Not available (e.g. plain http on a local network); the app works without it.
    })
  })
}
