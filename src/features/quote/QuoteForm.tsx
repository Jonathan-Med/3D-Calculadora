import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useId } from 'react'
import {
  Button,
  Card,
  Field,
  IconButton,
  MiniLabel,
  NumberField,
  NumberInput,
  Select,
  TextInput,
} from '../../components/ui'
import type { ExtraItem, Filament, Settings } from '../../domain/types'
import { money } from '../../lib/format'
import { ROUTE_HREF } from '../../lib/useHashRoute'
import { newExtraKey, pickFilament, type DraftExtra, type QuoteDraft } from './draft'
import { SlicerImport } from './SlicerImport'

interface Props {
  draft: QuoteDraft
  onChange: (changes: Partial<QuoteDraft>) => void
  onReset: () => void
  settings: Settings
  filaments: Filament[]
  catalog: ExtraItem[]
}

export function QuoteForm({ draft, onChange, onReset, settings, filaments, catalog }: Props) {
  const filamentId = useId()
  const filament = pickFilament(draft, filaments)

  const changeExtra = (key: string, changes: Partial<DraftExtra>) =>
    onChange({
      extras: draft.extras.map((extra) => (extra.key === key ? { ...extra, ...changes } : extra)),
    })

  const addExtra = (extra: Omit<DraftExtra, 'key'>) =>
    onChange({ extras: [...draft.extras, { ...extra, key: newExtraKey() }] })

  return (
    <div className="min-w-0 space-y-4">
      <Card
        title="Impresión"
        description="Sube el archivo laminado de Bambu Studio o copia sus datos a mano."
        action={
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw size={16} aria-hidden /> Limpiar
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <SlicerImport onChange={onChange} />
          </div>

          <div className="col-span-2">
            <Field
              label="Filamento"
              htmlFor={filamentId}
              hint={
                filaments.length === 0 ? (
                  <>
                    No hay filamentos. Agrega uno en{' '}
                    <a className="underline" href={ROUTE_HREF.configuracion}>
                      Configuración
                    </a>
                    .
                  </>
                ) : undefined
              }
            >
              <Select
                id={filamentId}
                value={filament?.id ?? ''}
                onChange={(event) => onChange({ filamentId: Number(event.target.value) })}
                disabled={filaments.length === 0}
              >
                {filaments.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {money(option.spoolPrice)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="col-span-2">
            <NumberField
              label="Filamento de la cama"
              suffix="g"
              value={draft.gramsPerPlate}
              onChange={(gramsPerPlate) => onChange({ gramsPerPlate })}
              hint="El total que marca el slicer para toda la cama, con soportes."
            />
          </div>

          <NumberField
            label="Tiempo: horas"
            suffix="h"
            integer
            value={draft.hours}
            onChange={(hours) => onChange({ hours })}
          />
          <NumberField
            label="Tiempo: minutos"
            suffix="min"
            integer
            value={draft.minutes}
            onChange={(minutes) => onChange({ minutes })}
          />

          <NumberField
            label="Piezas en la cama"
            integer
            value={draft.piecesPerPlate}
            onChange={(piecesPerPlate) => onChange({ piecesPerPlate })}
            hint="Cuántas salen de una impresión."
          />
          <NumberField
            label="Piezas del pedido"
            integer
            value={draft.quantity}
            onChange={(quantity) => onChange({ quantity })}
            hint="Cuántas te pidieron."
          />
        </div>
      </Card>

      <Card
        title="Tu trabajo"
        description={`Se cobra a ${money(settings.laborRatePerHour)} la hora.`}
      >
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            label="Una vez por pedido"
            suffix="min"
            value={draft.laborMinutesPerOrder}
            onChange={(laborMinutesPerOrder) => onChange({ laborMinutesPerOrder })}
            hint="Diseñar, preparar el archivo, atender al cliente."
          />
          <NumberField
            label="Por cada pieza"
            suffix="min"
            value={draft.laborMinutesPerPiece}
            onChange={(laborMinutesPerPiece) => onChange({ laborMinutesPerPiece })}
            hint="Quitar soportes, lijar, armar, empacar."
          />
        </div>
      </Card>

      <Card title="Extras" description="Lo que compras aparte: argollas, imanes, empaque.">
        {draft.extras.length > 0 && (
          <ul className="mb-4 space-y-3">
            {draft.extras.map((extra) => (
              <li key={extra.key} className="rounded-xl border border-line p-3">
                <div className="flex gap-2">
                  <TextInput
                    aria-label="Nombre del extra"
                    placeholder="Nombre del extra"
                    value={extra.name}
                    onChange={(name) => changeExtra(extra.key, { name })}
                  />
                  <IconButton
                    label={`Quitar ${extra.name || 'extra'}`}
                    onClick={() =>
                      onChange({ extras: draft.extras.filter((item) => item.key !== extra.key) })
                    }
                  >
                    <Trash2 size={18} aria-hidden />
                  </IconButton>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                  <label>
                    <MiniLabel>Costo</MiniLabel>
                    <NumberInput
                      prefix="$"
                      value={extra.unitCost}
                      onChange={(unitCost) => changeExtra(extra.key, { unitCost })}
                    />
                  </label>
                  <label>
                    <MiniLabel>Cantidad</MiniLabel>
                    <NumberInput
                      value={extra.quantity}
                      onChange={(quantity) => changeExtra(extra.key, { quantity })}
                    />
                  </label>
                  <label>
                    <MiniLabel>Se cobra</MiniLabel>
                    <Select
                      value={extra.per}
                      onChange={(event) =>
                        changeExtra(extra.key, { per: event.target.value === 'order' ? 'order' : 'piece' })
                      }
                    >
                      <option value="piece">Por pieza</option>
                      <option value="order">Por pedido</option>
                    </Select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {catalog.map((item) => (
            <Button
              key={item.id}
              onClick={() =>
                addExtra({ name: item.name, unitCost: item.unitCost, quantity: 1, per: item.per })
              }
            >
              <Plus size={16} aria-hidden /> {item.name}
            </Button>
          ))}
          <Button
            variant="ghost"
            onClick={() => addExtra({ name: '', unitCost: 0, quantity: 1, per: 'piece' })}
          >
            <Plus size={16} aria-hidden /> Otro
          </Button>
        </div>
      </Card>
    </div>
  )
}
