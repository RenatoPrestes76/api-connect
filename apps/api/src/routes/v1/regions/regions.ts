import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { regionsStore } from '../../../modules/regions/regions-store.js';
import type { RegionStatus } from '../../../modules/regions/types.js';

const VALID_STATUSES: RegionStatus[] = ['active', 'degraded', 'offline', 'maintenance'];

export function registerRegionListRoutes(router: { get: Function }): void {
  // GET /api/v1/regions
  router.get('/api/v1/regions', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') ?? undefined;
    const continent = ctx.query.get('continent') ?? undefined;

    if (status && !VALID_STATUSES.includes(status as RegionStatus)) {
      return apiError(res, `Invalid status "${status}"`, 400, 'INVALID_STATUS');
    }

    const regions = regionsStore.getRegions({
      status: status as RegionStatus | undefined,
      continent,
    });

    json(res, { total: regions.length, regions });
  });

  // GET /api/v1/regions/status
  router.get('/api/v1/regions/status', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, regionsStore.getStatusSummary());
  });

  // GET /api/v1/regions/health
  router.get('/api/v1/regions/health', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') ?? undefined;
    const continent = ctx.query.get('continent') ?? undefined;

    if (status && !VALID_STATUSES.includes(status as RegionStatus)) {
      return apiError(res, `Invalid status "${status}"`, 400, 'INVALID_STATUS');
    }

    const regions = regionsStore.getRegions({
      status: status as RegionStatus | undefined,
      continent: continent as string | undefined,
    });

    const summary = regionsStore.getStatusSummary();

    json(res, {
      total: summary.total,
      healthy: summary.active,
      degraded: summary.degraded,
      offline: summary.offline,
      globalHealth: summary.globalHealth,
      regions: regions.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        status: r.status,
        location: r.location,
        continent: r.continent,
        latencyMs: r.latencyMs,
        capacityPct: r.capacityPct,
        tenantsCount: r.tenantsCount,
      })),
    });
  });

  // GET /api/v1/regions/nearest?lat=..&lon=.. — real haversine-distance nearest-region selection.
  router.get('/api/v1/regions/nearest', (ctx: RouteContext, res: ServerResponse) => {
    const latParam = ctx.query.get('lat');
    const lonParam = ctx.query.get('lon');
    if (latParam === null || lonParam === null) {
      return apiError(res, '"lat" and "lon" query parameters are required', 400, 'MISSING_FIELDS');
    }
    const lat = Number(latParam);
    const lon = Number(lonParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return apiError(res, '"lat" and "lon" must be numbers', 400, 'INVALID_COORDINATES');
    }

    const activeOnlyParam = ctx.query.get('activeOnly');
    const activeOnly = activeOnlyParam === null ? true : activeOnlyParam !== 'false';

    const ranked = regionsStore.nearestRegions(lat, lon, { activeOnly });
    if (ranked.length === 0) {
      return apiError(res, 'No eligible region found', 404, 'NO_ELIGIBLE_REGION');
    }
    json(res, { nearest: ranked[0], ranked });
  });
}
