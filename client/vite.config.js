import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

export const manifest = {
  id: '/',
  name: 'SVPMPC Management System',
  short_name: 'SVPMPC',
  description: 'Attendance and mortuary fund management for Saint Vincent Parish Multi-Purpose Cooperative.',
  lang: 'en',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#f0fdf4',
  theme_color: '#166534',
  icons: [
    { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // Register on page load; updates wait for existing app windows to close.
      injectRegister: 'script',
      registerType: 'prompt',
      manifest,
      includeManifestIcons: false,
      injectManifest: {
        // Cache the public fallback plus the plugin's manifest; no app or API data.
        globPatterns: ['offline.html'],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
