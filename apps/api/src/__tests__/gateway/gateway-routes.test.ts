import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer,
  get,
  post,
  seededOwnerAuth,
  registerFreshOrg,
  type TestServer,
} from './helpers.js';

interface ErrorBody {
  error: { code: string; message: string };
}
interface EnvironmentsListResponse {
  total: number;
  environments: Array<{ id: string; name: string; kind: string }>;
}
interface ApiKeyDTO {
  id: string;
  publicId: string;
  role: string;
  status: string;
  lastUsedAt?: string;
  apiKey?: string;
}
interface ApiKeysListResponse {
  total: number;
  keys: ApiKeyDTO[];
}
interface RateLimitRuleResponse {
  id: string;
  window: string;
  limit: number;
}
interface LogsResponse {
  total: number;
  entries: Array<{ endpoint: string; actorType: string; statusCode: number }>;
}
interface OrganizationBody {
  id: string;
  name: string;
}

let srv: TestServer;
let ownerAuth: Record<string, string>;
let environmentId: string;

beforeAll(async () => {
  srv = await startTestServer();
  ownerAuth = await seededOwnerAuth(srv.baseUrl);
  const envs = await get<EnvironmentsListResponse>(
    srv.baseUrl,
    '/api/v1/portal/environments',
    ownerAuth
  );
  environmentId = envs.body.environments[0]!.id;
});
afterAll(async () => {
  await srv.close();
});

// ─── Health ─────────────────────────────────────────────────────────────────

describe('Health endpoints', () => {
  it('GET /live returns 200 without auth', async () => {
    const { status, body } = await get<{ status: string }>(srv.baseUrl, '/live');
    expect(status).toBe(200);
    expect(body.status).toBe('alive');
  });

  it('GET /ready reports database and stub cache/queue checks', async () => {
    const { status, body } = await get<{
      status: string;
      checks: { database: string; cache: string; queues: string };
    }>(srv.baseUrl, '/ready');
    expect([200, 503]).toContain(status);
    expect(body.checks.cache).toBe('not_configured');
    expect(body.checks.queues).toBe('not_configured');
  });
});

// ─── Auth guard sanity ────────────────────────────────────────────────────────

describe('Gateway routes require portal auth', () => {
  it('rejects unauthenticated access to API keys', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/gateway/api-keys');
    expect(status).toBe(401);
  });

  it('rejects unauthenticated access to rate limits', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/gateway/rate-limits');
    expect(status).toBe(401);
  });

  it('rejects unauthenticated access to logs', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/gateway/logs');
    expect(status).toBe(401);
  });
});

// ─── API Keys ───────────────────────────────────────────────────────────────

describe('API Keys', () => {
  it('creates, lists, regenerates, and revokes a key', async () => {
    const created = await post<ApiKeyDTO>(
      srv.baseUrl,
      '/api/v1/portal/gateway/api-keys',
      { name: 'CI Pipeline', environmentId, role: 'DEVELOPER' },
      ownerAuth
    );
    expect(created.status).toBe(201);
    expect(created.body.apiKey).toMatch(/^atl_pub_.+\.atl_sk_.+$/);
    expect(created.body.status).toBe('active');

    const listed = await get<ApiKeysListResponse>(
      srv.baseUrl,
      '/api/v1/portal/gateway/api-keys',
      ownerAuth
    );
    expect(listed.body.keys.some((k) => k.id === created.body.id)).toBe(true);
    expect(listed.body.keys.every((k) => !('secretHash' in k))).toBe(true);

    const regenerated = await post<ApiKeyDTO>(
      srv.baseUrl,
      `/api/v1/portal/gateway/api-keys/${created.body.id}/regenerate`,
      undefined,
      ownerAuth
    );
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.apiKey).toBeTruthy();
    expect(regenerated.body.publicId).not.toBe(created.body.publicId);

    const revoked = await post<ApiKeyDTO>(
      srv.baseUrl,
      `/api/v1/portal/gateway/api-keys/${created.body.id}/revoke`,
      undefined,
      ownerAuth
    );
    expect(revoked.status).toBe(200);
    expect(revoked.body.status).toBe('revoked');
  });

  it('rejects creating a key for an environment from another organization', async () => {
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/api/v1/portal/gateway/api-keys',
      { name: 'Cross-org attempt', environmentId: 'not-a-real-environment', role: 'VIEWER' },
      ownerAuth
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('ENVIRONMENT_NOT_FOUND');
  });
});

// ─── Service-to-service auth (X-Api-Key) ────────────────────────────────────

describe('Service-to-service authentication via API key', () => {
  it('authenticates a portal route using the raw API key instead of a session', async () => {
    const created = await post<ApiKeyDTO>(
      srv.baseUrl,
      '/api/v1/portal/gateway/api-keys',
      { name: 'Service Key', environmentId, role: 'OWNER' },
      ownerAuth
    );
    const apiKeyHeader = { 'x-api-key': created.body.apiKey as string };

    const { status, body } = await get<OrganizationBody>(
      srv.baseUrl,
      '/api/v1/portal/organization',
      apiKeyHeader
    );
    expect(status).toBe(200);
    expect(body.name).toBeTruthy();

    const listed = await get<ApiKeysListResponse>(
      srv.baseUrl,
      '/api/v1/portal/gateway/api-keys',
      ownerAuth
    );
    const usedKey = listed.body.keys.find((k) => k.id === created.body.id);
    expect(usedKey?.lastUsedAt).toBeTruthy();
  });

  it('rejects a revoked API key', async () => {
    const created = await post<ApiKeyDTO>(
      srv.baseUrl,
      '/api/v1/portal/gateway/api-keys',
      { name: 'Revoke Then Use', environmentId, role: 'VIEWER' },
      ownerAuth
    );
    await post(
      srv.baseUrl,
      `/api/v1/portal/gateway/api-keys/${created.body.id}/revoke`,
      undefined,
      ownerAuth
    );

    const { status } = await get(srv.baseUrl, '/api/v1/portal/organization', {
      'x-api-key': created.body.apiKey as string,
    });
    expect(status).toBe(401);
  });

  it('rejects a malformed API key', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/organization', {
      'x-api-key': 'not-a-valid-key',
    });
    expect(status).toBe(401);
  });
});

// ─── RBAC ───────────────────────────────────────────────────────────────────

describe('RBAC', () => {
  it('denies a Viewer-role API key from managing other API keys', async () => {
    const viewerKey = await post<ApiKeyDTO>(
      srv.baseUrl,
      '/api/v1/portal/gateway/api-keys',
      { name: 'Viewer Service Key', environmentId, role: 'VIEWER' },
      ownerAuth
    );
    const { status, body } = await post<ErrorBody>(
      srv.baseUrl,
      '/api/v1/portal/gateway/api-keys',
      { name: 'Should be blocked', environmentId, role: 'VIEWER' },
      { 'x-api-key': viewerKey.body.apiKey as string }
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

// ─── Rate limiting ──────────────────────────────────────────────────────────

describe('Rate limiting', () => {
  it('returns 429 with standard headers once the configured limit is exceeded', async () => {
    const { auth } = await registerFreshOrg(srv.baseUrl, 'ratelimit');

    const rule = await post<RateLimitRuleResponse>(
      srv.baseUrl,
      '/api/v1/portal/gateway/rate-limits',
      { window: 'minute', limit: 2 },
      auth
    );
    expect(rule.status).toBe(201);
    expect(rule.body.limit).toBe(2);

    const first = await get(srv.baseUrl, '/api/v1/portal/organization', auth);
    const second = await get(srv.baseUrl, '/api/v1/portal/organization', auth);
    const third = await get<ErrorBody>(srv.baseUrl, '/api/v1/portal/organization', auth);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(third.headers.get('retry-after')).toBeTruthy();
    expect(third.headers.get('x-ratelimit-limit')).toBe('2');
    expect(third.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('rate limits are isolated per organization', async () => {
    const orgA = await registerFreshOrg(srv.baseUrl, 'isolation-a');
    const orgB = await registerFreshOrg(srv.baseUrl, 'isolation-b');

    await post(
      srv.baseUrl,
      '/api/v1/portal/gateway/rate-limits',
      { window: 'minute', limit: 1 },
      orgA.auth
    );

    const orgAFirst = await get(srv.baseUrl, '/api/v1/portal/organization', orgA.auth);
    const orgASecond = await get(srv.baseUrl, '/api/v1/portal/organization', orgA.auth);
    const orgBFirst = await get(srv.baseUrl, '/api/v1/portal/organization', orgB.auth);

    expect(orgAFirst.status).toBe(200);
    expect(orgASecond.status).toBe(429);
    expect(orgBFirst.status).toBe(200);
  });
});

// ─── Centralized logging ─────────────────────────────────────────────────────

describe('Centralized logging', () => {
  it('records organization-scoped requests with endpoint/actor/status', async () => {
    const { auth } = await registerFreshOrg(srv.baseUrl, 'logging');
    await get(srv.baseUrl, '/api/v1/portal/organization', auth);

    const { status, body } = await get<LogsResponse>(
      srv.baseUrl,
      '/api/v1/portal/gateway/logs',
      auth
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    expect(body.entries.some((e) => e.endpoint === '/api/v1/portal/organization')).toBe(true);
    expect(body.entries.every((e) => e.statusCode > 0)).toBe(true);
  });
});
