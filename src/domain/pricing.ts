import type { CostBreakdown, PriceEvaluation, PriceVerdict, Settings, SuggestedPrice } from './types'

/** Tolerancia de un centésimo de centavo para que el redondeo de decimales no cambie el veredicto. */
const EPSILON = 1e-6

export function roundUpTo(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (!Number.isFinite(step) || step <= 0) return value
  return Math.ceil(value / step - EPSILON) * step
}

function verdictFor(cost: CostBreakdown, totalPrice: number): PriceVerdict {
  if (totalPrice < cost.cashCost - EPSILON) return 'loss'
  if (totalPrice < cost.totalCost - EPSILON) return 'covers-cash-only'
  return 'profitable'
}

/** Qué pasa si el pedido completo se cobra a `totalPrice`. */
export function evaluatePrice(cost: CostBreakdown, totalPrice: number): PriceEvaluation {
  const price = Number.isFinite(totalPrice) && totalPrice > 0 ? totalPrice : 0
  const profit = price - cost.totalCost
  return {
    totalPrice: price,
    unitPrice: price / cost.totals.pieces,
    verdict: verdictFor(cost, price),
    profit,
    marginPercent: price > 0 ? (profit / price) * 100 : 0,
    markupPercent: cost.totalCost > 0 ? (profit / cost.totalCost) * 100 : 0,
    earnings: cost.labor + profit,
  }
}

const positive = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0)

/**
 * Un precio sugerido por cada nivel configurado, redondeado por pieza: el costo real más su
 * ganancia, más el cobro por cada hora que la impresora tarda en la pieza.
 */
export function suggestPrices(cost: CostBreakdown, settings: Settings): SuggestedPrice[] {
  const hoursPerPiece = cost.totals.hours / cost.totals.pieces
  return settings.priceTiers.map((tier) => {
    const rawUnitPrice =
      cost.perPiece.totalCost * (1 + positive(tier.markupPercent) / 100) +
      positive(tier.printerHourRate) * hoursPerPiece
    const unitPrice = roundUpTo(rawUnitPrice, settings.roundTo)
    return { tier, ...evaluatePrice(cost, unitPrice * cost.totals.pieces) }
  })
}
