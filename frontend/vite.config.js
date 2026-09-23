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
  build: {
    // Routes are lazy-loaded (see src/App.jsx), so the remaining job here is to keep
    // the shared libraries in their own long-lived chunks instead of one giant file.
    chunkSizeWarningLimit: 1200
  },
  server: {
    port: 3000,
    hmr: {
      port: 3000,
    },
    watch: {
      usePolling: true,
    }
  },
  optimizeDeps: {
    include: ['tslib']
  }
})
