import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startObservatoryServer,
  stopServer,
  get,
  post,
  put,
  del,
  type TestObservatoryServer,
} from './helpers.js';
import type { Server } from 'node:http';

let srv: TestObservatoryServer;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  srv = await startObservatoryServer();
  server = srv.server;
  baseUrl = srv.baseUrl;
});

afterAll(async () => {
  await stopServer(server);
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

describe('GET /api/v1/observatory/dashboard', () => {
  it('returns executive dashboard', async () => {
    const { status, body } = await get<Record<string, unknown>>(
      baseUrl,
      '/api/v1/observatory/dashboard'
    );
    expect(status).toBe(200);
    expect(body.integrationsActive).toBe(243);
    expect(body.workflowsTotal).toBe(1_189);
    expect(typeof body.availabilityPct).toBe('number');
    expect(Array.isArray(body.trend)).toBe(true);
    expect(Array.isArray(body.componentHealth)).toBe(true);
  });
});

describe('GET /api/v1/observatory/health', () => {
  it('returns system health with components', async () => {
    const { status, body } = await get<Record<string, unknown>>(
      baseUrl,
      '/api/v1/observatory/health'
    );
    expect(status).toBe(200);
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.overall);
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(Array.isArray(body.components)).toBe(true);
    expect((body.components as unknown[]).length).toBeGreaterThan(0);
  });
});

// ─── Metrics ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/observatory/metrics', () => {
  it('returns 288 metric samples by default', async () => {
    const { status, body } = await get<{ items: unknown[]; total: number }>(
      baseUrl,
      '/api/v1/observatory/metrics'
    );
    expect(status).toBe(200);
    expect(body.items.length).toBe(288);
    expect(body.total).toBe(288);
  });

  it('respects limit param', async () => {
    const { status, body } = await get<{ items: unknown[] }>(
      baseUrl,
      '/api/v1/observatory/metrics?limit=24'
    );
    expect(status).toBe(200);
    expect(body.items.length).toBe(24);
  });
});

describe('GET /api/v1/observatory/heatmap', () => {
  it('returns 168 heatmap cells (7 × 24)', async () => {
    const { status, body } = await get<{ cells: unknown[] }>(
      baseUrl,
      '/api/v1/observatory/heatmap'
    );
    expect(status).toBe(200);
    expect(body.cells.length).toBe(168);
  });
});

// ─── Alert Rules ──────────────────────────────────────────────────────────────

describe('Alert Rules CRUD', () => {
  let ruleId: string;

  it('GET /api/v1/observatory/alert-rules — returns seeded rules', async () => {
    const { status, body } = await get<unknown[]>(baseUrl, '/api/v1/observatory/alert-rules');
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThanOrEqual(10);
  });

  it('POST creates a new rule', async () => {
    const { status, body } = await post<Record<string, unknown>>(
      baseUrl,
      '/api/v1/observatory/alert-rules',
      {
        name: 'Test Alert',
        condition: 'failureRate > 0.1',
        severity: 'WARNING',
        channels: ['email'],
      }
    );
    expect(status).toBe(201);
    expect(body.name).toBe('Test Alert');
    ruleId = body.id as string;
  });

  it('POST 400 when required fields missing', async () => {
    const { status } = await post(baseUrl, '/api/v1/observatory/alert-rules', {
      name: 'Missing fields',
    });
    expect(status).toBe(400);
  });

  it('GET /api/v1/observatory/alert-rules/:id returns rule', async () => {
    const { status, body } = await get<Record<string, unknown>>(
      baseUrl,
      `/api/v1/observatory/alert-rules/${ruleId}`
    );
    expect(status).toBe(200);
    expect(body.id).toBe(ruleId);
  });

  it('PUT updates rule', async () => {
    const { status, body } = await put<Record<string, unknown>>(
      baseUrl,
      `/api/v1/observatory/alert-rules/${ruleId}`,
      {
        active: false,
      }
    );
    expect(status).toBe(200);
    expect(body.active).toBe(false);
  });

  it('DELETE removes rule', async () => {
    const { status } = await del(baseUrl, `/api/v1/observatory/alert-rules/${ruleId}`);
    expect(status).toBe(204);
  });

  it('GET 404 after delete', async () => {
    const { status } = await get(baseUrl, `/api/v1/observatory/alert-rules/${ruleId}`);
    expect(status).toBe(404);
  });
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

describe('Alerts', () => {
  it('GET /api/v1/observatory/alerts returns paginated list', async () => {
    const { status, body } = await get<{ items: unknown[]; total: number }>(
      baseUrl,
      '/api/v1/observatory/alerts'
    );
    expect(status).toBe(200);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(typeof body.total).toBe('number');
  });

  it('GET filters by severity=CRITICAL', async () => {
    const { status, body } = await get<{ items: Array<{ severity: string }> }>(
      baseUrl,
      '/api/v1/observatory/alerts?severity=CRITICAL'
    );
    expect(status).toBe(200);
    body.items.forEach((a) => expect(a.severity).toBe('CRITICAL'));
  });

  it('POST acknowledge an alert', async () => {
    const { body: alerts } = await get<{ items: Array<{ id: string; acknowledged: boolean }> }>(
      baseUrl,
      '/api/v1/observatory/alerts?acknowledged=false&limit=1'
    );
    if (!alerts.items[0]) return; // all acknowledged already
    const id = alerts.items[0].id;
    const { status, body } = await post<Record<string, unknown>>(
      baseUrl,
      `/api/v1/observatory/alerts/${id}/acknowledge`,
      {}
    );
    expect(status).toBe(200);
    expect(body.acknowledged).toBe(true);
  });
});

// ─── Incidents ────────────────────────────────────────────────────────────────

describe('Incidents', () => {
  let incId: string;

  it('GET /api/v1/observatory/incidents returns seeded incidents', async () => {
    const { status, body } = await get<{ items: unknown[]; total: number }>(
      baseUrl,
      '/api/v1/observatory/incidents'
    );
    expect(status).toBe(200);
    expect(body.items.length).toBeGreaterThanOrEqual(5);
  });

  it('POST creates incident', async () => {
    const { status, body } = await post<Record<string, unknown>>(
      baseUrl,
      '/api/v1/observatory/incidents',
      {
        title: 'Test Incident',
        description: 'Something went wrong',
        severity: 'MEDIUM',
      }
    );
    expect(status).toBe(201);
    expect(body.status).toBe('OPEN');
    incId = body.id as string;
  });

  it('POST 400 without title', async () => {
    const { status } = await post(baseUrl, '/api/v1/observatory/incidents', { severity: 'LOW' });
    expect(status).toBe(400);
  });

  it('GET incident by id', async () => {
    const { status, body } = await get<Record<string, unknown>>(
      baseUrl,
      `/api/v1/observatory/incidents/${incId}`
    );
    expect(status).toBe(200);
    expect(body.id).toBe(incId);
  });

  it('POST status update advances lifecycle', async () => {
    const { status, body } = await post<Record<string, unknown>>(
      baseUrl,
      `/api/v1/observatory/incidents/${incId}/status`,
      { status: 'INVESTIGATING', message: 'Looking into it' }
    );
    expect(status).toBe(200);
    expect(body.status).toBe('INVESTIGATING');
    expect((body.events as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  it('GET 404 on unknown incident', async () => {
    const { status } = await get(baseUrl, '/api/v1/observatory/incidents/nope');
    expect(status).toBe(404);
  });
});

// ─── Audit ────────────────────────────────────────────────────────────────────

describe('Audit Trail', () => {
  it('GET /api/v1/observatory/audit returns 200+ logs', async () => {
    const { status, body } = await get<{ items: unknown[]; total: number }>(
      baseUrl,
      '/api/v1/observatory/audit?limit=100'
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(200);
  });

  it('filters by outcome=failure', async () => {
    const { status, body } = await get<{ items: Array<{ outcome: string }> }>(
      baseUrl,
      '/api/v1/observatory/audit?outcome=failure'
    );
    expect(status).toBe(200);
    body.items.forEach((l) => expect(l.outcome).toBe('failure'));
  });

  it('POST creates audit log', async () => {
    const { status, body } = await post<Record<string, unknown>>(
      baseUrl,
      '/api/v1/observatory/audit',
      {
        actor: 'test@example.com',
        action: 'test.action',
        resourceType: 'test',
        resourceName: 'test-resource',
      }
    );
    expect(status).toBe(201);
    expect(body.actor).toBe('test@example.com');
    expect(body.outcome).toBe('success');
  });
});

// ─── SLA ──────────────────────────────────────────────────────────────────────

describe('SLA', () => {
  let slaId: string;

  it('GET /api/v1/observatory/sla returns seeded definitions', async () => {
    const { status, body } = await get<unknown[]>(baseUrl, '/api/v1/observatory/sla');
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThanOrEqual(5);
  });

  it('POST creates SLA definition', async () => {
    const { status, body } = await post<Record<string, unknown>>(
      baseUrl,
      '/api/v1/observatory/sla',
      {
        name: 'API Response 3s',
        maxDurationMs: 3_000,
        description: 'All API nodes must respond within 3s',
      }
    );
    expect(status).toBe(201);
    expect(body.name).toBe('API Response 3s');
    expect(body.warnThresholdMs).toBeLessThan(3_000);
    slaId = body.id as string;
  });

  it('PUT updates SLA', async () => {
    const { status, body } = await put<Record<string, unknown>>(
      baseUrl,
      `/api/v1/observatory/sla/${slaId}`,
      {
        active: false,
      }
    );
    expect(status).toBe(200);
    expect(body.active).toBe(false);
  });

  it('GET sla-events returns violations', async () => {
    const { status, body } = await get<{ items: unknown[]; total: number }>(
      baseUrl,
      '/api/v1/observatory/sla-events'
    );
    expect(status).toBe(200);
    expect(typeof body.total).toBe('number');
  });
});

// ─── Timeline ─────────────────────────────────────────────────────────────────

describe('Timeline', () => {
  it('GET /api/v1/observatory/timeline returns events', async () => {
    const { status, body } = await get<{ items: unknown[]; total: number }>(
      baseUrl,
      '/api/v1/observatory/timeline'
    );
    expect(status).toBe(200);
    expect(body.items.length).toBeGreaterThan(0);
  });
});
