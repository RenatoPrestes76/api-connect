import { registerHealthRoutes } from './health.js';
import { registerDashboardRoutes } from './dashboard.js';
import { registerQueuesRoutes } from './queues.js';
import { registerFeatureFlagsRoutes } from './feature-flags.js';
import { registerSloRoutes } from './slo.js';
import { registerDrRoutes } from './dr.js';
import { registerCircuitBreakersRoutes } from './circuit-breakers.js';

import type { Router } from '../../../http/router.js';
export function registerOpsRoutes(router: Router): void {
  registerHealthRoutes(router);
  registerDashboardRoutes(router);
  registerQueuesRoutes(router);
  registerFeatureFlagsRoutes(router);
  registerSloRoutes(router);
  registerDrRoutes(router);
  registerCircuitBreakersRoutes(router);
}
