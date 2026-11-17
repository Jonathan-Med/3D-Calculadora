/** Colores comunes de filamento con su nombre, para describirle al cliente los colores. */
const NAMED_COLORS: [name: string, r: number, g: number, b: number][] = [
  ['blanco', 255, 255, 255],
  ['negro', 20, 20, 20],
  ['gris', 128, 128, 128],
  ['plata', 192, 192, 192],
  ['rojo', 220, 30, 30],
  ['rosa', 245, 140, 180],
  ['naranja', 245, 130, 30],
  ['amarillo', 245, 215, 30],
  ['verde', 40, 160, 60],
  ['verde claro', 150, 210, 90],
  ['azul', 30, 80, 200],
  ['azul claro', 110, 180, 235],
  ['morado', 130, 60, 170],
  ['café', 110, 70, 40],
  ['beige', 225, 205, 165],
  ['dorado', 200, 160, 60],
]

/** "#F72323" → "rojo": el nombre del color común más parecido. */
export function colorName(hex: string): string {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!match) return ''
  const [r, g, b] = match.slice(1).map((part) => Number.parseInt(part, 16))
  let best = ''
  let bestDistance = Infinity
  for (const [name, nr, ng, nb] of NAMED_COLORS) {
    // Distancia con pesos aproximados a cómo el ojo distingue cada canal.
    const distance = 2 * (r - nr) ** 2 + 4 * (g - ng) ** 2 + 3 * (b - nb) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = name
    }
  }
  return best
}

/** ["negro", "blanco", "rojo"] → "negro, blanco y rojo". */
export function joinNames(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))]
  if (unique.length <= 1) return unique[0] ?? ''
  return `${unique.slice(0, -1).join(', ')} y ${unique.at(-1)}`
}
