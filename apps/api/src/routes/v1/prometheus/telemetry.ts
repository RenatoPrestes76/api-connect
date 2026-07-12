import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { prometheusStore } from '../../../modules/prometheus/prometheus-store.js';
import { parseLimit } from './util.js';

export function registerTelemetryRoutes(router: { get: Function }): void {
  router.get('/api/v1/telemetry/overview', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, prometheusStore.getTelemetryOverview());
  });

  router.get('/api/v1/telemetry/traces', (ctx: RouteContext, res: ServerResponse) => {
    const service = ctx.query.get('service') ?? undefined;
    const status = ctx.query.get('status') ?? undefined;
    const limit = ctx.query.get('limit') ? parseLimit(ctx.query.get('limit'), 50) : undefined;

    const traces = prometheusStore.getTraces({ service, status, limit });
    json(res, { traces, total: traces.length });
  });

  router.get('/api/v1/telemetry/traces/:id', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params?.id as string;
    const trace = prometheusStore.getTraceById(id);
    if (!trace) return apiError(res, 'Trace not found', 404, 'TRACE_NOT_FOUND');
    json(res, trace);
  });

  router.get('/api/v1/telemetry/service-map', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, prometheusStore.getServiceMap());
  });
}
