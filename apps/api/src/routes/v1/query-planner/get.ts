import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { queryPlannerStore } from '../../../modules/query-planner/query-planner-store.js';

/** GET /query-planner/:id?organizationId= — organizationId is required and must match the plan's owner, so a foreign plan id 404s instead of leaking cross-tenant existence. */
export function registerQueryPlannerGetRoute(router: Router): void {
  router.get(
    '/query-planner/:id',
    requirePermission('query-planner.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId');
      if (!organizationId) {
        return apiError(res, 'organizationId query parameter is required', 422, 'VALIDATION_ERROR');
      }
      const plan = queryPlannerStore.getById(ctx.params['id'] as string);
      if (!plan || plan.organizationId !== organizationId) {
        return apiError(res, 'Query plan not found', 404, 'NOT_FOUND');
      }
      json(res, { plan });
    })
  );
}
