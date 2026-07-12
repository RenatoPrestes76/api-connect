import { registerChecklistRoutes } from './checklist.js';
import { registerVersionRoutes } from './versions.js';
import { registerChangelogRoutes } from './changelog.js';
import { registerSBOMRoutes } from './sbom.js';
import { registerGoLiveMetricsRoutes } from './metrics.js';

export function registerReleaseRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  registerChecklistRoutes(router);
  registerVersionRoutes(router);
  registerChangelogRoutes(router);
  registerSBOMRoutes(router);
  registerGoLiveMetricsRoutes(router);
}
