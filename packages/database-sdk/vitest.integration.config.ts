import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include:          ['src/__tests__/integration/**/*.test.ts'],
    testTimeout:      30_000,
    hookTimeout:      30_000,
    globalSetup:      [],
    reporter:         ['verbose'],
    env: {
      PG_HOST:       process.env['PG_HOST']       ?? 'localhost',
      PG_PORT:       process.env['PG_PORT']       ?? '5433',
      PG_DATABASE:   process.env['PG_DATABASE']   ?? 'testdb',
      PG_USER:       process.env['PG_USER']       ?? 'testuser',
      PG_PASSWORD:   process.env['PG_PASSWORD']   ?? 'testpass',
      MYSQL_HOST:    process.env['MYSQL_HOST']    ?? 'localhost',
      MYSQL_PORT:    process.env['MYSQL_PORT']    ?? '3307',
      MYSQL_DATABASE:process.env['MYSQL_DATABASE']?? 'testdb',
      MYSQL_USER:    process.env['MYSQL_USER']    ?? 'testuser',
      MYSQL_PASSWORD:process.env['MYSQL_PASSWORD']?? 'testpass',
    },
  },
});
