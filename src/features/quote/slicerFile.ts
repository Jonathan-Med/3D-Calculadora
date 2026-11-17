import { unzip, type Unzipped } from 'fflate'
import type { QuoteDraft } from './draft'

/** Lo que se pudo leer de una cama laminada. Lo que el archivo no trae queda en null. */
export interface SlicedPlate {
  /** Número de cama en el slicer (1, 2…). */
  plate: number
  seconds: number | null
  grams: number | null
  /** Objetos en la cama, que normalmente son las piezas. */
  pieces: number | null
  /** Tipos de filamento usados, por ejemplo "PLA". */
  materials: string[]
}

export type SlicerReadResult = { ok: true; plates: SlicedPlate[] } | { ok: false; error: string }

const NOT_A_SLICER_FILE = 'Ese archivo no es de un slicer. Sube el .gcode.3mf o el .gcode.'
const NOT_SLICED =
  'Este proyecto no trae la impresión laminada. En Bambu Studio lamina la cama y, en el menú ' +
  'Archivo › Exportar, exporta la cama laminada (archivo .gcode.3mf).'
const NOTHING_FOUND = 'El archivo no dice cuánto tarda ni cuánto filamento usa.'

const positive = (value: number): number | null => (Number.isFinite(value) && value > 0 ? value : null)

const attributes = (tag: string): Record<string, string> => {
  const found: Record<string, string> = {}
  for (const [, key, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) found[key] = value
  return found
}

/**
 * Lee `Metadata/slice_info.config` de un .gcode.3mf de Bambu Studio u OrcaSlicer: trae, por
 * cama, el tiempo estimado en segundos, los gramos y los objetos.
 */
export function parseSliceInfo(xml: string): SlicedPlate[] {
  const plates: SlicedPlate[] = []
  for (const [, body] of xml.matchAll(/<plate>([\s\S]*?)<\/plate>/g)) {
    const meta: Record<string, string> = {}
    for (const [tag] of body.matchAll(/<metadata\b[^>]*>/g)) {
      const { key, value } = attributes(tag)
      if (key) meta[key] = value ?? ''
    }
    const objects = [...body.matchAll(/<object\b[^>]*>/g)].filter(
      ([tag]) => attributes(tag).skipped !== 'true',
    )
    const filaments = [...body.matchAll(/<filament\b[^>]*>/g)].map(([tag]) => attributes(tag))
    const filamentGrams = filaments.reduce((sum, filament) => sum + (Number(filament.used_g) || 0), 0)

    plates.push({
      plate: Number(meta.index) || plates.length + 1,
      seconds: positive(Number(meta.prediction)),
      grams: positive(Number(meta.weight)) ?? positive(filamentGrams),
      pieces: objects.length > 0 ? objects.length : null,
      materials: [...new Set(filaments.map((filament) => filament.type).filter(Boolean))],
    })
  }
  return plates
}

/** "1d 2h 3m 4s" → segundos. */
export function parseDuration(text: string): number | null {
  const factor: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 }
  let seconds = 0
  for (const [, amount, unit] of text.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/g)) {
    seconds += Number(amount) * factor[unit]
  }
  return positive(seconds)
}

const firstMatch = (text: string, patterns: RegExp[]): string | null => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * Lee el tiempo y los gramos de los comentarios de un G-code. Entiende los de Bambu Studio y
 * OrcaSlicer (encabezado), PrusaSlicer (al final) y el tiempo de Cura.
 */
export function parseGcodeText(text: string): Pick<SlicedPlate, 'seconds' | 'grams'> {
  const time = firstMatch(text, [
    /total estimated time\s*[:=]\s*([\d.dhms ]+)/i,
    /estimated printing time \(normal mode\)\s*[:=]\s*([\d.dhms ]+)/i,
  ])
  const curaSeconds = text.match(/^;TIME:(\d+)/m)
  const seconds = time ? parseDuration(time) : curaSeconds ? positive(Number(curaSeconds[1])) : null

  const total = firstMatch(text, [
    /total filament weight \[g\]\s*[:=]\s*([\d.]+)/i,
    /total filament used \[g\]\s*[:=]\s*([\d.]+)/i,
  ])
  // Con varios filamentos PrusaSlicer pone "filament used [g] = 1.20, 3.40".
  const perFilament = text.match(/filament used \[g\]\s*[:=]\s*([\d.,\s]+)/i)
  const grams = total
    ? positive(Number(total))
    : perFilament
      ? positive(perFilament[1].split(',').reduce((sum, part) => sum + (Number(part) || 0), 0))
      : null

  return { seconds, grams }
}

const unzipAsync = (data: Uint8Array, wanted: (name: string) => boolean) =>
  new Promise<Unzipped>((resolve, reject) =>
    unzip(data, { filter: (file) => wanted(file.name) }, (error, files) =>
      error ? reject(error) : resolve(files),
    ),
  )

const decoder = new TextDecoder()
const hasData = (plate: SlicedPlate) => plate.seconds !== null || plate.grams !== null

async function readSlicedProject(data: Uint8Array): Promise<SlicerReadResult> {
  let files: Unzipped
  try {
    files = await unzipAsync(
      data,
      (name) => name === 'Metadata/slice_info.config' || /^Metadata\/plate_\d+\.gcode$/.test(name),
    )
  } catch {
    return { ok: false, error: NOT_A_SLICER_FILE }
  }

  const info = files['Metadata/slice_info.config']
  let plates = info ? parseSliceInfo(decoder.decode(info)) : []

  // Si slice_info no trae el tiempo o los gramos, se buscan en el G-code de cada cama.
  for (const [name, content] of Object.entries(files)) {
    const number = Number(name.match(/plate_(\d+)\.gcode$/)?.[1])
    if (!number) continue
    const fromGcode = parseGcodeText(decoder.decode(content))
    const plate = plates.find((item) => item.plate === number)
    if (plate) {
      plate.seconds ??= fromGcode.seconds
      plate.grams ??= fromGcode.grams
    } else {
      plates.push({ plate: number, pieces: null, materials: [], ...fromGcode })
    }
  }

  plates = plates.filter(hasData).sort((a, b) => a.plate - b.plate)
  return plates.length > 0 ? { ok: true, plates } : { ok: false, error: NOT_SLICED }
}

/** Cuánto se lee del principio y del final de un G-code: ahí están los comentarios con totales. */
const GCODE_EDGE_BYTES = 512 * 1024

/** Lee un .gcode.3mf o un .gcode y devuelve sus camas. */
export async function readSlicerFile(file: File): Promise<SlicerReadResult> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
  if (isZip) return readSlicedProject(new Uint8Array(await file.arrayBuffer()))

  if (/\.(3mf|zip)$/i.test(file.name)) return { ok: false, error: NOT_A_SLICER_FILE }

  const start = await file.slice(0, GCODE_EDGE_BYTES).text()
  const end =
    file.size > GCODE_EDGE_BYTES ? await file.slice(-GCODE_EDGE_BYTES).text() : ''
  const plate: SlicedPlate = { plate: 1, pieces: null, materials: [], ...parseGcodeText(`${start}\n${end}`) }
  if (hasData(plate)) return { ok: true, plates: [plate] }
  return { ok: false, error: /\.g(code)?$/i.test(file.name) ? NOTHING_FOUND : NOT_A_SLICER_FILE }
}

/** Los cambios al borrador al elegir una cama: solo lo que el archivo sí traía. */
export function plateToDraft(plate: SlicedPlate): Partial<QuoteDraft> {
  const changes: Partial<QuoteDraft> = {}
  if (plate.grams !== null) changes.gramsPerPlate = Math.round(plate.grams * 100) / 100
  if (plate.seconds !== null) {
    const minutes = Math.round(plate.seconds / 60)
    changes.hours = Math.floor(minutes / 60)
    changes.minutes = minutes % 60
  }
  if (plate.pieces !== null) changes.piecesPerPlate = plate.pieces
  return changes
}
