import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  startTestServerWithAuth,
  get,
  post,
  put,
  del,
  genericAuthBearer,
  portalUserBearer,
  runtimeBearer,
  type TestServer,
} from './helpers.js';

let srv: TestServer;
beforeAll(async () => {
  srv = await startTestServer();
});
afterAll(async () => {
  await srv.close();
});

// ATLAS 46.26 — Part H audit: unlike billing/security, this module (and its
// six siblings — health, dashboard, feature-flags, slo, dr, circuit-breakers)
// is deliberately left admin-global rather than tenant-scoped; see the doc
// comment atop routes/v1/ops/queues.ts for the full reasoning. These two
// tests document that decision as an explicit, intentional contract rather
// than an untested gap — this module has no tenant identity concept to test
// isolation against; any authenticated staff caller sees/controls the whole
// platform queue by design.
describe('Ops queues — deliberately admin-global (documented ATLAS 46.26 Part H decision)', () => {
  it('GET /queues returns jobs across all tenants unfiltered by caller identity', async () => {
    const a = await post<any>(srv.baseUrl, '/api/v1/ops/queues/enqueue', {
      type: 'cross_tenant_visibility_probe',
      tenantId: 'tenant-a-ops-probe',
    });
    const b = await post<any>(srv.baseUrl, '/api/v1/ops/queues/enqueue', {
      type: 'cross_tenant_visibility_probe',
      tenantId: 'tenant-b-ops-probe',
    });
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/queues');
    const ids = body.jobs.map((j: any) => j.id);
    expect(ids).toContain(a.body.job.id);
    expect(ids).toContain(b.body.job.id);
  });

  it('enqueue\'s tenantId is attribution metadata only (who this job is "for"), not an access-control boundary — any caller may set it to any value', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/ops/queues/enqueue', {
      type: 'attribution_probe',
      tenantId: 'tenant-arbitrary-attribution',
    });
    expect(status).toBe(201);
    expect(body.job.tenantId).toBe('tenant-arbitrary-attribution');
  });
});

/**
 * ATLAS 46.26 — final hardening, Part 6. Confirmed, via the real
 * production auth chain (authMiddleware, not the auth-less server the
 * rest of this file uses): ops/* correctly excludes portal users and
 * Runtimes — structurally, by construction, since they're issued tokens
 * signed with PORTAL_JWT_SECRET / RUNTIME_JWT_SECRET respectively, which
 * can never verify against the generic middleware's SUPABASE_JWT_SECRET —
 * and correctly excludes fully anonymous callers.
 *
 * DEFERRED / EXTERNAL (not silently marked "already secure"): unlike
 * billing/admin and the rotation/evaluate endpoint, ops/* has no
 * admin-identity `requirePermission` check of its own — it only requires
 * SOME valid generic-auth session. Whether that structurally excludes
 * every non-staff identity depends on who is provisioned in the external
 * Supabase Auth tenant this generic middleware verifies against, which is
 * outside this codebase's control and outside this sprint's explicit
 * "no ops architecture change" boundary. Not treated as ACCEPTED
 * ARCHITECTURAL DESIGN — flagged as a genuine residual risk in the final
 * report.
 */
describe('Ops — auth boundary (final hardening, Part 6)', () => {
  let authSrv: TestServer;
  beforeAll(async () => {
    authSrv = await startTestServerWithAuth();
  });
  afterAll(async () => {
    await authSrv.close();
  });

  const REPRESENTATIVE_ROUTES = [
    '/api/v1/ops/health',
    '/api/v1/ops/dashboard',
    '/api/v1/ops/queues',
    '/api/v1/ops/feature-flags',
    '/api/v1/ops/slo',
    '/api/v1/ops/dr',
    '/api/v1/ops/circuit-breakers',
  ];

  for (const path of REPRESENTATIVE_ROUTES) {
    it(`GET ${path} rejects a fully anonymous caller`, async () => {
      const { status } = await get<any>(authSrv.baseUrl, path);
      expect(status).toBe(401);
    });

    it(`GET ${path} rejects a real portal-identity session (different signing secret)`, async () => {
      const { status } = await get<any>(authSrv.baseUrl, path, await portalUserBearer());
      expect(status).toBe(401);
    });

    it(`GET ${path} rejects a real Runtime access token (different signing secret)`, async () => {
      const { status } = await get<any>(authSrv.baseUrl, path, await runtimeBearer());
      expect(status).toBe(401);
    });

    it(`GET ${path} allows a valid generic-auth (staff) session`, async () => {
      const { status } = await get<any>(authSrv.baseUrl, path, genericAuthBearer());
      // /health may legitimately report 207 (degraded, e.g. no DB configured
      // in this bare test server) — what matters here is that auth let the
      // request through to the handler at all, not the health verdict.
      expect([200, 207]).toContain(status);
    });
  }
});

// ─── Health ──────────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/health', () => {
  it('returns a health report with status field', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/health');
    expect([200, 207, 503]).toContain(status);
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(Array.isArray(body.checks)).toBe(true);
  });

  it('report includes version and uptime', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/health');
    expect(body).toHaveProperty('version');
    expect(typeof body.uptime).toBe('number');
  });
});

describe('GET /api/v1/ops/ready', () => {
  it('returns ready status', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/ready');
    expect(body).toHaveProperty('ready');
    expect(Array.isArray(body.openCircuits)).toBe(true);
  });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/dashboard', () => {
  it('returns KPIs, SLOs, circuits, queues', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/dashboard');
    expect(status).toBe(200);
    expect(body).toHaveProperty('kpis');
    expect(body).toHaveProperty('slos');
    expect(body).toHaveProperty('circuitBreakers');
    expect(body).toHaveProperty('queues');
  });

  it('kpis.featureFlags.total is 5 (seeded)', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/dashboard');
    expect(body.kpis.featureFlags.total).toBe(5);
  });
});

// ─── Queues ──────────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/queues', () => {
  it('returns stats and job lists', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/queues');
    expect(status).toBe(200);
    expect(body).toHaveProperty('stats');
    expect(body).toHaveProperty('jobs');
    expect(body).toHaveProperty('dlq');
    expect(body.stats.dlq).toBe(2);
  });

  it('filters by priority=high', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/queues?priority=high');
    for (const job of body.jobs) {
      expect(job.priority).toBe('high');
    }
  });
});

describe('POST /api/v1/ops/queues/enqueue', () => {
  it('enqueues a new job', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/ops/queues/enqueue', {
      type: 'test_job',
      priority: 'low',
      payload: { x: 1 },
      tenantId: 'tenant-enterprise',
    });
    expect(status).toBe(201);
    expect(body.job.type).toBe('test_job');
    expect(body.job.priority).toBe('low');
  });

  it('returns 400 when type is missing', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/ops/queues/enqueue', {
      priority: 'normal',
      tenantId: 'tenant-enterprise',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_TYPE');
  });

  it('returns 409 on duplicate idempotency key', async () => {
    const key = `idem-${Date.now()}`;
    await post<any>(srv.baseUrl, '/api/v1/ops/queues/enqueue', {
      type: 'my_job',
      idempotencyKey: key,
      tenantId: 'tenant-enterprise',
    });
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/ops/queues/enqueue', {
      type: 'my_job',
      idempotencyKey: key,
      tenantId: 'tenant-enterprise',
    });
    expect(status).toBe(409);
    expect(body.error.code).toBe('DUPLICATE_JOB');
  });

  it('returns 400 TENANT_REQUIRED when no tenant is provided', async () => {
    const { status, body } = await post<{ error: { code: string } }>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { type: 'test_job' }
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('TENANT_REQUIRED');
  });
});

describe('POST /api/v1/ops/queues/dlq/retry', () => {
  it('retries a DLQ job', async () => {
    const { body: q } = await get<any>(srv.baseUrl, '/api/v1/ops/queues');
    const dlqJob = q.dlq[0];
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/ops/queues/dlq/retry', {
      jobId: dlqJob.id,
    });
    expect(status).toBe(200);
    expect(body.job.status).toBe('pending');
  });

  it('returns 404 for unknown job', async () => {
    const { status } = await post<any>(srv.baseUrl, '/api/v1/ops/queues/dlq/retry', {
      jobId: 'nonexistent',
    });
    expect(status).toBe(404);
  });

  it('returns 400 when jobId missing', async () => {
    const { status } = await post<any>(srv.baseUrl, '/api/v1/ops/queues/dlq/retry', {});
    expect(status).toBe(400);
  });
});

// ─── Feature Flags ────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/feature-flags', () => {
  it('returns seeded flags list', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/feature-flags');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(body.flags)).toBe(true);
  });
});

describe('GET /api/v1/ops/feature-flags/:id', () => {
  it('returns a flag by id', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/feature-flags/ff-001');
    expect(body.key).toBe('multi-tenant-ai');
  });

  it('returns 404 for unknown flag', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/ops/feature-flags/no-such-flag');
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/ops/feature-flags', () => {
  it('creates a new flag', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/ops/feature-flags', {
      name: 'New Test Flag',
      key: 'new-test-flag',
      enabled: true,
      rolloutPercentage: 25,
    });
    expect(status).toBe(201);
    expect(body.key).toBe('new-test-flag');
    expect(body.id).toBeTruthy();
  });

  it('returns 400 when key/name missing', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/ops/feature-flags', {
      description: 'no name or key',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });
});

describe('PUT /api/v1/ops/feature-flags/:id', () => {
  it('updates a flag', async () => {
    const { body } = await put<any>(srv.baseUrl, '/api/v1/ops/feature-flags/ff-004', {
      enabled: false,
    });
    expect(body.enabled).toBe(false);
  });

  it('returns 404 for unknown flag', async () => {
    const { status } = await put<any>(srv.baseUrl, '/api/v1/ops/feature-flags/nope', {
      enabled: false,
    });
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/ops/feature-flags/:id/evaluate', () => {
  it('evaluates multi-tenant-ai flag as enabled at 100%', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags/ff-001/evaluate',
      { context: { tenantId: 'tenant-x' } }
    );
    expect(status).toBe(200);
    expect(body.enabled).toBe(true);
  });

  it('evaluates disabled flag as enabled=false', async () => {
    const { body } = await post<any>(srv.baseUrl, '/api/v1/ops/feature-flags/ff-005/evaluate', {
      context: { tenantId: 'tenant-x' },
    });
    expect(body.enabled).toBe(false);
    expect(body.reason).toBe('disabled');
  });

  it('evaluates targeting rule for beta-workflow-builder (enterprise plan)', async () => {
    const { body } = await post<any>(srv.baseUrl, '/api/v1/ops/feature-flags/ff-003/evaluate', {
      context: { tenantId: 'tenant-enterprise', plan: 'enterprise' },
    });
    expect(body.enabled).toBe(true);
    expect(body.reason).toBe('targeting_match');
  });

  it('returns 404 for unknown flag evaluation', async () => {
    const { status } = await post<any>(srv.baseUrl, '/api/v1/ops/feature-flags/no-such/evaluate', {
      context: {},
    });
    expect(status).toBe(404);
  });
});

describe('DELETE /api/v1/ops/feature-flags/:id', () => {
  it('deletes a newly created flag', async () => {
    const { body: created } = await post<any>(srv.baseUrl, '/api/v1/ops/feature-flags', {
      name: 'Temp Flag',
      key: `temp-${Date.now()}`,
    });
    const { status, body } = await del<any>(srv.baseUrl, `/api/v1/ops/feature-flags/${created.id}`);
    expect(status).toBe(200);
    expect(body.deleted).toBe(true);
  });
});

// ─── SLO ─────────────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/slo', () => {
  it('returns SLO list with summary', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/slo');
    expect(status).toBe(200);
    expect(Array.isArray(body.slos)).toBe(true);
    expect(body.slos.length).toBeGreaterThanOrEqual(5);
    expect(body.summary).toHaveProperty('total');
    expect(body.summary).toHaveProperty('compliant');
  });
});

describe('GET /api/v1/ops/slo/:id', () => {
  it('returns specific SLO', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/slo/slo-001');
    expect(status).toBe(200);
    expect(body.name).toBe('API Availability');
  });

  it('returns 404 for unknown SLO', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/ops/slo/slo-999');
    expect(status).toBe(404);
  });
});

// ─── DR ──────────────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/dr', () => {
  it('returns DR config, backups, and tests', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/dr');
    expect(status).toBe(200);
    expect(body).toHaveProperty('config');
    expect(body.config.rto).toBe(15);
    expect(body.config.rpo).toBe(5);
    expect(Array.isArray(body.backups)).toBe(true);
    expect(Array.isArray(body.tests)).toBe(true);
  });
});

describe('GET /api/v1/ops/dr/backups', () => {
  it('returns backup list', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/dr/backups');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });
});

describe('POST /api/v1/ops/dr/backup/trigger', () => {
  it('triggers an incremental backup', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/ops/dr/backup/trigger', {
      type: 'incremental',
    });
    expect(status).toBe(202);
    expect(body.backup.type).toBe('incremental');
    expect(body.backup.status).toBe('running');
  });

  it('returns 400 for invalid backup type', async () => {
    const { status } = await post<any>(srv.baseUrl, '/api/v1/ops/dr/backup/trigger', {
      type: 'invalid',
    });
    expect(status).toBe(400);
  });
});

describe('POST /api/v1/ops/dr/test', () => {
  it('records a DR test', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/ops/dr/test', {
      type: 'restore',
      status: 'passed',
      rtoActual: 9,
      rpoActual: 2,
      notes: 'Automated restore test passed in dev environment',
    });
    expect(status).toBe(201);
    expect(body.test.type).toBe('restore');
    expect(body.test.id).toBeTruthy();
  });

  it('returns 400 for invalid test type', async () => {
    const { status } = await post<any>(srv.baseUrl, '/api/v1/ops/dr/test', {
      type: 'mystery',
    });
    expect(status).toBe(400);
  });
});

// ─── Circuit Breakers ─────────────────────────────────────────────────────────
describe('GET /api/v1/ops/circuit-breakers', () => {
  it('returns 5 seeded circuit breakers', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/circuit-breakers');
    expect(status).toBe(200);
    expect(body.total).toBe(5);
    expect(body.circuits.every((c: any) => c.state !== undefined)).toBe(true);
  });
});

describe('POST /api/v1/ops/circuit-breakers/:name/reset', () => {
  it('resets a known circuit breaker', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/circuit-breakers/database/reset'
    );
    expect(status).toBe(200);
    expect(body.state).toBe('CLOSED');
    expect(body.name).toBe('database');
  });

  it('returns 404 for unknown circuit', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/circuit-breakers/no-such-svc/reset'
    );
    expect(status).toBe(404);
  });
});
