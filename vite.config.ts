import { defineConfig } from 'vite';
import { questionsFor } from './src/server/curriculum.js';
import { GRADE_NAMES } from './src/shared/study.js';

export default defineConfig({
  plugins: [{
    name: 'rally-curriculum',
    resolveId(id) {
      if (id === 'virtual:rally-curriculum') return '\0virtual:rally-curriculum';
    },
    load(id) {
      if (id !== '\0virtual:rally-curriculum') return;
      this.addWatchFile('data/shanghai.sqlite');
      const semesters = Object.fromEntries(GRADE_NAMES.flatMap((name, grade) =>
        name ? [1, 2].map(term => [`${grade}-${term}`, questionsFor({ grade, term })]) : [],
      ));
      return `export default ${JSON.stringify(semesters)}`;
    },
  }, {
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
      '/api/study': 'http://127.0.0.1:3000',
      '/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
    },
  },
  build: { outDir: 'dist/web' },
});
