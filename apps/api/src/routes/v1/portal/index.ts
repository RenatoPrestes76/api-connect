import { registerPortalDashboardRoutes } from './dashboard.js';
import { registerSupportRoutes } from './support.js';
import { registerApiKeysRoutes } from './api-keys.js';
import { registerPortalConnectorRoutes } from './connectors.js';
import { registerPortalUsersRoutes } from './users.js';
import { registerPortalAuthRoutes } from './auth.js';
import { registerPortalInviteRoutes } from './invites.js';
import { registerPortalEnvironmentRoutes } from './environments.js';
import { registerPortalOrganizationRoutes } from './organization.js';
import { registerPortalAuditRoutes } from './audit.js';

export function registerPortalRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  patch: Function;
  delete: Function;
}): void {
  registerPortalDashboardRoutes(router);
  registerSupportRoutes(router);
  registerApiKeysRoutes(router);
  registerPortalConnectorRoutes(router);
  registerPortalUsersRoutes(router);
  // Sprint 46.4 — Enterprise Organization Management Foundation
  registerPortalAuthRoutes(router);
  registerPortalInviteRoutes(router);
  registerPortalEnvironmentRoutes(router);
  registerPortalOrganizationRoutes(router);
  registerPortalAuditRoutes(router);
}
