import type { Router } from '../../../http/router.js';
import { registerErpMetadataDiscoverRoute } from './discover.js';
import { registerErpMetadataRuntimeRoutes } from './runtime.js';
import { registerErpMetadataSchemaRoutes } from './schema.js';
import { registerErpMetadataAdminRoutes } from './admin.js';

export function registerErpMetadataRoutes(router: Router): void {
  registerErpMetadataDiscoverRoute(router);
  registerErpMetadataRuntimeRoutes(router);
  registerErpMetadataSchemaRoutes(router);
  registerErpMetadataAdminRoutes(router);
}
