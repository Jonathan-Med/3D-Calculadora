import type { CostBreakdown, SavedQuote } from './types'

/** Lo mínimo de una venta para sacar cuentas. */
export interface Sale {
  soldAt: number
  totalPrice: number
  cost: CostBreakdown
}

/**
 * Cuentas de un grupo de ventas. Siempre se cumple:
 * revenue = spent + printerReserve + sparesReserve + kept
 */
export interface SalesSummary {
  sales: number
  pieces: number
  hours: number
  /** Lo cobrado. */
  revenue: number
  /** Lo que salió de la bolsa: material, luz y extras. */
  spent: number
  /** Lo que hay que apartar para reponer la impresora. */
  printerReserve: number
  /** Lo que hay que apartar para repuestos. */
  sparesReserve: number
  /** Lo que queda para quien imprime: su tiempo más la ganancia. Negativo si vendió bajo costo. */
  kept: number
}

export const salesOf = (quotes: SavedQuote[]): Sale[] =>
  quotes.flatMap((quote) =>
    quote.status === 'sold' && quote.soldAt !== null
      ? [{ soldAt: quote.soldAt, totalPrice: quote.totalPrice, cost: quote.cost }]
      : [],
  )

/** Reparte la reserva de máquina entre impresora y repuestos, en la proporción del costo. */
function splitReserve(cost: CostBreakdown): { printer: number; spares: number } {
  const base = cost.depreciation + cost.maintenance
  if (base <= 0) return { printer: 0, spares: 0 }
  return {
    printer: (cost.machineReserve * cost.depreciation) / base,
    spares: (cost.machineReserve * cost.maintenance) / base,
  }
}

export function summarizeSales(sales: Sale[]): SalesSummary {
  const summary: SalesSummary = {
    sales: 0,
    pieces: 0,
    hours: 0,
    revenue: 0,
    spent: 0,
    printerReserve: 0,
    sparesReserve: 0,
    kept: 0,
  }
  for (const sale of sales) {
    const reserve = splitReserve(sale.cost)
    summary.sales += 1
    summary.pieces += sale.cost.totals.pieces
    summary.hours += sale.cost.totals.hours
    summary.revenue += sale.totalPrice
    summary.spent += sale.cost.cashCost
    summary.printerReserve += reserve.printer
    summary.sparesReserve += reserve.spares
  }
  summary.kept = summary.revenue - summary.spent - summary.printerReserve - summary.sparesReserve
  return summary
}

/** "2026-11", en la hora local de quien usa la app. */
export function monthKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Un resumen por mes con ventas, del más reciente al más antiguo. */
export function summarizeByMonth(sales: Sale[]): { month: string; summary: SalesSummary }[] {
  const byMonth = new Map<string, Sale[]>()
  for (const sale of sales) {
    const key = monthKey(sale.soldAt)
    byMonth.set(key, [...(byMonth.get(key) ?? []), sale])
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, monthSales]) => ({ month, summary: summarizeSales(monthSales) }))
}

export interface PrinterPayback {
  /** Lo cobrado menos lo gastado en material, luz y extras. */
  recovered: number
  /** De 0 a 100. */
  percent: number
  remaining: number
  paidOff: boolean
}

/** Cuánto de lo que costó la impresora ya regresó con las ventas. */
export function printerPayback(summary: SalesSummary, purchasePrice: number): PrinterPayback {
  const price = Number.isFinite(purchasePrice) && purchasePrice > 0 ? purchasePrice : 0
  const recovered = Math.max(0, summary.revenue - summary.spent)
  return {
    recovered,
    percent: price > 0 ? Math.min(100, (recovered / price) * 100) : 0,
    remaining: Math.max(0, price - recovered),
    paidOff: price > 0 && recovered >= price,
  }
}
