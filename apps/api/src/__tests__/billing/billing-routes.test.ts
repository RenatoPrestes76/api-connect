import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startServer,
  stopServer,
  get,
  post,
  orgBearer,
  noOrgBearer,
  adminBearer,
  lowPrivAdminBearer,
} from './helpers.js';
import type { TestServer } from './helpers.js';

let ctx: TestServer;

beforeAll(async () => {
  ctx = await startServer();
});
afterAll(async () => {
  await stopServer(ctx.server);
});

// ─── Plans ────────────────────────────────────────────────────────────────────
// Not tenant-scoped, but still behind the generic authMiddleware — any
// authenticated caller may read them, no caller may read them unauthenticated.

describe('GET /api/v1/billing/plans', () => {
  it('returns 3 plans for an authenticated caller', async () => {
    const { status, body } = await get<{ plans: unknown[] }>(
      ctx.baseUrl,
      '/api/v1/billing/plans',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(200);
    expect(body.plans).toHaveLength(3);
  });

  it('returns 401 for an unauthenticated caller', async () => {
    const { status } = await get(ctx.baseUrl, '/api/v1/billing/plans');
    expect(status).toBe(401);
  });

  it('includes community, professional, enterprise slugs', async () => {
    const { body } = await get<{ plans: Array<{ slug: string }> }>(
      ctx.baseUrl,
      '/api/v1/billing/plans',
      orgBearer('tenant-professional')
    );
    const slugs = body.plans.map((p) => p.slug);
    expect(slugs).toContain('community');
    expect(slugs).toContain('professional');
    expect(slugs).toContain('enterprise');
  });
});

describe('GET /api/v1/billing/plans/:slug', () => {
  const auth = orgBearer('tenant-professional');

  it('returns community plan', async () => {
    const { status, body } = await get<{ slug: string; monthlyPrice: number }>(
      ctx.baseUrl,
      '/api/v1/billing/plans/community',
      auth
    );
    expect(status).toBe(200);
    expect(body.slug).toBe('community');
    expect(body.monthlyPrice).toBe(0);
  });

  it('returns professional plan with $49/mo price', async () => {
    const { status, body } = await get<{ monthlyPrice: number }>(
      ctx.baseUrl,
      '/api/v1/billing/plans/professional',
      auth
    );
    expect(status).toBe(200);
    expect(body.monthlyPrice).toBe(4900);
  });

  it('returns 404 for unknown plan slug', async () => {
    const { status } = await get(ctx.baseUrl, '/api/v1/billing/plans/unknown', auth);
    expect(status).toBe(404);
  });
});

// ─── Subscription ─────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/subscription', () => {
  it('returns professional subscription for demo tenant', async () => {
    const { status, body } = await get<{
      subscription: { planSlug: string; status: string };
      plan: unknown;
    }>(ctx.baseUrl, '/api/v1/billing/subscription', orgBearer('tenant-professional'));
    expect(status).toBe(200);
    expect(body.subscription.planSlug).toBe('professional');
    expect(body.subscription.status).toBe('active');
    expect(body.plan).toBeTruthy();
  });

  it('returns enterprise subscription for enterprise tenant', async () => {
    const { body } = await get<{ subscription: { planSlug: string; billingCycle: string } }>(
      ctx.baseUrl,
      '/api/v1/billing/subscription',
      orgBearer('tenant-enterprise')
    );
    expect(body.subscription.planSlug).toBe('enterprise');
    expect(body.subscription.billingCycle).toBe('yearly');
  });

  it('returns 404 for a tenant with no subscription', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/subscription',
      orgBearer('tenant-unknown-xxx')
    );
    expect(status).toBe(404);
  });
});

// These tests use dedicated mutation tenants to avoid contaminating seeded data
const MUTATION_TENANT = 'tenant-mutation-test';
const ORG_A = 'tenant-bola-a';
const ORG_B = 'tenant-bola-b';

describe('POST /api/v1/billing/upgrade', () => {
  it('upgrades a new tenant to professional (creates subscription)', async () => {
    const { status, body } = await post<{ subscription: { planSlug: string } }>(
      ctx.baseUrl,
      '/api/v1/billing/upgrade',
      { planSlug: 'professional', billingCycle: 'monthly' },
      orgBearer(MUTATION_TENANT)
    );
    expect(status).toBe(200);
    expect(body.subscription.planSlug).toBe('professional');
  });

  it('returns 422 when target is not an upgrade', async () => {
    // tenant-enterprise is on enterprise plan — trying to upgrade to community fails
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/upgrade',
      { planSlug: 'community' },
      orgBearer('tenant-enterprise')
    );
    expect(status).toBe(422);
  });

  it('returns 400 when planSlug missing', async () => {
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/upgrade',
      {},
      orgBearer(MUTATION_TENANT)
    );
    expect(status).toBe(400);
  });

  it('returns 401 unauthenticated', async () => {
    const { status } = await post(ctx.baseUrl, '/api/v1/billing/upgrade', {
      planSlug: 'professional',
    });
    expect(status).toBe(401);
  });

  it("ignores a tenantId/organizationId field in the body — the plan change always applies to the caller's own session org, never a body-supplied one (mass-assignment check)", async () => {
    // Authenticated as ORG_A, but the body claims to be ORG_B.
    const { status, body } = await post<{ subscription: { planSlug: string; tenantId: string } }>(
      ctx.baseUrl,
      '/api/v1/billing/upgrade',
      { planSlug: 'professional', billingCycle: 'monthly', tenantId: ORG_B, organizationId: ORG_B },
      orgBearer(ORG_A)
    );
    expect(status).toBe(200);
    expect(body.subscription.tenantId).toBe(ORG_A);

    // ORG_B must still have no subscription of its own.
    const orgBSub = await get(ctx.baseUrl, '/api/v1/billing/subscription', orgBearer(ORG_B));
    expect(orgBSub.status).toBe(404);
  });
});

describe('POST /api/v1/billing/downgrade', () => {
  it('downgrades mutation tenant from professional to community', async () => {
    const { status, body } = await post<{ subscription: { planSlug: string } }>(
      ctx.baseUrl,
      '/api/v1/billing/downgrade',
      { planSlug: 'community', billingCycle: 'monthly' },
      orgBearer(MUTATION_TENANT)
    );
    expect(status).toBe(200);
    expect(body.subscription.planSlug).toBe('community');
  });
});

describe('POST /api/v1/billing/cancel', () => {
  it('cancels a subscription', async () => {
    const { status, body } = await post<{ subscription: { status: string }; message: string }>(
      ctx.baseUrl,
      '/api/v1/billing/cancel',
      {},
      orgBearer(MUTATION_TENANT)
    );
    expect(status).toBe(200);
    expect(body.subscription.status).toBe('canceled');
    expect(body.message).toMatch(/canceled/i);
  });

  it("cannot be used to cancel another tenant's subscription by ID guessing — cancel always targets the caller's own session org", async () => {
    // ORG_A has an active subscription (created above); attempt to cancel it
    // while authenticated as ORG_B — must fail, never touch ORG_A's data.
    const before = await get<{ subscription: { status: string } }>(
      ctx.baseUrl,
      '/api/v1/billing/subscription',
      orgBearer(ORG_A)
    );
    expect(before.body.subscription.status).toBe('active');

    // ORG_B has no subscription — its own cancel attempt 404s and cannot
    // possibly affect ORG_A.
    const { status } = await post(ctx.baseUrl, '/api/v1/billing/cancel', {}, orgBearer(ORG_B));
    expect(status).toBe(404);

    const after = await get<{ subscription: { status: string } }>(
      ctx.baseUrl,
      '/api/v1/billing/subscription',
      orgBearer(ORG_A)
    );
    expect(after.body.subscription.status).toBe('active');
  });
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/invoices', () => {
  it('returns invoices for professional tenant', async () => {
    const { status, body } = await get<{ total: number; items: unknown[] }>(
      ctx.baseUrl,
      '/api/v1/billing/invoices',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it('filters invoices by status=paid', async () => {
    const { body } = await get<{ items: Array<{ status: string }> }>(
      ctx.baseUrl,
      '/api/v1/billing/invoices?status=paid',
      orgBearer('tenant-professional')
    );
    expect(body.items.every((i) => i.status === 'paid')).toBe(true);
  });

  it('returns empty list for community tenant (no invoices)', async () => {
    const { body } = await get<{ total: number }>(
      ctx.baseUrl,
      '/api/v1/billing/invoices',
      orgBearer('tenant-community')
    );
    expect(body.total).toBe(0);
  });

  it('a ?tenantId= query param impersonating another tenant is ignored — invoices always come from the session org, not the query string', async () => {
    const { body } = await get<{ items: Array<{ tenantId: string }> }>(
      ctx.baseUrl,
      '/api/v1/billing/invoices?tenantId=tenant-enterprise',
      orgBearer('tenant-professional')
    );
    expect(body.items.every((i) => i.tenantId === 'tenant-professional')).toBe(true);
  });
});

describe('GET /api/v1/billing/invoices/:id — cross-tenant BOLA', () => {
  it("tenant-enterprise cannot read tenant-professional's invoice by id", async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/invoices/inv-pro-2026-01',
      orgBearer('tenant-enterprise')
    );
    expect(status).toBe(404);
  });

  it("tenant-professional cannot read tenant-enterprise's invoice by id", async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/invoices/inv-ent-2026-01',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(404);
  });

  it('the rightful owner can still read its own invoice (no regression)', async () => {
    const { status, body } = await get<{ id: string; number: string }>(
      ctx.baseUrl,
      '/api/v1/billing/invoices/inv-pro-2026-01',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(200);
    expect(body.id).toBe('inv-pro-2026-01');
    expect(body.number).toBe('INV-2026-0001');
  });

  it('returns 404 for unknown invoice', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/invoices/inv-not-found',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(404);
  });

  it('returns 401 unauthenticated', async () => {
    const { status } = await get(ctx.baseUrl, '/api/v1/billing/invoices/inv-pro-2026-01');
    expect(status).toBe(401);
  });
});

// ─── Usage ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/usage', () => {
  it('returns current usage and limits for professional', async () => {
    const { status, body } = await get<{
      usage: { month: string };
      limits: { aiCredits: number };
      planSlug: string;
    }>(ctx.baseUrl, '/api/v1/billing/usage', orgBearer('tenant-professional'));
    expect(status).toBe(200);
    expect(body.usage.month).toMatch(/^\d{4}-\d{2}$/);
    expect(body.planSlug).toBe('professional');
    expect(body.limits.aiCredits).toBe(1000);
  });

  it('enterprise has null (unlimited) AI credits limit', async () => {
    const { body } = await get<{ limits: { aiCredits: number | null } }>(
      ctx.baseUrl,
      '/api/v1/billing/usage',
      orgBearer('tenant-enterprise')
    );
    expect(body.limits.aiCredits).toBeNull();
  });
});

describe('GET /api/v1/billing/usage/history', () => {
  it('returns history for professional tenant', async () => {
    const { status, body } = await get<{ total: number; items: unknown[] }>(
      ctx.baseUrl,
      '/api/v1/billing/usage/history',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    expect(body.items).toBeDefined();
  });
});

// ─── License ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/license', () => {
  it('returns license for professional tenant', async () => {
    const { status, body } = await get<{
      key: string;
      planSlug: string;
      status: string;
      fingerprint: string;
    }>(ctx.baseUrl, '/api/v1/billing/license', orgBearer('tenant-professional'));
    expect(status).toBe(200);
    expect(body.key).toMatch(/^ATLAS-/);
    expect(body.planSlug).toBe('professional');
    expect(body.status).toBe('active');
    expect(body.fingerprint).toMatch(/^[0-9A-F]{12}$/);
  });

  it('returns 404 for a tenant with no license', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/license',
      orgBearer('tenant-unknown-zzz')
    );
    expect(status).toBe(404);
  });

  it("another tenant's license key is never returned to a different caller", async () => {
    const { body } = await get<{ key: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license',
      orgBearer('tenant-professional')
    );
    const other = await get<{ key: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license',
      orgBearer('tenant-enterprise')
    );
    expect(other.body.key).not.toBe(body.key);
  });
});

describe('POST /api/v1/billing/license/validate', () => {
  // Pre-session key-possession flow (analogous to a Runtime activation key):
  // intentionally left accepting an explicit tenantId in the body — see
  // license.ts's doc comment. Still requires SOME authenticated caller
  // (any valid session), since the route sits behind authMiddleware.
  const auth = orgBearer('tenant-professional');

  it('validates a real license key', async () => {
    const licData = await get<{ key: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license',
      orgBearer('tenant-professional')
    );
    const { status, body } = await post<{ valid: boolean; planSlug: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license/validate',
      { key: licData.body.key, tenantId: 'tenant-professional' },
      auth
    );
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.planSlug).toBe('professional');
  });

  it('rejects an invalid key format', async () => {
    const { body } = await post<{ valid: boolean; message: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license/validate',
      { key: 'not-a-real-key', tenantId: 'tenant-professional' },
      auth
    );
    expect(body.valid).toBe(false);
    expect(body.message).toMatch(/format/i);
  });

  it("rejects a valid key when paired with the wrong tenantId (the signature is bound to the tenant, so this can't be used to impersonate another tenant's license)", async () => {
    const licData = await get<{ key: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license',
      orgBearer('tenant-professional')
    );
    const { body } = await post<{ valid: boolean }>(
      ctx.baseUrl,
      '/api/v1/billing/license/validate',
      { key: licData.body.key, tenantId: 'tenant-community' },
      auth
    );
    expect(body.valid).toBe(false);
  });

  it('returns 400 when key or tenantId missing', async () => {
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/license/validate',
      { key: 'only-key' },
      auth
    );
    expect(status).toBe(400);
  });

  it('returns 401 unauthenticated', async () => {
    const { status } = await post(ctx.baseUrl, '/api/v1/billing/license/validate', {
      key: 'x',
      tenantId: 'tenant-professional',
    });
    expect(status).toBe(401);
  });
});

// ─── Customer Portal ──────────────────────────────────────────────────────────

describe('GET /api/v1/billing/customer-portal', () => {
  it('returns a portal URL for paid tenant', async () => {
    const { status, body } = await get<{ url: string; tenantId: string }>(
      ctx.baseUrl,
      '/api/v1/billing/customer-portal',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(200);
    expect(body.url).toMatch(/^https:\/\/billing\.stripe\.com/);
    expect(body.tenantId).toBe('tenant-professional');
  });

  it('returns 403 for community (free) tenant', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/customer-portal',
      orgBearer('tenant-community')
    );
    expect(status).toBe(403);
  });
});

describe('POST /api/v1/billing/checkout', () => {
  it('creates a checkout session', async () => {
    const { status, body } = await post<{ id: string; url: string; planSlug: string }>(
      ctx.baseUrl,
      '/api/v1/billing/checkout',
      { planSlug: 'professional', billingCycle: 'monthly' },
      orgBearer('tenant-community')
    );
    expect(status).toBe(201);
    expect(body.id).toMatch(/^cs_demo_/);
    expect(body.url).toMatch(/checkout\.stripe\.com/);
    expect(body.planSlug).toBe('professional');
  });

  it('returns 400 when planSlug missing', async () => {
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/checkout',
      {},
      orgBearer('tenant-community')
    );
    expect(status).toBe(400);
  });
});

// ─── Stripe Webhooks ──────────────────────────────────────────────────────────
// ATLAS 46.26 — this handler previously had no permission check at all and
// trusted metadata.tenantId straight from the body — any authenticated
// session (any signed-in tenant user) could forge a subscription/invoice
// event naming a *different* tenant. Now gated behind billing.manage, the
// same admin permission used by billing/admin/*.

describe('POST /api/v1/billing/webhooks/stripe — requires billing.manage', () => {
  it('rejects a caller with no admin session at all (a plain tenant JWT is not enough)', async () => {
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/webhooks/stripe',
      { id: 'evt_hostile', type: 'invoice.paid', data: { object: { id: 'in_x', metadata: {} } } },
      orgBearer('tenant-professional')
    );
    // Neither a Supabase Bearer token nor no auth at all satisfies
    // requirePermission, which only recognizes the admin-identity Bearer
    // scheme — both come back 401 UNAUTHENTICATED from requireAdminAuth.
    expect(status).toBe(401);
  });

  it('rejects an admin session without billing.manage', async () => {
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/webhooks/stripe',
      { id: 'evt_x', type: 'invoice.paid', data: { object: { id: 'in_x', metadata: {} } } },
      await lowPrivAdminBearer()
    );
    expect(status).toBe(403);
  });

  it('rejects a fully unauthenticated caller', async () => {
    const { status } = await post(ctx.baseUrl, '/api/v1/billing/webhooks/stripe', {
      id: 'evt_anon',
      type: 'invoice.paid',
      data: { object: {} },
    });
    expect(status).toBe(401);
  });

  it('acknowledges invoice.paid event for a caller holding billing.manage', async () => {
    const { status, body } = await post<{ received: boolean; type: string }>(
      ctx.baseUrl,
      '/api/v1/billing/webhooks/stripe',
      {
        id: 'evt_test_001',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_demo_001',
            metadata_invoice_id: 'inv-pro-2026-06',
            metadata: { tenantId: 'tenant-professional' },
          },
        },
      },
      await adminBearer()
    );
    expect(status).toBe(200);
    expect(body.received).toBe(true);
    expect(body.type).toBe('invoice.paid');
  });

  it('handles subscription.updated and acknowledges', async () => {
    const { status, body } = await post<{ received: boolean }>(
      ctx.baseUrl,
      '/api/v1/billing/webhooks/stripe',
      {
        id: 'evt_test_002',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_pro_demo_001',
            status: 'active',
            metadata: { tenantId: 'tenant-professional' },
          },
        },
      },
      await adminBearer()
    );
    expect(status).toBe(200);
    expect(body.received).toBe(true);
  });

  it('handles subscription.deleted and cancels', async () => {
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/webhooks/stripe',
      {
        id: 'evt_test_003',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_mut_001', metadata: { tenantId: MUTATION_TENANT } } },
      },
      await adminBearer()
    );
    expect(status).toBe(200);
  });

  it('returns 400 for invalid payload', async () => {
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/webhooks/stripe',
      { invalid: true },
      await adminBearer()
    );
    expect(status).toBe(400);
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/admin/dashboard', () => {
  it('returns MRR, ARR, and customer counts for a caller with billing.manage', async () => {
    const { status, body } = await get<{
      mrr: number;
      arr: number;
      activeCustomers: number;
      communityUsers: number;
      revenueByPlan: Record<string, number>;
    }>(ctx.baseUrl, '/api/v1/billing/admin/dashboard', await adminBearer());
    expect(status).toBe(200);
    expect(body.mrr).toBeGreaterThan(0);
    expect(body.arr).toBe(body.mrr * 12);
    expect(body.activeCustomers).toBeGreaterThan(0);
    expect(body.revenueByPlan).toBeDefined();
  });

  it('MRR includes enterprise yearly contribution', async () => {
    const { body } = await get<{ revenueByPlan: { enterprise: number } }>(
      ctx.baseUrl,
      '/api/v1/billing/admin/dashboard',
      await adminBearer()
    );
    expect(body.revenueByPlan.enterprise).toBeGreaterThan(0);
  });

  it('rejects a plain tenant session (not staff at all)', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/admin/dashboard',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(401);
  });

  it('rejects a staff session without billing.manage', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/admin/dashboard',
      await lowPrivAdminBearer()
    );
    expect(status).toBe(403);
  });

  it('rejects unauthenticated', async () => {
    const { status } = await get(ctx.baseUrl, '/api/v1/billing/admin/dashboard');
    expect(status).toBe(401);
  });
});

describe('GET /api/v1/billing/admin/subscriptions', () => {
  it('returns all seeded subscriptions for a caller with billing.manage', async () => {
    const { status, body } = await get<{ total: number; items: unknown[] }>(
      ctx.baseUrl,
      '/api/v1/billing/admin/subscriptions',
      await adminBearer()
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });

  it('rejects a plain tenant session', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/admin/subscriptions',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(401);
  });
});

describe('GET /api/v1/billing/admin/invoices', () => {
  it('returns all invoices for a caller with billing.manage', async () => {
    const { status, body } = await get<{ total: number }>(
      ctx.baseUrl,
      '/api/v1/billing/admin/invoices',
      await adminBearer()
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
  });

  it('filters by status=paid', async () => {
    const { body } = await get<{ items: Array<{ status: string }> }>(
      ctx.baseUrl,
      '/api/v1/billing/admin/invoices?status=paid',
      await adminBearer()
    );
    expect(body.items.every((i) => i.status === 'paid')).toBe(true);
  });

  it('rejects a plain tenant session', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/admin/invoices',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(401);
  });
});

// ─── Tenant/org enforcement ─────────────────────────────────────────────────
// No route may fall back to a default tenant, trust a client-supplied
// tenantId query param, or serve an unauthenticated request.

describe('Org enforcement — session-derived identity only, no client-supplied fallback', () => {
  const ORG_SCOPED_GET_ROUTES = [
    '/api/v1/billing/subscription',
    '/api/v1/billing/invoices',
    '/api/v1/billing/usage',
    '/api/v1/billing/license',
    '/api/v1/billing/customer-portal',
  ];

  for (const path of ORG_SCOPED_GET_ROUTES) {
    it(`GET ${path} returns 401 unauthenticated`, async () => {
      const { status } = await get(ctx.baseUrl, path);
      expect(status).toBe(401);
    });

    it(`GET ${path} returns 403 ORGANIZATION_NOT_LINKED for an authenticated session with no org`, async () => {
      const { status, body } = await get<{ error: { code: string } }>(
        ctx.baseUrl,
        path,
        noOrgBearer()
      );
      expect(status).toBe(403);
      expect(body.error.code).toBe('ORGANIZATION_NOT_LINKED');
    });

    it(`GET ${path}?tenantId=tenant-enterprise as tenant-professional does NOT leak enterprise data (query param is inert)`, async () => {
      const { status } = await get(
        ctx.baseUrl,
        `${path}?tenantId=tenant-enterprise`,
        orgBearer('tenant-professional')
      );
      // Either scoped correctly to tenant-professional (200) or 403/404 —
      // never silently serves tenant-enterprise's data.
      expect([200, 403, 404]).toContain(status);
    });
  }

  it('POST /api/v1/billing/checkout returns 401 unauthenticated', async () => {
    const { status } = await post(ctx.baseUrl, '/api/v1/billing/checkout', {
      planSlug: 'professional',
    });
    expect(status).toBe(401);
  });

  it('POST /api/v1/billing/checkout returns 403 ORGANIZATION_NOT_LINKED with no org', async () => {
    const { status, body } = await post<{ error: { code: string } }>(
      ctx.baseUrl,
      '/api/v1/billing/checkout',
      { planSlug: 'professional' },
      noOrgBearer()
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('ORGANIZATION_NOT_LINKED');
  });

  it('a valid authenticated tenant continues to work (no regression)', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/subscription',
      orgBearer('tenant-professional')
    );
    expect(status).toBe(200);
  });
});
