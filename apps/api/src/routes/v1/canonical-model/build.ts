import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { canonicalModelStore } from '../../../modules/canonical-model/canonical-model-store.js';
import type { BuildError } from '../../../modules/canonical-model/types.js';
import { serializeModel } from './serialize.js';

const BUILD_ERROR_STATUS: Record<BuildError, { status: number; message: string }> = {
  NO_APPROVED_MAPPINGS: {
    status: 404,
    message:
      'No approved semantic mappings were found for this organization — run POST /semantic-mapping/approve on at least one table first',
  },
};

interface BuildBody {
  organizationId?: string;
}

/** POST /canonical-model/build — (re)builds the organization's canonical business model from every connected ERP's approved mappings. */
export function registerCanonicalModelBuildRoute(router: Router): void {
  router.post(
    '/canonical-model/build',
    requirePermission('canonical-model.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as BuildBody | undefined) ?? {};
      if (!body.organizationId) {
        return apiError(res, 'organizationId is required', 422, 'VALIDATION_ERROR');
      }

      const result = await canonicalModelStore.build(body.organizationId);
      if (!result.ok) {
        const mapped = BUILD_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'CANONICAL_MODEL_BUILT',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: `${body.organizationId}:${result.model.id}`,
        metadata: {
          version: result.model.version,
          entities: result.model.statistics.totalEntities,
          profilesConsidered: result.profilesConsidered,
          profilesContributing: result.profilesContributing,
        },
      });
      json(
        res,
        {
          model: serializeModel(result.model),
          profilesConsidered: result.profilesConsidered,
          profilesContributing: result.profilesContributing,
        },
        201
      );
    })
  );
}
