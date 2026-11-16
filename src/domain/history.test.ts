import { describe, expect, it } from 'vitest'
import { calculateCost } from './cost'
import { DEFAULT_SETTINGS } from './defaults'
import {
  monthKey,
  printerPayback,
  salesOf,
  summarizeByMonth,
  summarizeSales,
  type Sale,
} from './history'
import type { JobInput, SavedQuote, Settings } from './types'

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

// De cost.test.ts: cashCost 144.32, machineReserve 13.20 (desgaste 9.60, repuestos 2.40), 8 piezas, 8 h.
const cost = calculateCost(job, settings)
const november = new Date(2026, 10, 5, 12).getTime()
const lateNovember = new Date(2026, 10, 28, 12).getTime()
const october = new Date(2026, 9, 20, 12).getTime()

const sale = (soldAt: number, totalPrice: number): Sale => ({ soldAt, totalPrice, cost })

describe('summarizeSales', () => {
  it('desglosa una venta en gastado, apartado y lo que queda', () => {
    const summary = summarizeSales([sale(november, 360)])
    expect(summary.sales).toBe(1)
    expect(summary.pieces).toBe(8)
    expect(summary.hours).toBeCloseTo(8)
    expect(summary.revenue).toBeCloseTo(360)
    expect(summary.spent).toBeCloseTo(144.32)
    expect(summary.printerReserve).toBeCloseTo(10.56) // 13.20 × 9.60 / 12
    expect(summary.sparesReserve).toBeCloseTo(2.64) // 13.20 × 2.40 / 12
    expect(summary.kept).toBeCloseTo(202.48) // trabajo 70 + ganancia 132.48
  })

  it('lo cobrado siempre se reparte completo', () => {
    const summary = summarizeSales([sale(november, 360), sale(october, 150)])
    expect(summary.spent + summary.printerReserve + summary.sparesReserve + summary.kept).toBeCloseTo(
      summary.revenue,
    )
  })

  it('lo que queda sale negativo si se vendió bajo costo', () => {
    expect(summarizeSales([sale(november, 100)]).kept).toBeCloseTo(-57.52)
  })

  it('sin ventas todo es cero', () => {
    const summary = summarizeSales([])
    expect(summary.sales).toBe(0)
    expect(summary.revenue).toBe(0)
    expect(summary.kept).toBe(0)
  })
})

describe('summarizeByMonth', () => {
  it('agrupa por mes, del más reciente al más antiguo', () => {
    const months = summarizeByMonth([sale(october, 150), sale(november, 360), sale(lateNovember, 300)])
    expect(months.map((entry) => entry.month)).toEqual(['2026-11', '2026-10'])
    expect(months[0].summary.sales).toBe(2)
    expect(months[0].summary.revenue).toBeCloseTo(660)
    expect(months[1].summary.revenue).toBeCloseTo(150)
  })

  it('usa el mes local de la fecha', () => {
    expect(monthKey(new Date(2026, 0, 1, 0, 30).getTime())).toBe('2026-01')
    expect(monthKey(new Date(2026, 11, 31, 23, 30).getTime())).toBe('2026-12')
  })
})

describe('printerPayback', () => {
  it('cuenta lo cobrado menos lo gastado contra el precio de la impresora', () => {
    const payback = printerPayback(summarizeSales([sale(november, 360)]), 6000)
    expect(payback.recovered).toBeCloseTo(215.68)
    expect(payback.percent).toBeCloseTo(3.5947, 3)
    expect(payback.remaining).toBeCloseTo(5784.32)
    expect(payback.paidOff).toBe(false)
  })

  it('se detiene en 100 % cuando ya se pagó', () => {
    const payback = printerPayback(summarizeSales([sale(november, 9000)]), 6000)
    expect(payback.percent).toBe(100)
    expect(payback.remaining).toBe(0)
    expect(payback.paidOff).toBe(true)
  })

  it('no baja de cero si las ventas no reponen ni lo gastado', () => {
    const payback = printerPayback(summarizeSales([sale(november, 50)]), 6000)
    expect(payback.recovered).toBe(0)
    expect(payback.percent).toBe(0)
  })

  it('sin precio de impresora no hay avance que mostrar', () => {
    const payback = printerPayback(summarizeSales([sale(november, 360)]), 0)
    expect(payback.percent).toBe(0)
    expect(payback.paidOff).toBe(false)
  })
})

describe('salesOf', () => {
  const quote = (overrides: Partial<SavedQuote>): SavedQuote => ({
    id: 1,
    createdAt: october,
    status: 'quoted',
    soldAt: null,
    title: 'Llaveros',
    customer: '',
    pieces: 8,
    unitPrice: 45,
    totalPrice: 360,
    priceLabel: 'Precio Regular',
    cost,
    draft: null,
    ...overrides,
  })

  it('solo cuenta los pedidos vendidos', () => {
    const sales = salesOf([
      quote({ id: 1 }),
      quote({ id: 2, status: 'sold', soldAt: november }),
      quote({ id: 3, status: 'sold', soldAt: null }),
    ])
    expect(sales).toHaveLength(1)
    expect(sales[0].soldAt).toBe(november)
    expect(sales[0].totalPrice).toBe(360)
  })
})
