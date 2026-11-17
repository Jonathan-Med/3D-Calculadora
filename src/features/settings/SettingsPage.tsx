import { ImageUp, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  Button,
  Card,
  Field,
  IconButton,
  MiniLabel,
  NumberField,
  NumberInput,
  Select,
  TextField,
  TextInput,
} from '../../components/ui'
import {
  addExtra,
  addFilament,
  removeExtra,
  removeFilament,
  updateExtra,
  updateFilament,
  updateSettings,
} from '../../db/hooks'
import { machineHourlyRates } from '../../domain/cost'
import { ESTIMATE_NOTES } from '../../domain/defaults'
import type { EstimableField, ExtraItem, Filament, Settings } from '../../domain/types'
import { money, plural } from '../../lib/format'
import { fileToLogo } from '../../lib/image'
import { BackupCard } from './BackupCard'

interface Props {
  settings: Settings
  filaments: Filament[]
  catalog: ExtraItem[]
}

export function SettingsPage({ settings, filaments, catalog }: Props) {
  const rates = machineHourlyRates(settings)
  const estimated = settings.estimated.length

  return (
    <div className="space-y-4">
      {estimated > 0 && (
        <div className="flex gap-2.5 rounded-2xl border border-warn bg-warn-soft p-4 text-sm">
          <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <p>
            <span className="font-semibold">
              {plural(estimated, 'valor sigue siendo una estimación', 'valores siguen siendo estimaciones')}.
            </span>{' '}
            La calculadora ya funciona con ellos. Corrige cada uno cuando tengas el dato real; al
            editarlo deja de marcarse.
          </p>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="min-w-0 space-y-4">
          <Card title="Impresora">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Nombre">
                  <TextInput
                    aria-label="Nombre de la impresora"
                    value={settings.printer.name}
                    onChange={(name) => void updateSettings((s) => void (s.printer.name = name))}
                  />
                </Field>
              </div>
              <SettingNumber
                settings={settings}
                field="printer.purchasePrice"
                label="Cuánto costó"
                prefix="$"
                value={settings.printer.purchasePrice}
                set={(s, value) => void (s.printer.purchasePrice = value)}
              />
              <SettingNumber
                settings={settings}
                field="printer.lifespanHours"
                label="Vida útil"
                suffix="h"
                value={settings.printer.lifespanHours}
                set={(s, value) => void (s.printer.lifespanHours = value)}
              />
              <div className="sm:col-span-2">
                <SettingNumber
                  settings={settings}
                  field="printer.avgPowerWatts"
                  label="Consumo imprimiendo"
                  suffix="W"
                  value={settings.printer.avgPowerWatts}
                  set={(s, value) => void (s.printer.avgPowerWatts = value)}
                />
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-surface-2 p-3 text-sm">
              <p>
                Cada hora de impresión te cuesta{' '}
                <span className="font-semibold tabular-nums">{money(rates.total)}</span>, sin contar
                el filamento:
              </p>
              <p className="mt-1 text-xs text-muted tabular-nums">
                {money(rates.electricity)} de luz · {money(rates.depreciation)} de desgaste ·{' '}
                {money(rates.maintenance)} de repuestos
              </p>
            </div>
          </Card>

          <Card title="Luz y trabajo">
            <div className="grid gap-4">
              <SettingNumber
                settings={settings}
                field="electricityPricePerKwh"
                label="Precio de la luz"
                prefix="$"
                suffix="por kWh"
                value={settings.electricityPricePerKwh}
                set={(s, value) => void (s.electricityPricePerKwh = value)}
              />
              <SettingNumber
                settings={settings}
                field="laborRatePerHour"
                label="Lo que vale tu hora de trabajo"
                prefix="$"
                suffix="por hora"
                value={settings.laborRatePerHour}
                set={(s, value) => void (s.laborRatePerHour = value)}
              />
            </div>
          </Card>

          <Card title="Tu negocio" description="Lo que ve el cliente en la cotización que le mandas.">
            <div className="grid gap-4">
              <TextField
                label="Nombre"
                placeholder="Taller 3D"
                value={settings.business.name}
                onChange={(name) => void updateSettings((s) => void (s.business.name = name))}
              />
              <TextField
                label="Contacto"
                placeholder="WhatsApp, Instagram…"
                value={settings.business.contact}
                onChange={(contact) =>
                  void updateSettings((s) => void (s.business.contact = contact))
                }
              />
              <TextField
                label="Nota al pie"
                placeholder="Vigencia, anticipo, forma de pago…"
                value={settings.business.note}
                onChange={(note) => void updateSettings((s) => void (s.business.note = note))}
              />
              <LogoField logo={settings.business.logo} />
            </div>
          </Card>

          <BackupCard />

          <Card title="Merma y fallos">
            <div className="grid gap-4">
              <SettingNumber
                settings={settings}
                field="wastePercent"
                label="Filamento que se desperdicia"
                suffix="%"
                value={settings.wastePercent}
                set={(s, value) => void (s.wastePercent = value)}
              />
              <SettingNumber
                settings={settings}
                field="failurePercent"
                label="Impresiones que fallan"
                suffix="%"
                value={settings.failurePercent}
                set={(s, value) => void (s.failurePercent = value)}
              />
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card
            title="Repuestos"
            description="Lo que hay que apartar por cada hora impresa para poder comprarlos."
          >
            <EstimateNote settings={settings} field="spareParts" />
            <Rows empty="Sin repuestos: no se aparta nada para mantenimiento.">
              {settings.spareParts.map((part) => (
                <Row
                  key={part.id}
                  name={part.name}
                  nameLabel="Nombre del repuesto"
                  onName={(name) => void changePart(part.id, (p) => void (p.name = name))}
                  onRemove={() =>
                    void updateSettings(
                      (s) => void (s.spareParts = s.spareParts.filter((p) => p.id !== part.id)),
                      'spareParts',
                    )
                  }
                >
                  <label>
                    <MiniLabel>Precio</MiniLabel>
                    <NumberInput
                      prefix="$"
                      value={part.price}
                      onChange={(price) => void changePart(part.id, (p) => void (p.price = price))}
                    />
                  </label>
                  <label>
                    <MiniLabel>Dura</MiniLabel>
                    <NumberInput
                      suffix="h"
                      value={part.lifespanHours}
                      onChange={(hours) =>
                        void changePart(part.id, (p) => void (p.lifespanHours = hours))
                      }
                    />
                  </label>
                </Row>
              ))}
            </Rows>
            <AddButton
              onClick={() =>
                void updateSettings(
                  (s) =>
                    void s.spareParts.push({
                      id: `${Date.now()}`,
                      name: 'Nuevo repuesto',
                      price: 0,
                      lifespanHours: 1000,
                    }),
                  'spareParts',
                )
              }
            >
              Agregar repuesto
            </AddButton>
          </Card>

          <Card title="Filamentos" description="Los rollos que usas, con lo que te cuestan.">
            <Rows empty="Sin filamentos: agrega al menos uno para poder cotizar.">
              {filaments.map((filament) => (
                <Row
                  key={filament.id}
                  name={filament.name}
                  nameLabel="Nombre del filamento"
                  onName={(name) => void updateFilament(filament.id, { name })}
                  onRemove={() => void removeFilament(filament.id)}
                >
                  <label>
                    <MiniLabel>Precio del rollo</MiniLabel>
                    <NumberInput
                      prefix="$"
                      value={filament.spoolPrice}
                      onChange={(spoolPrice) => void updateFilament(filament.id, { spoolPrice })}
                    />
                  </label>
                  <label>
                    <MiniLabel>Peso del rollo</MiniLabel>
                    <NumberInput
                      suffix="g"
                      value={filament.spoolGrams}
                      onChange={(spoolGrams) => void updateFilament(filament.id, { spoolGrams })}
                    />
                  </label>
                </Row>
              ))}
            </Rows>
            <AddButton onClick={() => void addFilament()}>Agregar filamento</AddButton>
          </Card>

          <Card title="Extras" description="Aparecen como botones al cotizar.">
            <Rows empty="Sin extras guardados.">
              {catalog.map((extra) => (
                <Row
                  key={extra.id}
                  name={extra.name}
                  nameLabel="Nombre del extra"
                  onName={(name) => void updateExtra(extra.id, { name })}
                  onRemove={() => void removeExtra(extra.id)}
                >
                  <label>
                    <MiniLabel>Costo</MiniLabel>
                    <NumberInput
                      prefix="$"
                      value={extra.unitCost}
                      onChange={(unitCost) => void updateExtra(extra.id, { unitCost })}
                    />
                  </label>
                  <label>
                    <MiniLabel>Se cobra</MiniLabel>
                    <Select
                      value={extra.per}
                      onChange={(event) =>
                        void updateExtra(extra.id, {
                          per: event.target.value === 'order' ? 'order' : 'piece',
                        })
                      }
                    >
                      <option value="piece">Por pieza</option>
                      <option value="order">Por pedido</option>
                    </Select>
                  </label>
                </Row>
              ))}
            </Rows>
            <AddButton onClick={() => void addExtra()}>Agregar extra</AddButton>
          </Card>

          <Card
            title="Niveles de precio"
            description="Cada precio sugerido es el costo real más su ganancia, más un cobro por cada hora que imprime la impresora."
          >
            <ul className="space-y-3">
              {settings.priceTiers.map((tier) => (
                <li
                  key={tier.id}
                  className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem]"
                >
                  <label className="col-span-2 sm:col-span-1">
                    <MiniLabel>Nombre</MiniLabel>
                    <TextInput
                      value={tier.name}
                      onChange={(name) =>
                        void updateSettings((s) => {
                          const target = s.priceTiers.find((t) => t.id === tier.id)
                          if (target) target.name = name
                        })
                      }
                    />
                  </label>
                  <label>
                    <MiniLabel>Ganancia</MiniLabel>
                    <NumberInput
                      suffix="%"
                      value={tier.markupPercent}
                      onChange={(markupPercent) =>
                        void updateSettings((s) => {
                          const target = s.priceTiers.find((t) => t.id === tier.id)
                          if (target) target.markupPercent = markupPercent
                        })
                      }
                    />
                  </label>
                  <label>
                    <MiniLabel>Por hora</MiniLabel>
                    <NumberInput
                      prefix="$"
                      value={tier.printerHourRate}
                      onChange={(printerHourRate) =>
                        void updateSettings((s) => {
                          const target = s.priceTiers.find((t) => t.id === tier.id)
                          if (target) target.printerHourRate = printerHourRate
                        })
                      }
                    />
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              El cobro por hora es lo que vale el tiempo de la impresora, aunque tú no estés
              trabajando: una pieza de 30 minutos a $25 la hora suma $12.50.
            </p>
            <div className="mt-4 border-t border-line pt-4">
              <NumberField
                label="Redondear precios hacia arriba a múltiplos de"
                prefix="$"
                value={settings.roundTo}
                onChange={(roundTo) => void updateSettings((s) => void (s.roundTo = roundTo))}
                hint="Déjalo vacío para no redondear."
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function LogoField({ logo }: { logo: string | null }) {
  const [error, setError] = useState('')

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      const reduced = await fileToLogo(file)
      await updateSettings((s) => void (s.business.logo = reduced))
      setError('')
    } catch {
      setError('No se pudo leer esa imagen. Prueba con un PNG o JPG.')
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Logo</p>
      <div className="flex items-center gap-3">
        {logo && (
          <img
            src={logo}
            alt="Logo actual"
            className="size-12 rounded-lg border border-line bg-white object-contain"
          />
        )}
        <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2 focus-within:ring-2 focus-within:ring-accent/40">
          <ImageUp size={16} aria-hidden /> {logo ? 'Cambiar' : 'Subir imagen'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              void upload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        {logo && (
          <Button
            variant="ghost"
            onClick={() => void updateSettings((s) => void (s.business.logo = null))}
          >
            Quitar
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  )
}

function changePart(id: string, change: (part: Settings['spareParts'][number]) => void) {
  return updateSettings((s) => {
    const part = s.spareParts.find((p) => p.id === id)
    if (part) change(part)
  }, 'spareParts')
}

function EstimateNote({ settings, field }: { settings: Settings; field: EstimableField }) {
  if (!settings.estimated.includes(field)) return null
  return (
    <div className="mt-1.5 mb-3 flex gap-2 rounded-lg bg-warn-soft p-2.5 text-xs text-ink">
      <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warn" aria-hidden />
      <p>
        <span className="font-semibold">Estimado.</span> {ESTIMATE_NOTES[field]}{' '}
        <button
          type="button"
          className="font-medium underline"
          onClick={() => void updateSettings(() => {}, field)}
        >
          Ya es mi dato real
        </button>
      </p>
    </div>
  )
}

function SettingNumber({
  settings,
  field,
  label,
  value,
  set,
  prefix,
  suffix,
}: {
  settings: Settings
  field: EstimableField
  label: string
  value: number
  set: (settings: Settings, value: number) => void
  prefix?: string
  suffix?: string
}) {
  return (
    <NumberField
      label={label}
      prefix={prefix}
      suffix={suffix}
      value={value}
      onChange={(next) => void updateSettings((s) => set(s, next), field)}
      hint={<EstimateNote settings={settings} field={field} />}
    />
  )
}

function Rows({ children, empty }: { children: ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="text-sm text-muted">{empty}</p>
  return <ul className="space-y-3">{children}</ul>
}

function Row({
  name,
  nameLabel,
  onName,
  onRemove,
  children,
}: {
  name: string
  nameLabel: string
  onName: (name: string) => void
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex gap-2">
        <TextInput aria-label={nameLabel} value={name} onChange={onName} />
        <IconButton label={`Borrar ${name}`} onClick={onRemove}>
          <Trash2 size={18} aria-hidden />
        </IconButton>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">{children}</div>
    </li>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button className="mt-3" onClick={onClick}>
      <Plus size={16} aria-hidden /> {children}
    </Button>
  )
}
