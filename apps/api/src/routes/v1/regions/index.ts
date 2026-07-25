import { registerRegionListRoutes } from './regions.js';
import { registerGlobalRoutes } from './global.js';
import { registerRegionActionRoutes } from './actions.js';

import type { Router } from '../../../http/router.js';
export function registerRegionsRoutes(router: Router): void {
  registerRegionListRoutes(router);
  registerGlobalRoutes(router);
  registerRegionActionRoutes(router);
}
