import { registerHealthRoutes } from './health.js';
import { registerDashboardRoutes } from './dashboard.js';
import { registerQueuesRoutes } from './queues.js';
import { registerFeatureFlagsRoutes } from './feature-flags.js';
import { registerSloRoutes } from './slo.js';
import { registerDrRoutes } from './dr.js';
import { registerCircuitBreakersRoutes } from './circuit-breakers.js';

export function registerOpsRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  registerHealthRoutes(router);
  registerDashboardRoutes(router);
  registerQueuesRoutes(router);
  registerFeatureFlagsRoutes(router);
  registerSloRoutes(router);
  registerDrRoutes(router);
  registerCircuitBreakersRoutes(router);
}
