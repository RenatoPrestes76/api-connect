import { registerFleetDashboardRoutes } from './dashboard.js';
import { registerRuntimeOpsRoutes } from './runtime-ops.js';
import { registerConnectorOpsRoutes } from './connector-ops.js';
import { registerDeploymentJobRoutes } from './deployment-jobs.js';
import { registerAlertRoutes } from './alerts.js';
import { registerNotificationRoutes } from './notifications.js';
import { registerFleetAuditRoutes } from './audit.js';
import { registerAutoscalerRoutes } from './autoscaler.js';

import type { Router } from '../../../http/router.js';
export function registerFleetRoutes(router: Router): void {
  registerFleetDashboardRoutes(router);
  registerRuntimeOpsRoutes(router);
  registerConnectorOpsRoutes(router);
  registerDeploymentJobRoutes(router);
  registerAlertRoutes(router);
  registerNotificationRoutes(router);
  registerFleetAuditRoutes(router);
  registerAutoscalerRoutes(router);
}
