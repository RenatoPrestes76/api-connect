import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { canonicalModelStore } from '../../../modules/canonical-model/canonical-model-store.js';
import { serializeField } from './serialize.js';

const NOT_BUILT_MESSAGE =
  'No canonical model has been built for this organization yet — run POST /canonical-model/build first';

/** GET /canonical-model/fields?organizationId=&entityId= — flattened field list, optionally scoped to one entity. */
export function registerCanonicalModelFieldsRoute(router: Router): void {
  router.get(
    '/canonical-model/fields',
    requirePermission('canonical-model.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId');
      if (!organizationId) {
        return apiError(res, 'organizationId query parameter is required', 422, 'VALIDATION_ERROR');
      }
      const status = ctx.query.get('status') ?? 'approved';
      const model =
        status === 'latest'
          ? await canonicalModelStore.getLatestDraft(organizationId)
          : await canonicalModelStore.getApproved(organizationId);
      if (!model) return apiError(res, NOT_BUILT_MESSAGE, 404, 'NOT_BUILT');

      const entityId = ctx.query.get('entityId');
      const entities = entityId ? model.entities.filter((e) => e.id === entityId) : model.entities;
      if (entityId && entities.length === 0) {
        return apiError(res, `No entity found with id "${entityId}"`, 404, 'NOT_FOUND');
      }

      const fields = entities.flatMap((entity) =>
        entity.fields.map((field) => ({
          entityId: entity.id,
          entitySourceName: entity.sourceName,
          ...serializeField(field),
        }))
      );
      json(res, {
        organizationId,
        modelId: model.id,
        version: model.version,
        total: fields.length,
        fields,
      });
    })
  );
}
