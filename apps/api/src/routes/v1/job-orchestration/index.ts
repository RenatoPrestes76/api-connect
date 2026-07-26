import type { Router } from '../../../http/router.js';
import { registerJobRoutes } from './jobs.js';
import { registerJobResultRoute } from './result.js';
import { registerRuntimeJobsRoute } from './runtime-jobs.js';

export function registerJobOrchestrationRoutes(router: Router): void {
  registerJobRoutes(router);
  registerJobResultRoute(router);
  registerRuntimeJobsRoute(router);
}
