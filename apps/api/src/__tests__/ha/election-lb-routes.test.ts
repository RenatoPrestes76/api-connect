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

describe('GET /api/v1/ha/election/history', () => {
  it('returns the current term and an empty-or-populated history array', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/election/history');
    expect(status).toBe(200);
    expect(typeof body.term).toBe('number');
    expect(Array.isArray(body.history)).toBe(true);
  });
});

describe('POST /api/v1/ha/election/run', () => {
  it('runs a forced manual election and returns a FailoverResult', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/election/run', {
      reason: 'test drill',
      force: true,
    });
    expect(status).toBe(200);
    expect(body.event).toBeDefined();
    expect(body.newLeader).toBeDefined();
  });

  it('records the election in history afterwards', async () => {
    const { body } = await get<any>(server.baseUrl, '/api/v1/ha/election/history');
    expect(body.history.length).toBeGreaterThan(0);
    expect(body.history[0].outcome).toBe('elected');
  });
});

describe('POST /api/v1/ha/election/simulate-failure + recover', () => {
  it('returns 400 when nodeId missing', async () => {
    const { status, body } = await post<any>(
      server.baseUrl,
      '/api/v1/ha/election/simulate-failure',
      {}
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 404 for an unknown node', async () => {
    const { status } = await post<any>(server.baseUrl, '/api/v1/ha/election/simulate-failure', {
      nodeId: 'nd-does-not-exist',
    });
    expect(status).toBe(404);
  });

  it('marks a node offline then online again', async () => {
    const failed = await post<any>(server.baseUrl, '/api/v1/ha/election/simulate-failure', {
      nodeId: 'nd-005',
    });
    expect(failed.status).toBe(200);
    expect(failed.body.status).toBe('offline');

    const recovered = await post<any>(server.baseUrl, '/api/v1/ha/election/recover', {
      nodeId: 'nd-005',
    });
    expect(recovered.status).toBe(200);
    expect(recovered.body.status).toBe('online');
  });
});

// ─── Load balancer ──────────────────────────────────────────────────────────

describe('GET /api/v1/ha/load-balancer', () => {
  it('returns per-node distribution stats', async () => {
    const { status, body } = await get<any>(server.baseUrl, '/api/v1/ha/load-balancer');
    expect(status).toBe(200);
    expect(Array.isArray(body.targets)).toBe(true);
    expect(body.targets.length).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/ha/load-balancer/route', () => {
  it('routes a request with round_robin by default', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/load-balancer/route', {});
    expect(status).toBe(201);
    expect(body.nodeId).toBeDefined();
    expect(body.strategy).toBe('round_robin');
  });

  it('rejects an invalid strategy', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/load-balancer/route', {
      strategy: 'sticky',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_STRATEGY');
  });

  it('routes with least_connections', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/load-balancer/route', {
      strategy: 'least_connections',
    });
    expect(status).toBe(201);
    expect(body.strategy).toBe('least_connections');
  });
});

describe('POST /api/v1/ha/load-balancer/release', () => {
  it('requires nodeId', async () => {
    const { status, body } = await post<any>(
      server.baseUrl,
      '/api/v1/ha/load-balancer/release',
      {}
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('releases a routed connection', async () => {
    const routed = await post<any>(server.baseUrl, '/api/v1/ha/load-balancer/route', {});
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/load-balancer/release', {
      nodeId: routed.body.nodeId,
    });
    expect(status).toBe(200);
    expect(body.released).toBe(true);
  });
});

describe('POST /api/v1/ha/load-balancer/weight', () => {
  it('sets a positive weight', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/load-balancer/weight', {
      nodeId: 'nd-002',
      weight: 5,
    });
    expect(status).toBe(200);
    expect(body.weight).toBe(5);
  });

  it('rejects a non-positive weight', async () => {
    const { status, body } = await post<any>(server.baseUrl, '/api/v1/ha/load-balancer/weight', {
      nodeId: 'nd-002',
      weight: 0,
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_WEIGHT');
  });
});
