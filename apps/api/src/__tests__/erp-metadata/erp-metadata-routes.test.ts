import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  registerActiveRuntimeWithKeys,
  obtainRuntimeAccessToken,
  createConnectionProfile,
  buildErpSchemaFixture,
  type TestServer,
} from './helpers.js';
import { SEED_ORG_ID } from '../job-orchestration/helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';
import { erpMetadataStore } from '../../modules/erp-metadata/erp-metadata-store.js';

interface ErrorBody {
  error: { message: string; code: string };
}

interface RequestBody {
  request: { id: string; status: string; [key: string]: unknown };
}

let srv: TestServer;
let auth: Record<string, string>;

beforeAll(async () => {
  srv = await startTestServer();
  auth = await superAdminAuth(srv.baseUrl);
});

afterAll(async () => {
  await srv.close();
});

async function setUpRuntimeAndProfile() {
  const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
  const profileId = await createConnectionProfile(srv.baseUrl, auth, {
    runtimeId,
    organizationId: SEED_ORG_ID,
  });
  return { runtimeId, keyPair, profileId };
}

async function requestAndClaim() {
  const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
  const created = await post<RequestBody>(
    srv.baseUrl,
    '/erp-metadata/discover',
    { runtimeId, organizationId: SEED_ORG_ID, profileId },
    auth
  );
  const accessToken = await obtainRuntimeAccessToken(srv.baseUrl, runtimeId, keyPair.privateKeyPem);
  await get(srv.baseUrl, '/erp-metadata/runtime/jobs', bearer(accessToken));
  return { requestId: created.body.request.id, runtimeId, profileId, accessToken };
}

describe('rejects unauthenticated access', () => {
  it('403/401 without a valid admin token', async () => {
    const { status } = await post(srv.baseUrl, '/erp-metadata/discover', {});
    expect([401, 403]).toContain(status);
  });
});

describe('POST /erp-metadata/discover', () => {
  it('creates a discovery request', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { status, body } = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: SEED_ORG_ID, profileId },
      auth
    );
    expect(status).toBe(201);
    expect(body.request.status).toBe('REQUESTED');
  });

  it('rejects a Runtime belonging to a different organization (isolamento)', async () => {
    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: 'org-does-not-match', profileId },
      auth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('RUNTIME_ORGANIZATION_MISMATCH');
  });

  it('rejects a profile that belongs to a different Runtime', async () => {
    const { runtimeId } = await setUpRuntimeAndProfile();
    const other = await setUpRuntimeAndProfile();
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: SEED_ORG_ID, profileId: other.profileId },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('PROFILE_RUNTIME_MISMATCH');
  });
});

describe('GET /erp-metadata/runtime/jobs — claim via JWT', () => {
  it('a Runtime claims its queued discovery request', async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
    const created = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: SEED_ORG_ID, profileId },
      auth
    );
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    const claimed = await get<{ requests: Array<{ id: string; status: string }> }>(
      srv.baseUrl,
      '/erp-metadata/runtime/jobs',
      bearer(accessToken)
    );
    const match = claimed.body.requests.find((r) => r.id === created.body.request.id);
    expect(match?.status).toBe('CLAIMED');
  });
});

describe('Descoberta completa e classificação (reutiliza ATHENA/PROMETHEUS)', () => {
  it('classifies produtos as PRODUCT and estoque as INVENTORY, with a discovered relationship', async () => {
    const { requestId, runtimeId, profileId, accessToken } = await requestAndClaim();
    const reported = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      { requestId, runtimeId, success: true, schema: buildErpSchemaFixture() },
      bearer(accessToken)
    );
    expect(reported.body.request.status).toBe('COMPLETED');

    const tables = await get<{
      tables: Array<{ table: string; entity: string }>;
    }>(srv.baseUrl, `/erp-metadata/tables?profileId=${profileId}`, auth);
    const produtos = tables.body.tables.find((t) => t.table.endsWith('.produtos'));
    const estoque = tables.body.tables.find((t) => t.table.endsWith('.estoque'));
    expect(produtos?.entity).toBe('PRODUCT');
    expect(estoque?.entity).toBe('INVENTORY');

    const detail = await get<{ table: { table: string; entity: string } }>(
      srv.baseUrl,
      `/erp-metadata/table/produtos?profileId=${profileId}`,
      auth
    );
    expect(detail.body.table.entity).toBe('PRODUCT');

    const relationships = await get<{
      graph: { edges: Array<{ kind: string }>; stats: { edgeCount: number } };
    }>(srv.baseUrl, `/erp-metadata/relationships?profileId=${profileId}`, auth);
    expect(relationships.body.graph.stats.edgeCount).toBeGreaterThan(0);

    const schemaSummary = await get<{
      cache: { version: number };
      summary: unknown;
    }>(srv.baseUrl, `/erp-metadata/schema?profileId=${profileId}`, auth);
    expect(schemaSummary.body.cache.version).toBe(1);
  });

  it('404s with a helpful message when nothing has been discovered yet for a profile', async () => {
    const { profileId } = await setUpRuntimeAndProfile();
    const { status, body } = await get<ErrorBody>(
      srv.baseUrl,
      `/erp-metadata/schema?profileId=${profileId}`,
      auth
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_DISCOVERED');
  });
});

describe('Cache incremental (checksum + versão)', () => {
  it('reusa a classificação quando o schema reportado não mudou', async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );

    const firstReq = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: SEED_ORG_ID, profileId },
      auth
    );
    await get(srv.baseUrl, '/erp-metadata/runtime/jobs', bearer(accessToken));
    const firstReport = await post<RequestBody & { reused: boolean }>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      {
        requestId: firstReq.body.request.id,
        runtimeId,
        success: true,
        schema: buildErpSchemaFixture(),
      },
      bearer(accessToken)
    );
    expect(firstReport.body.reused).toBe(false);

    const secondReq = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: SEED_ORG_ID, profileId },
      auth
    );
    await get(srv.baseUrl, '/erp-metadata/runtime/jobs', bearer(accessToken));
    const secondReport = await post<RequestBody & { reused: boolean }>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      {
        requestId: secondReq.body.request.id,
        runtimeId,
        success: true,
        schema: buildErpSchemaFixture(), // identical structure
      },
      bearer(accessToken)
    );
    expect(secondReport.body.reused).toBe(true);

    const schemaSummary = await get<{ cache: { version: number } }>(
      srv.baseUrl,
      `/erp-metadata/schema?profileId=${profileId}`,
      auth
    );
    expect(schemaSummary.body.cache.version).toBe(1); // unchanged — no re-classification happened
  });

  it('bumps the version and re-classifies when the schema genuinely changes', async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );

    const firstReq = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: SEED_ORG_ID, profileId },
      auth
    );
    await get(srv.baseUrl, '/erp-metadata/runtime/jobs', bearer(accessToken));
    await post(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      {
        requestId: firstReq.body.request.id,
        runtimeId,
        success: true,
        schema: buildErpSchemaFixture('preco_venda'),
      },
      bearer(accessToken)
    );

    const secondReq = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: SEED_ORG_ID, profileId },
      auth
    );
    await get(srv.baseUrl, '/erp-metadata/runtime/jobs', bearer(accessToken));
    const secondReport = await post<RequestBody & { reused: boolean }>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      {
        requestId: secondReq.body.request.id,
        runtimeId,
        success: true,
        schema: buildErpSchemaFixture('preco_alterado'), // structurally different column
      },
      bearer(accessToken)
    );
    expect(secondReport.body.reused).toBe(false);

    const schemaSummary = await get<{ cache: { version: number } }>(
      srv.baseUrl,
      `/erp-metadata/schema?profileId=${profileId}`,
      auth
    );
    expect(schemaSummary.body.cache.version).toBe(2);
  });
});

describe('Runtime reports a failed scan', () => {
  it('retries with backoff, then FAILS after exhausting attempts', async () => {
    const { runtimeId, keyPair, profileId } = await setUpRuntimeAndProfile();
    const created = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: SEED_ORG_ID, profileId, maxAttempts: 2 },
      auth
    );
    const requestId = created.body.request.id;
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    await get(srv.baseUrl, '/erp-metadata/runtime/jobs', bearer(accessToken));

    const first = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      { requestId, runtimeId, success: false, error: 'Connection refused' },
      bearer(accessToken)
    );
    expect(first.body.request.status).toBe('REQUESTED');
    expect(first.body.request['attempts']).toBe(1);

    const second = await post<RequestBody>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      { requestId, runtimeId, success: false, error: 'Connection refused' },
      bearer(accessToken)
    );
    expect(second.body.request.status).toBe('FAILED');
  });
});

describe('Recovery — classifier throws mid-scan (Sprint 46.17)', () => {
  it('does not leave the request stuck in SCANNING; routes it through the retry/backoff machine instead', async () => {
    const { requestId, runtimeId, accessToken } = await requestAndClaim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scanner = (erpMetadataStore as any).scanner as { scan: () => Promise<never> };
    const realScan = scanner.scan;
    scanner.scan = () => Promise.reject(new Error('classifier exploded'));

    try {
      const reported = await post<RequestBody>(
        srv.baseUrl,
        '/erp-metadata/runtime/result',
        { requestId, runtimeId, success: true, schema: buildErpSchemaFixture() },
        bearer(accessToken)
      );
      // The HTTP call itself must still succeed (the exception is caught and
      // converted into a normal retry/backoff transition) — not a 500, and
      // critically not left at 'SCANNING' where no retry could ever reach it.
      expect(reported.status).toBe(200);
      expect(reported.body.request.status).toBe('REQUESTED');
      expect(reported.body.request['attempts']).toBe(1);
      expect(reported.body.request['error']).toContain('classifier exploded');
    } finally {
      scanner.scan = realScan;
    }
  });
});

describe('Idempotência e isolamento no submit do resultado', () => {
  it('resubmitting a result for an already-COMPLETED request is idempotent (reused, no error, no reprocessing)', async () => {
    const { requestId, runtimeId, profileId, accessToken } = await requestAndClaim();
    const first = await post<RequestBody & { reused: boolean }>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      { requestId, runtimeId, success: true, schema: buildErpSchemaFixture() },
      bearer(accessToken)
    );
    expect(first.body.request.status).toBe('COMPLETED');
    expect(first.body.reused).toBe(false);

    // The same Runtime submits the exact same completed job's result a second time
    // (e.g. a retried HTTP call after a dropped response) — must not error, must
    // not duplicate the cached report, and must not reset the job's own state.
    const second = await post<RequestBody & { reused: boolean }>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      { requestId, runtimeId, success: true, schema: buildErpSchemaFixture() },
      bearer(accessToken)
    );
    expect(second.status).toBe(200);
    expect(second.body.request.status).toBe('COMPLETED');
    expect(second.body.reused).toBe(true);

    const schemaSummary = await get<{ cache: { version: number } }>(
      srv.baseUrl,
      `/erp-metadata/schema?profileId=${profileId}`,
      auth
    );
    expect(schemaSummary.body.cache.version).toBe(1); // no duplicate re-classification
  });

  it("rejects submitting a result for another Runtime's discovery request", async () => {
    const { requestId } = await requestAndClaim();
    const other = await setUpRuntimeAndProfile();
    const otherAccessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      other.runtimeId,
      other.keyPair.privateKeyPem
    );

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      { requestId, runtimeId: other.runtimeId, success: true, schema: buildErpSchemaFixture() },
      bearer(otherAccessToken)
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('RUNTIME_MISMATCH');
  });

  it('rejects submitting a result for a nonexistent request', async () => {
    const { keyPair, runtimeId } = await setUpRuntimeAndProfile();
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      { requestId: 'does-not-exist', runtimeId, success: true, schema: buildErpSchemaFixture() },
      bearer(accessToken)
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('REQUEST_NOT_FOUND');
  });
});

describe('Security boundary', () => {
  it('rejects a runtime/result request without a valid Runtime JWT', async () => {
    const { status } = await post(srv.baseUrl, '/erp-metadata/runtime/result', {
      requestId: 'x',
      success: true,
    });
    expect(status).toBe(401);
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) is forbidden from requesting discovery', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorMetaPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor Metadata',
      email: `auditor-metadata-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.64.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { runtimeId, profileId } = await setUpRuntimeAndProfile();
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId: SEED_ORG_ID, profileId },
      auditorAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('Audit trail', () => {
  it('records METADATA_DISCOVERY_REQUESTED and METADATA_DISCOVERY_COMPLETED entries', async () => {
    const { requestId, runtimeId, accessToken } = await requestAndClaim();
    await post(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      { requestId, runtimeId, success: true, schema: buildErpSchemaFixture() },
      bearer(accessToken)
    );

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(
      log.some((e) => e.action === 'METADATA_DISCOVERY_REQUESTED' && e.target === requestId)
    ).toBe(true);
    expect(
      log.some((e) => e.action === 'METADATA_DISCOVERY_COMPLETED' && e.target === requestId)
    ).toBe(true);
  });
});
