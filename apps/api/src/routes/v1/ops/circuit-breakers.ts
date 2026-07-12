import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { titanStore } from '../../../modules/titan/titan-store.js';

export function registerCircuitBreakersRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  // GET /api/v1/ops/circuit-breakers
  router.get('/api/v1/ops/circuit-breakers', (_ctx: RouteContext, res: ServerResponse) => {
    const circuits = titanStore.circuits.list();
    json(res, { circuits, total: circuits.length });
  });

  // POST /api/v1/ops/circuit-breakers/:name/reset
  router.post(
    '/api/v1/ops/circuit-breakers/:name/reset',
    (ctx: RouteContext, res: ServerResponse) => {
      const name = ctx.params['name']!;
      const ok = titanStore.circuits.reset(name);
      if (!ok) return apiError(res, `Circuit '${name}' not found`, 404, 'CIRCUIT_NOT_FOUND');
      json(res, { reset: true, name, state: 'CLOSED' });
    }
  );
}
