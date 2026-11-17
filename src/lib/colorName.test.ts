import { describe, expect, it } from 'vitest'
import { colorName, joinNames } from './colorName'

describe('colorName', () => {
  it('nombra los colores de un G-code real de Bambu Studio', () => {
    expect(colorName('#4D3324')).toBe('café')
    expect(colorName('#161616')).toBe('negro')
    expect(colorName('#FFFFFF')).toBe('blanco')
    expect(colorName('#F72323')).toBe('rojo')
  })

  it('no inventa nombre si no es un color válido', () => {
    expect(colorName('')).toBe('')
    expect(colorName('rojo')).toBe('')
  })
})

describe('joinNames', () => {
  it('une como se dice en español y sin repetir', () => {
    expect(joinNames(['negro', 'blanco', 'rojo'])).toBe('negro, blanco y rojo')
    expect(joinNames(['blanco', 'blanco'])).toBe('blanco')
    expect(joinNames(['blanco', '', 'rojo'])).toBe('blanco y rojo')
    expect(joinNames([])).toBe('')
  })
})
