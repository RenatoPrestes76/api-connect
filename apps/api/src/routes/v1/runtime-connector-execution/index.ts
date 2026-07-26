import type { Router } from '../../../http/router.js';
import { registerConnectorExecuteRoute } from './execute.js';
import { registerConnectorRuntimeRoutes } from './runtime.js';
import { registerConnectorExecutionAdminRoutes } from './admin.js';

export function registerRuntimeConnectorExecutionRoutes(router: Router): void {
  registerConnectorExecuteRoute(router);
  registerConnectorRuntimeRoutes(router);
  registerConnectorExecutionAdminRoutes(router);
}
