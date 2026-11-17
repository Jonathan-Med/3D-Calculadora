import { Copy, Download, Share2, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Button, Card, TextField } from '../../components/ui'
import type { BusinessProfile } from '../../domain/types'
import { longDate, money, plural, slug } from '../../lib/format'
import { downloadBlob } from '../../lib/download'
import { renderPng } from '../../lib/image'
import { ROUTE_HREF } from '../../lib/useHashRoute'
import type { QuoteDraft } from './draft'
import { lineName, orderTotals, type OrderLine } from './order'

interface Props {
  draft: QuoteDraft
  onChange: (changes: Partial<QuoteDraft>) => void
  lines: OrderLine[]
  business: BusinessProfile
}

/** Lo que la imagen muestra de cada pieza. */
interface ImageLine {
  name: string
  colors: string
  measurements: string
  swatches: string[]
  quantity: number
  unitPrice: number
  totalPrice: number
}

const canShareImages = (): boolean => {
  try {
    const probe = new File([''], 'cotizacion.png', { type: 'image/png' })
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

const canCopyImages = (): boolean =>
  typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'

/** La imagen que se le manda al cliente: precio y datos del negocio, sin costos internos. */
export function ClientQuoteCard({ draft, onChange, lines, business }: Props) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState<{ signature: string; blob: Blob | null } | null>(null)
  const [message, setMessage] = useState('')
  const [shareable] = useState(canShareImages)
  const [copyable] = useState(canCopyImages)

  const title =
    draft.title.trim() || (lines.length === 1 ? lineName(lines[0], 0, 1, '') : 'Impresión 3D')
  const [date] = useState(() => longDate(new Date()))
  const { totalPrice } = orderTotals(lines)
  const belowCost = lines.some((line) => line.totalPrice < line.cost.totalCost - 1e-6)
  const labels = [...new Set(lines.map((line) => line.priceLabel))]
  const imageLines: ImageLine[] = lines.map((line, index) => ({
    name: lineName(line, index, lines.length, draft.title),
    colors: line.colors,
    measurements: line.measurements,
    swatches: line.swatches,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    totalPrice: line.totalPrice,
  }))

  // Todo lo que cambia el aspecto de la imagen. Mientras no cambie, la imagen lista sigue sirviendo.
  const signature = JSON.stringify([
    title,
    draft.customer,
    draft.delivery,
    imageLines,
    totalPrice,
    business,
    date,
  ])

  // La imagen se prepara por adelantado: compartir y copiar solo funcionan si
  // ocurren justo al tocar el botón, sin esperar a que se genere.
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const node = nodeRef.current
      if (!node) return
      try {
        const blob = await renderPng(node)
        if (!cancelled) setRendered({ signature, blob })
      } catch {
        if (!cancelled) setRendered({ signature, blob: null })
      }
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [signature])

  const current = rendered?.signature === signature ? rendered : null
  const image = current?.blob ?? null
  const failed = current !== null && current.blob === null
  const filename = `cotizacion-${slug(title) || 'impresion-3d'}.png`

  const share = async () => {
    if (!image) return
    try {
      await navigator.share({ files: [new File([image], filename, { type: 'image/png' })], title })
      setMessage('')
    } catch (error) {
      // AbortError: la persona cerró el menú de compartir; no es un fallo.
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage('No se pudo compartir. Descarga la imagen y envíala desde tu galería.')
    }
  }

  const copy = async () => {
    if (!image) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })])
      setMessage('Imagen copiada. Pégala en el chat.')
    } catch {
      setMessage('No se pudo copiar. Descarga la imagen.')
    }
  }

  const download = () => {
    if (!image) return
    downloadBlob(image, filename)
    setMessage('Imagen descargada.')
  }

  return (
    <Card
      title="Cotización para el cliente"
      description={`Una imagen ${labels.length === 1 ? `con ${labels[0]}` : 'con los precios que elegiste'} para mandar por WhatsApp. No muestra tus costos.`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            label={lines.length > 1 ? 'Título de la cotización' : 'Qué le vas a hacer'}
            placeholder={lines.length > 1 ? 'Figuras para fiesta' : 'Llaveros personalizados'}
            value={draft.title}
            onChange={(title) => onChange({ title })}
          />
        </div>
        <TextField
          label="Cliente"
          placeholder="Opcional"
          value={draft.customer}
          onChange={(customer) => onChange({ customer })}
        />
        <TextField
          label="Entrega"
          placeholder="3 días"
          value={draft.delivery}
          onChange={(delivery) => onChange({ delivery })}
        />
      </div>

      {belowCost && (
        <p className="mt-4 flex gap-2 rounded-lg bg-warn-soft p-2.5 text-xs">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <span>
            <span className="font-semibold">Ojo:</span>{' '}
            {lines.length > 1 ? 'hay piezas con precio' : 'este precio está'} por debajo de tu costo
            real.
          </span>
        </p>
      )}

      <div className="mx-auto mt-4 max-w-[360px] overflow-hidden rounded-xl border border-line">
        <ClientQuoteImage
          nodeRef={nodeRef}
          business={business}
          title={title}
          customer={draft.customer.trim()}
          delivery={draft.delivery.trim()}
          lines={imageLines}
          totalPrice={totalPrice}
          date={date}
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {shareable && (
          <Button variant="primary" onClick={() => void share()} disabled={!image}>
            <Share2 size={16} aria-hidden /> Compartir
          </Button>
        )}
        {copyable && (
          <Button
            variant={shareable ? 'secondary' : 'primary'}
            onClick={() => void copy()}
            disabled={!image}
          >
            <Copy size={16} aria-hidden /> Copiar imagen
          </Button>
        )}
        <Button onClick={download} disabled={!image}>
          <Download size={16} aria-hidden /> Descargar
        </Button>
      </div>

      <p className="mt-2 min-h-4 text-center text-xs text-muted" role="status">
        {failed
          ? 'No se pudo generar la imagen en este navegador. Toma una captura de pantalla de la vista previa.'
          : !image
            ? 'Preparando imagen…'
            : message}
      </p>

      {!business.name && (
        <p className="mt-2 text-center text-xs text-muted">
          Agrega el nombre y logo de tu negocio en{' '}
          <a className="underline" href={ROUTE_HREF.configuracion}>
            Configuración
          </a>
          .
        </p>
      )}
    </Card>
  )
}

/**
 * Colores fijos y fondo blanco a propósito: la imagen debe verse igual sin importar
 * si quien la genera usa tema claro u oscuro.
 */
function ClientQuoteImage({
  nodeRef,
  business,
  title,
  customer,
  delivery,
  lines,
  totalPrice,
  date,
}: {
  nodeRef: RefObject<HTMLDivElement | null>
  business: BusinessProfile
  title: string
  customer: string
  delivery: string
  lines: ImageLine[]
  totalPrice: number
  date: string
}) {
  const single = lines.length === 1 ? lines[0] : null
  const note = business.note.trim()
  const contact = business.contact.trim()
  const name = business.name.trim()

  return (
    <div ref={nodeRef} className="w-full bg-white p-5 font-sans text-[#15181c]">
      <div className="flex items-center gap-3">
        {business.logo && (
          <img src={business.logo} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base leading-tight font-bold">{name || 'Cotización'}</p>
          <p className="mt-0.5 text-xs text-[#59626e]">
            {name && 'Cotización · '}
            {date}
          </p>
        </div>
      </div>

      <div className="my-4 h-px bg-[#dde1e6]" />

      {customer && <p className="text-xs text-[#59626e]">Para {customer}</p>}
      <p className="text-lg leading-snug font-semibold">{title}</p>

      {single ? (
        <div className="mt-2 space-y-1 text-sm">
          <ImageDetails line={single} />
          <div className="flex items-baseline justify-between gap-3">
            <span>
              Cantidad: {plural(single.quantity, 'pieza', 'piezas')}
              {single.quantity > 1 && ` × ${money(single.unitPrice)}`}
            </span>
            {single.quantity > 1 && <span className="tabular-nums">{money(single.totalPrice)}</span>}
          </div>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {lines.map((line, index) => (
            <li key={index} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{line.name}</span>
                <span className="shrink-0 tabular-nums">{money(line.totalPrice)}</span>
              </div>
              <p className="text-xs text-[#59626e]">
                {plural(line.quantity, 'pieza', 'piezas')} × {money(line.unitPrice)}
              </p>
              <ImageDetails line={line} small />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-baseline justify-between gap-3 rounded-xl bg-[#0f766e] px-4 py-3 text-white">
        <span className="text-sm font-medium">Total</span>
        <span className="text-2xl font-bold tabular-nums">{money(totalPrice)}</span>
      </div>

      {delivery && (
        <p className="mt-3 text-sm">
          <span className="text-[#59626e]">Entrega:</span> {delivery}
        </p>
      )}

      {(note || contact) && (
        <div className="mt-4 space-y-0.5 border-t border-[#dde1e6] pt-3 text-xs text-[#59626e]">
          {note && <p>{note}</p>}
          {contact && <p>{contact}</p>}
        </div>
      )}
    </div>
  )
}

/** Colores y medidas de una pieza en la imagen, con la muestra de cada color. */
function ImageDetails({ line, small = false }: { line: ImageLine; small?: boolean }) {
  const hasColors = line.colors !== '' || line.swatches.length > 0
  if (!hasColors && !line.measurements) return null
  return (
    <div className={`space-y-0.5 text-[#59626e] ${small ? 'text-xs' : 'text-sm'}`}>
      {hasColors && (
        <p className="flex flex-wrap items-center gap-x-1.5">
          <span>Colores:</span>
          {line.swatches.map((color) => (
            <span
              key={color}
              className="inline-block size-3 rounded-full border border-[#dde1e6]"
              style={{ background: color }}
            />
          ))}
          {line.colors && <span>{line.colors}</span>}
        </p>
      )}
      {line.measurements && <p>Medidas: {line.measurements}</p>}
    </div>
  )
}
