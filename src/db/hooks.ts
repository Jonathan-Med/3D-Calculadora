import { useLiveQuery } from 'dexie-react-hooks'
import type { EstimableField, ExtraItem, Filament, Settings } from '../domain/types'
import { db, SETTINGS_ID } from './db'

/** `undefined` mientras carga. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get(SETTINGS_ID))
}

export function useFilaments(): Filament[] | undefined {
  return useLiveQuery(() => db.filaments.toArray())
}

export function useExtras(): ExtraItem[] | undefined {
  return useLiveQuery(() => db.extras.toArray())
}

/**
 * Cambia la configuración de forma atómica. Si el cambio captura un dato real,
 * pasa `confirmed` para que el campo deje de marcarse como estimado.
 */
export function updateSettings(change: (settings: Settings) => void, confirmed?: EstimableField) {
  return db.settings
    .where('id')
    .equals(SETTINGS_ID)
    .modify((row) => {
      change(row)
      if (confirmed) row.estimated = row.estimated.filter((field) => field !== confirmed)
    })
}

export const addFilament = () =>
  db.filaments.add({ name: 'Nuevo filamento', spoolPrice: 0, spoolGrams: 1000 } as Filament)
export const updateFilament = (id: number, changes: Partial<Omit<Filament, 'id'>>) =>
  db.filaments.update(id, changes)
export const removeFilament = (id: number) => db.filaments.delete(id)

export const addExtra = () =>
  db.extras.add({ name: 'Nuevo extra', unitCost: 0, per: 'piece' } as ExtraItem)
export const updateExtra = (id: number, changes: Partial<Omit<ExtraItem, 'id'>>) =>
  db.extras.update(id, changes)
export const removeExtra = (id: number) => db.extras.delete(id)
