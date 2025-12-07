import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

// Custom plugin to handle opencascade.js WASM file imports
function opencascadeWasmPlugin(): Plugin {
  return {
    name: 'opencascade-wasm',
    enforce: 'pre',
    resolveId(id, importer) {
      // When opencascade.js index.js imports the .wasm file, return it as a URL asset
      if (id.endsWith('opencascade.wasm.wasm')) {
        // Return a virtual module ID that we'll handle in load()
        return '\0opencascade-wasm-url';
      }
      return null;
    },
    load(id) {
      // Provide the URL to the WASM file from the public folder
      if (id === '\0opencascade-wasm-url') {
        // Serve from public/wasm folder - Vite serves public folder at root
        return `export default "/wasm/opencascade.wasm.wasm";`;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    opencascadeWasmPlugin(),
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 3000,
    fs: {
      // Allow serving files from node_modules
      allow: ['../..', '../../node_modules'],
    },
  },
  optimizeDeps: {
    // Don't pre-bundle these - they have complex WASM loading
    exclude: ['opencascade.js', '@salusoft89/planegcs'],
  },
  assetsInclude: ['**/*.wasm'],
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
  build: {
    rollupOptions: {
      external: (id) => {
        if (id.endsWith('.wasm')) return true;
        return false;
      },
    },
  },
});
