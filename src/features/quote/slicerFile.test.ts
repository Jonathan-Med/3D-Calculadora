import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { Filament } from '../../domain/types'
import {
  matchFilament,
  parseDuration,
  parseGcodeText,
  parseSliceInfo,
  plateToDraft,
  readSlicerFile,
} from './slicerFile'

// Así lo escribe Bambu Studio en Metadata/slice_info.config (recortado).
const SLICE_INFO = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
    <header_item key="X-BBL-Client-Version" value="02.02.00.85"/>
  </header>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="printer_model_id" value="N1"/>
    <metadata key="prediction" value="5025"/>
    <metadata key="weight" value="15.67"/>
    <object identify_id="101" name="Llavero" skipped="false" />
    <object identify_id="102" name="Llavero" skipped="false" />
    <object identify_id="103" name="Llavero" skipped="true" />
    <filament id="1" tray_info_idx="GFA00" type="PLA" color="#FFFFFF" used_m="5.12" used_g="15.67" />
  </plate>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="prediction" value="600"/>
    <metadata key="weight" value=""/>
    <object identify_id="201" name="Base" skipped="false" />
    <filament id="1" type="PLA" color="#FFFFFF" used_m="1" used_g="2.5" />
    <filament id="2" type="PETG" color="#000000" used_m="1" used_g="1.5" />
  </plate>
</config>`

const BAMBU_HEADER = `; HEADER_BLOCK_START
; BambuStudio 02.02.00.85
; model printing time: 1h 20m 5s; total estimated time: 1h 23m 45s
; total layer number: 120
; total filament length [mm] : 5120.33
; total filament weight [g] : 15.67
; HEADER_BLOCK_END
G28
`

const zipFile = (files: Record<string, string>, name: string) =>
  new File(
    [zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])))],
    name,
  )

describe('parseSliceInfo', () => {
  it('lee tiempo, gramos y piezas de cada cama', () => {
    expect(parseSliceInfo(SLICE_INFO)).toEqual([
      {
        plate: 1,
        seconds: 5025,
        grams: 15.67,
        pieces: 2,
        filaments: [{ type: 'PLA', color: '#ffffff', grams: 15.67 }],
      },
      {
        plate: 2,
        seconds: 600,
        grams: 4,
        pieces: 1,
        filaments: [
          { type: 'PLA', color: '#ffffff', grams: 2.5 },
          { type: 'PETG', color: '#000000', grams: 1.5 },
        ],
      },
    ])
  })

  it('deja en null lo que una cama sin laminar no trae', () => {
    expect(parseSliceInfo('<config><plate><metadata key="index" value="1"/></plate></config>')).toEqual([
      { plate: 1, seconds: null, grams: null, pieces: null, filaments: [] },
    ])
  })

  it('usa la suma de los colores aunque el total diga otra cosa, y quita los que no se usan', () => {
    const xml = `<config><plate>
      <metadata key="index" value="1"/><metadata key="prediction" value="60"/><metadata key="weight" value="9"/>
      <filament id="1" type="PLA" color="#FF0000FF" used_g="3"/>
      <filament id="2" type="PLA" color="#00FF00FF" used_g="0"/>
      <filament id="3" type="PLA" color="#0000FFFF" used_g="4.5"/>
    </plate></config>`
    expect(parseSliceInfo(xml)[0]).toMatchObject({
      grams: 7.5,
      filaments: [
        { type: 'PLA', color: '#ff0000', grams: 3 },
        { type: 'PLA', color: '#0000ff', grams: 4.5 },
      ],
    })
  })
})

describe('parseDuration', () => {
  it('suma días, horas, minutos y segundos', () => {
    expect(parseDuration('1d 2h 3m 4s')).toBe(93784)
    expect(parseDuration('45m 0s')).toBe(2700)
  })

  it('da null si no hay tiempo', () => {
    expect(parseDuration('')).toBeNull()
  })
})

describe('parseGcodeText', () => {
  it('lee el encabezado de Bambu Studio usando el tiempo total, no solo el del modelo', () => {
    expect(parseGcodeText(BAMBU_HEADER)).toEqual({
      seconds: 5025,
      pieces: null,
      grams: 15.67,
      filaments: [{ type: '', color: '', grams: 15.67 }],
    })
  })

  it('suma todos los colores de Bambu Studio, no solo el primero', () => {
    const text = `; total estimated time: 1h 0m 0s
; total filament weight [g] : 2.81,0.00,0.37
G28
; filament_type = PLA;PLA;PETG
; filament_colour = #FFFFFF;#FF0000;#000000
`
    expect(parseGcodeText(text)).toEqual({
      seconds: 3600,
      pieces: null,
      grams: 3.18,
      filaments: [
        { type: 'PLA', color: '#ffffff', grams: 2.81 },
        { type: 'PETG', color: '#000000', grams: 0.37 },
      ],
    })
  })

  it('empata gramos y colores con la lista de filamentos usados de Bambu Studio', () => {
    // Recortado de un G-code real de Bambu Studio 02.09: usa los filamentos 2, 3 y 4 de los 4
    // del proyecto, así que hay 3 cifras de gramos y 4 colores.
    const text = [
      '; model printing time: 1h 44m 11s; total estimated time: 1h 51m 27s',
      '; total filament weight [g] : 2.75,22.98,4.38',
      '; filament_density: 1.32,1.23,1.26,1.24',
      '; filament: 2,3,4',
      '; filament_colour = #4D3324;#161616;#FFFFFF;#F72323',
      '; filament_type = PLA;PLA;PLA;PLA',
    ].join('\n')
    expect(parseGcodeText(text)).toEqual({
      seconds: 6687,
      grams: 30.11,
      pieces: null,
      filaments: [
        { type: 'PLA', color: '#161616', grams: 2.75 },
        { type: 'PLA', color: '#ffffff', grams: 22.98 },
        { type: 'PLA', color: '#f72323', grams: 4.38 },
      ],
    })
  })

  it('cuenta las piezas por los objetos distintos de la cama', () => {
    const text = '; OBJECT_ID: 214\nG1 X1\n; OBJECT_ID: 230\nG1 X2\n; OBJECT_ID: 214\n'
    expect(parseGcodeText(text).pieces).toBe(2)
  })

  it('lee el desglose que PrusaSlicer pone al final', () => {
    const text =
      'G1 X1\n; filament used [g] = 3.20, 1.30\n; total filament used [g] = 4.50\n' +
      '; estimated printing time (normal mode) = 2h 5m 0s\n; filament_colour = #FF8000;#FFFFFF\n'
    expect(parseGcodeText(text)).toEqual({
      seconds: 7500,
      pieces: null,
      grams: 4.5,
      filaments: [
        { type: '', color: '#ff8000', grams: 3.2 },
        { type: '', color: '#ffffff', grams: 1.3 },
      ],
    })
  })

  it('no pone colores si no hay uno por cada filamento', () => {
    const text = '; total filament weight [g] : 2,1\n; filament_colour = #FFFFFF;#FF0000;#000000\n'
    expect(parseGcodeText(text).filaments.map((filament) => filament.color)).toEqual(['', ''])
  })

  it('lee el tiempo de Cura aunque no traiga gramos', () => {
    expect(parseGcodeText(';FLAVOR:Marlin\n;TIME:3600\n;Filament used: 1.2m\n')).toEqual({
      seconds: 3600,
      pieces: null,
      grams: null,
      filaments: [],
    })
  })
})

describe('readSlicerFile', () => {
  it('lee los dos colores de un .gcode.3mf', async () => {
    const result = await readSlicerFile(
      zipFile({ 'Metadata/slice_info.config': SLICE_INFO }, 'dos-colores.gcode.3mf'),
    )
    expect(result.ok && result.plates[1].filaments.map((filament) => filament.grams)).toEqual([2.5, 1.5])
  })

  it('lee un .gcode.3mf de Bambu Studio', async () => {
    const file = zipFile(
      { 'Metadata/slice_info.config': SLICE_INFO, 'Metadata/plate_1.gcode': BAMBU_HEADER, '3D/3dmodel.model': '<model/>' },
      'llavero.gcode.3mf',
    )
    const result = await readSlicerFile(file)
    expect(result.ok && result.plates.map((plate) => plate.plate)).toEqual([1, 2])
  })

  it('completa con el G-code de la cama lo que slice_info no trae', async () => {
    const file = zipFile(
      {
        'Metadata/slice_info.config': '<config><plate><metadata key="index" value="1"/></plate></config>',
        'Metadata/plate_1.gcode': BAMBU_HEADER,
      },
      'pieza.gcode.3mf',
    )
    expect(await readSlicerFile(file)).toEqual({
      ok: true,
      plates: [
        {
          plate: 1,
          seconds: 5025,
          grams: 15.67,
          pieces: null,
          filaments: [{ type: '', color: '', grams: 15.67 }],
        },
      ],
    })
  })

  it('avisa si el proyecto no está laminado', async () => {
    const result = await readSlicerFile(zipFile({ '3D/3dmodel.model': '<model/>' }, 'proyecto.3mf'))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/no trae la impresión laminada/)
  })

  it('lee un .gcode suelto', async () => {
    const result = await readSlicerFile(new File([BAMBU_HEADER], 'pieza.gcode'))
    expect(result).toEqual({
      ok: true,
      plates: [
        {
          plate: 1,
          seconds: 5025,
          grams: 15.67,
          pieces: null,
          filaments: [{ type: '', color: '', grams: 15.67 }],
        },
      ],
    })
  })

  it('rechaza archivos que no son de un slicer', async () => {
    expect((await readSlicerFile(new File(['hola'], 'notas.txt'))).ok).toBe(false)
    expect((await readSlicerFile(new File(['no es zip'], 'roto.3mf'))).ok).toBe(false)
  })
})

const catalog: Filament[] = [
  { id: 1, name: 'PLA 1 kg', spoolPrice: 350, spoolGrams: 1000 },
  { id: 2, name: 'PETG negro', spoolPrice: 420, spoolGrams: 1000 },
  { id: 3, name: 'PLA seda', spoolPrice: 500, spoolGrams: 1000 },
]

describe('matchFilament', () => {
  it('se queda con el elegido si es del mismo tipo', () => {
    expect(matchFilament('PLA', catalog, 3)).toBe(3)
  })

  it('busca uno del tipo si el elegido es de otro', () => {
    expect(matchFilament('PETG', catalog, 1)).toBe(2)
  })

  it('deja el elegido si ninguno es de ese tipo o el slicer no lo dice', () => {
    expect(matchFilament('ABS', catalog, 1)).toBe(1)
    expect(matchFilament('', catalog, 3)).toBe(3)
  })
})

describe('plateToDraft', () => {
  const withoutKeys = (changes: ReturnType<typeof plateToDraft>) => ({
    ...changes,
    materials: changes.materials?.map(({ filamentId, grams, color }) => ({ filamentId, grams, color })),
  })

  it('redondea el tiempo al minuto y lo parte en horas y minutos', () => {
    const plate = { plate: 1, seconds: 5025, grams: 15.674, pieces: 2, filaments: [] }
    expect(withoutKeys(plateToDraft(plate, catalog, 1))).toEqual({
      materials: [{ filamentId: 1, grams: 15.67, color: '' }],
      hours: 1,
      minutes: 24,
      piecesPerPlate: 2,
    })
  })

  it('pone un renglón por color con su filamento', () => {
    const plate = {
      plate: 1,
      seconds: null,
      grams: 4,
      pieces: null,
      filaments: [
        { type: 'PLA', color: '#ffffff', grams: 2.5 },
        { type: 'PETG', color: '#000000', grams: 1.5 },
      ],
    }
    expect(withoutKeys(plateToDraft(plate, catalog, 1)).materials).toEqual([
      { filamentId: 1, grams: 2.5, color: '#ffffff' },
      { filamentId: 2, grams: 1.5, color: '#000000' },
    ])
  })

  it('no toca lo que el archivo no traía', () => {
    const plate = { plate: 1, seconds: 3600, grams: null, pieces: null, filaments: [] }
    expect(plateToDraft(plate)).toEqual({ hours: 1, minutes: 0 })
  })
})
