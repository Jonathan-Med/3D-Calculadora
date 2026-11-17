import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

/** Cada cuánto busca una versión nueva si la app se queda abierta (por ejemplo, instalada en el celular). */
const UPDATE_CHECK_MS = 60 * 60 * 1000

// Cuando se publica una versión nueva, la página se recarga sola. Lo capturado en Cotizar se
// guarda en el navegador, así que no se pierde.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
