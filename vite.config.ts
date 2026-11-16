import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas para que funcione en GitHub Pages sin importar el nombre del repositorio.
  base: './',
  plugins: [react(), tailwindcss()],
})
