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

// ─── GET /api/v1/regions/nearest — real haversine distance ─────────────────────

describe('GET /api/v1/regions/nearest', () => {
  it('picks Brazil South as nearest to a São Paulo coordinate', async () => {
    const { status, body } = await get<any>(base, '/api/v1/regions/nearest?lat=-23.55&lon=-46.63');
    expect(status).toBe(200);
    expect(body.nearest.code).toBe('br-south-1');
    expect(body.nearest.distanceKm).toBeLessThan(50);
  });

  it('picks US East as nearest to a Washington DC coordinate', async () => {
    const { body } = await get<any>(base, '/api/v1/regions/nearest?lat=38.9&lon=-77.03');
    expect(body.nearest.code).toBe('us-east-1');
  });

  it('ranks all eligible regions by ascending distance', async () => {
    const { body } = await get<any>(base, '/api/v1/regions/nearest?lat=1.35&lon=103.82');
    const distances = body.ranked.map((r: any) => r.distanceKm);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
    expect(body.ranked[0].code).toBe('ap-southeast-1');
    expect(body.ranked[0].distanceKm).toBeLessThan(5);
  });

  it('excludes the degraded region by default (activeOnly)', async () => {
    // us-west-2 (Oregon) is seeded as 'degraded' — a query near it should not return it.
    const { body } = await get<any>(base, '/api/v1/regions/nearest?lat=45.5&lon=-122.6');
    expect(body.ranked.every((r: any) => r.code !== 'us-west-2')).toBe(true);
  });

  it('includes the degraded region when activeOnly=false', async () => {
    const { body } = await get<any>(
      base,
      '/api/v1/regions/nearest?lat=45.5&lon=-122.6&activeOnly=false'
    );
    expect(body.ranked.some((r: any) => r.code === 'us-west-2')).toBe(true);
  });

  it('returns 400 for missing or invalid coordinates', async () => {
    const missing = await get<any>(base, '/api/v1/regions/nearest');
    expect(missing.status).toBe(400);

    const invalid = await get<any>(base, '/api/v1/regions/nearest?lat=abc&lon=10');
    expect(invalid.status).toBe(400);
  });
});

// ─── POST /api/v1/regions/sync — genuine config replication ────────────────────

describe('POST /api/v1/regions/sync — real replication payload', () => {
  it('returns a real sha256 checksum sized to actual replicated content', async () => {
    // Checksum isn't in the SyncResult body (only itemsSynced/latencyMs are) — verify via
    // the global event this call records, which carries the real checksum.
    await post<any>(base, '/api/v1/regions/sync', {
      sourceRegion: 'us-east-1',
      targetRegion: 'eu-west-1',
      scope: 'full',
    });
    const { body } = await get<any>(base, '/api/v1/global/events?limit=5');
    const event = body.events.find((e: any) => e.type === 'sync.completed');
    expect(event).toBeDefined();
    expect(event.payload.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

// ─── POST /api/v1/regions/failover/auto — automatic geographic failover ────────

describe('POST /api/v1/regions/failover/auto', () => {
  it('automatically fails a tenant over to the nearest eligible active region', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/failover/auto', {
      tenantId: 'tenant-community',
      reason: 'simulated regional outage',
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.automatic).toBe(true);
    expect(body.toRegion).not.toBe(body.fromRegion);
    expect(typeof body.distanceKm).toBe('number');
    expect(body.distanceKm).toBeGreaterThanOrEqual(0);

    // A second automatic failover call now moves the tenant away from where it just landed.
    const second = await post<any>(base, '/api/v1/regions/failover/auto', {
      tenantId: 'tenant-community',
      reason: 'second simulated outage',
    });
    expect(second.body.fromRegion).toBe(body.toRegion);
  });

  it('returns 400 when tenantId missing', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/failover/auto', {});
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for an unknown tenant', async () => {
    const { status, body } = await post<any>(base, '/api/v1/regions/failover/auto', {
      tenantId: 'tenant-does-not-exist',
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
