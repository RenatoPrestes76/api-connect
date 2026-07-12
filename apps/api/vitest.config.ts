import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    env: {
      SUPABASE_JWT_SECRET: 'test-only-secret-do-not-use-in-prod',
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/routes/v1/atlas/**/*.ts',
        'src/routes/v1/admin/**/*.ts',
        'src/middleware/agent-auth.ts',
      ],
      exclude: ['src/**/*.test.ts'],
      thresholds: { statements: 90, lines: 90, functions: 88, branches: 85 },
    },
  },
});
