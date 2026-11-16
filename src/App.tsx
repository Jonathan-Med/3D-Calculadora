import { Calculator, History, Settings as SettingsIcon } from 'lucide-react'
import { Component, useEffect, type ReactNode } from 'react'
import { useExtras, useFilaments, useQuotes, useSettings } from './db/hooks'
import { HistoryPage } from './features/history/HistoryPage'
import { QuotePage } from './features/quote/QuotePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ROUTE_HREF, useHashRoute, type Route } from './lib/useHashRoute'

/** `short` es la etiqueta para celular, donde no caben tres pestañas con el nombre completo. */
const TABS: { route: Route; label: string; short?: string; icon: ReactNode }[] = [
  { route: 'cotizar', label: 'Cotizar', icon: <Calculator size={18} aria-hidden /> },
  { route: 'historial', label: 'Historial', icon: <History size={18} aria-hidden /> },
  {
    route: 'configuracion',
    label: 'Configuración',
    short: 'Ajustes',
    icon: <SettingsIcon size={18} aria-hidden />,
  },
]

export default function App() {
  const route = useHashRoute()

  // Cada sección empieza desde arriba; si no, hereda el desplazamiento de la anterior.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          {/* En celular el título no cabe junto a las pestañas; queda solo para lectores de pantalla. */}
          <h1 className="sr-only text-base font-semibold sm:not-sr-only">Calculadora 3D</h1>
          <nav className="flex flex-1 gap-1 sm:flex-none" aria-label="Secciones">
            {TABS.map((tab) => (
              <a
                key={tab.route}
                href={ROUTE_HREF[tab.route]}
                aria-current={route === tab.route ? 'page' : undefined}
                className={
                  'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium sm:px-3 ' +
                  (route === tab.route
                    ? 'bg-accent-soft text-ink'
                    : 'text-muted hover:bg-surface-2 hover:text-ink')
                }
              >
                {tab.icon}
                {tab.short ? (
                  <>
                    <span className="sm:hidden">{tab.short}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </>
                ) : (
                  tab.label
                )}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 lg:py-6">
        <DataErrorBoundary>
          <Pages route={route} />
        </DataErrorBoundary>
      </main>
    </div>
  )
}

function Pages({ route }: { route: Route }) {
  const settings = useSettings()
  const filaments = useFilaments()
  const catalog = useExtras()
  const quotes = useQuotes()

  if (!settings || !filaments || !catalog || !quotes) {
    return <p className="py-10 text-center text-sm text-muted">Cargando…</p>
  }

  if (route === 'configuracion') {
    return <SettingsPage settings={settings} filaments={filaments} catalog={catalog} />
  }
  if (route === 'historial') {
    return <HistoryPage settings={settings} quotes={quotes} />
  }
  return <QuotePage settings={settings} filaments={filaments} catalog={catalog} />
}

/** Si el navegador no deja abrir la base de datos (modo privado, almacenamiento bloqueado). */
class DataErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-bad bg-bad-soft p-4 text-sm">
        <p className="font-semibold">No se pudieron abrir tus datos</p>
        <p className="mt-1">
          El navegador bloqueó el almacenamiento. Prueba fuera del modo privado o permite que este
          sitio guarde datos, y recarga la página.
        </p>
      </div>
    )
  }
}
