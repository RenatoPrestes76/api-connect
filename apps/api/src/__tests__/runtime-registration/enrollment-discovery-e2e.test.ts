import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  registerOrganization,
  createConnectionProfile,
  type TestServer,
} from '../canonical-model/helpers.js';
import { registerDemoRuntime, signHeartbeat } from './helpers.js';
import { obtainRuntimeAccessToken } from '../erp-connectivity/helpers.js';
import { buildRichErpSchemaFixture } from '../semantic-mapping/helpers.js';

/**
 * Sprint 46.12 — proves the full chain end-to-end, in one place, using only
 * fixtures (no real ERP): a brand-new tenant enrolls a Runtime through the
 * authorized activation-key mechanism, the Runtime authenticates,
 * heartbeats with its declared capabilities, is handed a discovery job,
 * claims it, executes it (against a fixture schema) and reports back — and
 * that raw result genuinely flows through the pre-existing 46.9/46.10/46.11
 * layers (ATHENA classification -> semantic-mapping business entities ->
 * canonical CBL model) without reimplementing any of them.
 */
describe('Sprint 46.12 — Runtime enrollment through to canonical model (full chain)', () => {
  let srv: TestServer;
  let auth: Record<string, string>;

  beforeAll(async () => {
    srv = await startTestServer();
    auth = await superAdminAuth(srv.baseUrl);
  });

  afterAll(async () => {
    await srv.close();
  });

  it('1-tenant -> 2-enrollment -> 3-register -> 4-auth -> 5-heartbeat -> 6-discover -> 7-claim -> 8-submit -> 9-semantic-mapping -> 10-canonical-model', async () => {
    // 1. Tenant created (Seltriva-side self-service registration).
    const orgCode = `E2E${Date.now().toString(36)}`;
    const { organizationId } = await registerOrganization(srv.baseUrl, orgCode);

    // 2. Enrollment code generated and bound to that tenant only — the
    // Runtime never gets to pick its own tenant.
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: orgCode },
      auth
    );
    expect(issued.status).toBe(201);

    // 3. Runtime presents the code and registers, declaring its capabilities.
    const registered = await registerDemoRuntime(srv.baseUrl, {
      organizationCode: orgCode,
      activationKey: issued.body.activationKey.code,
      capabilities: ['DATABASE_ACCESS', 'POSTGRES', 'HTTPS'],
    });
    expect(registered.status).toBe(201);
    expect(registered.body.data?.organizationId).toBe(organizationId);
    expect(registered.body.data?.capabilities).toEqual(['DATABASE_ACCESS', 'POSTGRES', 'HTTPS']);
    const runtimeId = registered.body.data!.runtimeId;

    // 4. Runtime authenticates operationally (JWT session) — it does not
    // keep reusing the enrollment code as a permanent credential.
    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      registered.keyPair.privateKeyPem
    );
    expect(typeof accessToken).toBe('string');
    expect(accessToken.length).toBeGreaterThan(0);

    // 5. Heartbeat — Atlas records lastSeen/status; capabilities may be
    // refreshed. This alone must not trigger any discovery.
    const timestamp = new Date().toISOString();
    const heartbeatFields = { runtimeId, version: '1.2.0', memory: 256, cpu: 4.2, timestamp };
    const signature = signHeartbeat(registered.keyPair.privateKeyPem, heartbeatFields);
    const heartbeat = await post<{ data: { status: string; capabilities: string[] } }>(
      srv.baseUrl,
      '/runtime/heartbeat',
      { ...heartbeatFields, signature, capabilities: ['DATABASE_ACCESS', 'POSTGRES', 'HTTPS'] }
    );
    expect(heartbeat.status).toBe(200);
    expect(heartbeat.body.data.status).toBe('ACTIVE');

    // A connection profile must exist before discovery can be requested —
    // the ERP's connection details themselves (never the discovery result).
    const profileId = await createConnectionProfile(srv.baseUrl, auth, {
      runtimeId,
      organizationId,
    });

    // 6. Atlas creates a DiscoveryJob for this Runtime/tenant/profile.
    const discoveryRequest = await post<{ request: { id: string; status: string } }>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId, profileId },
      auth
    );
    expect(discoveryRequest.status).toBe(201);
    expect(discoveryRequest.body.request.status).toBe('REQUESTED');
    const requestId = discoveryRequest.body.request.id;

    // 7. Runtime polls and claims its job.
    const claimed = await get<{ requests: Array<{ id: string; status: string }> }>(
      srv.baseUrl,
      '/erp-metadata/runtime/jobs',
      bearer(accessToken)
    );
    expect(claimed.body.requests.some((r) => r.id === requestId && r.status === 'CLAIMED')).toBe(
      true
    );

    // 8. Runtime performs the (fixture) local discovery and reports back.
    // GENESIS/ATHENA process the raw schema into a DatabaseIntelligenceReport.
    const result = await post<{ request: { status: string } }>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      { requestId, runtimeId, success: true, schema: buildRichErpSchemaFixture() },
      bearer(accessToken)
    );
    expect(result.status).toBe(200);
    expect(result.body.request.status).toBe('COMPLETED');

    // 9. Semantic Mapping (46.10) can now be triggered on top of that
    // erp-metadata report — orchestration only, no re-implementation.
    const analyzed = await post<{ summary: { tablesAnalyzed: number; pending: number } }>(
      srv.baseUrl,
      '/semantic-mapping/analyze',
      { profileId },
      auth
    );
    expect(analyzed.status).toBe(200);
    expect(analyzed.body.summary.tablesAnalyzed).toBeGreaterThan(0);

    const entities = await get<{
      entities: Array<{ schema: string; table: string; suggestedEntity: string }>;
    }>(srv.baseUrl, `/semantic-mapping/entities?profileId=${profileId}`, auth);
    expect(entities.body.entities.length).toBeGreaterThan(0);

    for (const mapping of entities.body.entities) {
      const approved = await post(
        srv.baseUrl,
        '/semantic-mapping/approve',
        { profileId, schema: mapping.schema, table: mapping.table, decision: 'APPROVE' },
        auth
      );
      expect(approved.status).toBe(200);
    }

    // 10. Canonical Model (46.11) can now translate the approved business
    // entities into CBL — proving the full 46.12 -> 46.10 -> 46.11 chain.
    const built = await post<{
      model: { statistics: { totalEntities: number }; entities: Array<{ entityKind: string }> };
    }>(srv.baseUrl, '/canonical-model/build', { organizationId }, auth);
    expect(built.status).toBe(201);
    expect(built.body.model.statistics.totalEntities).toBeGreaterThan(0);
    expect(built.body.model.entities.some((e) => e.entityKind === 'PRODUCT')).toBe(true);
  });

  it("security: a second Runtime enrolled under a different tenant cannot see the first tenant's discovery job or job of another Runtime", async () => {
    const codeA = `E2EA${Date.now().toString(36)}`;
    const { organizationId: orgA } = await registerOrganization(srv.baseUrl, codeA);
    const issuedA = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: codeA },
      auth
    );
    const runtimeA = await registerDemoRuntime(srv.baseUrl, {
      organizationCode: codeA,
      activationKey: issuedA.body.activationKey.code,
    });
    const profileA = await createConnectionProfile(srv.baseUrl, auth, {
      runtimeId: runtimeA.body.data!.runtimeId,
      organizationId: orgA,
    });
    const jobA = await post<{ request: { id: string } }>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId: runtimeA.body.data!.runtimeId, organizationId: orgA, profileId: profileA },
      auth
    );

    const codeB = `E2EB${Date.now().toString(36)}`;
    const { organizationId: orgB } = await registerOrganization(srv.baseUrl, codeB);
    const issuedB = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: codeB },
      auth
    );
    const runtimeB = await registerDemoRuntime(srv.baseUrl, {
      organizationCode: codeB,
      activationKey: issuedB.body.activationKey.code,
    });
    expect(runtimeB.body.data?.organizationId).toBe(orgB);
    const accessTokenB = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeB.body.data!.runtimeId,
      runtimeB.keyPair.privateKeyPem
    );

    // Runtime B polls its own jobs — Runtime A's job must never appear.
    const jobsForB = await get<{ requests: Array<{ id: string }> }>(
      srv.baseUrl,
      '/erp-metadata/runtime/jobs',
      bearer(accessTokenB)
    );
    expect(jobsForB.body.requests.some((r) => r.id === jobA.body.request.id)).toBe(false);

    // Runtime B cannot submit a result for Runtime A's job either.
    const crossSubmit = await post<{ error?: { code: string } }>(
      srv.baseUrl,
      '/erp-metadata/runtime/result',
      {
        requestId: jobA.body.request.id,
        runtimeId: runtimeB.body.data!.runtimeId,
        success: true,
        schema: buildRichErpSchemaFixture(),
      },
      bearer(accessTokenB)
    );
    expect(crossSubmit.status).toBe(409);
    expect(crossSubmit.body.error?.code).toBe('RUNTIME_MISMATCH');
  });
});
