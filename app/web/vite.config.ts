import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    alias: {
      '@vibecad/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@vibecad/kernel-wasm': path.resolve(__dirname, '../../packages/kernel-wasm/src/index.ts'),
    },
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
