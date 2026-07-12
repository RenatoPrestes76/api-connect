import { registerBusRoutes } from './bus.js';
import { registerAnalyticsRoutes } from './analytics.js';
import { registerCatalogRoutes } from './catalog.js';
import { registerSchemaRoutes } from './schema.js';
import { registerReplayRoutes } from './replay.js';
import { registerDLQRoutes } from './dlq.js';
import { registerEventSecurityRoutes } from './security.js';
import { registerEventGovernanceRoutes } from './governance.js';
import { registerEventAIRoutes } from './ai.js';
import { registerStudioRoutes } from './studio.js';

export function registerHeliosRoutes(router: { get: Function; post: Function }): void {
  registerBusRoutes(router);
  registerAnalyticsRoutes(router);
  registerCatalogRoutes(router);
  registerSchemaRoutes(router);
  registerReplayRoutes(router);
  registerDLQRoutes(router);
  registerEventSecurityRoutes(router);
  registerEventGovernanceRoutes(router);
  registerEventAIRoutes(router);
  registerStudioRoutes(router);
}
