import { registerTenantRoutes } from './tenants.js';
import { registerOrganizationRoutes } from './organizations.js';
import { registerEnvironmentRoutes } from './environments.js';
import { registerRuntimeRoutes } from './runtimes.js';
import { registerConnectorRoutes } from './connectors.js';
import { registerDeploymentRoutes } from './deployments.js';
import { registerFeatureFlagRoutes } from './feature-flags.js';
import { registerDashboardRoutes } from './dashboard.js';

export function registerControlPlaneRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
  delete: Function;
}): void {
  registerTenantRoutes(router);
  registerOrganizationRoutes(router);
  registerEnvironmentRoutes(router);
  registerRuntimeRoutes(router);
  registerConnectorRoutes(router);
  registerDeploymentRoutes(router);
  registerFeatureFlagRoutes(router);
  registerDashboardRoutes(router);
}
