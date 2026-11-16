import { Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { Button, Card } from '../../components/ui'
import { exportBackup, importBackup } from '../../db/backup'
import { parseBackup, type Backup } from '../../db/backupFormat'
import { plural } from '../../lib/format'
import { downloadBlob } from '../../lib/download'

/** Exportar e importar todo lo guardado: la única forma de pasar datos entre celular y computadora. */
export function BackupCard() {
  const [pending, setPending] = useState<Backup | null>(null)
  const [message, setMessage] = useState('')

  const save = async () => {
    try {
      const backup = await exportBackup()
      const day = backup.exportedAt.slice(0, 10)
      downloadBlob(
        new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
        `calculadora-3d-respaldo-${day}.json`,
      )
      setMessage('Respaldo descargado. Guárdalo donde no se pierda.')
    } catch {
      setMessage('No se pudo crear el respaldo.')
    }
  }

  const read = async (file: File | undefined) => {
    if (!file) return
    setMessage('')
    try {
      const backup = parseBackup(JSON.parse(await file.text()))
      if (!backup) {
        setMessage('Ese archivo no es un respaldo de esta calculadora.')
        return
      }
      setPending(backup)
    } catch {
      setMessage('No se pudo leer el archivo.')
    }
  }

  const restore = async () => {
    if (!pending) return
    try {
      await importBackup(pending)
      setMessage('Respaldo restaurado.')
    } catch {
      setMessage('No se pudo restaurar. Tus datos siguen como estaban.')
    }
    setPending(null)
  }

  return (
    <Card
      title="Respaldo"
      description="Tus datos viven solo en este dispositivo. Descarga un respaldo para no perderlos o para pasarlos a otro."
    >
      {pending ? (
        <div className="rounded-xl border border-bad bg-bad-soft p-3 text-sm">
          <p className="font-semibold">¿Reemplazar todo lo de este dispositivo?</p>
          <p className="mt-1">
            El respaldo{pending.exportedAt && ` del ${pending.exportedAt.slice(0, 10)}`} trae{' '}
            {plural(pending.quotes.length, 'pedido', 'pedidos')},{' '}
            {plural(pending.filaments.length, 'filamento', 'filamentos')} y su configuración. Lo que
            hay ahora aquí se borra y no se puede recuperar.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void restore()}>Sí, reemplazar</Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()}>
            <Download size={16} aria-hidden /> Descargar respaldo
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2 focus-within:ring-2 focus-within:ring-accent/40">
            <Upload size={16} aria-hidden /> Restaurar respaldo
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                void read(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
        </div>
      )}
      <p className="mt-2 min-h-4 text-xs text-muted" role="status">
        {message}
      </p>
    </Card>
  )
}
