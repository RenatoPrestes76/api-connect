import { registerRegionListRoutes } from './regions.js';
import { registerGlobalRoutes } from './global.js';
import { registerRegionActionRoutes } from './actions.js';

export function registerRegionsRoutes(router: { get: Function; post: Function }): void {
  registerRegionListRoutes(router);
  registerGlobalRoutes(router);
  registerRegionActionRoutes(router);
}
