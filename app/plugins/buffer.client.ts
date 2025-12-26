import { Buffer } from 'buffer'

export default defineNuxtPlugin(() => {
  // Make Buffer available globally for music-metadata-browser
  if (typeof window !== 'undefined') {
    window.Buffer = Buffer
  }
})

// Extend Window interface
declare global {
  interface Window {
    Buffer: typeof Buffer
  }
}
