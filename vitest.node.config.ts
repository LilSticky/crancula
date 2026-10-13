import {defineConfig} from 'vitest/config';

/**
 * Node test project for the framework-free domain (`api/`) and the Electron main process (`app/`).
 * Angular specs under `src/` run through `ng test` instead (ADR 7).
 */
export default defineConfig({
  // `npm run build` emits .js next to the .ts sources of api/ and app/; always test the sources.
  resolve: {extensions: ['.ts', '.mts', '.mjs', '.js', '.json']},
  test: {
    environment: 'node',
    include: ['api/**/*.spec.ts', 'app/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
