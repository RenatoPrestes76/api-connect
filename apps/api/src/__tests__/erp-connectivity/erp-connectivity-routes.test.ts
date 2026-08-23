import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  patch,
  del,
  bearer,
  superAdminAuth,
  registerActiveRuntimeWithKeys,
  signHealthReport,
  signDiagnosticsReport,
  obtainRuntimeAccessToken,
  type TestServer,
} from './helpers.js';
import { SEED_ORG_ID } from '../job-orchestration/helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { message: string; code: string };
}

interface ProfileBody {
  profile: {
    id: string;
    status: string;
    hasCredential: boolean;
    dbType: string;
    [key: string]: unknown;
  };
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

async function createProfile(overrides: Partial<Record<string, unknown>> = {}) {
  const { runtimeId, keyPair } = await registerActiveRuntimeWithKeys(srv.baseUrl);
  const created = await post<ProfileBody>(
    srv.baseUrl,
    '/erp-connectivity/profiles',
    {
      runtimeId,
      organizationId: SEED_ORG_ID,
      name: 'ERP Principal',
      dbType: 'POSTGRESQL',
      host: 'db.cliente.local',
      port: 5432,
      database: 'erp_prod',
      username: 'erp_user',
      password: 'S3nhaSuperSecreta!',
      ...overrides,
    },
    auth
  );
  return { runtimeId, keyPair, profileId: created.body.profile.id, created };
}

describe('rejects unauthenticated access', () => {
  it('403/401 without a valid admin token', async () => {
    const { status } = await get(srv.baseUrl, '/erp-connectivity/profiles');
    expect([401, 403]).toContain(status);
  });
});

describe('GET /erp-connectivity/drivers', () => {
  it('lists all six supported database drivers', async () => {
    const { status, body } = await get<{ drivers: Array<{ dbType: string }> }>(
      srv.baseUrl,
      '/erp-connectivity/drivers',
      auth
    );
    expect(status).toBe(200);
    const types = body.drivers.map((d) => d.dbType).sort();
    expect(types).toEqual(
      ['FIREBIRD', 'MARIADB', 'MYSQL', 'ORACLE', 'POSTGRESQL', 'SQLSERVER'].sort()
    );
  });
});

describe('POST /erp-connectivity/profiles — criação de perfil', () => {
  it('creates a connection profile in PENDING_VALIDATION, never exposing the password', async () => {
    const { created } = await createProfile();
    expect(created.status).toBe(201);
    expect(created.body.profile.status).toBe('PENDING_VALIDATION');
    expect(created.body.profile.hasCredential).toBe(true);
    expect(created.body.profile['password']).toBeUndefined();
    expect(created.body.profile['encryptedCredential']).toBeUndefined();
  });

  it('rejects an unsupported dbType', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-connectivity/profiles',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        name: 'ERP',
        dbType: 'DB2',
        host: 'h',
        port: 1,
        database: 'd',
        username: 'u',
        password: 'p',
      },
      auth
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('UNSUPPORTED_DB_TYPE');
  });

  it('rejects a Runtime belonging to a different organization (isolamento)', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-connectivity/profiles',
      {
        runtimeId,
        organizationId: 'org-does-not-match',
        name: 'ERP Principal',
        dbType: 'POSTGRESQL',
        host: 'db.cliente.local',
        port: 5432,
        database: 'erp_prod',
        username: 'erp_user',
        password: 'S3nhaSuperSecreta!',
      },
      auth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('RUNTIME_ORGANIZATION_MISMATCH');
  });

  it('returns 422 VALIDATION_ERROR when port is a string instead of a number (Sprint 46.18)', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-connectivity/profiles',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        name: 'ERP',
        dbType: 'POSTGRESQL',
        host: 'h',
        port: '5432',
        database: 'd',
        username: 'u',
        password: 'p',
      },
      auth
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 VALIDATION_ERROR when a required field is missing, and rejects before touching the store', async () => {
    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-connectivity/profiles',
      { runtimeId, organizationId: SEED_ORG_ID, name: 'ERP' },
      auth
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Criptografia das credenciais', () => {
  it('the admin DTO never exposes the credential; the Runtime JWT fetch decrypts it correctly', async () => {
    const { runtimeId, keyPair, profileId } = await createProfile({
      password: 'PlaintextOnlyForRuntime!',
    });

    const adminView = await get<ProfileBody>(
      srv.baseUrl,
      `/erp-connectivity/profiles/${profileId}`,
      auth
    );
    expect(adminView.body.profile['password']).toBeUndefined();

    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    const runtimeView = await get<{ profiles: Array<{ id: string; password: string }> }>(
      srv.baseUrl,
      '/erp-connectivity/runtime/profiles',
      bearer(accessToken)
    );
    expect(runtimeView.status).toBe(200);
    const match = runtimeView.body.profiles.find((p) => p.id === profileId);
    expect(match?.password).toBe('PlaintextOnlyForRuntime!');
  });
});

describe('PATCH /erp-connectivity/profiles/:id — rotação de credenciais', () => {
  it('rotates the credential and the Runtime fetch reflects the new password', async () => {
    const { runtimeId, keyPair, profileId } = await createProfile();

    const updated = await patch<ProfileBody>(
      srv.baseUrl,
      `/erp-connectivity/profiles/${profileId}`,
      { password: 'NovaSenhaRotacionada!' },
      auth
    );
    expect(updated.status).toBe(200);

    const accessToken = await obtainRuntimeAccessToken(
      srv.baseUrl,
      runtimeId,
      keyPair.privateKeyPem
    );
    const runtimeView = await get<{ profiles: Array<{ id: string; password: string }> }>(
      srv.baseUrl,
      '/erp-connectivity/runtime/profiles',
      bearer(accessToken)
    );
    const match = runtimeView.body.profiles.find((p) => p.id === profileId);
    expect(match?.password).toBe('NovaSenhaRotacionada!');

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(
      log.some((e) => e.action === 'CONNECTION_CREDENTIAL_ROTATED' && e.target === profileId)
    ).toBe(true);
  });

  it('rejects a non-numeric port on rotation instead of silently corrupting the profile (Sprint 46.18)', async () => {
    const { profileId } = await createProfile();
    const { status, body } = await patch<ErrorBody>(
      srv.baseUrl,
      `/erp-connectivity/profiles/${profileId}`,
      { port: 'not-a-port' },
      auth
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown extra field type mismatch (e.g. additionalParams as a non-object) (Sprint 46.18)', async () => {
    const { profileId } = await createProfile();
    const { status } = await patch(
      srv.baseUrl,
      `/erp-connectivity/profiles/${profileId}`,
      { additionalParams: 'not-an-object' },
      auth
    );
    expect(status).toBe(422);
  });
});

describe('DELETE /erp-connectivity/profiles/:id', () => {
  it('deletes a profile and it is no longer retrievable', async () => {
    const { profileId } = await createProfile();
    const { status } = await del(
      srv.baseUrl,
      `/erp-connectivity/profiles/${profileId}`,
      undefined,
      auth
    );
    expect(status).toBe(200);

    const { status: getStatus } = await get(
      srv.baseUrl,
      `/erp-connectivity/profiles/${profileId}`,
      auth
    );
    expect(getStatus).toBe(404);

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(
      log.some((e) => e.action === 'CONNECTION_PROFILE_DELETED' && e.target === profileId)
    ).toBe(true);
  });
});

describe('Diagnóstico de conexão / falha de autenticação', () => {
  it('records a diagnostics report and audits an authentication failure', async () => {
    const { runtimeId, keyPair, profileId } = await createProfile();
    const timestamp = new Date().toISOString();
    const fields = {
      profileId,
      runtimeId,
      dns: 'OK',
      tcp: 'OK',
      authentication: 'FAIL',
      database: 'FAIL',
      latencyMs: 14,
      permissions: 'OK',
      driver: 'PostgreSQL 16',
      encryption: 'TLS 1.3',
      timestamp,
    };
    const signature = signDiagnosticsReport(keyPair.privateKeyPem, fields);
    const { status, body } = await post<{ report: { overallOk: boolean } }>(
      srv.baseUrl,
      '/erp-connectivity/diagnostics-report',
      { ...fields, signature }
    );
    expect(status).toBe(200);
    expect(body.report.overallOk).toBe(false);

    const fetched = await get<{ report: { authentication: string; driver: string } }>(
      srv.baseUrl,
      `/erp-connectivity/profiles/${profileId}/diagnostics`,
      auth
    );
    expect(fetched.body.report.authentication).toBe('FAIL');
    expect(fetched.body.report.driver).toBe('PostgreSQL 16');

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(log.some((e) => e.action === 'CONNECTION_AUTH_FAILED' && e.target === profileId)).toBe(
      true
    );
  });

  it('rejects a diagnostics report signed by the wrong Runtime key', async () => {
    const { profileId, runtimeId } = await createProfile();
    const other = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const timestamp = new Date().toISOString();
    const fields = {
      profileId,
      runtimeId,
      dns: 'OK',
      tcp: 'OK',
      authentication: 'OK',
      database: 'OK',
      permissions: 'OK',
      driver: 'PostgreSQL 16',
      encryption: 'TLS 1.3',
      timestamp,
    };
    const badSignature = signDiagnosticsReport(other.keyPair.privateKeyPem, fields);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-connectivity/diagnostics-report',
      {
        ...fields,
        signature: badSignature,
      }
    );
    expect(status).toBe(401);
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });
});

describe('Monitoramento / timeout / perda de conexão / reconexão automática', () => {
  it('tracks response time, availability, and consecutive failures across reports', async () => {
    const { runtimeId, keyPair, profileId } = await createProfile();

    const report = (success: boolean, responseTimeMs: number) => {
      const timestamp = new Date().toISOString();
      const fields = { profileId, runtimeId, success, responseTimeMs, timestamp };
      const signature = signHealthReport(keyPair.privateKeyPem, fields);
      return post<{ health: { consecutiveFailures: number; availabilityPercent: number } }>(
        srv.baseUrl,
        '/erp-connectivity/health-report',
        { ...fields, signature }
      );
    };

    const first = await report(true, 12);
    expect(first.body.health.consecutiveFailures).toBe(0);
    expect(first.body.health.availabilityPercent).toBe(100);

    const withFailure = await report(false, 5000);
    expect(withFailure.body.health.consecutiveFailures).toBe(1);
    expect(withFailure.body.health.availabilityPercent).toBe(50);
  });

  it('opens the circuit after repeated consecutive failures (timeout / perda de conexão)', async () => {
    const { runtimeId, keyPair, profileId } = await createProfile();

    let last!: { status: number; body: { health: { circuitState: string } } };
    for (let i = 0; i < 5; i++) {
      const timestamp = new Date().toISOString();
      const fields = {
        profileId,
        runtimeId,
        success: false,
        error: 'connection timeout',
        timestamp,
      };
      const signature = signHealthReport(keyPair.privateKeyPem, fields);
      last = await post(srv.baseUrl, '/erp-connectivity/health-report', { ...fields, signature });
    }
    expect(last.body.health.circuitState).toBe('OPEN');

    const profileView = await get<ProfileBody>(
      srv.baseUrl,
      `/erp-connectivity/profiles/${profileId}`,
      auth
    );
    expect(profileView.body.profile.status).toBe('CIRCUIT_OPEN');
  });

  it('reports reconnected:true once a failing profile reports success again', async () => {
    const { runtimeId, keyPair, profileId } = await createProfile();

    const fail = async () => {
      const timestamp = new Date().toISOString();
      const fields = { profileId, runtimeId, success: false, error: 'ECONNRESET', timestamp };
      const signature = signHealthReport(keyPair.privateKeyPem, fields);
      return post<{ reconnected: boolean }>(srv.baseUrl, '/erp-connectivity/health-report', {
        ...fields,
        signature,
      });
    };
    await fail();

    const timestamp = new Date().toISOString();
    const fields = { profileId, runtimeId, success: true, responseTimeMs: 8, timestamp };
    const signature = signHealthReport(keyPair.privateKeyPem, fields);
    const recovered = await post<{ reconnected: boolean; health: { circuitState: string } }>(
      srv.baseUrl,
      '/erp-connectivity/health-report',
      { ...fields, signature }
    );
    expect(recovered.body.reconnected).toBe(true);

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(log.some((e) => e.action === 'CONNECTION_RECONNECTED' && e.target === profileId)).toBe(
      true
    );
  });

  it('masks a leaked connection-string credential in the stored health error', async () => {
    const { runtimeId, keyPair, profileId } = await createProfile();
    const timestamp = new Date().toISOString();
    const fields = {
      profileId,
      runtimeId,
      success: false,
      error:
        'connect ECONNREFUSED postgres://erp_user:S3nhaSuperSecreta!@db.cliente.local:5432/erp_prod',
      timestamp,
    };
    const signature = signHealthReport(keyPair.privateKeyPem, fields);
    await post(srv.baseUrl, '/erp-connectivity/health-report', { ...fields, signature });

    const healthView = await get<{ health: { history: Array<{ error: string | null }> } }>(
      srv.baseUrl,
      `/erp-connectivity/profiles/${profileId}/health`,
      auth
    );
    const lastEvent = healthView.body.health.history.at(-1);
    expect(lastEvent?.error).not.toContain('S3nhaSuperSecreta!');
    expect(lastEvent?.error).toContain('***:***@');
  });

  it('rejects a replayed health-report signature', async () => {
    const { runtimeId, keyPair, profileId } = await createProfile();
    const timestamp = new Date().toISOString();
    const fields = { profileId, runtimeId, success: true, responseTimeMs: 10, timestamp };
    const signature = signHealthReport(keyPair.privateKeyPem, fields);
    const body = { ...fields, signature };

    const first = await post(srv.baseUrl, '/erp-connectivity/health-report', body);
    expect(first.status).toBe(200);

    const replay = await post<ErrorBody>(srv.baseUrl, '/erp-connectivity/health-report', body);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REPLAY_REJECTED');
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) is forbidden from creating a connection profile', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorErpPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor ERP',
      email: `auditor-erp-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.62.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { runtimeId } = await registerActiveRuntimeWithKeys(srv.baseUrl);
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/erp-connectivity/profiles',
      {
        runtimeId,
        organizationId: SEED_ORG_ID,
        name: 'ERP',
        dbType: 'POSTGRESQL',
        host: 'h',
        port: 5432,
        database: 'd',
        username: 'u',
        password: 'p',
      },
      auditorAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('Audit trail', () => {
  it('records CONNECTION_PROFILE_CREATED for a newly created profile', async () => {
    const { profileId } = await createProfile();
    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(
      log.some((e) => e.action === 'CONNECTION_PROFILE_CREATED' && e.target === profileId)
    ).toBe(true);
  });
});
