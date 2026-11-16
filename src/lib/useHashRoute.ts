import { useSyncExternalStore } from 'react'

export type Route = 'cotizar' | 'configuracion'

export const ROUTE_HREF: Record<Route, string> = {
  cotizar: '#/cotizar',
  configuracion: '#/configuracion',
}

const read = (): Route =>
  window.location.hash === ROUTE_HREF.configuracion ? 'configuracion' : 'cotizar'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Navegación por hash: funciona en GitHub Pages sin configurar redirecciones. */
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, read)
}
