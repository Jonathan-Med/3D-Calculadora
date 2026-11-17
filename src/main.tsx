import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

/** Cada cuánto busca una versión nueva si la app se queda abierta (por ejemplo, instalada en el celular). */
const UPDATE_CHECK_MS = 60 * 60 * 1000

// Cuando se publica una versión nueva, la página se recarga sola. Lo capturado en Cotizar se
// guarda en el navegador, así que no se pierde. Además de cada hora, busca al volver a la app:
// en el celular suele quedarse abierta en segundo plano, sin recargarse ni correr el reloj.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => void registration.update().catch(() => {})
    setInterval(check, UPDATE_CHECK_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
