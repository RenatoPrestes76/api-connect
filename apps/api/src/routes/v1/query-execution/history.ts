import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { queryExecutionStore } from '../../../modules/query-execution/query-execution-store.js';

/** GET /query-execution/history?organizationId=&limit=&offset= — every execution this organization has ever requested, newest first. */
export function registerQueryExecutionHistoryRoute(router: Router): void {
  router.get(
    '/query-execution/history',
    requirePermission('query-execution.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId');
      if (!organizationId) {
        return apiError(res, 'organizationId query parameter is required', 422, 'VALIDATION_ERROR');
      }
      const limit = Number(ctx.query.get('limit') ?? '50');
      const offset = Number(ctx.query.get('offset') ?? '0');
      const { total, executions } = queryExecutionStore.history(organizationId, limit, offset);
      json(res, {
        organizationId,
        total,
        executions: executions.map((e) => queryExecutionStore.toDTO(e)),
      });
    })
  );
}
