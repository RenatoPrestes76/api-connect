import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // ATLAS 46.31 — the default (10s) hook timeout is tight enough that a
    // handful of real-Docker/real-child-process integration test files
    // (db-real-outage-recovery.test.ts, restart-durability-e2e.test.ts and
    // similar) running concurrently with everything else can occasionally
    // push a completely unrelated file's simple beforeAll/afterAll
    // (server.listen()/close()) past 10s under system load — observed
    // directly running this suite locally. Raised, not removed: a hook that
    // is genuinely stuck should still fail eventually.
    hookTimeout: 30_000,
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
