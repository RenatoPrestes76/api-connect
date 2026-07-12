import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer, get, post } from './helpers.js';
import type { TestServer } from './helpers.js';
import { billingStore } from '../../modules/billing/billing-store.js';

let ctx: TestServer;

beforeAll(async () => {
  ctx = await startServer();
});
afterAll(async () => {
  await stopServer(ctx.server);
});

// ─── Plans ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/plans', () => {
  it('returns 3 plans', async () => {
    const { status, body } = await get<{ plans: unknown[] }>(ctx.baseUrl, '/api/v1/billing/plans');
    expect(status).toBe(200);
    expect(body.plans).toHaveLength(3);
  });

  it('includes community, professional, enterprise slugs', async () => {
    const { body } = await get<{ plans: Array<{ slug: string }> }>(
      ctx.baseUrl,
      '/api/v1/billing/plans'
    );
    const slugs = body.plans.map((p) => p.slug);
    expect(slugs).toContain('community');
    expect(slugs).toContain('professional');
    expect(slugs).toContain('enterprise');
  });
});

describe('GET /api/v1/billing/plans/:slug', () => {
  it('returns community plan', async () => {
    const { status, body } = await get<{ slug: string; monthlyPrice: number }>(
      ctx.baseUrl,
      '/api/v1/billing/plans/community'
    );
    expect(status).toBe(200);
    expect(body.slug).toBe('community');
    expect(body.monthlyPrice).toBe(0);
  });

  it('returns professional plan with $49/mo price', async () => {
    const { status, body } = await get<{ monthlyPrice: number }>(
      ctx.baseUrl,
      '/api/v1/billing/plans/professional'
    );
    expect(status).toBe(200);
    expect(body.monthlyPrice).toBe(4900);
  });

  it('returns 404 for unknown plan slug', async () => {
    const { status } = await get(ctx.baseUrl, '/api/v1/billing/plans/unknown');
    expect(status).toBe(404);
  });
});

// ─── Subscription ─────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/subscription', () => {
  it('returns professional subscription for demo tenant', async () => {
    const { status, body } = await get<{
      subscription: { planSlug: string; status: string };
      plan: unknown;
    }>(ctx.baseUrl, '/api/v1/billing/subscription?tenantId=tenant-professional');
    expect(status).toBe(200);
    expect(body.subscription.planSlug).toBe('professional');
    expect(body.subscription.status).toBe('active');
    expect(body.plan).toBeTruthy();
  });

  it('returns enterprise subscription for enterprise tenant', async () => {
    const { body } = await get<{ subscription: { planSlug: string; billingCycle: string } }>(
      ctx.baseUrl,
      '/api/v1/billing/subscription?tenantId=tenant-enterprise'
    );
    expect(body.subscription.planSlug).toBe('enterprise');
    expect(body.subscription.billingCycle).toBe('yearly');
  });

  it('returns 404 for unknown tenant', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/subscription?tenantId=tenant-unknown-xxx'
    );
    expect(status).toBe(404);
  });
});

// These tests use a dedicated mutation tenant to avoid contaminating seeded data
const MUTATION_TENANT = 'tenant-mutation-test';

describe('POST /api/v1/billing/upgrade', () => {
  it('upgrades a new tenant to professional (creates subscription)', async () => {
    const { status, body } = await post<{ subscription: { planSlug: string } }>(
      ctx.baseUrl,
      `/api/v1/billing/upgrade?tenantId=${MUTATION_TENANT}`,
      { planSlug: 'professional', billingCycle: 'monthly' }
    );
    expect(status).toBe(200);
    expect(body.subscription.planSlug).toBe('professional');
  });

  it('returns 422 when target is not an upgrade', async () => {
    // tenant-enterprise is on enterprise plan — trying to upgrade to community fails
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/upgrade?tenantId=tenant-enterprise',
      { planSlug: 'community' }
    );
    expect(status).toBe(422);
  });

  it('returns 400 when planSlug missing', async () => {
    const { status } = await post(
      ctx.baseUrl,
      `/api/v1/billing/upgrade?tenantId=${MUTATION_TENANT}`,
      {}
    );
    expect(status).toBe(400);
  });
});

describe('POST /api/v1/billing/downgrade', () => {
  it('downgrades mutation tenant from professional to community', async () => {
    // tenant was upgraded to professional in the upgrade test above
    const { status, body } = await post<{ subscription: { planSlug: string } }>(
      ctx.baseUrl,
      `/api/v1/billing/downgrade?tenantId=${MUTATION_TENANT}`,
      { planSlug: 'community', billingCycle: 'monthly' }
    );
    expect(status).toBe(200);
    expect(body.subscription.planSlug).toBe('community');
  });
});

describe('POST /api/v1/billing/cancel', () => {
  it('cancels a subscription', async () => {
    const { status, body } = await post<{ subscription: { status: string }; message: string }>(
      ctx.baseUrl,
      `/api/v1/billing/cancel?tenantId=${MUTATION_TENANT}`,
      {}
    );
    expect(status).toBe(200);
    expect(body.subscription.status).toBe('canceled');
    expect(body.message).toMatch(/canceled/i);
  });
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/invoices', () => {
  it('returns invoices for professional tenant', async () => {
    const { status, body } = await get<{ total: number; items: unknown[] }>(
      ctx.baseUrl,
      '/api/v1/billing/invoices?tenantId=tenant-professional'
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it('filters invoices by status=paid', async () => {
    const { body } = await get<{ items: Array<{ status: string }> }>(
      ctx.baseUrl,
      '/api/v1/billing/invoices?tenantId=tenant-professional&status=paid'
    );
    expect(body.items.every((i) => i.status === 'paid')).toBe(true);
  });

  it('returns empty list for community tenant (no invoices)', async () => {
    const { body } = await get<{ total: number }>(
      ctx.baseUrl,
      '/api/v1/billing/invoices?tenantId=tenant-community'
    );
    expect(body.total).toBe(0);
  });
});

describe('GET /api/v1/billing/invoices/:id', () => {
  it('returns a specific invoice', async () => {
    const { status, body } = await get<{ id: string; number: string }>(
      ctx.baseUrl,
      '/api/v1/billing/invoices/inv-pro-2026-01'
    );
    expect(status).toBe(200);
    expect(body.id).toBe('inv-pro-2026-01');
    expect(body.number).toBe('INV-2026-0001');
  });

  it('returns 404 for unknown invoice', async () => {
    const { status } = await get(ctx.baseUrl, '/api/v1/billing/invoices/inv-not-found');
    expect(status).toBe(404);
  });
});

// ─── Usage ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/usage', () => {
  it('returns current usage and limits for professional', async () => {
    const { status, body } = await get<{
      usage: { month: string };
      limits: { aiCredits: number };
      planSlug: string;
    }>(ctx.baseUrl, '/api/v1/billing/usage?tenantId=tenant-professional');
    expect(status).toBe(200);
    expect(body.usage.month).toMatch(/^\d{4}-\d{2}$/);
    expect(body.planSlug).toBe('professional');
    expect(body.limits.aiCredits).toBe(1000);
  });

  it('enterprise has null (unlimited) AI credits limit', async () => {
    const { body } = await get<{ limits: { aiCredits: number | null } }>(
      ctx.baseUrl,
      '/api/v1/billing/usage?tenantId=tenant-enterprise'
    );
    expect(body.limits.aiCredits).toBeNull();
  });
});

describe('GET /api/v1/billing/usage/history', () => {
  it('returns history for professional tenant', async () => {
    const { status, body } = await get<{ total: number; items: unknown[] }>(
      ctx.baseUrl,
      '/api/v1/billing/usage/history?tenantId=tenant-professional'
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
    }>(ctx.baseUrl, '/api/v1/billing/license?tenantId=tenant-professional');
    expect(status).toBe(200);
    expect(body.key).toMatch(/^ATLAS-/);
    expect(body.planSlug).toBe('professional');
    expect(body.status).toBe('active');
    expect(body.fingerprint).toMatch(/^[0-9A-F]{12}$/);
  });

  it('returns 404 for unknown tenant', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/license?tenantId=tenant-unknown-zzz'
    );
    expect(status).toBe(404);
  });
});

describe('POST /api/v1/billing/license/validate', () => {
  it('validates a real license key', async () => {
    const licData = await get<{ key: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license?tenantId=tenant-professional'
    );
    const { status, body } = await post<{ valid: boolean; planSlug: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license/validate',
      { key: licData.body.key, tenantId: 'tenant-professional' }
    );
    expect(status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.planSlug).toBe('professional');
  });

  it('rejects an invalid key format', async () => {
    const { body } = await post<{ valid: boolean; message: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license/validate',
      { key: 'not-a-real-key', tenantId: 'tenant-professional' }
    );
    expect(body.valid).toBe(false);
    expect(body.message).toMatch(/format/i);
  });

  it('rejects wrong tenantId for a valid key', async () => {
    const licData = await get<{ key: string }>(
      ctx.baseUrl,
      '/api/v1/billing/license?tenantId=tenant-professional'
    );
    const { body } = await post<{ valid: boolean }>(
      ctx.baseUrl,
      '/api/v1/billing/license/validate',
      { key: licData.body.key, tenantId: 'tenant-community' }
    );
    expect(body.valid).toBe(false);
  });

  it('returns 400 when key or tenantId missing', async () => {
    const { status } = await post(ctx.baseUrl, '/api/v1/billing/license/validate', {
      key: 'only-key',
    });
    expect(status).toBe(400);
  });
});

// ─── Customer Portal ──────────────────────────────────────────────────────────

describe('GET /api/v1/billing/customer-portal', () => {
  it('returns a portal URL for paid tenant', async () => {
    const { status, body } = await get<{ url: string; tenantId: string }>(
      ctx.baseUrl,
      '/api/v1/billing/customer-portal?tenantId=tenant-professional'
    );
    expect(status).toBe(200);
    expect(body.url).toMatch(/^https:\/\/billing\.stripe\.com/);
    expect(body.tenantId).toBe('tenant-professional');
  });

  it('returns 403 for community (free) tenant', async () => {
    const { status } = await get(
      ctx.baseUrl,
      '/api/v1/billing/customer-portal?tenantId=tenant-community'
    );
    expect(status).toBe(403);
  });
});

describe('POST /api/v1/billing/checkout', () => {
  it('creates a checkout session', async () => {
    const { status, body } = await post<{ id: string; url: string; planSlug: string }>(
      ctx.baseUrl,
      '/api/v1/billing/checkout?tenantId=tenant-community',
      { planSlug: 'professional', billingCycle: 'monthly' }
    );
    expect(status).toBe(201);
    expect(body.id).toMatch(/^cs_demo_/);
    expect(body.url).toMatch(/checkout\.stripe\.com/);
    expect(body.planSlug).toBe('professional');
  });

  it('returns 400 when planSlug missing', async () => {
    const { status } = await post(
      ctx.baseUrl,
      '/api/v1/billing/checkout?tenantId=tenant-community',
      {}
    );
    expect(status).toBe(400);
  });
});

// ─── Stripe Webhooks ──────────────────────────────────────────────────────────

describe('POST /api/v1/billing/webhooks/stripe', () => {
  it('acknowledges invoice.paid event', async () => {
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
      }
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
      }
    );
    expect(status).toBe(200);
    expect(body.received).toBe(true);
  });

  it('handles subscription.deleted and cancels', async () => {
    // Use the mutation tenant (already upgraded and downgraded in earlier tests)
    const tenantId = MUTATION_TENANT;
    const { status } = await post(ctx.baseUrl, '/api/v1/billing/webhooks/stripe', {
      id: 'evt_test_003',
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_mut_001', metadata: { tenantId } },
      },
    });
    expect(status).toBe(200);
  });

  it('returns 400 for invalid payload', async () => {
    const { status } = await post(ctx.baseUrl, '/api/v1/billing/webhooks/stripe', {
      invalid: true,
    });
    expect(status).toBe(400);
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/admin/dashboard', () => {
  it('returns MRR, ARR, and customer counts', async () => {
    const { status, body } = await get<{
      mrr: number;
      arr: number;
      activeCustomers: number;
      communityUsers: number;
      revenueByPlan: Record<string, number>;
    }>(ctx.baseUrl, '/api/v1/billing/admin/dashboard');
    expect(status).toBe(200);
    expect(body.mrr).toBeGreaterThan(0);
    expect(body.arr).toBe(body.mrr * 12);
    expect(body.activeCustomers).toBeGreaterThan(0);
    expect(body.revenueByPlan).toBeDefined();
  });

  it('MRR includes enterprise yearly contribution', async () => {
    const { body } = await get<{ revenueByPlan: { enterprise: number } }>(
      ctx.baseUrl,
      '/api/v1/billing/admin/dashboard'
    );
    expect(body.revenueByPlan.enterprise).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/billing/admin/subscriptions', () => {
  it('returns all seeded subscriptions', async () => {
    const { status, body } = await get<{ total: number; items: unknown[] }>(
      ctx.baseUrl,
      '/api/v1/billing/admin/subscriptions'
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });
});

describe('GET /api/v1/billing/admin/invoices', () => {
  it('returns all invoices', async () => {
    const { status, body } = await get<{ total: number }>(
      ctx.baseUrl,
      '/api/v1/billing/admin/invoices'
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
  });

  it('filters by status=paid', async () => {
    const { body } = await get<{ items: Array<{ status: string }> }>(
      ctx.baseUrl,
      '/api/v1/billing/admin/invoices?status=paid'
    );
    expect(body.items.every((i) => i.status === 'paid')).toBe(true);
  });
});
