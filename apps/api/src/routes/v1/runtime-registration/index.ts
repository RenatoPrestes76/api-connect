import type { Router } from '../../../http/router.js';
import { registerRuntimeHandler } from './register.js';
import { runtimeHeartbeatHandler } from './heartbeat.js';
import { registerRuntimeRegistrationAdminRoutes } from './admin.js';
import { registerRuntimeAuthRoutes } from './auth.js';
import { registerRuntimeConfigRoute } from './config.js';

export function registerRuntimeRegistrationRoutes(router: Router): void {
  router.post('/runtime/register', registerRuntimeHandler);
  router.post('/runtime/heartbeat', runtimeHeartbeatHandler);
  registerRuntimeRegistrationAdminRoutes(router);
  registerRuntimeAuthRoutes(router);
  registerRuntimeConfigRoute(router);
}
