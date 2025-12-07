import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    // Let pnpm workspaces resolve packages through their package.json exports
    preserveSymlinks: true,
  },
  server: {
    port: 3000,
    fs: {
      // Allow serving files from parent directories for WASM files
      allow: ['../..'],
    },
  },
  optimizeDeps: {
    include: ['three'],
    exclude: ['opencascade.js'],
  },
  assetsInclude: ['**/*.wasm'],
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
});
