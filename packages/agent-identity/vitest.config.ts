import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     false,
    environment: 'node',
    include:     ['src/**/__tests__/**/*.test.ts'],
    testTimeout: 10_000,
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'lcov'],
      include:   ['src/**/*.ts'],
      exclude:   ['src/**/__tests__/**', 'src/index.ts'],
      thresholds: {
        lines:      95,
        functions:  95,
        branches:   90,
        statements: 95,
      },
    },
  },
});
