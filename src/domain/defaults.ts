import type { BusinessProfile, EstimableField, ExtraItem, Filament, Settings } from './types'

/**
 * Valores de arranque para una Bambu Lab A1 mini recién comprada.
 * Todos son estimaciones: `estimated` los lista para que la app los marque
 * hasta que se capture el dato real.
 */
export const DEFAULT_BUSINESS: BusinessProfile = {
  name: '',
  contact: '',
  note: 'Cotización válida por 7 días.',
  logo: null,
}

export const DEFAULT_SETTINGS: Settings = {
  business: DEFAULT_BUSINESS,
  printer: {
    name: 'Bambu Lab A1 mini',
    purchasePrice: 5800,
    lifespanHours: 5000,
    avgPowerWatts: 80,
  },
  spareParts: [
    { id: 'hotend', name: 'Hotend con boquilla 0.4', price: 300, lifespanHours: 1000 },
    { id: 'plate', name: 'Placa PEI', price: 450, lifespanHours: 1500 },
    { id: 'upkeep', name: 'Lubricante, limpieza y bandas', price: 200, lifespanHours: 2000 },
  ],
  electricityPricePerKwh: 4,
  laborRatePerHour: 60,
  wastePercent: 5,
  failurePercent: 5,
  priceTiers: [
    {
      id: 'friend',
      name: 'Precio Amigo',
      description: 'Casi regalado, pero con dignidad.',
      markupPercent: 10,
    },
    {
      id: 'regular',
      name: 'Precio Regular',
      description: 'Precio base, sin regateo ni drama.',
      markupPercent: 50,
    },
    {
      id: 'premium',
      name: 'Precio NLQHPSLPLI',
      description: 'No lo quiero hacer, pero si lo pagan lo imprimo.',
      markupPercent: 150,
    },
  ],
  // Con piezas de $10 a $20, redondear a múltiplos de $5 infla demasiado el precio.
  roundTo: 1,
  estimated: [
    'printer.purchasePrice',
    'printer.lifespanHours',
    'printer.avgPowerWatts',
    'spareParts',
    'electricityPricePerKwh',
    'laborRatePerHour',
    'wastePercent',
    'failurePercent',
  ],
}

export const DEFAULT_FILAMENTS: Filament[] = [
  { id: 1, name: 'PLA 1 kg', spoolPrice: 350, spoolGrams: 1000 },
]

/** Ejemplos con precios aproximados; se editan en Configuración. */
export const DEFAULT_EXTRAS: ExtraItem[] = [
  { id: 1, name: 'Argolla de llavero', unitCost: 2, per: 'piece' },
  { id: 2, name: 'Imán', unitCost: 4, per: 'piece' },
  { id: 3, name: 'Bolsa de empaque', unitCost: 2, per: 'piece' },
  { id: 4, name: 'Caja para envío', unitCost: 15, per: 'order' },
]

/** De dónde sale cada estimación y cómo conseguir el dato real. Se muestra en Configuración. */
export const ESTIMATE_NOTES: Record<EstimableField, string> = {
  'printer.purchasePrice':
    'Precio aproximado en tiendas de México. Pon lo que pagaste, con envío.',
  'printer.lifespanHours':
    'Nadie lo sabe con una impresora nueva. 5,000 horas es un supuesto prudente; súbelo si con el tiempo ves que aguanta más.',
  'printer.avgPowerWatts':
    'Bambu Lab publica entre 57 y 80 W en promedio imprimiendo PLA. Para el dato exacto, usa un enchufe medidor de consumo durante una impresión.',
  spareParts:
    'Precios y duraciones aproximados. Corrígelos la primera vez que compres cada repuesto y anota cuántas horas duró el anterior.',
  electricityPricePerKwh:
    'Precio del kWh excedente de la tarifa doméstica 1 de CFE a mediados de 2026. Revisa en tu recibo el precio del último escalón que pagas.',
  laborRatePerHour: 'No es un dato, es tu decisión: cuánto quieres ganar por hora de trabajo.',
  wastePercent:
    'Purga inicial y restos de rollo. Súbelo si imprimes en varios colores, porque cada cambio de color tira filamento.',
  failurePercent:
    'Supuesto de 1 impresión fallida de cada 20. Ajústalo con lo que veas en tus primeros meses.',
}
