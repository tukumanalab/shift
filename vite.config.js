import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    'process.env.GOOGLE_APPS_SCRIPT_URL': JSON.stringify(process.env.GOOGLE_APPS_SCRIPT_URL)
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  }
})