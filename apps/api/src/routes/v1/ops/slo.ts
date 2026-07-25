import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { titanStore } from '../../../modules/titan/titan-store.js';

export function registerSloRoutes(router: Router): void {
  // GET /api/v1/ops/slo
  router.get('/api/v1/ops/slo', async (_ctx: RouteContext, res: ServerResponse) => {
    const slos = titanStore.listSlos();
    const compliant = slos.filter((s) => s.status === 'compliant').length;
    const warning = slos.filter((s) => s.status === 'warning').length;
    const breached = slos.filter((s) => s.status === 'breached').length;
    json(res, {
      slos,
      summary: { compliant, warning, breached, total: slos.length },
    });
  });

  // GET /api/v1/ops/slo/:id
  router.get('/api/v1/ops/slo/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const slo = titanStore.getSlo(ctx.params['id']!);
    if (!slo) return apiError(res, 'SLO not found', 404, 'SLO_NOT_FOUND');
    json(res, slo);
  });
}
