import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  patch,
  del,
  bearer,
  superAdminAuth,
  type TestServer,
} from './helpers.js';
import { adminIdentityStore } from '../../modules/admin-identity/admin-identity-store.js';
import { hashPassword } from '../../modules/admin-identity/password.js';

let srv: TestServer;
let auth: Record<string, string>;

beforeAll(async () => {
  srv = await startTestServer();
  auth = await superAdminAuth(srv.baseUrl);
});
afterAll(async () => {
  await srv.close();
});

const G = (path: string, headers: Record<string, string> = auth) => get(srv.baseUrl, path, headers);
const P = (path: string, data?: unknown, headers: Record<string, string> = auth) =>
  post(srv.baseUrl, path, data, headers);
const PA = (path: string, data?: unknown, headers: Record<string, string> = auth) =>
  patch(srv.baseUrl, path, data, headers);
const D = (path: string, headers: Record<string, string> = auth) => del(srv.baseUrl, path, headers);

// ─── Auth guard sanity ────────────────────────────────────────────────────────

describe('Control Plane routes require admin auth', () => {
  it('rejects unauthenticated access to tenants', async () => {
    const { status } = await G('/admin/control-plane/tenants', {});
    expect(status).toBe(401);
  });

  it('rejects unauthenticated access to the dashboard', async () => {
    const { status } = await G('/admin/control-plane/dashboard', {});
    expect(status).toBe(401);
  });
});

// ─── Tenants ────────────────────────────────────────────────────────────────

describe('Tenants', () => {
  it('lists the 3 seeded tenants', async () => {
    const { status, body } = await G('/admin/control-plane/tenants');
    expect(status).toBe(200);
    const b = body as any;
    expect(b.total).toBe(3);
    expect(b.tenants.map((t: any) => t.name)).toEqual(
      expect.arrayContaining(['Acme Corp', 'TechVentures', 'StartupXYZ'])
    );
  });

  it('creates, reads, updates, and deletes a tenant', async () => {
    const create = await P('/admin/control-plane/tenants', {
      name: 'NewCo',
      slug: 'newco',
      primaryContactEmail: 'x@newco.example',
    });
    expect(create.status).toBe(201);
    const id = (create.body as any).id;

    const read = await G(`/admin/control-plane/tenants/${id}`);
    expect(read.status).toBe(200);
    expect((read.body as any).name).toBe('NewCo');

    const updated = await PA(`/admin/control-plane/tenants/${id}`, { status: 'SUSPENDED' });
    expect(updated.status).toBe(200);
    expect((updated.body as any).status).toBe('SUSPENDED');

    const deleted = await D(`/admin/control-plane/tenants/${id}`);
    expect(deleted.status).toBe(200);

    const readAfterDelete = await G(`/admin/control-plane/tenants/${id}`);
    expect(readAfterDelete.status).toBe(404);
  });

  it('returns 400 MISSING_FIELDS when creating without name/slug', async () => {
    const { status, body } = await P('/admin/control-plane/tenants', { name: 'Incomplete' });
    expect(status).toBe(400);
    expect((body as any).error.code).toBe('MISSING_FIELDS');
  });
});

// ─── Organizations ──────────────────────────────────────────────────────────

describe('Organizations', () => {
  it('lists the 3 seeded organizations', async () => {
    const { body } = await G('/admin/control-plane/organizations');
    expect((body as any).total).toBe(3);
  });

  it('filters organizations by tenantId', async () => {
    const { body: tenants } = await G('/admin/control-plane/tenants');
    const acme = (tenants as any).tenants.find((t: any) => t.name === 'Acme Corp');

    const { body } = await G(`/admin/control-plane/organizations?tenantId=${acme.id}`);
    const orgs = (body as any).organizations;
    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe('Acme Corp');
  });

  it('creating an organization auto-provisions 3 environments (dev/staging/prod)', async () => {
    const { status, body } = await P('/admin/control-plane/organizations', {
      name: 'Fresh Org',
      slug: 'fresh-org',
      tier: 'FREE',
    });
    expect(status).toBe(201);
    const orgId = (body as any).id;

    const { body: envBody } = await G(`/admin/control-plane/environments?organizationId=${orgId}`);
    const kinds = (envBody as any).environments.map((e: any) => e.kind).sort();
    expect(kinds).toEqual(['DEVELOPMENT', 'PRODUCTION', 'STAGING']);
  });

  it('updates and soft-deletes an organization', async () => {
    const { body: created } = await P('/admin/control-plane/organizations', {
      name: 'ToDelete',
      slug: 'to-delete',
    });
    const id = (created as any).id;

    const updated = await PA(`/admin/control-plane/organizations/${id}`, { tier: 'ENTERPRISE' });
    expect((updated.body as any).tier).toBe('ENTERPRISE');

    const deleted = await D(`/admin/control-plane/organizations/${id}`);
    expect(deleted.status).toBe(200);
    expect((await G(`/admin/control-plane/organizations/${id}`)).status).toBe(404);
  });
});

// ─── Environments ───────────────────────────────────────────────────────────

describe('Environments', () => {
  it('creates and deletes an extra environment for an organization', async () => {
    const { body: orgs } = await G('/admin/control-plane/organizations');
    const org = (orgs as any).organizations[0];

    const create = await P('/admin/control-plane/environments', {
      organizationId: org.id,
      name: 'QA',
      slug: 'qa',
      kind: 'STAGING',
    });
    expect(create.status).toBe(201);
    const envId = (create.body as any).id;

    const deleted = await D(`/admin/control-plane/environments/${envId}`);
    expect(deleted.status).toBe(200);
  });

  it('returns 404 ORGANIZATION_NOT_FOUND for an unknown org', async () => {
    const { status, body } = await P('/admin/control-plane/environments', {
      organizationId: 'nonexistent',
      name: 'X',
      slug: 'x',
      kind: 'DEVELOPMENT',
    });
    expect(status).toBe(404);
    expect((body as any).error.code).toBe('ORGANIZATION_NOT_FOUND');
  });
});

// ─── Runtimes ───────────────────────────────────────────────────────────────

describe('Runtimes', () => {
  it('lists seeded runtimes and filters by status', async () => {
    const { body } = await G('/admin/control-plane/runtimes?status=ONLINE');
    expect((body as any).runtimes.every((r: any) => r.status === 'ONLINE')).toBe(true);
  });

  it('restarts a runtime (status becomes ONLINE)', async () => {
    const { body: list } = await G('/admin/control-plane/runtimes?status=DEGRADED');
    const degraded = (list as any).runtimes[0];
    expect(degraded).toBeTruthy();

    const { status, body } = await P(`/admin/control-plane/runtimes/${degraded.id}/restart`);
    expect(status).toBe(200);
    expect((body as any).status).toBe('ONLINE');
  });

  it('updates a runtime version', async () => {
    const { body: list } = await G('/admin/control-plane/runtimes');
    const runtime = (list as any).runtimes[0];

    const { status, body } = await P(`/admin/control-plane/runtimes/${runtime.id}/update`, {
      version: '3.0.0',
    });
    expect(status).toBe(200);
    expect((body as any).version).toBe('3.0.0');
  });

  it('issues a rotated runtime access token (raw token returned once)', async () => {
    const { body: list } = await G('/admin/control-plane/runtimes');
    const runtime = (list as any).runtimes[0];

    const { status, body } = await P(`/admin/control-plane/runtimes/${runtime.id}/token`);
    expect(status).toBe(200);
    expect((body as any).token).toMatch(/^rat_/);
    expect((body as any).tokenPrefix).toBe((body as any).token.slice(0, 12));
  });

  it('retires a runtime', async () => {
    const { body: list } = await G('/admin/control-plane/runtimes');
    const runtime = (list as any).runtimes[(list as any).runtimes.length - 1];

    const { status, body } = await P(`/admin/control-plane/runtimes/${runtime.id}/retire`);
    expect(status).toBe(200);
    expect((body as any).status).toBe('RETIRED');
  });
});

// ─── Connectors ─────────────────────────────────────────────────────────────

describe('Connectors', () => {
  it('lists seeded connectors', async () => {
    const { body } = await G('/admin/control-plane/connectors');
    const names = (body as any).connectors.map((c: any) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(['MSSQL Connector', 'PostgreSQL Connector', 'Salesforce Connector'])
    );
  });

  it('lists versions for a connector', async () => {
    const { body: connectors } = await G('/admin/control-plane/connectors');
    const mssql = (connectors as any).connectors.find((c: any) => c.slug === 'mssql');

    const { status, body } = await G(`/admin/control-plane/connectors/${mssql.id}/versions`);
    expect(status).toBe(200);
    expect((body as any).total).toBe(3);
  });

  it('creates and publishes a new connector version', async () => {
    const { body: connectors } = await G('/admin/control-plane/connectors');
    const mssql = (connectors as any).connectors.find((c: any) => c.slug === 'mssql');

    const create = await P(`/admin/control-plane/connectors/${mssql.id}/versions`, {
      version: '1.3.0',
      changelog: 'New release',
    });
    expect(create.status).toBe(201);
    const versionId = (create.body as any).id;

    const publish = await P(
      `/admin/control-plane/connectors/${mssql.id}/versions/${versionId}/publish`
    );
    expect(publish.status).toBe(200);
    expect((publish.body as any).published).toBe(true);

    const updatedConnector = await G(`/admin/control-plane/connectors/${mssql.id}`);
    expect((updatedConnector.body as any).version).toBe('1.3.0');
  });

  it('lists connectors installed on an organization', async () => {
    const { body: orgs } = await G('/admin/control-plane/organizations');
    const acme = (orgs as any).organizations.find((o: any) => o.name === 'Acme Corp');

    const { status, body } = await G(`/admin/control-plane/organizations/${acme.id}/connectors`);
    expect(status).toBe(200);
    expect((body as any).installed.length).toBeGreaterThan(0);
  });
});

// ─── Deployments ────────────────────────────────────────────────────────────

describe('Deployments', () => {
  it('lists seeded deployments including a FAILED and an IN_PROGRESS one', async () => {
    const { body } = await G('/admin/control-plane/deployments');
    const statuses = (body as any).deployments.map((d: any) => d.status);
    expect(statuses).toEqual(expect.arrayContaining(['FAILED', 'IN_PROGRESS', 'SUCCEEDED']));
  });

  it('creates a deployment which installs the connector on the organization', async () => {
    const { body: orgs } = await G('/admin/control-plane/organizations');
    const acme = (orgs as any).organizations.find((o: any) => o.name === 'Acme Corp');
    const { body: envs } = await G(`/admin/control-plane/environments?organizationId=${acme.id}`);
    const staging = (envs as any).environments.find((e: any) => e.kind === 'STAGING');
    const { body: connectors } = await G('/admin/control-plane/connectors');
    const salesforce = (connectors as any).connectors.find((c: any) => c.slug === 'salesforce');
    const { body: versions } = await G(`/admin/control-plane/connectors/${salesforce.id}/versions`);
    const version = (versions as any).versions[0];

    const { status, body } = await P('/admin/control-plane/deployments', {
      organizationId: acme.id,
      environmentId: staging.id,
      pluginId: salesforce.id,
      pluginVersionId: version.id,
    });
    expect(status).toBe(201);
    expect((body as any).status).toBe('SUCCEEDED');
  });

  it('rolls back a succeeded deployment and rejects rolling back a failed one', async () => {
    const { body } = await G('/admin/control-plane/deployments?status=SUCCEEDED');
    const succeeded = (body as any).deployments[0];
    const rollback = await P(`/admin/control-plane/deployments/${succeeded.id}/rollback`);
    expect(rollback.status).toBe(200);
    expect((rollback.body as any).status).toBe('ROLLED_BACK');

    const { body: failedList } = await G('/admin/control-plane/deployments?status=FAILED');
    const failed = (failedList as any).deployments[0];
    const rejectedRollback = await P(`/admin/control-plane/deployments/${failed.id}/rollback`);
    expect(rejectedRollback.status).toBe(400);
    expect((rejectedRollback.body as any).error.code).toBe('NOT_ROLLBACKABLE');
  });
});

// ─── Feature Flags ──────────────────────────────────────────────────────────

describe('Feature Flags', () => {
  it('lists seeded flags', async () => {
    const { body } = await G('/admin/control-plane/feature-flags');
    expect((body as any).total).toBeGreaterThanOrEqual(4);
  });

  it('creates, toggles, and deletes a flag', async () => {
    const create = await P('/admin/control-plane/feature-flags', {
      key: 'test-flag',
      enabled: false,
    });
    expect(create.status).toBe(201);
    const id = (create.body as any).id;

    const toggle = await P(`/admin/control-plane/feature-flags/${id}/toggle`);
    expect(toggle.status).toBe(200);
    expect((toggle.body as any).enabled).toBe(true);

    const deleted = await D(`/admin/control-plane/feature-flags/${id}`);
    expect(deleted.status).toBe(200);
  });
});

// ─── Dashboard ──────────────────────────────────────────────────────────────

describe('Dashboard', () => {
  it('returns an aggregated summary and recent audit entries', async () => {
    const { status, body } = await G('/admin/control-plane/dashboard');
    expect(status).toBe(200);
    const b = body as any;
    expect(b.summary.tenants).toBeGreaterThanOrEqual(3);
    expect(b.summary.organizations).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(b.recentAudit)).toBe(true);
  });
});

// ─── Audit trail ────────────────────────────────────────────────────────────

describe('Business actions are audited', () => {
  it('records CREATE_TENANT in the audit log', async () => {
    await P('/admin/control-plane/tenants', { name: 'AuditCheck', slug: 'audit-check' });
    const { body } = await G('/admin/audit-log?limit=200');
    const entries = (body as any).entries as Array<{ action: string }>;
    expect(entries.some((e) => e.action === 'CREATE_TENANT')).toBe(true);
  });
});

// ─── RBAC across a functional module ─────────────────────────────────────────

describe('RBAC — DEVOPS role can restart runtimes but not manage tenants', () => {
  it('DEVOPS is forbidden from writing tenants (no companies.write) but can restart a runtime', async () => {
    const role = adminIdentityStore.getRoleByName('DEVOPS')!;
    const password = 'DevOpsPass123!';
    const user = adminIdentityStore.createUser({
      name: 'DevOps User',
      email: 'devops@atlasconnect.com.br',
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });

    const { body: loginBody } = await P(
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.10.9.1' }
    );
    const devopsAuth = bearer((loginBody as any).accessToken);

    const forbidden = await P(
      '/admin/control-plane/tenants',
      { name: 'Nope', slug: 'nope' },
      devopsAuth
    );
    expect(forbidden.status).toBe(403);

    const { body: list } = await G('/admin/control-plane/runtimes', devopsAuth);
    const runtime = (list as any).runtimes[0];
    const restart = await P(
      `/admin/control-plane/runtimes/${runtime.id}/restart`,
      undefined,
      devopsAuth
    );
    expect(restart.status).toBe(200);
  });
});
