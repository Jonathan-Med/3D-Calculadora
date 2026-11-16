import { describe, expect, it } from 'vitest'
import type { Filament, PriceEvaluation, SuggestedPrice } from '../../domain/types'
import {
  choosePrice,
  CUSTOM_PRICE,
  EMPTY_DRAFT,
  pickFilament,
  reviveDraft,
  toJobInput,
  type QuoteDraft,
} from './draft'

const filaments: Filament[] = [
  { id: 1, name: 'PLA', spoolPrice: 350, spoolGrams: 1000 },
  { id: 2, name: 'PETG', spoolPrice: 420, spoolGrams: 1000 },
]

const draft: QuoteDraft = {
  ...EMPTY_DRAFT,
  filamentId: 2,
  gramsPerPlate: 90,
  hours: 2,
  minutes: 30,
  piecesPerPlate: 9,
  quantity: 18,
}

describe('toJobInput', () => {
  it('junta horas y minutos y usa el filamento elegido', () => {
    const job = toJobInput(draft, filaments)
    expect(job.hoursPerPlate).toBeCloseTo(2.5)
    expect(job.filament.spoolPrice).toBe(420)
    expect(job.quantity).toBe(18)
  })

  it('usa el primer filamento si el elegido ya no existe', () => {
    expect(pickFilament({ ...draft, filamentId: 99 }, filaments)?.id).toBe(1)
    expect(pickFilament({ ...draft, filamentId: null }, filaments)?.id).toBe(1)
  })

  it('no se rompe si no hay filamentos', () => {
    expect(toJobInput(draft, []).filament).toEqual({ spoolPrice: 0, spoolGrams: 0 })
  })
})

describe('choosePrice', () => {
  const evaluation = (unitPrice: number): PriceEvaluation => ({
    totalPrice: unitPrice * 9,
    unitPrice,
    verdict: 'profitable',
    profit: 0,
    marginPercent: 0,
    markupPercent: 0,
    earnings: 0,
  })
  const tier = (id: string, unitPrice: number): SuggestedPrice => ({
    ...evaluation(unitPrice),
    tier: { id, name: id, description: '', markupPercent: 0 },
  })
  const prices = [tier('friend', 12), tier('regular', 16), tier('premium', 26)]

  it('usa el nivel elegido', () => {
    expect(choosePrice({ ...draft, priceChoice: 'premium' }, prices, null)?.price.unitPrice).toBe(26)
  })

  it('usa el precio propio cuando está elegido y capturado', () => {
    const chosen = choosePrice({ ...draft, priceChoice: CUSTOM_PRICE }, prices, evaluation(14))
    expect(chosen?.id).toBe(CUSTOM_PRICE)
    expect(chosen?.price.unitPrice).toBe(14)
  })

  it('cae en el regular si el precio propio se borró o el nivel no existe', () => {
    expect(choosePrice({ ...draft, priceChoice: CUSTOM_PRICE }, prices, null)?.id).toBe('regular')
    expect(choosePrice({ ...draft, priceChoice: 'otro' }, prices, null)?.id).toBe('regular')
  })

  it('cae en el primer nivel si no hay regular, y en null si no hay ninguno', () => {
    expect(choosePrice(draft, [tier('a', 5)], null)?.id).toBe('a')
    expect(choosePrice(draft, [], null)).toBeNull()
  })
})

describe('reviveDraft', () => {
  it('devuelve un borrador vacío si no hay nada guardado o es basura', () => {
    expect(reviveDraft(undefined)).toEqual(EMPTY_DRAFT)
    expect(reviveDraft('hola')).toEqual(EMPTY_DRAFT)
    expect(reviveDraft(null)).toEqual(EMPTY_DRAFT)
  })

  it('conserva un borrador válido', () => {
    const stored = JSON.parse(JSON.stringify(draft))
    expect(reviveDraft(stored)).toEqual(draft)
  })

  it('rellena campos faltantes o inválidos', () => {
    const revived = reviveDraft({ gramsPerPlate: 50, quantity: -4, extras: 'no', hours: null })
    expect(revived.gramsPerPlate).toBe(50)
    expect(revived.quantity).toBe(1)
    expect(revived.hours).toBe(0)
    expect(revived.extras).toEqual([])
  })

  it('repara extras incompletos y descarta los que no son objetos', () => {
    const revived = reviveDraft({ extras: [{ name: 'Imán', unitCost: 4 }, 7, { per: 'order' }] })
    expect(revived.extras).toHaveLength(2)
    expect(revived.extras[0]).toMatchObject({ name: 'Imán', unitCost: 4, quantity: 1, per: 'piece' })
    expect(revived.extras[1]).toMatchObject({ name: '', unitCost: 0, quantity: 1, per: 'order' })
  })
})
