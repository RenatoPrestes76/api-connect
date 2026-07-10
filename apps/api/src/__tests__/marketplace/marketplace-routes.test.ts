import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { TestServer } from './helpers.js';
import { startServer, stopServer, get, post } from './helpers.js';

let ts: TestServer;
beforeAll(async () => {
  ts = await startServer();
});
afterAll(async () => {
  await stopServer(ts.server);
});

// ─── Catalog ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/marketplace/connectors', () => {
  it('returns paginated catalog with 30 connectors total', async () => {
    const { status, body } = await get<{ total: number; items: unknown[] }>(
      ts.baseUrl,
      '/api/v1/marketplace/connectors'
    );
    expect(status).toBe(200);
    expect(body.total).toBe(30);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it('filters by category', async () => {
    const { status, body } = await get<{
      total: number;
      items: Array<{ manifest: { category: string } }>;
    }>(ts.baseUrl, '/api/v1/marketplace/connectors?category=ERP');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(4);
    expect(body.items.every((c) => c.manifest.category === 'ERP')).toBe(true);
  });

  it('filters by q (search query)', async () => {
    const { status, body } = await get<{ items: Array<{ manifest: { id: string } }> }>(
      ts.baseUrl,
      '/api/v1/marketplace/connectors?q=shopify'
    );
    expect(status).toBe(200);
    expect(body.items.some((c) => c.manifest.id === 'shopify')).toBe(true);
  });

  it('filters featured connectors', async () => {
    const { status, body } = await get<{ items: Array<{ featured: boolean }> }>(
      ts.baseUrl,
      '/api/v1/marketplace/connectors?featured=true'
    );
    expect(status).toBe(200);
    expect(body.items.every((c) => c.featured)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it('respects limit param', async () => {
    const { status, body } = await get<{ items: unknown[] }>(
      ts.baseUrl,
      '/api/v1/marketplace/connectors?limit=5'
    );
    expect(status).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(5);
  });
});

describe('GET /api/v1/marketplace/connectors/:id', () => {
  it('returns connector details', async () => {
    const { status, body } = await get<{ manifest: { id: string }; verified: boolean }>(
      ts.baseUrl,
      '/api/v1/marketplace/connectors/seltriva-erp'
    );
    expect(status).toBe(200);
    expect(body.manifest.id).toBe('seltriva-erp');
    expect(body.verified).toBe(true);
  });

  it('annotates installed connectors with installationId', async () => {
    const { status, body } = await get<{
      manifest: { id: string };
      installationId?: string;
      status: string;
    }>(ts.baseUrl, '/api/v1/marketplace/connectors/seltriva-erp');
    expect(status).toBe(200);
    expect(body.status).toBe('installed');
    expect(body.installationId).toBeDefined();
  });

  it('returns 404 for unknown connector', async () => {
    const { status } = await get(ts.baseUrl, '/api/v1/marketplace/connectors/nonexistent-xyz');
    expect(status).toBe(404);
  });
});

describe('GET /api/v1/marketplace/connectors/:id/verify', () => {
  it('verifies a valid connector', async () => {
    const { status, body } = await get<{ valid: boolean; message: string }>(
      ts.baseUrl,
      '/api/v1/marketplace/connectors/seltriva-erp/verify'
    );
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.message).toContain('verified');
  });
});

describe('GET /api/v1/marketplace/categories', () => {
  it('returns all 10 categories with counts', async () => {
    const { status, body } = await get<{ categories: string[]; counts: Record<string, number> }>(
      ts.baseUrl,
      '/api/v1/marketplace/categories'
    );
    expect(status).toBe(200);
    expect(body.categories).toHaveLength(10);
    expect(Object.keys(body.counts).length).toBe(10);
    expect(body.counts['ERP']).toBeGreaterThanOrEqual(4);
  });
});

describe('GET /api/v1/marketplace/search', () => {
  it('returns search results', async () => {
    const { status, body } = await get<{ results: Array<{ manifest: { id: string } }> }>(
      ts.baseUrl,
      '/api/v1/marketplace/search?q=postgres'
    );
    expect(status).toBe(200);
    expect(body.results.some((r) => r.manifest.id === 'postgresql')).toBe(true);
  });

  it('returns empty for no query', async () => {
    const { status, body } = await get<{ results: unknown[] }>(
      ts.baseUrl,
      '/api/v1/marketplace/search'
    );
    expect(status).toBe(200);
    expect(body.results).toHaveLength(0);
  });
});

// ─── Installations ────────────────────────────────────────────────────────────

describe('GET /api/v1/marketplace/installed', () => {
  it('returns seeded installations (3)', async () => {
    const { status, body } = await get<{ total: number; items: Array<{ connectorId: string }> }>(
      ts.baseUrl,
      '/api/v1/marketplace/installed'
    );
    expect(status).toBe(200);
    expect(body.total).toBe(3);
    const ids = body.items.map((i) => i.connectorId);
    expect(ids).toContain('seltriva-erp');
    expect(ids).toContain('postgresql');
    expect(ids).toContain('mercado-livre');
  });
});

describe('GET /api/v1/marketplace/updates', () => {
  it('returns connectors needing updates', async () => {
    const { status, body } = await get<{
      total: number;
      items: Array<{ installation: { connectorId: string }; latestVersion: string }>;
    }>(ts.baseUrl, '/api/v1/marketplace/updates');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.some((u) => u.installation.connectorId === 'mercado-livre')).toBe(true);
    for (const u of body.items) {
      expect(u.latestVersion).toBeTruthy();
    }
  });
});

describe('POST /api/v1/marketplace/install', () => {
  it('installs a new connector', async () => {
    const { status, body } = await post<{ id: string; connectorId: string; enabled: boolean }>(
      ts.baseUrl,
      '/api/v1/marketplace/install',
      { connectorId: 'shopify' }
    );
    expect(status).toBe(201);
    expect(body.connectorId).toBe('shopify');
    expect(body.enabled).toBe(true);
    expect(body.id).toBeTruthy();
  });

  it('returns 409 if already installed', async () => {
    const { status } = await post(ts.baseUrl, '/api/v1/marketplace/install', {
      connectorId: 'seltriva-erp',
    });
    expect(status).toBe(409);
  });

  it('returns 400 if connectorId is missing', async () => {
    const { status } = await post(ts.baseUrl, '/api/v1/marketplace/install', {});
    expect(status).toBe(400);
  });

  it('returns 404 for unknown connector', async () => {
    const { status } = await post(ts.baseUrl, '/api/v1/marketplace/install', {
      connectorId: 'no-such-connector',
    });
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/marketplace/enable + disable', () => {
  it('enables and then disables a connector', async () => {
    // Get seltriva-erp installation id
    const { body: installed } = await get<{
      items: Array<{ id: string; connectorId: string; enabled: boolean }>;
    }>(ts.baseUrl, '/api/v1/marketplace/installed');
    const erp = installed.items.find((i) => i.connectorId === 'seltriva-erp')!;
    expect(erp).toBeDefined();

    const { status: dsStatus, body: disabled } = await post<{ enabled: boolean }>(
      ts.baseUrl,
      '/api/v1/marketplace/disable',
      { installationId: erp.id }
    );
    expect(dsStatus).toBe(200);
    expect(disabled.enabled).toBe(false);

    const { status: enStatus, body: enabled } = await post<{ enabled: boolean }>(
      ts.baseUrl,
      '/api/v1/marketplace/enable',
      { installationId: erp.id }
    );
    expect(enStatus).toBe(200);
    expect(enabled.enabled).toBe(true);
  });
});

describe('POST /api/v1/marketplace/update', () => {
  it('updates mercado-livre to latest', async () => {
    const { body: installed } = await get<{
      items: Array<{ id: string; connectorId: string; version: string }>;
    }>(ts.baseUrl, '/api/v1/marketplace/installed');
    const ml = installed.items.find((i) => i.connectorId === 'mercado-livre')!;

    const { status, body } = await post<{ version: string; connectorId: string }>(
      ts.baseUrl,
      '/api/v1/marketplace/update',
      { installationId: ml.id }
    );
    expect(status).toBe(200);
    expect(body.connectorId).toBe('mercado-livre');
  });
});

describe('POST /api/v1/marketplace/uninstall', () => {
  it('uninstalls a previously installed connector', async () => {
    // First install rabbitmq
    const { body: inst } = await post<{ id: string; connectorId: string }>(
      ts.baseUrl,
      '/api/v1/marketplace/install',
      { connectorId: 'rabbitmq' }
    );
    expect(inst.connectorId).toBe('rabbitmq');

    const { status, body } = await post<{ connectorId: string }>(
      ts.baseUrl,
      '/api/v1/marketplace/uninstall',
      { installationId: inst.id }
    );
    expect(status).toBe(200);
    expect(body.connectorId).toBe('rabbitmq');
  });

  it('returns 404 for unknown installationId', async () => {
    const { status } = await post(ts.baseUrl, '/api/v1/marketplace/uninstall', {
      installationId: 'no-such-id',
    });
    expect(status).toBe(404);
  });
});

// ─── Developer ────────────────────────────────────────────────────────────────

describe('POST /api/v1/marketplace/publish', () => {
  it('submits a new connector for review', async () => {
    const { status, body } = await post<{
      status: string;
      connectorId: string;
      submittedAt: string;
    }>(ts.baseUrl, '/api/v1/marketplace/publish', {
      connectorId: 'my-custom-connector',
      name: 'My Custom',
      version: '1.0.0',
      author: 'Dev',
    });
    expect(status).toBe(202);
    expect(body.status).toBe('pending-review');
    expect(body.connectorId).toBe('my-custom-connector');
    expect(body.submittedAt).toBeTruthy();
  });

  it('submits an update for an existing connector', async () => {
    const { status, body } = await post<{ status: string }>(
      ts.baseUrl,
      '/api/v1/marketplace/publish',
      {
        connectorId: 'seltriva-erp',
        name: 'Seltriva ERP',
        version: '99.0.0',
      }
    );
    expect(status).toBe(202);
    expect(body.status).toBe('update-submitted');
  });

  it('returns 400 if required fields are missing', async () => {
    const { status } = await post(ts.baseUrl, '/api/v1/marketplace/publish', { name: 'No ID' });
    expect(status).toBe(400);
  });
});

// ─── Audit ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/marketplace/audit', () => {
  it('returns audit logs (10+ seeded)', async () => {
    const { status, body } = await get<{
      total: number;
      items: Array<{ action: string; connectorId: string }>;
    }>(ts.baseUrl, '/api/v1/marketplace/audit');
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(10);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('filters by connectorId', async () => {
    const { status, body } = await get<{ items: Array<{ connectorId: string }> }>(
      ts.baseUrl,
      '/api/v1/marketplace/audit?connectorId=seltriva-erp'
    );
    expect(status).toBe(200);
    expect(body.items.every((l) => l.connectorId === 'seltriva-erp')).toBe(true);
  });

  it('filters by action', async () => {
    const { status, body } = await get<{ items: Array<{ action: string }> }>(
      ts.baseUrl,
      '/api/v1/marketplace/audit?action=install'
    );
    expect(status).toBe(200);
    expect(body.items.every((l) => l.action === 'install')).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it('respects limit param', async () => {
    const { status, body } = await get<{ items: unknown[] }>(
      ts.baseUrl,
      '/api/v1/marketplace/audit?limit=3'
    );
    expect(status).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(3);
  });
});
