import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/create-session': 'http://localhost:8000',
      '/validate-session': 'http://localhost:8000',
      '/prepare-chat': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
    },
  },
})
