import type { CostBreakdown, Filament, JobInput, MaterialLine, Settings } from './types'

/** Un campo vacío o inválido de un formulario cuenta como 0 en vez de romper el cálculo. */
const positive = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0)

const divide = (a: number, b: number): number => (positive(b) === 0 ? 0 : positive(a) / positive(b))

const atLeastOne = (value: number): number => Math.max(1, Math.floor(positive(value)))

export interface MachineHourlyRates {
  electricity: number
  depreciation: number
  maintenance: number
  total: number
}

/** Cuánto cuesta cada hora de impresión, sin contar material. */
export function machineHourlyRates(settings: Settings): MachineHourlyRates {
  const electricity =
    (positive(settings.printer.avgPowerWatts) / 1000) * positive(settings.electricityPricePerKwh)
  const depreciation = divide(settings.printer.purchasePrice, settings.printer.lifespanHours)
  const maintenance = settings.spareParts.reduce(
    (sum, part) => sum + divide(part.price, part.lifespanHours),
    0,
  )
  return { electricity, depreciation, maintenance, total: electricity + depreciation + maintenance }
}

export function calculateCost(job: JobInput, settings: Settings): CostBreakdown {
  const pieces = atLeastOne(job.quantity)
  const piecesPerPlate = atLeastOne(job.piecesPerPlate)

  // Una cama incompleta gasta en proporción a las piezas que lleva.
  const hours = divide(job.hoursPerPlate, piecesPerPlate) * pieces
  const waste = 1 + positive(settings.wastePercent) / 100
  const materialLines: MaterialLine[] = job.materials.map((item) => {
    const grams = divide(item.gramsPerPlate, piecesPerPlate) * pieces * waste
    return {
      label: item.label,
      ...(item.color ? { color: item.color } : {}),
      grams,
      cost: grams * divide(item.filament.spoolPrice, item.filament.spoolGrams),
    }
  })
  const grams = materialLines.reduce((sum, line) => sum + line.grams, 0)

  const rates = machineHourlyRates(settings)
  const failureRate = positive(settings.failurePercent) / 100

  const material = materialLines.reduce((sum, line) => sum + line.cost, 0)
  const electricity = hours * rates.electricity
  const depreciation = hours * rates.depreciation
  const maintenance = hours * rates.maintenance
  const failures = failureRate * (material + electricity + depreciation + maintenance)

  const extras = job.extras.reduce(
    (sum, extra) =>
      sum + positive(extra.unitCost) * positive(extra.quantity) * (extra.per === 'piece' ? pieces : 1),
    0,
  )

  const laborMinutes = positive(job.laborMinutesPerOrder) + positive(job.laborMinutesPerPiece) * pieces
  const labor = (laborMinutes / 60) * positive(settings.laborRatePerHour)

  const cashCost = (material + electricity) * (1 + failureRate) + extras
  const machineReserve = (depreciation + maintenance) * (1 + failureRate)
  const totalCost = cashCost + machineReserve + labor

  return {
    material,
    materialLines,
    electricity,
    depreciation,
    maintenance,
    failures,
    extras,
    labor,
    cashCost,
    machineReserve,
    totalCost,
    perPiece: {
      cashCost: cashCost / pieces,
      totalCost: totalCost / pieces,
    },
    totals: {
      grams,
      hours,
      plates: Math.ceil(pieces / piecesPerPlate),
      pieces,
    },
  }
}

/** Cuántas piezas completas salen de un rollo, contando la merma. */
export function piecesPerSpool(
  gramsPerPiece: number,
  filament: Pick<Filament, 'spoolGrams'>,
  wastePercent: number,
): number {
  const gramsWithWaste = positive(gramsPerPiece) * (1 + positive(wastePercent) / 100)
  return Math.floor(divide(filament.spoolGrams, gramsWithWaste))
}

/**
 * Junta los costos de varias piezas de un mismo pedido en uno solo, para guardarlo en el
 * historial y sumarlo a las ganancias como cualquier otra venta.
 */
export function sumCosts(costs: CostBreakdown[]): CostBreakdown {
  const add = (pick: (cost: CostBreakdown) => number) =>
    costs.reduce((sum, cost) => sum + pick(cost), 0)
  const pieces = add((cost) => cost.totals.pieces)
  const cashCost = add((cost) => cost.cashCost)
  const totalCost = add((cost) => cost.totalCost)
  return {
    material: add((cost) => cost.material),
    materialLines: costs.flatMap((cost) => cost.materialLines ?? []),
    electricity: add((cost) => cost.electricity),
    depreciation: add((cost) => cost.depreciation),
    maintenance: add((cost) => cost.maintenance),
    failures: add((cost) => cost.failures),
    extras: add((cost) => cost.extras),
    labor: add((cost) => cost.labor),
    cashCost,
    machineReserve: add((cost) => cost.machineReserve),
    totalCost,
    perPiece: {
      cashCost: pieces > 0 ? cashCost / pieces : 0,
      totalCost: pieces > 0 ? totalCost / pieces : 0,
    },
    totals: {
      grams: add((cost) => cost.totals.grams),
      hours: add((cost) => cost.totals.hours),
      plates: add((cost) => cost.totals.plates),
      pieces,
    },
  }
}
