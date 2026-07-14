import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { billingStore } from '../../../modules/billing/billing-store.js';
import { PLANS } from '@seltriva/billing';

// GET /api/v1/billing/usage
export async function getUsage(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireTenantId(ctx);
  const current = billingStore.getCurrentUsage(tenantId);
  if (!current) {
    apiError(res, 'No usage data found for current period', 404, 'NOT_FOUND');
    return;
  }

  const sub = billingStore.getSubscription(tenantId);
  const plan = sub ? PLANS.find((p) => p.slug === sub.planSlug) : undefined;

  const limits = {
    agents: plan?.maxAgents ?? null,
    connectors: plan?.maxConnectors ?? null,
    workflows: plan?.maxWorkflows ?? null,
    users: plan?.maxUsers ?? null,
    aiCredits: plan?.aiCredits ?? null,
  };

  json(res, { usage: current, limits, planSlug: sub?.planSlug ?? 'community' });
}

// GET /api/v1/billing/usage/history
export async function getUsageHistory(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const tenantId = requireTenantId(ctx);
  const records = billingStore.getUsageHistory(tenantId);
  records.sort((a, b) => b.month.localeCompare(a.month));
  json(res, { total: records.length, items: records });
}
