import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'tandem-trails-browser-entry',
    // Opening the source HTML from disk should only show the launch instructions.
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{
        tag: 'script',
        attrs: { type: 'module', src: '/src/web/main.tsx' },
        injectTo: 'body',
      }],
    },
  }],
  server: {
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
    },
  },
  build: { outDir: 'dist/web' },
});
