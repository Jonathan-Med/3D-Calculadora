import { BACKUP_APP, type Backup } from './backupFormat'
import { db, SETTINGS_ID } from './db'

/** Todo lo guardado en este dispositivo, listo para escribirse en un archivo. */
export async function exportBackup(): Promise<Backup> {
  const [row, filaments, extras, quotes] = await Promise.all([
    db.settings.get(SETTINGS_ID),
    db.filaments.toArray(),
    db.extras.toArray(),
    db.quotes.toArray(),
  ])
  if (!row) throw new Error('No hay configuración que respaldar')
  const { id: _id, ...settings } = row
  return {
    app: BACKUP_APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    filaments,
    extras,
    quotes,
  }
}

/** Reemplaza todo lo guardado por el contenido del respaldo. O entra completo o no cambia nada. */
export function importBackup(backup: Backup): Promise<void> {
  return db.transaction('rw', [db.settings, db.filaments, db.extras, db.quotes], async () => {
    await Promise.all([
      db.settings.clear(),
      db.filaments.clear(),
      db.extras.clear(),
      db.quotes.clear(),
    ])
    await db.settings.put({ ...backup.settings, id: SETTINGS_ID })
    await db.filaments.bulkPut(backup.filaments)
    await db.extras.bulkPut(backup.extras)
    await db.quotes.bulkPut(backup.quotes)
  })
}
