import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { prometheusStore } from '../../../modules/prometheus/prometheus-store.js';

export function registerIncidentRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/prometheus/anomalies', (ctx: RouteContext, res: ServerResponse) => {
    const severity = ctx.query.get('severity') ?? undefined;
    const status = ctx.query.get('status') ?? undefined;
    const anomalies = prometheusStore.getAnomalies({ severity, status });
    json(res, { anomalies, total: anomalies.length });
  });

  router.get('/api/v1/prometheus/incidents', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') ?? undefined;
    const severity = ctx.query.get('severity') ?? undefined;
    const incidents = prometheusStore.getIncidents({ status, severity });
    json(res, { incidents, total: incidents.length });
  });

  router.get(
    '/api/v1/prometheus/incidents/:id/timeline',
    (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const incident = prometheusStore.getIncidentById(id);
      if (!incident) return apiError(res, 'Incident not found', 404, 'INCIDENT_NOT_FOUND');
      const sorted = [...incident.timeline].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      json(res, { incidentId: id, timeline: sorted, total: sorted.length });
    }
  );

  router.get('/api/v1/prometheus/incidents/:id/rca', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params?.id as string;
    const incident = prometheusStore.getIncidentById(id);
    if (!incident) return apiError(res, 'Incident not found', 404, 'INCIDENT_NOT_FOUND');
    const sorted = [...incident.rca].sort((a, b) => b.confidence - a.confidence);
    json(res, { incidentId: id, hypotheses: sorted, total: sorted.length });
  });

  router.post(
    '/api/v1/prometheus/incidents/:id/resolve',
    (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const result = prometheusStore.resolveIncident(id);
      if (result === null) return apiError(res, 'Incident not found', 404, 'INCIDENT_NOT_FOUND');
      if (result === 'already_resolved')
        return apiError(res, 'Incident is already resolved', 400, 'ALREADY_RESOLVED');
      json(res, result);
    }
  );
}
