import { registerSecretsRoutes } from './secrets.js';
import { registerSecretRotationRoutes } from './rotation.js';
import { registerMfaRoutes } from './mfa.js';
import { registerSsoRoutes } from './sso.js';
import { registerPoliciesRoutes } from './policies.js';
import { registerAuditRoutes } from './audit.js';
import { registerComplianceRoutes } from './compliance.js';
import { registerConsentRoutes } from './consent.js';
import { registerRiskRoutes } from './risk.js';
import { registerCertificatesRoutes } from './certificates.js';
import { registerDashboardRoutes } from './dashboard.js';

export function registerSecurityRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  registerSecretsRoutes(router);
  registerSecretRotationRoutes(router);
  registerMfaRoutes(router);
  registerSsoRoutes(router);
  registerPoliciesRoutes(router);
  registerAuditRoutes(router);
  registerComplianceRoutes(router);
  registerConsentRoutes(router);
  registerRiskRoutes(router);
  registerCertificatesRoutes(router);
  registerDashboardRoutes(router);
}
