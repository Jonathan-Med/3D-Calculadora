import { unzip, type Unzipped } from 'fflate'
import type { Filament } from '../../domain/types'
import { newRowKey, type DraftMaterial, type QuoteDraft } from './draft'

/** Un filamento usado en la cama: uno por color. */
export interface SlicedFilament {
  /** Tipo que dice el slicer, por ejemplo "PLA"; vacío si no lo dice. */
  type: string
  /** #RRGGBB; vacío si no lo dice. */
  color: string
  grams: number
}

/** Lo que se pudo leer de una cama laminada. Lo que el archivo no trae queda en null o vacío. */
export interface SlicedPlate {
  /** Número de cama en el slicer (1, 2…). */
  plate: number
  seconds: number | null
  /** Gramos de toda la cama, sumando todos los colores. */
  grams: number | null
  /** Objetos en la cama, que normalmente son las piezas. */
  pieces: number | null
  /** Desglose por filamento; vacío si el archivo solo da el total. */
  filaments: SlicedFilament[]
}

export type SlicerReadResult = { ok: true; plates: SlicedPlate[] } | { ok: false; error: string }

const NOT_A_SLICER_FILE = 'Ese archivo no es de un slicer. Sube el .gcode.3mf o el .gcode.'
const NOT_SLICED =
  'Este proyecto no trae la impresión laminada. En Bambu Studio lamina la cama y, en el menú ' +
  'Archivo › Exportar, exporta la cama laminada (archivo .gcode.3mf).'
const NOTHING_FOUND = 'El archivo no dice cuánto tarda ni cuánto filamento usa.'

const positive = (value: number): number | null => (Number.isFinite(value) && value > 0 ? value : null)

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0)

/** "#FFFFFFFF" o "#ffffff" → "#ffffff"; cualquier otra cosa → "". */
const normalizeColor = (text: string | undefined): string => {
  const match = text?.trim().match(/^#([0-9a-f]{6})/i)
  return match ? `#${match[1].toLowerCase()}` : ''
}

const attributes = (tag: string): Record<string, string> => {
  const found: Record<string, string> = {}
  for (const [, key, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) found[key] = value
  return found
}

/**
 * Lee `Metadata/slice_info.config` de un .gcode.3mf de Bambu Studio u OrcaSlicer: trae, por
 * cama, el tiempo estimado en segundos, los gramos de cada filamento y los objetos.
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
    const filaments = [...body.matchAll(/<filament\b[^>]*>/g)]
      .map(([tag]) => attributes(tag))
      .map((filament) => ({
        type: filament.type ?? '',
        color: normalizeColor(filament.color),
        grams: Number(filament.used_g) || 0,
      }))
      .filter((filament) => filament.grams > 0)

    plates.push({
      plate: Number(meta.index) || plates.length + 1,
      seconds: positive(Number(meta.prediction)),
      // Con desglose, el total es su suma para que todo cuadre.
      grams: positive(sum(filaments.map((filament) => filament.grams))) ?? positive(Number(meta.weight)),
      pieces: objects.length > 0 ? objects.length : null,
      filaments,
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

/** "2.81,0.37" o "3.20, 1.30" → [2.81, 0.37]. */
const numberList = (text: string): number[] => text.split(',').map((part) => Number(part.trim()) || 0)

/** "PLA;PETG" → ["PLA", "PETG"]. */
const settingList = (text: string, key: string): string[] | null => {
  const match = text.match(new RegExp(`^;\\s*${key}\\s*=\\s*(.*)$`, 'm'))
  return match ? match[1].split(';').map((part) => part.trim()) : null
}

/**
 * Lee el tiempo y los gramos de los comentarios de un G-code. Entiende los de Bambu Studio y
 * OrcaSlicer (encabezado), PrusaSlicer (al final) y el tiempo de Cura. Con varios colores, los
 * gramos vienen separados por comas, uno por filamento.
 */
export function parseGcodeText(text: string): Pick<SlicedPlate, 'seconds' | 'grams' | 'filaments'> {
  const time = firstMatch(text, [
    /total estimated time\s*[:=]\s*([\d.dhms ]+)/i,
    /estimated printing time \(normal mode\)\s*[:=]\s*([\d.dhms ]+)/i,
  ])
  const curaSeconds = text.match(/^;TIME:(\d+)/m)
  const seconds = time ? parseDuration(time) : curaSeconds ? positive(Number(curaSeconds[1])) : null

  const perFilament = firstMatch(text, [
    /total filament weight \[g\]\s*[:=]\s*([\d., \t]+)/i, // Bambu Studio y OrcaSlicer
    /^;\s*filament used \[g\]\s*=\s*([\d., \t]+)/im, // PrusaSlicer y OrcaSlicer
  ])
  const gramsList = perFilament ? numberList(perFilament) : []
  const types = settingList(text, 'filament_type') ?? []
  const colors = settingList(text, 'filament_colou?r') ?? []
  // Solo se confía en tipos y colores si hay uno por cada cifra de gramos.
  const filaments = gramsList
    .map((grams, index) => ({
      type: types.length === gramsList.length ? (types[index] ?? '') : '',
      color: colors.length === gramsList.length ? normalizeColor(colors[index]) : '',
      grams,
    }))
    .filter((filament) => filament.grams > 0)

  return { seconds, grams: positive(sum(filaments.map((filament) => filament.grams))), filaments }
}

const unzipAsync = (data: Uint8Array, wanted: (name: string) => boolean) =>
  new Promise<Unzipped>((resolve, reject) =>
    unzip(data, { filter: (file) => wanted(file.name) }, (error, files) =>
      error ? reject(error) : resolve(files),
    ),
  )

const decoder = new TextDecoder()
const hasData = (plate: SlicedPlate) => plate.seconds !== null || plate.grams !== null
const isComplete = (plate: SlicedPlate) => plate.seconds !== null && plate.grams !== null
const SLICE_INFO = 'Metadata/slice_info.config'
const PLATE_GCODE = /^Metadata\/plate_(\d+)\.gcode$/

async function readSlicedProject(data: Uint8Array): Promise<SlicerReadResult> {
  let plates: SlicedPlate[]
  try {
    const info = (await unzipAsync(data, (name) => name === SLICE_INFO))[SLICE_INFO]
    plates = info ? parseSliceInfo(decoder.decode(info)) : []

    // El G-code de cada cama pesa mucho: solo se abre si slice_info no trae tiempo y gramos.
    if (plates.length === 0 || !plates.every(isComplete)) {
      const gcodes = await unzipAsync(data, (name) => PLATE_GCODE.test(name))
      for (const [name, content] of Object.entries(gcodes)) {
        const number = Number(name.match(PLATE_GCODE)?.[1])
        const fromGcode = parseGcodeText(decoder.decode(content))
        const plate = plates.find((item) => item.plate === number)
        if (!plate) {
          plates.push({ plate: number, pieces: null, ...fromGcode })
          continue
        }
        plate.seconds ??= fromGcode.seconds
        if (plate.grams === null) {
          plate.grams = fromGcode.grams
          plate.filaments = fromGcode.filaments
        }
      }
    }
  } catch {
    return { ok: false, error: NOT_A_SLICER_FILE }
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
  const end = file.size > GCODE_EDGE_BYTES ? await file.slice(-GCODE_EDGE_BYTES).text() : ''
  const plate: SlicedPlate = { plate: 1, pieces: null, ...parseGcodeText(`${start}\n${end}`) }
  if (hasData(plate)) return { ok: true, plates: [plate] }
  return { ok: false, error: /\.g(code)?$/i.test(file.name) ? NOTHING_FOUND : NOT_A_SLICER_FILE }
}

/**
 * El filamento de Configuración para un tipo del slicer: el que ya estaba elegido si su nombre
 * menciona ese tipo, si no el primero que lo mencione, y si ninguno, el que ya estaba elegido.
 */
export function matchFilament(
  type: string,
  filaments: Filament[],
  current: number | null,
): number | null {
  const mentions = (filament: Filament) =>
    type !== '' && filament.name.toLowerCase().includes(type.toLowerCase())
  const selected = filaments.find((filament) => filament.id === current)
  if (selected && mentions(selected)) return selected.id
  return filaments.find(mentions)?.id ?? current
}

const twoDecimals = (value: number) => Math.round(value * 100) / 100

/** Los cambios al borrador al elegir una cama: solo lo que el archivo sí traía. */
export function plateToDraft(
  plate: SlicedPlate,
  filaments: Filament[] = [],
  currentFilamentId: number | null = null,
): Partial<QuoteDraft> {
  const changes: Partial<QuoteDraft> = {}
  if (plate.filaments.length > 0) {
    changes.materials = plate.filaments.map(
      (filament): DraftMaterial => ({
        key: newRowKey(),
        filamentId: matchFilament(filament.type, filaments, currentFilamentId),
        grams: twoDecimals(filament.grams),
        color: filament.color,
      }),
    )
  } else if (plate.grams !== null) {
    changes.materials = [
      { key: newRowKey(), filamentId: currentFilamentId, grams: twoDecimals(plate.grams), color: '' },
    ]
  }
  if (plate.seconds !== null) {
    const minutes = Math.round(plate.seconds / 60)
    changes.hours = Math.floor(minutes / 60)
    changes.minutes = minutes % 60
  }
  if (plate.pieces !== null) changes.piecesPerPlate = plate.pieces
  return changes
}
