import { describe, expect, it } from 'vitest'
import { quantityScenarios } from './batch'
import { DEFAULT_SETTINGS } from './defaults'
import type { JobInput, Settings } from './types'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  printer: { name: 'Prueba', purchasePrice: 6000, lifespanHours: 5000, avgPowerWatts: 100 },
  spareParts: [{ id: 'hotend', name: 'Hotend', price: 300, lifespanHours: 1000 }],
  electricityPricePerKwh: 4,
  laborRatePerHour: 60,
  wastePercent: 10,
  failurePercent: 10,
}

const job: JobInput = {
  hoursPerPlate: 4,
  piecesPerPlate: 4,
  quantity: 8,
  materials: [{ label: 'PLA', gramsPerPlate: 100, filament: { spoolPrice: 400, spoolGrams: 1000 } }],
  laborMinutesPerOrder: 30,
  laborMinutesPerPiece: 5,
  extras: [
    { name: 'Argolla', unitCost: 3, quantity: 1, per: 'piece' },
    { name: 'Caja', unitCost: 20, quantity: 1, per: 'order' },
  ],
}

describe('quantityScenarios', () => {
  const scenarios = quantityScenarios(job, settings)

  it('incluye la cantidad pedida, ordenada entre las de referencia', () => {
    expect(scenarios.map((scenario) => scenario.quantity)).toEqual([1, 5, 8, 10, 25, 50, 100])
    expect(scenarios.filter((scenario) => scenario.current).map((s) => s.quantity)).toEqual([8])
  })

  it('no duplica la cantidad pedida si ya es una de referencia', () => {
    const ten = quantityScenarios({ ...job, quantity: 10 }, settings)
    expect(ten.map((scenario) => scenario.quantity)).toEqual([1, 5, 10, 25, 50, 100])
  })

  it('calcula el costo por pieza de cada cantidad', () => {
    // 1 pieza: 11 material + 1.90 máquina + 1.29 fallos + 23 extras + 35 trabajo
    expect(scenarios[0].unitCost).toBeCloseTo(72.19)
    expect(scenarios[2].unitCost).toBeCloseTo(28.44)
    expect(scenarios[2].plates).toBe(2)
    expect(scenarios[2].hours).toBeCloseTo(8)
  })

  it('el costo por pieza nunca sube al pedir más', () => {
    for (let i = 1; i < scenarios.length; i++) {
      expect(scenarios[i].unitCost).toBeLessThanOrEqual(scenarios[i - 1].unitCost)
    }
  })
})
