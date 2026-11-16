import { describe, expect, it } from 'vitest'
import { calculateCost } from '../domain/cost'
import { DEFAULT_EXTRAS, DEFAULT_FILAMENTS, DEFAULT_SETTINGS } from '../domain/defaults'
import { BACKUP_APP, parseBackup, type Backup } from './backupFormat'

const cost = calculateCost(
  {
    gramsPerPlate: 90,
    hoursPerPlate: 3,
    piecesPerPlate: 9,
    quantity: 9,
    filament: DEFAULT_FILAMENTS[0],
    laborMinutesPerOrder: 15,
    laborMinutesPerPiece: 2,
    extras: [],
  },
  DEFAULT_SETTINGS,
)

const backup: Backup = {
  app: BACKUP_APP,
  version: 1,
  exportedAt: '2026-11-16T18:00:00.000Z',
  settings: { ...DEFAULT_SETTINGS, laborRatePerHour: 80 },
  filaments: DEFAULT_FILAMENTS,
  extras: DEFAULT_EXTRAS,
  quotes: [
    {
      id: 1,
      createdAt: 1794850000000,
      status: 'sold',
      soldAt: 1794860000000,
      title: 'Llaveros',
      customer: 'Ana',
      pieces: 9,
      unitPrice: 16,
      totalPrice: 144,
      priceLabel: 'Precio Regular',
      cost,
      draft: { gramsPerPlate: 90 },
    },
  ],
}

/** Como llega al leer el archivo: sin tipos ni referencias compartidas. */
const fromFile = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

describe('parseBackup', () => {
  it('acepta un respaldo completo tal como se exportó', () => {
    expect(parseBackup(fromFile(backup))).toEqual(backup)
  })

  it('rechaza lo que no es un respaldo de esta app', () => {
    expect(parseBackup(null)).toBeNull()
    expect(parseBackup('texto')).toBeNull()
    expect(parseBackup([])).toBeNull()
    expect(parseBackup({ ...backup, app: 'otra-app' })).toBeNull()
    expect(parseBackup({ ...backup, version: 2 })).toBeNull()
  })

  it('rechaza un respaldo con partes dañadas', () => {
    expect(parseBackup({ ...backup, settings: null })).toBeNull()
    expect(parseBackup({ ...backup, settings: { ...backup.settings, printer: null } })).toBeNull()
    expect(parseBackup({ ...backup, settings: { ...backup.settings, spareParts: 'x' } })).toBeNull()
    expect(parseBackup({ ...backup, filaments: [{ name: 'PLA' }] })).toBeNull()
    expect(parseBackup({ ...backup, extras: 'x' })).toBeNull()
    expect(parseBackup({ ...backup, quotes: [{ title: 'sin costos' }] })).toBeNull()
  })

  it('rellena lo que falta en un respaldo de una versión anterior', () => {
    const old = fromFile(backup) as { settings: Record<string, unknown> }
    delete old.settings.business
    delete old.settings.roundTo
    const parsed = parseBackup(old)
    expect(parsed?.settings.business).toEqual(DEFAULT_SETTINGS.business)
    expect(parsed?.settings.roundTo).toBe(DEFAULT_SETTINGS.roundTo)
    expect(parsed?.settings.laborRatePerHour).toBe(80)
  })

  it('acepta un respaldo sin pedidos', () => {
    expect(parseBackup({ ...backup, quotes: [] })?.quotes).toEqual([])
  })
})
