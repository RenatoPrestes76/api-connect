import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';

const execFileAsync = promisify(execFile);
const IMAGE = 'atlas-api:docker-test';
const CONTAINER = 'atlas_46_32_fail_loud_container';

/**
 * ATLAS 46.32 — Phase 3: `production-secrets.test.ts` unit-tests
 * `assertProductionSecretsConfigured`/`assertProductionCorsConfigured` in
 * isolation. Nothing before this proved the real, built production image
 * actually refuses to boot when those checks fail — 46.31 confirmed this
 * manually (interactively, not as a repeatable test) while root-causing
 * the Docker boot blocker. This is that manual check, captured as a real
 * test: the actual image, `NODE_ENV=production`, missing/invalid
 * configuration, asserting it exits non-zero and never opens the port —
 * and the mirror case, a complete and valid secret set, boots and serves.
 *
 * Requires `docker build -f docker/Dockerfile.api -t atlas-api:docker-test .`
 * to have already run (same convention as graceful-shutdown.test.ts, same
 * reason: an inline rebuild would make this test multi-minute). Skips
 * cleanly, not silently-passes, when the image or Docker itself isn't
 * available.
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

const FULL_PRODUCTION_ENV = (): string[] => [
  '-e',
  'NODE_ENV=production',
  '-e',
  'API_SECRET_KEY=test_secret_46_32',
  '-e',
  'CORS_ALLOWED_ORIGINS=https://app.atlasappruntime.com.br',
  '-e',
  'ADMIN_JWT_SECRET=test_admin_jwt_secret_46_32',
  '-e',
  'PORTAL_JWT_SECRET=test_portal_jwt_secret_46_32',
  '-e',
  'RUNTIME_JWT_SECRET=test_runtime_jwt_secret_46_32',
  '-e',
  'RUNTIME_CERT_SECRET=test_runtime_cert_secret_46_32',
  '-e',
  'CONNECTOR_PACKAGE_SECRET=test_connector_pkg_secret_46_32',
  '-e',
  'MESSAGE_DELIVERY_SECRET=test_message_delivery_secret_46_32',
  '-e',
  'SUPABASE_JWT_SECRET=test_supabase_jwt_secret_46_32',
  '-e',
  `ATLAS_MASTER_KEY=${randomBytes(32).toString('hex')}`,
];

d('ATLAS 46.32 — production fail-loud, real container', () => {
  afterEach(async () => {
    await execFileAsync('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
  }, 20_000);

  it('refuses to boot in NODE_ENV=production with required secrets missing — exits non-zero, never opens the port', async () => {
    await execFileAsync('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
    // DATABASE_URL must point at a genuinely *reachable* database here —
    // confirmed directly that an unreachable one changes what crashes
    // the process first: ControlPlaneStore's own eager, unguarded
    // startup seeding (an unrelated real Prisma query, fired
    // independently of main()'s carefully-ordered secret checks) throws
    // a raw, unformatted stack trace and wins the race, never letting
    // assertProductionSecretsConfigured's clean message run at all —
    // still a correct non-zero exit, just a noisier, less actionable
    // one (see this sprint's Findings). Using the real dev Postgres
    // isolates exactly the property this test targets: the secrets
    // gate itself, independent of DB reachability.
    await execFileAsync('docker', [
      'run',
      '-d',
      '--name',
      CONTAINER,
      '--add-host',
      'host.docker.internal:host-gateway',
      '-e',
      'NODE_ENV=production',
      '-e',
      'API_SECRET_KEY=test_secret_46_32',
      '-e',
      'DATABASE_URL=postgresql://seltriva:seltriva_dev_password@host.docker.internal:5433/seltriva_connect',
      // Deliberately no CORS_ALLOWED_ORIGINS / JWT secrets / master key.
      IMAGE,
    ]);

    // A crash-on-boot process settles into Exited quickly — poll rather
    // than assume a fixed delay is long enough.
    const deadline = Date.now() + 15_000;
    let status = '';
    while (Date.now() < deadline) {
      const { stdout } = await execFileAsync('docker', [
        'inspect',
        '--format',
        '{{.State.Status}}',
        CONTAINER,
      ]);
      status = stdout.trim();
      if (status === 'exited') break;
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(status).toBe('exited');
    const { stdout: exitCodeRaw } = await execFileAsync('docker', [
      'inspect',
      '--format',
      '{{.State.ExitCode}}',
      CONTAINER,
    ]);
    // index.ts's fatal-startup path is a plain console.error (stderr),
    // not the structured logger — `docker logs` merges both streams
    // when run interactively, which is why a manual check always saw
    // it; execFileAsync returns them separately, so both need checking.
    const { stdout, stderr } = await execFileAsync('docker', ['logs', CONTAINER]);
    const logs = `${stdout}${stderr}`;

    expect(Number(exitCodeRaw.trim()), `container logs:\n${logs}`).not.toBe(0);
    expect(logs).toContain('Refusing to start in production');
    // Never a hang, never a silent partial start on the expected port.
    await expect(
      fetch('http://localhost:3001/health', { signal: AbortSignal.timeout(1_000) })
    ).rejects.toThrow();
  }, 30_000);

  it('boots and serves in NODE_ENV=production with a complete, valid secret set', async () => {
    await execFileAsync('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
    await execFileAsync('docker', [
      'run',
      '-d',
      '--name',
      CONTAINER,
      '--add-host',
      'host.docker.internal:host-gateway',
      ...FULL_PRODUCTION_ENV(),
      '-e',
      'DATABASE_URL=postgresql://seltriva:seltriva_dev_password@host.docker.internal:5433/seltriva_connect',
      '-e',
      'API_PORT=3001',
      '-p',
      '3197:3001',
      IMAGE,
    ]);

    const deadline = Date.now() + 20_000;
    let healthy = false;
    let lastBody = '';
    while (Date.now() < deadline) {
      try {
        const res = await fetch('http://localhost:3197/health', {
          signal: AbortSignal.timeout(2_000),
        });
        lastBody = await res.text();
        if (res.status === 200) {
          healthy = true;
          break;
        }
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(healthy, `last /health response: ${lastBody}`).toBe(true);

    const readyRes = await fetch('http://localhost:3197/ready');
    expect(readyRes.status).toBe(200);
  }, 30_000);
});
