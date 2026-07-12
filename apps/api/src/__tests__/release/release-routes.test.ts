import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post, put, type TestServer } from './helpers.js';

let srv: TestServer;
beforeAll(async () => {
  srv = await startTestServer();
});
afterAll(async () => {
  await srv.close();
});

// ─── Checklist ────────────────────────────────────────────────────────────────
describe('GET /api/v1/release/checklist', () => {
  it('returns checklist result with summary', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/checklist');
    expect(status).toBe(200);
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('passed');
    expect(body).toHaveProperty('failed');
    expect(body).toHaveProperty('readyForRelease');
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('most items are passed (seeded as GA-ready)', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/release/checklist');
    expect(body.passed).toBeGreaterThan(body.pending);
  });
});

describe('GET /api/v1/release/checklist/:id', () => {
  it('returns a specific checklist item', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/checklist/prod-001');
    expect(status).toBe(200);
    expect(body.id).toBe('prod-001');
    expect(body.status).toBe('passed');
  });

  it('returns 404 for unknown item', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/release/checklist/no-such');
    expect(status).toBe(404);
  });
});

describe('PUT /api/v1/release/checklist/:id', () => {
  it('marks an item as passed', async () => {
    const { status, body } = await put<any>(srv.baseUrl, '/api/v1/release/checklist/prod-009', {
      status: 'passed',
      checkedBy: 'qa-team',
      notes: 'Customer portal validated in staging',
    });
    expect(status).toBe(200);
    expect(body.status).toBe('passed');
    expect(body.checkedBy).toBe('qa-team');
  });

  it('returns 400 for invalid status', async () => {
    const { status, body } = await put<any>(srv.baseUrl, '/api/v1/release/checklist/prod-001', {
      status: 'approved',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_STATUS');
  });

  it('returns 404 for unknown checklist item', async () => {
    const { status } = await put<any>(srv.baseUrl, '/api/v1/release/checklist/no-such', {
      status: 'passed',
    });
    expect(status).toBe(404);
  });
});

// ─── Versions ─────────────────────────────────────────────────────────────────
describe('GET /api/v1/release/versions', () => {
  it('returns all versions with current', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/versions');
    expect(status).toBe(200);
    expect(body.total).toBe(5);
    expect(body.current.stage).toBe('ga');
    expect(Array.isArray(body.versions)).toBe(true);
  });
});

describe('GET /api/v1/release/versions/current', () => {
  it('returns the GA version', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/versions/current');
    expect(status).toBe(200);
    expect(body.version).toBe('1.0.0');
    expect(body.stage).toBe('ga');
  });
});

describe('GET /api/v1/release/versions/:version', () => {
  it('returns a specific version', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/versions/1.0.0-rc1');
    expect(status).toBe(200);
    expect(body.stage).toBe('rc1');
  });

  it('returns 404 for unknown version', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/release/versions/99.0.0');
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/release/versions/:version/certify', () => {
  it('certifies a version', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/release/versions/1.0.0-rc2/certify',
      { certifiedBy: 'release-manager' }
    );
    expect(status).toBe(200);
    expect(body.certifiedBy).toBe('release-manager');
    expect(body.certifiedAt).not.toBeNull();
  });

  it('returns 400 when certifiedBy missing', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/release/versions/1.0.0/certify',
      {}
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_FIELD');
  });
});

// ─── Changelog ────────────────────────────────────────────────────────────────
describe('GET /api/v1/release/changelog', () => {
  it('returns all changelog versions', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/changelog');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(10);
    expect(Array.isArray(body.versions)).toBe(true);
  });

  it('supports search via ?q=', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/release/changelog?q=TITAN');
    expect(body.total).toBe(1);
    expect(body.versions[0].codename).toBe('TITAN');
  });
});

describe('GET /api/v1/release/changelog/latest', () => {
  it('returns the v1.0.0 GA entry', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/changelog/latest');
    expect(status).toBe(200);
    expect(body.version).toBe('1.0.0');
    expect(body.codename).toBe('ODYSSEY');
  });
});

describe('GET /api/v1/release/changelog/:version', () => {
  it('returns changelog for a specific version', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/changelog/1.0.0');
    expect(status).toBe(200);
    expect(body.sprint).toBe(37);
    expect(body.entries.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown version', async () => {
    const { status } = await get<any>(srv.baseUrl, '/api/v1/release/changelog/9.9.9');
    expect(status).toBe(404);
  });
});

// ─── SBOM ─────────────────────────────────────────────────────────────────────
describe('GET /api/v1/release/sbom', () => {
  it('returns full SBOM', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/sbom');
    expect(status).toBe(200);
    expect(body.format).toBe('spdx-json');
    expect(body.totalComponents).toBeGreaterThan(30);
    expect(Array.isArray(body.components)).toBe(true);
  });

  it('has zero vulnerabilities', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/release/sbom');
    expect(body.totalVulnerabilities).toBe(0);
  });
});

describe('GET /api/v1/release/sbom/components', () => {
  it('filters by type=runtime', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/release/sbom/components?type=runtime');
    expect(body.components.every((c: any) => c.type === 'runtime')).toBe(true);
  });
});

describe('GET /api/v1/release/sbom/vulnerabilities', () => {
  it('returns zero vulnerabilities', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/sbom/vulnerabilities');
    expect(status).toBe(200);
    expect(body.totalVulnerabilities).toBe(0);
    expect(body.vulnerableComponents).toHaveLength(0);
  });
});

// ─── Go-Live Metrics ──────────────────────────────────────────────────────────
describe('GET /api/v1/release/metrics', () => {
  it('returns go-live metrics snapshot', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/release/metrics');
    expect(status).toBe(200);
    expect(body.mrr).toBeGreaterThan(0);
    expect(body.arr).toBe(body.mrr * 12);
    expect(typeof body.allCriticalMet).toBe('boolean');
    expect(Array.isArray(body.metrics)).toBe(true);
  });

  it('all critical SLA metrics are met', async () => {
    const { body } = await get<any>(srv.baseUrl, '/api/v1/release/metrics');
    expect(body.allCriticalMet).toBe(true);
  });
});

describe('POST /api/v1/release/metrics', () => {
  it('updates go-live metrics', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/release/metrics', {
      tenants: 25,
      mrr: 8500,
    });
    expect(status).toBe(200);
    expect(body.tenants).toBe(25);
    expect(body.mrr).toBe(8500);
    expect(body.arr).toBe(102_000);
  });
});
