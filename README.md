# Calculadora 3D

Calculadora de costos y precios para impresión 3D. Dice cuánto cuesta realmente una pieza
(material, luz, desgaste de la impresora, repuestos, fallos, extras y mano de obra), desde qué
precio es rentable y cuánto cobrar. También calcula lotes, piezas por rollo y genera una imagen
de cotización para mandarle al cliente.

Funciona entera en el navegador: no hay servidor ni cuentas, y los datos se guardan solo en el
dispositivo donde se usa. Se puede instalar como app en el celular o la PC (desde el menú del
navegador, "Instalar" o "Agregar a pantalla de inicio") y abre sin internet.

## Desarrollo

Requiere Node 24 o posterior.

```
npm install
npm run dev      # servidor local
npm test         # pruebas del motor de costos
npm run build    # versión para publicar, en dist/
npm run icons    # regenera los íconos de la app a partir de public/favicon.svg
```

En PowerShell con la ejecución de scripts deshabilitada, usa `npm.cmd` en lugar de `npm`.

## Estructura

- `src/domain/`: el motor de costos y precios. Funciones puras, con pruebas.
- `src/db/`: lo único que toca el almacenamiento del navegador (IndexedDB con Dexie).
- `src/features/`: las pantallas (Cotizar, Historial y Configuración).
- `src/components/` y `src/lib/`: componentes de interfaz y utilidades compartidas.

## Publicación

Cada push a `main` corre las pruebas y publica en GitHub Pages con
`.github/workflows/deploy.yml`.
