import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHubServer, stopServer, get, post, put, del } from './helpers.js';
import type { TestHubServer } from './helpers.js';

let srv: TestHubServer;
beforeAll(async () => {
  srv = await startHubServer();
});
afterAll(async () => {
  await stopServer(srv.server);
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/dashboard', () => {
  it('returns dashboard metrics', async () => {
    const { status, body } = await get<Record<string, unknown>>(
      srv.baseUrl,
      '/api/v1/hub/dashboard'
    );
    expect(status).toBe(200);
    expect(typeof body['connectors']).toBe('number');
    expect(typeof body['agents']).toBe('number');
    expect(typeof body['overallHealth']).toBe('string');
    expect(Array.isArray(body['syncTrend'])).toBe(true);
    expect(Array.isArray(body['recentActivity'])).toBe(true);
  });

  it('syncTrend has 24 buckets', async () => {
    const { body } = await get<{ syncTrend: unknown[] }>(srv.baseUrl, '/api/v1/hub/dashboard');
    expect(body.syncTrend).toHaveLength(24);
  });
});

// ─── Connectors ───────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/connectors', () => {
  it('returns array of connectors', async () => {
    const { status, body } = await get<unknown[]>(srv.baseUrl, '/api/v1/hub/connectors');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('connectors have required fields', async () => {
    const { body } = await get<Array<Record<string, unknown>>>(
      srv.baseUrl,
      '/api/v1/hub/connectors'
    );
    const c = body[0]!;
    expect(typeof c['id']).toBe('string');
    expect(typeof c['name']).toBe('string');
    expect(typeof c['status']).toBe('string');
    expect(typeof c['driver']).toBe('string');
  });
});

describe('GET /api/v1/hub/connectors/:id', () => {
  let connectorId: string;

  beforeAll(async () => {
    const { body } = await get<Array<{ id: string }>>(srv.baseUrl, '/api/v1/hub/connectors');
    connectorId = body[0]!.id;
  });

  it('returns connector by id', async () => {
    const { status, body } = await get<{ id: string }>(
      srv.baseUrl,
      `/api/v1/hub/connectors/${connectorId}`
    );
    expect(status).toBe(200);
    expect(body.id).toBe(connectorId);
  });

  it('returns 404 for unknown id', async () => {
    const { status } = await get(
      srv.baseUrl,
      '/api/v1/hub/connectors/00000000-0000-0000-0000-000000000000'
    );
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/hub/connectors/:id/stop', () => {
  it('stops a running connector', async () => {
    const { body: connectors } = await get<Array<{ id: string; status: string }>>(
      srv.baseUrl,
      '/api/v1/hub/connectors'
    );
    const running = connectors.find((c) => c.status === 'RUNNING');
    if (!running) return; // no running connectors seeded

    const { status, body } = await post<{ status: string }>(
      srv.baseUrl,
      `/api/v1/hub/connectors/${running.id}/stop`
    );
    expect(status).toBe(200);
    expect(body.status).toBe('STOPPED');
  });
});

describe('POST /api/v1/hub/connectors/:id/start', () => {
  it('starts a stopped connector', async () => {
    const { body: connectors } = await get<Array<{ id: string; status: string }>>(
      srv.baseUrl,
      '/api/v1/hub/connectors'
    );
    const stopped = connectors.find((c) => c.status === 'STOPPED');
    if (!stopped) return;

    const { status, body } = await post<{ status: string }>(
      srv.baseUrl,
      `/api/v1/hub/connectors/${stopped.id}/start`
    );
    expect(status).toBe(200);
    expect(body.status).toBe('RUNNING');
  });
});

describe('POST /api/v1/hub/connectors/:id/restart', () => {
  it('restarts a connector', async () => {
    const { body: connectors } = await get<Array<{ id: string }>>(
      srv.baseUrl,
      '/api/v1/hub/connectors'
    );
    const id = connectors[0]!.id;

    const { status, body } = await post<{ status: string; lastSync?: string }>(
      srv.baseUrl,
      `/api/v1/hub/connectors/${id}/restart`
    );
    expect(status).toBe(200);
    expect(body.status).toBe('RUNNING');
    expect(body.lastSync).toBeDefined();
  });
});

// ─── Agents ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/agents', () => {
  it('returns array of agents', async () => {
    const { status, body } = await get<unknown[]>(srv.baseUrl, '/api/v1/hub/agents');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/hub/agents/:id', () => {
  it('returns agent by id', async () => {
    const { body: agents } = await get<Array<{ id: string }>>(srv.baseUrl, '/api/v1/hub/agents');
    const { status, body } = await get<{ id: string }>(
      srv.baseUrl,
      `/api/v1/hub/agents/${agents[0]!.id}`
    );
    expect(status).toBe(200);
    expect(body.id).toBe(agents[0]!.id);
  });

  it('returns 404 for unknown id', async () => {
    const { status } = await get(
      srv.baseUrl,
      '/api/v1/hub/agents/00000000-0000-0000-0000-000000000000'
    );
    expect(status).toBe(404);
  });
});

// ─── Databases ────────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/databases', () => {
  it('returns array of databases', async () => {
    const { status, body } = await get<unknown[]>(srv.baseUrl, '/api/v1/hub/databases');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

// ─── Sync ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/sync/history', () => {
  it('returns paginated sync history', async () => {
    const { status, body } = await get<{ data: unknown[]; total: number }>(
      srv.baseUrl,
      '/api/v1/hub/sync/history'
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  it('respects limit param', async () => {
    const { body } = await get<{ data: unknown[] }>(
      srv.baseUrl,
      '/api/v1/hub/sync/history?limit=5'
    );
    expect(body.data.length).toBeLessThanOrEqual(5);
  });
});

describe('POST /api/v1/hub/sync/run', () => {
  it('creates a new sync record with RUNNING result', async () => {
    const { status, body } = await post<{ result: string; id: string }>(
      srv.baseUrl,
      '/api/v1/hub/sync/run',
      {}
    );
    expect(status).toBe(201);
    expect(body.result).toBe('RUNNING');
    expect(typeof body.id).toBe('string');
  });
});

describe('POST /api/v1/hub/sync/:id/cancel', () => {
  it('cancels a running sync', async () => {
    const { body: created } = await post<{ id: string; result: string }>(
      srv.baseUrl,
      '/api/v1/hub/sync/run',
      {}
    );
    expect(created.result).toBe('RUNNING');

    const { status, body } = await post<{ result: string }>(
      srv.baseUrl,
      `/api/v1/hub/sync/${created.id}/cancel`
    );
    expect(status).toBe(200);
    expect(body.result).toBe('CANCELLED');
  });

  it('returns 404 for unknown sync id', async () => {
    const { status } = await post(
      srv.baseUrl,
      '/api/v1/hub/sync/00000000-0000-0000-0000-000000000000/cancel'
    );
    expect(status).toBe(404);
  });
});

// ─── Health ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/health', () => {
  it('returns health status', async () => {
    const { status, body } = await get<{ overall: string; components: unknown[] }>(
      srv.baseUrl,
      '/api/v1/hub/health'
    );
    expect(status).toBe(200);
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.overall);
    expect(Array.isArray(body.components)).toBe(true);
  });
});

// ─── Logs ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/logs', () => {
  it('returns log entries', async () => {
    const { status, body } = await get<{ data: unknown[]; total: number }>(
      srv.baseUrl,
      '/api/v1/hub/logs'
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('filters by level', async () => {
    const { body } = await get<{ data: Array<{ level: string }> }>(
      srv.baseUrl,
      '/api/v1/hub/logs?level=error'
    );
    body.data.forEach((e) => expect(e.level).toBe('error'));
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/settings', () => {
  it('returns settings object', async () => {
    const { status, body } = await get<{ sync: unknown; cache: unknown }>(
      srv.baseUrl,
      '/api/v1/hub/settings'
    );
    expect(status).toBe(200);
    expect(body.sync).toBeDefined();
    expect(body.cache).toBeDefined();
  });
});

describe('PUT /api/v1/hub/settings', () => {
  it('updates settings', async () => {
    const { body } = await put<{ sync: { batchSize: number } }>(
      srv.baseUrl,
      '/api/v1/hub/settings',
      {
        sync: { batchSize: 999 },
      }
    );
    expect(body.sync.batchSize).toBe(999);
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/users', () => {
  it('returns list of users', async () => {
    const { status, body } = await get<unknown[]>(srv.baseUrl, '/api/v1/hub/users');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/hub/users', () => {
  it('creates a new user', async () => {
    const { status, body } = await post<{ id: string; email: string; role: string }>(
      srv.baseUrl,
      '/api/v1/hub/users',
      { name: 'Test User', email: 'test@test.com', role: 'READ_ONLY' }
    );
    expect(status).toBe(201);
    expect(body.email).toBe('test@test.com');
    expect(body.role).toBe('READ_ONLY');
  });

  it('returns 409 for duplicate email', async () => {
    await post(srv.baseUrl, '/api/v1/hub/users', {
      name: 'Dup',
      email: 'dup@test.com',
      role: 'READ_ONLY',
    });
    const { status } = await post(srv.baseUrl, '/api/v1/hub/users', {
      name: 'Dup2',
      email: 'dup@test.com',
      role: 'READ_ONLY',
    });
    expect(status).toBe(409);
  });

  it('returns 400 when required fields are missing', async () => {
    const { status } = await post(srv.baseUrl, '/api/v1/hub/users', { name: 'No email' });
    expect(status).toBe(400);
  });
});

describe('PUT /api/v1/hub/users/:id', () => {
  it('updates a user', async () => {
    const { body: list } = await get<Array<{ id: string; role: string }>>(
      srv.baseUrl,
      '/api/v1/hub/users'
    );
    const user = list[0]!;

    const { status, body } = await put<{ role: string }>(
      srv.baseUrl,
      `/api/v1/hub/users/${user.id}`,
      { role: 'OPERATOR' }
    );
    expect(status).toBe(200);
    expect(body.role).toBe('OPERATOR');
  });
});

describe('DELETE /api/v1/hub/users/:id', () => {
  it('deletes a user and returns 204', async () => {
    const { body: created } = await post<{ id: string }>(srv.baseUrl, '/api/v1/hub/users', {
      name: 'Delete Me',
      email: 'delete@test.com',
      role: 'READ_ONLY',
    });
    const { status } = await del(srv.baseUrl, `/api/v1/hub/users/${created.id}`);
    expect(status).toBe(204);
  });

  it('returns 404 for unknown user', async () => {
    const { status } = await del(
      srv.baseUrl,
      '/api/v1/hub/users/00000000-0000-0000-0000-000000000000'
    );
    expect(status).toBe(404);
  });
});

// ─── Discovery ────────────────────────────────────────────────────────────────

describe('GET /api/v1/hub/discovery', () => {
  it('returns an array', async () => {
    const { status, body } = await get<unknown[]>(srv.baseUrl, '/api/v1/hub/discovery');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});
