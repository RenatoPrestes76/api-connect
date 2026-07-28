import type { Router } from '../../../http/router.js';
import { registerQueryPlannerPlanRoute } from './plan.js';
import { registerQueryPlannerValidateRoute } from './validate.js';
import { registerQueryPlannerHistoryRoute } from './history.js';
import { registerQueryPlannerGetRoute } from './get.js';

export function registerQueryPlannerRoutes(router: Router): void {
  registerQueryPlannerPlanRoute(router);
  registerQueryPlannerValidateRoute(router);
  // GET /query-planner/history must be registered before the dynamic
  // GET /query-planner/:id — both are single-segment GET routes and this
  // router matches in registration order, so :id would otherwise swallow
  // "history" as a plan id.
  registerQueryPlannerHistoryRoute(router);
  registerQueryPlannerGetRoute(router);
}
