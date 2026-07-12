import { registerFleetDashboardRoutes } from './dashboard.js';
import { registerRuntimeOpsRoutes } from './runtime-ops.js';
import { registerConnectorOpsRoutes } from './connector-ops.js';
import { registerDeploymentJobRoutes } from './deployment-jobs.js';
import { registerAlertRoutes } from './alerts.js';
import { registerNotificationRoutes } from './notifications.js';
import { registerFleetAuditRoutes } from './audit.js';
import { registerAutoscalerRoutes } from './autoscaler.js';

export function registerFleetRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
  delete: Function;
}): void {
  registerFleetDashboardRoutes(router);
  registerRuntimeOpsRoutes(router);
  registerConnectorOpsRoutes(router);
  registerDeploymentJobRoutes(router);
  registerAlertRoutes(router);
  registerNotificationRoutes(router);
  registerFleetAuditRoutes(router);
  registerAutoscalerRoutes(router);
}
