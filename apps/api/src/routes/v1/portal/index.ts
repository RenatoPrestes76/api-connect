import { registerPortalDashboardRoutes } from './dashboard.js';
import { registerSupportRoutes } from './support.js';
import { registerApiKeysRoutes } from './api-keys.js';
import { registerPortalConnectorRoutes } from './connectors.js';
import { registerPortalUsersRoutes } from './users.js';

export function registerPortalRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  registerPortalDashboardRoutes(router);
  registerSupportRoutes(router);
  registerApiKeysRoutes(router);
  registerPortalConnectorRoutes(router);
  registerPortalUsersRoutes(router);
}
