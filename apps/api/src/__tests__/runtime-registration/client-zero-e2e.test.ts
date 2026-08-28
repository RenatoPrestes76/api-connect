import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiServer } from '../../server.js';
import { prisma } from '../../services/prisma.js';
import { get, post, superAdminAuth, createConnectionProfile } from '../canonical-model/helpers.js';
import { loadOrCreateIdentity } from '../../../../agent/src/atlas-runtime-client/identity.js';
import {
  registerRuntime,
  sendHeartbeat,
  obtainAccessToken,
  pollJobs,
  submitResult,
} from '../../../../agent/src/atlas-runtime-client/client.js';
import { executeDiscoveryScan } from '../../../../agent/src/atlas-runtime-client/executor.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * ATLAS 46.21 — "Client Zero": the full, real, HTTP-driven simulation of
 * the canonical onboarding path this sprint's ADR settles on
 * (docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md):
 *
 *   portal signup -> Control Plane Organization link (46.21) -> activation
 *   key -> real Ed25519 client registers -> heartbeat -> ACTIVE -> visible
 *   under its real Control Plane Organization -> ERP discovery -> real
 *   GENESIS scan -> result -> ATHENA classification.
 *
 * Every step is a genuine fetch() against a real listening HTTP server —
 * nothing here calls a store/service directly to fake success.
 */

const SCAN_TARGET = {
  host: 'localhost',
  port: 5433,
  database: 'seltriva_connect',
  username: 'seltriva',
  password: 'seltriva_dev_password',
};

interface PortalRegisterResponse {
  organization: { id: string };
}

async function registerPortalOrg(
  baseUrl: string,
  internalCode: string
): Promise<{ organizationId: string }> {
  const { body } = await post<PortalRegisterResponse>(baseUrl, '/api/v1/portal/auth/register', {
    name: `Client Zero ${internalCode}`,
    razaoSocial: `Client Zero ${internalCode} LTDA`,
    cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
    internalCode,
    plan: 'professional',
    owner: {
      name: 'Client Zero Owner',
      email: `owner-${internalCode.toLowerCase()}@example.com`,
      password: 'S3nhaDoOwner123!',
    },
  });
  return { organizationId: body.organization.id };
}

describe('ATLAS 46.21 — Client Zero: canonical onboarding, end-to-end over real HTTP', () => {
  let server: Server;
  let baseUrl: string;
  let auth: Record<string, string>;
  let dataDir: string;

  beforeAll(async () => {
    server = createApiServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    auth = await superAdminAuth(baseUrl);
    dataDir = mkdtempSync(join(tmpdir(), 'atlas-client-zero-'));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    rmSync(dataDir, { recursive: true, force: true });
    // This suite's portal registrations each create a real, Postgres-
    // persisted Control Plane Organization (the whole point of the 46.21
    // bridge) — unlike the rest of this suite's in-memory stores, that
    // data survives across test runs unless removed explicitly. Only this
    // file's own slug prefixes (CZ.../CZX...) are targeted.
    await prisma.organization.deleteMany({ where: { slug: { startsWith: 'CZ' } } });
  });

  it('Tenant/Organization link -> Runtime identity -> registration -> heartbeat -> Control Plane visibility -> ERP discovery -> result', async () => {
    const orgCode = `CZ${Date.now().toString(36)}`;

    // 1. Customer signs up (portal-identity self-service).
    const { organizationId: portalOrgId } = await registerPortalOrg(baseUrl, orgCode);

    // 2. (46.21) That portal Organization must already be linked to a
    // real, Postgres-persisted Control Plane Organization — read it back
    // through the admin Control Plane API to prove it's a genuine,
    // separately-addressable Organization row, not just a claimed id.
    const cpOrgLookup = await get<{ organizations: Array<{ id: string; slug: string }> }>(
      baseUrl,
      `/admin/control-plane/organizations`,
      auth
    );
    const cpOrgBySlug = cpOrgLookup.body.organizations.find((o) => o.slug === orgCode);
    expect(cpOrgBySlug).toBeDefined();
    const controlPlaneOrgId = cpOrgBySlug!.id;

    const cpOrgDirect = await get<{ id: string; slug: string; name: string }>(
      baseUrl,
      `/admin/control-plane/organizations/${controlPlaneOrgId}`,
      auth
    );
    expect(cpOrgDirect.status).toBe(200);
    expect(cpOrgDirect.body.slug).toBe(orgCode);

    // 3. Admin issues a single-use activation key for that organization.
    const issued = await post<{ activationKey: { code: string } }>(
      baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: orgCode },
      auth
    );
    expect(issued.status).toBe(201);

    // 4. Runtime identity generated client-side (the real client).
    const identity = loadOrCreateIdentity(dataDir);
    expect(identity.runtimeId).toBeNull();

    // 5. Real Ed25519 registration.
    const registered = await registerRuntime(baseUrl, identity, {
      organizationCode: orgCode,
      activationKey: issued.body.activationKey.code,
      runtimeVersion: '1.2.0',
      hostname: 'client-zero-host',
      os: 'linux',
      capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
    });
    expect(registered.organizationId).toBe(portalOrgId);
    const runtimeId = registered.runtimeId;
    const enrolledIdentity = { ...identity, runtimeId };

    // 6. Real heartbeat -> ACTIVE.
    const heartbeat = await sendHeartbeat(baseUrl, enrolledIdentity, {
      version: '1.2.0',
      memory: 200,
      cpu: 1.8,
      capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
    });
    expect(heartbeat.status).toBe('ACTIVE');

    // 7. (46.21) Control Plane visibility — the whole point of this
    // sprint's bridge: an admin can now find this Ed25519 Runtime under
    // its REAL Control Plane Organization, not just under portal-
    // identity's separate id space.
    const runtimesUnderOrg = await get<{
      runtimes: Array<{ runtimeId: string; controlPlaneOrganizationId: string | null }>;
      total: number;
    }>(baseUrl, `/admin/control-plane/organizations/${controlPlaneOrgId}/runtimes`, auth);
    expect(runtimesUnderOrg.status).toBe(200);
    expect(runtimesUnderOrg.body.runtimes.some((r) => r.runtimeId === runtimeId)).toBe(true);
    const listedRuntime = runtimesUnderOrg.body.runtimes.find((r) => r.runtimeId === runtimeId);
    expect(listedRuntime?.controlPlaneOrganizationId).toBe(controlPlaneOrgId);

    // 8. ERP discovery: obtain a session, get assigned a job, execute a
    // real GENESIS scan, submit the real result.
    const { accessToken } = await obtainAccessToken(
      baseUrl,
      runtimeId,
      enrolledIdentity.privateKeyPem
    );
    const profileId = await createConnectionProfile(baseUrl, auth, {
      runtimeId,
      organizationId: portalOrgId,
    });
    const discoveryRequest = await post<{ request: { id: string; status: string } }>(
      baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: portalOrgId, profileId },
      auth
    );
    expect(discoveryRequest.status).toBe(201);
    const requestId = discoveryRequest.body.request.id;

    const jobs = await pollJobs(baseUrl, accessToken);
    expect(jobs.some((j) => j.id === requestId && j.status === 'CLAIMED')).toBe(true);

    const schema = await executeDiscoveryScan(SCAN_TARGET);
    const result = await submitResult(baseUrl, accessToken, {
      requestId,
      runtimeId,
      success: true,
      schema,
    });
    expect(result.request.status).toBe('COMPLETED');
  }, 30_000);

  describe('negative cases (Fase 16) — Control Plane organization isolation', () => {
    it("one organization's Control Plane Runtime lookup never includes another organization's Runtime", async () => {
      const codeA = `CZXA${Date.now().toString(36)}`;
      await registerPortalOrg(baseUrl, codeA);
      const issuedA = await post<{ activationKey: { code: string } }>(
        baseUrl,
        '/admin/runtime-registration/activation-keys',
        { organizationCode: codeA },
        auth
      );
      const dirA = mkdtempSync(join(tmpdir(), 'atlas-client-zero-a-'));
      const identityA = loadOrCreateIdentity(dirA);
      const registeredA = await registerRuntime(baseUrl, identityA, {
        organizationCode: codeA,
        activationKey: issuedA.body.activationKey.code,
        runtimeVersion: '1.2.0',
        hostname: 'isolation-a-host',
        os: 'linux',
      });

      const codeB = `CZXB${Date.now().toString(36)}`;
      await registerPortalOrg(baseUrl, codeB);
      const issuedB = await post<{ activationKey: { code: string } }>(
        baseUrl,
        '/admin/runtime-registration/activation-keys',
        { organizationCode: codeB },
        auth
      );
      const dirB = mkdtempSync(join(tmpdir(), 'atlas-client-zero-b-'));
      try {
        const identityB = loadOrCreateIdentity(dirB);
        const registeredB = await registerRuntime(baseUrl, identityB, {
          organizationCode: codeB,
          activationKey: issuedB.body.activationKey.code,
          runtimeVersion: '1.2.0',
          hostname: 'isolation-b-host',
          os: 'linux',
        });

        const orgsLookup = await get<{ organizations: Array<{ id: string; slug: string }> }>(
          baseUrl,
          '/admin/control-plane/organizations',
          auth
        );
        const cpOrgA = orgsLookup.body.organizations.find((o) => o.slug === codeA)!;
        const cpOrgB = orgsLookup.body.organizations.find((o) => o.slug === codeB)!;
        expect(cpOrgA.id).not.toBe(cpOrgB.id);

        const runtimesForA = await get<{ runtimes: Array<{ runtimeId: string }> }>(
          baseUrl,
          `/admin/control-plane/organizations/${cpOrgA.id}/runtimes`,
          auth
        );
        expect(runtimesForA.body.runtimes.some((r) => r.runtimeId === registeredA.runtimeId)).toBe(
          true
        );
        expect(runtimesForA.body.runtimes.some((r) => r.runtimeId === registeredB.runtimeId)).toBe(
          false
        );

        const runtimesForB = await get<{ runtimes: Array<{ runtimeId: string }> }>(
          baseUrl,
          `/admin/control-plane/organizations/${cpOrgB.id}/runtimes`,
          auth
        );
        expect(runtimesForB.body.runtimes.some((r) => r.runtimeId === registeredB.runtimeId)).toBe(
          true
        );
        expect(runtimesForB.body.runtimes.some((r) => r.runtimeId === registeredA.runtimeId)).toBe(
          false
        );
      } finally {
        rmSync(dirA, { recursive: true, force: true });
        rmSync(dirB, { recursive: true, force: true });
      }
    });

    it('the Control Plane Runtime lookup 404s for a nonexistent Organization instead of returning an empty list silently', async () => {
      const res = await get(
        baseUrl,
        '/admin/control-plane/organizations/does-not-exist-at-all/runtimes',
        auth
      );
      expect(res.status).toBe(404);
    });

    it('the Control Plane Runtime lookup requires admin authentication', async () => {
      const orgsLookup = await get<{ organizations: Array<{ id: string }> }>(
        baseUrl,
        '/admin/control-plane/organizations',
        auth
      );
      const anyOrgId = orgsLookup.body.organizations[0]?.id;
      const res = await get(baseUrl, `/admin/control-plane/organizations/${anyOrgId}/runtimes`);
      expect(res.status).toBe(401);
    });
  });
});
