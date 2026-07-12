import { registerTelemetryRoutes } from './telemetry.js';
import { registerDashboardRoutes } from './dashboards.js';
import { registerIncidentRoutes } from './incidents.js';
import { registerRecommendationRoutes } from './recommendations.js';
import { registerHealingRoutes } from './healing.js';
import { registerSLORoutes } from './slo.js';
import { registerCapacityRoutes } from './capacity.js';
import { registerRunbookRoutes } from './runbooks.js';
import { registerCopilotRoutes } from './copilot.js';

export function registerPrometheusRoutes(router: { get: Function; post: Function }): void {
  registerTelemetryRoutes(router);
  registerDashboardRoutes(router);
  registerIncidentRoutes(router);
  registerRecommendationRoutes(router);
  registerHealingRoutes(router);
  registerSLORoutes(router);
  registerCapacityRoutes(router);
  registerRunbookRoutes(router);
  registerCopilotRoutes(router);
}
