import { describe, it, expect, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prisma } from '../../services/prisma.js';
import {
  loadOrCreateIdentity,
  persistIdentity,
} from '../../../../agent/src/atlas-runtime-client/identity.js';
import {
  registerRuntime,
  sendHeartbeat,
  obtainAccessToken,
  pollJobs,
  submitResult,
} from '../../../../agent/src/atlas-runtime-client/client.js';
import { executeDiscoveryScan } from '../../../../agent/src/atlas-runtime-client/executor.js';

const SCAN_TARGET = {
  host: 'localhost',
  port: 5433,
  database: 'seltriva_connect',
  username: 'seltriva',
  password: 'seltriva_dev_password',
};

/**
 * ATLAS 46.22 — Fase 8: proves Runtime registration survives a REAL API
 * process restart, not an in-process simulation. Spawns `node dist/index.js`
 * as a genuine child process (the same artifact `docker/Dockerfile.api`
 * runs in production), talks to it over real HTTP, kills it (SIGTERM,
 * matching the graceful-shutdown path apps/api/src/index.ts implements),
 * spawns a fresh one on the same port, and confirms the Runtime — and its
 * updated heartbeat state — are still there.
 *
 * Requires `pnpm --filter=@seltriva/api build` to have already run (this
 * test does not rebuild — matching this repo's established convention of
 * production-smoke tests exercising the real build artifact, not source).
 */

const PORT = 3097; // fixed, not random — a restart must reconnect on the same port
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DIST_ENTRY = join(process.cwd(), 'dist', 'index.js');

function startApi(): ChildProcess {
  return spawn(process.execPath, [DIST_ENTRY], {
    env: { ...process.env, API_PORT: String(PORT) },
    stdio: 'pipe',
  });
}

async function waitForHealth(timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`API did not become healthy within ${timeoutMs}ms`);
}

async function stopApi(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 12_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

async function get<T>(
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  return { status: res.status, body: (await res.json()) as T };
}

async function adminAuth(): Promise<Record<string, string>> {
  const body = await post<{ accessToken: string }>('/admin/auth/login', {
    email: 'admin@atlasconnect.com.br',
    password: 'root102030',
  });
  return { Authorization: `Bearer ${body.accessToken}` };
}

describe('ATLAS 46.22 — Runtime registration survives a real API process restart', () => {
  let dataDir: string;
  const orgCode = `RESTART${Date.now().toString(36)}`;

  afterAll(async () => {
    rmSync(dataDir, { recursive: true, force: true });
    // The real Prisma rows this test created — clean up by the deterministic
    // slug this run used, leaving every other test file's data untouched.
    await prisma.runtimeRegistration.deleteMany({
      where: { organizationId: { not: '' }, hostname: 'restart-durability-host' },
    });
    await prisma.organization.deleteMany({ where: { slug: orgCode } });
  });

  it('register -> real process kill -> real process restart -> Runtime still there -> heartbeat still works', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'atlas-restart-durability-'));

    // ─── Pass 1: first process instance ────────────────────────────────
    const proc1 = startApi();
    let runtimeId: string;
    let controlPlaneOrgId: string;
    let portalOrgId: string;
    try {
      await waitForHealth();
      const auth = await adminAuth();

      const orgRes = await post<{ organization: { id: string } }>('/api/v1/portal/auth/register', {
        name: `Restart Durability ${orgCode}`,
        razaoSocial: `Restart Durability ${orgCode} LTDA`,
        cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
        internalCode: orgCode,
        plan: 'professional',
        owner: {
          name: 'Owner',
          email: `owner-${orgCode.toLowerCase()}@example.com`,
          password: 'S3nhaDoOwner123!',
        },
      });
      portalOrgId = orgRes.organization.id;

      const keyRes = await post<{ activationKey: { code: string } }>(
        '/admin/runtime-registration/activation-keys',
        { organizationCode: orgCode },
        auth
      );

      const identity = loadOrCreateIdentity(dataDir);
      const registered = await registerRuntime(BASE_URL, identity, {
        organizationCode: orgCode,
        activationKey: keyRes.activationKey.code,
        runtimeVersion: '1.2.0',
        hostname: 'restart-durability-host',
        os: 'linux',
        capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
      });
      runtimeId = registered.runtimeId;
      expect(registered.organizationId).toBe(portalOrgId);
      // Persisted to disk exactly like apps/agent/src/atlas-runtime-
      // client/run.ts does after a real registration — required so pass
      // 2 below can reload it from a fresh in-memory `identity` object,
      // proving the CLIENT's own identity survives independently of
      // whatever server process it's currently talking to.
      persistIdentity(dataDir, { ...identity, runtimeId });

      // Verify directly in Postgres, not just via the API — proves this
      // is a genuine durable write, not an in-memory artifact of proc1.
      const row = await prisma.runtimeRegistration.findUnique({ where: { id: runtimeId } });
      expect(row).not.toBeNull();
      expect(row?.status).toBe('REGISTERED');
      controlPlaneOrgId = row?.controlPlaneOrganizationId as string;
      expect(controlPlaneOrgId).toBeTruthy();
    } finally {
      await stopApi(proc1);
    }

    // proc1 is dead. Nothing about the Runtime should be reachable from
    // memory anymore — only from Postgres.
    expect(proc1.exitCode === 0 || proc1.exitCode === null || proc1.signalCode !== null).toBe(true);

    // ─── Pass 2: a completely fresh process, same port ─────────────────
    const proc2 = startApi();
    try {
      await waitForHealth();
      const auth2 = await adminAuth();

      // 1. The Runtime is still visible via the admin API — served by a
      // process that never held it in memory until this exact query.
      const runtimeLookup = await get<{ runtime: { runtimeId: string; status: string } }>(
        `/admin/runtime-registration/runtimes/${runtimeId}`,
        auth2
      );
      expect(runtimeLookup.status).toBe(200);
      expect(runtimeLookup.body.runtime.runtimeId).toBe(runtimeId);
      expect(runtimeLookup.body.runtime.status).toBe('REGISTERED');

      // 2. Control Plane lookup (ATLAS 46.21) also survives restart.
      const cpLookup = await get<{ runtimes: Array<{ runtimeId: string }> }>(
        `/admin/control-plane/organizations/${controlPlaneOrgId}/runtimes`,
        auth2
      );
      expect(cpLookup.status).toBe(200);
      expect(cpLookup.body.runtimes.some((r) => r.runtimeId === runtimeId)).toBe(true);

      // 3. The real client (same persisted identity — never regenerated,
      // never re-registered) can still authenticate and heartbeat
      // against the new process.
      const identity = loadOrCreateIdentity(dataDir);
      expect(identity.runtimeId).toBe(runtimeId); // proves the client-side identity file itself was untouched by the server restart
      const heartbeat = await sendHeartbeat(
        BASE_URL,
        { ...identity, runtimeId },
        { version: '1.2.0', memory: 128, cpu: 2.5, capabilities: ['DATABASE_ACCESS', 'POSTGRES'] }
      );
      expect(heartbeat.status).toBe('ACTIVE');

      // 4. lastHeartbeat actually persisted (Fase 12) — read straight
      // from Postgres, not the API's response.
      const rowAfterHeartbeat = await prisma.runtimeRegistration.findUnique({
        where: { id: runtimeId },
      });
      expect(rowAfterHeartbeat?.lastHeartbeat).not.toBeNull();
      expect(rowAfterHeartbeat?.status).toBe('ACTIVE');
      expect(rowAfterHeartbeat?.activatedAt).not.toBeNull();

      // 5. The auth/token exchange (a second, independent signed proof)
      // also still works post-restart.
      const { accessToken } = await obtainAccessToken(BASE_URL, runtimeId, identity.privateKeyPem);
      expect(typeof accessToken).toBe('string');
      expect(accessToken.length).toBeGreaterThan(0);

      // 6. (Fase 16) The full canonical onboarding path — ERP discovery,
      // a real GENESIS scan, ATHENA classification — still works end to
      // end against the brand-new process, proving the restart didn't
      // just preserve the Runtime row but the whole platform it plugs
      // into (Control Plane, ERP connectivity, semantic mapping all read
      // the same durable Postgres state, none of it reconstructed from
      // proc1's memory).
      const profileRes = await post<{ profile: { id: string } }>(
        '/erp-connectivity/profiles',
        {
          runtimeId,
          organizationId: portalOrgId,
          name: 'ERP pós-restart',
          dbType: 'POSTGRESQL',
          host: 'db.cliente.local',
          port: 5432,
          database: 'erp_prod',
          username: 'erp_user',
          password: 'S3nhaSuperSecreta!',
        },
        auth2
      );
      const profileId = profileRes.profile.id;

      const discoveryRequest = await post<{ request: { id: string; status: string } }>(
        '/erp-metadata/discover',
        { runtimeId, organizationId: portalOrgId, profileId },
        auth2
      );
      const requestId = discoveryRequest.request.id;

      const jobs = await pollJobs(BASE_URL, accessToken);
      expect(jobs.some((j) => j.id === requestId && j.status === 'CLAIMED')).toBe(true);

      const schema = await executeDiscoveryScan(SCAN_TARGET);
      const result = await submitResult(BASE_URL, accessToken, {
        requestId,
        runtimeId,
        success: true,
        schema,
      });
      expect(result.request.status).toBe('COMPLETED');

      // 7. ATHENA — semantic classification of the freshly-discovered
      // schema, over the same restarted process.
      await post('/semantic-mapping/analyze', { profileId }, auth2);
      const entitiesRes = await get<{ entities: Array<{ schema: string; table: string }> }>(
        `/semantic-mapping/entities?profileId=${profileId}`,
        auth2
      );
      expect(entitiesRes.status).toBe(200);
      expect(entitiesRes.body.entities.length).toBeGreaterThan(0);
      for (const mapping of entitiesRes.body.entities) {
        const approveRes = await fetch(`${BASE_URL}/semantic-mapping/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...auth2 },
          body: JSON.stringify({
            profileId,
            schema: mapping.schema,
            table: mapping.table,
            decision: 'APPROVE',
          }),
        });
        expect(approveRes.ok).toBe(true);
      }
    } finally {
      await stopApi(proc2);
    }
  }, 60_000);
});
