import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  put,
  del,
  adminBearer,
  readOnlyOpsBearer,
  noOpsPermissionBearer,
  genericAuthBearer,
  portalUserBearer,
  runtimeBearer,
  type TestServer,
} from './helpers.js';

let srv: TestServer;
let admin: Record<string, string>;
let readOnly: Record<string, string>;
let noPerm: Record<string, string>;

beforeAll(async () => {
  srv = await startTestServer();
  admin = await adminBearer();
  readOnly = await readOnlyOpsBearer();
  noPerm = await noOpsPermissionBearer();
});
afterAll(async () => {
  await srv.close();
});

/**
 * ATLAS 46.27 — full authorization matrix, exercised against a
 * representative sample of ops/* routes covering every sub-module (health,
 * dashboard, queues, feature-flags, slo, dr, circuit-breakers) and both
 * permission tiers (ops.read vs ops.manage). See routes/v1/ops/*.ts for the
 * per-route rationale of which tier each belongs to.
 */
describe('Ops — authorization matrix (ATLAS 46.27)', () => {
  const READ_ROUTES = [
    '/api/v1/ops/health',
    '/api/v1/ops/dashboard',
    '/api/v1/ops/queues',
    '/api/v1/ops/feature-flags',
    '/api/v1/ops/slo',
    '/api/v1/ops/dr',
    '/api/v1/ops/circuit-breakers',
  ];

  for (const path of READ_ROUTES) {
    it(`GET ${path} — 401 with no session at all`, async () => {
      const { status } = await get<any>(srv.baseUrl, path);
      expect(status).toBe(401);
    });

    it(`GET ${path} — 401 for a real generic (Supabase-style) session (ops/* no longer accepts this scheme at all)`, async () => {
      const { status } = await get<any>(srv.baseUrl, path, genericAuthBearer());
      expect(status).toBe(401);
    });

    it(`GET ${path} — 401 for a real portal-identity session (different signing secret)`, async () => {
      const { status } = await get<any>(srv.baseUrl, path, await portalUserBearer());
      expect(status).toBe(401);
    });

    it(`GET ${path} — 401 for a real Runtime access token (different signing secret)`, async () => {
      const { status } = await get<any>(srv.baseUrl, path, await runtimeBearer());
      expect(status).toBe(401);
    });

    it(`GET ${path} — 403 for an authenticated admin session WITHOUT ops.read`, async () => {
      const { status } = await get<any>(srv.baseUrl, path, noPerm);
      expect(status).toBe(403);
    });

    it(`GET ${path} — succeeds for a session holding only ops.read`, async () => {
      const { status } = await get<any>(srv.baseUrl, path, readOnly);
      // /health may legitimately report 207 (degraded) in this bare test server.
      expect([200, 207]).toContain(status);
    });

    it(`GET ${path} — succeeds for a session holding ops.manage (superset of ops.read)`, async () => {
      const { status } = await get<any>(srv.baseUrl, path, admin);
      expect([200, 207]).toContain(status);
    });
  }

  const MANAGE_PROBES: Array<[string, string, unknown]> = [
    [
      'POST',
      '/api/v1/ops/queues/enqueue',
      { type: 'authz_matrix_probe', tenantId: 'tenant-authz-matrix' },
    ],
    ['POST', '/api/v1/ops/dr/backup/trigger', { type: 'incremental' }],
    ['POST', '/api/v1/ops/circuit-breakers/database/reset', undefined],
  ];

  for (const [method, path, payload] of MANAGE_PROBES) {
    const call = (headers?: Record<string, string>) =>
      method === 'POST'
        ? post<any>(srv.baseUrl, path, payload, headers)
        : get<any>(srv.baseUrl, path, headers);

    it(`${method} ${path} — 401 with no session`, async () => {
      const { status } = await call();
      expect(status).toBe(401);
    });

    it(`${method} ${path} — 403 for a session holding ops.read but not ops.manage`, async () => {
      const { status } = await call(readOnly);
      expect(status).toBe(403);
    });

    it(`${method} ${path} — 403 for a session holding neither ops permission`, async () => {
      const { status } = await call(noPerm);
      expect(status).toBe(403);
    });

    it(`${method} ${path} — succeeds for a session holding ops.manage`, async () => {
      const { status } = await call(admin);
      expect([200, 201, 202]).toContain(status);
    });
  }

  it('a 403 for missing permission never leaks which permission was required beyond the declared code/message shape', async () => {
    const { status, body } = await get<{ error: { code: string; message: string } }>(
      srv.baseUrl,
      '/api/v1/ops/dashboard',
      noPerm
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).not.toMatch(/stack|Prisma|ENOENT|node_modules/i);
  });
});

// ATLAS 46.26 — Part H audit: unlike billing/security, this module (and its
// six siblings — health, dashboard, feature-flags, slo, dr, circuit-breakers)
// is deliberately left admin-global rather than tenant-scoped; see the doc
// comment atop routes/v1/ops/queues.ts for the full reasoning. These two
// tests document that decision as an explicit, intentional contract rather
// than an untested gap — this module has no tenant identity concept to test
// isolation against; any caller holding ops.manage sees/controls the whole
// platform queue by design. ATLAS 46.27 updated these to use a real
// ops.manage session — the underlying claim (tenantId is attribution, not
// an authorization boundary) is unchanged, but *reaching* the route now
// requires the explicit permission this sprint added.
describe('Ops queues — deliberately admin-global (documented ATLAS 46.26 Part H decision)', () => {
  it('GET /queues returns jobs across all tenants unfiltered by caller identity', async () => {
    const a = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { type: 'cross_tenant_visibility_probe', tenantId: 'tenant-a-ops-probe' },
      admin
    );
    const b = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { type: 'cross_tenant_visibility_probe', tenantId: 'tenant-b-ops-probe' },
      admin
    );
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/queues', admin);
    const ids = body.jobs.map((j: any) => j.id);
    expect(ids).toContain(a.body.job.id);
    expect(ids).toContain(b.body.job.id);
  });

  it('enqueue\'s tenantId is attribution metadata only (who this job is "for"), not an access-control boundary — any caller holding ops.manage may set it to any value', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { type: 'attribution_probe', tenantId: 'tenant-arbitrary-attribution' },
      admin
    );
    expect(status).toBe(201);
    expect(body.job.tenantId).toBe('tenant-arbitrary-attribution');
  });

  it('a body-supplied tenantId does not grant read access on its own — ops.manage does', async () => {
    // Even naming a specific tenantId in the body, a caller with neither
    // ops permission still cannot enqueue anything.
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { type: 'should_be_rejected', tenantId: 'tenant-arbitrary-attribution' },
      noPerm
    );
    expect(status).toBe(403);
  });
});

// ─── Health ──────────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/health', () => {
  it('returns a health report with status field', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/health', admin);
    expect([200, 207, 503]).toContain(status);
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('checks');
    expect(Array.isArray(body.checks)).toBe(true);
  });

  it('report includes version and uptime', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/health', admin);
    expect(body).toHaveProperty('version');
    expect(typeof body.uptime).toBe('number');
  });
});

describe('GET /api/v1/ops/ready', () => {
  it('returns ready status', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/ready', admin);
    expect(body).toHaveProperty('ready');
    expect(Array.isArray(body.openCircuits)).toBe(true);
  });

  it('rejects a session without ops.read', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/ops/ready', noPerm);
    expect(status).toBe(403);
  });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/dashboard', () => {
  it('returns KPIs, SLOs, circuits, queues', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/dashboard', admin);
    expect(status).toBe(200);
    expect(body).toHaveProperty('kpis');
    expect(body).toHaveProperty('slos');
    expect(body).toHaveProperty('circuitBreakers');
    expect(body).toHaveProperty('queues');
  });

  it('kpis.featureFlags.total is 5 (seeded)', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/dashboard', admin);
    expect(body.kpis.featureFlags.total).toBe(5);
  });
});

// ─── Queues ──────────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/queues', () => {
  it('returns stats and job lists', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/queues', admin);
    expect(status).toBe(200);
    expect(body).toHaveProperty('stats');
    expect(body).toHaveProperty('jobs');
    expect(body).toHaveProperty('dlq');
    expect(body.stats.dlq).toBe(2);
  });

  it('filters by priority=high', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/queues?priority=high', admin);
    for (const job of body.jobs) {
      expect(job.priority).toBe('high');
    }
  });
});

describe('POST /api/v1/ops/queues/enqueue', () => {
  it('enqueues a new job', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { type: 'test_job', priority: 'low', payload: { x: 1 }, tenantId: 'tenant-enterprise' },
      admin
    );
    expect(status).toBe(201);
    expect(body.job.type).toBe('test_job');
    expect(body.job.priority).toBe('low');
  });

  it('returns 400 when type is missing', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { priority: 'normal', tenantId: 'tenant-enterprise' },
      admin
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_TYPE');
  });

  it('returns 409 on duplicate idempotency key', async () => {
    const key = `idem-${Date.now()}`;
    await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { type: 'my_job', idempotencyKey: key, tenantId: 'tenant-enterprise' },
      admin
    );
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { type: 'my_job', idempotencyKey: key, tenantId: 'tenant-enterprise' },
      admin
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('DUPLICATE_JOB');
  });

  it('returns 400 TENANT_REQUIRED when no tenant is provided', async () => {
    const { status, body } = await post<{ error: { code: string } }>(
      srv.baseUrl,
      '/api/v1/ops/queues/enqueue',
      { type: 'test_job' },
      admin
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('TENANT_REQUIRED');
  });
});

describe('POST /api/v1/ops/queues/dlq/retry', () => {
  it('retries a DLQ job', async () => {
    const { body: q } = await get<any>(srv.baseUrl, '/api/v1/ops/queues', admin);
    const dlqJob = q.dlq[0];
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/dlq/retry',
      { jobId: dlqJob.id },
      admin
    );
    expect(status).toBe(200);
    expect(body.job.status).toBe('pending');
  });

  it('returns 404 for unknown job', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/queues/dlq/retry',
      { jobId: 'nonexistent' },
      admin
    );
    expect(status).toBe(404);
  });

  it('returns 400 when jobId missing', async () => {
    const { status } = await post<any>(srv.baseUrl, '/api/v1/ops/queues/dlq/retry', {}, admin);
    expect(status).toBe(400);
  });
});

// ─── Feature Flags ────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/feature-flags', () => {
  it('returns seeded flags list', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/feature-flags', admin);
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(body.flags)).toBe(true);
  });
});

describe('GET /api/v1/ops/feature-flags/:id', () => {
  it('returns a flag by id', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/ops/feature-flags/ff-001', admin);
    expect(body.key).toBe('multi-tenant-ai');
  });

  it('returns 404 for unknown flag', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/ops/feature-flags/no-such-flag', admin);
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/ops/feature-flags', () => {
  it('creates a new flag', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags',
      { name: 'New Test Flag', key: 'new-test-flag', enabled: true, rolloutPercentage: 25 },
      admin
    );
    expect(status).toBe(201);
    expect(body.key).toBe('new-test-flag');
    expect(body.id).toBeTruthy();
  });

  it('returns 400 when key/name missing', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags',
      { description: 'no name or key' },
      admin
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELDS');
  });

  it('rejects a session holding only ops.read (creation is ops.manage)', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags',
      { name: 'Should Not Be Created', key: 'should-not-be-created' },
      readOnly
    );
    expect(status).toBe(403);
  });
});

describe('PUT /api/v1/ops/feature-flags/:id', () => {
  it('updates a flag', async () => {
    const { body } = await put<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags/ff-004',
      { enabled: false },
      admin
    );
    expect(body.enabled).toBe(false);
  });

  it('returns 404 for unknown flag', async () => {
    const { status } = await put<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags/nope',
      { enabled: false },
      admin
    );
    expect(status).toBe(404);
  });

  it('rejects a session holding only ops.read', async () => {
    const { status } = await put<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags/ff-004',
      { enabled: true },
      readOnly
    );
    expect(status).toBe(403);
  });
});

describe('POST /api/v1/ops/feature-flags/:id/evaluate', () => {
  it('evaluates multi-tenant-ai flag as enabled at 100%', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags/ff-001/evaluate',
      { context: { tenantId: 'tenant-x' } },
      admin
    );
    expect(status).toBe(200);
    expect(body.enabled).toBe(true);
  });

  it('evaluates disabled flag as enabled=false', async () => {
    const { body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags/ff-005/evaluate',
      { context: { tenantId: 'tenant-x' } },
      admin
    );
    expect(body.enabled).toBe(false);
    expect(body.reason).toBe('disabled');
  });

  it('evaluates targeting rule for beta-workflow-builder (enterprise plan)', async () => {
    const { body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags/ff-003/evaluate',
      { context: { tenantId: 'tenant-enterprise', plan: 'enterprise' } },
      admin
    );
    expect(body.enabled).toBe(true);
    expect(body.reason).toBe('targeting_match');
  });

  it('returns 404 for unknown flag evaluation', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags/no-such/evaluate',
      { context: {} },
      admin
    );
    expect(status).toBe(404);
  });

  it('a session holding only ops.read can evaluate (read-only computation, no mutation)', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags/ff-001/evaluate',
      { context: { tenantId: 'tenant-x' } },
      readOnly
    );
    expect(status).toBe(200);
  });
});

describe('DELETE /api/v1/ops/feature-flags/:id', () => {
  it('deletes a newly created flag', async () => {
    const { body: created } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags',
      { name: 'Temp Flag', key: `temp-${Date.now()}` },
      admin
    );
    const { status, body } = await del<any>(
      srv.baseUrl,
      `/api/v1/ops/feature-flags/${created.id}`,
      undefined,
      admin
    );
    expect(status).toBe(200);
    expect(body.deleted).toBe(true);
  });

  it('rejects a session holding only ops.read', async () => {
    const { body: created } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/feature-flags',
      { name: 'Delete Target', key: `delete-target-${Date.now()}` },
      admin
    );
    const { status } = await del<any>(
      srv.baseUrl,
      `/api/v1/ops/feature-flags/${created.id}`,
      undefined,
      readOnly
    );
    expect(status).toBe(403);
  });
});

// ─── SLO ─────────────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/slo', () => {
  it('returns SLO list with summary', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/slo', admin);
    expect(status).toBe(200);
    expect(Array.isArray(body.slos)).toBe(true);
    expect(body.slos.length).toBeGreaterThanOrEqual(5);
    expect(body.summary).toHaveProperty('total');
    expect(body.summary).toHaveProperty('compliant');
  });
});

describe('GET /api/v1/ops/slo/:id', () => {
  it('returns specific SLO', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/slo/slo-001', admin);
    expect(status).toBe(200);
    expect(body.name).toBe('API Availability');
  });

  it('returns 404 for unknown SLO', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/ops/slo/slo-999', admin);
    expect(status).toBe(404);
  });
});

// ─── DR ──────────────────────────────────────────────────────────────────────
describe('GET /api/v1/ops/dr', () => {
  it('returns DR config, backups, and tests', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/dr', admin);
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
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/dr/backups', admin);
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });
});

describe('POST /api/v1/ops/dr/backup/trigger', () => {
  it('triggers an incremental backup', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/dr/backup/trigger',
      { type: 'incremental' },
      admin
    );
    expect(status).toBe(202);
    expect(body.backup.type).toBe('incremental');
    expect(body.backup.status).toBe('running');
  });

  it('returns 400 for invalid backup type', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/dr/backup/trigger',
      { type: 'invalid' },
      admin
    );
    expect(status).toBe(400);
  });

  it('rejects a session holding only ops.read', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/dr/backup/trigger',
      { type: 'incremental' },
      readOnly
    );
    expect(status).toBe(403);
  });
});

describe('POST /api/v1/ops/dr/test', () => {
  it('records a DR test', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/dr/test',
      {
        type: 'restore',
        status: 'passed',
        rtoActual: 9,
        rpoActual: 2,
        notes: 'Automated restore test passed in dev environment',
      },
      admin
    );
    expect(status).toBe(201);
    expect(body.test.type).toBe('restore');
    expect(body.test.id).toBeTruthy();
  });

  it('returns 400 for invalid test type', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/dr/test',
      { type: 'mystery' },
      admin
    );
    expect(status).toBe(400);
  });
});

// ─── Circuit Breakers ─────────────────────────────────────────────────────────
describe('GET /api/v1/ops/circuit-breakers', () => {
  it('returns 5 seeded circuit breakers', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/ops/circuit-breakers', admin);
    expect(status).toBe(200);
    expect(body.total).toBe(5);
    expect(body.circuits.every((c: any) => c.state !== undefined)).toBe(true);
  });
});

describe('POST /api/v1/ops/circuit-breakers/:name/reset', () => {
  it('resets a known circuit breaker', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/circuit-breakers/database/reset',
      undefined,
      admin
    );
    expect(status).toBe(200);
    expect(body.state).toBe('CLOSED');
    expect(body.name).toBe('database');
  });

  it('returns 404 for unknown circuit', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/circuit-breakers/no-such-svc/reset',
      undefined,
      admin
    );
    expect(status).toBe(404);
  });

  it('rejects a session holding only ops.read (resetting a circuit is a privileged action)', async () => {
    const { status } = await post<any>(
      srv.baseUrl,
      '/api/v1/ops/circuit-breakers/database/reset',
      undefined,
      readOnly
    );
    expect(status).toBe(403);
  });
});
