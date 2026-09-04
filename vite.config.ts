import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf-8'))
const APP_VERSION: string = pkg.version

/**
 * Genera dist/sw.js a partir de scripts/sw-template.js con la version ya
 * inyectada. El service worker NO vive en public/ a proposito: si estuviera
 * ahi, Vite lo copiaria tal cual (sin la version real), y correriamos el
 * mismo riesgo que se queria evitar -- que el nombre de cache no coincida
 * con lo publicado.
 */
function swVersionado(): Plugin {
  return {
    name: 'sw-versionado',
    closeBundle() {
      const plantilla = readFileSync(
        path.resolve(import.meta.dirname, 'scripts/sw-template.js'),
        'utf-8',
      )
      const contenido = plantilla.replaceAll('__APP_VERSION__', APP_VERSION)
      writeFileSync(path.resolve(import.meta.dirname, 'dist/sw.js'), contenido)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), swVersionado()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    outDir: 'dist',
  },
})
