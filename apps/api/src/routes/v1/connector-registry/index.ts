import { registerConnectorRoutes } from './connectors.js';
import { registerConnectorVersionRoutes } from './versions.js';
import { registerConnectorParameterRoutes } from './parameters.js';
import { registerConnectorTemplateRoutes } from './templates.js';

export function registerConnectorRegistryRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
  delete: Function;
}): void {
  registerConnectorRoutes(router);
  registerConnectorVersionRoutes(router);
  registerConnectorParameterRoutes(router);
  registerConnectorTemplateRoutes(router);
}
