import type { Router } from '../../../http/router.js';
import { getDashboard, getHealth } from './dashboard.js';
import { getMetrics, getHeatmap, streamEvents } from './metrics-routes.js';
import {
  listAlertRules,
  getAlertRule,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  listAlerts,
  acknowledgeAlert,
} from './alerts.js';
import { listIncidents, getIncident, createIncident, updateIncidentStatus } from './incidents.js';
import { listAuditLogs, createAuditLog } from './audit.js';
import { listSLAs, getSLA, createSLA, updateSLA, listSLAEvents } from './sla.js';
import { getTimeline } from './timeline.js';

export function registerObservatoryRoutes(router: Router): void {
  // Dashboard & Health
  router.get('/api/v1/observatory/dashboard', getDashboard);
  router.get('/api/v1/observatory/health', getHealth);

  // Metrics & Heatmap
  router.get('/api/v1/observatory/metrics', getMetrics);
  router.get('/api/v1/observatory/heatmap', getHeatmap);

  // SSE stream
  router.get('/api/v1/observatory/events/stream', streamEvents);

  // Alert Rules
  router.get('/api/v1/observatory/alert-rules', listAlertRules);
  router.get('/api/v1/observatory/alert-rules/:id', getAlertRule);
  router.post('/api/v1/observatory/alert-rules', createAlertRule);
  router.put('/api/v1/observatory/alert-rules/:id', updateAlertRule);
  router.delete('/api/v1/observatory/alert-rules/:id', deleteAlertRule);

  // Alerts
  router.get('/api/v1/observatory/alerts', listAlerts);
  router.post('/api/v1/observatory/alerts/:id/acknowledge', acknowledgeAlert);

  // Incidents
  router.get('/api/v1/observatory/incidents', listIncidents);
  router.get('/api/v1/observatory/incidents/:id', getIncident);
  router.post('/api/v1/observatory/incidents', createIncident);
  router.post('/api/v1/observatory/incidents/:id/status', updateIncidentStatus);

  // Audit Trail
  router.get('/api/v1/observatory/audit', listAuditLogs);
  router.post('/api/v1/observatory/audit', createAuditLog);

  // SLA
  router.get('/api/v1/observatory/sla', listSLAs);
  router.get('/api/v1/observatory/sla/:id', getSLA);
  router.post('/api/v1/observatory/sla', createSLA);
  router.put('/api/v1/observatory/sla/:id', updateSLA);
  router.get('/api/v1/observatory/sla-events', listSLAEvents);

  // Timeline
  router.get('/api/v1/observatory/timeline', getTimeline);
}
