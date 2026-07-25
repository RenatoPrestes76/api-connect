import { registerConnectorRoutes } from './connectors.js';
import { registerConnectorVersionRoutes } from './versions.js';
import { registerConnectorParameterRoutes } from './parameters.js';
import { registerConnectorTemplateRoutes } from './templates.js';

import type { Router } from '../../../http/router.js';
export function registerConnectorRegistryRoutes(router: Router): void {
  registerConnectorRoutes(router);
  registerConnectorVersionRoutes(router);
  registerConnectorParameterRoutes(router);
  registerConnectorTemplateRoutes(router);
}
