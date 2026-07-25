import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  patch,
  del,
  bearer,
  superAdminAuth,
  seededOwnerAuth,
  type TestServer,
} from './helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

interface ErrorBody {
  error: { code: string; message: string };
}
interface ConnectorBody {
  id: string;
  identifier: string;
  name: string;
  category: string;
  status: string;
  currentVersion: string | null;
}
interface ConnectorsListResponse {
  total: number;
  connectors: ConnectorBody[];
}
interface VersionBody {
  id: string;
  version: string;
  status: string;
}
interface ParameterBody {
  id: string;
  key: string;
  type: string;
  required: boolean;
}
interface TemplateBody {
  id: string;
  name: string;
  values: Record<string, unknown>;
  secretKeys: string[];
}
interface ValidateResponse {
  valid: boolean;
  issues: Array<{ key: string; message: string }>;
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

// ─── Auth guard sanity ────────────────────────────────────────────────────────

describe('Connector registry routes require admin auth', () => {
  it('rejects unauthenticated access to connectors', async () => {
    const { status } = await get(srv.baseUrl, '/admin/connector-registry/connectors', {});
    expect(status).toBe(401);
  });
});

// ─── CRUD ───────────────────────────────────────────────────────────────────

describe('Connector CRUD', () => {
  it('lists the seeded connectors', async () => {
    const { status, body } = await get<ConnectorsListResponse>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      auth
    );
    expect(status).toBe(200);
    expect(body.connectors.some((c) => c.identifier === 'postgresql')).toBe(true);
  });

  it('creates, updates, activates, and deactivates a connector', async () => {
    const create = await post<ConnectorBody>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      {
        identifier: 'mysql-test',
        name: 'MySQL',
        category: 'DATABASE',
        vendor: 'Oracle',
        description: 'Conector MySQL',
        minRuntimeVersion: '1.0.0',
      },
      auth
    );
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('beta');
    const id = create.body.id;

    const updated = await patch<ConnectorBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${id}`,
      { description: 'Conector MySQL atualizado' },
      auth
    );
    expect(updated.status).toBe(200);

    const activated = await post<ConnectorBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${id}/activate`,
      undefined,
      auth
    );
    expect(activated.status).toBe(200);
    expect(activated.body.status).toBe('active');

    const deactivated = await post<ConnectorBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${id}/deactivate`,
      undefined,
      auth
    );
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.status).toBe('deprecated');

    const deleted = await del(srv.baseUrl, `/admin/connector-registry/connectors/${id}`, auth);
    expect(deleted.status).toBe(200);

    const readAfterDelete = await get(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${id}`,
      auth
    );
    expect(readAfterDelete.status).toBe(404);
  });

  it('rejects a duplicate identifier', async () => {
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      {
        identifier: 'postgresql',
        name: 'PostgreSQL Duplicado',
        category: 'DATABASE',
        vendor: 'X',
        description: 'X',
        minRuntimeVersion: '1.0.0',
      },
      auth
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('IDENTIFIER_TAKEN');
  });

  it('returns 400 MISSING_FIELDS when creating without required fields', async () => {
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      { name: 'Incomplete' },
      auth
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });
});

// ─── Versioning ─────────────────────────────────────────────────────────────

describe('Versioning', () => {
  it('publishes a stable version and promotes the connector from beta to active', async () => {
    const create = await post<ConnectorBody>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      {
        identifier: 'oracle-test',
        name: 'Oracle',
        category: 'DATABASE',
        vendor: 'Oracle',
        description: 'Conector Oracle',
        minRuntimeVersion: '1.0.0',
      },
      auth
    );
    const id = create.body.id;
    expect(create.body.status).toBe('beta');

    const version = await post<VersionBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${id}/versions`,
      {
        version: '1.0.0',
        changelog: 'Initial release',
        status: 'stable',
        minRuntimeVersion: '1.0.0',
      },
      auth
    );
    expect(version.status).toBe(201);
    expect(version.body.status).toBe('stable');

    const connector = await get<ConnectorBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${id}`,
      auth
    );
    expect(connector.body.status).toBe('active');
    expect(connector.body.currentVersion).toBe('1.0.0');

    const versions = await get<{ total: number }>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${id}/versions`,
      auth
    );
    expect(versions.body.total).toBe(1);
  });

  it('a beta version does not change the connector status or currentVersion', async () => {
    const create = await post<ConnectorBody>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      {
        identifier: 'sap-test',
        name: 'SAP',
        category: 'ERP',
        vendor: 'SAP',
        description: 'Conector SAP',
        minRuntimeVersion: '1.0.0',
      },
      auth
    );
    const id = create.body.id;

    await post(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${id}/versions`,
      { version: '0.1.0-beta', changelog: 'Preview', status: 'beta', minRuntimeVersion: '1.0.0' },
      auth
    );

    const connector = await get<ConnectorBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${id}`,
      auth
    );
    expect(connector.body.status).toBe('beta');
    expect(connector.body.currentVersion).toBeNull();
  });
});

// ─── Parameters ─────────────────────────────────────────────────────────────

describe('Parameters', () => {
  it('registers, updates, and deletes a parameter', async () => {
    const create = await post<ConnectorBody>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      {
        identifier: 'ftp-test',
        name: 'FTP',
        category: 'FTP_SFTP',
        vendor: 'Atlas',
        description: 'Conector FTP',
        minRuntimeVersion: '1.0.0',
      },
      auth
    );
    const connectorId = create.body.id;

    const param = await post<ParameterBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/parameters`,
      { key: 'host', label: 'Host', type: 'string', required: true, sensitive: true },
      auth
    );
    expect(param.status).toBe(201);
    expect(param.body.key).toBe('host');

    const updated = await patch<ParameterBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/parameters/${param.body.id}`,
      { required: false },
      auth
    );
    expect(updated.status).toBe(200);
    expect(updated.body.required).toBe(false);

    const deleted = await del(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/parameters/${param.body.id}`,
      auth
    );
    expect(deleted.status).toBe(200);
  });

  it('rejects an enum parameter without options', async () => {
    const create = await post<ConnectorBody>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      {
        identifier: 'webhook-test',
        name: 'Webhook',
        category: 'WEBHOOK',
        vendor: 'Atlas',
        description: 'Conector Webhook',
        minRuntimeVersion: '1.0.0',
      },
      auth
    );
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${create.body.id}/parameters`,
      { key: 'method', label: 'Método', type: 'enum', required: true },
      auth
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_OPTIONS');
  });
});

// ─── Validation ─────────────────────────────────────────────────────────────

describe('Configuration validation', () => {
  it('reports missing required fields and wrong types without connecting', async () => {
    const postgres = await get<ConnectorsListResponse>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      auth
    );
    const connectorId = postgres.body.connectors.find((c) => c.identifier === 'postgresql')!.id;

    const { status, body } = await post<ValidateResponse>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/validate`,
      { host: 'db.example.com', port: 'not-a-number' },
      auth
    );
    expect(status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.issues.some((i) => i.key === 'database')).toBe(true);
    expect(body.issues.some((i) => i.key === 'port')).toBe(true);
  });

  it('enforces requiredIf: sslCertificate becomes required only when ssl=true', async () => {
    const postgres = await get<ConnectorsListResponse>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      auth
    );
    const connectorId = postgres.body.connectors.find((c) => c.identifier === 'postgresql')!.id;
    const base = {
      host: 'db.example.com',
      port: 5432,
      database: 'atlas',
      username: 'atlas',
      password: 'S3cret!',
    };

    const withoutSsl = await post<ValidateResponse>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/validate`,
      base,
      auth
    );
    expect(withoutSsl.body.valid).toBe(true);

    const withSsl = await post<ValidateResponse>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/validate`,
      { ...base, ssl: true },
      auth
    );
    expect(withSsl.body.valid).toBe(false);
    expect(withSsl.body.issues.some((i) => i.key === 'sslCertificate')).toBe(true);
  });

  it('passes with a fully valid configuration', async () => {
    const postgres = await get<ConnectorsListResponse>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      auth
    );
    const connectorId = postgres.body.connectors.find((c) => c.identifier === 'postgresql')!.id;

    const { body } = await post<ValidateResponse>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/validate`,
      {
        host: 'db.example.com',
        port: 5432,
        database: 'atlas',
        username: 'atlas',
        password: 'S3cret!',
      },
      auth
    );
    expect(body.valid).toBe(true);
    expect(body.issues).toHaveLength(0);
  });
});

// ─── Templates ──────────────────────────────────────────────────────────────

describe('Templates', () => {
  it('lists the seeded PostgreSQL template with secret keys hidden but flagged', async () => {
    const postgres = await get<ConnectorsListResponse>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      auth
    );
    const connectorId = postgres.body.connectors.find((c) => c.identifier === 'postgresql')!.id;

    const { status, body } = await get<{ total: number; templates: TemplateBody[] }>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/templates`,
      auth
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(1);
    const template = body.templates[0]!;
    expect(template.values['password']).toBeUndefined();
  });

  it('creates a template, encrypting secret-typed values, and rejects an invalid one', async () => {
    const postgres = await get<ConnectorsListResponse>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      auth
    );
    const connectorId = postgres.body.connectors.find((c) => c.identifier === 'postgresql')!.id;

    const valid = await post<TemplateBody>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/templates`,
      {
        name: 'Produção',
        values: {
          host: 'prod-db.example.com',
          port: 5432,
          database: 'atlas_prod',
          username: 'atlas',
          password: 'S3cret!',
        },
      },
      auth
    );
    expect(valid.status).toBe(201);
    expect(valid.body.secretKeys).toContain('password');
    expect(valid.body.values['password']).toBeUndefined();
    expect(JSON.stringify(valid.body)).not.toContain('S3cret!');

    const invalid = await post<{ error: { code: string } }>(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/templates`,
      { name: 'Incompleto', values: { host: 'x' } },
      auth
    );
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('VALIDATION_FAILED');

    const deleted = await del(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${connectorId}/templates/${valid.body.id}`,
      auth
    );
    expect(deleted.status).toBe(200);
  });
});

// ─── RBAC ───────────────────────────────────────────────────────────────────

describe('RBAC', () => {
  it('AUDITOR (read-only) is forbidden from creating a connector', async () => {
    // AUDITOR has connector-registry.read but not .write per ROLE_PERMISSIONS.
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorConnPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Fresh Auditor',
      email: `auditor-connectors-${Date.now()}@atlasconnect.com.br`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });

    const login = await post<{ accessToken: string }>(
      srv.baseUrl,
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.20.9.3' }
    );
    const auditorAuth = bearer(login.body.accessToken);

    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      {
        identifier: 'blocked-connector',
        name: 'Blocked',
        category: 'CUSTOM',
        vendor: 'X',
        description: 'X',
        minRuntimeVersion: '1.0.0',
      },
      auditorAuth
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

// ─── Audit ──────────────────────────────────────────────────────────────────

describe('Audit', () => {
  it('records CONNECTOR_REGISTERED and CONNECTOR_VERSION_PUBLISHED', async () => {
    const create = await post<ConnectorBody>(
      srv.baseUrl,
      '/admin/connector-registry/connectors',
      {
        identifier: 'audit-test',
        name: 'Audit Test',
        category: 'CUSTOM',
        vendor: 'Atlas',
        description: 'X',
        minRuntimeVersion: '1.0.0',
      },
      auth
    );
    await post(
      srv.baseUrl,
      `/admin/connector-registry/connectors/${create.body.id}/versions`,
      { version: '1.0.0', changelog: 'X', status: 'stable', minRuntimeVersion: '1.0.0' },
      auth
    );

    const { status, body } = await get<{
      entries: Array<{ action: string; target?: string }>;
    }>(srv.baseUrl, '/admin/audit-log', auth);
    expect(status).toBe(200);
    expect(body.entries.some((e) => e.action === 'CONNECTOR_REGISTERED')).toBe(true);
    expect(body.entries.some((e) => e.action === 'CONNECTOR_VERSION_PUBLISHED')).toBe(true);
  });
});

// ─── Portal read-only catalog browse ─────────────────────────────────────────

describe('Portal connector catalog (read-only, org-scoped auth)', () => {
  it('rejects unauthenticated access', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/connector-catalog');
    expect(status).toBe(401);
  });

  it('lists active connectors and lets an org member read a single connector with parameters', async () => {
    const ownerAuth = await seededOwnerAuth(srv.baseUrl);

    const list = await get<ConnectorsListResponse>(
      srv.baseUrl,
      '/api/v1/portal/connector-catalog',
      ownerAuth
    );
    expect(list.status).toBe(200);
    const postgres = list.body.connectors.find((c) => c.identifier === 'postgresql');
    expect(postgres).toBeTruthy();

    const detail = await get<{ connector: ConnectorBody; parameters: ParameterBody[] }>(
      srv.baseUrl,
      `/api/v1/portal/connector-catalog/${postgres!.id}`,
      ownerAuth
    );
    expect(detail.status).toBe(200);
    expect(detail.body.parameters.some((p) => p.key === 'password')).toBe(true);
  });
});
