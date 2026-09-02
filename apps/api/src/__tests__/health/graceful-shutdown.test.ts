import { describe, it, expect, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const IMAGE = 'atlas-api:docker-test';
const CONTAINER = 'atlas_46_32_graceful_shutdown_container';

/**
 * ATLAS 46.32 — Phase 4: proves index.ts's shutdown handler (SIGTERM ->
 * server.close() -> disconnectDB() -> process.exit(0), 10s forced-exit
 * fallback) actually takes the graceful path under a REAL SIGTERM.
 *
 * This is deliberately a Docker-based test, not a raw
 * `child_process.spawn(...).kill('SIGTERM')` against the host Node
 * process (the more obvious approach, and the one
 * restart-durability-e2e.test.ts uses for its own, different concern).
 * On Windows — this repo's primary dev environment — Node's SIGTERM
 * emulation does not reliably reach a registered `process.on('SIGTERM')`
 * handler; `child.kill('SIGTERM')` there just terminates the process,
 * which is indistinguishable from failure. Confirmed directly: the exact
 * same handler, run for real inside the Linux container this image
 * actually ships (`docker stop`, which sends a genuine SIGTERM to PID 1),
 * exits cleanly (code 0) in well under a second. Docker gives real POSIX
 * signal semantics regardless of host OS, and is the actual production
 * shape (Render/any container platform stopping the container) this
 * property needs to hold for.
 *
 * Requires `docker build -f docker/Dockerfile.api -t atlas-api:docker-test .`
 * to have already run — matching this repo's established convention
 * (restart-durability-e2e.test.ts, db-real-outage-recovery.test.ts) of
 * production-smoke tests exercising a pre-built real artifact rather than
 * rebuilding inline (a full image build is multi-minute even with a warm
 * layer cache — inline-rebuilding on every test run would make the whole
 * suite unpredictably slow). CI builds this exact tag before `pnpm test`
 * (see .github/workflows/ci.yml). Skips itself — with a clear reason, not
 * a silent pass — if either Docker itself or this specific image tag
 * isn't available, rather than masking a real failure.
 */
async function dockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}']);
    return true;
  } catch {
    return false;
  }
}

async function imageAvailable(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['image', 'inspect', IMAGE]);
    return true;
  } catch {
    return false;
  }
}

const canRun = (await dockerAvailable()) && (await imageAvailable());
const d = canRun ? describe : describe.skip;

d('ATLAS 46.32 — graceful shutdown, real container, real SIGTERM', () => {
  afterAll(async () => {
    await execFileAsync('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
  }, 20_000);

  it('docker stop delivers a real SIGTERM; the process exits cleanly (code 0), well inside the 10s window', async () => {
    await execFileAsync('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
    // Needs a reachable DATABASE_URL — /health's pingDB() check (46.31)
    // otherwise keeps reporting degraded/503 forever, and the
    // container's own HEALTHCHECK (which this test waits on) would
    // never turn healthy. Reaches the host's Postgres (docker-compose's
    // dev database, mapped to host port 5433, or CI's GitHub Actions
    // service on the same port — either way it's the runner/host's
    // localhost) via `host.docker.internal`, not a hardcoded
    // docker-compose network name — compose auto-names that network
    // after the project directory, which differs between this
    // checkout and CI's. `--add-host` makes the alias work on Linux
    // (CI) too, not just Docker Desktop, where it's automatic.
    await execFileAsync('docker', [
      'run',
      '-d',
      '--name',
      CONTAINER,
      '--add-host',
      'host.docker.internal:host-gateway',
      '-e',
      'NODE_ENV=development',
      '-e',
      'API_SECRET_KEY=test_secret_46_32_shutdown',
      '-e',
      'API_PORT=3001',
      '-e',
      'DATABASE_URL=postgresql://seltriva:seltriva_dev_password@host.docker.internal:5433/seltriva_connect',
      IMAGE,
    ]);

    // Wait for the container's own HEALTHCHECK to report healthy before
    // stopping it — stopping mid-boot wouldn't prove anything about the
    // steady-state shutdown path.
    const deadline = Date.now() + 30_000;
    let healthy = false;
    while (Date.now() < deadline) {
      const { stdout } = await execFileAsync('docker', [
        'inspect',
        '--format',
        '{{.State.Health.Status}}',
        CONTAINER,
      ]);
      if (stdout.trim() === 'healthy') {
        healthy = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    expect(healthy, 'expected the container to report healthy before shutdown').toBe(true);

    const start = Date.now();
    await execFileAsync('docker', ['stop', '-t', '10', CONTAINER]);
    const elapsedMs = Date.now() - start;

    const { stdout: exitCodeRaw } = await execFileAsync('docker', [
      'inspect',
      '--format',
      '{{.State.ExitCode}}',
      CONTAINER,
    ]);
    const { stdout: logs } = await execFileAsync('docker', ['logs', CONTAINER]);

    expect(Number(exitCodeRaw.trim()), `container logs:\n${logs}`).toBe(0);
    // Comfortably inside the 10s forced-exit fallback in index.ts —
    // proves the graceful path was taken, not the timeout racing it.
    expect(elapsedMs).toBeLessThan(9_000);
    expect(logs).toContain('Received SIGTERM');
    expect(logs).toContain('API server stopped');
  }, 60_000);
});
