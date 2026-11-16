import Dexie, { type EntityTable } from 'dexie'
import {
  DEFAULT_BUSINESS,
  DEFAULT_EXTRAS,
  DEFAULT_FILAMENTS,
  DEFAULT_SETTINGS,
} from '../domain/defaults'
import type { ExtraItem, Filament, Settings } from '../domain/types'

export const SETTINGS_ID = 'main'

export type SettingsRow = Settings & { id: typeof SETTINGS_ID }

export const db = new Dexie('calculadora-3d') as Dexie & {
  settings: EntityTable<SettingsRow, 'id'>
  filaments: EntityTable<Filament, 'id'>
  extras: EntityTable<ExtraItem, 'id'>
}

db.version(1).stores({
  settings: 'id',
  filaments: '++id',
  extras: '++id',
})

// v2: datos del negocio para la cotización del cliente.
db.version(2).upgrade((tx) =>
  tx
    .table<SettingsRow, string>('settings')
    .toCollection()
    .modify((row) => {
      row.business ??= structuredClone(DEFAULT_BUSINESS)
    }),
)

// Solo la primera vez: si después se borran todos los filamentos o extras, no reaparecen.
db.on('populate', (tx) => {
  tx.table('filaments').bulkAdd(DEFAULT_FILAMENTS)
  tx.table('extras').bulkAdd(DEFAULT_EXTRAS)
})

// La configuración debe existir siempre.
db.on('ready', async (vipDb) => {
  const settings = vipDb.table<SettingsRow, string>('settings')
  if (!(await settings.get(SETTINGS_ID))) {
    await settings.add({ ...structuredClone(DEFAULT_SETTINGS), id: SETTINGS_ID })
  }
})
