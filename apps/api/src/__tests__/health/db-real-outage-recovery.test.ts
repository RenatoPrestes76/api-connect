import { describe, it, expect, afterAll } from 'vitest';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withDockerLock } from './docker-test-lock.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_DIR = path.resolve(__dirname, '../../../../../packages/database');
const DIST_ENTRY = path.resolve(__dirname, '../../../dist/index.js');

/**
 * ATLAS 46.31 — the mocked counterpart (db-unavailable.test.ts) proves the
 * *logic* is right (pingDB() throws -> 503/degraded). It doesn't prove
 * pingDB() itself actually detects a database that was reachable at boot
 * and later genuinely died — that gap is exactly how the bug this file
 * exists to catch was found: starting the real built API (the same
 * dist/index.js docker/Dockerfile.api runs) against a real, separate
 * Postgres container, then stopping that container, and observing /health
 * keep reporting database:"ok" indefinitely (the old code called
 * connectDB()/$connect(), a no-op once already connected — see
 * services/prisma.ts's pingDB() doc comment).
 *
 * Spawns the API as a genuine child process (same pattern as
 * restart-durability-e2e.test.ts) against its own throwaway Postgres
 * container — never the shared dev database other test files depend on,
 * and never mutating this worker's own process.env/module state, so it
 * can't leak into or hang any other test file.
 *
 * Requires `pnpm --filter=@seltriva/api build` to have already run (does
 * not rebuild — matching this repo's established convention for
 * production-smoke tests exercising the real build artifact).
 *
 * Skips itself if the Docker CLI isn't available rather than failing the
 * whole suite — an environment-capability guard, not masking a real
 * application failure (every assertion below still runs, and fails for
 * real, whenever Docker is present).
 */
const CONTAINER = 'atlas_46_31_outage_test_db';
const DB_PORT = 5535;
const DB_URL = `postgresql://seltriva:seltriva_dev_password@localhost:${DB_PORT}/seltriva_connect`;
const API_PORT = 3098;
const BASE_URL = `http://127.0.0.1:${API_PORT}`;

async function dockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}']);
    return true;
  } catch {
    return false;
  }
}

async function waitForPgReady(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await execFileAsync('docker', ['exec', CONTAINER, 'pg_isready', '-U', 'seltriva']);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Postgres container never became ready');
}

async function waitForHealthField(
  predicate: (body: { status: string; checks: { database: string } }) => boolean,
  timeoutMs: number
): Promise<{ status: number; body: { status: string; checks: { database: string } } } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // A per-request timeout matters here specifically: right after the
      // database is stopped, a query already in flight inside the server's
      // handler can take a few seconds to fail (TCP doesn't notice a
      // gracefully-stopped Postgres instantly) — without this, a single
      // slow poll could eat the whole outer deadline and this loop would
      // never get a second attempt.
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(4_000) });
      const body = (await res.json()) as { status: string; checks: { database: string } };
      if (predicate(body)) return { status: res.status, body };
    } catch {
      // API not reachable, or this poll timed out — try again.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

d(
  'ATLAS 46.31 — /health and /ready detect a REAL mid-life database outage, not just a mocked one',
  () => {
    let apiProcess: ChildProcess | undefined;

    afterAll(async () => {
      if (apiProcess && apiProcess.exitCode === null) {
        apiProcess.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          const t = setTimeout(() => {
            apiProcess?.kill('SIGKILL');
            resolve();
          }, 8_000);
          apiProcess?.once('exit', () => {
            clearTimeout(t);
            resolve();
          });
        });
      }
      await execFileAsync('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
    }, 30_000);

    it(
      'healthy at boot -> reports degraded/not_ready DURING a real outage -> recovers once the database returns',
      async () =>
        withDockerLock(async () => {
          await execFileAsync('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
          await execFileAsync('docker', [
            'run',
            '-d',
            '--name',
            CONTAINER,
            '-e',
            'POSTGRES_USER=seltriva',
            '-e',
            'POSTGRES_PASSWORD=seltriva_dev_password',
            '-e',
            'POSTGRES_DB=seltriva_connect',
            '-p',
            `${DB_PORT}:5432`,
            'postgres:16-alpine',
          ]);
          await waitForPgReady();
          await execFileAsync(
            process.platform === 'win32' ? 'npx.cmd' : 'npx',
            ['prisma', 'migrate', 'deploy'],
            {
              cwd: DATABASE_DIR,
              env: { ...process.env, DATABASE_URL: DB_URL },
              shell: process.platform === 'win32',
            }
          );

          apiProcess = spawn(process.execPath, [DIST_ENTRY], {
            env: {
              ...process.env,
              DATABASE_URL: DB_URL,
              API_PORT: String(API_PORT),
              NODE_ENV: 'development',
            },
            stdio: 'pipe',
          });

          const bootHealthy = await waitForHealthField((b) => b.status === 'healthy', 45_000);
          expect(
            bootHealthy,
            'expected the API to boot healthy against the fresh container'
          ).not.toBeNull();
          expect(bootHealthy!.status).toBe(200);
          const readyRes = await fetch(`${BASE_URL}/ready`);
          const readyBody = (await readyRes.json()) as { status: string };
          expect(readyRes.status).toBe(200);
          expect(readyBody.status).toBe('ready');

          await execFileAsync('docker', ['stop', CONTAINER]);

          const degraded = await waitForHealthField((b) => b.checks.database === 'error', 30_000);
          expect(
            degraded,
            'expected /health to eventually detect the real, stopped database'
          ).not.toBeNull();
          expect(degraded!.status).toBe(503);
          expect(degraded!.body.status).toBe('degraded');

          const notReadyRes = await fetch(`${BASE_URL}/ready`);
          const notReadyBody = (await notReadyRes.json()) as {
            status: string;
            checks: { database: string };
          };
          expect(notReadyRes.status).toBe(503);
          expect(notReadyBody.status).toBe('not_ready');
          expect(notReadyBody.checks.database).toBe('error');

          await execFileAsync('docker', ['start', CONTAINER]);
          await waitForPgReady();

          const recovered = await waitForHealthField((b) => b.status === 'healthy', 30_000);
          expect(
            recovered,
            'expected /health to recover once the database came back'
          ).not.toBeNull();
          expect(recovered!.status).toBe(200);
        }),
      600_000
    );
  }
);
