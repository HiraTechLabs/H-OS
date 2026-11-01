import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

/**
 * The shell dev server proxies `/api` to the platform API so the session cookie stays
 * first-party: no CORS, no cross-origin credential handling (SEC-009). JSX is compiled by
 * Vite's built-in TSX transform using the `react-jsx` setting from tsconfig, so no additional
 * React plugin is required (DEC-0004).
 */
export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
