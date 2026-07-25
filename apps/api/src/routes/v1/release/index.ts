import { registerChecklistRoutes } from './checklist.js';
import { registerVersionRoutes } from './versions.js';
import { registerChangelogRoutes } from './changelog.js';
import { registerSBOMRoutes } from './sbom.js';
import { registerGoLiveMetricsRoutes } from './metrics.js';

import type { Router } from '../../../http/router.js';
export function registerReleaseRoutes(router: Router): void {
  registerChecklistRoutes(router);
  registerVersionRoutes(router);
  registerChangelogRoutes(router);
  registerSBOMRoutes(router);
  registerGoLiveMetricsRoutes(router);
}
