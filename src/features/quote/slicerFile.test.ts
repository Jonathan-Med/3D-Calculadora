import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
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
      { plate: 1, seconds: 5025, grams: 15.67, pieces: 2, materials: ['PLA'] },
      { plate: 2, seconds: 600, grams: 4, pieces: 1, materials: ['PLA', 'PETG'] },
    ])
  })

  it('deja en null lo que una cama sin laminar no trae', () => {
    expect(parseSliceInfo('<config><plate><metadata key="index" value="1"/></plate></config>')).toEqual([
      { plate: 1, seconds: null, grams: null, pieces: null, materials: [] },
    ])
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
    expect(parseGcodeText(BAMBU_HEADER)).toEqual({ seconds: 5025, grams: 15.67 })
  })

  it('lee los totales que PrusaSlicer pone al final', () => {
    const text = 'G1 X1\n; filament used [g] = 3.20, 1.30\n; estimated printing time (normal mode) = 2h 5m 0s\n'
    expect(parseGcodeText(text)).toEqual({ seconds: 7500, grams: 4.5 })
  })

  it('prefiere el total de gramos sobre el desglose', () => {
    const text = '; filament used [g] = 3.20, 1.30\n; total filament used [g] = 4.50\n'
    expect(parseGcodeText(text).grams).toBe(4.5)
  })

  it('lee el tiempo de Cura aunque no traiga gramos', () => {
    expect(parseGcodeText(';FLAVOR:Marlin\n;TIME:3600\n;Filament used: 1.2m\n')).toEqual({
      seconds: 3600,
      grams: null,
    })
  })
})

describe('readSlicerFile', () => {
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
      plates: [{ plate: 1, seconds: 5025, grams: 15.67, pieces: null, materials: [] }],
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
      plates: [{ plate: 1, seconds: 5025, grams: 15.67, pieces: null, materials: [] }],
    })
  })

  it('rechaza archivos que no son de un slicer', async () => {
    expect((await readSlicerFile(new File(['hola'], 'notas.txt'))).ok).toBe(false)
    expect((await readSlicerFile(new File(['no es zip'], 'roto.3mf'))).ok).toBe(false)
  })
})

describe('plateToDraft', () => {
  it('redondea el tiempo al minuto y lo parte en horas y minutos', () => {
    expect(plateToDraft({ plate: 1, seconds: 5025, grams: 15.674, pieces: 2, materials: [] })).toEqual({
      gramsPerPlate: 15.67,
      hours: 1,
      minutes: 24,
      piecesPerPlate: 2,
    })
  })

  it('no toca lo que el archivo no traía', () => {
    expect(plateToDraft({ plate: 1, seconds: 3600, grams: null, pieces: null, materials: [] })).toEqual({
      hours: 1,
      minutes: 0,
    })
  })
})
