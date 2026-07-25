import { registerOperationsOverviewRoute } from './overview.js';
import { registerOperationsHealthRoute } from './health.js';
import { registerOperationsAlertsRoutes } from './alerts.js';
import { registerOperationsEventsRoute } from './events.js';
import { registerOperationsMetricsRoute } from './metrics.js';
import { registerOperationsSlaRoute } from './sla.js';
import { registerOperationsActionsRoutes } from './actions.js';

import type { Router } from '../../../http/router.js';
export function registerOperationsRoutes(router: Router): void {
  registerOperationsOverviewRoute(router);
  registerOperationsHealthRoute(router);
  registerOperationsAlertsRoutes(router);
  registerOperationsEventsRoute(router);
  registerOperationsMetricsRoute(router);
  registerOperationsSlaRoute(router);
  registerOperationsActionsRoutes(router);
}
