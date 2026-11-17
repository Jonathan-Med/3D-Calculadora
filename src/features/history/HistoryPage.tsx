import { CircleCheck, FilePen, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Card } from '../../components/ui'
import { removeQuote, setQuoteSold } from '../../db/hooks'
import {
  monthKey,
  printerPayback,
  salesOf,
  summarizeByMonth,
  summarizeSales,
  type SalesSummary,
} from '../../domain/history'
import type { SavedQuote, Settings } from '../../domain/types'
import { money, monthLabel, percent, plural, shortDate } from '../../lib/format'
import { ROUTE_HREF } from '../../lib/useHashRoute'
import { DRAFT_STORAGE_KEY, reviveDraft } from '../quote/draft'

type Filter = 'all' | 'quoted' | 'sold'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'quoted', label: 'Cotizados' },
  { id: 'sold', label: 'Vendidos' },
]

interface Props {
  settings: Settings
  quotes: SavedQuote[]
}

export function HistoryPage({ settings, quotes }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [thisMonth] = useState(() => monthKey(Date.now()))

  if (quotes.length === 0) {
    return (
      <Card title="Historial">
        <p className="text-sm text-muted">
          Aún no hay pedidos guardados. En{' '}
          <a className="underline" href={ROUTE_HREF.cotizar}>
            Cotizar
          </a>
          , usa "Registrar venta" o "Guardar cotización" y aquí verás cuánto llevas ganado.
        </p>
      </Card>
    )
  }

  const sales = salesOf(quotes)
  const total = summarizeSales(sales)
  const months = summarizeByMonth(sales)
  const current = months.find((entry) => entry.month === thisMonth)?.summary
  const payback = printerPayback(total, settings.printer.purchasePrice)
  const shown = quotes.filter((quote) => filter === 'all' || quote.status === filter)

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
      {/* min-w-0: sin esto una tabla ancha estira la columna y la página se desborda en celular. */}
      <div className="min-w-0 space-y-4 lg:order-2">
        <Card title={monthLabel(thisMonth)}>
          {current ? (
            <MonthSplit summary={current} />
          ) : (
            <p className="text-sm text-muted">Todavía no registras ventas este mes.</p>
          )}
        </Card>

        <Card title="Tu impresora" description={settings.printer.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{payback.paidOff ? 'Ya se pagó sola' : 'Lo que ya recuperaste'}</span>
            <span className="tabular-nums">
              <span className="font-semibold">{money(payback.recovered)}</span>{' '}
              <span className="text-xs text-muted">
                de {money(settings.printer.purchasePrice)} · {percent(payback.percent)}
              </span>
            </span>
          </div>
          <div
            className="mt-1.5 h-2 rounded-full bg-surface-2"
            role="progressbar"
            aria-label="Avance para recuperar el costo de la impresora"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(payback.percent)}
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${payback.percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Es lo que has cobrado menos lo que gastaste en material, luz y extras.
            {!payback.paidOff && ` Te faltan ${money(payback.remaining)}.`}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <Stat
              label="Apartado para repuestos"
              value={total.sparesReserve}
              note="Lo que tus ventas han juntado para boquillas, placa y mantenimiento."
            />
            <Stat
              label="Apartado para reponerla"
              value={total.printerReserve}
              note={`Por el desgaste de ${Math.round(total.hours)} h de impresión vendidas.`}
            />
          </div>
        </Card>

        {months.length > 0 && (
          <Card title="Por mes" description="Lo cobrado se reparte en gastado, apartado y lo que te queda.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    {/* En celular solo caben las tres columnas que importan. */}
                    <th className="py-1.5 pr-3 font-medium">Mes</th>
                    <th className="hidden py-1.5 pr-3 text-right font-medium sm:table-cell">Ventas</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Cobraste</th>
                    <th className="hidden py-1.5 pr-3 text-right font-medium sm:table-cell">Gastaste</th>
                    <th className="hidden py-1.5 pr-3 text-right font-medium sm:table-cell">Apartar</th>
                    <th className="py-1.5 text-right font-medium">Te queda</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(({ month, summary }) => (
                    <tr key={month} className="border-t border-line">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{monthLabel(month)}</td>
                      <td className="hidden py-1.5 pr-3 text-right sm:table-cell">{summary.sales}</td>
                      <td className="py-1.5 pr-3 text-right">{money(summary.revenue)}</td>
                      <td className="hidden py-1.5 pr-3 text-right sm:table-cell">
                        {money(summary.spent)}
                      </td>
                      <td className="hidden py-1.5 pr-3 text-right sm:table-cell">
                        {money(summary.printerReserve + summary.sparesReserve)}
                      </td>
                      <td className="py-1.5 text-right font-semibold">{money(summary.kept)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <div className="min-w-0 lg:order-1">
        <Card
          title="Pedidos"
          description={`${plural(quotes.length, 'guardado', 'guardados')}, ${plural(sales.length, 'vendido', 'vendidos')}.`}
        >
          <div className="mb-3 flex gap-1" role="group" aria-label="Filtrar pedidos">
            {FILTERS.map((option) => (
              <Button
                key={option.id}
                variant={filter === option.id ? 'secondary' : 'ghost'}
                aria-pressed={filter === option.id}
                className={filter === option.id ? 'bg-accent-soft' : ''}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="text-sm text-muted">No hay pedidos en este filtro.</p>
          ) : (
            <ul className="space-y-3">
              {shown.map((quote) => (
                <QuoteRow key={quote.id} quote={quote} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function MonthSplit({ summary }: { summary: SalesSummary }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-xs font-medium">Cobraste</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(summary.revenue)}</p>
          <p className="text-xs text-muted">
            {plural(summary.sales, 'venta', 'ventas')} · {plural(summary.pieces, 'pieza', 'piezas')}
          </p>
        </div>
        <div className="rounded-xl border border-accent bg-accent-soft p-3">
          <p className="text-xs font-medium">Te queda</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{money(summary.kept)}</p>
          <p className="text-xs text-muted">Tu tiempo más la ganancia.</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted tabular-nums">
        Gastaste {money(summary.spent)} en material, luz y extras · Conviene apartar{' '}
        {money(summary.printerReserve + summary.sparesReserve)} para la impresora y sus repuestos.
      </p>
    </>
  )
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div>
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{money(value)}</p>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
    </div>
  )
}

function QuoteRow({ quote }: { quote: SavedQuote }) {
  const [confirming, setConfirming] = useState(false)
  const sold = quote.status === 'sold'
  const kept = quote.totalPrice - quote.cost.cashCost - quote.cost.machineReserve

  const reopen = () => {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(reviveDraft(quote.draft)))
    } catch {
      // Sin almacenamiento no hay forma de pasar el pedido a Cotizar; se abre vacío.
    }
    window.location.hash = ROUTE_HREF.cotizar
  }

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{quote.title}</p>
          <p className="text-xs text-muted">
            {quote.customer && `${quote.customer} · `}
            {shortDate(sold && quote.soldAt ? quote.soldAt : quote.createdAt)} ·{' '}
            {plural(quote.pieces, 'pieza', 'piezas')}
          </p>
          {quote.items && quote.items.length > 1 && (
            <p className="mt-0.5 text-xs text-muted">
              {quote.items.map((item) => `${item.name} × ${item.quantity}`).join(' · ')}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums">{money(quote.totalPrice)}</p>
          <p className="text-xs">
            {sold ? (
              <span className="inline-flex items-center gap-1">
                <CircleCheck size={13} className="text-good" aria-hidden /> Vendido
              </span>
            ) : (
              <span className="text-muted">Cotizado</span>
            )}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted tabular-nums">
        {quote.priceLabel} · costo real {money(quote.cost.totalCost)} ·{' '}
        {sold ? 'te quedaron' : 'te quedarían'} {money(kept)}
      </p>

      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-bad-soft p-2 text-sm">
          <span className="mr-auto">¿Borrar para siempre? No se puede deshacer.</span>
          <Button onClick={() => void removeQuote(quote.id)}>Sí, borrar</Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {sold ? (
            <Button onClick={() => void setQuoteSold(quote.id, false)}>
              <Undo2 size={16} aria-hidden /> No se vendió
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void setQuoteSold(quote.id, true)}>
              <CircleCheck size={16} aria-hidden /> Marcar vendido
            </Button>
          )}
          <Button
            onClick={reopen}
            title="Carga este pedido en Cotizar; reemplaza lo que tengas capturado ahí"
          >
            <FilePen size={16} aria-hidden /> Reabrir
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={() => setConfirming(true)}>
            <Trash2 size={16} aria-hidden /> Borrar
          </Button>
        </div>
      )}
    </li>
  )
}
