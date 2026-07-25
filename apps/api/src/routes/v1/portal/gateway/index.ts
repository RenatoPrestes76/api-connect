import { registerGatewayApiKeyRoutes } from './api-keys.js';
import { registerGatewayRateLimitRoutes } from './rate-limits.js';
import { registerGatewaySettingsRoutes } from './settings.js';
import { registerGatewayLogRoutes } from './logs.js';

export function registerGatewayRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
  delete: Function;
}): void {
  registerGatewayApiKeyRoutes(router);
  registerGatewayRateLimitRoutes(router);
  registerGatewaySettingsRoutes(router);
  registerGatewayLogRoutes(router);
}
