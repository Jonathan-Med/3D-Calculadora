import { sumCosts } from '../../domain/cost'
import type { CostBreakdown, SavedQuote, SavedQuoteItem } from '../../domain/types'
import { newRowKey, pieceOf, type ChosenPrice, type QuoteDraft, type QuoteItem } from './draft'

/** Un renglón de la cotización: una pieza ya agregada o la que está en captura. */
export interface OrderLine {
  key: string
  name: string
  colors: string
  swatches: string[]
  measurements: string
  quantity: number
  unitPrice: number
  totalPrice: number
  priceLabel: string
  cost: CostBreakdown
  /** true en la pieza que todavía se está capturando. */
  current: boolean
}

const swatchesOf = (draft: Pick<QuoteDraft, 'materials'>): string[] => [
  ...new Set(draft.materials.map((material) => material.color).filter(Boolean)),
]

/** La pieza en captura como renglón; null mientras no tenga costo o precio. */
export function currentLine(
  draft: QuoteDraft,
  cost: CostBreakdown,
  chosen: ChosenPrice | null,
): OrderLine | null {
  if (!chosen || cost.totalCost <= 0) return null
  return {
    key: 'current',
    name: draft.name.trim(),
    colors: draft.colors.trim(),
    swatches: swatchesOf(draft),
    measurements: draft.measurements.trim(),
    quantity: cost.totals.pieces,
    unitPrice: chosen.price.unitPrice,
    totalPrice: chosen.price.totalPrice,
    priceLabel: chosen.label,
    cost,
    current: true,
  }
}

/** Convierte la pieza en captura en una pieza agregada a la cotización. */
export function toItem(draft: QuoteDraft, line: OrderLine): QuoteItem {
  const { current: _current, key: _key, ...rest } = line
  return { ...rest, key: newRowKey(), piece: pieceOf(draft) }
}

/** Todas las piezas de la cotización: las agregadas y, al final, la que está en captura. */
export function orderLines(draft: QuoteDraft, current: OrderLine | null): OrderLine[] {
  const added = draft.items.map((item): OrderLine => {
    const { piece: _piece, ...rest } = item
    return { ...rest, current: false }
  })
  return current ? [...added, current] : added
}

/** Cómo se llama un renglón: su nombre, o el título si es la única pieza, o "Pieza 2". */
export function lineName(line: OrderLine, index: number, count: number, title: string): string {
  if (line.name) return line.name
  if (count === 1) return title.trim() || 'Impresión 3D'
  return `Pieza ${index + 1}`
}

export function orderTotals(lines: OrderLine[]): { pieces: number; totalPrice: number } {
  return {
    pieces: lines.reduce((sum, line) => sum + line.quantity, 0),
    totalPrice: lines.reduce((sum, line) => sum + line.totalPrice, 0),
  }
}

/** El pedido completo como se guarda en el historial: una sola venta con todas sus piezas. */
export function toSavedQuote(
  draft: QuoteDraft,
  lines: OrderLine[],
  status: SavedQuote['status'],
): Omit<SavedQuote, 'id' | 'createdAt' | 'soldAt'> {
  const { pieces, totalPrice } = orderTotals(lines)
  const labels = [...new Set(lines.map((line) => line.priceLabel))]
  const items: SavedQuoteItem[] = lines.map((line, index) => ({
    name: lineName(line, index, lines.length, draft.title),
    colors: line.colors,
    measurements: line.measurements,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    totalPrice: line.totalPrice,
  }))
  return {
    status,
    title: draft.title.trim() || (lines.length === 1 ? items[0].name : 'Impresión 3D'),
    customer: draft.customer.trim(),
    pieces,
    unitPrice: lines.length === 1 ? lines[0].unitPrice : pieces > 0 ? totalPrice / pieces : 0,
    totalPrice,
    priceLabel: labels.length === 1 ? labels[0] : 'Varios precios',
    cost: sumCosts(lines.map((line) => line.cost)),
    items,
    draft,
  }
}
