/** Todas las cantidades de dinero están en pesos (MXN). */

export interface PrinterProfile {
  name: string
  /** Lo que costó la impresora. */
  purchasePrice: number
  /** Horas de impresión que se espera que dure antes de reemplazarla. */
  lifespanHours: number
  /** Consumo promedio mientras imprime, en watts. */
  avgPowerWatts: number
}

export interface SparePart {
  id: string
  name: string
  price: number
  /** Horas de impresión que dura antes de cambiarlo. */
  lifespanHours: number
}

export interface Filament {
  id: number
  name: string
  spoolPrice: number
  spoolGrams: number
}

/** Un extra del catálogo, listo para agregarse a una cotización. */
export interface ExtraItem {
  id: number
  name: string
  unitCost: number
  per: 'piece' | 'order'
}

export interface PriceTier {
  id: string
  name: string
  description: string
  /** Ganancia sobre el costo real, en %. 50 = costo real × 1.5. */
  markupPercent: number
  /** Lo que se cobra, además, por cada hora que la impresora trabaja en la pieza. */
  printerHourRate: number
}

/** Valores de configuración que todavía son una estimación y no un dato real. */
export type EstimableField =
  | 'printer.purchasePrice'
  | 'printer.lifespanHours'
  | 'printer.avgPowerWatts'
  | 'spareParts'
  | 'electricityPricePerKwh'
  | 'laborRatePerHour'
  | 'wastePercent'
  | 'failurePercent'

/** Lo que aparece en la cotización que se le manda al cliente. */
export interface BusinessProfile {
  name: string
  /** Teléfono, Instagram o lo que quiera mostrar. */
  contact: string
  /** Texto al pie: vigencia, anticipo, etc. */
  note: string
  /** Imagen como data URL, ya reducida. */
  logo: string | null
}

export interface Settings {
  business: BusinessProfile
  printer: PrinterProfile
  spareParts: SparePart[]
  electricityPricePerKwh: number
  /** Cuánto vale una hora de trabajo de quien imprime. */
  laborRatePerHour: number
  /** Filamento extra que se gasta además del de la pieza (purga, restos de rollo), en %. */
  wastePercent: number
  /** Parte de las impresiones que fallan y hay que repetir, en %. */
  failurePercent: number
  priceTiers: PriceTier[]
  /** El precio sugerido por pieza se redondea hacia arriba a este múltiplo. 0 = sin redondeo. */
  roundTo: number
  /** Campos que siguen con el valor estimado de fábrica. Se quitan al capturar el dato real. */
  estimated: EstimableField[]
}

export interface JobExtra {
  name: string
  unitCost: number
  quantity: number
  /** 'piece': se multiplica por las piezas pedidas. 'order': se cobra una vez por pedido. */
  per: 'piece' | 'order'
}

export interface JobInput {
  /** Gramos y horas de una cama completa, tal como los da el slicer. */
  gramsPerPlate: number
  hoursPerPlate: number
  /** Piezas que salen de esa cama. */
  piecesPerPlate: number
  /** Piezas que pidió el cliente. */
  quantity: number
  filament: Pick<Filament, 'spoolPrice' | 'spoolGrams'>
  /** Trabajo que se hace una vez por pedido: diseñar, preparar el archivo, atender al cliente. */
  laborMinutesPerOrder: number
  /** Trabajo que se repite en cada pieza: quitar soportes, lijar, armar, empacar. */
  laborMinutesPerPiece: number
  extras: JobExtra[]
}

/** Costos del pedido completo, salvo `perPiece`. */
export interface CostBreakdown {
  material: number
  electricity: number
  /** Desgaste de la impresora: la parte de su precio que consume este pedido. */
  depreciation: number
  /** Lo que hay que apartar para repuestos. */
  maintenance: number
  /** Costo repartido de las impresiones que fallan. */
  failures: number
  extras: number
  labor: number

  /** Lo que sale de la bolsa: material, luz, extras y su parte de fallos. */
  cashCost: number
  /** Lo que hay que apartar para la impresora y sus repuestos. */
  machineReserve: number
  /** Costo real: cashCost + machineReserve + labor. Debajo de esto no es rentable. */
  totalCost: number

  perPiece: {
    cashCost: number
    totalCost: number
  }
  totals: {
    /** Gramos de filamento, merma incluida. */
    grams: number
    hours: number
    /** Camas necesarias para completar el pedido. */
    plates: number
    pieces: number
  }
}

/** Un pedido guardado en el historial, con los costos del momento en que se guardó. */
export interface SavedQuote {
  id: number
  createdAt: number
  status: 'quoted' | 'sold'
  /** Cuándo se marcó como vendido; null mientras solo está cotizado. */
  soldAt: number | null
  title: string
  customer: string
  pieces: number
  unitPrice: number
  totalPrice: number
  /** Nombre del nivel de precio usado, o "Tu precio". */
  priceLabel: string
  cost: CostBreakdown
  /** Lo capturado en Cotizar, para poder reabrirlo. Se valida al leerlo. */
  draft: unknown
}

export type PriceVerdict =
  /** No alcanza ni para reponer material, luz y extras. */
  | 'loss'
  /** Repone lo gastado, pero no paga la impresora ni el tiempo de trabajo. */
  | 'covers-cash-only'
  /** Cubre el costo real. */
  | 'profitable'

export interface PriceEvaluation {
  totalPrice: number
  unitPrice: number
  verdict: PriceVerdict
  /** Precio menos costo real. */
  profit: number
  /** Ganancia como % del precio. */
  marginPercent: number
  /** Ganancia como % del costo real. */
  markupPercent: number
  /** Lo que le queda a quien imprime: su tiempo de trabajo más la ganancia. */
  earnings: number
}

export interface SuggestedPrice extends PriceEvaluation {
  tier: PriceTier
}
