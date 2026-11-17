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
  materials: [
    { key: 'a', filamentId: 2, grams: 60, color: '#000000' },
    { key: 'b', filamentId: 1, grams: 30, color: '' },
  ],
  hours: 2,
  minutes: 30,
  piecesPerPlate: 9,
  quantity: 18,
}

describe('toJobInput', () => {
  it('junta horas y minutos y usa el filamento de cada color', () => {
    const job = toJobInput(draft, filaments)
    expect(job.hoursPerPlate).toBeCloseTo(2.5)
    expect(job.materials).toEqual([
      { label: 'PETG', color: '#000000', gramsPerPlate: 60, filament: filaments[1] },
      { label: 'PLA', gramsPerPlate: 30, filament: filaments[0] },
    ])
    expect(job.quantity).toBe(18)
  })

  it('usa el primer filamento si el elegido ya no existe', () => {
    expect(pickFilament(99, filaments)?.id).toBe(1)
    expect(pickFilament(null, filaments)?.id).toBe(1)
  })

  it('no se rompe si no hay filamentos', () => {
    expect(toJobInput(draft, []).materials[0].filament).toEqual({ spoolPrice: 0, spoolGrams: 0 })
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
    tier: { id, name: id, description: '', markupPercent: 0, printerHourRate: 0 },
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

  it('convierte un borrador de antes, de un solo filamento', () => {
    const revived = reviveDraft({ filamentId: 2, gramsPerPlate: 50, quantity: -4, extras: 'no', hours: null })
    expect(revived.materials).toEqual([{ key: expect.any(String), filamentId: 2, grams: 50, color: '' }])
    expect(revived.quantity).toBe(1)
    expect(revived.hours).toBe(0)
    expect(revived.extras).toEqual([])
  })

  it('un borrador de antes queda sin piezas agregadas y sin datos para el cliente', () => {
    const revived = reviveDraft({ gramsPerPlate: 50, title: 'Llaveros' })
    expect(revived.items).toEqual([])
    expect([revived.name, revived.colors, revived.measurements]).toEqual(['', '', ''])
    expect(revived.title).toBe('Llaveros')
  })

  it('conserva las piezas agregadas válidas y descarta las dañadas', () => {
    const item = {
      key: 'x',
      name: 'Osito',
      colors: 'blanco',
      swatches: ['#ffffff', 'no-es-color'],
      measurements: '2 cm',
      quantity: 3,
      unitPrice: 6,
      totalPrice: 18,
      priceLabel: 'Precio Regular',
      cost: { totalCost: 3.38, totals: { pieces: 3 } },
      piece: { name: 'Osito', quantity: 3 },
    }
    const revived = reviveDraft({ items: [item, { name: 'sin precio' }, 'x'] })
    expect(revived.items).toHaveLength(1)
    expect(revived.items[0]).toMatchObject({ name: 'Osito', swatches: ['#ffffff'], totalPrice: 18 })
    expect(revived.items[0].piece).toMatchObject({ name: 'Osito', quantity: 3, piecesPerPlate: 1 })
  })

  it('repara colores inválidos y deja siempre al menos un filamento', () => {
    expect(reviveDraft({ materials: [{ grams: 5, color: 'rojo' }, 'x'] }).materials).toEqual([
      { key: expect.any(String), filamentId: null, grams: 5, color: '' },
    ])
    expect(reviveDraft({ materials: [] }).materials).toHaveLength(1)
  })

  it('repara extras incompletos y descarta los que no son objetos', () => {
    const revived = reviveDraft({ extras: [{ name: 'Imán', unitCost: 4 }, 7, { per: 'order' }] })
    expect(revived.extras).toHaveLength(2)
    expect(revived.extras[0]).toMatchObject({ name: 'Imán', unitCost: 4, quantity: 1, per: 'piece' })
    expect(revived.extras[1]).toMatchObject({ name: '', unitCost: 0, quantity: 1, per: 'order' })
  })
})
