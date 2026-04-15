import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'stream', 'util', 'process', 'zlib'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  server: {
    port: 3000,
    watch: {
      usePolling: true,
    }
  },
  optimizeDeps: {
    include: ['tslib'],
    force: true
  }
})
