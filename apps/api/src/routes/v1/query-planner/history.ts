import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { queryPlannerStore } from '../../../modules/query-planner/query-planner-store.js';

/** GET /query-planner/history?organizationId=&limit=&offset= — every plan this organization has ever built, newest first. */
export function registerQueryPlannerHistoryRoute(router: Router): void {
  router.get(
    '/query-planner/history',
    requirePermission('query-planner.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId');
      if (!organizationId) {
        return apiError(res, 'organizationId query parameter is required', 422, 'VALIDATION_ERROR');
      }
      const limitParam = ctx.query.get('limit');
      const offsetParam = ctx.query.get('offset');
      const limit = limitParam ? Number(limitParam) : 50;
      const offset = offsetParam ? Number(offsetParam) : 0;
      const { total, plans } = queryPlannerStore.history(organizationId, limit, offset);
      json(res, { organizationId, total, plans });
    })
  );
}
