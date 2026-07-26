import type { Router } from '../../../http/router.js';
import { registerConnectorManagementCatalogRoutes } from './connectors.js';
import { registerConnectorAssignRoute } from './assign.js';
import { registerConnectorRuntimeRoutes } from './runtime.js';

export function registerConnectorManagementRoutes(router: Router): void {
  registerConnectorManagementCatalogRoutes(router);
  registerConnectorAssignRoute(router);
  registerConnectorRuntimeRoutes(router);
}
