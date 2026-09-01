import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { sign } from 'node:crypto';
import { createApiServer } from '../../server.js';
import { prisma } from '../../services/prisma.js';
import { get, post, superAdminAuth } from '../canonical-model/helpers.js';
import {
  canonicalJobResultPayload,
  canonicalClaimJobsPayload,
} from '../../modules/job-orchestration/job-signature.js';
import {
  LIVENESS_ONLINE_WINDOW_MS,
  LIVENESS_STALE_WINDOW_MS,
} from '../../modules/runtime-registration/liveness.js';
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
 * ATLAS 46.30 — Production Readiness & Go-Live Gate, Phase L: the single
 * reproducible Client Zero scenario this gate requires.
 *
 * This does NOT re-derive protocol-level properties already proven
 * exhaustively elsewhere (invalid signature/replay rejection, activation-key
 * lifecycle, concurrent registration races, etc. — see
 * runtime-registration-routes.test.ts, registration-idempotency.test.ts,
 * real-client-enrollment-e2e.test.ts). It composes the already-proven
 * primitives (client-zero-onboarding-e2e.test.ts's signup->...->ATHENA
 * chain, runtime-liveness-operation.test.ts's ONLINE->STALE->OFFLINE->ONLINE
 * technique) with the two pieces no single existing file walks end to end in
 * sequence: a generic job-orchestration job (create -> claim -> execute ->
 * result) and a full liveness degrade/recovery cycle, all against the same
 * Client Zero runtime, finishing with a tenant-isolation check and a
 * database integrity audit.
 *
 * A real API process restart (step 16 of the gate's scenario) is
 * deliberately NOT repeated here — restart-durability-e2e.test.ts (46.22)
 * already proves registration/heartbeat survive a real process kill+restart
 * end to end; duplicating a real process spawn inside this in-process
 * scenario would only slow it down without adding new evidence.
 */

const SCAN_TARGET = {
  host: 'localhost',
  port: 5433,
  database: 'seltriva_connect',
  username: 'seltriva',
  password: 'seltriva_dev_password',
};

const ORG_CODE = `RG${Date.now().toString(36)}`;
const TENANT_SLUG = `t46-30-rg-${Date.now().toString(36)}`;
const ISO_ORG_CODE = `RGISO${Date.now().toString(36)}`;
const ISO_TENANT_SLUG = `t46-30-rgiso-${Date.now().toString(36)}`;

function signJobResult(
  privateKeyPem: string,
  input: {
    jobId: string;
    runtimeId: string;
    outcome: 'success' | 'failure';
    result?: Record<string, unknown>;
    error?: string;
    timestamp: string;
  }
): string {
  return sign(null, Buffer.from(canonicalJobResultPayload(input)), privateKeyPem).toString(
    'base64'
  );
}

function signClaimRequest(
  privateKeyPem: string,
  input: { runtimeId: string; timestamp: string }
): string {
  return sign(null, Buffer.from(canonicalClaimJobsPayload(input)), privateKeyPem).toString(
    'base64'
  );
}

describe('ATLAS 46.30 — Client Zero production-readiness scenario, end to end', () => {
  let server: Server;
  let baseUrl: string;
  let auth: Record<string, string>;
  let dataDir: string;
  let isoDataDir: string;

  beforeAll(async () => {
    server = createApiServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    auth = await superAdminAuth(baseUrl);
    dataDir = mkdtempSync(join(tmpdir(), 'atlas-46-30-rg-'));
    isoDataDir = mkdtempSync(join(tmpdir(), 'atlas-46-30-rgiso-'));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(isoDataDir, { recursive: true, force: true });
    await prisma.runtimeRegistration.deleteMany({
      where: { hostname: { in: ['atlas-46-30-rg-host', 'atlas-46-30-rgiso-host'] } },
    });
    await prisma.organization.deleteMany({ where: { slug: { in: [ORG_CODE, ISO_ORG_CODE] } } });
    await prisma.tenant.deleteMany({ where: { slug: { in: [TENANT_SLUG, ISO_TENANT_SLUG] } } });
  });

  it(
    '1 client zero -> 2 tenant -> 3 runtime register -> 4 auth -> 5 heartbeat -> 6 ONLINE -> ' +
      '7 discovery -> 8 job create -> 9 job execute -> 10 persist -> 11 verify -> ' +
      '12 heartbeat loss -> 13 STALE/OFFLINE -> 14 recover -> 15 ONLINE again -> tenant isolation',
    async () => {
      // ── 1. Client Zero signup -> Organization (no Tenant yet) ──────────
      const orgRes = await post<{
        organization: { id: string; controlPlaneOrganizationId: string };
      }>(baseUrl, '/api/v1/portal/auth/register', {
        name: `Readiness Gate ${ORG_CODE}`,
        razaoSocial: `Readiness Gate ${ORG_CODE} LTDA`,
        cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
        internalCode: ORG_CODE,
        plan: 'professional',
        owner: {
          name: 'Readiness Owner',
          email: `owner-${ORG_CODE.toLowerCase()}@example.com`,
          password: 'S3nhaDoOwner123!',
        },
      });
      expect(orgRes.status).toBe(201);
      const portalOrgId = orgRes.body.organization.id;
      const controlPlaneOrgId = orgRes.body.organization.controlPlaneOrganizationId;

      const orgRow = await prisma.organization.findUnique({ where: { id: controlPlaneOrgId } });
      expect(orgRow?.tenantId).toBeNull(); // legitimate PENDING_TENANT_ASSIGNMENT, not an error

      // ── 2. Tenant provisioning ──────────────────────────────────────────
      const tenantRes = await post<{ id: string }>(
        baseUrl,
        '/admin/control-plane/tenants',
        { name: `Readiness Gate Tenant ${ORG_CODE}`, slug: TENANT_SLUG },
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

      // ── 3. Runtime registration (real Ed25519 identity + activation key) ─
      const keyRes = await post<{ activationKey: { code: string } }>(
        baseUrl,
        '/admin/runtime-registration/activation-keys',
        { organizationCode: ORG_CODE },
        auth
      );
      const identity = loadOrCreateIdentity(dataDir);
      const registered = await registerRuntime(baseUrl, identity, {
        organizationCode: ORG_CODE,
        activationKey: keyRes.body.activationKey.code,
        runtimeVersion: '1.2.0',
        hostname: 'atlas-46-30-rg-host',
        os: 'linux',
        capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
      });
      const runtimeId = registered.runtimeId;
      const enrolledIdentity = { ...identity, runtimeId };

      // ── 4/5. Authenticated heartbeat -> ACTIVE ──────────────────────────
      const heartbeat = await sendHeartbeat(baseUrl, enrolledIdentity, {
        version: '1.2.0',
        memory: 200,
        cpu: 1.8,
        capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
      });
      expect(heartbeat.status).toBe('ACTIVE');

      // ── 6. Verify ONLINE via the operational view ───────────────────────
      const onlineView = await get<{ runtime: { liveness: string; status: string } }>(
        baseUrl,
        `/admin/runtime-registration/runtimes/${runtimeId}`,
        auth
      );
      expect(onlineView.body.runtime.liveness).toBe('ONLINE');
      expect(onlineView.body.runtime.status).toBe('ACTIVE');

      // ── 7. ERP discovery -> real GENESIS scan -> ATHENA-ready result ────
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
          name: 'ERP Readiness Gate',
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

      const discoveryRequest = await post<{ request: { id: string } }>(
        baseUrl,
        '/erp-metadata/discover',
        { runtimeId, organizationId: portalOrgId, profileId },
        auth
      );
      expect(discoveryRequest.status).toBe(201);
      const requestId = discoveryRequest.body.request.id;

      const discoveryJobs = await pollJobs(baseUrl, accessToken);
      expect(discoveryJobs.some((j) => j.id === requestId && j.status === 'CLAIMED')).toBe(true);

      const schema = await executeDiscoveryScan(SCAN_TARGET);
      const discoveryResult = await submitResult(baseUrl, accessToken, {
        requestId,
        runtimeId,
        success: true,
        schema,
      });
      expect(discoveryResult.request.status).toBe('COMPLETED');

      // ── 8/9. Generic job lifecycle: create -> claim -> execute -> result ─
      const jobCreate = await post<{ job: { id: string; status: string } }>(
        baseUrl,
        '/jobs',
        {
          organizationId: portalOrgId,
          runtimeId,
          command: 'SYNC_PRODUCTS',
          payload: { note: 'atlas-46-30-readiness-gate' },
        },
        auth
      );
      expect(jobCreate.status).toBe(201);
      expect(jobCreate.body.job.status).toBe('QUEUED');
      const jobId = jobCreate.body.job.id;

      const claimTimestamp = new Date().toISOString();
      const claimSignature = signClaimRequest(enrolledIdentity.privateKeyPem, {
        runtimeId,
        timestamp: claimTimestamp,
      });
      const claimed = await get<{ total: number; jobs: Array<{ id: string; status: string }> }>(
        baseUrl,
        `/runtime/jobs?runtimeId=${runtimeId}&timestamp=${encodeURIComponent(claimTimestamp)}&signature=${encodeURIComponent(claimSignature)}`
      );
      expect(claimed.body.jobs.some((j) => j.id === jobId && j.status === 'DISPATCHED')).toBe(true);

      const resultTimestamp = new Date().toISOString();
      const resultSignature = signJobResult(enrolledIdentity.privateKeyPem, {
        jobId,
        runtimeId,
        outcome: 'success',
        result: { synced: 7 },
        timestamp: resultTimestamp,
      });
      const jobResult = await post<{ job: { status: string; result: unknown } }>(
        baseUrl,
        '/jobs/result',
        {
          jobId,
          runtimeId,
          outcome: 'success',
          result: { synced: 7 },
          timestamp: resultTimestamp,
          signature: resultSignature,
        }
      );
      expect(jobResult.status).toBe(200);
      expect(jobResult.body.job.status).toBe('SUCCESS');

      // ── 10/11. Verify persisted state via an independent re-read ────────
      const jobReread = await get<{ job: { status: string; result: unknown } }>(
        baseUrl,
        `/jobs/${jobId}`,
        auth
      );
      expect(jobReread.body.job.status).toBe('SUCCESS');
      expect(jobReread.body.job.result).toEqual({ synced: 7 });

      // ── 12/13. Simulate heartbeat loss -> STALE -> OFFLINE (no real sleep,
      //           same controlled-timestamp technique as
      //           runtime-liveness-operation.test.ts Part D/F) ─────────────
      await prisma.runtimeRegistration.update({
        where: { id: runtimeId },
        data: { lastHeartbeat: new Date(Date.now() - (LIVENESS_ONLINE_WINDOW_MS + 1_000)) },
      });
      const stale = await get<{ runtime: { liveness: string } }>(
        baseUrl,
        `/admin/runtime-registration/runtimes/${runtimeId}`,
        auth
      );
      expect(stale.body.runtime.liveness).toBe('STALE');

      await prisma.runtimeRegistration.update({
        where: { id: runtimeId },
        data: { lastHeartbeat: new Date(Date.now() - (LIVENESS_STALE_WINDOW_MS + 1_000)) },
      });
      const offline = await get<{ runtime: { liveness: string } }>(
        baseUrl,
        `/admin/runtime-registration/runtimes/${runtimeId}`,
        auth
      );
      expect(offline.body.runtime.liveness).toBe('OFFLINE');

      // OFFLINE must still be a known, addressable runtime — never
      // confused with one that was never registered.
      expect(offline.status).toBe(200);

      // ── 14/15. Recover: a real heartbeat resumes -> ONLINE again ────────
      const resumed = await sendHeartbeat(baseUrl, enrolledIdentity, {
        version: '1.2.0',
        memory: 210,
        cpu: 1.5,
      });
      expect(resumed.status).toBe('ACTIVE');
      const backOnline = await get<{ runtime: { liveness: string } }>(
        baseUrl,
        `/admin/runtime-registration/runtimes/${runtimeId}`,
        auth
      );
      expect(backOnline.body.runtime.liveness).toBe('ONLINE');

      // ── Tenant isolation: a second, independent Client Zero ─────────────
      const isoOrgRes = await post<{
        organization: { id: string; controlPlaneOrganizationId: string };
      }>(baseUrl, '/api/v1/portal/auth/register', {
        name: `Readiness Gate Iso ${ISO_ORG_CODE}`,
        razaoSocial: `Readiness Gate Iso ${ISO_ORG_CODE} LTDA`,
        cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
        internalCode: ISO_ORG_CODE,
        plan: 'professional',
        owner: {
          name: 'Readiness Iso Owner',
          email: `owner-${ISO_ORG_CODE.toLowerCase()}@example.com`,
          password: 'S3nhaDoOwner123!',
        },
      });
      const isoPortalOrgId = isoOrgRes.body.organization.id;
      const isoControlPlaneOrgId = isoOrgRes.body.organization.controlPlaneOrganizationId;
      const isoTenantRes = await post<{ id: string }>(
        baseUrl,
        '/admin/control-plane/tenants',
        { name: `Readiness Gate Iso Tenant ${ISO_ORG_CODE}`, slug: ISO_TENANT_SLUG },
        auth
      );
      await fetch(`${baseUrl}/admin/control-plane/organizations/${isoControlPlaneOrgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ tenantId: isoTenantRes.body.id }),
      });
      const isoKeyRes = await post<{ activationKey: { code: string } }>(
        baseUrl,
        '/admin/runtime-registration/activation-keys',
        { organizationCode: ISO_ORG_CODE },
        auth
      );
      const isoIdentity = loadOrCreateIdentity(isoDataDir);
      const isoRegistered = await registerRuntime(baseUrl, isoIdentity, {
        organizationCode: ISO_ORG_CODE,
        activationKey: isoKeyRes.body.activationKey.code,
        runtimeVersion: '1.2.0',
        hostname: 'atlas-46-30-rgiso-host',
        os: 'linux',
      });
      const isoRuntimeId = isoRegistered.runtimeId;

      // Runtime A's job/list scope never includes Runtime B, and vice
      // versa — the two Client Zero flows are fully independent.
      const listForA = await get<{ runtimes: Array<{ runtimeId: string }> }>(
        baseUrl,
        `/admin/runtime-registration/runtimes?organizationId=${portalOrgId}`,
        auth
      );
      expect(listForA.body.runtimes.some((r) => r.runtimeId === runtimeId)).toBe(true);
      expect(listForA.body.runtimes.some((r) => r.runtimeId === isoRuntimeId)).toBe(false);

      const listForB = await get<{ runtimes: Array<{ runtimeId: string }> }>(
        baseUrl,
        `/admin/runtime-registration/runtimes?organizationId=${isoPortalOrgId}`,
        auth
      );
      expect(listForB.body.runtimes.some((r) => r.runtimeId === isoRuntimeId)).toBe(true);
      expect(listForB.body.runtimes.some((r) => r.runtimeId === runtimeId)).toBe(false);

      // A job created under organization A is invisible when listing jobs
      // scoped to organization B.
      const jobsForIso = await get<{ jobs: Array<{ id: string }> }>(
        baseUrl,
        `/jobs?organizationId=${isoPortalOrgId}`,
        auth
      );
      expect(jobsForIso.body.jobs.some((j) => j.id === jobId)).toBe(false);

      // ── Database integrity: no orphans, no duplicates from this run ─────
      expect(await prisma.organization.count({ where: { slug: ORG_CODE } })).toBe(1);
      expect(await prisma.organization.count({ where: { slug: ISO_ORG_CODE } })).toBe(1);
      expect(await prisma.tenant.count({ where: { slug: TENANT_SLUG } })).toBe(1);
      expect(await prisma.runtimeRegistration.count({ where: { id: runtimeId } })).toBe(1);
      expect(await prisma.runtimeRegistration.count({ where: { id: isoRuntimeId } })).toBe(1);
      const finalRuntimeRow = await prisma.runtimeRegistration.findUnique({
        where: { id: runtimeId },
        include: { controlPlaneOrganization: true },
      });
      expect(finalRuntimeRow?.controlPlaneOrganization?.tenantId).toBe(tenantId);
    },
    30_000
  );
});
