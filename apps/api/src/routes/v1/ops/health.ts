import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { HealthChecker, makeSimulatedCheck } from '@seltriva/titan';
import { titanStore } from '../../../modules/titan/titan-store.js';

const checker = new HealthChecker();
checker.register(
  'database',
  makeSimulatedCheck('database', 2, 'healthy', 'PostgreSQL primary reachable')
);
checker.register('redis', makeSimulatedCheck('redis', 1, 'healthy', 'Redis cluster responding'));
checker.register(
  'queue-worker',
  makeSimulatedCheck('queue-worker', 1, 'healthy', 'Worker pool active')
);
checker.register(
  'object-storage',
  makeSimulatedCheck('object-storage', 3, 'healthy', 'S3-compatible storage OK')
);
checker.register(
  'external-erp',
  makeSimulatedCheck('external-erp', 5, 'degraded', 'Response time elevated: 420ms avg')
);

/**
 * ATLAS 46.27 — these are the ops-domain infrastructure-dependency checks
 * (database/redis/queue-worker/object-storage/external-erp), a distinct
 * surface from the platform's own top-level `/health`/`/ready`
 * (PUBLIC_PATHS, used by Render's container healthcheck) — gating these
 * behind `ops.read` does not affect that unauthenticated liveness check.
 */
export function registerHealthRoutes(router: Router): void {
  router.get(
    '/api/v1/ops/health',
    requirePermission('ops.read')(async (_ctx: RouteContext, res: ServerResponse) => {
      const report = await checker.run();
      const status = report.status === 'unhealthy' ? 503 : report.status === 'degraded' ? 207 : 200;
      json(res, report, status);
    })
  );

  router.get(
    '/api/v1/ops/ready',
    requirePermission('ops.read')(async (_ctx: RouteContext, res: ServerResponse) => {
      const circuits = titanStore.circuits.list();
      const openCircuits = circuits.filter((c) => c.state === 'OPEN');
      const ready = openCircuits.length === 0;
      json(
        res,
        {
          ready,
          openCircuits: openCircuits.map((c) => c.name),
          checkedAt: new Date().toISOString(),
        },
        ready ? 200 : 503
      );
    })
  );
}
