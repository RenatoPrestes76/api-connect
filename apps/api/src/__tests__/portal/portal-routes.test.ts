import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post, put, del, type TestServer } from './helpers.js';

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
describe('GET /api/v1/portal/api-keys', () => {
  it('returns API keys for enterprise tenant', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/portal/api-keys', ENT);
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(body.keys.every((k: any) => !k.keyHash)).toBe(true);
  });
});

describe('POST /api/v1/portal/api-keys', () => {
  it('creates a new API key and returns full key once', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/portal/api-keys',
      {
        name: 'Test Key',
        scopes: ['read:workflows'],
      },
      ENT
    );
    expect(status).toBe(201);
    expect(body.key).toBeTruthy();
    expect(body.key.length).toBeGreaterThan(8);
    expect(body.active).toBe(true);
  });

  it('returns 400 when name missing', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/portal/api-keys', {
      scopes: ['read:workflows'],
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_NAME');
  });

  it('returns 400 when scopes is empty', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/portal/api-keys', {
      name: 'Key',
      scopes: [],
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_SCOPES');
  });
});

describe('POST /api/v1/portal/api-keys/:id/revoke', () => {
  it('revokes an active key', async () => {
    const { body: created } = await post<any>(
      srv.baseUrl,
      '/api/v1/portal/api-keys',
      {
        name: 'Key to revoke',
        scopes: ['read:workflows'],
      },
      ENT
    );
    const { status, body } = await post<any>(
      srv.baseUrl,
      `/api/v1/portal/api-keys/${created.id}/revoke`
    );
    expect(status).toBe(200);
    expect(body.revoked).toBe(true);
  });

  it('returns 404 for unknown key', async () => {
    const { status } = await post<any>(srv.baseUrl, '/api/v1/portal/api-keys/no-such-key/revoke');
    expect(status).toBe(404);
  });
});

describe('DELETE /api/v1/portal/api-keys/:id', () => {
  it('deletes a key', async () => {
    const { body: created } = await post<any>(
      srv.baseUrl,
      '/api/v1/portal/api-keys',
      {
        name: 'Key to delete',
        scopes: ['read:connectors'],
      },
      ENT
    );
    const { status, body } = await del<any>(srv.baseUrl, `/api/v1/portal/api-keys/${created.id}`);
    expect(status).toBe(200);
    expect(body.deleted).toBe(true);
  });
});

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
describe('GET /api/v1/portal/users', () => {
  it('returns users for enterprise tenant', async () => {
    const { status, body } = await get<any>(srv.baseUrl, '/api/v1/portal/users', ENT);
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(4);
    expect(body.users.some((u: any) => u.role === 'owner')).toBe(true);
  });
});

describe('POST /api/v1/portal/users/invite', () => {
  it('invites a new user', async () => {
    const { status, body } = await post<any>(
      srv.baseUrl,
      '/api/v1/portal/users/invite',
      {
        email: 'newuser@enterprise.com',
        name: 'New User',
        role: 'developer',
      },
      ENT
    );
    expect(status).toBe(201);
    expect(body.status).toBe('invited');
    expect(body.email).toBe('newuser@enterprise.com');
  });

  it('returns 400 for invalid role', async () => {
    const { status, body } = await post<any>(srv.baseUrl, '/api/v1/portal/users/invite', {
      email: 'x@y.com',
      name: 'X',
      role: 'superadmin',
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_ROLE');
  });
});

describe('PUT /api/v1/portal/users/:id/role', () => {
  it('updates user role', async () => {
    const { status, body } = await put<any>(srv.baseUrl, '/api/v1/portal/users/usr-003/role', {
      role: 'admin',
    });
    expect(status).toBe(200);
    expect(body.role).toBe('admin');
  });

  it('returns 404 for unknown user', async () => {
    const { status } = await put<any>(srv.baseUrl, '/api/v1/portal/users/no-such/role', {
      role: 'viewer',
    });
    expect(status).toBe(404);
  });
});

describe('DELETE /api/v1/portal/users/:id', () => {
  it('removes an invited user', async () => {
    const { body: invited } = await post<any>(
      srv.baseUrl,
      '/api/v1/portal/users/invite',
      {
        email: 'temp@test.com',
        name: 'Temp',
        role: 'viewer',
      },
      ENT
    );
    const { status, body } = await del<any>(srv.baseUrl, `/api/v1/portal/users/${invited.id}`);
    expect(status).toBe(200);
    expect(body.deleted).toBe(true);
  });
});
