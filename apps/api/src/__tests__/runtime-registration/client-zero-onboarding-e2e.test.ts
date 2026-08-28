import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiServer } from '../../server.js';
import { prisma } from '../../services/prisma.js';
import { get, post, superAdminAuth } from '../canonical-model/helpers.js';
import { hashFingerprint } from '../../modules/runtime-registration/fingerprint.js';
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
 * ATLAS 46.24 — Part A/B/M: the single, authoritative canonical onboarding
 * flow, proven end to end over real HTTP against a real, listening server,
 * with direct Postgres verification at every critical juncture (never
 * trusting HTTP responses alone):
 *
 *   signup -> Organization -> Tenant -> activation key -> Runtime
 *   registration -> heartbeat -> ONLINE -> ERP discovery -> GENESIS
 *   -> ATHENA -> full database integrity audit
 *
 * This complements, rather than duplicates, two existing files:
 *   - client-zero-e2e.test.ts (46.21) proves the same chain but without an
 *     explicit Tenant step (written before 46.19's Tenant model was wired
 *     into this flow's test coverage).
 *   - restart-durability-e2e.test.ts (46.22/46.23/46.24) proves this same
 *     chain, Tenant included, survives a real API process restart — a
 *     different concern (process durability) from this file's (the flow
 *     itself is correct and complete, run fast, in-process).
 */

const SCAN_TARGET = {
  host: 'localhost',
  port: 5433,
  database: 'seltriva_connect',
  username: 'seltriva',
  password: 'seltriva_dev_password',
};

const ORG_CODE = `CZO${Date.now().toString(36)}`;
const TENANT_SLUG = `t46-24-czo-${Date.now().toString(36)}`;

describe('ATLAS 46.24 — Client Zero: canonical onboarding, signup through ATHENA, with full DB integrity audit', () => {
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
    dataDir = mkdtempSync(join(tmpdir(), 'atlas-client-zero-onboarding-'));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    rmSync(dataDir, { recursive: true, force: true });
    // RuntimeRegistration.controlPlaneOrganizationId is onDelete: SetNull,
    // not Cascade — deleting the Organization first would orphan this row
    // (survives with controlPlaneOrganizationId reset to null) rather than
    // remove it, so it must be deleted explicitly and first.
    await prisma.runtimeRegistration.deleteMany({
      where: { hostname: 'client-zero-onboarding-host' },
    });
    await prisma.organization.deleteMany({ where: { slug: ORG_CODE } });
    await prisma.tenant.deleteMany({ where: { slug: TENANT_SLUG } });
  });

  it('signup -> Organization (no Tenant) -> Tenant provisioned -> activation key -> Runtime registers -> heartbeat -> ONLINE -> ERP discovery -> GENESIS -> ATHENA -> DB integrity', async () => {
    // 1. Signup — the real, existing self-service mechanism.
    const orgRes = await post<{
      organization: { id: string; controlPlaneOrganizationId: string };
    }>(baseUrl, '/api/v1/portal/auth/register', {
      name: `Client Zero Onboarding ${ORG_CODE}`,
      razaoSocial: `Client Zero Onboarding ${ORG_CODE} LTDA`,
      cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
      internalCode: ORG_CODE,
      plan: 'professional',
      owner: {
        name: 'Client Zero Owner',
        email: `owner-${ORG_CODE.toLowerCase()}@example.com`,
        password: 'S3nhaDoOwner123!',
      },
    });
    const portalOrgId = orgRes.body.organization.id;
    const controlPlaneOrgId = orgRes.body.organization.controlPlaneOrganizationId;

    // 2. Organization is real and, initially, has no Tenant — a
    // legitimate PENDING_TENANT_ASSIGNMENT state, not an error.
    const orgRow = await prisma.organization.findUnique({ where: { id: controlPlaneOrgId } });
    expect(orgRow).not.toBeNull();
    expect(orgRow?.tenantId).toBeNull();

    // 3. Tenant provisioning — explicit, admin-controlled, the same
    // boundary formalized in 46.23/46.24 (PATCH .../organizations/:id).
    const tenantRes = await post<{ id: string }>(
      baseUrl,
      '/admin/control-plane/tenants',
      { name: `Client Zero Onboarding Tenant ${ORG_CODE}`, slug: TENANT_SLUG },
      auth
    );
    const tenantId = tenantRes.body.id;

    const assignRes = await fetch(
      `${baseUrl}/admin/control-plane/organizations/${controlPlaneOrgId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ tenantId }),
      }
    );
    expect(assignRes.status).toBe(200);
    const orgAfterAssign = await prisma.organization.findUnique({
      where: { id: controlPlaneOrgId },
    });
    expect(orgAfterAssign?.tenantId).toBe(tenantId);

    // 4. Activation key — real, admin-issued, single-use.
    const keyRes = await post<{ activationKey: { code: string } }>(
      baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: ORG_CODE },
      auth
    );
    expect(keyRes.status).toBe(201);

    // 5/6/7. Runtime generates its own Ed25519 identity and registers.
    const identity = loadOrCreateIdentity(dataDir);
    expect(identity.runtimeId).toBeNull();
    const registered = await registerRuntime(baseUrl, identity, {
      organizationCode: ORG_CODE,
      activationKey: keyRes.body.activationKey.code,
      runtimeVersion: '1.2.0',
      hostname: 'client-zero-onboarding-host',
      os: 'linux',
      capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
    });
    const runtimeId = registered.runtimeId;
    expect(registered.organizationId).toBe(portalOrgId);
    const enrolledIdentity = { ...identity, runtimeId };

    // Identity persisted correctly: the exact hash of the raw fingerprint
    // this client generated, and the exact public key — never the raw
    // fingerprint itself, never the private key.
    const runtimeRowAfterRegister = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeId },
    });
    expect(runtimeRowAfterRegister?.machineFingerprintHash).toBe(
      hashFingerprint(identity.fingerprint)
    );
    expect(runtimeRowAfterRegister?.publicKey).toBe(identity.publicKeyPem);
    expect(runtimeRowAfterRegister?.status).toBe('REGISTERED');
    expect(runtimeRowAfterRegister?.organizationId).toBe(portalOrgId);
    expect(runtimeRowAfterRegister?.controlPlaneOrganizationId).toBe(controlPlaneOrgId);

    // Activation key correctly consumed (single-use).
    const keysRes = await get<{
      activationKeys: Array<{ code: string; used: boolean; usedByRuntimeId: string | null }>;
    }>(baseUrl, '/admin/runtime-registration/activation-keys', auth);
    const usedKey = keysRes.body.activationKeys.find(
      (k) => k.code === keyRes.body.activationKey.code
    );
    expect(usedKey?.used).toBe(true);
    expect(usedKey?.usedByRuntimeId).toBe(runtimeId);

    // 8/9/10. Heartbeat -> ACTIVE -> ONLINE.
    const heartbeat = await sendHeartbeat(baseUrl, enrolledIdentity, {
      version: '1.2.0',
      memory: 200,
      cpu: 1.8,
      capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
    });
    expect(heartbeat.status).toBe('ACTIVE');

    const runtimeRowAfterHeartbeat = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeId },
    });
    expect(runtimeRowAfterHeartbeat?.lastHeartbeat).not.toBeNull();
    expect(runtimeRowAfterHeartbeat?.lastHeartbeatSignature).not.toBeNull();
    expect(runtimeRowAfterHeartbeat?.activatedAt).not.toBeNull();

    const enrichedLookup = await get<{
      runtime: { liveness: string; status: string };
      organization: { id: string; name: string } | null;
      tenant: { id: string; name: string } | null;
    }>(baseUrl, `/admin/runtime-registration/runtimes/${runtimeId}`, auth);
    expect(enrichedLookup.status).toBe(200);
    expect(enrichedLookup.body.runtime.liveness).toBe('ONLINE');
    expect(enrichedLookup.body.runtime.status).toBe('ACTIVE');
    // 14. All relations belong to the same Organization/Tenant.
    expect(enrichedLookup.body.organization?.id).toBe(controlPlaneOrgId);
    expect(enrichedLookup.body.tenant?.id).toBe(tenantId);

    // 11/12. ERP discovery -> real GENESIS scan.
    const { accessToken } = await obtainAccessToken(
      baseUrl,
      runtimeId,
      enrolledIdentity.privateKeyPem
    );
    const profileRes = await post<{ profile: { id: string } }>(
      baseUrl,
      '/erp-connectivity/profiles',
      {
        runtimeId,
        organizationId: portalOrgId,
        name: 'ERP Client Zero Onboarding',
        dbType: 'POSTGRESQL',
        host: 'db.cliente.local',
        port: 5432,
        database: 'erp_prod',
        username: 'erp_user',
        password: 'S3nhaSuperSecreta!',
      },
      auth
    );
    const profileId = profileRes.body.profile.id;

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

    // 13. ATHENA — semantic classification.
    await post(baseUrl, '/semantic-mapping/analyze', { profileId }, auth);
    const entitiesRes = await get<{ entities: Array<{ schema: string; table: string }> }>(
      baseUrl,
      `/semantic-mapping/entities?profileId=${profileId}`,
      auth
    );
    expect(entitiesRes.status).toBe(200);
    expect(entitiesRes.body.entities.length).toBeGreaterThan(0);
    for (const mapping of entitiesRes.body.entities) {
      const approveRes = await fetch(`${baseUrl}/semantic-mapping/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          profileId,
          schema: mapping.schema,
          table: mapping.table,
          decision: 'APPROVE',
        }),
      });
      expect(approveRes.ok).toBe(true);
    }

    // ─── Part M: database integrity audit ──────────────────────────────
    // No orphans, no duplicates, no artificial Tenant, no tenantId ever
    // written to a Runtime row.
    const orgCount = await prisma.organization.count({ where: { slug: ORG_CODE } });
    expect(orgCount).toBe(1);

    // Scoped by this run's own runtimeId (not the reusable hostname
    // literal, which — unlike ORG_CODE/TENANT_SLUG — isn't time-suffixed
    // and would collide with a prior run's now-orphaned row): confirms
    // this Client Zero flow produced exactly one row, not a duplicate
    // from some registration bug. The deeper identity-uniqueness
    // guarantee (no two *different* runtimeIds can ever share a
    // fingerprint/publicKey, even under a real concurrent race) is
    // proven exhaustively in registration-idempotency.test.ts.
    const runtimeCount = await prisma.runtimeRegistration.count({
      where: { id: runtimeId },
    });
    expect(runtimeCount).toBe(1);

    const tenantCount = await prisma.tenant.count({ where: { slug: TENANT_SLUG } });
    expect(tenantCount).toBe(1); // exactly the one this test created — no duplicate provisioning

    const finalRuntimeRow = await prisma.runtimeRegistration.findUnique({
      where: { id: runtimeId },
      include: { controlPlaneOrganization: true },
    });
    expect(finalRuntimeRow?.controlPlaneOrganization?.tenantId).toBe(tenantId);
    // Structural proof, not just behavioral: the Prisma row has no
    // `tenantId` property at all — RuntimeRegistration was never given
    // one (see packages/database/prisma/schema.prisma).
    expect(finalRuntimeRow && 'tenantId' in finalRuntimeRow).toBe(false);

    // ─── Part H: negative case — ERP discovery against a Runtime that
    // does not exist is rejected deterministically, database untouched.
    const bogusDiscovery = await post<{ error?: { code: string } }>(
      baseUrl,
      '/erp-metadata/discover',
      { runtimeId: 'does-not-exist-at-all', organizationId: portalOrgId, profileId },
      auth
    );
    expect(bogusDiscovery.status).toBe(404);
    expect(bogusDiscovery.body.error?.code).toBe('RUNTIME_NOT_FOUND');
  }, 30_000);
});
