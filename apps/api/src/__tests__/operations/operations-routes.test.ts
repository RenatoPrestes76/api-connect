import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post, patch } from './helpers.js';
import type { TestServer } from './helpers.js';

// Shared test server — seeded data is read-only for most tests;
// mutations (restart-agent, resolve) use known seeded IDs.
let server: TestServer;
beforeAll(async () => {
  server = await startTestServer();
});
afterAll(async () => {
  await server.close();
});

// ─── Overview ────────────────────────────────────────────────────────────────

describe('GET /api/v1/operations/overview', () => {
  it('returns 200 with tenant summary and KPIs', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/operations/overview');
    expect(status).toBe(200);
    expect(body.totalTenants).toBe(3);
    expect(typeof body.agentsOnline).toBe('number');
    expect(typeof body.agentsOffline).toBe('number');
    expect(typeof body.openAlerts).toBe('number');
    expect(body.openAlerts).toBeGreaterThan(0);
  });

  it('includes tenants array with overallStatus', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/operations/overview');
    expect(Array.isArray(body.tenants)).toBe(true);
    expect(body.tenants).toHaveLength(3);
    const statuses = body.tenants.map((t: any) => t.overallStatus);
    expect(statuses).toContain('healthy');
    expect(statuses).toContain('offline');
  });

  it('community tenant has the most critical status', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/operations/overview');
    const community = body.tenants.find((t: any) => t.tenantId === 'tenant-community');
    expect(community).toBeDefined();
    expect(community.overallStatus).toBe('offline');
  });
});

// ─── Health ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/operations/health', () => {
  it('returns all tenants when no filter', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/operations/health');
    expect(status).toBe(200);
    expect(body.total).toBe(3);
    expect(Array.isArray(body.tenants)).toBe(true);
  });

  it('returns single tenant when tenantId filter applied', async () => {
    const { status, body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/health?tenantId=tenant-enterprise'
    );
    expect(status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.tenants[0].tenantId).toBe('tenant-enterprise');
    expect(body.tenants[0].overallStatus).toBe('healthy');
  });

  it('enterprise has all healthy checks', async () => {
    const { body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/health?tenantId=tenant-enterprise'
    );
    const checks = body.tenants[0].checks as any[];
    const nonHealthy = checks.filter((c: any) => c.status !== 'healthy');
    expect(nonHealthy).toHaveLength(0);
  });

  it('returns 404 for unknown tenant', async () => {
    const { status, body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/health?tenantId=does-not-exist'
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns status counts in all-tenants response', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/operations/health');
    expect(typeof body.healthy).toBe('number');
    expect(typeof body.warning).toBe('number');
    expect(typeof body.critical).toBe('number');
    expect(typeof body.offline).toBe('number');
  });
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/operations/alerts', () => {
  it('returns all alerts by default', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/operations/alerts');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('filters by severity=critical', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/operations/alerts?severity=critical');
    expect(body.alerts.every((a: any) => a.severity === 'critical')).toBe(true);
  });

  it('filters by resolved=false (open alerts only)', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/operations/alerts?resolved=false');
    expect(body.alerts.every((a: any) => a.resolved === false)).toBe(true);
  });

  it('filters by tenantId', async () => {
    const { body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/alerts?tenantId=tenant-community'
    );
    expect(body.alerts.every((a: any) => a.tenantId === 'tenant-community')).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });

  it('returns 400 for invalid severity', async () => {
    const { status, body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/alerts?severity=nope'
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_SEVERITY');
  });
});

describe('PATCH /api/v1/operations/alerts/:id', () => {
  it('resolves a known alert', async () => {
    const { status, body } = await patch<any>(server.baseUrl, '/api/v1/operations/alerts/alrt-003');
    expect(status).toBe(200);
    expect(body.resolved).toBe(true);
    expect(body.resolvedAt).toBeDefined();
  });

  it('returns 404 for unknown alert id', async () => {
    const { status, body } = await patch<any>(
      server.baseUrl,
      '/api/v1/operations/alerts/alrt-does-not-exist'
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ─── Events ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/operations/events', () => {
  it('returns all events limited to 50 by default', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/operations/events');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(12);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('filters events by tenantId', async () => {
    const { body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/events?tenantId=tenant-enterprise'
    );
    expect(body.events.every((e: any) => e.tenantId === 'tenant-enterprise')).toBe(true);
  });

  it('respects limit parameter', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/operations/events?limit=3');
    expect(body.events.length).toBeLessThanOrEqual(3);
  });

  it('events are returned most-recent first', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/operations/events');
    const dates = body.events.map((e: any) => e.createdAt);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1] >= dates[i]).toBe(true);
    }
  });
});

// ─── Metrics ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/operations/metrics', () => {
  it('returns all metrics aggregated by tenant when no filter', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/operations/metrics');
    expect(status).toBe(200);
    expect(body.total).toBe(33);
    expect(typeof body.tenants).toBe('object');
  });

  it('returns metrics for a specific tenant', async () => {
    const { status, body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/metrics?tenantId=tenant-enterprise'
    );
    expect(status).toBe(200);
    expect(body.tenantId).toBe('tenant-enterprise');
    expect(body.total).toBe(11);
  });

  it('returns 404 for unknown tenantId', async () => {
    const { status, body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/metrics?tenantId=none'
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('community has high cpu_usage metric', async () => {
    const { body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/metrics?tenantId=tenant-community'
    );
    const cpu = body.metrics.find((m: any) => m.metric === 'cpu_usage');
    expect(cpu).toBeDefined();
    expect(cpu.value).toBeGreaterThan(80);
  });
});

// ─── SLA ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/operations/sla', () => {
  it('returns today SLA records by default', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/operations/sla');
    expect(status).toBe(200);
    expect(body.period).toBe('today');
    expect(body.total).toBe(3);
  });

  it('enterprise meets its SLA target', async () => {
    const { body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/sla?tenantId=tenant-enterprise&period=today'
    );
    expect(body.records[0].met).toBe(true);
  });

  it('community does NOT meet its SLA target on 30d period', async () => {
    const { body } = await get<any>(
      server.baseUrl,
      '/api/v1/operations/sla?tenantId=tenant-community&period=30d'
    );
    expect(body.records[0].met).toBe(false);
  });

  it('returns 400 for invalid period', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/operations/sla?period=bad');
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_PERIOD');
  });

  it('supports all 4 periods: today, 7d, 30d, 12m', async () => {
    for (const period of ['today', '7d', '30d', '12m']) {
      const { status, body } = await get<any>(
        server.baseUrl,
        `/api/v1/operations/sla?period=${period}`
      );
      expect(status).toBe(200);
      expect(body.period).toBe(period);
      expect(body.total).toBe(3);
    }
  });
});

// ─── Actions ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/operations/actions/restart-agent', () => {
  it('restarts an agent successfully', async () => {
    const { status, body } = await post<any>(
      server.baseUrl,
      '/api/v1/operations/actions/restart-agent',
      {
        tenantId: 'tenant-community',
        agentId: 'agent-com-01',
      }
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.action).toBe('restart-agent');
    expect(body.actionId).toBeDefined();
  });

  it('returns 400 when tenantId missing', async () => {
    const { status, body } = await post<any>(
      server.baseUrl,
      '/api/v1/operations/actions/restart-agent',
      {
        agentId: 'agent-com-01',
      }
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when agentId missing', async () => {
    const { status, body } = await post<any>(
      server.baseUrl,
      '/api/v1/operations/actions/restart-agent',
      {
        tenantId: 'tenant-community',
      }
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for unknown tenant', async () => {
    const { status, body } = await post<any>(
      server.baseUrl,
      '/api/v1/operations/actions/restart-agent',
      {
        tenantId: 'tenant-unknown',
        agentId: 'agent-x',
      }
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/v1/operations/actions/retry', () => {
  it('initiates a retry for a connector', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/operations/actions/retry', {
      tenantId: 'tenant-community',
      connectorId: 'conn-com-01',
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.action).toBe('retry');
  });

  it('returns 400 when neither connectorId nor jobId provided', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/operations/actions/retry', {
      tenantId: 'tenant-community',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });
});

describe('POST /api/v1/operations/actions/run-health', () => {
  it('runs health check for all tenants when no tenantId', async () => {
    const { status, body } = await post<any>(
      server.baseUrl,
      '/api/v1/operations/actions/run-health',
      {}
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.action).toBe('run-health');
    expect(body.checksRan).toBeGreaterThan(0);
    expect(Array.isArray(body.checks)).toBe(true);
  });

  it('runs health check for a specific tenant', async () => {
    const { status, body } = await post<any>(
      server.baseUrl,
      '/api/v1/operations/actions/run-health',
      {
        tenantId: 'tenant-enterprise',
      }
    );
    expect(status).toBe(200);
    expect(body.checksRan).toBe(8);
  });
});

describe('POST /api/v1/operations/actions/sync', () => {
  it('syncs configuration for a tenant', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/operations/actions/sync', {
      tenantId: 'tenant-enterprise',
      scope: 'full',
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.action).toBe('sync');
    expect(body.message).toContain('Omega Corp');
  });

  it('returns 400 when tenantId missing', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/operations/actions/sync', {
      scope: 'connectors',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for unknown tenant', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/operations/actions/sync', {
      tenantId: 'tenant-none',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
