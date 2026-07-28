import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { queryPlannerStore } from '../../../modules/query-planner/query-planner-store.js';
import type { QueryIntentInput } from '../../../modules/query-planner/types.js';

/** POST /query-planner/validate — dry-run: resolves+validates an intent against the org's CBM without persisting anything. */
export function registerQueryPlannerValidateRoute(router: Router): void {
  router.post(
    '/query-planner/validate',
    requirePermission('query-planner.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as QueryIntentInput | undefined) ?? {};
      if (!body.organizationId) {
        return apiError(res, 'organizationId is required', 422, 'VALIDATION_ERROR');
      }

      const result = await queryPlannerStore.validate(
        body,
        body.organizationId,
        ctx.adminEmail ?? 'unknown'
      );
      if (!result.ok) {
        return json(res, { valid: false, errors: result.errors }, 422);
      }
      json(res, { valid: true, resolved: result.resolved });
    })
  );
}
