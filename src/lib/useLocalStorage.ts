import { useEffect, useState } from 'react'

/**
 * Estado que sobrevive a recargar la página. `revive` recibe lo guardado (o
 * `undefined`) y devuelve un valor válido, así un formato viejo no rompe la app.
 */
export function useLocalStorage<T>(
  key: string,
  revive: (stored: unknown) => T,
): [T, (next: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return revive(raw === null ? undefined : JSON.parse(raw))
    } catch {
      return revive(undefined)
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Sin almacenamiento (modo privado, cuota llena) la app sigue funcionando sin recordar.
    }
  }, [key, value])

  return [value, setValue]
}
