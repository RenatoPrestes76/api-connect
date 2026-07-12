import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { chaosRunner } from '../../../modules/chaos/chaos-runner.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { ChaosScenarioType } from '../../../modules/chaos/types.js';

const VALID_SCENARIOS: ChaosScenarioType[] = [
  'node_failure_election',
  'backup_restore_cycle',
  'load_balancer_failover',
  'deployment_rollback',
  'region_failover',
  'autoscaler_load_spike',
];

export function registerChaosRoutes(router: { get: Function; post: Function }): void {
  router.get(
    '/admin/chaos/history',
    requirePermission('settings.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const limit = Math.min(parseInt(ctx.query.get('limit') ?? '50', 10), 200);
      const history = chaosRunner.getHistory(limit);
      json(res, { history, total: history.length });
    })
  );

  router.post(
    '/admin/chaos/run/:type',
    requirePermission('settings.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const type = ctx.params?.type as string;
      if (!VALID_SCENARIOS.includes(type as ChaosScenarioType)) {
        return apiError(
          res,
          `type must be one of: ${VALID_SCENARIOS.join(', ')}`,
          400,
          'INVALID_SCENARIO'
        );
      }
      const result = await chaosRunner.run(type as ChaosScenarioType);
      adminIdentityStore.recordAudit({
        action: 'RUN_CHAOS_SCENARIO',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.id,
        metadata: { type, passed: result.passed },
      });
      json(res, result, 201);
    })
  );

  router.post(
    '/admin/chaos/run-all',
    requirePermission('settings.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const suite = await chaosRunner.runAll();
      adminIdentityStore.recordAudit({
        action: 'RUN_CHAOS_SCENARIO',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: suite.id,
        metadata: { total: suite.total, passed: suite.passed, failed: suite.failed },
      });
      json(res, suite, 201);
    })
  );
}
