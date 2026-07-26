import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  bearer,
  superAdminAuth,
  registerActiveRuntime,
  createConnectorWithVersion,
  type TestServer,
} from './helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';
import { connectorsStore } from '../../modules/connectors/connectors-store.js';

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

describe('rejects unauthenticated access', () => {
  it('403/401 without a valid admin token', async () => {
    const { status } = await get(srv.baseUrl, '/connectors');
    expect([401, 403]).toContain(status);
  });
});

describe('publicação de novo conector', () => {
  it('creates a connector and publishes a stable version with checksum + signature', async () => {
    const created = await post<{ connector: { id: string; status: string } }>(
      srv.baseUrl,
      '/connectors',
      {
        identifier: `sisrp-${Math.random().toString(36).slice(2, 8)}`,
        name: 'SISRP',
        category: 'ERP',
        vendor: 'SISRP Tecnologia',
        description: 'Conector SISRP',
        minRuntimeVersion: '1.0.0',
      },
      auth
    );
    expect(created.status).toBe(201);

    const published = await post<{ version: { checksum: string; packageSignature: string } }>(
      srv.baseUrl,
      '/connectors/publish',
      {
        connectorId: created.body.connector.id,
        version: '1.0.0',
        changelog: 'Initial',
        status: 'stable',
        minRuntimeVersion: '1.0.0',
        dependencies: [],
      },
      auth
    );
    expect(published.status).toBe(201);
    expect(published.body.version.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(published.body.version.packageSignature).toContain('.');
  });
});

describe('POST /connectors/assign', () => {
  it('installs successfully on a compatible, active Runtime', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl, '2.0.0');
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth, {
      minRuntimeVersion: '1.0.0',
    });

    const { status, body } = await post<{
      installation: { status: string; installedVersion: string };
    }>(srv.baseUrl, '/connectors/assign', { runtimeId, connectorId }, auth);
    expect(status).toBe(201);
    expect(body.installation.status).toBe('PENDING');
    expect(body.installation.installedVersion).toBe('1.0.0');
  });

  it('rejects assigning the same connector twice to the same Runtime', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl);
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth);

    const first = await post(srv.baseUrl, '/connectors/assign', { runtimeId, connectorId }, auth);
    expect(first.status).toBe(201);

    const second = await post<ErrorBody>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId },
      auth
    );
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_ASSIGNED');
  });

  it('rejects an incompatible Runtime version', async () => {
    // Sprint 46.3 itself enforces a 1.0.0 floor at registration time, so
    // this must be >= that floor but still below the connector's own
    // (higher) minRuntimeVersion, to exercise assign-time compatibility.
    const runtimeId = await registerActiveRuntime(srv.baseUrl, '1.0.0');
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth, {
      minRuntimeVersion: '2.0.0',
    });

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('INCOMPATIBLE_RUNTIME_VERSION');
  });

  it('rejects a tampered/corrupted package (checksum no longer matches its signature)', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl);
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth);

    // Simulate corruption: mutate the stored checksum after publish, so the
    // (still-valid) signature no longer matches what's on record.
    const versions = connectorsStore.listVersions(connectorId);
    versions[0]!.checksum = 'deadbeef'.repeat(8);

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('INVALID_PACKAGE_SIGNATURE');
  });

  it('rejects an outright invalid/forged signature', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl);
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth);

    const versions = connectorsStore.listVersions(connectorId);
    versions[0]!.packageSignature = 'not-a-real-signature';

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('INVALID_PACKAGE_SIGNATURE');
  });

  it('supports multiple different connectors installed on the same Runtime', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl);
    const a = await createConnectorWithVersion(srv.baseUrl, auth);
    const b = await createConnectorWithVersion(srv.baseUrl, auth);

    await post(srv.baseUrl, '/connectors/assign', { runtimeId, connectorId: a.connectorId }, auth);
    await post(srv.baseUrl, '/connectors/assign', { runtimeId, connectorId: b.connectorId }, auth);

    const { body } = await get<{ total: number }>(
      srv.baseUrl,
      `/runtime/${runtimeId}/connectors`,
      auth
    );
    expect(body.total).toBe(2);
  });
});

describe('POST /runtime/:id/update', () => {
  it('applies a compatible update', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl, '2.0.0');
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth, {
      minRuntimeVersion: '1.0.0',
    });
    await post(
      srv.baseUrl,
      '/connectors/publish',
      {
        connectorId,
        version: '1.1.0',
        changelog: 'Fix',
        status: 'stable',
        minRuntimeVersion: '1.0.0',
        dependencies: [],
      },
      auth
    );
    const assigned = await post<{ installation: { id: string } }>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId, version: '1.0.0' },
      auth
    );

    const { status, body } = await post<{
      installation: { installedVersion: string; previousVersion: string };
    }>(
      srv.baseUrl,
      `/runtime/${runtimeId}/update`,
      { installationId: assigned.body.installation.id, targetVersion: '1.1.0' },
      auth
    );
    expect(status).toBe(200);
    expect(body.installation.installedVersion).toBe('1.1.0');
    expect(body.installation.previousVersion).toBe('1.0.0');
  });

  it('rejects an incompatible update', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl, '1.0.0');
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth, {
      minRuntimeVersion: '1.0.0',
    });
    await post(
      srv.baseUrl,
      '/connectors/publish',
      {
        connectorId,
        version: '2.0.0',
        changelog: 'Breaking',
        status: 'stable',
        minRuntimeVersion: '3.0.0', // requires a much newer runtime
        dependencies: [],
      },
      auth
    );
    const assigned = await post<{ installation: { id: string } }>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId, version: '1.0.0' },
      auth
    );

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      `/runtime/${runtimeId}/update`,
      { installationId: assigned.body.installation.id, targetVersion: '2.0.0' },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('INCOMPATIBLE_RUNTIME_VERSION');
  });
});

describe('Automatic rollback on failed update', () => {
  it('reporting a failed update outcome restores the previous version automatically', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl, '2.0.0');
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth, {
      minRuntimeVersion: '1.0.0',
    });
    await post(
      srv.baseUrl,
      '/connectors/publish',
      {
        connectorId,
        version: '1.1.0',
        changelog: 'Fix',
        status: 'stable',
        minRuntimeVersion: '1.0.0',
        dependencies: [],
      },
      auth
    );
    const assigned = await post<{ installation: { id: string } }>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId, version: '1.0.0' },
      auth
    );
    const installationId = assigned.body.installation.id;

    await post(
      srv.baseUrl,
      `/runtime/${runtimeId}/update`,
      { installationId, targetVersion: '1.1.0' },
      auth
    );

    const { status, body } = await post<{
      installation: { status: string; installedVersion: string; failureReason: string };
    }>(
      srv.baseUrl,
      `/runtime/${runtimeId}/connectors/${installationId}/report`,
      { outcome: 'failure', reason: 'corrupted package on disk' },
      auth
    );
    expect(status).toBe(200);
    expect(body.installation.status).toBe('ROLLBACK');
    expect(body.installation.installedVersion).toBe('1.0.0'); // restored
    expect(body.installation.failureReason).toContain('corrupted');
  });

  it('a successful outcome report transitions the installation to RUNNING', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl);
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth);
    const assigned = await post<{ installation: { id: string } }>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId },
      auth
    );

    const { status, body } = await post<{ installation: { status: string } }>(
      srv.baseUrl,
      `/runtime/${runtimeId}/connectors/${assigned.body.installation.id}/report`,
      { outcome: 'success' },
      auth
    );
    expect(status).toBe(200);
    expect(body.installation.status).toBe('RUNNING');
  });
});

describe('POST /runtime/:id/rollback (manual)', () => {
  it('rolls back a Runtime-scoped installation to its previous version', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl, '2.0.0');
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth, {
      minRuntimeVersion: '1.0.0',
    });
    await post(
      srv.baseUrl,
      '/connectors/publish',
      {
        connectorId,
        version: '1.1.0',
        changelog: 'Fix',
        status: 'stable',
        minRuntimeVersion: '1.0.0',
        dependencies: [],
      },
      auth
    );
    const assigned = await post<{ installation: { id: string } }>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId, version: '1.0.0' },
      auth
    );
    const installationId = assigned.body.installation.id;
    await post(
      srv.baseUrl,
      `/runtime/${runtimeId}/update`,
      { installationId, targetVersion: '1.1.0' },
      auth
    );

    const { status, body } = await post<{
      installation: { installedVersion: string; status: string };
    }>(srv.baseUrl, `/runtime/${runtimeId}/rollback`, { installationId }, auth);
    expect(status).toBe(200);
    expect(body.installation.installedVersion).toBe('1.0.0');
    expect(body.installation.status).toBe('ROLLBACK');
  });

  it('rejects rollback when there is no previous version', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl);
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth);
    const assigned = await post<{ installation: { id: string } }>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId },
      auth
    );

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      `/runtime/${runtimeId}/rollback`,
      { installationId: assigned.body.installation.id },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('NO_PREVIOUS_VERSION');
  });
});

describe('Safe connector removal from the registry', () => {
  it('deprecating a connector at the registry level does not corrupt existing installations', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl);
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth);
    const assigned = await post<{ installation: { id: string } }>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId },
      auth
    );

    connectorsStore.setConnectorStatus(connectorId, 'deprecated');

    const { body } = await get<{ installations: Array<{ id: string; connectorName: string }> }>(
      srv.baseUrl,
      `/runtime/${runtimeId}/connectors`,
      auth
    );
    const found = body.installations.find((i) => i.id === assigned.body.installation.id);
    expect(found).toBeTruthy();
    expect(found?.connectorName).toBeTruthy();
  });
});

describe('RBAC', () => {
  it('AUDITOR (read-only) is forbidden from assigning a connector', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorConnMgmtPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor CM',
      email: `auditor-cm-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.50.9.9' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const runtimeId = await registerActiveRuntime(srv.baseUrl);
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth);

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId },
      auditorAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('Audit trail', () => {
  it('records CONNECTOR_ASSIGNED, CONNECTOR_UPDATE_REQUESTED, and CONNECTOR_ROLLED_BACK entries', async () => {
    const runtimeId = await registerActiveRuntime(srv.baseUrl, '2.0.0');
    const { connectorId } = await createConnectorWithVersion(srv.baseUrl, auth, {
      minRuntimeVersion: '1.0.0',
    });
    await post(
      srv.baseUrl,
      '/connectors/publish',
      {
        connectorId,
        version: '1.1.0',
        changelog: 'Fix',
        status: 'stable',
        minRuntimeVersion: '1.0.0',
        dependencies: [],
      },
      auth
    );
    const assigned = await post<{ installation: { id: string } }>(
      srv.baseUrl,
      '/connectors/assign',
      { runtimeId, connectorId, version: '1.0.0' },
      auth
    );
    const installationId = assigned.body.installation.id;
    await post(
      srv.baseUrl,
      `/runtime/${runtimeId}/update`,
      { installationId, targetVersion: '1.1.0' },
      auth
    );
    await post(srv.baseUrl, `/runtime/${runtimeId}/rollback`, { installationId }, auth);

    const log = adminIdentityStore.getAuditLog({ limit: 500 });
    expect(log.some((e) => e.action === 'CONNECTOR_ASSIGNED' && e.target === installationId)).toBe(
      true
    );
    expect(
      log.some((e) => e.action === 'CONNECTOR_UPDATE_REQUESTED' && e.target === installationId)
    ).toBe(true);
    expect(
      log.some((e) => e.action === 'CONNECTOR_ROLLED_BACK' && e.target === installationId)
    ).toBe(true);
  });
});
