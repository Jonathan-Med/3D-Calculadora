import { FileUp } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui'
import { duration, grams, plural } from '../../lib/format'
import type { QuoteDraft } from './draft'
import { plateToDraft, readSlicerFile, type SlicedPlate } from './slicerFile'

/** "1 h 24 min · 16 g · 2 piezas · PLA" */
function describePlate(plate: SlicedPlate): string {
  return [
    plate.seconds !== null && duration(plate.seconds / 3600),
    plate.grams !== null && grams(plate.grams),
    plate.pieces !== null && plural(plate.pieces, 'pieza', 'piezas'),
    plate.materials.join(', '),
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Llena tiempo, gramos y piezas con el archivo laminado, para no copiarlos a mano. */
export function SlicerImport({ onChange }: { onChange: (changes: Partial<QuoteDraft>) => void }) {
  const [reading, setReading] = useState(false)
  const [choices, setChoices] = useState<{ fileName: string; plates: SlicedPlate[] } | null>(null)
  const [message, setMessage] = useState('')

  const apply = (fileName: string, plate: SlicedPlate, plateCount: number) => {
    onChange(plateToDraft(plate))
    setChoices(null)
    const which = plateCount > 1 ? `la cama ${plate.plate} de ` : ''
    setMessage(`Se leyó ${which}${fileName}: ${describePlate(plate)}. Revisa que todo cuadre.`)
  }

  const read = async (file: File | undefined) => {
    if (!file) return
    setReading(true)
    setChoices(null)
    setMessage('')
    try {
      const result = await readSlicerFile(file)
      if (!result.ok) setMessage(result.error)
      else if (result.plates.length === 1) apply(file.name, result.plates[0], 1)
      else setChoices({ fileName: file.name, plates: result.plates })
    } catch {
      setMessage('No se pudo leer el archivo.')
    }
    setReading(false)
  }

  return (
    <div>
      <label
        className={
          'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface ' +
          'px-3 text-sm font-medium hover:bg-surface-2 focus-within:ring-2 focus-within:ring-accent/40 ' +
          (reading ? 'pointer-events-none opacity-50' : '')
        }
      >
        <FileUp size={16} aria-hidden /> {reading ? 'Leyendo…' : 'Leer archivo del slicer'}
        <input
          type="file"
          accept=".3mf,.gcode,.gco,.g"
          className="sr-only"
          disabled={reading}
          onChange={(event) => {
            void read(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>

      {choices && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-sm font-semibold">
            {choices.fileName} trae {choices.plates.length} camas. ¿Cuál vas a cotizar?
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {choices.plates.map((plate) => (
              <Button
                key={plate.plate}
                className="h-auto min-h-10 justify-start py-2 text-left"
                onClick={() => apply(choices.fileName, plate, choices.plates.length)}
              >
                <span className="font-semibold">Cama {plate.plate}</span>
                <span className="text-muted">{describePlate(plate)}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-muted empty:hidden" role="status">
        {message}
      </p>
    </div>
  )
}
