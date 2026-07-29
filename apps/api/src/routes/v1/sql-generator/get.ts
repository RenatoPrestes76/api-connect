import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { sqlGeneratorStore } from '../../../modules/sql-generator/sql-generator-store.js';

/** GET /sql-generator/:id?organizationId= — organizationId is required and must match the record's owner, so a foreign id 404s instead of leaking cross-tenant existence. */
export function registerSqlGeneratorGetRoute(router: Router): void {
  router.get(
    '/sql-generator/:id',
    requirePermission('sql-generator.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId');
      if (!organizationId) {
        return apiError(res, 'organizationId query parameter is required', 422, 'VALIDATION_ERROR');
      }
      const query = sqlGeneratorStore.getById(ctx.params['id'] as string);
      if (!query || query.organizationId !== organizationId) {
        return apiError(res, 'Generated query not found', 404, 'NOT_FOUND');
      }
      json(res, { query });
    })
  );
}
