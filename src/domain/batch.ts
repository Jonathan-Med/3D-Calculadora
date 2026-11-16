import { calculateCost } from './cost'
import type { JobInput, Settings } from './types'

export interface QuantityScenario {
  quantity: number
  plates: number
  hours: number
  unitCost: number
  totalCost: number
  /** true en la cantidad que pidió el cliente. */
  current: boolean
}

const DEFAULT_QUANTITIES = [1, 5, 10, 25, 50, 100]

/** El mismo pedido con distintas cantidades, para ver cómo baja el costo por pieza. */
export function quantityScenarios(
  job: JobInput,
  settings: Settings,
  quantities: number[] = DEFAULT_QUANTITIES,
): QuantityScenario[] {
  const current = calculateCost(job, settings).totals.pieces
  const all = [...new Set([...quantities, current])].sort((a, b) => a - b)
  return all.map((quantity) => {
    const cost = calculateCost({ ...job, quantity }, settings)
    return {
      quantity,
      plates: cost.totals.plates,
      hours: cost.totals.hours,
      unitCost: cost.perPiece.totalCost,
      totalCost: cost.totalCost,
      current: quantity === current,
    }
  })
}
