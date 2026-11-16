import { toBlob } from 'html-to-image'

/** Reduce una imagen subida a un PNG pequeño, para guardarla como logo sin llenar el almacenamiento. */
export async function fileToLogo(file: File, maxSide = 256): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('El navegador no permitió procesar la imagen')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/png')
}

/** Convierte un elemento de la página en una imagen PNG nítida. */
export async function renderPng(node: HTMLElement): Promise<Blob> {
  const options = { pixelRatio: 3, backgroundColor: '#ffffff' }
  // Safari puede omitir las imágenes incrustadas en la primera pasada; una pasada previa las deja listas.
  if (node.querySelector('img')) await toBlob(node, options)
  const blob = await toBlob(node, options)
  if (!blob) throw new Error('No se pudo generar la imagen')
  return blob
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
