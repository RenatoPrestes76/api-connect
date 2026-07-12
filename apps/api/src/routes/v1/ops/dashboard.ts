import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { titanStore } from '../../../modules/titan/titan-store.js';

export function registerDashboardRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  router.get('/api/v1/ops/dashboard', (_ctx: RouteContext, res: ServerResponse) => {
    const slos = titanStore.listSlos();
    const queueStats = titanStore.getQueueStats();
    const circuits = titanStore.circuits.list();
    const backups = titanStore.listBackups();
    const flags = titanStore.listFlags();

    const compliantSlos = slos.filter((s) => s.status === 'compliant').length;
    const openCircuits = circuits.filter((c) => c.state === 'OPEN').length;
    const recentBackup = backups.find((b) => b.status === 'completed') ?? null;

    json(res, {
      kpis: {
        sloCompliance: { value: compliantSlos, total: slos.length, unit: 'compliant' },
        openCircuits: { value: openCircuits, total: circuits.length, unit: 'open' },
        queueDepth: {
          value: queueStats.high + queueStats.normal + queueStats.low,
          dlq: queueStats.dlq,
        },
        featureFlags: { enabled: flags.filter((f) => f.enabled).length, total: flags.length },
        lastBackup: recentBackup
          ? {
              completedAt: recentBackup.completedAt,
              type: recentBackup.type,
              region: recentBackup.region,
            }
          : null,
      },
      slos: slos.map((s) => ({
        id: s.id,
        name: s.name,
        target: s.target,
        current: s.current,
        unit: s.unit,
        status: s.status,
        errorBudgetPercent: s.errorBudgetPercent,
      })),
      circuitBreakers: circuits.map((c) => ({
        name: c.name,
        state: c.state,
        failures: c.failures,
        totalRequests: c.totalRequests,
      })),
      queues: queueStats,
      generatedAt: new Date().toISOString(),
    });
  });
}
