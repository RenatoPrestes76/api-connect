import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { queryPlannerStore } from '../../../modules/query-planner/query-planner-store.js';
import type { QueryIntentInput } from '../../../modules/query-planner/types.js';

/** POST /query-planner/plan — validates an intent against the org's Canonical Business Model and, if valid, persists it as a QueryPlan. No SQL is generated here — that's Sprint 46.13. */
export function registerQueryPlannerPlanRoute(router: Router): void {
  router.post(
    '/query-planner/plan',
    requirePermission('query-planner.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as QueryIntentInput | undefined) ?? {};
      if (!body.organizationId) {
        return apiError(res, 'organizationId is required', 422, 'VALIDATION_ERROR');
      }

      const actorEmail = ctx.adminEmail ?? 'unknown';
      const result = await queryPlannerStore.createPlan(body, body.organizationId, actorEmail);
      if (!result.ok) {
        return json(res, { valid: false, errors: result.errors }, 422);
      }

      adminIdentityStore.recordAudit({
        action: 'QUERY_PLAN_CREATED',
        actorEmail,
        target: result.plan.id,
        metadata: {
          organizationId: result.plan.organizationId,
          rootEntity: result.plan.rootEntity,
          canonicalVersion: result.plan.canonicalVersion,
        },
      });
      json(res, { plan: result.plan }, 201);
    })
  );
}
