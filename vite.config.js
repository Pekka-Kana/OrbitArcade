import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Served from https://pekka-kana.github.io/OrbitArcade/ — asset URLs
  // need the repo subpath prefix
  base: '/OrbitArcade/',
  resolve: {
    alias: {
      // satellite.js's exports map only exposes its root, and the root
      // re-exports an optional WASM build whose emscripten loader breaks
      // Vite's worker bundling (top-level await, node: imports). Alias the
      // dist dir so our deep imports of the pure-JS modules resolve.
      'satellite.js/dist': fileURLToPath(
        new URL('./node_modules/satellite.js/dist', import.meta.url)
      ),
    },
  },
});
