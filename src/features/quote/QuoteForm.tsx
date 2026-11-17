import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  IconButton,
  MiniLabel,
  NumberField,
  NumberInput,
  Select,
  TextField,
  TextInput,
} from '../../components/ui'
import type { ExtraItem, Filament, Settings } from '../../domain/types'
import { grams, money } from '../../lib/format'
import { ROUTE_HREF } from '../../lib/useHashRoute'
import {
  emptyMaterial,
  newRowKey,
  pickFilament,
  type DraftExtra,
  type DraftMaterial,
  type QuoteDraft,
} from './draft'
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
  const changeMaterial = (key: string, changes: Partial<DraftMaterial>) =>
    onChange({
      materials: draft.materials.map((material) =>
        material.key === key ? { ...material, ...changes } : material,
      ),
    })

  const changeExtra = (key: string, changes: Partial<DraftExtra>) =>
    onChange({
      extras: draft.extras.map((extra) => (extra.key === key ? { ...extra, ...changes } : extra)),
    })

  const addExtra = (extra: Omit<DraftExtra, 'key'>) =>
    onChange({ extras: [...draft.extras, { ...extra, key: newRowKey() }] })

  return (
    <div className="min-w-0 space-y-4">
      <Card
        title={draft.items.length > 0 ? `Pieza ${draft.items.length + 1}` : 'Pieza'}
        description="Lo que verá el cliente de esta pieza en su cotización."
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <TextField
              label="Nombre"
              placeholder="Osito"
              value={draft.name}
              onChange={(name) => onChange({ name })}
            />
          </div>
          <TextField
            label="Colores"
            placeholder="Blanco y rojo"
            value={draft.colors}
            onChange={(colors) => onChange({ colors })}
          />
          <TextField
            label="Medidas"
            placeholder="5 × 3 × 2 cm"
            value={draft.measurements}
            onChange={(measurements) => onChange({ measurements })}
          />
        </div>
      </Card>

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
            <SlicerImport
              onChange={onChange}
              filaments={filaments}
              currentFilamentId={pickFilament(draft.materials[0]?.filamentId ?? null, filaments)?.id ?? null}
            />
          </div>

          <div className="col-span-2">
            <MaterialRows
              materials={draft.materials}
              filaments={filaments}
              onChangeMaterial={changeMaterial}
              onChange={onChange}
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

/** Filamento y gramos de la cama: un renglón por color. */
function MaterialRows({
  materials,
  filaments,
  onChangeMaterial,
  onChange,
}: {
  materials: DraftMaterial[]
  filaments: Filament[]
  onChangeMaterial: (key: string, changes: Partial<DraftMaterial>) => void
  onChange: (changes: Partial<QuoteDraft>) => void
}) {
  const several = materials.length > 1
  const showColors = materials.some((material) => material.color)
  const total = materials.reduce((sum, material) => sum + material.grams, 0)

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">Filamento de la cama</legend>
      <ul className="space-y-2">
        {materials.map((material, index) => {
          const filament = pickFilament(material.filamentId, filaments)
          const name = several ? `color ${index + 1}` : 'la cama'
          return (
            <li key={material.key} className="flex items-center gap-2">
              {showColors && (
                <span
                  className="size-5 shrink-0 rounded-full border border-line"
                  style={{ background: material.color || 'transparent' }}
                  title={material.color || 'Sin color'}
                  aria-hidden
                />
              )}
              <Select
                aria-label={`Filamento de ${name}`}
                className="min-w-0 flex-1"
                value={filament?.id ?? ''}
                onChange={(event) =>
                  onChangeMaterial(material.key, { filamentId: Number(event.target.value) })
                }
                disabled={filaments.length === 0}
              >
                {filaments.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {money(option.spoolPrice)}
                  </option>
                ))}
              </Select>
              <div className="w-28 shrink-0">
                <NumberInput
                  aria-label={`Gramos de ${name}`}
                  suffix="g"
                  value={material.grams}
                  onChange={(value) => onChangeMaterial(material.key, { grams: value })}
                />
              </div>
              {several && (
                <IconButton
                  label={`Quitar ${name}`}
                  onClick={() =>
                    onChange({ materials: materials.filter((item) => item.key !== material.key) })
                  }
                >
                  <Trash2 size={18} aria-hidden />
                </IconButton>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() =>
            onChange({
              materials: [...materials, emptyMaterial(materials.at(-1)?.filamentId ?? null)],
            })
          }
        >
          <Plus size={16} aria-hidden /> Otro color
        </Button>
        {several && <span className="text-sm text-muted tabular-nums">Total {grams(total)}</span>}
      </div>
      <p className="mt-1 text-xs text-muted">
        {filaments.length === 0 ? (
          <>
            No hay filamentos. Agrega uno en{' '}
            <a className="underline" href={ROUTE_HREF.configuracion}>
              Configuración
            </a>
            .
          </>
        ) : (
          'Lo que marca el slicer para toda la cama, con soportes. Si imprimes en varios colores, un renglón por color.'
        )}
      </p>
    </fieldset>
  )
}
