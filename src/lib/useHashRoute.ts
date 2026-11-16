import { useSyncExternalStore } from 'react'

export type Route = 'cotizar' | 'historial' | 'configuracion'

export const ROUTE_HREF: Record<Route, string> = {
  cotizar: '#/cotizar',
  historial: '#/historial',
  configuracion: '#/configuracion',
}

const ROUTES = Object.keys(ROUTE_HREF) as Route[]

const read = (): Route =>
  ROUTES.find((route) => ROUTE_HREF[route] === window.location.hash) ?? 'cotizar'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Navegación por hash: funciona en GitHub Pages sin configurar redirecciones. */
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, read)
}
