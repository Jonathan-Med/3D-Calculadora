import { describe, expect, it } from 'vitest'
import { calculateCost, machineHourlyRates, piecesPerSpool } from './cost'
import { DEFAULT_FILAMENTS, DEFAULT_SETTINGS } from './defaults'
import type { JobInput, Settings } from './types'

/** Números redondos para poder revisar cada cuenta a mano. */
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
  gramsPerPlate: 100,
  hoursPerPlate: 4,
  piecesPerPlate: 4,
  quantity: 8,
  filament: { spoolPrice: 400, spoolGrams: 1000 },
  laborMinutesPerOrder: 30,
  laborMinutesPerPiece: 5,
  extras: [
    { name: 'Argolla', unitCost: 3, quantity: 1, per: 'piece' },
    { name: 'Caja', unitCost: 20, quantity: 1, per: 'order' },
  ],
}

describe('machineHourlyRates', () => {
  it('calcula luz, desgaste y repuestos por hora', () => {
    const rates = machineHourlyRates(settings)
    expect(rates.electricity).toBeCloseTo(0.4) // 0.1 kW × $4
    expect(rates.depreciation).toBeCloseTo(1.2) // $6000 / 5000 h
    expect(rates.maintenance).toBeCloseTo(0.3) // $300 / 1000 h
    expect(rates.total).toBeCloseTo(1.9)
  })

  it('suma todos los repuestos', () => {
    const rates = machineHourlyRates({
      ...settings,
      spareParts: [
        { id: 'a', name: 'A', price: 300, lifespanHours: 1000 },
        { id: 'b', name: 'B', price: 450, lifespanHours: 1500 },
      ],
    })
    expect(rates.maintenance).toBeCloseTo(0.6)
  })
})

describe('calculateCost', () => {
  const cost = calculateCost(job, settings)

  it('escala gramos y horas de la cama al pedido', () => {
    expect(cost.totals.pieces).toBe(8)
    expect(cost.totals.plates).toBe(2)
    expect(cost.totals.hours).toBeCloseTo(8)
    expect(cost.totals.grams).toBeCloseTo(220) // 200 g + 10 % de merma
  })

  it('desglosa cada renglón', () => {
    expect(cost.material).toBeCloseTo(88) // 220 g × $0.40
    expect(cost.electricity).toBeCloseTo(3.2) // 8 h × $0.40
    expect(cost.depreciation).toBeCloseTo(9.6) // 8 h × $1.20
    expect(cost.maintenance).toBeCloseTo(2.4) // 8 h × $0.30
    expect(cost.failures).toBeCloseTo(10.32) // 10 % de 103.20
    expect(cost.extras).toBeCloseTo(44) // 8 argollas × $3 + 1 caja × $20
    expect(cost.labor).toBeCloseTo(70) // (30 + 8 × 5) min a $60 la hora
  })

  it('separa lo que sale de la bolsa del costo real', () => {
    expect(cost.cashCost).toBeCloseTo(144.32) // (88 + 3.20) × 1.1 + 44
    expect(cost.machineReserve).toBeCloseTo(13.2) // (9.60 + 2.40) × 1.1
    expect(cost.totalCost).toBeCloseTo(227.52)
    expect(cost.perPiece.cashCost).toBeCloseTo(18.04)
    expect(cost.perPiece.totalCost).toBeCloseTo(28.44)
  })

  it('el costo real es la suma de los renglones', () => {
    const lines =
      cost.material +
      cost.electricity +
      cost.depreciation +
      cost.maintenance +
      cost.failures +
      cost.extras +
      cost.labor
    expect(cost.totalCost).toBeCloseTo(lines)
    expect(cost.totalCost).toBeCloseTo(cost.cashCost + cost.machineReserve + cost.labor)
  })

  it('hacer más piezas baja el costo por pieza porque el trabajo fijo se reparte', () => {
    const one = calculateCost({ ...job, quantity: 1 }, settings)
    const many = calculateCost({ ...job, quantity: 40 }, settings)
    expect(many.perPiece.totalCost).toBeLessThan(one.perPiece.totalCost)
  })

  it('cuenta una cama extra cuando el pedido no llena la última', () => {
    const partial = calculateCost({ ...job, quantity: 9 }, settings)
    expect(partial.totals.plates).toBe(3)
    expect(partial.totals.hours).toBeCloseTo(9)
  })

  it('trata campos vacíos o inválidos como cero sin romperse', () => {
    const empty = calculateCost(
      {
        gramsPerPlate: NaN,
        hoursPerPlate: -3,
        piecesPerPlate: 0,
        quantity: 0,
        filament: { spoolPrice: 400, spoolGrams: 0 },
        laborMinutesPerOrder: NaN,
        laborMinutesPerPiece: NaN,
        extras: [],
      },
      { ...settings, printer: { ...settings.printer, lifespanHours: 0 } },
    )
    expect(empty.totalCost).toBe(0)
    expect(empty.totals.pieces).toBe(1)
    expect(empty.totals.plates).toBe(1)
    expect(Number.isFinite(empty.perPiece.totalCost)).toBe(true)
  })

  it('con los valores de fábrica: 9 llaveros en una cama de 90 g y 3 h', () => {
    const keychains = calculateCost(
      {
        gramsPerPlate: 90,
        hoursPerPlate: 3,
        piecesPerPlate: 9,
        quantity: 9,
        filament: DEFAULT_FILAMENTS[0],
        laborMinutesPerOrder: 15,
        laborMinutesPerPiece: 2,
        extras: [{ name: 'Argolla', unitCost: 2, quantity: 1, per: 'piece' }],
      },
      DEFAULT_SETTINGS,
    )
    expect(keychains.material).toBeCloseTo(33.075)
    expect(keychains.electricity).toBeCloseTo(0.96)
    expect(keychains.depreciation).toBeCloseTo(3.48)
    expect(keychains.maintenance).toBeCloseTo(2.1)
    expect(keychains.failures).toBeCloseTo(1.98075)
    expect(keychains.extras).toBeCloseTo(18)
    expect(keychains.labor).toBeCloseTo(33)
    expect(keychains.totalCost).toBeCloseTo(92.59575)
    expect(keychains.perPiece.totalCost).toBeCloseTo(10.2884, 3)
  })
})

describe('piecesPerSpool', () => {
  it('cuenta piezas completas con la merma incluida', () => {
    // 25 g + 10 % = 27.5 g por pieza; 1000 / 27.5 = 36.36
    expect(piecesPerSpool(25, { spoolGrams: 1000 }, 10)).toBe(36)
  })

  it('devuelve 0 si la pieza no pesa nada', () => {
    expect(piecesPerSpool(0, { spoolGrams: 1000 }, 10)).toBe(0)
  })
})
