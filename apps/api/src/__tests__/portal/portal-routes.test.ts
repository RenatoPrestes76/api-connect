import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post, put, seededOwnerAuth, type TestServer } from './helpers.js';

/**
 * ATLAS 46.26 — Part A: dashboard/support/connectors were previously
 * unauthenticated (`/api/v1/portal/` bypasses the global Supabase-style
 * auth middleware by design — see middleware/auth.ts's
 * PUBLIC_PATH_PREFIXES — trusting each route to self-guard, which these
 * three files never did) and scoped by a client-supplied `x-tenant-id`
 * header with zero verification. `GET/PUT .../support/:id` and
 * `PUT .../connectors/:id/health` took the resource id from the URL alone
 * with no ownership check at all — a textbook Broken Object Level
 * Authorization hole: any caller, authenticated or not, could read or
 * mutate any other tenant's data by guessing/enumerating an id.
 *
 * This file replaces the previous version, which explicitly asserted the
 * *vulnerable* behavior as correct (e.g. "PUT .../support/:id/status"
 * with no auth header at all, expecting 200) — a real instance of "tests
 * pass" not meaning "secure". See
 * docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md's "ATLAS 46.26" section.
 */

interface AuthResponse {
  token: string;
  user: { id: string; email: string; role: string; organizationId: string };
}

let srv: TestServer;
let ownerAuth: Record<string, string>;

beforeAll(async () => {
  srv = await startTestServer();
  ownerAuth = await seededOwnerAuth(srv.baseUrl);
});
afterAll(async () => {
  await srv.close();
});

async function registerFreshOrg(label: string): Promise<Record<string, string>> {
  const code = `${label}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const { body } = await post<AuthResponse>(srv.baseUrl, '/api/v1/portal/auth/register', {
    name: `Portal Security ${code}`,
    razaoSocial: `Portal Security ${code} LTDA`,
    cnpj: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}0001`,
    internalCode: code,
    owner: {
      name: 'Owner',
      email: `owner-${code.toLowerCase()}@example.com`,
      password: 'S3nhaForte!1',
    },
  });
  return { Authorization: `Bearer ${body.token}` };
}

// ─── Unauthenticated access is rejected everywhere ─────────────────────────

describe('Portal dashboard/support/connectors require authentication (ATLAS 46.26)', () => {
  const UNAUTHENTICATED_CASES: Array<{ method: 'GET' | 'POST' | 'PUT'; path: string }> = [
    { method: 'GET', path: '/api/v1/portal/dashboard' },
    { method: 'POST', path: '/api/v1/portal/onboarding/complete-step' },
    { method: 'GET', path: '/api/v1/portal/support' },
    { method: 'GET', path: '/api/v1/portal/support/tkt-001' },
    { method: 'POST', path: '/api/v1/portal/support' },
    { method: 'PUT', path: '/api/v1/portal/support/tkt-001/status' },
    { method: 'GET', path: '/api/v1/portal/connectors' },
    { method: 'PUT', path: '/api/v1/portal/connectors/pc-001/health' },
  ];

  for (const { method, path } of UNAUTHENTICATED_CASES) {
    it(`${method} ${path} rejects a request with no credentials at all (401)`, async () => {
      const call =
        method === 'GET'
          ? get(srv.baseUrl, path)
          : method === 'PUT'
            ? put(srv.baseUrl, path, {})
            : post(srv.baseUrl, path, {});
      const { status } = await call;
      expect(status).toBe(401);
    });
  }

  it('a client-supplied x-tenant-id header alone (no real session) is never accepted — the old bypass is closed', async () => {
    const { status } = await get(srv.baseUrl, '/api/v1/portal/support', {
      'x-tenant-id': 'tenant-enterprise',
    });
    expect(status).toBe(401);
  });
});

// ─── Dashboard — authenticated works, scoped to the caller's own org ───────

describe('GET /api/v1/portal/dashboard (authenticated)', () => {
  it('returns 200 for a real authenticated session, scoped to that org (never the fixture demo tenant)', async () => {
    const auth = await registerFreshOrg('DASH');
    const { status, body } = await get<{ tenantId: string; onboarding: unknown }>(
      srv.baseUrl,
      '/api/v1/portal/dashboard',
      auth
    );
    expect(status).toBe(200);
    expect(body.tenantId).not.toBe('tenant-enterprise');
    expect(body.onboarding).toBeDefined();
  });
});

// ─── Support tickets — real A -> B / B -> A object-level authorization ─────

describe('Support tickets — object-level authorization (ATLAS 46.26, Part A)', () => {
  it("Organization A's ticket is invisible and immutable to Organization B, and vice versa", async () => {
    const authA = await registerFreshOrg('TKTA');
    const authB = await registerFreshOrg('TKTB');

    const createdA = await post<{ id: string }>(
      srv.baseUrl,
      '/api/v1/portal/support',
      {
        title: 'Org A issue',
        description: 'Only Org A should see this',
        severity: 'P3',
        category: 'technical',
      },
      authA
    );
    expect(createdA.status).toBe(201);
    const ticketIdA = createdA.body.id;

    const createdB = await post<{ id: string }>(
      srv.baseUrl,
      '/api/v1/portal/support',
      {
        title: 'Org B issue',
        description: 'Only Org B should see this',
        severity: 'P3',
        category: 'technical',
      },
      authB
    );
    expect(createdB.status).toBe(201);
    const ticketIdB = createdB.body.id;

    // A -> B: Organization B must never be able to read Organization A's ticket.
    const bReadsA = await get(srv.baseUrl, `/api/v1/portal/support/${ticketIdA}`, authB);
    expect(bReadsA.status).toBe(404);

    // B -> A: symmetric.
    const aReadsB = await get(srv.baseUrl, `/api/v1/portal/support/${ticketIdB}`, authA);
    expect(aReadsB.status).toBe(404);

    // A -> B mutation: Organization B must never be able to change Organization A's ticket status.
    const bMutatesA = await put(
      srv.baseUrl,
      `/api/v1/portal/support/${ticketIdA}/status`,
      { status: 'resolved' },
      authB
    );
    expect(bMutatesA.status).toBe(404);

    // Confirm A's ticket really is untouched by B's attempted mutation.
    const aReadsOwn = await get<{ status: string }>(
      srv.baseUrl,
      `/api/v1/portal/support/${ticketIdA}`,
      authA
    );
    expect(aReadsOwn.body.status).toBe('open');

    // Each organization can legitimately read and mutate its own ticket.
    const aMutatesOwn = await put(
      srv.baseUrl,
      `/api/v1/portal/support/${ticketIdA}/status`,
      { status: 'resolved' },
      authA
    );
    expect(aMutatesOwn.status).toBe(200);

    // Each organization's own list only ever contains its own ticket.
    const listA = await get<{ tickets: Array<{ id: string }> }>(
      srv.baseUrl,
      '/api/v1/portal/support',
      authA
    );
    expect(listA.body.tickets.some((t) => t.id === ticketIdA)).toBe(true);
    expect(listA.body.tickets.some((t) => t.id === ticketIdB)).toBe(false);
  });

  it("a caller cannot read the pre-seeded demo tenant's ticket through their own, unrelated session", async () => {
    const auth = await registerFreshOrg('TKTC');
    const { status } = await get(srv.baseUrl, '/api/v1/portal/support/tkt-001', auth);
    expect(status).toBe(404);
  });
});

// ─── Connectors — authenticated access is correctly scoped ─────────────────

describe('Connectors — object-level authorization (ATLAS 46.26, Part A)', () => {
  it("a real, authenticated org sees an empty connector list — the pre-seeded demo tenant's connectors are not theirs", async () => {
    const auth = await registerFreshOrg('CONN');
    const { status, body } = await get<{ summary: { total: number }; connectors: unknown[] }>(
      srv.baseUrl,
      '/api/v1/portal/connectors',
      auth
    );
    expect(status).toBe(200);
    expect(body.summary.total).toBe(0);
    expect(body.connectors).toEqual([]);
  });

  it("cannot flip the pre-seeded demo tenant's connector health through an unrelated, authenticated session", async () => {
    const auth = await registerFreshOrg('CONNB');
    const { status } = await put(
      srv.baseUrl,
      '/api/v1/portal/connectors/pc-001/health',
      { health: 'error' },
      auth
    );
    expect(status).toBe(404);
  });

  it('rejects an invalid health value even when authenticated', async () => {
    const auth = await registerFreshOrg('CONNC');
    const { status } = await put(
      srv.baseUrl,
      '/api/v1/portal/connectors/pc-001/health',
      { health: 'not-a-real-value' },
      auth
    );
    expect(status).toBe(400);
  });
});

// ─── Onboarding ─────────────────────────────────────────────────────────────

describe('POST /api/v1/portal/onboarding/complete-step (authenticated)', () => {
  it('returns 400 when step is missing, even when authenticated', async () => {
    const { status, body } = await post<{ error: { code: string } }>(
      srv.baseUrl,
      '/api/v1/portal/onboarding/complete-step',
      {},
      ownerAuth
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_STEP');
  });

  it("a real org with no seeded onboarding progress gets a clean 404, not another tenant's progress", async () => {
    const auth = await registerFreshOrg('ONB');
    const { status } = await post(
      srv.baseUrl,
      '/api/v1/portal/onboarding/complete-step',
      { step: 'conector' },
      auth
    );
    expect(status).toBe(404);
  });
});
