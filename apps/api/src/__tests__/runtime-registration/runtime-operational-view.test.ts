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
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * ATLAS 46.25 — Part A/B/C: the operator-facing Runtime surface.
 *
 *   Part A: GET .../runtimes/:id — one Runtime's full operational view
 *   Part B: GET .../runtimes — filterable by organizationId,
 *           controlPlaneOrganizationId, tenantId, status, liveness
 *   Part C: GET .../summary — total/ONLINE/STALE/OFFLINE, optionally
 *           scoped, always consistent with what the list endpoint itself
 *           would return for the same scope
 *
 * None of this introduces a new persisted column — liveness and the
 * Organization/Tenant summary are computed at read time exactly as
 * ATLAS 46.23/46.24 already established.
 */

async function registerPortalOrgAndRuntime(
  baseUrl: string,
  auth: Record<string, string>,
  label: string
): Promise<{
  controlPlaneOrganizationId: string;
  runtimeId: string;
  privateKeyPem: string;
  runtimeIdentity: { fingerprint: string; publicKeyPem: string; privateKeyPem: string };
}> {
  const orgCode = `${label}${Date.now().toString(36)}`;
  const orgRes = await post<{ organization: { controlPlaneOrganizationId: string } }>(
    baseUrl,
    '/api/v1/portal/auth/register',
    {
      name: `Operational View ${orgCode}`,
      razaoSocial: `Operational View ${orgCode} LTDA`,
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

  const dir = mkdtempSync(join(tmpdir(), `atlas-opview-${label}-`));
  const identity = loadOrCreateIdentity(dir);
  let registered: { runtimeId: string };
  try {
    registered = await registerRuntime(baseUrl, identity, {
      organizationCode: orgCode,
      activationKey: keyRes.body.activationKey.code,
      runtimeVersion: '1.2.0',
      hostname: `opview-${label}-host`,
      os: 'linux',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  return {
    controlPlaneOrganizationId: orgRes.body.organization.controlPlaneOrganizationId,
    runtimeId: registered.runtimeId,
    privateKeyPem: identity.privateKeyPem,
    runtimeIdentity: identity,
  };
}

describe('ATLAS 46.25 — Runtime operational view (Part A/B/C)', () => {
  let server: Server;
  let baseUrl: string;
  let auth: Record<string, string>;
  const ORG_PREFIXES = ['OPVA', 'OPVB', 'OPVFILT'];
  const createdTenantSlugs: string[] = [];

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
    for (const prefix of ORG_PREFIXES) {
      await prisma.runtimeRegistration.deleteMany({
        where: { hostname: { startsWith: `opview-${prefix}` } },
      });
      await prisma.organization.deleteMany({ where: { slug: { startsWith: prefix } } });
    }
    if (createdTenantSlugs.length) {
      await prisma.tenant.deleteMany({ where: { slug: { in: createdTenantSlugs } } });
    }
  });

  it('Part A: GET .../runtimes/:id exposes everything an operator needs, and nothing sensitive', async () => {
    const client = await registerPortalOrgAndRuntime(baseUrl, auth, 'OPVA');
    await sendHeartbeat(
      baseUrl,
      { ...client.runtimeIdentity, runtimeId: client.runtimeId },
      { version: '1.2.0', memory: 128, cpu: 2 }
    );

    const res = await get<{
      runtime: {
        runtimeId: string;
        hostname: string;
        status: string;
        liveness: string;
        lastHeartbeat: string | null;
        activatedAt: string | null;
      };
      organization: { id: string; name: string } | null;
      tenant: { id: string; name: string } | null;
    }>(baseUrl, `/admin/runtime-registration/runtimes/${client.runtimeId}`, auth);

    expect(res.status).toBe(200);
    expect(res.body.runtime.runtimeId).toBe(client.runtimeId);
    expect(res.body.runtime.hostname).toBe('opview-OPVA-host');
    expect(res.body.runtime.status).toBe('ACTIVE');
    expect(res.body.runtime.liveness).toBe('ONLINE');
    expect(res.body.runtime.lastHeartbeat).not.toBeNull();
    expect(res.body.runtime.activatedAt).not.toBeNull();
    expect(res.body.organization?.id).toBe(client.controlPlaneOrganizationId);
    // No Tenant assigned yet in this test — legitimate PENDING state.
    expect(res.body.tenant).toBeNull();

    // Never leaks anything sensitive.
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('PRIVATE KEY');
    expect(raw.toLowerCase()).not.toContain('privatekey');
    expect(raw.toLowerCase()).not.toContain('lastheartbeatsignature');
  });

  it('Part B: the list endpoint filters correctly by organizationId, tenantId, status, and liveness', async () => {
    const clientA = await registerPortalOrgAndRuntime(baseUrl, auth, 'OPVFILT');
    // Second, unrelated Runtime — must never appear in A-scoped queries.
    const clientOther = await registerPortalOrgAndRuntime(baseUrl, auth, 'OPVB');

    await sendHeartbeat(
      baseUrl,
      { ...clientA.runtimeIdentity, runtimeId: clientA.runtimeId },
      { version: '1.2.0', memory: 128, cpu: 2 }
    );
    // clientOther deliberately never heartbeats -> stays OFFLINE (no
    // heartbeat ever recorded).

    // organizationId (control-plane) filter.
    const byOrg = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/runtime-registration/runtimes?controlPlaneOrganizationId=${clientA.controlPlaneOrganizationId}`,
      auth
    );
    expect(byOrg.body.runtimes.map((r) => r.runtimeId)).toEqual([clientA.runtimeId]);

    // status filter.
    const byStatus = await get<{ runtimes: Array<{ runtimeId: string; status: string }> }>(
      baseUrl,
      `/admin/runtime-registration/runtimes?controlPlaneOrganizationId=${clientA.controlPlaneOrganizationId}&status=ACTIVE`,
      auth
    );
    expect(byStatus.body.runtimes.map((r) => r.runtimeId)).toEqual([clientA.runtimeId]);

    // liveness filter — ONLINE for A, OFFLINE for the never-heartbeated other.
    const online = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      '/admin/runtime-registration/runtimes?liveness=ONLINE',
      auth
    );
    expect(online.body.runtimes.some((r) => r.runtimeId === clientA.runtimeId)).toBe(true);
    expect(online.body.runtimes.some((r) => r.runtimeId === clientOther.runtimeId)).toBe(false);

    const offline = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      '/admin/runtime-registration/runtimes?liveness=OFFLINE',
      auth
    );
    expect(offline.body.runtimes.some((r) => r.runtimeId === clientOther.runtimeId)).toBe(true);
    expect(offline.body.runtimes.some((r) => r.runtimeId === clientA.runtimeId)).toBe(false);

    // tenantId filter — assign a real Tenant to A only.
    const tenantSlug = `t46-25-opv-${Date.now().toString(36)}`;
    createdTenantSlugs.push(tenantSlug);
    const tenant = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: 'Operational View Tenant', slug: tenantSlug },
      auth
    );
    await fetch(
      `${baseUrl}/admin/control-plane/organizations/${clientA.controlPlaneOrganizationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ tenantId: tenant.body.id }),
      }
    );

    const byTenant = await get<{ runtimes: Array<{ runtimeId: string }> }>(
      baseUrl,
      `/admin/runtime-registration/runtimes?tenantId=${tenant.body.id}`,
      auth
    );
    expect(byTenant.body.runtimes.map((r) => r.runtimeId)).toEqual([clientA.runtimeId]);
  });

  it('rejects a liveness filter outside the known enum instead of silently returning nothing', async () => {
    const res = await get(
      baseUrl,
      '/admin/runtime-registration/runtimes?liveness=NOT_A_REAL_STATE',
      auth
    );
    expect(res.status).toBe(422);
  });

  it('Part C: the operational summary is consistent with what the list endpoint returns for the same scope', async () => {
    const client = await registerPortalOrgAndRuntime(baseUrl, auth, 'OPVA');
    await sendHeartbeat(
      baseUrl,
      { ...client.runtimeIdentity, runtimeId: client.runtimeId },
      { version: '1.2.0', memory: 128, cpu: 2 }
    );

    const summary = await get<{ total: number; online: number; stale: number; offline: number }>(
      baseUrl,
      `/admin/runtime-registration/summary?controlPlaneOrganizationId=${client.controlPlaneOrganizationId}`,
      auth
    );
    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({ total: 1, online: 1, stale: 0, offline: 0 });

    // Cross-check against the list endpoint scoped the same way.
    const list = await get<{ total: number; runtimes: Array<{ liveness: string }> }>(
      baseUrl,
      `/admin/runtime-registration/runtimes?controlPlaneOrganizationId=${client.controlPlaneOrganizationId}`,
      auth
    );
    expect(list.body.total).toBe(summary.body.total);
    expect(list.body.runtimes.filter((r) => r.liveness === 'ONLINE').length).toBe(
      summary.body.online
    );
  });

  it('rejects unauthenticated access to the summary endpoint', async () => {
    const res = await get(baseUrl, '/admin/runtime-registration/summary');
    expect(res.status).toBe(401);
  });
});
