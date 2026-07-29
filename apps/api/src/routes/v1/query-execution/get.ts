import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { queryExecutionStore } from '../../../modules/query-execution/query-execution-store.js';

/** GET /query-execution/:id?organizationId=&page=&pageSize= — status + (once COMPLETED) a page of the stored result, without re-executing. */
export function registerQueryExecutionGetRoute(router: Router): void {
  router.get(
    '/query-execution/:id',
    requirePermission('query-execution.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId');
      if (!organizationId) {
        return apiError(res, 'organizationId query parameter is required', 422, 'VALIDATION_ERROR');
      }
      const execution = queryExecutionStore.getById(ctx.params['id'] as string);
      if (!execution || execution.organizationId !== organizationId) {
        return apiError(res, 'Execution not found', 404, 'NOT_FOUND');
      }

      const page = Number(ctx.query.get('page') ?? '1');
      const pageSize = Number(ctx.query.get('pageSize') ?? '100');
      const result = queryExecutionStore.getResultPage(execution, page, pageSize);

      json(res, { execution: queryExecutionStore.toDTO(execution), result });
    })
  );
}
