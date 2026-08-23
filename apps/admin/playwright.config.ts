import { defineConfig, devices } from '@playwright/test';

/**
 * Sprint 46.16 — real-browser E2E for the Atlas Control Plane.
 * Assumes apps/api (port 3001) and apps/admin (port 3006) are already
 * running via the project's own dev scripts — this config does NOT spawn
 * apps/api itself (a Next.js `webServer` entry only manages one process,
 * and the two apps are independently started by CI/dev workflows already).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env['E2E_ADMIN_URL'] ?? 'http://localhost:3006',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
