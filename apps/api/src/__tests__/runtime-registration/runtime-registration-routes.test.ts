import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  del,
  bearer,
  superAdminAuth,
  registerDemoRuntime,
  generateRuntimeKeyPair,
  signHeartbeat,
  type TestServer,
} from './helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { message: string; code: string };
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

// ─── Unauthenticated access ─────────────────────────────────────────────────

describe('rejects unauthenticated admin access', () => {
  it('403/401 without a valid admin token', async () => {
    const { status } = await get(srv.baseUrl, '/admin/runtime-registration/runtimes');
    expect([401, 403]).toContain(status);
  });
});

// ─── POST /runtime/register ─────────────────────────────────────────────────

describe('POST /runtime/register', () => {
  it('registers a valid Runtime and issues a certificate', async () => {
    const { status, body } = await registerDemoRuntime(srv.baseUrl, {
      activationKey: 'ATLAS-DEMO-0001',
    });
    expect(status).toBe(201);
    expect(body.data?.runtimeId).toBeTruthy();
    expect(body.data?.certificate).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT shape
    expect(body.data?.organizationId).toBe('org-demo-enterprise');
    expect(body.data?.connectorsEnabled.length).toBeGreaterThan(0);
    expect(body.data?.environments.length).toBe(3);
  });

  it('rejects missing required fields with 422', async () => {
    const { status, body } = await post<ErrorBody>(srv.baseUrl, '/runtime/register', {
      organizationCode: 'ORG-0001',
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a runtime version below the minimum with 422', async () => {
    const { status, body } = await registerDemoRuntime(srv.baseUrl, {
      activationKey: 'below-min-key-does-not-matter', // fails on version before key check
      runtimeVersion: '0.5.0',
    });
    expect(status).toBe(422);
    expect(body.error?.code).toBe('UNSUPPORTED_RUNTIME_VERSION');
  });

  it('rejects an invalid activation key with 401', async () => {
    const { status, body } = await registerDemoRuntime(srv.baseUrl, {
      activationKey: 'NOT-A-REAL-KEY',
    });
    expect(status).toBe(401);
    expect(body.error?.code).toBe('ACTIVATION_KEY_INVALID');
  });

  it('rejects a nonexistent organization with 404', async () => {
    const { status, body } = await registerDemoRuntime(srv.baseUrl, {
      organizationCode: 'ORG-DOES-NOT-EXIST',
    });
    expect(status).toBe(404);
    expect(body.error?.code).toBe('ORGANIZATION_NOT_FOUND');
  });

  it('rejects a duplicate machine fingerprint with 409', async () => {
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const fingerprint = `fp-dup-${Date.now()}`;

    const first = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
      fingerprint,
    });
    expect(first.status).toBe(201);

    const issued2 = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const second = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued2.body.activationKey.code,
      fingerprint,
    });
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe('FINGERPRINT_DUPLICATE');
  });

  it('rejects reusing an already-used activation key with 409', async () => {
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const first = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
    });
    expect(first.status).toBe(201);

    const second = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
      fingerprint: `fp-${Math.random()}`,
    });
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe('ACTIVATION_KEY_ALREADY_USED');
  });

  it('rate-limits an IP after repeated failed registration attempts', async () => {
    const ip = `10.40.${Math.floor(Math.random() * 255)}.1`;
    const badAttempt = () =>
      post(
        srv.baseUrl,
        '/runtime/register',
        {
          organizationCode: 'ORG-0001',
          activationKey: 'WRONG-KEY',
          runtimeVersion: '1.0.0',
          fingerprint: `fp-ratelimit-${Math.random()}`,
          publicKey: 'irrelevant',
          hostname: 'ratelimit-test.local',
          os: 'linux',
        },
        { 'x-forwarded-for': ip }
      );

    for (let i = 0; i < 10; i++) {
      const { status } = await badAttempt();
      expect(status).toBe(401);
    }

    const { status, body } = await badAttempt();
    expect(status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});

// ─── POST /runtime/heartbeat ─────────────────────────────────────────────────

describe('POST /runtime/heartbeat', () => {
  it('records a valid signed heartbeat and activates the Runtime', async () => {
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const reg = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
    });
    const runtimeId = reg.body.data!.runtimeId;

    const timestamp = new Date().toISOString();
    const payloadFields = { runtimeId, version: '1.3.0', memory: 512, cpu: 12.5, timestamp };
    const signature = signHeartbeat(reg.keyPair.privateKeyPem, payloadFields);

    const { status, body } = await post<{ data: { status: string } }>(
      srv.baseUrl,
      '/runtime/heartbeat',
      { ...payloadFields, signature }
    );
    expect(status).toBe(200);
    expect(body.data.status).toBe('ACTIVE');
  });

  it('rejects heartbeat for a nonexistent runtime with 404', async () => {
    const { publicKeyPem, privateKeyPem } = generateRuntimeKeyPair();
    void publicKeyPem;
    const timestamp = new Date().toISOString();
    const payloadFields = {
      runtimeId: 'does-not-exist',
      version: '1.0.0',
      memory: 1,
      cpu: 1,
      timestamp,
    };
    const signature = signHeartbeat(privateKeyPem, payloadFields);
    const { status, body } = await post<ErrorBody>(srv.baseUrl, '/runtime/heartbeat', {
      ...payloadFields,
      signature,
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a heartbeat with an invalid signature with 401', async () => {
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const reg = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
    });
    const runtimeId = reg.body.data!.runtimeId;
    const timestamp = new Date().toISOString();
    const payloadFields = { runtimeId, version: '1.0.0', memory: 1, cpu: 1, timestamp };

    // Signed with a DIFFERENT (unregistered) key pair — must fail verification.
    const forger = generateRuntimeKeyPair();
    const badSignature = signHeartbeat(forger.privateKeyPem, payloadFields);

    const { status, body } = await post<ErrorBody>(srv.baseUrl, '/runtime/heartbeat', {
      ...payloadFields,
      signature: badSignature,
    });
    expect(status).toBe(401);
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('rejects a heartbeat with a stale timestamp (replay protection) with 401', async () => {
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const reg = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
    });
    const runtimeId = reg.body.data!.runtimeId;
    const staleTimestamp = new Date(Date.now() - 60 * 60_000).toISOString(); // 1h old
    const payloadFields = {
      runtimeId,
      version: '1.0.0',
      memory: 1,
      cpu: 1,
      timestamp: staleTimestamp,
    };
    const signature = signHeartbeat(reg.keyPair.privateKeyPem, payloadFields);

    const { status, body } = await post<ErrorBody>(srv.baseUrl, '/runtime/heartbeat', {
      ...payloadFields,
      signature,
    });
    expect(status).toBe(401);
    expect(body.error.code).toBe('REPLAY_REJECTED');
  });

  it('rejects a verbatim replay of an already-accepted heartbeat with 401', async () => {
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const reg = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
    });
    const runtimeId = reg.body.data!.runtimeId;
    const timestamp = new Date().toISOString();
    const payloadFields = { runtimeId, version: '1.0.0', memory: 1, cpu: 1, timestamp };
    const signature = signHeartbeat(reg.keyPair.privateKeyPem, payloadFields);

    const first = await post(srv.baseUrl, '/runtime/heartbeat', { ...payloadFields, signature });
    expect(first.status).toBe(200);

    // Same exact request replayed verbatim (still within the timestamp window).
    const replayed = await post<ErrorBody>(srv.baseUrl, '/runtime/heartbeat', {
      ...payloadFields,
      signature,
    });
    expect(replayed.status).toBe(401);
    expect(replayed.body.error.code).toBe('REPLAY_REJECTED');
  });
});

// ─── Lifecycle: block / reactivate / revoke certificate ────────────────────

describe('Runtime lifecycle (admin)', () => {
  it('blocking a Runtime rejects subsequent heartbeats, reactivating restores it', async () => {
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const reg = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
    });
    const runtimeId = reg.body.data!.runtimeId;

    const blocked = await post(
      srv.baseUrl,
      `/admin/runtime-registration/runtimes/${runtimeId}/block`,
      undefined,
      auth
    );
    expect(blocked.status).toBe(200);

    const timestamp = new Date().toISOString();
    const payloadFields = { runtimeId, version: '1.0.0', memory: 1, cpu: 1, timestamp };
    const signature = signHeartbeat(reg.keyPair.privateKeyPem, payloadFields);
    const rejected = await post<ErrorBody>(srv.baseUrl, '/runtime/heartbeat', {
      ...payloadFields,
      signature,
    });
    expect(rejected.status).toBe(403);
    expect(rejected.body.error.code).toBe('RUNTIME_NOT_ACTIVE');

    const reactivated = await post(
      srv.baseUrl,
      `/admin/runtime-registration/runtimes/${runtimeId}/reactivate`,
      undefined,
      auth
    );
    expect(reactivated.status).toBe(200);

    const timestamp2 = new Date().toISOString();
    const payloadFields2 = {
      runtimeId,
      version: '1.0.1',
      memory: 2,
      cpu: 2,
      timestamp: timestamp2,
    };
    const signature2 = signHeartbeat(reg.keyPair.privateKeyPem, payloadFields2);
    const accepted = await post<{ data: { status: string } }>(srv.baseUrl, '/runtime/heartbeat', {
      ...payloadFields2,
      signature: signature2,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('ACTIVE');
  });

  it('revoking credentials permanently rejects further heartbeats', async () => {
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const reg = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
    });
    const runtimeId = reg.body.data!.runtimeId;

    const revoked = await del(
      srv.baseUrl,
      `/admin/runtime-registration/runtimes/${runtimeId}/credentials`,
      undefined,
      auth
    );
    expect(revoked.status).toBe(200);

    const detail = await get<{ runtime: { status: string } }>(
      srv.baseUrl,
      `/admin/runtime-registration/runtimes/${runtimeId}`,
      auth
    );
    expect(detail.body.runtime.status).toBe('REVOKED');

    const timestamp = new Date().toISOString();
    const payloadFields = { runtimeId, version: '1.0.0', memory: 1, cpu: 1, timestamp };
    const signature = signHeartbeat(reg.keyPair.privateKeyPem, payloadFields);
    const rejected = await post<ErrorBody>(srv.baseUrl, '/runtime/heartbeat', {
      ...payloadFields,
      signature,
    });
    expect(rejected.status).toBe(403);
    expect(rejected.body.error.code).toBe('RUNTIME_NOT_ACTIVE');
  });
});

// ─── Admin listing ───────────────────────────────────────────────────────────

describe('GET /admin/runtime-registration/runtimes', () => {
  it('lists registered runtimes for the SUPER_ADMIN', async () => {
    const { status, body } = await get<{ total: number; runtimes: unknown[] }>(
      srv.baseUrl,
      '/admin/runtime-registration/runtimes',
      auth
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    expect(body.runtimes.length).toBe(body.total);
  });
});

// ─── RBAC ────────────────────────────────────────────────────────────────────

describe('RBAC', () => {
  it('AUDITOR (read-only) is forbidden from blocking a Runtime', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorRuntimePass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor Runtime',
      email: `auditor-runtime-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });

    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.30.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const reg = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
    });

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      `/admin/runtime-registration/runtimes/${reg.body.data!.runtimeId}/block`,
      undefined,
      auditorAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

// ─── Audit ───────────────────────────────────────────────────────────────────

describe('Audit trail', () => {
  it('records RUNTIME_REGISTERED and RUNTIME_ACTIVATED entries', async () => {
    const issued = await post<{ activationKey: { code: string } }>(
      srv.baseUrl,
      '/admin/runtime-registration/activation-keys',
      { organizationCode: 'ORG-0001' },
      auth
    );
    const reg = await registerDemoRuntime(srv.baseUrl, {
      activationKey: issued.body.activationKey.code,
    });
    const runtimeId = reg.body.data!.runtimeId;

    const timestamp = new Date().toISOString();
    const payloadFields = { runtimeId, version: '1.0.0', memory: 1, cpu: 1, timestamp };
    const signature = signHeartbeat(reg.keyPair.privateKeyPem, payloadFields);
    await post(srv.baseUrl, '/runtime/heartbeat', { ...payloadFields, signature });

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(log.some((e) => e.action === 'RUNTIME_REGISTERED' && e.target === runtimeId)).toBe(true);
    expect(log.some((e) => e.action === 'RUNTIME_ACTIVATED' && e.target === runtimeId)).toBe(true);
  });
});
