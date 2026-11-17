import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Genera los íconos de la app instalable a partir del logo.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0f766e' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0f766e' } },
  },
  images: ['public/favicon.svg'],
})
