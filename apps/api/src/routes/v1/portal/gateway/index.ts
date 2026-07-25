import { registerGatewayApiKeyRoutes } from './api-keys.js';
import { registerGatewayRateLimitRoutes } from './rate-limits.js';
import { registerGatewaySettingsRoutes } from './settings.js';
import { registerGatewayLogRoutes } from './logs.js';

import type { Router } from '../../../../http/router.js';
export function registerGatewayRoutes(router: Router): void {
  registerGatewayApiKeyRoutes(router);
  registerGatewayRateLimitRoutes(router);
  registerGatewaySettingsRoutes(router);
  registerGatewayLogRoutes(router);
}
