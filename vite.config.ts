import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  base: '/nextlight-audio-analyzer/',
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  worker: {
    format: 'es',
    plugins: () => [
      wasm(),
      topLevelAwait(),
    ],
  },
  optimizeDeps: {
    exclude: ['essentia.js'],
  },
})
