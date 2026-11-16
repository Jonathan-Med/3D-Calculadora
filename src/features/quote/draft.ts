import type {
  Filament,
  JobExtra,
  JobInput,
  PriceEvaluation,
  SuggestedPrice,
} from '../../domain/types'

export interface DraftExtra extends JobExtra {
  /** Identificador de la fila en el formulario. */
  key: string
}

/** Lo que hay capturado en la pantalla Cotizar. */
export interface QuoteDraft {
  filamentId: number | null
  gramsPerPlate: number
  hours: number
  minutes: number
  piecesPerPlate: number
  quantity: number
  laborMinutesPerOrder: number
  laborMinutesPerPiece: number
  extras: DraftExtra[]
  /** Precio por pieza que quiere probar; 0 = sin capturar. */
  customUnitPrice: number
  /** Precio que va en la cotización del cliente: el id de un nivel o CUSTOM_PRICE. */
  priceChoice: string
  /** Lo que ve el cliente en su cotización. */
  title: string
  customer: string
  delivery: string
}

export const CUSTOM_PRICE = 'custom'
const DEFAULT_PRICE_CHOICE = 'regular'

export const EMPTY_DRAFT: QuoteDraft = {
  filamentId: null,
  gramsPerPlate: 0,
  hours: 0,
  minutes: 0,
  piecesPerPlate: 1,
  quantity: 1,
  laborMinutesPerOrder: 0,
  laborMinutesPerPiece: 0,
  extras: [],
  customUnitPrice: 0,
  priceChoice: DEFAULT_PRICE_CHOICE,
  title: '',
  customer: '',
  delivery: '',
}

export const newExtraKey = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback

const textOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

function reviveExtra(stored: unknown): DraftExtra | null {
  if (typeof stored !== 'object' || stored === null) return null
  const extra = stored as Record<string, unknown>
  return {
    key: typeof extra.key === 'string' ? extra.key : newExtraKey(),
    name: typeof extra.name === 'string' ? extra.name : '',
    unitCost: numberOr(extra.unitCost, 0),
    quantity: numberOr(extra.quantity, 1),
    per: extra.per === 'order' ? 'order' : 'piece',
  }
}

/** Convierte lo guardado en el navegador en un borrador válido, venga como venga. */
export function reviveDraft(stored: unknown): QuoteDraft {
  if (typeof stored !== 'object' || stored === null) return EMPTY_DRAFT
  const draft = stored as Record<string, unknown>
  return {
    filamentId: typeof draft.filamentId === 'number' ? draft.filamentId : null,
    gramsPerPlate: numberOr(draft.gramsPerPlate, 0),
    hours: numberOr(draft.hours, 0),
    minutes: numberOr(draft.minutes, 0),
    piecesPerPlate: numberOr(draft.piecesPerPlate, 1),
    quantity: numberOr(draft.quantity, 1),
    laborMinutesPerOrder: numberOr(draft.laborMinutesPerOrder, 0),
    laborMinutesPerPiece: numberOr(draft.laborMinutesPerPiece, 0),
    extras: Array.isArray(draft.extras)
      ? draft.extras.map(reviveExtra).filter((extra) => extra !== null)
      : [],
    customUnitPrice: numberOr(draft.customUnitPrice, 0),
    priceChoice: textOr(draft.priceChoice, DEFAULT_PRICE_CHOICE),
    title: textOr(draft.title, ''),
    customer: textOr(draft.customer, ''),
    delivery: textOr(draft.delivery, ''),
  }
}

export interface ChosenPrice {
  id: string
  label: string
  price: PriceEvaluation
}

/**
 * El precio que va en la cotización del cliente. Si el elegido ya no existe
 * (se borró el precio propio o cambió un nivel), cae en el nivel regular.
 */
export function choosePrice(
  draft: QuoteDraft,
  prices: SuggestedPrice[],
  customPrice: PriceEvaluation | null,
): ChosenPrice | null {
  if (draft.priceChoice === CUSTOM_PRICE && customPrice) {
    return { id: CUSTOM_PRICE, label: 'Tu precio', price: customPrice }
  }
  const tier =
    prices.find((price) => price.tier.id === draft.priceChoice) ??
    prices.find((price) => price.tier.id === DEFAULT_PRICE_CHOICE) ??
    prices[0]
  return tier ? { id: tier.tier.id, label: tier.tier.name, price: tier } : null
}

/** El filamento elegido o, si ya no existe, el primero de la lista. */
export function pickFilament(draft: QuoteDraft, filaments: Filament[]): Filament | undefined {
  return filaments.find((filament) => filament.id === draft.filamentId) ?? filaments[0]
}

export function toJobInput(draft: QuoteDraft, filaments: Filament[]): JobInput {
  const filament = pickFilament(draft, filaments)
  return {
    gramsPerPlate: draft.gramsPerPlate,
    hoursPerPlate: draft.hours + draft.minutes / 60,
    piecesPerPlate: draft.piecesPerPlate,
    quantity: draft.quantity,
    filament: filament ?? { spoolPrice: 0, spoolGrams: 0 },
    laborMinutesPerOrder: draft.laborMinutesPerOrder,
    laborMinutesPerPiece: draft.laborMinutesPerPiece,
    extras: draft.extras,
  }
}
