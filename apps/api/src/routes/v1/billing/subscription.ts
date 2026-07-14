import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { billingStore } from '../../../modules/billing/billing-store.js';
import { PLANS } from '@seltriva/billing';
import type { PlanSlug, BillingCycle } from '@seltriva/billing';

// GET /api/v1/billing/subscription
export async function getSubscription(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireTenantId(ctx);
  const sub = billingStore.getSubscription(tenantId);
  if (!sub) {
    apiError(res, 'No subscription found', 404, 'NOT_FOUND');
    return;
  }
  const plan = PLANS.find((p) => p.slug === sub.planSlug);
  json(res, { subscription: sub, plan });
}

// POST /api/v1/billing/upgrade
export async function upgradePlan(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireTenantId(ctx);
  const body = ctx.body as { planSlug?: PlanSlug; billingCycle?: BillingCycle } | undefined;

  if (!body?.planSlug) {
    apiError(res, 'planSlug is required', 400, 'VALIDATION_ERROR');
    return;
  }

  const targetPlan = PLANS.find((p) => p.slug === body.planSlug);
  if (!targetPlan) {
    apiError(res, `Plan '${body.planSlug}' not found`, 404, 'NOT_FOUND');
    return;
  }

  const currentSub = billingStore.getSubscription(tenantId);
  if (currentSub) {
    const currentPlan = PLANS.find((p) => p.slug === currentSub.planSlug);
    if (currentPlan && targetPlan.monthlyPrice <= currentPlan.monthlyPrice) {
      apiError(res, 'Target plan is not an upgrade — use /downgrade', 422, 'NOT_AN_UPGRADE');
      return;
    }
  }

  const billingCycle: BillingCycle = body.billingCycle ?? 'monthly';
  const updated = billingStore.changePlan(tenantId, body.planSlug, billingCycle);
  json(res, { subscription: updated, plan: targetPlan }, 200);
}

// POST /api/v1/billing/downgrade
export async function downgradePlan(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireTenantId(ctx);
  const body = ctx.body as { planSlug?: PlanSlug; billingCycle?: BillingCycle } | undefined;

  if (!body?.planSlug) {
    apiError(res, 'planSlug is required', 400, 'VALIDATION_ERROR');
    return;
  }

  const targetPlan = PLANS.find((p) => p.slug === body.planSlug);
  if (!targetPlan) {
    apiError(res, `Plan '${body.planSlug}' not found`, 404, 'NOT_FOUND');
    return;
  }

  const billingCycle: BillingCycle = body.billingCycle ?? 'monthly';
  const updated = billingStore.changePlan(tenantId, body.planSlug, billingCycle);
  json(res, { subscription: updated, plan: targetPlan });
}

// POST /api/v1/billing/cancel
export async function cancelPlan(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireTenantId(ctx);
  try {
    const canceled = billingStore.cancelSubscription(tenantId);
    json(res, {
      subscription: canceled,
      message: 'Subscription canceled. Access remains until end of billing period.',
    });
  } catch {
    apiError(res, 'No active subscription found', 404, 'NOT_FOUND');
  }
}
