import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas para que funcione en GitHub Pages sin importar el nombre del repositorio.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // App instalable en el celular o la PC, que abre sin internet. Los íconos se generan con
    // `npm run icons` a partir de public/favicon.svg.
    VitePWA({
      registerType: 'autoUpdate',
      includeManifestIcons: false,
      manifest: {
        name: 'Calculadora 3D',
        short_name: 'Calculadora 3D',
        description: 'Calcula cuánto cuesta una impresión 3D y cuánto cobrarla.',
        lang: 'es-MX',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f6f8',
        theme_color: '#0f766e',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
})
