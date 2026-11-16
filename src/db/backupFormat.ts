import { DEFAULT_BUSINESS, DEFAULT_SETTINGS } from '../domain/defaults'
import type { ExtraItem, Filament, SavedQuote, Settings } from '../domain/types'

export const BACKUP_APP = 'calculadora-3d'

/** El archivo de respaldo: todo lo que la app guarda en el dispositivo. */
export interface Backup {
  app: typeof BACKUP_APP
  version: 1
  exportedAt: string
  settings: Settings
  filaments: Filament[]
  extras: ExtraItem[]
  quotes: SavedQuote[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isObjectArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isObject)

const isFilament = (value: Record<string, unknown>): boolean =>
  typeof value.name === 'string' && isNumber(value.spoolPrice) && isNumber(value.spoolGrams)

const isExtra = (value: Record<string, unknown>): boolean =>
  typeof value.name === 'string' && isNumber(value.unitCost)

const isQuote = (value: Record<string, unknown>): boolean =>
  isNumber(value.createdAt) &&
  isNumber(value.totalPrice) &&
  isObject(value.cost) &&
  isObject(value.cost.totals) &&
  isNumber(value.cost.cashCost)

/**
 * Revisa que un archivo sea un respaldo de esta app antes de reemplazar los datos.
 * Devuelve null si no lo es. Los campos de configuración que falten (respaldos
 * de versiones anteriores) se rellenan con los valores de fábrica.
 */
export function parseBackup(raw: unknown): Backup | null {
  if (!isObject(raw) || raw.app !== BACKUP_APP || raw.version !== 1) return null

  const { settings, filaments, extras, quotes } = raw
  if (!isObject(settings) || !isObject(settings.printer)) return null
  if (!isNumber(settings.printer.purchasePrice) || !isNumber(settings.printer.lifespanHours)) return null
  if (!isObjectArray(settings.spareParts) || !isObjectArray(settings.priceTiers)) return null
  if (!Array.isArray(settings.estimated)) return null
  if (!isObjectArray(filaments) || !filaments.every(isFilament)) return null
  if (!isObjectArray(extras) || !extras.every(isExtra)) return null
  if (!isObjectArray(quotes) || !quotes.every(isQuote)) return null

  const partial = settings as Partial<Settings>
  return {
    app: BACKUP_APP,
    version: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    settings: {
      ...DEFAULT_SETTINGS,
      ...partial,
      business: { ...DEFAULT_BUSINESS, ...(isObject(settings.business) ? settings.business : {}) },
    },
    filaments: filaments as unknown as Filament[],
    extras: extras as unknown as ExtraItem[],
    quotes: quotes as unknown as SavedQuote[],
  }
}
