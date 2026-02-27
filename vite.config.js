import { defineConfig }  from 'vite'
import react             from '@vitejs/plugin-react'
import tailwindcss       from '@tailwindcss/vite'     
import { VitePWA }       from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),                                   

    VitePWA({
      registerType: 'autoUpdate',

      /* ── MANIFEST : identité de l'app sur mobile ── */
      manifest: {
        name:             'SmartGuardian',
        short_name:       'SmartGuardian',
        description:      'Télésurveillance cardiovasculaire',
        theme_color:      '#0f172a',
        background_color: '#ffffff',
        display:          'standalone',
        orientation:      'portrait',
        start_url:        '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },

      /* ── WORKBOX : stratégie de cache ── */
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries:    50,
                maxAgeSeconds: 300,
              },
            },
          },
        ],
      },
    }),
  ],
})
