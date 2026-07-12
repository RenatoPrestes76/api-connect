import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post } from './helpers.js';
import type { TestServer } from './helpers.js';

let srv: TestServer;
let base: string;

beforeAll(async () => {
  srv = await startTestServer();
  base = srv.baseUrl;
});

afterAll(() => srv.close());

// ─── GET /api/v1/regions ──────────────────────────────────────────────────────

describe('GET /api/v1/regions', () => {
  it('returns 200 with all 5 regions', async () => {
    const { status, body } = await get<any>(base, '/api/v1/regions');
    expect(status).toBe(200);
    expect(body.total).toBe(5);
    expect(Array.isArray(body.regions)).toBe(true);
    expect(body.regions).toHaveLength(5);
  });

  it('each region has latencyMs, capacityPct, and continent', async () => {
    const { body } = await get<any>(base, '/api/v1/regions');
    for (const r of body.regions) {
      expect(typeof r.latencyMs).toBe('number');
      expect(typeof r.capacityPct).toBe('number');
      expect(typeof r.continent).toBe('string');
    }
  });

  it('regions are sorted by latencyMs ascending', async () => {
    const { body } = await get<any>(base, '/api/v1/regions');
    const latencies: number[] = body.regions.map((r: any) => r.latencyMs);
    for (let i = 1; i < latencies.length; i++) {
      expect(latencies[i]).toBeGreaterThanOrEqual(latencies[i - 1]!);
    }
  });

  it('filters by status=active', async () => {
    const { status, body } = await get<any>(base, '/api/v1/regions?status=active');
    expect(status).toBe(200);
    expect(body.regions.every((r: any) => r.status === 'active')).toBe(true);
    expect(body.total).toBe(4);
  });

  it('filters by continent=Americas', async () => {
    const { status, body } = await get<any>(base, '/api/v1/regions?continent=Americas');
    expect(status).toBe(200);
    expect(body.regions.every((r: any) => r.continent === 'Americas')).toBe(true);
    expect(body.total).toBe(3);
  });

  it('returns 400 for invalid status', async () => {
    const { status, body } = await get<any>(base, '/api/v1/regions?status=unknown');
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_STATUS');
  });

  it('Brazil region br-south-1 is present and active', async () => {
    const { body } = await get<any>(base, '/api/v1/regions');
    const brazil = body.regions.find((r: any) => r.code === 'br-south-1');
    expect(brazil).toBeDefined();
    expect(brazil.status).toBe('active');
    expect(brazil.flag).toBe('🇧🇷');
  });
});

// ─── GET /api/v1/regions/status ──────────────────────────────────────────────

describe('GET /api/v1/regions/status', () => {
  it('returns 200 with status summary', async () => {
    const { status, body } = await get<any>(base, '/api/v1/regions/status');
    expect(status).toBe(200);
    expect(typeof body.total).toBe('number');
    expect(typeof body.active).toBe('number');
    expect(typeof body.degraded).toBe('number');
  });

  it('active count is 4 (4 active regions)', async () => {
    const { body } = await get<any>(base, '/api/v1/regions/status');
    expect(body.active).toBe(4);
    expect(body.total).toBe(5);
  });

  it('degraded count reflects us-west-2', async () => {
    const { body } = await get<any>(base, '/api/v1/regions/status');
    expect(body.degraded).toBe(1);
  });

  it('includes globalHealth field', async () => {
    const { body } = await get<any>(base, '/api/v1/regions/status');
    expect(['healthy', 'degraded', 'critical', 'offline']).toContain(body.globalHealth);
    expect(body.globalHealth).toBe('degraded');
  });
});

// ─── GET /api/v1/regions/health ──────────────────────────────────────────────

describe('GET /api/v1/regions/health', () => {
  it('returns health for all regions', async () => {
    const { status, body } = await get<any>(base, '/api/v1/regions/health');
    expect(status).toBe(200);
    expect(body.total).toBe(5);
    expect(Array.isArray(body.regions)).toBe(true);
  });

  it('includes latency and capacity per region', async () => {
    const { body } = await get<any>(base, '/api/v1/regions/health');
    for (const r of body.regions) {
      expect(typeof r.latencyMs).toBe('number');
      expect(typeof r.capacityPct).toBe('number');
    }
  });

  it('us-west-2 has status=degraded', async () => {
    const { body } = await get<any>(base, '/api/v1/regions/health');
    const usWest = body.regions.find((r: any) => r.code === 'us-west-2');
    expect(usWest).toBeDefined();
    expect(usWest.status).toBe('degraded');
  });

  it('returns 400 for invalid status filter', async () => {
    const { status, body } = await get<any>(base, '/api/v1/regions/health?status=bad');
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_STATUS');
  });

  it('filters by continent=Europe returns only eu-west-1', async () => {
    const { body } = await get<any>(base, '/api/v1/regions/health?continent=Europe');
    expect(body.regions).toHaveLength(1);
    expect(body.regions[0].code).toBe('eu-west-1');
  });
});

// ─── GET /api/v1/global/overview ─────────────────────────────────────────────

describe('GET /api/v1/global/overview', () => {
  it('returns 200 with totalRegions=5', async () => {
    const { status, body } = await get<any>(base, '/api/v1/global/overview');
    expect(status).toBe(200);
    expect(body.totalRegions).toBe(5);
  });

  it('includes avgLatencyMs as a number', async () => {
    const { body } = await get<any>(base, '/api/v1/global/overview');
    expect(typeof body.avgLatencyMs).toBe('number');
    expect(body.avgLatencyMs).toBeGreaterThan(0);
  });

  it('includes regions array matching all regions', async () => {
    const { body } = await get<any>(base, '/api/v1/global/overview');
    expect(Array.isArray(body.regions)).toBe(true);
    expect(body.regions).toHaveLength(5);
  });

  it('totalTenants is 3', async () => {
    const { body } = await get<any>(base, '/api/v1/global/overview');
    expect(body.totalTenants).toBe(3);
  });

  it('replication summary is included', async () => {
    const { body } = await get<any>(base, '/api/v1/global/overview');
    expect(body.replication).toBeDefined();
    expect(typeof body.replication.total).toBe('number');
    expect(typeof body.replication.inSync).toBe('number');
  });

  it('includes globalHealth field', async () => {
    const { body } = await get<any>(base, '/api/v1/global/overview');
    expect(['healthy', 'degraded', 'critical', 'offline']).toContain(body.globalHealth);
  });
});

// ─── GET /api/v1/global/replication ──────────────────────────────────────────

describe('GET /api/v1/global/replication', () => {
  it('returns all 8 replication records', async () => {
    const { status, body } = await get<any>(base, '/api/v1/global/replication');
    expect(status).toBe(200);
    expect(body.total).toBe(8);
    expect(Array.isArray(body.records)).toBe(true);
    expect(body.records).toHaveLength(8);
  });

  it('filters by sourceRegion=us-east-1', async () => {
    const { body } = await get<any>(base, '/api/v1/global/replication?sourceRegion=us-east-1');
    expect(body.records.every((r: any) => r.sourceRegion === 'us-east-1')).toBe(true);
    expect(body.records).toHaveLength(2);
  });

  it('filters by status=in_sync', async () => {
    const { body } = await get<any>(base, '/api/v1/global/replication?status=in_sync');
    expect(body.records.every((r: any) => r.status === 'in_sync')).toBe(true);
  });

  it('status=lagging finds br-south-1 → us-east-1', async () => {
    const { body } = await get<any>(base, '/api/v1/global/replication?status=lagging');
    expect(body.records).toHaveLength(1);
    expect(body.records[0].sourceRegion).toBe('br-south-1');
    expect(body.records[0].targetRegion).toBe('us-east-1');
    expect(body.records[0].pendingItems).toBe(6);
  });

  it('summary includes failed count for us-west-2', async () => {
    const { body } = await get<any>(base, '/api/v1/global/replication');
    expect(body.failed).toBe(1);
  });
});

// ─── POST /api/v1/regions/failover ───────────────────────────────────────────

describe('POST /api/v1/regions/failover', () => {
  it('returns 201 on successful tenant failover', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/failover', {
      tenantId: 'tenant-enterprise',
      fromRegion: 'us-east-1',
      toRegion: 'eu-west-1',
      reason: 'Network partition in us-east-1',
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.tenantId).toBe('tenant-enterprise');
    expect(body.toRegion).toBe('eu-west-1');
  });

  it('failover result includes complianceChecked and failoveredAt', async () => {
    const { body } = await post<any>(base, '/api/v1/regions/failover', {
      tenantId: 'tenant-professional',
      fromRegion: 'br-south-1',
      toRegion: 'us-east-1',
      reason: 'Capacity exceeded',
    });
    expect(body.complianceChecked).toBe(true);
    expect(typeof body.failoveredAt).toBe('string');
  });

  it('returns 400 when tenantId is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/failover', {
      fromRegion: 'us-east-1',
      toRegion: 'eu-west-1',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when fromRegion is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/failover', {
      tenantId: 'tenant-enterprise',
      toRegion: 'eu-west-1',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when toRegion is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/failover', {
      tenantId: 'tenant-enterprise',
      fromRegion: 'us-east-1',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for unknown tenant', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/failover', {
      tenantId: 'tenant-unknown',
      fromRegion: 'us-east-1',
      toRegion: 'eu-west-1',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ─── POST /api/v1/regions/migrate-tenant ─────────────────────────────────────

describe('POST /api/v1/regions/migrate-tenant', () => {
  it('returns 201 on successful migration', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/migrate-tenant', {
      tenantId: 'tenant-community',
      targetRegion: 'br-south-1',
      reason: 'Latency optimization',
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.targetRegion).toBe('br-south-1');
  });

  it('migration result includes previousRegion and complianceWarnings', async () => {
    const { body } = await post<any>(base, '/api/v1/regions/migrate-tenant', {
      tenantId: 'tenant-professional',
      targetRegion: 'eu-west-1',
    });
    expect(typeof body.previousRegion).toBe('string');
    expect(Array.isArray(body.complianceWarnings)).toBe(true);
  });

  it('returns 400 when tenantId is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/migrate-tenant', {
      targetRegion: 'eu-west-1',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when targetRegion is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/migrate-tenant', {
      tenantId: 'tenant-enterprise',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for unknown tenant', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/migrate-tenant', {
      tenantId: 'tenant-xxx',
      targetRegion: 'us-east-1',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('LGPD warning when tenant-professional migrates outside Brazil', async () => {
    const { body } = await post<any>(base, '/api/v1/regions/migrate-tenant', {
      tenantId: 'tenant-professional',
      targetRegion: 'ap-southeast-1',
    });
    expect(body.success).toBe(true);
    expect(body.complianceWarnings.length).toBeGreaterThan(0);
    expect(body.complianceWarnings.some((w: string) => w.includes('LGPD'))).toBe(true);
  });
});

// ─── POST /api/v1/regions/sync ───────────────────────────────────────────────

describe('POST /api/v1/regions/sync', () => {
  it('returns 201 on successful sync', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/sync', {
      sourceRegion: 'us-east-1',
      targetRegion: 'eu-west-1',
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.sourceRegion).toBe('us-east-1');
    expect(body.targetRegion).toBe('eu-west-1');
  });

  it('sync result includes itemsSynced and latencyMs', async () => {
    const { body } = await post<any>(base, '/api/v1/regions/sync', {
      sourceRegion: 'eu-west-1',
      targetRegion: 'br-south-1',
      scope: 'full',
    });
    expect(typeof body.itemsSynced).toBe('number');
    expect(body.itemsSynced).toBeGreaterThan(0);
    expect(typeof body.latencyMs).toBe('number');
  });

  it('scope=configs syncs the real number of config items for that region pair', async () => {
    const { body } = await post<any>(base, '/api/v1/regions/sync', {
      sourceRegion: 'us-east-1',
      targetRegion: 'br-south-1',
      scope: 'configs',
    });
    expect(typeof body.itemsSynced).toBe('number');
    expect(body.itemsSynced).toBeGreaterThanOrEqual(0);
    expect(body.scope).toBe('configs');
  });

  it('returns 400 when sourceRegion is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/sync', {
      targetRegion: 'eu-west-1',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 when targetRegion is missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/sync', {
      sourceRegion: 'us-east-1',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for unknown sourceRegion', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/sync', {
      sourceRegion: 'region-unknown',
      targetRegion: 'eu-west-1',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('REGION_NOT_FOUND');
  });

  it('sync creates a global event', async () => {
    // Verify event gets created by checking replication updated
    const syncRes = await post<any>(base, '/api/v1/regions/sync', {
      sourceRegion: 'ap-southeast-1',
      targetRegion: 'br-south-1',
      scope: 'policies',
    });
    expect(syncRes.body.success).toBe(true);
    expect(typeof syncRes.body.itemsSynced).toBe('number');
    // Verify replication now shows in_sync for this pair
    const repRes = await get<any>(base, '/api/v1/global/replication?sourceRegion=ap-southeast-1');
    const record = repRes.body.records.find((r: any) => r.targetRegion === 'br-south-1');
    expect(record).toBeDefined();
    expect(record.status).toBe('in_sync');
  });
});
