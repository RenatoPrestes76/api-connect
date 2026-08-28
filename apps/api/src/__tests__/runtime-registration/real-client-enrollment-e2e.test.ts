import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  superAdminAuth,
  registerOrganization,
  createConnectionProfile,
  type TestServer,
} from '../canonical-model/helpers.js';

// ATLAS 46.20-B — the real Runtime client (apps/agent/src/atlas-runtime-client),
// the same module apps/agent's bootstrap wires into Phase 7, driving this
// server over genuine HTTP. Nothing here calls an apps/api service
// directly — every step below is a real fetch() against a real listening
// socket, exactly like every other *-e2e.test.ts in this directory, the
// only difference being the client code under test lives in a sibling app
// rather than in this file's own test helpers.
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
import { prisma } from '../../services/prisma.js';

const SCAN_TARGET = {
  host: 'localhost',
  port: 5433,
  database: 'seltriva_connect',
  username: 'seltriva',
  password: 'seltriva_dev_password',
};

describe('ATLAS 46.20-B — real Runtime client end-to-end against a real Atlas API', () => {
  let srv: TestServer;
  let auth: Record<string, string>;
  let dataDir: string;

  beforeAll(async () => {
    srv = await startTestServer();
    auth = await superAdminAuth(srv.baseUrl);
    dataDir = mkdtempSync(join(tmpdir(), 'atlas-runtime-client-e2e-'));
  });

  afterAll(async () => {
    await srv.close();
    rmSync(dataDir, { recursive: true, force: true });
    // ATLAS 46.21: registerOrganization() now also links a real Control
    // Plane Organization in Postgres — clean up this file's own slugs.
    await prisma.organization.deleteMany({ where: { slug: { startsWith: 'RC' } } });
  });

  it('register -> auth token -> heartbeat -> discover -> claim -> execute (real GENESIS scan) -> submit result', async () => {
    // 1. Tenant + enrollment code, same as the fixture-based e2e proof.
    const orgCode = `RC${Date.now().toString(36)}`;
    const { organizationId } = await registerOrganization(srv.baseUrl, orgCode);
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: orgCode },
      auth
    );
    expect(issued.status).toBe(201);

    // 2. The real client generates its own identity and registers for real.
    const identity = loadOrCreateIdentity(dataDir);
    expect(identity.runtimeId).toBeNull();

    const registered = await registerRuntime(srv.baseUrl, identity, {
      organizationCode: orgCode,
      activationKey: issued.body.activationKey.code,
      runtimeVersion: '1.2.0',
      hostname: 'real-client-e2e-host',
      os: 'linux',
      capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
    });
    expect(registered.organizationId).toBe(organizationId);
    const runtimeId = registered.runtimeId;
    const enrolledIdentity = { ...identity, runtimeId };

    // 3. Real heartbeat, signed by the real client.
    const heartbeat = await sendHeartbeat(srv.baseUrl, enrolledIdentity, {
      version: '1.2.0',
      memory: 256,
      cpu: 2.1,
      capabilities: ['DATABASE_ACCESS', 'POSTGRES'],
    });
    expect(heartbeat.status).toBe('ACTIVE');

    // 4. Real JWT session exchange, signed by the real client.
    const { accessToken } = await obtainAccessToken(
      srv.baseUrl,
      runtimeId,
      enrolledIdentity.privateKeyPem
    );
    expect(typeof accessToken).toBe('string');
    expect(accessToken.length).toBeGreaterThan(0);

    // 5. Atlas creates a discovery job for this Runtime.
    const profileId = await createConnectionProfile(srv.baseUrl, auth, {
      runtimeId,
      organizationId,
    });
    const discoveryRequest = await post<{ request: { id: string; status: string } }>(
      srv.baseUrl,
      '/erp-metadata/discover',
      { runtimeId, organizationId, profileId },
      auth
    );
    expect(discoveryRequest.status).toBe(201);
    const requestId = discoveryRequest.body.request.id;

    // 6. The real client polls and claims it.
    const jobs = await pollJobs(srv.baseUrl, accessToken);
    expect(jobs.some((j) => j.id === requestId && j.status === 'CLAIMED')).toBe(true);

    // 7. The real client executes the job — a genuine GENESIS
    // (PostgresDriver) introspection of a real, reachable Postgres, not
    // a fixture — and submits the real result.
    const schema = await executeDiscoveryScan(SCAN_TARGET);
    expect(schema.tables.length).toBeGreaterThan(0);

    const result = await submitResult(srv.baseUrl, accessToken, {
      requestId,
      runtimeId,
      success: true,
      schema,
    });
    expect(result.request.status).toBe('COMPLETED');

    // 8. ATHENA classification already ran server-side inside
    // reportSchema() — proven by semantic-mapping being able to analyze
    // this same profile afterward (mirrors the fixture-based e2e's own
    // proof, without re-running the whole canonical-model chain here).
    const analyzed = await post<{ summary: { tablesAnalyzed: number } }>(
      srv.baseUrl,
      '/semantic-mapping/analyze',
      { profileId },
      auth
    );
    expect(analyzed.status).toBe(200);
    expect(analyzed.body.summary.tablesAnalyzed).toBeGreaterThan(0);
  }, 30_000);

  describe('negative cases (Fase 13)', () => {
    it('rejects a heartbeat signed with the wrong private key (invalid signature)', async () => {
      const orgCode = `RCNEG${Date.now().toString(36)}`;
      await registerOrganization(srv.baseUrl, orgCode);
      const issued = await post<{ activationKey: { code: string } }>(
        srv.baseUrl,
        '/admin/runtime-registration/activation-keys',
        { organizationCode: orgCode },
        auth
      );
      const dir = mkdtempSync(join(tmpdir(), 'atlas-runtime-client-neg-'));
      try {
        const identity = loadOrCreateIdentity(dir);
        const registered = await registerRuntime(srv.baseUrl, identity, {
          organizationCode: orgCode,
          activationKey: issued.body.activationKey.code,
          runtimeVersion: '1.2.0',
          hostname: 'neg-host',
          os: 'linux',
        });

        // A different identity's private key — the signature won't match
        // the registered public key.
        const wrongIdentity = loadOrCreateIdentity(
          mkdtempSync(join(tmpdir(), 'atlas-runtime-client-wrongkey-'))
        );
        await expect(
          sendHeartbeat(
            srv.baseUrl,
            { ...wrongIdentity, runtimeId: registered.runtimeId },
            { version: '1.2.0', memory: 100, cpu: 1 }
          )
        ).rejects.toMatchObject({ status: 401, code: 'INVALID_SIGNATURE' });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('rejects a replayed heartbeat signature (the exact same signed request twice)', async () => {
      const orgCode = `RCREPLAY${Date.now().toString(36)}`;
      await registerOrganization(srv.baseUrl, orgCode);
      const issued = await post<{ activationKey: { code: string } }>(
        srv.baseUrl,
        '/admin/runtime-registration/activation-keys',
        { organizationCode: orgCode },
        auth
      );
      const dir = mkdtempSync(join(tmpdir(), 'atlas-runtime-client-replay-'));
      try {
        const identity = loadOrCreateIdentity(dir);
        const registered = await registerRuntime(srv.baseUrl, identity, {
          organizationCode: orgCode,
          activationKey: issued.body.activationKey.code,
          runtimeVersion: '1.2.0',
          hostname: 'replay-host',
          os: 'linux',
        });
        const enrolled = { ...identity, runtimeId: registered.runtimeId };

        // Build one signed heartbeat request by hand (bypassing the
        // client's own fresh-timestamp-per-call behavior) and send it
        // twice — the second must be rejected as a replay.
        const { canonicalHeartbeatPayload, signPayload } =
          await import('../../../../agent/src/atlas-runtime-client/protocol.js');
        const timestamp = new Date().toISOString();
        const fields = {
          runtimeId: registered.runtimeId,
          version: '1.2.0',
          memory: 100,
          cpu: 1,
          timestamp,
        };
        const signature = signPayload(enrolled.privateKeyPem, canonicalHeartbeatPayload(fields));

        const first = await post(srv.baseUrl, '/runtime/heartbeat', { ...fields, signature });
        expect(first.status).toBe(200);

        const second = await post(srv.baseUrl, '/runtime/heartbeat', { ...fields, signature });
        expect(second.status).toBe(401);
        expect((second.body as { error?: { code: string } }).error?.code).toBe('REPLAY_REJECTED');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('rejects an expired timestamp outside the replay-tolerance window', async () => {
      const orgCode = `RCEXP${Date.now().toString(36)}`;
      await registerOrganization(srv.baseUrl, orgCode);
      const issued = await post<{ activationKey: { code: string } }>(
        srv.baseUrl,
        '/admin/runtime-registration/activation-keys',
        { organizationCode: orgCode },
        auth
      );
      const dir = mkdtempSync(join(tmpdir(), 'atlas-runtime-client-expired-'));
      try {
        const identity = loadOrCreateIdentity(dir);
        const registered = await registerRuntime(srv.baseUrl, identity, {
          organizationCode: orgCode,
          activationKey: issued.body.activationKey.code,
          runtimeVersion: '1.2.0',
          hostname: 'expired-host',
          os: 'linux',
        });

        const { canonicalHeartbeatPayload, signPayload } =
          await import('../../../../agent/src/atlas-runtime-client/protocol.js');
        const staleTimestamp = new Date(Date.now() - 10 * 60_000).toISOString(); // 10 min ago, tolerance is 5
        const fields = {
          runtimeId: registered.runtimeId,
          version: '1.2.0',
          memory: 100,
          cpu: 1,
          timestamp: staleTimestamp,
        };
        const signature = signPayload(identity.privateKeyPem, canonicalHeartbeatPayload(fields));

        const res = await post(srv.baseUrl, '/runtime/heartbeat', { ...fields, signature });
        expect(res.status).toBe(401);
        expect((res.body as { error?: { code: string } }).error?.code).toBe('REPLAY_REJECTED');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('rejects an unknown runtimeId at auth-token exchange, even with a validly-signed request', async () => {
      // A real keypair and a real signature — the only thing wrong is the
      // runtimeId doesn't correspond to any registered Runtime. Using a
      // real key here (rather than a garbage PEM string) proves the 404
      // comes from the server's runtime lookup, not from this client
      // failing to sign at all.
      const dir = mkdtempSync(join(tmpdir(), 'atlas-runtime-client-unknown-'));
      try {
        const identity = loadOrCreateIdentity(dir);
        await expect(
          obtainAccessToken(srv.baseUrl, 'rt_does_not_exist', identity.privateKeyPem)
        ).rejects.toMatchObject({ status: 404 });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('rejects an unauthenticated job poll (no bearer token)', async () => {
      const res = await get(srv.baseUrl, '/erp-metadata/runtime/jobs');
      expect(res.status).toBe(401);
    });

    it("rejects one runtime's result submission for a job belonging to a different tenant/runtime", async () => {
      const codeA = `RCXA${Date.now().toString(36)}`;
      const { organizationId: orgA } = await registerOrganization(srv.baseUrl, codeA);
      const issuedA = await post<{ activationKey: { code: string } }>(
        srv.baseUrl,
        '/admin/runtime-registration/activation-keys',
        { organizationCode: codeA },
        auth
      );
      const dirA = mkdtempSync(join(tmpdir(), 'atlas-runtime-client-tenA-'));
      const identityA = loadOrCreateIdentity(dirA);
      const registeredA = await registerRuntime(srv.baseUrl, identityA, {
        organizationCode: codeA,
        activationKey: issuedA.body.activationKey.code,
        runtimeVersion: '1.2.0',
        hostname: 'tenant-a-host',
        os: 'linux',
      });
      const profileA = await createConnectionProfile(srv.baseUrl, auth, {
        runtimeId: registeredA.runtimeId,
        organizationId: orgA,
      });
      const jobA = await post<{ request: { id: string } }>(
        srv.baseUrl,
        '/erp-metadata/discover',
        { runtimeId: registeredA.runtimeId, organizationId: orgA, profileId: profileA },
        auth
      );

      const codeB = `RCXB${Date.now().toString(36)}`;
      await registerOrganization(srv.baseUrl, codeB);
      const issuedB = await post<{ activationKey: { code: string } }>(
        srv.baseUrl,
        '/admin/runtime-registration/activation-keys',
        { organizationCode: codeB },
        auth
      );
      const dirB = mkdtempSync(join(tmpdir(), 'atlas-runtime-client-tenB-'));
      try {
        const identityB = loadOrCreateIdentity(dirB);
        const registeredB = await registerRuntime(srv.baseUrl, identityB, {
          organizationCode: codeB,
          activationKey: issuedB.body.activationKey.code,
          runtimeVersion: '1.2.0',
          hostname: 'tenant-b-host',
          os: 'linux',
        });
        const { accessToken: tokenB } = await obtainAccessToken(
          srv.baseUrl,
          registeredB.runtimeId,
          identityB.privateKeyPem
        );

        await expect(
          submitResult(srv.baseUrl, tokenB, {
            requestId: jobA.body.request.id,
            runtimeId: registeredB.runtimeId,
            success: true,
            schema: { name: 'public', tables: [], relations: [], discoveredAt: new Date() },
          })
        ).rejects.toMatchObject({ status: 409, code: 'RUNTIME_MISMATCH' });
      } finally {
        rmSync(dirA, { recursive: true, force: true });
        rmSync(dirB, { recursive: true, force: true });
      }
    });
  });
});
