import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiServer } from '../../server.js';
import { prisma } from '../../services/prisma.js';
import { get, post, superAdminAuth } from '../canonical-model/helpers.js';
import { loadOrCreateIdentity } from '../../../../agent/src/atlas-runtime-client/identity.js';
import {
  registerRuntime,
  sendHeartbeat,
} from '../../../../agent/src/atlas-runtime-client/client.js';
import {
  LIVENESS_ONLINE_WINDOW_MS,
  LIVENESS_STALE_WINDOW_MS,
} from '../../modules/runtime-registration/liveness.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * ATLAS 46.25 — Part N/H: liveness is computed *per Runtime*, never a
 * global or shared value, and the new list/summary filters (Part B/C)
 * cannot be used to see or count another client's Runtimes.
 *
 * Org/Tenant/Activation-Key isolation itself is already exhaustively
 * covered in `onboarding-isolation.test.ts` (46.24) and
 * `tenant-association.test.ts` (46.23) — not repeated here. This file is
 * specifically about the liveness/summary/filter surface this sprint adds.
 */

async function registerAndActivate(
  baseUrl: string,
  auth: Record<string, string>,
  label: string
): Promise<{
  controlPlaneOrganizationId: string;
  runtimeId: string;
  identity: { fingerprint: string; publicKeyPem: string; privateKeyPem: string };
}> {
  const orgCode = `${label}${Date.now().toString(36)}`;
  const orgRes = await post<{ organization: { controlPlaneOrganizationId: string } }>(
    baseUrl,
    '/api/v1/portal/auth/register',
    {
      name: `Runtime Isolation ${orgCode}`,
      razaoSocial: `Runtime Isolation ${orgCode} LTDA`,
      cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
      internalCode: orgCode,
      plan: 'professional',
      owner: {
        name: 'Owner',
        email: `owner-${orgCode.toLowerCase()}@example.com`,
        password: 'S3nhaDoOwner123!',
      },
    }
  );
  const keyRes = await post<{ activationKey: { code: string } }>(
    baseUrl,
    '/admin/runtime-registration/activation-keys',
    { organizationCode: orgCode },
    auth
  );
  const dir = mkdtempSync(join(tmpdir(), `atlas-runtime-iso-${label}-`));
  let registered: { runtimeId: string };
  const identity = loadOrCreateIdentity(dir);
  try {
    registered = await registerRuntime(baseUrl, identity, {
      organizationCode: orgCode,
      activationKey: keyRes.body.activationKey.code,
      runtimeVersion: '1.2.0',
      hostname: `runtime-iso-${label}-host`,
      os: 'linux',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  await sendHeartbeat(
    baseUrl,
    { ...identity, runtimeId: registered.runtimeId },
    { version: '1.2.0', memory: 100, cpu: 1 }
  );
  return {
    controlPlaneOrganizationId: orgRes.body.organization.controlPlaneOrganizationId,
    runtimeId: registered.runtimeId,
    identity,
  };
}

describe('ATLAS 46.25 — multi-client liveness and filter isolation (Part N/H)', () => {
  let server: Server;
  let baseUrl: string;
  let auth: Record<string, string>;
  const ORG_PREFIX = 'RTISO';

  beforeAll(async () => {
    server = createApiServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    auth = await superAdminAuth(baseUrl);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    await prisma.runtimeRegistration.deleteMany({
      where: { hostname: { startsWith: `runtime-iso-${ORG_PREFIX}` } },
    });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: ORG_PREFIX } } });
  });

  it("Client A moving ONLINE -> STALE -> OFFLINE never changes Client B's independently-ONLINE state, its scoped summary, or its filtered list results", async () => {
    const clientA = await registerAndActivate(baseUrl, auth, `${ORG_PREFIX}A`);
    const clientB = await registerAndActivate(baseUrl, auth, `${ORG_PREFIX}B`);

    // ─── Round 1: both ONLINE ───────────────────────────────────────────
    const bothOnline = await get<{
      runtime: { liveness: string };
    }>(baseUrl, `/admin/runtime-registration/runtimes/${clientA.runtimeId}`, auth);
    expect(bothOnline.body.runtime.liveness).toBe('ONLINE');
    const bOnline1 = await get<{ runtime: { liveness: string } }>(
      baseUrl,
      `/admin/runtime-registration/runtimes/${clientB.runtimeId}`,
      auth
    );
    expect(bOnline1.body.runtime.liveness).toBe('ONLINE');

    const summaryB1 = await get<{ total: number; online: number; stale: number; offline: number }>(
      baseUrl,
      `/admin/runtime-registration/summary?controlPlaneOrganizationId=${clientB.controlPlaneOrganizationId}`,
      auth
    );
    expect(summaryB1.body).toEqual({ total: 1, online: 1, stale: 0, offline: 0 });

    // ─── Round 2: A -> STALE, B untouched ───────────────────────────────
    await prisma.runtimeRegistration.update({
      where: { id: clientA.runtimeId },
      data: { lastHeartbeat: new Date(Date.now() - (LIVENESS_ONLINE_WINDOW_MS + 1_000)) },
    });

    const aStale = await get<{ runtime: { liveness: string } }>(
      baseUrl,
      `/admin/runtime-registration/runtimes/${clientA.runtimeId}`,
      auth
    );
    expect(aStale.body.runtime.liveness).toBe('STALE');
    const bStillOnline1 = await get<{ runtime: { liveness: string } }>(
      baseUrl,
      `/admin/runtime-registration/runtimes/${clientB.runtimeId}`,
      auth
    );
    expect(bStillOnline1.body.runtime.liveness).toBe('ONLINE');

    const summaryB2 = await get<{ total: number; online: number; stale: number; offline: number }>(
      baseUrl,
      `/admin/runtime-registration/summary?controlPlaneOrganizationId=${clientB.controlPlaneOrganizationId}`,
      auth
    );
    expect(summaryB2.body).toEqual({ total: 1, online: 1, stale: 0, offline: 0 });

    const listOnlineNow = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      '/admin/runtime-registration/runtimes?liveness=ONLINE',
      auth
    );
    expect(listOnlineNow.body.runtimes.some((r) => r.runtimeId === clientB.runtimeId)).toBe(true);
    expect(listOnlineNow.body.runtimes.some((r) => r.runtimeId === clientA.runtimeId)).toBe(false);

    // ─── Round 3: A -> OFFLINE, B still untouched ───────────────────────
    await prisma.runtimeRegistration.update({
      where: { id: clientA.runtimeId },
      data: { lastHeartbeat: new Date(Date.now() - (LIVENESS_STALE_WINDOW_MS + 1_000)) },
    });

    const aOffline = await get<{ runtime: { liveness: string } }>(
      baseUrl,
      `/admin/runtime-registration/runtimes/${clientA.runtimeId}`,
      auth
    );
    expect(aOffline.body.runtime.liveness).toBe('OFFLINE');
    const bStillOnline2 = await get<{ runtime: { liveness: string } }>(
      baseUrl,
      `/admin/runtime-registration/runtimes/${clientB.runtimeId}`,
      auth
    );
    expect(bStillOnline2.body.runtime.liveness).toBe('ONLINE');

    const summaryA = await get<{ total: number; online: number; stale: number; offline: number }>(
      baseUrl,
      `/admin/runtime-registration/summary?controlPlaneOrganizationId=${clientA.controlPlaneOrganizationId}`,
      auth
    );
    expect(summaryA.body).toEqual({ total: 1, online: 0, stale: 0, offline: 1 });
    const summaryB3 = await get<{ total: number; online: number; stale: number; offline: number }>(
      baseUrl,
      `/admin/runtime-registration/summary?controlPlaneOrganizationId=${clientB.controlPlaneOrganizationId}`,
      auth
    );
    expect(summaryB3.body).toEqual({ total: 1, online: 1, stale: 0, offline: 0 });

    // The unscoped global summary reflects both, additively — never a
    // stored/cached counter, just the same live computation over more rows.
    const summaryGlobal = await get<{
      total: number;
      online: number;
      stale: number;
      offline: number;
    }>(baseUrl, '/admin/runtime-registration/summary', auth);
    expect(summaryGlobal.body.online).toBeGreaterThanOrEqual(summaryB3.body.online);
    expect(summaryGlobal.body.offline).toBeGreaterThanOrEqual(summaryA.body.offline);
  });

  it("a Runtime's liveness filter cannot be used to enumerate another Organization's Runtimes — organizationId scoping and liveness filtering compose safely together", async () => {
    const clientA = await registerAndActivate(baseUrl, auth, `${ORG_PREFIX}FA`);
    const clientB = await registerAndActivate(baseUrl, auth, `${ORG_PREFIX}FB`);

    // Both ONLINE; scoping to A + liveness=ONLINE must never surface B.
    const scoped = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/runtime-registration/runtimes?controlPlaneOrganizationId=${clientA.controlPlaneOrganizationId}&liveness=ONLINE`,
      auth
    );
    expect(scoped.body.runtimes.map((r) => r.runtimeId)).toEqual([clientA.runtimeId]);
    expect(scoped.body.runtimes.some((r) => r.runtimeId === clientB.runtimeId)).toBe(false);
  });
});
