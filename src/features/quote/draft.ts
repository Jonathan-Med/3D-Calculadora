import type {
  CostBreakdown,
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

/** Un filamento de la cama: uno por color. */
export interface DraftMaterial {
  key: string
  filamentId: number | null
  /** Gramos de este filamento en toda la cama. */
  grams: number
  /** Color que marcó el slicer (#RRGGBB); vacío si se capturó a mano. */
  color: string
}

/** Una pieza (un modelo) tal como se captura en Cotizar. */
export interface PieceDraft {
  /** Siempre al menos uno. */
  materials: DraftMaterial[]
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
  /** Lo que ve el cliente de esta pieza. */
  name: string
  colors: string
  measurements: string
}

/** Una pieza ya agregada a la cotización, con el precio y los costos de ese momento. */
export interface QuoteItem {
  key: string
  name: string
  colors: string
  /** Colores del slicer (#RRGGBB) para mostrarlos en la imagen. */
  swatches: string[]
  measurements: string
  quantity: number
  unitPrice: number
  totalPrice: number
  priceLabel: string
  cost: CostBreakdown
  /** La pieza tal como se capturó, para poder volver a editarla. */
  piece: PieceDraft
}

/** Lo que hay en la pantalla Cotizar: la pieza en captura más los datos de toda la cotización. */
export interface QuoteDraft extends PieceDraft {
  /** Lo que ve el cliente en su cotización. */
  title: string
  customer: string
  delivery: string
  /** Piezas ya agregadas; la que está en captura se suma aparte. */
  items: QuoteItem[]
}

/** Dónde se guarda en el navegador lo capturado en Cotizar. */
export const DRAFT_STORAGE_KEY = 'cotizacion-borrador'

export const CUSTOM_PRICE = 'custom'
const DEFAULT_PRICE_CHOICE = 'regular'

export const newRowKey = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const emptyMaterial = (filamentId: number | null = null): DraftMaterial => ({
  key: newRowKey(),
  filamentId,
  grams: 0,
  color: '',
})

export const EMPTY_PIECE: PieceDraft = {
  materials: [{ key: 'material-1', filamentId: null, grams: 0, color: '' }],
  hours: 0,
  minutes: 0,
  piecesPerPlate: 1,
  quantity: 1,
  laborMinutesPerOrder: 0,
  laborMinutesPerPiece: 0,
  extras: [],
  customUnitPrice: 0,
  priceChoice: DEFAULT_PRICE_CHOICE,
  name: '',
  colors: '',
  measurements: '',
}

export const EMPTY_DRAFT: QuoteDraft = {
  ...EMPTY_PIECE,
  title: '',
  customer: '',
  delivery: '',
  items: [],
}

/** Solo la pieza en captura, sin los datos de la cotización. */
export function pieceOf(draft: QuoteDraft): PieceDraft {
  const { title: _title, customer: _customer, delivery: _delivery, items: _items, ...piece } = draft
  return piece
}

/**
 * Una pieza nueva para seguir cotizando: vacía, pero con el mismo filamento y el mismo nivel
 * de precio que la anterior, que suele ser lo que sigue.
 */
export function nextPiece(previous: PieceDraft): PieceDraft {
  return {
    ...EMPTY_PIECE,
    materials: [emptyMaterial(previous.materials[0]?.filamentId ?? null)],
    priceChoice: previous.priceChoice,
  }
}

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback

const textOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function reviveExtra(stored: unknown): DraftExtra | null {
  if (!isRecord(stored)) return null
  return {
    key: typeof stored.key === 'string' ? stored.key : newRowKey(),
    name: typeof stored.name === 'string' ? stored.name : '',
    unitCost: numberOr(stored.unitCost, 0),
    quantity: numberOr(stored.quantity, 1),
    per: stored.per === 'order' ? 'order' : 'piece',
  }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function reviveMaterial(stored: unknown): DraftMaterial | null {
  if (!isRecord(stored)) return null
  return {
    key: typeof stored.key === 'string' ? stored.key : newRowKey(),
    filamentId: typeof stored.filamentId === 'number' ? stored.filamentId : null,
    grams: numberOr(stored.grams, 0),
    color: typeof stored.color === 'string' && HEX_COLOR.test(stored.color) ? stored.color : '',
  }
}

function revivePiece(piece: Record<string, unknown>): PieceDraft {
  const materials = Array.isArray(piece.materials)
    ? piece.materials.map(reviveMaterial).filter((material) => material !== null)
    : []
  return {
    // Las versiones anteriores guardaban un solo filamento en filamentId y gramsPerPlate.
    materials:
      materials.length > 0
        ? materials
        : [
            {
              key: newRowKey(),
              filamentId: typeof piece.filamentId === 'number' ? piece.filamentId : null,
              grams: numberOr(piece.gramsPerPlate, 0),
              color: '',
            },
          ],
    hours: numberOr(piece.hours, 0),
    minutes: numberOr(piece.minutes, 0),
    piecesPerPlate: numberOr(piece.piecesPerPlate, 1),
    quantity: numberOr(piece.quantity, 1),
    laborMinutesPerOrder: numberOr(piece.laborMinutesPerOrder, 0),
    laborMinutesPerPiece: numberOr(piece.laborMinutesPerPiece, 0),
    extras: Array.isArray(piece.extras)
      ? piece.extras.map(reviveExtra).filter((extra) => extra !== null)
      : [],
    customUnitPrice: numberOr(piece.customUnitPrice, 0),
    priceChoice: textOr(piece.priceChoice, DEFAULT_PRICE_CHOICE),
    name: textOr(piece.name, ''),
    colors: textOr(piece.colors, ''),
    measurements: textOr(piece.measurements, ''),
  }
}

function reviveItem(stored: unknown): QuoteItem | null {
  if (!isRecord(stored) || !isRecord(stored.cost) || !isRecord(stored.cost.totals)) return null
  const { quantity, unitPrice, totalPrice } = stored
  if (typeof quantity !== 'number' || typeof unitPrice !== 'number' || typeof totalPrice !== 'number') {
    return null
  }
  return {
    key: typeof stored.key === 'string' ? stored.key : newRowKey(),
    name: textOr(stored.name, ''),
    colors: textOr(stored.colors, ''),
    swatches: Array.isArray(stored.swatches)
      ? stored.swatches.filter((color): color is string => typeof color === 'string' && HEX_COLOR.test(color))
      : [],
    measurements: textOr(stored.measurements, ''),
    quantity,
    unitPrice,
    totalPrice,
    priceLabel: textOr(stored.priceLabel, ''),
    cost: stored.cost as unknown as CostBreakdown,
    piece: revivePiece(isRecord(stored.piece) ? stored.piece : {}),
  }
}

/** Convierte lo guardado en el navegador en un borrador válido, venga como venga. */
export function reviveDraft(stored: unknown): QuoteDraft {
  if (!isRecord(stored)) return EMPTY_DRAFT
  return {
    ...revivePiece(stored),
    title: textOr(stored.title, ''),
    customer: textOr(stored.customer, ''),
    delivery: textOr(stored.delivery, ''),
    items: Array.isArray(stored.items)
      ? stored.items.map(reviveItem).filter((item) => item !== null)
      : [],
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
  draft: PieceDraft,
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
export function pickFilament(filamentId: number | null, filaments: Filament[]): Filament | undefined {
  return filaments.find((filament) => filament.id === filamentId) ?? filaments[0]
}

export function toJobInput(draft: PieceDraft, filaments: Filament[]): JobInput {
  return {
    materials: draft.materials.map((material) => {
      const filament = pickFilament(material.filamentId, filaments)
      return {
        label: filament?.name ?? 'Filamento',
        ...(material.color ? { color: material.color } : {}),
        gramsPerPlate: material.grams,
        filament: filament ?? { spoolPrice: 0, spoolGrams: 0 },
      }
    }),
    hoursPerPlate: draft.hours + draft.minutes / 60,
    piecesPerPlate: draft.piecesPerPlate,
    quantity: draft.quantity,
    laborMinutesPerOrder: draft.laborMinutesPerOrder,
    laborMinutesPerPiece: draft.laborMinutesPerPiece,
    extras: draft.extras,
  }
}
