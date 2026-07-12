import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
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

export function registerHealthRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  router.get('/api/v1/ops/health', async (_ctx: RouteContext, res: ServerResponse) => {
    const report = await checker.run();
    const status = report.status === 'unhealthy' ? 503 : report.status === 'degraded' ? 207 : 200;
    json(res, report, status);
  });

  router.get('/api/v1/ops/ready', async (_ctx: RouteContext, res: ServerResponse) => {
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
  });
}
