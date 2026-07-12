import { registerSetupStartRoute } from './start.js';
import { registerSetupCompanyRoute } from './company.js';
import { registerSetupAdminRoute } from './admin.js';
import { registerSetupDatabaseRoute } from './database.js';
import { registerSetupConnectorRoute } from './connector.js';
import { registerSetupSecretsRoute } from './secrets.js';
import { registerSetupProvisionRoute } from './provision.js';
import { registerSetupStatusRoute } from './status.js';
import { registerSetupFinishRoute } from './finish.js';

export function registerSetupRoutes(router: { get: Function; post: Function }): void {
  registerSetupStartRoute(router);
  registerSetupCompanyRoute(router);
  registerSetupAdminRoute(router);
  registerSetupDatabaseRoute(router);
  registerSetupConnectorRoute(router);
  registerSetupSecretsRoute(router);
  registerSetupProvisionRoute(router);
  registerSetupStatusRoute(router);
  registerSetupFinishRoute(router);
}
