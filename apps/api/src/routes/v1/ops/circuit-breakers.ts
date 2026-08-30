import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { titanStore } from '../../../modules/titan/titan-store.js';

export function registerCircuitBreakersRoutes(router: Router): void {
  // GET /api/v1/ops/circuit-breakers
  router.get(
    '/api/v1/ops/circuit-breakers',
    requirePermission('ops.read')(async (_ctx: RouteContext, res: ServerResponse) => {
      const circuits = titanStore.circuits.list();
      json(res, { circuits, total: circuits.length });
    })
  );

  // POST /api/v1/ops/circuit-breakers/:name/reset
  router.post(
    '/api/v1/ops/circuit-breakers/:name/reset',
    requirePermission('ops.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const name = ctx.params['name'];
      const ok = titanStore.circuits.reset(name);
      if (!ok) return apiError(res, `Circuit '${name}' not found`, 404, 'CIRCUIT_NOT_FOUND');
      json(res, { reset: true, name, state: 'CLOSED' });
    })
  );
}
