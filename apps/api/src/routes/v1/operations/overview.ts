import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { healthEngine } from '../../../modules/operations/health-engine.js';
import { operationsStore } from '../../../modules/operations/operations-store.js';

export function registerOperationsOverviewRoute(router: { get: Function }): void {
  router.get('/api/v1/operations/overview', (_ctx: RouteContext, res: ServerResponse) => {
    const tenants = healthEngine.getAllTenantHealth();
    const allMetrics = operationsStore.getMetrics();
    const openAlerts = operationsStore.getAlerts(undefined, { resolved: false });
    const slaToday = operationsStore.getSlaHistory(undefined, 'today');

    const agentsOnline = tenants.reduce(
      (n, t) =>
        n + t.checks.filter((c) => c.componentType === 'agent' && c.status === 'healthy').length,
      0
    );
    const agentsOffline = tenants.reduce(
      (n, t) =>
        n +
        t.checks.filter(
          (c) => c.componentType === 'agent' && (c.status === 'offline' || c.status === 'critical')
        ).length,
      0
    );
    const connectorsActive = tenants.reduce(
      (n, t) =>
        n +
        t.checks.filter((c) => c.componentType === 'connector' && c.status === 'healthy').length,
      0
    );

    const totalJobs = allMetrics
      .filter((m) => m.metric === 'jobs_executed')
      .reduce((s, m) => s + m.value, 0);
    const totalHeartbeats = allMetrics
      .filter((m) => m.metric === 'heartbeats_per_min')
      .reduce((s, m) => s + m.value, 0);
    const totalFailures = allMetrics
      .filter((m) => m.metric === 'failures')
      .reduce((s, m) => s + m.value, 0);

    const avgAvailability = allMetrics
      .filter((m) => m.metric === 'availability')
      .reduce((acc, m, _, arr) => acc + m.value / arr.length, 0);
    const slaCompliant = slaToday.filter((s) => s.met).length;

    json(res, {
      totalTenants: tenants.length,
      agentsOnline,
      agentsOffline,
      connectorsActive,
      errorsToday: totalFailures,
      jobsExecuted: totalJobs,
      heartbeatsPerMin: totalHeartbeats,
      availability: Math.round(avgAvailability * 100) / 100,
      slaCompliant,
      openAlerts: openAlerts.length,
      criticalAlerts: openAlerts.filter((a) => a.severity === 'critical').length,
      tenants,
    });
  });
}
