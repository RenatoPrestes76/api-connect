import type { ServerResponse } from 'node:http';
import type { CanonicalBusinessModel } from '@seltriva/semantic-engine';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { canonicalModelStore } from '../../../modules/canonical-model/canonical-model-store.js';
import { serializeModel, serializeModelSummary } from './serialize.js';

const NOT_BUILT_MESSAGE =
  'No canonical model has been built for this organization yet — run POST /canonical-model/build first';

/**
 * GET /canonical-model/:organizationId — the org's canonical business model.
 * Defaults to the currently *approved* model (what other Atlas modules
 * should treat as authoritative); pass ?status=latest for the most recent
 * build, approved or not (useful for reviewing before approving).
 */
export function registerCanonicalModelGetRoute(router: Router): void {
  router.get(
    '/canonical-model/:organizationId',
    requirePermission('canonical-model.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.params['organizationId'] as string;
      const status = ctx.query.get('status') ?? 'approved';

      let model: CanonicalBusinessModel | null;
      if (status === 'latest') {
        model = await canonicalModelStore.getLatestDraft(organizationId);
      } else if (status === 'approved') {
        model = await canonicalModelStore.getApproved(organizationId);
      } else {
        return apiError(
          res,
          "status must be one of: 'approved', 'latest'",
          422,
          'VALIDATION_ERROR'
        );
      }

      if (!model) return apiError(res, NOT_BUILT_MESSAGE, 404, 'NOT_BUILT');
      json(res, { model: serializeModel(model) });
    })
  );

  router.get(
    '/canonical-model/:organizationId/history',
    requirePermission('canonical-model.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.params['organizationId'] as string;
      const history = await canonicalModelStore.history(organizationId);
      json(res, {
        organizationId,
        total: history.length,
        versions: history.map(serializeModelSummary),
      });
    })
  );
}
