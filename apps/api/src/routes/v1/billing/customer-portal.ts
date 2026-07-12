import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { billingStore } from '../../../modules/billing/billing-store.js';
import { stripeSimulation } from '../../../modules/billing/stripe-simulation.js';

function resolveTenant(ctx: RouteContext): string {
  const header = ctx.headers?.['x-tenant-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader ?? ctx.query.get('tenantId') ?? 'tenant-professional';
}

// GET /api/v1/billing/customer-portal
export async function getCustomerPortal(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = resolveTenant(ctx);
  const sub = billingStore.getSubscription(tenantId);
  if (!sub || sub.planSlug === 'community') {
    apiError(res, 'Customer portal is only available for paid plans', 403, 'FORBIDDEN');
    return;
  }
  const session = stripeSimulation.createCustomerPortalSession(tenantId);
  json(res, session);
}

// POST /api/v1/billing/checkout
export async function createCheckout(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = resolveTenant(ctx);
  const body = ctx.body as { planSlug?: string; billingCycle?: string } | undefined;

  if (!body?.planSlug) {
    apiError(res, 'planSlug is required', 400, 'VALIDATION_ERROR');
    return;
  }

  const planSlug = body.planSlug as Parameters<typeof stripeSimulation.createCheckoutSession>[1];
  const billingCycle = (body.billingCycle ?? 'monthly') as Parameters<
    typeof stripeSimulation.createCheckoutSession
  >[2];

  const session = stripeSimulation.createCheckoutSession(tenantId, planSlug, billingCycle);
  json(res, session, 201);
}
