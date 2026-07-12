import { registerPoliciesRoutes } from './policies.js';
import { registerAuditRoutes } from './audit.js';
import { registerComplianceRoutes } from './compliance.js';
import { registerRiskRoutes } from './risk.js';
import { registerChangesRoutes } from './changes.js';

export function registerGovernanceRoutes(router: { get: Function; post: Function }): void {
  registerPoliciesRoutes(router);
  registerAuditRoutes(router);
  registerComplianceRoutes(router);
  registerRiskRoutes(router);
  registerChangesRoutes(router);
}
