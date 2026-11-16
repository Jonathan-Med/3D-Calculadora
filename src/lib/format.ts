const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const integer = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 })

export const money = (value: number): string => currency.format(Number.isFinite(value) ? value : 0)

export const grams = (value: number): string => `${integer.format(value)} g`

export const percent = (value: number): string => `${integer.format(value)} %`

/** 3.5 → "3 h 30 min" */
export function duration(hours: number): string {
  const totalMinutes = Math.round((Number.isFinite(hours) && hours > 0 ? hours : 0) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

const dateLong = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' })

/** "16 de noviembre de 2026" */
export const longDate = (date: Date): string => dateLong.format(date)

const dateShort = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

/** "16 nov 2026" */
export const shortDate = (timestamp: number): string => dateShort.format(new Date(timestamp))

const monthLong = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })

/** "2026-11" → "Noviembre de 2026" */
export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const label = monthLong.format(new Date(year, monthNumber - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** "Llaveros de Ñandú" → "llaveros-de-nandu", para nombres de archivo. */
export const slug = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const plural =(count: number, one: string, many: string): string =>
  `${integer.format(count)} ${count === 1 ? one : many}`
