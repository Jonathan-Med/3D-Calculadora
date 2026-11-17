import { describe, expect, it } from 'vitest'
import { calculateCost } from '../../domain/cost'
import { DEFAULT_SETTINGS } from '../../domain/defaults'
import type { Filament } from '../../domain/types'
import { EMPTY_DRAFT, nextPiece, pieceOf, toJobInput, type ChosenPrice, type QuoteDraft } from './draft'
import { currentLine, lineName, orderLines, orderTotals, toItem, toSavedQuote } from './order'

const filaments: Filament[] = [{ id: 1, name: 'PLA', spoolPrice: 300, spoolGrams: 1000 }]

const bear: QuoteDraft = {
  ...EMPTY_DRAFT,
  materials: [
    { key: 'a', filamentId: 1, grams: 5, color: '#ffffff' },
    { key: 'b', filamentId: 1, grams: 1.76, color: '#f72323' },
  ],
  minutes: 30,
  piecesPerPlate: 3,
  quantity: 3,
  name: 'Osito',
  colors: 'blanco y rojo',
  measurements: '2 cm',
  title: 'Figuras para fiesta',
  customer: 'Ana',
}

const costOf = (draft: QuoteDraft) => calculateCost(toJobInput(draft, filaments), DEFAULT_SETTINGS)

const chosen = (unitPrice: number, quantity: number, label = 'Precio Regular'): ChosenPrice => ({
  id: 'regular',
  label,
  price: {
    totalPrice: unitPrice * quantity,
    unitPrice,
    verdict: 'profitable',
    profit: 0,
    marginPercent: 0,
    markupPercent: 0,
    earnings: 0,
  },
})

describe('currentLine', () => {
  it('convierte la pieza en captura en renglón con sus colores', () => {
    const line = currentLine(bear, costOf(bear), chosen(6, 3))
    expect(line).toMatchObject({
      name: 'Osito',
      colors: 'blanco y rojo',
      swatches: ['#ffffff', '#f72323'],
      measurements: '2 cm',
      quantity: 3,
      unitPrice: 6,
      totalPrice: 18,
      current: true,
    })
  })

  it('no hay renglón mientras la pieza no tiene costo', () => {
    expect(currentLine(EMPTY_DRAFT, costOf(EMPTY_DRAFT), chosen(6, 1))).toBeNull()
  })
})

describe('agregar piezas a la cotización', () => {
  const bearLine = currentLine(bear, costOf(bear), chosen(6, 3))!
  const withBear: QuoteDraft = {
    ...bear,
    ...nextPiece(pieceOf(bear)),
    items: [toItem(bear, bearLine)],
  }

  it('la siguiente pieza empieza vacía con el mismo filamento y nivel de precio', () => {
    expect(withBear.name).toBe('')
    expect(withBear.materials).toEqual([{ key: expect.any(String), filamentId: 1, grams: 0, color: '' }])
    expect(withBear.priceChoice).toBe(bear.priceChoice)
    expect(withBear.customer).toBe('Ana')
  })

  it('la pieza agregada guarda lo capturado para poder editarla', () => {
    expect(withBear.items[0].piece).toEqual(pieceOf(bear))
    expect(withBear.items[0].totalPrice).toBe(18)
  })

  it('suma las piezas agregadas y la que está en captura', () => {
    const keychain: QuoteDraft = {
      ...withBear,
      materials: [{ key: 'c', filamentId: 1, grams: 10, color: '' }],
      hours: 1,
      quantity: 10,
      piecesPerPlate: 10,
    }
    const lines = orderLines(keychain, currentLine(keychain, costOf(keychain), chosen(4, 10, 'Precio Amigo')))
    expect(lines.map((line) => [line.current, line.totalPrice])).toEqual([
      [false, 18],
      [true, 40],
    ])
    expect(orderTotals(lines)).toEqual({ pieces: 13, totalPrice: 58 })
  })
})

describe('lineName', () => {
  const line = currentLine(bear, costOf(bear), chosen(6, 3))!
  it('usa el nombre, o el título si es la única pieza, o el número', () => {
    expect(lineName(line, 0, 2, 'Fiesta')).toBe('Osito')
    expect(lineName({ ...line, name: '' }, 0, 1, 'Fiesta')).toBe('Fiesta')
    expect(lineName({ ...line, name: '' }, 1, 2, 'Fiesta')).toBe('Pieza 2')
  })
})

describe('toSavedQuote', () => {
  const bearLine = currentLine(bear, costOf(bear), chosen(6, 3))!

  it('guarda una sola pieza como antes', () => {
    const saved = toSavedQuote({ ...bear, title: '' }, [bearLine], 'quoted')
    expect(saved).toMatchObject({
      title: 'Osito',
      customer: 'Ana',
      pieces: 3,
      unitPrice: 6,
      totalPrice: 18,
      priceLabel: 'Precio Regular',
    })
    expect(saved.cost.totalCost).toBeCloseTo(bearLine.cost.totalCost)
  })

  it('junta varias piezas en un solo pedido con sus costos sumados', () => {
    const other = { ...bearLine, key: 'x', name: 'Llavero', quantity: 10, unitPrice: 4, totalPrice: 40, priceLabel: 'Precio Amigo', current: false }
    const saved = toSavedQuote(bear, [other, bearLine], 'sold')
    expect(saved).toMatchObject({
      status: 'sold',
      title: 'Figuras para fiesta',
      pieces: 13,
      totalPrice: 58,
      priceLabel: 'Varios precios',
    })
    expect(saved.unitPrice).toBeCloseTo(58 / 13)
    expect(saved.cost.totalCost).toBeCloseTo(2 * bearLine.cost.totalCost)
    expect(saved.items?.map((item) => [item.name, item.quantity, item.totalPrice])).toEqual([
      ['Llavero', 10, 40],
      ['Osito', 3, 18],
    ])
  })
})
