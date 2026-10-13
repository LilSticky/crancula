import {defineConfig} from 'vitest/config';

/**
 * Node test project for the framework-free domain (`api/`) and the Electron main process (`app/`).
 * Angular specs under `src/` run through `ng test` instead (ADR 7).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/**/*.spec.ts', 'app/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
