import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post } from './helpers.js';
import type { TestServer } from './helpers.js';

let server: TestServer;
beforeAll(async () => {
  server = await startTestServer();
});
afterAll(async () => {
  await server.close();
});

// ─── Cluster overview ─────────────────────────────────────────────────────────

describe('GET /api/v1/ha/cluster', () => {
  it('returns 200 with cluster overview', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/cluster');
    expect(status).toBe(200);
    expect(typeof body.totalNodes).toBe('number');
    expect(body.totalNodes).toBeGreaterThan(0);
    expect(typeof body.clusterHealth).toBe('string');
  });

  it('leader node is defined and online', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/cluster');
    expect(body.leaderNode).not.toBeNull();
    expect(body.leaderNode.role).toBe('leader');
    expect(body.leaderNode.status).toBe('online');
  });

  it('replication summary is included', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/cluster');
    expect(body.replication).toBeDefined();
    expect(typeof body.replication.totalReplicas).toBe('number');
    expect(typeof body.replication.inSync).toBe('number');
    expect(typeof body.replication.avgLagMs).toBe('number');
  });

  it('cluster health reflects degraded node', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/cluster');
    // nd-004 is degraded, so overall cluster health is degraded
    expect(body.clusterHealth).toBe('degraded');
  });
});

// ─── Nodes ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/ha/nodes', () => {
  it('returns all 5 nodes', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/nodes');
    expect(status).toBe(200);
    expect(body.total).toBe(5);
    expect(Array.isArray(body.nodes)).toBe(true);
  });

  it('filters by status=online', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/nodes?status=online');
    expect(body.nodes.every((n: any) => n.status === 'online')).toBe(true);
    expect(body.total).toBe(4);
  });

  it('filters by role=leader returns 1 node', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/nodes?role=leader');
    expect(body.total).toBe(1);
    expect(body.nodes[0].hostname).toBe('atlas-api-alpha.internal');
  });

  it('replication summary is included in response', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/nodes');
    expect(body.replicationSummary).toBeDefined();
    expect(body.replicationSummary.totalReplicas).toBe(3);
  });

  it('secondary node has replication state attached', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/nodes?role=secondary');
    const secondary = body.nodes[0];
    expect(secondary.replication).toBeDefined();
    expect(secondary.replication.status).toBe('in_sync');
  });

  it('returns 400 for invalid status', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/nodes?status=unknown');
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_STATUS');
  });

  it('returns 400 for invalid role', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/nodes?role=boss');
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_ROLE');
  });
});

// ─── Failover events ──────────────────────────────────────────────────────────

describe('GET /api/v1/ha/failovers', () => {
  it('returns all seeded failover events', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/failovers');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('respects limit parameter', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/failovers?limit=2');
    expect(body.events.length).toBeLessThanOrEqual(2);
  });

  it('events are sorted by most recent first', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/failovers');
    const dates = body.events.map((e: any) => e.startedAt);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1] >= dates[i]).toBe(true);
    }
  });
});

// ─── POST /ha/failover ────────────────────────────────────────────────────────

describe('POST /api/v1/ha/failover', () => {
  it('triggers a manual failover successfully', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/failover', {
      fromNodeId: 'nd-003',
      toNodeId: 'nd-002',
      reason: 'Test manual failover',
    });
    expect(status).toBe(200);
    expect(body.event).toBeDefined();
    expect(body.event.success).toBe(true);
    expect(body.newLeader).toBeDefined();
  });

  it('failover result includes rtoSeconds', async () => {
    const { body } = await post<any>(server.baseUrl, '/api/v1/ha/failover', {
      fromNodeId: 'nd-005',
      toNodeId: 'nd-003',
      reason: 'Worker failover test',
    });
    expect(typeof body.event.rtoSeconds).toBe('number');
    expect(body.event.rtoSeconds).toBeGreaterThan(0);
  });

  it('returns 400 when fromNodeId missing', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/failover', {
      toNodeId: 'nd-002',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when toNodeId missing', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/failover', {
      fromNodeId: 'nd-001',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for unknown source node', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/failover', {
      fromNodeId: 'nd-999',
      toNodeId: 'nd-002',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for unknown target node', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/failover', {
      fromNodeId: 'nd-001',
      toNodeId: 'nd-999',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ─── Backups GET ──────────────────────────────────────────────────────────────

describe('GET /api/v1/ha/backups', () => {
  it('returns all seeded backups', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/backups');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(6);
    expect(typeof body.totalSizeBytes).toBe('number');
  });

  it('filters by tenantId', async () => {
    const { body } = await get<any>(
      server.baseUrl,
      '/api/v1/ha/backups?tenantId=tenant-enterprise'
    );
    expect(body.backups.every((b: any) => b.tenantId === 'tenant-enterprise')).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });

  it('filters by status=completed', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/backups?status=completed');
    expect(body.backups.every((b: any) => b.status === 'completed')).toBe(true);
  });

  it('returns 400 for invalid status', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/backups?status=bad');
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_STATUS');
  });
});

// ─── Backups POST ─────────────────────────────────────────────────────────────

describe('POST /api/v1/ha/backup', () => {
  it('creates a full backup', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/backup', {
      tenantId: 'tenant-enterprise',
      type: 'full',
    });
    expect(status).toBe(201);
    expect(body.type).toBe('full');
    expect(body.status).toBe('completed');
    expect(body.checksum).toMatch(/^sha256:/);
  });

  it('creates an incremental backup', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/backup', {
      tenantId: 'tenant-professional',
      type: 'incremental',
    });
    expect(status).toBe(201);
    expect(body.type).toBe('incremental');
  });

  it('defaults type to full when not provided', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/backup', {
      tenantId: 'tenant-community',
    });
    expect(status).toBe(201);
    expect(body.type).toBe('full');
  });

  it('returns 400 when tenantId missing', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/backup', { type: 'full' });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 for invalid backup type', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/backup', {
      tenantId: 'tenant-enterprise',
      type: 'delta',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_TYPE');
  });
});

// ─── Recovery GET ─────────────────────────────────────────────────────────────

describe('GET /api/v1/ha/recovery', () => {
  it('returns all recovery tests', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/recovery');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(4);
    expect(typeof body.passed).toBe('number');
    expect(typeof body.failed).toBe('number');
  });

  it('filters by tenantId', async () => {
    const { body } = await get<any>(
      server.baseUrl,
      '/api/v1/ha/recovery?tenantId=tenant-enterprise'
    );
    expect(body.tests.every((t: any) => t.tenantId === 'tenant-enterprise')).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it('shows failed test for community tenant', async () => {
    const { body } = await get<any>(
      server.baseUrl,
      '/api/v1/ha/recovery?tenantId=tenant-community'
    );
    const failed = body.tests.filter((t: any) => t.result === 'failed');
    expect(failed.length).toBeGreaterThan(0);
  });

  it('includes rtoByTenant map', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/recovery');
    expect(body.rtoByTenant).toBeDefined();
    expect(body.rtoByTenant['tenant-enterprise']).toBeGreaterThan(0);
  });
});

// ─── Recovery test POST ───────────────────────────────────────────────────────

describe('POST /api/v1/ha/recovery-test', () => {
  it('runs recovery test for enterprise tenant', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/recovery-test', {
      tenantId: 'tenant-enterprise',
    });
    expect(status).toBe(201);
    expect(body.result).toBe('passed');
    expect(typeof body.rtoSeconds).toBe('number');
    expect(body.rtoSeconds).toBeGreaterThanOrEqual(0);
    expect(body.rpoMinutes).toBe(0);
  });

  it('returns rtoSeconds and rpoMinutes in test result', async () => {
    const { body } = await post<any>(server.baseUrl, '/api/v1/ha/recovery-test', {
      tenantId: 'tenant-professional',
    });
    expect(typeof body.rtoSeconds).toBe('number');
    expect(typeof body.rpoMinutes).toBe('number');
    expect(body.tenantId).toBe('tenant-professional');
  });

  it('returns 400 when tenantId missing', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/recovery-test', {});
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for unknown tenant', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/recovery-test', {
      tenantId: 'tenant-unknown',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ─── Restore POST ─────────────────────────────────────────────────────────────

describe('POST /api/v1/ha/restore', () => {
  it('initiates restore from a known backup', async () => {
    const created = await post<any>(server.baseUrl, '/api/v1/ha/backup', {
      tenantId: 'tenant-enterprise',
      type: 'full',
    });
    const backupId = created.body.id;

    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/restore', {
      backupId,
      tenantId: 'tenant-enterprise',
      environment: 'staging',
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.restoreId).toBeDefined();
    expect(body.backupId).toBe(backupId);
  });

  it('restore result contains estimatedDuration', async () => {
    const created = await post<any>(server.baseUrl, '/api/v1/ha/backup', {
      tenantId: 'tenant-professional',
      type: 'incremental',
    });
    const backupId = created.body.id;

    const { body } = await post<any>(server.baseUrl, '/api/v1/ha/restore', {
      backupId,
      tenantId: 'tenant-professional',
    });
    expect(body.estimatedDuration).toBeDefined();
    expect(typeof body.message).toBe('string');
  });

  it('returns 400 when backupId missing', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/restore', {
      tenantId: 'tenant-enterprise',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when tenantId missing', async () => {
    const created = await post<any>(server.baseUrl, '/api/v1/ha/backup', {
      tenantId: 'tenant-enterprise',
      type: 'full',
    });
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/restore', {
      backupId: created.body.id,
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for unknown backup', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/restore', {
      backupId: 'bk-does-not-exist',
      tenantId: 'tenant-enterprise',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
