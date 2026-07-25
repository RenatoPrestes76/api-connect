import { registerTenantRoutes } from './tenants.js';
import { registerOrganizationRoutes } from './organizations.js';
import { registerProjectRoutes } from './projects.js';
import { registerEnvironmentRoutes } from './environments.js';
import { registerRuntimeRoutes } from './runtimes.js';
import { registerConnectorRoutes } from './connectors.js';
import { registerDeploymentRoutes } from './deployments.js';
import { registerFeatureFlagRoutes } from './feature-flags.js';
import { registerDashboardRoutes } from './dashboard.js';
import {
  registerErpIntegrationRoutes,
  type ErpIntegrationInfrastructureDeps,
} from './erp-integrations.js';
import { ErpIntegrationRepository } from '../../../modules/erp-integration/erp-integration-repository.js';
import { prisma } from '../../../services/prisma.js';
import { OrganizationService } from '../../../services/organization.service.js';

import type { Router } from '../../../http/router.js';
export function registerControlPlaneRoutes(
  router: Router,
  erpIntegrationDeps?: ErpIntegrationInfrastructureDeps
): void {
  registerTenantRoutes(router);
  registerOrganizationRoutes(router);
  registerProjectRoutes(router);
  registerEnvironmentRoutes(router);
  registerRuntimeRoutes(router);
  registerConnectorRoutes(router);
  registerDeploymentRoutes(router);
  registerFeatureFlagRoutes(router);
  registerDashboardRoutes(router);
  registerErpIntegrationRoutes(
    router,
    erpIntegrationDeps ?? {
      erpIntegrationRepository: new ErpIntegrationRepository(prisma.erpIntegration),
      organizationExists: async (organizationId: string) =>
        (await OrganizationService.findById(organizationId)) !== null,
    }
  );
}
