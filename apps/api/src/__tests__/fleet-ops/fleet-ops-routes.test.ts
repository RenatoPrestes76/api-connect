import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
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
const D = (path: string, headers: Record<string, string> = auth) => del(srv.baseUrl, path, headers);

async function firstRuntime(): Promise<{ id: string; name: string }> {
  const { body } = await G('/admin/control-plane/runtimes');
  return (body as any).runtimes[0];
}

async function firstOrgConnectorVersion(): Promise<{
  orgId: string;
  envId: string;
  connectorId: string;
  versionId: string;
}> {
  const { body: orgs } = await G('/admin/control-plane/organizations');
  const org = (orgs as any).organizations.find((o: any) => o.name === 'Acme Corp');
  const { body: envs } = await G(`/admin/control-plane/environments?organizationId=${org.id}`);
  const env = (envs as any).environments.find((e: any) => e.kind === 'STAGING');
  const { body: connectors } = await G('/admin/control-plane/connectors');
  const connector = (connectors as any).connectors.find((c: any) => c.slug === 'postgresql');
  const { body: versions } = await G(`/admin/control-plane/connectors/${connector.id}/versions`);
  return {
    orgId: org.id,
    envId: env.id,
    connectorId: connector.id,
    versionId: (versions as any).versions[0].id,
  };
}

// ─── Dashboard / metrics ────────────────────────────────────────────────────

describe('Fleet Dashboard', () => {
  it('GET /admin/fleet returns fleet overview', async () => {
    const { status, body } = await G('/admin/fleet');
    expect(status).toBe(200);
    const b = body as any;
    expect(b.runtimesTotal).toBeGreaterThanOrEqual(6);
    expect(b.runtimesOnline + b.runtimesOffline + b.runtimesDegraded).toBeLessThanOrEqual(
      b.runtimesTotal
    );
  });

  it('GET /admin/fleet/metrics returns a flat metrics list', async () => {
    const { status, body } = await G('/admin/fleet/metrics');
    expect(status).toBe(200);
    const names = (body as any).metrics.map((m: any) => m.name);
    expect(names).toContain('fleet_runtimes_total');
    expect(names).toContain('fleet_cpu_avg_pct');
  });

  it('rejects unauthenticated access', async () => {
    const { status } = await G('/admin/fleet', {});
    expect(status).toBe(401);
  });
});

// ─── Runtime monitoring ─────────────────────────────────────────────────────

describe('Runtime monitoring', () => {
  it('GET /admin/fleet/runtime/status returns a feed with a metric per runtime', async () => {
    const { status, body } = await G('/admin/fleet/runtime/status');
    expect(status).toBe(200);
    const b = body as any;
    expect(b.runtimes.length).toBeGreaterThanOrEqual(6);
    expect(b.runtimes[0].metric).toBeTruthy();
  });

  it('GET /admin/fleet/runtime/:id returns full detail (metrics, health, logs, commands)', async () => {
    const runtime = await firstRuntime();
    const { status, body } = await G(`/admin/fleet/runtime/${runtime.id}`);
    expect(status).toBe(200);
    const b = body as any;
    expect(b.runtime.id).toBe(runtime.id);
    expect(b.metrics.length).toBeGreaterThan(0);
    expect(b.healthSnapshots.length).toBeGreaterThan(0);
    expect(b.logs.length).toBeGreaterThan(0);
  });

  it('POST /admin/fleet/runtime/heartbeat ingests a metric and clears OFFLINE status', async () => {
    const { body: runtimes } = await G('/admin/control-plane/runtimes?status=OFFLINE');
    const offline = (runtimes as any).runtimes[0];
    expect(offline).toBeTruthy();

    const { status, body } = await P('/admin/fleet/runtime/heartbeat', {
      runtimeId: offline.id,
      cpuPct: 30,
      memPct: 40,
      diskPct: 25,
      latencyMs: 10,
    });
    expect(status).toBe(201);
    expect((body as any).runtimeId).toBe(offline.id);

    const { body: updated } = await G(`/admin/control-plane/runtimes/${offline.id}`);
    expect((updated as any).status).toBe('ONLINE');
  });
});

// ─── Remote actions ─────────────────────────────────────────────────────────

describe('Remote actions', () => {
  it('executes all 8 remote action types and records a RuntimeCommand for each', async () => {
    const runtime = await firstRuntime();
    const actions = [
      'restart',
      'update',
      'reinstall',
      'sync-now',
      'clear-cache',
      'force-heartbeat',
      'disable',
      'enable',
    ];
    for (const action of actions) {
      const { status, body } = await P(`/admin/fleet/runtime/${runtime.id}/${action}`);
      expect(status).toBe(200);
      expect((body as any).status).toBe('SUCCEEDED');
    }

    const { body: detail } = await G(`/admin/fleet/runtime/${runtime.id}`);
    const commandTypes = (detail as any).commands.map((c: any) => c.type);
    expect(commandTypes).toEqual(
      expect.arrayContaining([
        'RESTART',
        'UPDATE',
        'REINSTALL',
        'SYNC_NOW',
        'CLEAR_CACHE',
        'FORCE_HEARTBEAT',
        'DISABLE',
        'ENABLE',
      ])
    );
  });

  it('disable then enable flips runtime status accordingly', async () => {
    const runtime = await firstRuntime();
    await P(`/admin/fleet/runtime/${runtime.id}/disable`);
    const { body: retired } = await G(`/admin/control-plane/runtimes/${runtime.id}`);
    expect((retired as any).status).toBe('RETIRED');

    await P(`/admin/fleet/runtime/${runtime.id}/enable`);
    const { body: online } = await G(`/admin/control-plane/runtimes/${runtime.id}`);
    expect((online as any).status).toBe('ONLINE');
  });

  it('records these actions in the admin audit log', async () => {
    const { body } = await G('/admin/audit-log?limit=200');
    const entries = (body as any).entries as Array<{ action: string }>;
    expect(entries.some((e) => e.action === 'RUNTIME_COMMAND')).toBe(true);
  });
});

// ─── Connector operations ───────────────────────────────────────────────────

describe('Connector operations', () => {
  it('installs, updates, restarts, views logs, and removes a connector on an organization', async () => {
    const { body: orgs } = await G('/admin/control-plane/organizations');
    const org = (orgs as any).organizations.find((o: any) => o.name === 'StartupXYZ');
    const { body: connectors } = await G('/admin/control-plane/connectors');
    const salesforce = (connectors as any).connectors.find((c: any) => c.slug === 'salesforce');

    const install = await P(`/admin/fleet/connectors/${salesforce.id}/install`, {
      organizationId: org.id,
      version: '1.0.0',
    });
    expect(install.status).toBe(201);

    const update = await P(`/admin/fleet/connectors/${salesforce.id}/update`, {
      organizationId: org.id,
      version: '1.0.0',
    });
    expect(update.status).toBe(200);

    const restart = await P(`/admin/fleet/connectors/${salesforce.id}/restart`, {
      organizationId: org.id,
    });
    expect(restart.status).toBe(200);
    expect((restart.body as any).enabled).toBe(true);

    const { status: logsStatus, body: logsBody } = await G(
      `/admin/fleet/connectors/${salesforce.id}/logs?organizationId=${org.id}`
    );
    expect(logsStatus).toBe(200);
    expect((logsBody as any).logs.length).toBeGreaterThanOrEqual(3); // install + update + restart

    const remove = await D(`/admin/fleet/connectors/${salesforce.id}?organizationId=${org.id}`);
    expect(remove.status).toBe(200);
  });
});

// ─── Deployment jobs (manual / automatic / scheduled) ───────────────────────

describe('Deployment jobs', () => {
  it('MANUAL job requires approval, then executes on approve', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();

    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'MANUAL',
    });
    expect(create.status).toBe(201);
    expect((create.body as any).status).toBe('PENDING_APPROVAL');
    const jobId = (create.body as any).id;

    const approve = await P(`/admin/fleet/deployments/${jobId}/approve`);
    expect(approve.status).toBe(200);
    expect((approve.body as any).status).toBe('SUCCEEDED');

    const { body: tasks } = await G(`/admin/fleet/deployments/${jobId}/tasks`);
    expect((tasks as any).tasks.length).toBeGreaterThan(0);
  });

  it('AUTOMATIC job executes immediately', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();

    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'AUTOMATIC',
    });
    expect(create.status).toBe(201);
    expect((create.body as any).status).toBe('SUCCEEDED');
  });

  it('SCHEDULED job starts as SCHEDULED and is auto-promoted once due', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();

    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'SCHEDULED',
      scheduledAt: new Date(Date.now() - 1000).toISOString(), // already due
    });
    expect(create.status).toBe(201);
    expect((create.body as any).status).toBe('SCHEDULED');
    const jobId = (create.body as any).id;

    // Wait past the store's scheduler tick.
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const { body: job } = await G(`/admin/fleet/deployments/${jobId}`);
    expect((job as any).status).toBe('SUCCEEDED');
  }, 10_000);

  it('rejects a pending-approval job', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();
    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'MANUAL',
    });
    const jobId = (create.body as any).id;

    const reject = await P(`/admin/fleet/deployments/${jobId}/reject`);
    expect(reject.status).toBe(200);
    expect((reject.body as any).status).toBe('REJECTED');
  });

  it('rolls back a succeeded job', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();
    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'AUTOMATIC',
    });
    const jobId = (create.body as any).id;

    const rollback = await P(`/admin/fleet/deployments/${jobId}/rollback`);
    expect(rollback.status).toBe(200);
    expect((rollback.body as any).status).toBe('ROLLED_BACK');
  });

  it('defaults to ROLLING strategy and runs its full task sequence on success', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();
    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'AUTOMATIC',
    });
    expect((create.body as any).strategy).toBe('ROLLING');

    const { body: tasks } = await G(`/admin/fleet/deployments/${(create.body as any).id}/tasks`);
    const names = (tasks as any).tasks.map((t: any) => t.name);
    expect(names).toContain('Roll batch 1/3');
    expect(names).toContain('Activate');
  });

  it('runs BLUE_GREEN and CANARY task sequences', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();

    const bg = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'AUTOMATIC',
      strategy: 'BLUE_GREEN',
    });
    expect((bg.body as any).strategy).toBe('BLUE_GREEN');
    const { body: bgTasks } = await G(`/admin/fleet/deployments/${(bg.body as any).id}/tasks`);
    expect((bgTasks as any).tasks.map((t: any) => t.name)).toContain('Switch traffic to green');

    const canary = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'AUTOMATIC',
      strategy: 'CANARY',
    });
    expect((canary.body as any).strategy).toBe('CANARY');
    const { body: canaryTasks } = await G(
      `/admin/fleet/deployments/${(canary.body as any).id}/tasks`
    );
    expect((canaryTasks as any).tasks.map((t: any) => t.name)).toContain('Promote to 100%');
  });

  it('rejects an invalid strategy', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();
    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'AUTOMATIC',
      strategy: 'PURPLE',
    });
    expect(create.status).toBe(400);
    expect((create.body as any).error.code).toBe('INVALID_STRATEGY');
  });

  it('injected failure auto-rolls-back: failed step is FAILED, later steps PENDING, rollback tasks appended', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();
    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'MANUAL',
      strategy: 'ROLLING',
    });
    const jobId = (create.body as any).id;

    const inject = await P(`/admin/fleet/deployments/${jobId}/inject-failure`, {
      atStep: 'Health check batch 2/3',
    });
    expect(inject.status).toBe(200);

    const approve = await P(`/admin/fleet/deployments/${jobId}/approve`);
    expect(approve.status).toBe(200);
    expect((approve.body as any).status).toBe('ROLLED_BACK');
    expect((approve.body as any).rollbackReason).toContain('Health check batch 2/3');

    const { body: tasks } = await G(`/admin/fleet/deployments/${jobId}/tasks`);
    const byName = Object.fromEntries((tasks as any).tasks.map((t: any) => [t.name, t.status]));
    expect(byName['Health check batch 2/3']).toBe('FAILED');
    expect(byName['Roll batch 3/3']).toBe('PENDING');
    expect(byName['Activate']).toBe('PENDING');
    expect(byName['Halt rollout']).toBe('SUCCEEDED');
  });

  it('injected failure without autoRollback leaves the job FAILED (no rollback tasks)', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();
    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'MANUAL',
      autoRollback: false,
    });
    const jobId = (create.body as any).id;

    await P(`/admin/fleet/deployments/${jobId}/inject-failure`, { atStep: 'Roll batch 1/3' });
    const approve = await P(`/admin/fleet/deployments/${jobId}/approve`);
    expect((approve.body as any).status).toBe('FAILED');

    const { body: tasks } = await G(`/admin/fleet/deployments/${jobId}/tasks`);
    expect((tasks as any).tasks.some((t: any) => t.name === 'Halt rollout')).toBe(false);
  });

  it('inject-failure returns 400 once the job has already executed', async () => {
    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();
    const create = await P('/admin/fleet/deployments', {
      organizationId: orgId,
      environmentId: envId,
      pluginId: connectorId,
      pluginVersionId: versionId,
      mode: 'AUTOMATIC',
    });
    const jobId = (create.body as any).id;

    const inject = await P(`/admin/fleet/deployments/${jobId}/inject-failure`, {
      atStep: 'Activate',
    });
    expect(inject.status).toBe(400);
    expect((inject.body as any).error.code).toBe('ALREADY_EXECUTED');
  });
});

// ─── Alerts ─────────────────────────────────────────────────────────────────

describe('Alert Center', () => {
  it('lists alerts (seeded HIGH_CPU/CRITICAL demo alert present)', async () => {
    const { status, body } = await G('/admin/fleet/alerts');
    expect(status).toBe(200);
    const alerts = (body as any).alerts;
    expect(alerts.some((a: any) => a.type === 'HIGH_CPU')).toBe(true);
  });

  it('acknowledges then resolves an alert', async () => {
    const { body } = await G('/admin/fleet/alerts?status=ACTIVE');
    const alert = (body as any).alerts[0];
    expect(alert).toBeTruthy();

    const ack = await P(`/admin/fleet/alerts/${alert.id}/acknowledge`);
    expect(ack.status).toBe(200);
    expect((ack.body as any).status).toBe('ACKNOWLEDGED');

    const resolve = await P(`/admin/fleet/alerts/${alert.id}/resolve`);
    expect(resolve.status).toBe(200);
    expect((resolve.body as any).status).toBe('RESOLVED');
  });
});

// ─── Notifications ──────────────────────────────────────────────────────────

describe('Notification Engine', () => {
  it('sends simulated EMAIL/SLACK/TEAMS notifications (marked SENT)', async () => {
    for (const channel of ['EMAIL', 'SLACK', 'TEAMS']) {
      const { status, body } = await P('/admin/fleet/notifications/test', {
        channel,
        target: 'ops@atlasconnect.com.br',
        body: 'test message',
      });
      expect(status).toBe(201);
      expect((body as any).status).toBe('SENT');
    }
  });

  it('broadcasts over WEBSOCKET (SENT, even with zero connected clients)', async () => {
    const { status, body } = await P('/admin/fleet/notifications/test', {
      channel: 'WEBSOCKET',
      target: 'broadcast',
      body: 'live update',
    });
    expect(status).toBe(201);
    expect((body as any).status).toBe('SENT');
  });

  it('marks an unreachable WEBHOOK as FAILED', async () => {
    const { status, body } = await P('/admin/fleet/notifications/test', {
      channel: 'WEBHOOK',
      target: 'http://127.0.0.1:1/unreachable',
      body: 'test',
    });
    expect(status).toBe(201);
    expect((body as any).status).toBe('FAILED');
  });

  it('issues a WebSocket ticket', async () => {
    const { status, body } = await P('/admin/fleet/notifications/ws-ticket');
    expect(status).toBe(200);
    expect((body as any).ticket).toBeTruthy();
  });

  it('lists sent notifications', async () => {
    const { status, body } = await G('/admin/fleet/notifications');
    expect(status).toBe(200);
    expect((body as any).total).toBeGreaterThan(0);
  });
});

// ─── Audit alias ────────────────────────────────────────────────────────────

describe('Fleet audit alias', () => {
  it('GET /admin/fleet/audit returns the same audit log', async () => {
    const { status, body } = await G('/admin/fleet/audit?limit=5');
    expect(status).toBe(200);
    expect((body as any).entries.length).toBeGreaterThan(0);
  });
});

// ─── RBAC ───────────────────────────────────────────────────────────────────

describe('RBAC on fleet routes', () => {
  it('a role without marketplace.publish is forbidden from creating deployment jobs', async () => {
    const role = adminIdentityStore.getRoleByName('AUDITOR')!;
    const password = 'AuditorPass123!';
    const user = adminIdentityStore.createUser({
      name: 'Auditor User',
      email: 'auditor-46-4@atlasconnect.com.br',
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });
    const { body: loginBody } = await P(
      '/admin/auth/login',
      { email: user.email, password },
      { 'x-forwarded-for': '10.20.9.1' }
    );
    const auditorAuth = bearer((loginBody as any).accessToken);

    const { orgId, envId, connectorId, versionId } = await firstOrgConnectorVersion();
    const forbidden = await P(
      '/admin/fleet/deployments',
      {
        organizationId: orgId,
        environmentId: envId,
        pluginId: connectorId,
        pluginVersionId: versionId,
        mode: 'AUTOMATIC',
      },
      auditorAuth
    );
    expect(forbidden.status).toBe(403);

    // But AUDITOR does have dashboard.view, so alerts/fleet overview remain readable.
    const alerts = await G('/admin/fleet/alerts', auditorAuth);
    expect(alerts.status).toBe(200);
  });
});
