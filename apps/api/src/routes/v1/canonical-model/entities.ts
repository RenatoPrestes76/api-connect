import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { canonicalModelStore } from '../../../modules/canonical-model/canonical-model-store.js';
import { serializeEntity } from './serialize.js';
import { parseQuery } from '../../../http/validation.js';
import { ModelStatusQuerySchema } from './schemas.js';

const NOT_BUILT_MESSAGE =
  'No canonical model has been built for this organization yet — run POST /canonical-model/build first';

/** GET /canonical-model/entities?organizationId= — flattened entity list from the org's approved canonical model. */
export function registerCanonicalModelEntitiesRoute(router: Router): void {
  router.get(
    '/canonical-model/entities',
    requirePermission('canonical-model.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const query = parseQuery(ModelStatusQuerySchema, ctx, res);
      if (!query) return;
      const { organizationId } = query;
      const status = query.status ?? 'approved';
      const model =
        status === 'latest'
          ? await canonicalModelStore.getLatestDraft(organizationId)
          : await canonicalModelStore.getApproved(organizationId);
      if (!model) return apiError(res, NOT_BUILT_MESSAGE, 404, 'NOT_BUILT');

      json(res, {
        organizationId,
        modelId: model.id,
        version: model.version,
        total: model.entities.length,
        entities: model.entities.map(serializeEntity),
      });
    })
  );
}
