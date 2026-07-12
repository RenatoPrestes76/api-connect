import { registerOperationsOverviewRoute } from './overview.js';
import { registerOperationsHealthRoute } from './health.js';
import { registerOperationsAlertsRoutes } from './alerts.js';
import { registerOperationsEventsRoute } from './events.js';
import { registerOperationsMetricsRoute } from './metrics.js';
import { registerOperationsSlaRoute } from './sla.js';
import { registerOperationsActionsRoutes } from './actions.js';

export function registerOperationsRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
}): void {
  registerOperationsOverviewRoute(router);
  registerOperationsHealthRoute(router);
  registerOperationsAlertsRoutes(router);
  registerOperationsEventsRoute(router);
  registerOperationsMetricsRoute(router);
  registerOperationsSlaRoute(router);
  registerOperationsActionsRoutes(router);
}
