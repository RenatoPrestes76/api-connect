import type { Router } from '../../../http/router.js';
import { registerErpConnectivityProfileRoutes } from './profiles.js';
import { registerErpConnectivityRuntimeRoutes } from './runtime.js';

export function registerErpConnectivityRoutes(router: Router): void {
  registerErpConnectivityProfileRoutes(router);
  registerErpConnectivityRuntimeRoutes(router);
}
