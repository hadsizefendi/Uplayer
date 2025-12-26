// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image', '@nuxt/scripts', '@nuxt/ui'],

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: ''
  },

  ssr: false, // Tauri requires SPA mode

  vite: {
    define: {
      // Buffer polyfill for music-metadata-browser
      global: 'globalThis',
    },
    resolve: {
      alias: {
        buffer: 'buffer/',
      }
    },
    optimizeDeps: {
      include: ['buffer']
    }
  },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
      title: 'Uplayer - Music Player',
      meta: [
        { name: 'description', content: 'Uplayer - Modern desktop music player' },
        { name: 'theme-color', content: '#000000' }
      ]
    },
    rootId: '__up',
    rootTag: 'upcreate'
  }
})
