import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { prometheusStore } from '../../../modules/prometheus/prometheus-store.js';
import type { DashboardType } from '../../../modules/prometheus/types.js';

const VALID_TYPES: DashboardType[] = ['executive', 'operations', 'ai', 'connectors'];

export function registerDashboardRoutes(router: { get: Function }): void {
  router.get('/api/v1/prometheus/dashboards/:type', (ctx: RouteContext, res: ServerResponse) => {
    const type = ctx.params?.type as string;
    if (!VALID_TYPES.includes(type as DashboardType)) {
      return apiError(
        res,
        `Invalid dashboard type. Valid: ${VALID_TYPES.join(', ')}`,
        400,
        'INVALID_DASHBOARD_TYPE'
      );
    }
    json(res, prometheusStore.getDashboard(type as DashboardType));
  });
}
