import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { semanticMappingStore } from '../../../modules/semantic-mapping/semantic-mapping-store.js';

function requireProfileId(ctx: RouteContext, res: ServerResponse): string | null {
  const profileId = ctx.query.get('profileId');
  if (!profileId) {
    apiError(res, 'profileId query parameter is required', 422, 'VALIDATION_ERROR');
    return null;
  }
  return profileId;
}

/** GET /semantic-mapping/entities — the current business model for a profile (approved + pending). */
export function registerSemanticMappingEntitiesRoute(router: Router): void {
  router.get(
    '/semantic-mapping/entities',
    requirePermission('semantic-mapping.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const profileId = requireProfileId(ctx, res);
      if (!profileId) return;

      const records = semanticMappingStore.listEntities(profileId);
      json(res, {
        profileId,
        total: records.length,
        entities: records.map((r) => semanticMappingStore.toDTO(r)),
      });
    })
  );
}
