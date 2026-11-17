import { CircleCheck, CircleX, FilePen, Plus, RotateCcw, Save, Trash2, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, Card, IconButton, NumberField } from '../../components/ui'
import type { QuantityScenario } from '../../domain/batch'
import type {
  CostBreakdown,
  PriceEvaluation,
  PriceVerdict,
  SavedQuote,
  Settings,
  SuggestedPrice,
} from '../../domain/types'
import { duration, grams, money, percent, plural } from '../../lib/format'
import { ROUTE_HREF } from '../../lib/useHashRoute'
import { ClientQuoteCard } from './ClientQuote'
import { CUSTOM_PRICE, type ChosenPrice, type QuoteDraft } from './draft'
import { lineName, orderTotals, type OrderLine } from './order'

interface Props {
  cost: CostBreakdown
  prices: SuggestedPrice[]
  customPrice: PriceEvaluation | null
  /** El precio que va en la cotización del cliente. */
  chosen: ChosenPrice | null
  draft: QuoteDraft
  onChange: (changes: Partial<QuoteDraft>) => void
  onSave: (status: SavedQuote['status']) => Promise<void>
  scenarios: QuantityScenario[]
  /** Piezas que salen de un rollo de cada filamento; vacío si aún no hay gramos capturados. */
  spools: { pieces: number; name: string; color?: string }[]
  laborMinutes: number
  settings: Settings
  /** Todas las piezas de la cotización, incluida la que está en captura si ya tiene precio. */
  lines: OrderLine[]
  onAddPiece: () => void
  onEditItem: (key: string) => void
  onRemoveItem: (key: string) => void
  onNewQuote: () => void
}

export function QuoteResult({
  cost,
  prices,
  customPrice,
  chosen,
  draft,
  onChange,
  onSave,
  scenarios,
  spools,
  laborMinutes,
  settings,
  lines,
  onAddPiece,
  onEditItem,
  onRemoveItem,
  onNewQuote,
}: Props) {
  const hasPiece = cost.totalCost > 0
  const several = cost.totals.pieces > 1
  const estimated = settings.estimated.length

  return (
    <div className="space-y-4">
      {!hasPiece && (
        <Card title={draft.items.length > 0 ? 'Siguiente pieza' : 'Resultado'}>
          <p className="text-sm text-muted">
            Captura los gramos y el tiempo de la impresión para ver cuánto te cuesta y cuánto cobrar.
          </p>
        </Card>
      )}

      {hasPiece && (
        <>
          <Card title="Cuánto te cuesta">
            <div className="grid grid-cols-2 gap-3">
              <Floor
                label="Sale de tu bolsa"
                unit={cost.perPiece.cashCost}
                total={several ? cost.cashCost : null}
                note="Material, luz y extras. Si cobras menos, pones dinero."
              />
              <Floor
                label="Costo real"
                unit={cost.perPiece.totalCost}
                total={several ? cost.totalCost : null}
                note="Suma impresora, repuestos y tu tiempo. Desde aquí es rentable."
                emphasized
              />
            </div>

            <h3 className="mt-5 text-sm font-semibold">
              En qué se va{several && ` (pedido de ${cost.totals.pieces} piezas)`}
            </h3>
            <Breakdown cost={cost} laborMinutes={laborMinutes} settings={settings} />

            <p className="mt-4 text-xs text-muted">
              {plural(cost.totals.plates, 'cama', 'camas')} · {duration(cost.totals.hours)} de impresión ·{' '}
              {grams(cost.totals.grams)} de filamento
            </p>
            {estimated > 0 && (
              <p className="mt-2 text-xs text-muted">
                Este cálculo usa {plural(estimated, 'valor estimado', 'valores estimados')}.{' '}
                <a className="underline" href={ROUTE_HREF.configuracion}>
                  Revisar en Configuración
                </a>
              </p>
            )}
          </Card>

          <Card
            title="Cuánto cobrar"
            description="Costo real más ganancia y el cobro por hora de impresora. Elige el que va en la cotización del cliente."
          >
            <ul className="space-y-2">
              {prices.map((price) => {
                const selected = chosen?.id === price.tier.id
                return (
                  <li key={price.tier.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected ? 'border-accent bg-accent-soft' : 'border-line'}`}
                    >
                      <input
                        type="radio"
                        name="precio-cotizacion"
                        className="mt-1 size-4 shrink-0 accent-accent"
                        checked={selected}
                        onChange={() => onChange({ priceChoice: price.tier.id })}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{price.tier.name}</span>
                        <span className="block text-xs text-muted">{price.tier.description}</span>
                        <span className="mt-1.5 block text-xs text-muted">
                          Ganancia {money(price.profit)} + {money(cost.labor)} de tu tiempo
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xl font-semibold tabular-nums">
                          {money(price.unitPrice)}
                        </span>
                        {several && (
                          <span className="block text-xs text-muted tabular-nums">
                            c/u · total {money(price.totalPrice)}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="mt-5 border-t border-line pt-4">
              <NumberField
                label={several ? '¿Y si cobro otro precio por pieza?' : '¿Y si cobro otro precio?'}
                prefix="$"
                value={draft.customUnitPrice}
                onChange={(customUnitPrice) =>
                  onChange(
                    customUnitPrice > 0
                      ? { customUnitPrice, priceChoice: CUSTOM_PRICE }
                      : { customUnitPrice },
                  )
                }
              />
              {customPrice && (
                <>
                  <Verdict price={customPrice} cost={cost} />
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="precio-cotizacion"
                      className="size-4 accent-accent"
                      checked={chosen?.id === CUSTOM_PRICE}
                      onChange={() => onChange({ priceChoice: CUSTOM_PRICE })}
                    />
                    Usar este precio en la cotización del cliente
                  </label>
                </>
              )}
            </div>
          </Card>

        </>
      )}

      {lines.length > 0 && (
        <OrderCard
          draft={draft}
          lines={lines}
          onAddPiece={onAddPiece}
          onEditItem={onEditItem}
          onRemoveItem={onRemoveItem}
          onNewQuote={onNewQuote}
        />
      )}

      {lines.length > 0 && (
        <ClientQuoteCard
          draft={draft}
          onChange={onChange}
          lines={lines}
          business={settings.business}
        />
      )}

      {lines.length > 0 && <SaveCard draft={draft} lines={lines} onSave={onSave} />}

      {hasPiece && spools.length > 0 && (
        <Card title="Lotes y rollo">
          <ul className="space-y-1 text-sm">
            {spools.map((spool, index) => (
              <li key={index} className="flex items-center gap-2">
                {spool.color && <Swatch color={spool.color} />}
                <span>
                  De un rollo de <span className="font-medium">{spool.name}</span> salen{' '}
                  <span className="font-semibold tabular-nums">
                    {plural(spool.pieces, 'pieza', 'piezas')}
                  </span>
                  {spools.length === 1 && ', con la merma incluida'}.
                </span>
              </li>
            ))}
          </ul>
          {spools.length > 1 && <p className="mt-1 text-xs text-muted">Con la merma incluida.</p>}

          <h3 className="mt-5 text-sm font-semibold">Si te piden más o menos piezas</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1.5 pr-3 font-medium">Piezas</th>
                  <th className="py-1.5 pr-3 font-medium">Camas</th>
                  <th className="py-1.5 pr-3 font-medium">Impresión</th>
                  <th className="py-1.5 text-right font-medium">Costo real c/u</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario) => (
                  <tr
                    key={scenario.quantity}
                    className={`border-t border-line ${scenario.current ? 'bg-accent-soft font-semibold' : ''}`}
                  >
                    <td className="py-1.5 pr-3 pl-2">
                      {scenario.quantity}
                      {scenario.current && <span className="ml-1.5 text-xs font-normal">tu pedido</span>}
                    </td>
                    <td className="py-1.5 pr-3">{scenario.plates}</td>
                    <td className="py-1.5 pr-3">{duration(scenario.hours)}</td>
                    <td className="py-1.5 pr-2 text-right">{money(scenario.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

/** Las piezas de la cotización y el botón para agregar la que está en captura y seguir con otra. */
function OrderCard({
  draft,
  lines,
  onAddPiece,
  onEditItem,
  onRemoveItem,
  onNewQuote,
}: {
  draft: QuoteDraft
  lines: OrderLine[]
  onAddPiece: () => void
  onEditItem: (key: string) => void
  onRemoveItem: (key: string) => void
  onNewQuote: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const { pieces, totalPrice } = orderTotals(lines)
  const current = lines.find((line) => line.current)

  return (
    <Card
      title="Piezas de la cotización"
      description="¿El cliente quiere más de un modelo? Agrega esta pieza y captura la siguiente."
    >
      <ul className="divide-y divide-line">
        {lines.map((line, index) => (
          <li key={line.key} className="flex items-start gap-3 py-2.5 first:pt-0">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {line.swatches.map((color) => (
                  <Swatch key={color} color={color} />
                ))}
                <span className="truncate">{lineName(line, index, lines.length, draft.title)}</span>
              </p>
              <p className="text-xs text-muted tabular-nums">
                {line.quantity} × {money(line.unitPrice)} · {line.priceLabel}
                {line.current && ' · en captura'}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{money(line.totalPrice)}</span>
            {!line.current && (
              <div className="-my-1 flex shrink-0">
                <IconButton label={`Editar ${line.name || `pieza ${index + 1}`}`} onClick={() => onEditItem(line.key)}>
                  <FilePen size={16} aria-hidden />
                </IconButton>
                <IconButton label={`Quitar ${line.name || `pieza ${index + 1}`}`} onClick={() => onRemoveItem(line.key)}>
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>

      {lines.length > 1 && (
        <p className="mt-1 flex justify-between border-t border-line pt-2.5 text-sm font-semibold tabular-nums">
          <span>Total · {plural(pieces, 'pieza', 'piezas')}</span>
          <span>{money(totalPrice)}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {current && (
          <Button variant="primary" onClick={onAddPiece}>
            <Plus size={16} aria-hidden /> Agregar y cotizar otra pieza
          </Button>
        )}
        {draft.items.length > 0 &&
          (confirming ? (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              ¿Borrar todas las piezas?
              <Button
                onClick={() => {
                  onNewQuote()
                  setConfirming(false)
                }}
              >
                Sí, empezar otra
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              <RotateCcw size={16} aria-hidden /> Cotización nueva
            </Button>
          ))}
      </div>
      {draft.items.length > 0 && current === undefined && (
        <p className="mt-2 text-xs text-muted">
          La siguiente pieza se suma aquí en cuanto captures sus gramos y su tiempo.
        </p>
      )}
    </Card>
  )
}

function SaveCard({
  draft,
  lines,
  onSave,
}: {
  draft: QuoteDraft
  lines: OrderLine[]
  onSave: (status: SavedQuote['status']) => Promise<void>
}) {
  const { totalPrice } = orderTotals(lines)
  const labels = [...new Set(lines.map((line) => line.priceLabel))]
  // Lo ya guardado se recuerda por su contenido: al cambiar algo se puede volver a guardar.
  const signature = JSON.stringify([draft, totalPrice])
  const [saved, setSaved] = useState<{ signature: string; status: SavedQuote['status'] } | null>(null)
  const [failed, setFailed] = useState(false)
  const done = saved?.signature === signature ? saved.status : null

  const save = async (status: SavedQuote['status']) => {
    try {
      await onSave(status)
      setSaved({ signature, status })
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }

  return (
    <Card
      title="Guardar pedido"
      description={`${lines.length > 1 ? `${lines.length} piezas, ` : ''}${labels.length === 1 ? `con ${labels[0]}` : 'con varios precios'}: ${money(totalPrice)}. Guarda los costos de hoy aunque después cambien tus precios.`}
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void save('sold')} disabled={done !== null}>
          <CircleCheck size={16} aria-hidden /> Registrar venta
        </Button>
        <Button onClick={() => void save('quoted')} disabled={done !== null}>
          <Save size={16} aria-hidden /> Guardar cotización
        </Button>
      </div>
      <p className="mt-2 min-h-4 text-xs text-muted" role="status">
        {failed && 'No se pudo guardar. Intenta de nuevo.'}
        {!failed && done && (
          <>
            {done === 'sold' ? 'Venta registrada.' : 'Cotización guardada.'}{' '}
            <a className="underline" href={ROUTE_HREF.historial}>
              Ver historial
            </a>
          </>
        )}
      </p>
    </Card>
  )
}

function Floor({
  label,
  unit,
  total,
  note,
  emphasized = false,
}: {
  label: string
  unit: number
  total: number | null
  note: string
  emphasized?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${emphasized ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2'}`}
    >
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{money(unit)}</p>
      {total !== null && (
        <p className="text-xs tabular-nums">por pieza · {money(total)} el pedido</p>
      )}
      <p className="mt-2 text-xs text-muted">{note}</p>
    </div>
  )
}

function Breakdown({
  cost,
  laborMinutes,
  settings,
}: {
  cost: CostBreakdown
  laborMinutes: number
  settings: Settings
}) {
  const colors = cost.materialLines.filter((line) => line.grams > 0)
  const lines = [
    {
      label: 'Material',
      detail: `${grams(cost.totals.grams)}${colors.length > 1 ? ` en ${colors.length} colores` : ''}, merma incluida`,
      value: cost.material,
      parts: colors.length > 1 ? colors : [],
    },
    { label: 'Luz', detail: `${duration(cost.totals.hours)} de impresión`, value: cost.electricity },
    { label: 'Desgaste de la impresora', detail: 'Para reponerla algún día', value: cost.depreciation },
    { label: 'Repuestos', detail: 'Boquilla, placa y mantenimiento', value: cost.maintenance },
    {
      label: 'Impresiones fallidas',
      detail: `${percent(settings.failurePercent)} de lo anterior`,
      value: cost.failures,
    },
    { label: 'Extras', detail: 'Lo que compras aparte', value: cost.extras },
    {
      label: 'Tu trabajo',
      detail: `${duration(laborMinutes / 60)} a ${money(settings.laborRatePerHour)} la hora`,
      value: cost.labor,
    },
  ]

  return (
    <ul className="mt-2 space-y-2.5">
      {lines.map((line) => {
        const share = cost.totalCost > 0 ? (line.value / cost.totalCost) * 100 : 0
        return (
          <li key={line.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">
                {line.label} <span className="text-xs text-muted">· {line.detail}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {money(line.value)} <span className="text-xs text-muted">{percent(share)}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
            </div>
            {line.parts && line.parts.length > 0 && (
              <ul className="mt-1.5 space-y-1 pl-3 text-xs text-muted">
                {line.parts.map((part, index) => (
                  <li key={index} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {part.color && <Swatch color={part.color} />}
                      <span className="truncate">
                        {part.label} · {grams(part.grams)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{money(part.cost)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Muestra del color de un filamento. */
function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3 shrink-0 rounded-full border border-line"
      style={{ background: color }}
      aria-hidden
    />
  )
}

const verdictStyle: Record<PriceVerdict, { box: string; icon: ReactNode; title: string }> = {
  loss: {
    box: 'border-bad bg-bad-soft',
    icon: <CircleX size={20} className="mt-0.5 shrink-0 text-bad" aria-hidden />,
    title: 'Pierdes dinero',
  },
  'covers-cash-only': {
    box: 'border-warn bg-warn-soft',
    icon: <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warn" aria-hidden />,
    title: 'Recuperas lo gastado, pero no es rentable',
  },
  profitable: {
    box: 'border-good bg-good-soft',
    icon: <CircleCheck size={20} className="mt-0.5 shrink-0 text-good" aria-hidden />,
    title: 'Es rentable',
  },
}

function Verdict({ price, cost }: { price: PriceEvaluation; cost: CostBreakdown }) {
  const style = verdictStyle[price.verdict]
  const several = cost.totals.pieces > 1

  let detail: string
  if (price.verdict === 'loss') {
    detail = `No alcanza para reponer material, luz y extras: te faltan ${money(cost.cashCost - price.totalPrice)}.`
  } else if (price.verdict === 'covers-cash-only') {
    detail = `No paga la impresora ni todo tu tiempo: te faltan ${money(-price.profit)} para llegar al costo real.`
  } else {
    detail = `Ganas ${money(price.profit)} además de ${money(cost.labor)} por tu tiempo. Margen de ${percent(price.marginPercent)}.`
  }

  return (
    <div className={`mt-3 flex gap-2.5 rounded-xl border p-3 ${style.box}`} role="status">
      {style.icon}
      <div className="text-sm">
        <p className="font-semibold">{style.title}</p>
        <p className="mt-0.5">{detail}</p>
        {several && (
          <p className="mt-0.5 text-xs text-muted tabular-nums">
            Pedido completo: {money(price.totalPrice)}
          </p>
        )}
      </div>
    </div>
  )
}
