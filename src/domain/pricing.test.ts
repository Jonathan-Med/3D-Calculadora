import { describe, expect, it } from 'vitest'
import { calculateCost } from './cost'
import { DEFAULT_SETTINGS } from './defaults'
import { evaluatePrice, roundUpTo, suggestPrices } from './pricing'
import type { JobInput, Settings } from './types'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  printer: { name: 'Prueba', purchasePrice: 6000, lifespanHours: 5000, avgPowerWatts: 100 },
  spareParts: [{ id: 'hotend', name: 'Hotend', price: 300, lifespanHours: 1000 }],
  electricityPricePerKwh: 4,
  laborRatePerHour: 60,
  wastePercent: 10,
  failurePercent: 10,
  roundTo: 5,
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

// De cost.test.ts: cashCost 144.32, totalCost 227.52, labor 70, 8 piezas.
const cost = calculateCost(job, settings)

describe('roundUpTo', () => {
  it('redondea hacia arriba al múltiplo', () => {
    expect(roundUpTo(42.66, 5)).toBe(45)
    expect(roundUpTo(45, 5)).toBe(45)
    expect(roundUpTo(45.01, 5)).toBe(50)
  })

  it('no sube un múltiplo exacto por error de decimales', () => {
    expect(roundUpTo(0.1 + 0.2, 0.3)).toBeCloseTo(0.3)
  })

  it('no redondea si el paso es 0', () => {
    expect(roundUpTo(42.66, 0)).toBe(42.66)
  })
})

describe('evaluatePrice', () => {
  it('marca pérdida si no repone lo que salió de la bolsa', () => {
    const result = evaluatePrice(cost, 140)
    expect(result.verdict).toBe('loss')
    expect(result.profit).toBeCloseTo(-87.52)
    expect(result.earnings).toBeCloseTo(-17.52)
  })

  it('distingue cuando repone el gasto pero no paga impresora ni trabajo', () => {
    expect(evaluatePrice(cost, 144.32).verdict).toBe('covers-cash-only')
    expect(evaluatePrice(cost, 200).verdict).toBe('covers-cash-only')
  })

  it('es rentable desde el costo real exacto', () => {
    const result = evaluatePrice(cost, 227.52)
    expect(result.verdict).toBe('profitable')
    expect(result.profit).toBeCloseTo(0)
    expect(result.earnings).toBeCloseTo(70) // solo cobra su tiempo
  })

  it('calcula ganancia, margen y precio por pieza', () => {
    const result = evaluatePrice(cost, 360)
    expect(result.unitPrice).toBeCloseTo(45)
    expect(result.profit).toBeCloseTo(132.48)
    expect(result.marginPercent).toBeCloseTo(36.8)
    expect(result.markupPercent).toBeCloseTo(58.228, 2)
    expect(result.earnings).toBeCloseTo(202.48)
  })

  it('trata un precio vacío como cero', () => {
    const result = evaluatePrice(cost, NaN)
    expect(result.totalPrice).toBe(0)
    expect(result.verdict).toBe('loss')
    expect(result.marginPercent).toBe(0)
  })
})

describe('suggestPrices', () => {
  // Sin cobro por hora, para revisar solo la ganancia sobre el costo.
  const markupOnly: Settings = {
    ...settings,
    priceTiers: settings.priceTiers.map((tier) => ({ ...tier, printerHourRate: 0 })),
  }
  const prices = suggestPrices(cost, markupOnly)

  it('da un precio por nivel, redondeado por pieza', () => {
    // Costo real por pieza 28.44 → +10 % = 31.28, +50 % = 42.66, +150 % = 71.10
    expect(prices.map((price) => price.unitPrice)).toEqual([35, 45, 75])
    expect(prices.map((price) => price.totalPrice)).toEqual([280, 360, 600])
    expect(prices.map((price) => price.tier.id)).toEqual(['friend', 'regular', 'premium'])
  })

  it('todos los niveles quedan por encima del costo real', () => {
    for (const price of prices) expect(price.verdict).toBe('profitable')
  })

  it('respeta la configuración sin redondeo', () => {
    const exact = suggestPrices(cost, { ...markupOnly, roundTo: 0 })
    expect(exact[1].unitPrice).toBeCloseTo(42.66)
  })

  it('suma el cobro por hora de impresora según lo que tarda cada pieza', () => {
    // 8 piezas en 8 horas: 1 hora por pieza. Regular: 42.66 + 25 = 67.66 → 70.
    const withRate = suggestPrices(cost, { ...settings, roundTo: 0 })
    expect(withRate.map((price) => price.unitPrice)).toEqual([
      expect.closeTo(31.28 + 10, 2),
      expect.closeTo(42.66 + 25, 2),
      expect.closeTo(71.1 + 42.5, 2),
    ])
    expect(suggestPrices(cost, settings)[1].unitPrice).toBe(70)
  })

  it('trata un cobro por hora vacío como cero', () => {
    const empty = suggestPrices(cost, {
      ...markupOnly,
      priceTiers: markupOnly.priceTiers.map((tier) => ({ ...tier, printerHourRate: NaN })),
    })
    expect(empty.map((price) => price.unitPrice)).toEqual([35, 45, 75])
  })
})

describe('caso real: osito de 6.76 g, 30 min y 3 por cama, filamento a $300', () => {
  const bear = calculateCost(
    {
      gramsPerPlate: 6.76,
      hoursPerPlate: 0.5,
      piecesPerPlate: 3,
      quantity: 3,
      filament: { spoolPrice: 300, spoolGrams: 1000 },
      laborMinutesPerOrder: 0,
      laborMinutesPerPiece: 0,
      extras: [],
    },
    DEFAULT_SETTINGS,
  )

  it('cobra parecido a 3DKoneko por la cama completa (10.48, 19.19 y 30.62)', () => {
    const prices = suggestPrices(bear, DEFAULT_SETTINGS)
    expect(prices.map((price) => price.unitPrice)).toEqual([3, 6, 10])
    expect(prices.map((price) => price.totalPrice)).toEqual([9, 18, 30])
  })
})
