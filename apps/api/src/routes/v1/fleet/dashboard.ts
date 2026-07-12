import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { fleetOpsStore } from '../../../modules/fleet-ops/fleet-ops-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

export function registerFleetDashboardRoutes(router: { get: Function }): void {
  // GET /admin/fleet — Fleet Dashboard overview
  router.get(
    '/admin/fleet',
    requirePermission('dashboard.view')(async (_ctx: RouteContext, res: ServerResponse) => {
      json(res, fleetOpsStore.getFleetOverview());
    })
  );

  // GET /admin/fleet/metrics — flat metrics summary, shaped for future observability tooling
  router.get(
    '/admin/fleet/metrics',
    requirePermission('dashboard.view')(async (_ctx: RouteContext, res: ServerResponse) => {
      const overview = fleetOpsStore.getFleetOverview();
      json(res, {
        metrics: [
          { name: 'fleet_runtimes_total', value: overview.runtimesTotal },
          { name: 'fleet_runtimes_online', value: overview.runtimesOnline },
          { name: 'fleet_runtimes_offline', value: overview.runtimesOffline },
          { name: 'fleet_runtimes_degraded', value: overview.runtimesDegraded },
          { name: 'fleet_cpu_avg_pct', value: overview.avgCpuPct },
          { name: 'fleet_mem_avg_pct', value: overview.avgMemPct },
          { name: 'fleet_disk_avg_pct', value: overview.avgDiskPct },
          { name: 'fleet_latency_avg_ms', value: overview.avgLatencyMs },
          { name: 'fleet_alerts_active', value: overview.alertsActive },
          { name: 'fleet_alerts_critical', value: overview.alertsCritical },
        ],
      });
    })
  );
}
