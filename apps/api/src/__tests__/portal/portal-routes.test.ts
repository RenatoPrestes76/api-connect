import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post, put, type TestServer } from './helpers.js';

let srv: TestServer;
beforeAll(async () => {
  srv = await startTestServer();
});
afterAll(async () => {
  await srv.close();
});

const ENT = { 'x-tenant-id': 'tenant-enterprise' };
const PRO = { 'x-tenant-id': 'tenant-professional' };

// ─── Dashboard ────────────────────────────────────────────────────────────────
describe('GET /api/v1/portal/dashboard', () => {
  it('returns enterprise dashboard', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/portal/dashboard', ENT);
    expect(status).toBe(200);
    expect(body.tenantId).toBe('tenant-enterprise');
    expect(body.plan).toBe('enterprise');
    expect(body).toHaveProperty('agentsOnline');
    expect(body).toHaveProperty('workflowsActive');
    expect(body).toHaveProperty('onboarding');
  });

  it('returns onboarding 100% for enterprise', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/portal/dashboard', ENT);
    expect(body.onboarding.percentComplete).toBe(100);
  });

  it('returns professional dashboard with partial onboarding', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/portal/dashboard', PRO);
    expect(body.tenantId).toBe('tenant-professional');
    expect(body.onboarding.percentComplete).toBeGreaterThan(0);
    expect(body.onboarding.percentComplete).toBeLessThan(100);
  });
});

describe('POST /api/v1/portal/onboarding/complete-step', () => {
  it('completes a step successfully', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/portal/onboarding/complete-step',
      { step: 'primeira_execucao' },
      PRO
    );
    expect(status).toBe(200);
    expect(body.progress.completedSteps).toContain('primeira_execucao');
  });

  it('returns 400 when step missing', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/portal/onboarding/complete-step',
      {},
      ENT
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_STEP');
  });
});

// ─── Support ──────────────────────────────────────────────────────────────────
describe('GET /api/v1/portal/support', () => {
  it('returns ticket list for enterprise', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/portal/support', ENT);
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(body.tickets)).toBe(true);
  });

  it('filters by status=open', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/portal/support?status=open', ENT);
    for (const t of body.tickets) {
      expect(t.status).toBe('open');
    }
  });
});

describe('GET /api/v1/portal/support/:id', () => {
  it('returns specific ticket', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/portal/support/tkt-001');
    expect(status).toBe(200);
    expect(body.id).toBe('tkt-001');
    expect(body.severity).toBe('P2');
  });

  it('returns 404 for unknown ticket', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/portal/support/tkt-999');
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/portal/support', () => {
  it('creates a new ticket', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/portal/support',
      {
        title: 'New integration issue',
        description: 'Cannot connect to MySQL endpoint',
        severity: 'P3',
        category: 'integration',
      },
      ENT
    );
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('open');
    expect(body.slaTargetHours).toBe(24);
  });

  it('returns 400 for missing title', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/portal/support', {
      description: 'no title',
      severity: 'P3',
      category: 'technical',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('returns 400 for invalid severity', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/portal/support', {
      title: 'T',
      description: 'D',
      severity: 'P5',
      category: 'technical',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_SEVERITY');
  });
});

describe('PUT /api/v1/portal/support/:id/status', () => {
  it('updates ticket status to resolved', async () => {
    const { status, body } = await put<any>(srv.baseUrl, '/api/v1/portal/support/tkt-002/status', {
      status: 'resolved',
    });
    expect(status).toBe(200);
    expect(body.status).toBe('resolved');
    expect(body.resolvedAt).not.toBeNull();
  });

  it('returns 400 for invalid status', async () => {
    const { status } = await put<any>(srv.baseUrl, '/api/v1/portal/support/tkt-001/status', {
      status: 'cancelled',
    });
    expect(status).toBe(400);
  });
});

// ─── API Keys ─────────────────────────────────────────────────────────────────
// Sprint 46.5 moved /api/v1/portal/api-keys onto the real, org/session-scoped
// gateway module at /api/v1/portal/gateway/api-keys — see
// __tests__/gateway/gateway-routes.test.ts for full coverage.

// ─── Connectors ───────────────────────────────────────────────────────────────
describe('GET /api/v1/portal/connectors', () => {
  it('returns connectors with summary', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/portal/connectors', ENT);
    expect(status).toBe(200);
    expect(body).toHaveProperty('summary');
    expect(body.summary.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(body.connectors)).toBe(true);
  });
});

describe('PUT /api/v1/portal/connectors/:id/health', () => {
  it('updates connector health', async () => {
    const { status, body } = await put<any>(
      srv.baseUrl,
      '/api/v1/portal/connectors/pc-001/health',
      {
        health: 'degraded',
      }
    );
    expect(status).toBe(200);
    expect(body.health).toBe('degraded');
  });

  it('returns 400 for invalid health value', async () => {
    const { status } = await put<any>(srv.baseUrl, '/api/v1/portal/connectors/pc-001/health', {
      health: 'unknown-value',
    });
    expect(status).toBe(400);
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────
// Sprint 46.4 moved /api/v1/portal/users (and the invite flow) onto the real,
// session-based portal-identity system — see
// __tests__/portal-identity/portal-identity-routes.test.ts for full coverage.
// These routes no longer accept the tenant-header trust model tested below.

// ─── Tenant enforcement (Sprint 00.1) ──────────────────────────────────────────
// No route may fall back to a default tenant — every request below omits
// x-tenant-id and must fail with 400 TENANT_REQUIRED.

describe('Tenant enforcement — no hardcoded tenant fallback', () => {
  const NO_TENANT_ROUTES = [
    '/api/v1/portal/dashboard',
    '/api/v1/portal/support',
    '/api/v1/portal/connectors',
  ];

  for (const path of NO_TENANT_ROUTES) {
    it(`GET ${path} returns 400 TENANT_REQUIRED without a tenant`, async () => {
      const { status, body } = await get<{ error: { code: string } }>(srv.baseUrl, path);
      expect(status).toBe(400);
      expect(body.error.code).toBe('TENANT_REQUIRED');
    });
  }

  it('a valid tenant continues to work (no regression)', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/dashboard', ENT);
    expect(status).toBe(200);
  });
});
