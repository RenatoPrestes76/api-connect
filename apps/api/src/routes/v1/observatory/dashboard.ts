import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { observatoryStore } from '../../../modules/observatory/observatory-store.js';
import type {
  ComponentHealth,
  ExecutiveDashboard,
  SystemHealth,
} from '../../../modules/observatory/types.js';

export async function getDashboard(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const store = observatoryStore;
  const latest = store.latestMetric();
  const trend = store.metrics.slice(-48); // last 4h (48 × 5min)

  const components: ComponentHealth[] = [
    {
      component: 'Workflow Engine',
      status: store.openIncidents().length > 0 ? 'degraded' : 'healthy',
      latencyMs: latest?.avgDurationMs ?? 0,
      uptimePct: 99.97,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'Queue',
      status: (latest?.queueDepth ?? 0) > 50 ? 'degraded' : 'healthy',
      latencyMs: 4,
      uptimePct: 100,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'Event Bus',
      status: 'healthy',
      latencyMs: 1,
      uptimePct: 100,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'Connectors',
      status: store.openIncidents().some((i) => i.title.toLowerCase().includes('connector'))
        ? 'unhealthy'
        : 'healthy',
      latencyMs: 22,
      uptimePct: 99.91,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'Agents',
      status: (latest?.agentsOnline ?? 0) === 0 ? 'unhealthy' : 'healthy',
      latencyMs: 8,
      uptimePct: 99.85,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'API Gateway',
      status: 'healthy',
      latencyMs: 3,
      uptimePct: 99.99,
      lastChecked: new Date().toISOString(),
    },
  ];

  const dashboard: ExecutiveDashboard = {
    integrationsActive: 243,
    workflowsTotal: 1_189,
    executionsToday: 4_182_331,
    avgDurationMs: latest?.avgDurationMs ?? 1_200,
    availabilityPct: 99.98,
    failurePct: latest ? 100 - latest.successRate : 0.02,
    alertsOpen: store.unacknowledgedAlerts().length,
    incidentsOpen: store.openIncidents().length,
    slaBreachesToday: store.slaBreachesToday(),
    throughputPerMin: latest?.executionsPerMinute ?? 0,
    trend,
    componentHealth: components,
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dashboard));
}

export async function getHealth(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const store = observatoryStore;
  const latest = store.latestMetric();
  const openInc = store.openIncidents();

  const components: ComponentHealth[] = [
    {
      component: 'Workflow Engine',
      status: openInc.length > 0 ? 'degraded' : 'healthy',
      latencyMs: latest?.avgDurationMs,
      uptimePct: 99.97,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'Queue',
      status: (latest?.queueDepth ?? 0) > 50 ? 'degraded' : 'healthy',
      latencyMs: 4,
      uptimePct: 100,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'Event Bus',
      status: 'healthy',
      latencyMs: 1,
      uptimePct: 100,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'Connectors',
      status: openInc.some((i) => i.title.toLowerCase().includes('connector'))
        ? 'unhealthy'
        : 'healthy',
      latencyMs: 22,
      uptimePct: 99.91,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'Agents',
      status: (latest?.agentsOnline ?? 0) === 0 ? 'unhealthy' : 'healthy',
      latencyMs: 8,
      uptimePct: 99.85,
      lastChecked: new Date().toISOString(),
    },
    {
      component: 'API Gateway',
      status: 'healthy',
      latencyMs: 3,
      uptimePct: 99.99,
      lastChecked: new Date().toISOString(),
    },
  ];

  const overall = components.some((c) => c.status === 'unhealthy')
    ? 'unhealthy'
    : components.some((c) => c.status === 'degraded')
      ? 'degraded'
      : 'healthy';

  const health: SystemHealth = {
    overall,
    uptimeSeconds: store.uptimeSeconds(),
    components,
    checkedAt: new Date().toISOString(),
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(health));
}
