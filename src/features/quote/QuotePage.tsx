import { useRef } from 'react'
import { quantityScenarios } from '../../domain/batch'
import { calculateCost, piecesPerSpool } from '../../domain/cost'
import { evaluatePrice, suggestPrices } from '../../domain/pricing'
import { saveQuote } from '../../db/hooks'
import type { ExtraItem, Filament, SavedQuote, Settings } from '../../domain/types'
import { money } from '../../lib/format'
import { useLocalStorage } from '../../lib/useLocalStorage'
import {
  choosePrice,
  DRAFT_STORAGE_KEY,
  EMPTY_DRAFT,
  nextPiece,
  pieceOf,
  reviveDraft,
  toJobInput,
  type QuoteDraft,
} from './draft'
import { currentLine, orderLines, toItem, toSavedQuote } from './order'
import { QuoteForm } from './QuoteForm'
import { QuoteResult } from './QuoteResult'

interface Props {
  settings: Settings
  filaments: Filament[]
  catalog: ExtraItem[]
}

export function QuotePage({ settings, filaments, catalog }: Props) {
  const [draft, setDraft] = useLocalStorage<QuoteDraft>(DRAFT_STORAGE_KEY, reviveDraft)
  const resultRef = useRef<HTMLDivElement>(null)

  const job = toJobInput(draft, filaments)
  const cost = calculateCost(job, settings)
  const prices = suggestPrices(cost, settings)
  const customPrice =
    draft.customUnitPrice > 0
      ? evaluatePrice(cost, draft.customUnitPrice * cost.totals.pieces)
      : null

  // Cuántas piezas salen de un rollo de cada filamento que se usa.
  const piecesPerPlate = Math.max(1, Math.floor(job.piecesPerPlate))
  const spools = job.materials.flatMap((material) =>
    material.gramsPerPlate > 0 && material.filament.spoolGrams > 0
      ? [
          {
            name: material.label,
            color: material.color,
            pieces: piecesPerSpool(
              material.gramsPerPlate / piecesPerPlate,
              material.filament,
              settings.wastePercent,
            ),
          },
        ]
      : [],
  )

  const laborMinutes = draft.laborMinutesPerOrder + draft.laborMinutesPerPiece * cost.totals.pieces
  const chosen = choosePrice(draft, prices, customPrice)
  const change = (changes: Partial<QuoteDraft>) =>
    setDraft((previous) => ({ ...previous, ...changes }))

  const current = currentLine(draft, cost, chosen)
  const lines = orderLines(draft, current)

  const save = async (status: SavedQuote['status']) => {
    if (lines.length === 0) return
    await saveQuote(toSavedQuote(draft, lines, status))
  }

  // La pieza en captura pasa a la lista y el formulario queda listo para la siguiente.
  const addPiece = () => {
    if (!current) return
    setDraft((previous) => ({
      ...previous,
      ...nextPiece(previous),
      items: [...previous.items, toItem(previous, current)],
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Editar una pieza agregada: vuelve al formulario y, si había otra en captura, esa se agrega.
  const editItem = (key: string) =>
    setDraft((previous) => {
      const item = previous.items.find((candidate) => candidate.key === key)
      if (!item) return previous
      const rest = previous.items.filter((candidate) => candidate.key !== key)
      return { ...previous, ...item.piece, items: current ? [...rest, toItem(previous, current)] : rest }
    })

  const removeItem = (key: string) =>
    setDraft((previous) => ({
      ...previous,
      items: previous.items.filter((item) => item.key !== key),
    }))

  return (
    <div className="grid items-start gap-4 pb-24 lg:grid-cols-2 lg:gap-6 lg:pb-0">
      <QuoteForm
        draft={draft}
        onChange={change}
        onReset={() => setDraft((previous) => ({ ...previous, ...nextPiece(pieceOf(previous)) }))}
        settings={settings}
        filaments={filaments}
        catalog={catalog}
      />

      <div ref={resultRef} className="min-w-0 scroll-mt-20">
        <QuoteResult
          cost={cost}
          prices={prices}
          customPrice={customPrice}
          chosen={chosen}
          draft={draft}
          onChange={change}
          onSave={save}
          scenarios={quantityScenarios(job, settings)}
          spools={spools}
          laborMinutes={laborMinutes}
          settings={settings}
          lines={lines}
          onAddPiece={addPiece}
          onEditItem={editItem}
          onRemoveItem={removeItem}
          onNewQuote={() => setDraft(EMPTY_DRAFT)}
        />
      </div>

      {cost.totalCost > 0 && (
        <button
          type="button"
          onClick={() => resultRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-left lg:hidden"
        >
          <span>
            <span className="block text-xs text-muted">Costo real por pieza</span>
            <span className="text-lg font-semibold tabular-nums">{money(cost.perPiece.totalCost)}</span>
          </span>
          {chosen && (
            <span className="text-right">
              <span className="block text-xs text-muted">{chosen.label}</span>
              <span className="text-lg font-semibold tabular-nums">{money(chosen.price.unitPrice)}</span>
            </span>
          )}
        </button>
      )}
    </div>
  )
}
