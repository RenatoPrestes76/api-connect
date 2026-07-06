import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     false,
    environment: 'node',
    include:     ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'lcov'],
      include:   ['src/**/*.ts'],
      exclude:   ['src/**/__tests__/**', 'src/index.ts', 'src/**/index.ts'],
      thresholds: {
        lines:      92,
        functions:  92,
        branches:   88,
        statements: 92,
      },
    },
  },
});
