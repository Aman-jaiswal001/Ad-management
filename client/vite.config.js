
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL

  return {
    // Tailwind 3 is wired through postcss.config.js; no Vite plugin is needed.
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiUrl || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})

