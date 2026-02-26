import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['adbzero_logo.webp', 'favicon.svg'],
      manifest: {
        name: 'ADBZero',
        short_name: 'ADBZero',
        description: 'Gestisci il tuo Android direttamente dal browser',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          {
            src: 'adbzero_logo.webp',
            sizes: '192x192',
            type: 'image/webp'
          },
          {
            src: 'adbzero_logo.webp',
            sizes: '512x512',
            type: 'image/webp'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    exclude: ['@aspect/aspect-lib']
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react'
          }
          // Animation library
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion'
          }
          // ADB/Scrcpy stack
          if (id.includes('node_modules/@yume-chan')) {
            return 'vendor-adb'
          }
          // Supabase backend
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase'
          }
          // Icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }
          // Charts library (recharts is large)
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts'
          }
          // Split each locale into its own chunk for lazy loading
          if (id.includes('/src/locales/') && !id.includes('index.ts')) {
            const match = id.match(/\/src\/locales\/([a-z]{2}(?:-[A-Z]{2})?)\.ts/)
            if (match) {
              return `locale-${match[1]}`
            }
          }
        }
      }
    }
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    }
  }
})

