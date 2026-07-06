import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     false,
    environment: 'node',
    include:     ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'lcov'],
      include:   ['src/postgresql/**/*.ts'],
      exclude:   ['src/postgresql/__tests__/**', 'src/postgresql/index.ts'],
      thresholds: {
        lines:      90,
        functions:  90,
        branches:   85,
        statements: 90,
      },
    },
  },
  resolve: {
    conditions: ['import', 'node'],
  },
});
