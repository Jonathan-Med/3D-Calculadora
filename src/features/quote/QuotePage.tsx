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
  reviveDraft,
  toJobInput,
  type QuoteDraft,
} from './draft'
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

  const save = async (status: SavedQuote['status']) => {
    if (!chosen) return
    await saveQuote({
      status,
      title: draft.title.trim() || 'Impresión 3D',
      customer: draft.customer.trim(),
      pieces: cost.totals.pieces,
      unitPrice: chosen.price.unitPrice,
      totalPrice: chosen.price.totalPrice,
      priceLabel: chosen.label,
      cost,
      draft,
    })
  }

  return (
    <div className="grid items-start gap-4 pb-24 lg:grid-cols-2 lg:gap-6 lg:pb-0">
      <QuoteForm
        draft={draft}
        onChange={change}
        onReset={() => setDraft(EMPTY_DRAFT)}
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
