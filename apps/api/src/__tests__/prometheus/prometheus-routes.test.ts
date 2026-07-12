import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, get, post, type TestServer } from './helpers.js';

let srv: TestServer;
beforeAll(async () => {
  srv = await startTestServer();
});
afterAll(async () => {
  await srv.close();
});

const G = (path: string, orgId?: string) => get(srv.baseUrl, path, orgId);
const P = (path: string, data?: unknown, orgId?: string) => post(srv.baseUrl, path, data, orgId);

// ─── Telemetry ───────────────────────────────────────────────────────────────

describe('GET /api/v1/telemetry/overview', () => {
  it('returns overview with correct service counts', async () => {
    const { status, body } = await G('/api/v1/telemetry/overview');
    expect(status).toBe(200);
    expect(body.servicesTotal).toBe(8);
    expect(body.servicesHealthy).toBe(6);
    expect(body.servicesDegraded).toBe(2);
    expect(body.servicesDown).toBe(0);
  });

  it('totalTraces is 10', async () => {
    const { body } = await G('/api/v1/telemetry/overview');
    expect(body.totalTraces).toBe(10);
  });

  it('errorTraces=2 and timeoutTraces=1', async () => {
    const { body } = await G('/api/v1/telemetry/overview');
    expect(body.errorTraces).toBe(2);
    expect(body.timeoutTraces).toBe(1);
  });

  it('activeAlerts is 3', async () => {
    const { body } = await G('/api/v1/telemetry/overview');
    expect(body.activeAlerts).toBe(3);
  });

  it('openIncidents is 3', async () => {
    const { body } = await G('/api/v1/telemetry/overview');
    expect(body.openIncidents).toBe(3);
  });
});

describe('GET /api/v1/telemetry/traces', () => {
  it('returns all 10 traces', async () => {
    const { status, body } = await G('/api/v1/telemetry/traces');
    expect(status).toBe(200);
    expect(body.traces).toHaveLength(10);
    expect(body.total).toBe(10);
  });

  it('filters by service=gateway returns 4', async () => {
    const { body } = await G('/api/v1/telemetry/traces?service=gateway');
    expect(body.traces).toHaveLength(4);
    body.traces.forEach((t: any) => expect(t.rootService).toBe('gateway'));
  });

  it('filters by status=error returns 2', async () => {
    const { body } = await G('/api/v1/telemetry/traces?status=error');
    expect(body.traces).toHaveLength(2);
    body.traces.forEach((t: any) => expect(t.status).toBe('error'));
  });

  it('filters by status=timeout returns 1', async () => {
    const { body } = await G('/api/v1/telemetry/traces?status=timeout');
    expect(body.traces).toHaveLength(1);
  });

  it('limit=3 returns 3 traces', async () => {
    const { body } = await G('/api/v1/telemetry/traces?limit=3');
    expect(body.traces).toHaveLength(3);
  });

  it('traces have spans array', async () => {
    const { body } = await G('/api/v1/telemetry/traces');
    body.traces.forEach((t: any) => expect(Array.isArray(t.spans)).toBe(true));
  });
});

describe('GET /api/v1/telemetry/traces/:id', () => {
  it('returns trace with 3 spans for tr-001', async () => {
    const { status, body } = await G('/api/v1/telemetry/traces/tr-001');
    expect(status).toBe(200);
    expect(body.traceId).toBe('tr-001');
    expect(body.spans).toHaveLength(3);
  });

  it('tr-005 has 6 spans', async () => {
    const { body } = await G('/api/v1/telemetry/traces/tr-005');
    expect(body.spans).toHaveLength(6);
  });

  it('returns 404 for unknown trace', async () => {
    const { status, body } = await G('/api/v1/telemetry/traces/tr-999');
    expect(status).toBe(404);
    expect(body.error.code).toBe('TRACE_NOT_FOUND');
  });
});

describe('GET /api/v1/telemetry/service-map', () => {
  it('returns 8 nodes and edges array', async () => {
    const { status, body } = await G('/api/v1/telemetry/service-map');
    expect(status).toBe(200);
    expect(body.nodes).toHaveLength(8);
    expect(Array.isArray(body.edges)).toBe(true);
  });

  it('all nodes have valid status', async () => {
    const { body } = await G('/api/v1/telemetry/service-map');
    body.nodes.forEach((n: any) => expect(['healthy', 'degraded', 'down']).toContain(n.status));
  });

  it('workflow node is degraded', async () => {
    const { body } = await G('/api/v1/telemetry/service-map');
    const wf = body.nodes.find((n: any) => n.id === 'workflow');
    expect(wf.status).toBe('degraded');
  });
});

// ─── Dashboards ──────────────────────────────────────────────────────────────

describe('GET /api/v1/prometheus/dashboards/:type', () => {
  it('executive has slaUptime >= 99 and monthlyRevenue > 0', async () => {
    const { status, body } = await G('/api/v1/prometheus/dashboards/executive');
    expect(status).toBe(200);
    expect(body.slaUptime).toBeGreaterThanOrEqual(99);
    expect(body.monthlyRevenue).toBeGreaterThan(0);
    expect(body.mttrMinutes).toBeGreaterThan(0);
  });

  it('operations has cpuUsage 0-100 and activeWorkers <= totalWorkers', async () => {
    const { body } = await G('/api/v1/prometheus/dashboards/operations');
    expect(body.cpuUsage).toBeGreaterThan(0);
    expect(body.cpuUsage).toBeLessThanOrEqual(100);
    expect(body.activeWorkers).toBeLessThanOrEqual(body.totalWorkers);
  });

  it('ai has cacheHitRate 0-100 and modelsInUse array', async () => {
    const { body } = await G('/api/v1/prometheus/dashboards/ai');
    expect(body.cacheHitRate).toBeGreaterThan(0);
    expect(body.cacheHitRate).toBeLessThanOrEqual(100);
    expect(Array.isArray(body.modelsInUse)).toBe(true);
    expect(body.modelsInUse.length).toBeGreaterThan(0);
  });

  it('connectors returns array with successRate and avgLatencyMs', async () => {
    const { body } = await G('/api/v1/prometheus/dashboards/connectors');
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    body.forEach((c: any) => {
      expect(c.successRate).toBeGreaterThan(0);
      expect(c.avgLatencyMs).toBeGreaterThan(0);
    });
  });

  it('invalid type returns 400 INVALID_DASHBOARD_TYPE', async () => {
    const { status, body } = await G('/api/v1/prometheus/dashboards/invalid');
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_DASHBOARD_TYPE');
  });
});

// ─── Anomalies ───────────────────────────────────────────────────────────────

describe('GET /api/v1/prometheus/anomalies', () => {
  it('returns all 6 anomalies', async () => {
    const { status, body } = await G('/api/v1/prometheus/anomalies');
    expect(status).toBe(200);
    expect(body.anomalies).toHaveLength(6);
    expect(body.total).toBe(6);
  });

  it('severity=critical returns 2', async () => {
    const { body } = await G('/api/v1/prometheus/anomalies?severity=critical');
    expect(body.anomalies).toHaveLength(2);
    body.anomalies.forEach((a: any) => expect(a.severity).toBe('critical'));
  });

  it('status=active returns 3', async () => {
    const { body } = await G('/api/v1/prometheus/anomalies?status=active');
    expect(body.anomalies).toHaveLength(3);
  });

  it('status=resolved returns 1', async () => {
    const { body } = await G('/api/v1/prometheus/anomalies?status=resolved');
    expect(body.anomalies).toHaveLength(1);
  });

  it('all anomalies have probability 0-100', async () => {
    const { body } = await G('/api/v1/prometheus/anomalies');
    body.anomalies.forEach((a: any) => {
      expect(a.probability).toBeGreaterThan(0);
      expect(a.probability).toBeLessThanOrEqual(100);
    });
  });
});

// ─── Incidents ───────────────────────────────────────────────────────────────

describe('GET /api/v1/prometheus/incidents', () => {
  it('returns all 4 incidents', async () => {
    const { status, body } = await G('/api/v1/prometheus/incidents');
    expect(status).toBe(200);
    expect(body.incidents).toHaveLength(4);
  });

  it('status=investigating returns 2', async () => {
    const { body } = await G('/api/v1/prometheus/incidents?status=investigating');
    expect(body.incidents).toHaveLength(2);
    body.incidents.forEach((i: any) => expect(i.status).toBe('investigating'));
  });

  it('status=open returns 1 (inc-001)', async () => {
    const { body } = await G('/api/v1/prometheus/incidents?status=open');
    expect(body.incidents).toHaveLength(1);
    expect(body.incidents[0].id).toBe('inc-001');
  });

  it('status=resolved returns 1 (inc-004)', async () => {
    const { body } = await G('/api/v1/prometheus/incidents?status=resolved');
    expect(body.incidents).toHaveLength(1);
    expect(body.incidents[0].id).toBe('inc-004');
  });
});

describe('GET /api/v1/prometheus/incidents/:id/timeline', () => {
  it('returns 6 timeline events for inc-001', async () => {
    const { status, body } = await G('/api/v1/prometheus/incidents/inc-001/timeline');
    expect(status).toBe(200);
    expect(body.incidentId).toBe('inc-001');
    expect(body.timeline).toHaveLength(6);
  });

  it('first event type is detection', async () => {
    const { body } = await G('/api/v1/prometheus/incidents/inc-001/timeline');
    expect(body.timeline[0].type).toBe('detection');
  });

  it('events are sorted by timestamp ascending', async () => {
    const { body } = await G('/api/v1/prometheus/incidents/inc-001/timeline');
    for (let i = 1; i < body.timeline.length; i++) {
      expect(body.timeline[i].timestamp >= body.timeline[i - 1].timestamp).toBe(true);
    }
  });

  it('returns 404 for unknown incident', async () => {
    const { status, body } = await G('/api/v1/prometheus/incidents/inc-999/timeline');
    expect(status).toBe(404);
    expect(body.error.code).toBe('INCIDENT_NOT_FOUND');
  });
});

describe('GET /api/v1/prometheus/incidents/:id/rca', () => {
  it('returns 3 hypotheses for inc-001', async () => {
    const { status, body } = await G('/api/v1/prometheus/incidents/inc-001/rca');
    expect(status).toBe(200);
    expect(body.hypotheses).toHaveLength(3);
  });

  it('hypotheses sorted by confidence descending', async () => {
    const { body } = await G('/api/v1/prometheus/incidents/inc-001/rca');
    for (let i = 1; i < body.hypotheses.length; i++) {
      expect(body.hypotheses[i].confidence).toBeLessThanOrEqual(body.hypotheses[i - 1].confidence);
    }
  });

  it('first hypothesis has highest confidence (94)', async () => {
    const { body } = await G('/api/v1/prometheus/incidents/inc-001/rca');
    expect(body.hypotheses[0].confidence).toBe(94);
  });

  it('returns 404 for unknown incident', async () => {
    const { status, body } = await G('/api/v1/prometheus/incidents/inc-999/rca');
    expect(status).toBe(404);
    expect(body.error.code).toBe('INCIDENT_NOT_FOUND');
  });
});

describe('POST /api/v1/prometheus/incidents/:id/resolve', () => {
  it('returns 404 for unknown incident', async () => {
    const { status, body } = await P('/api/v1/prometheus/incidents/inc-999/resolve');
    expect(status).toBe(404);
    expect(body.error.code).toBe('INCIDENT_NOT_FOUND');
  });

  it('returns 400 ALREADY_RESOLVED for inc-004', async () => {
    const { status, body } = await P('/api/v1/prometheus/incidents/inc-004/resolve');
    expect(status).toBe(400);
    expect(body.error.code).toBe('ALREADY_RESOLVED');
  });

  it('resolves inc-001 (open → resolved)', async () => {
    const { status, body } = await P('/api/v1/prometheus/incidents/inc-001/resolve');
    expect(status).toBe(200);
    expect(body.status).toBe('resolved');
    expect(body.resolvedAt).toBeTruthy();
  });

  it('inc-001 returns 400 on re-resolve', async () => {
    const { status, body } = await P('/api/v1/prometheus/incidents/inc-001/resolve');
    expect(status).toBe(400);
    expect(body.error.code).toBe('ALREADY_RESOLVED');
  });
});

// ─── Predictive Alerts & Recommendations ─────────────────────────────────────

describe('GET /api/v1/prometheus/alerts/predictive', () => {
  it('returns 5 predictive alerts', async () => {
    const { status, body } = await G('/api/v1/prometheus/alerts/predictive');
    expect(status).toBe(200);
    expect(body.alerts).toHaveLength(5);
    expect(body.total).toBe(5);
  });

  it('type=disk returns 2', async () => {
    const { body } = await G('/api/v1/prometheus/alerts/predictive?type=disk');
    expect(body.alerts).toHaveLength(2);
    body.alerts.forEach((a: any) => expect(a.type).toBe('disk'));
  });

  it('type=memory returns 2', async () => {
    const { body } = await G('/api/v1/prometheus/alerts/predictive?type=memory');
    expect(body.alerts).toHaveLength(2);
  });

  it('all alerts have predictedFailureInDays > 0', async () => {
    const { body } = await G('/api/v1/prometheus/alerts/predictive');
    body.alerts.forEach((a: any) => expect(a.predictedFailureInDays).toBeGreaterThan(0));
  });
});

describe('GET /api/v1/prometheus/recommendations', () => {
  it('returns 7 total recommendations', async () => {
    const { status, body } = await G('/api/v1/prometheus/recommendations');
    expect(status).toBe(200);
    expect(body.recommendations).toHaveLength(7);
    expect(body.total).toBe(7);
  });

  it('category=performance returns 3', async () => {
    const { body } = await G('/api/v1/prometheus/recommendations?category=performance');
    expect(body.recommendations).toHaveLength(3);
  });

  it('status=pending returns 5', async () => {
    const { body } = await G('/api/v1/prometheus/recommendations?status=pending');
    expect(body.recommendations).toHaveLength(5);
  });

  it('status=applied returns 1 (rec-006)', async () => {
    const { body } = await G('/api/v1/prometheus/recommendations?status=applied');
    expect(body.recommendations).toHaveLength(1);
    expect(body.recommendations[0].id).toBe('rec-006');
  });
});

describe('POST /api/v1/prometheus/recommendations/:id/apply', () => {
  it('returns 404 for unknown recommendation', async () => {
    const { status, body } = await P('/api/v1/prometheus/recommendations/rec-999/apply');
    expect(status).toBe(404);
    expect(body.error.code).toBe('RECOMMENDATION_NOT_FOUND');
  });

  it('returns 400 ALREADY_APPLIED for rec-006', async () => {
    const { status, body } = await P('/api/v1/prometheus/recommendations/rec-006/apply');
    expect(status).toBe(400);
    expect(body.error.code).toBe('ALREADY_APPLIED');
  });

  it('applies rec-001 (pending → applied)', async () => {
    const { status, body } = await P('/api/v1/prometheus/recommendations/rec-001/apply');
    expect(status).toBe(200);
    expect(body.status).toBe('applied');
    expect(body.appliedAt).toBeTruthy();
  });

  it('rec-001 returns 400 on re-apply', async () => {
    const { status, body } = await P('/api/v1/prometheus/recommendations/rec-001/apply');
    expect(status).toBe(400);
    expect(body.error.code).toBe('ALREADY_APPLIED');
  });
});

describe('POST /api/v1/prometheus/recommendations/:id/dismiss', () => {
  it('returns 404 for unknown recommendation', async () => {
    const { status, body } = await P('/api/v1/prometheus/recommendations/rec-999/dismiss');
    expect(status).toBe(404);
    expect(body.error.code).toBe('RECOMMENDATION_NOT_FOUND');
  });

  it('returns 400 ALREADY_DISMISSED for rec-007', async () => {
    const { status, body } = await P('/api/v1/prometheus/recommendations/rec-007/dismiss');
    expect(status).toBe(400);
    expect(body.error.code).toBe('ALREADY_DISMISSED');
  });

  it('dismisses rec-002 (pending → dismissed)', async () => {
    const { status, body } = await P('/api/v1/prometheus/recommendations/rec-002/dismiss');
    expect(status).toBe(200);
    expect(body.status).toBe('dismissed');
  });
});

// ─── Self-Healing ─────────────────────────────────────────────────────────────

describe('GET /api/v1/prometheus/self-healing', () => {
  it('returns 5 rules with enabled=3', async () => {
    const { status, body } = await G('/api/v1/prometheus/self-healing');
    expect(status).toBe(200);
    expect(body.rules).toHaveLength(5);
    expect(body.total).toBe(5);
    expect(body.enabled).toBe(3);
  });
});

describe('POST /api/v1/prometheus/self-healing/:id/toggle', () => {
  it('returns 404 for unknown rule', async () => {
    const { status, body } = await P('/api/v1/prometheus/self-healing/heal-999/toggle');
    expect(status).toBe(404);
    expect(body.error.code).toBe('RULE_NOT_FOUND');
  });

  it('toggles heal-004 disabled → enabled', async () => {
    const { status, body } = await P('/api/v1/prometheus/self-healing/heal-004/toggle');
    expect(status).toBe(200);
    expect(body.enabled).toBe(true);
  });

  it('toggles heal-004 enabled → disabled', async () => {
    const { status, body } = await P('/api/v1/prometheus/self-healing/heal-004/toggle');
    expect(status).toBe(200);
    expect(body.enabled).toBe(false);
  });
});

// ─── SLO ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/prometheus/slo', () => {
  it('returns 4 SLO targets', async () => {
    const { status, body } = await G('/api/v1/prometheus/slo');
    expect(status).toBe(200);
    expect(body.targets).toHaveLength(4);
    expect(body.total).toBe(4);
  });

  it('status=healthy returns 2', async () => {
    const { body } = await G('/api/v1/prometheus/slo?status=healthy');
    expect(body.targets).toHaveLength(2);
  });

  it('status=at_risk returns 1', async () => {
    const { body } = await G('/api/v1/prometheus/slo?status=at_risk');
    expect(body.targets).toHaveLength(1);
  });

  it('status=breached returns 1 (tenant-developer)', async () => {
    const { body } = await G('/api/v1/prometheus/slo?status=breached');
    expect(body.targets).toHaveLength(1);
    expect(body.targets[0].tenantId).toBe('tenant-developer');
  });

  it('scoped caller (tenant-enterprise) sees only their own SLO target', async () => {
    const { body } = await G('/api/v1/prometheus/slo', 'tenant-enterprise');
    expect(body.targets).toHaveLength(1);
    expect(body.targets[0].tenantId).toBe('tenant-enterprise');
  });

  it('scoped caller cannot see other tenants by passing a forged tenantId query param', async () => {
    const { body } = await G(
      '/api/v1/prometheus/slo?tenantId=tenant-developer',
      'tenant-enterprise'
    );
    expect(body.targets).toHaveLength(1);
    expect(body.targets[0].tenantId).toBe('tenant-enterprise');
  });

  it('all targets have errorBudgetMinutes > 0', async () => {
    const { body } = await G('/api/v1/prometheus/slo');
    body.targets.forEach((t: any) => expect(t.errorBudgetMinutes).toBeGreaterThan(0));
  });
});

// ─── Capacity & Costs ────────────────────────────────────────────────────────

describe('GET /api/v1/prometheus/capacity', () => {
  it('returns plan with 5 forecasts', async () => {
    const { status, body } = await G('/api/v1/prometheus/capacity');
    expect(status).toBe(200);
    expect(body.forecasts).toHaveLength(5);
    expect(body.forecastedClients6m).toBeGreaterThan(body.currentClients);
    expect(body.forecastedClients12m).toBeGreaterThan(body.forecastedClients6m);
  });

  it('Workers forecast has urgency=high', async () => {
    const { body } = await G('/api/v1/prometheus/capacity');
    const workers = body.forecasts.find((f: any) => f.resource === 'Workers');
    expect(workers).toBeDefined();
    expect(workers.urgency).toBe('high');
  });

  it('all forecasts have recommendedAddition string', async () => {
    const { body } = await G('/api/v1/prometheus/capacity');
    body.forecasts.forEach((f: any) => expect(typeof f.recommendedAddition).toBe('string'));
  });
});

describe('GET /api/v1/prometheus/costs', () => {
  it('returns report with 4 tenants and positive margin', async () => {
    const { status, body } = await G('/api/v1/prometheus/costs');
    expect(status).toBe(200);
    expect(body.tenants).toHaveLength(4);
    expect(body.totalRevenue).toBeGreaterThan(body.totalPlatformCost);
    expect(body.margin).toBeGreaterThan(0);
  });

  it('all tenants have totalCost > 0', async () => {
    const { body } = await G('/api/v1/prometheus/costs');
    body.tenants.forEach((t: any) => expect(t.totalCost).toBeGreaterThan(0));
  });

  it('scoped caller (tenant-enterprise) sees only their own cost report', async () => {
    const { body } = await G('/api/v1/prometheus/costs', 'tenant-enterprise');
    expect(body.tenants).toHaveLength(1);
    expect(body.tenants[0].tenantId).toBe('tenant-enterprise');
  });

  it('scoped caller cannot see other tenants by passing a forged tenantId query param', async () => {
    const { body } = await G(
      '/api/v1/prometheus/costs?tenantId=tenant-startup',
      'tenant-enterprise'
    );
    expect(body.tenants).toHaveLength(1);
    expect(body.tenants[0].tenantId).toBe('tenant-enterprise');
  });

  it('topWorkflows is non-empty array', async () => {
    const { body } = await G('/api/v1/prometheus/costs');
    expect(Array.isArray(body.topWorkflows)).toBe(true);
    expect(body.topWorkflows.length).toBeGreaterThan(0);
  });
});

// ─── Runbooks ────────────────────────────────────────────────────────────────

describe('GET /api/v1/prometheus/runbooks', () => {
  it('returns 5 runbooks', async () => {
    const { status, body } = await G('/api/v1/prometheus/runbooks');
    expect(status).toBe(200);
    expect(body.runbooks).toHaveLength(5);
    expect(body.total).toBe(5);
  });

  it('mode=automatic returns 2', async () => {
    const { body } = await G('/api/v1/prometheus/runbooks?mode=automatic');
    expect(body.runbooks).toHaveLength(2);
    body.runbooks.forEach((r: any) => expect(r.mode).toBe('automatic'));
  });

  it('mode=manual returns 1', async () => {
    const { body } = await G('/api/v1/prometheus/runbooks?mode=manual');
    expect(body.runbooks).toHaveLength(1);
  });

  it('all runbooks have steps with at least 1 step', async () => {
    const { body } = await G('/api/v1/prometheus/runbooks');
    body.runbooks.forEach((r: any) => {
      expect(Array.isArray(r.steps)).toBe(true);
      expect(r.steps.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('GET /api/v1/prometheus/runbooks/:id', () => {
  it('returns rb-001 with 6 steps', async () => {
    const { status, body } = await G('/api/v1/prometheus/runbooks/rb-001');
    expect(status).toBe(200);
    expect(body.id).toBe('rb-001');
    expect(body.steps).toHaveLength(6);
  });

  it('returns 404 for unknown runbook', async () => {
    const { status, body } = await G('/api/v1/prometheus/runbooks/rb-999');
    expect(status).toBe(404);
    expect(body.error.code).toBe('RUNBOOK_NOT_FOUND');
  });
});

describe('POST /api/v1/prometheus/runbooks/:id/execute', () => {
  it('returns 404 for unknown runbook', async () => {
    const { status, body } = await P('/api/v1/prometheus/runbooks/rb-999/execute');
    expect(status).toBe(404);
    expect(body.error.code).toBe('RUNBOOK_NOT_FOUND');
  });

  it('increments executionCount for rb-005', async () => {
    const { body: before } = await G('/api/v1/prometheus/runbooks/rb-005');
    const prevCount = before.executionCount;
    const { status, body } = await P('/api/v1/prometheus/runbooks/rb-005/execute');
    expect(status).toBe(200);
    expect(body.executionCount).toBe(prevCount + 1);
    expect(body.lastUsedAt).toBeTruthy();
  });
});

// ─── Copilot ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/prometheus/copilot', () => {
  it('returns 400 MISSING_QUESTION when question is absent', async () => {
    const { status, body } = await P('/api/v1/prometheus/copilot', {});
    expect(status).toBe(400);
    expect(body.error.code).toBe('MISSING_QUESTION');
  });

  it('returns answer with sources and confidence for SLA question', async () => {
    const { status, body } = await P('/api/v1/prometheus/copilot', {
      question: 'Por que houve queda no SLA hoje?',
    });
    expect(status).toBe(200);
    expect(typeof body.answer).toBe('string');
    expect(body.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.confidence).toBeGreaterThan(0);
    expect(body.confidence).toBeLessThanOrEqual(100);
  });

  it('returns relatedMetrics array for cost question', async () => {
    const { status, body } = await P('/api/v1/prometheus/copilot', {
      question: 'Quanto custaram as integrações este mês?',
    });
    expect(status).toBe(200);
    expect(Array.isArray(body.relatedMetrics)).toBe(true);
    expect(body.relatedMetrics.length).toBeGreaterThan(0);
  });

  it('returns generatedAt timestamp', async () => {
    const { body } = await P('/api/v1/prometheus/copilot', {
      question: 'Qual agent está sobrecarregado?',
    });
    expect(body.generatedAt).toBeTruthy();
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });
});
