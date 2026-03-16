import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true // Allows you to test the PWA locally
      },
      manifest: {
        name: 'Routine Tracker',
        short_name: 'Routine',
        description: 'Daily habit and routine tracker',
        theme_color: '#F2F2F7', // iOS background color
        background_color: '#F2F2F7',
        display: 'standalone', // Removes the browser address bar
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})