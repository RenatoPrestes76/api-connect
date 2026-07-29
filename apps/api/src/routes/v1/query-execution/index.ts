import type { Router } from '../../../http/router.js';
import { registerQueryExecutionExecuteRoute } from './execute.js';
import { registerQueryExecutionCancelRoute } from './cancel.js';
import { registerQueryExecutionHistoryRoute } from './history.js';
import { registerQueryExecutionGetRoute } from './get.js';
import { registerQueryExecutionRuntimeRoutes } from './runtime.js';

export function registerQueryExecutionRoutes(router: Router): void {
  registerQueryExecutionExecuteRoute(router);
  registerQueryExecutionCancelRoute(router);
  // GET /query-execution/history must be registered before the dynamic
  // GET /query-execution/:id — both are single-segment GET routes and this
  // router matches in registration order, so :id would otherwise swallow
  // "history" as an execution id.
  registerQueryExecutionHistoryRoute(router);
  registerQueryExecutionGetRoute(router);
  registerQueryExecutionRuntimeRoutes(router);
}
