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

/** Un filamento de la cama: uno por color. */
export interface DraftMaterial {
  key: string
  filamentId: number | null
  /** Gramos de este filamento en toda la cama. */
  grams: number
  /** Color que marcó el slicer (#RRGGBB); vacío si se capturó a mano. */
  color: string
}

/** Lo que hay capturado en la pantalla Cotizar. */
export interface QuoteDraft {
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
  /** Lo que ve el cliente en su cotización. */
  title: string
  customer: string
  delivery: string
}

/** Dónde se guarda en el navegador lo capturado en Cotizar. */
export const DRAFT_STORAGE_KEY = 'cotizacion-borrador'

export const CUSTOM_PRICE = 'custom'
const DEFAULT_PRICE_CHOICE = 'regular'

export const emptyMaterial = (filamentId: number | null = null): DraftMaterial => ({
  key: newRowKey(),
  filamentId,
  grams: 0,
  color: '',
})

export const EMPTY_DRAFT: QuoteDraft = {
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
  title: '',
  customer: '',
  delivery: '',
}

export const newRowKey = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback

const textOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

function reviveExtra(stored: unknown): DraftExtra | null {
  if (typeof stored !== 'object' || stored === null) return null
  const extra = stored as Record<string, unknown>
  return {
    key: typeof extra.key === 'string' ? extra.key : newRowKey(),
    name: typeof extra.name === 'string' ? extra.name : '',
    unitCost: numberOr(extra.unitCost, 0),
    quantity: numberOr(extra.quantity, 1),
    per: extra.per === 'order' ? 'order' : 'piece',
  }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function reviveMaterial(stored: unknown): DraftMaterial | null {
  if (typeof stored !== 'object' || stored === null) return null
  const material = stored as Record<string, unknown>
  return {
    key: typeof material.key === 'string' ? material.key : newRowKey(),
    filamentId: typeof material.filamentId === 'number' ? material.filamentId : null,
    grams: numberOr(material.grams, 0),
    color: typeof material.color === 'string' && HEX_COLOR.test(material.color) ? material.color : '',
  }
}

/** Convierte lo guardado en el navegador en un borrador válido, venga como venga. */
export function reviveDraft(stored: unknown): QuoteDraft {
  if (typeof stored !== 'object' || stored === null) return EMPTY_DRAFT
  const draft = stored as Record<string, unknown>
  const materials = Array.isArray(draft.materials)
    ? draft.materials.map(reviveMaterial).filter((material) => material !== null)
    : []
  return {
    // Las versiones anteriores guardaban un solo filamento en filamentId y gramsPerPlate.
    materials:
      materials.length > 0
        ? materials
        : [
            {
              key: newRowKey(),
              filamentId: typeof draft.filamentId === 'number' ? draft.filamentId : null,
              grams: numberOr(draft.gramsPerPlate, 0),
              color: '',
            },
          ],
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
export function pickFilament(filamentId: number | null, filaments: Filament[]): Filament | undefined {
  return filaments.find((filament) => filament.id === filamentId) ?? filaments[0]
}

export function toJobInput(draft: QuoteDraft, filaments: Filament[]): JobInput {
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
