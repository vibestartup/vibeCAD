import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    // In dev mode, use source files for HMR; in production, use dist
    alias: mode === 'development' ? [
      { find: '@vibecad/core', replacement: path.resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: '@vibecad/kernel', replacement: path.resolve(__dirname, '../../packages/kernel/src/index.ts') },
    ] : [],
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
}));
