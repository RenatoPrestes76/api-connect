import type { Router } from '../../../http/router.js';
import { registerCanonicalModelBuildRoute } from './build.js';
import { registerCanonicalModelEntitiesRoute } from './entities.js';
import { registerCanonicalModelFieldsRoute } from './fields.js';
import { registerCanonicalModelApproveRoute } from './approve.js';
import { registerCanonicalModelRollbackRoute } from './rollback.js';
import { registerCanonicalModelGetRoute } from './get.js';

export function registerCanonicalModelRoutes(router: Router): void {
  registerCanonicalModelBuildRoute(router);
  // Literal GET paths (/entities, /fields) must be registered before the
  // dynamic GET /canonical-model/:organizationId — both are single-segment
  // GET routes and this router matches in registration order, so the
  // dynamic route would otherwise swallow them by binding "entities"/
  // "fields" as an organizationId.
  registerCanonicalModelEntitiesRoute(router);
  registerCanonicalModelFieldsRoute(router);
  registerCanonicalModelApproveRoute(router);
  registerCanonicalModelRollbackRoute(router);
  registerCanonicalModelGetRoute(router);
}
