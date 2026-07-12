import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { PLANS } from '@seltriva/billing';
import type { PlanSlug } from '@seltriva/billing';

// GET /api/v1/billing/plans
export async function listPlans(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, { plans: PLANS });
}

// GET /api/v1/billing/plans/:slug
export async function getPlanBySlug(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const slug = ctx.params['slug'] as PlanSlug;
  const plan = PLANS.find((p) => p.slug === slug);
  if (!plan) {
    apiError(res, `Plan '${slug}' not found`, 404, 'NOT_FOUND');
    return;
  }
  json(res, plan);
}
