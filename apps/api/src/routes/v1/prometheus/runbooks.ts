import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { prometheusStore } from '../../../modules/prometheus/prometheus-store.js';

export function registerRunbookRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/prometheus/runbooks', (ctx: RouteContext, res: ServerResponse) => {
    const mode = ctx.query.get('mode') ?? undefined;
    const trigger = ctx.query.get('trigger') ?? undefined;
    const runbooks = prometheusStore.getRunbooks({ mode, trigger });
    json(res, { runbooks, total: runbooks.length });
  });

  router.get('/api/v1/prometheus/runbooks/:id', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params?.id as string;
    const runbook = prometheusStore.getRunbookById(id);
    if (!runbook) return apiError(res, 'Runbook not found', 404, 'RUNBOOK_NOT_FOUND');
    json(res, runbook);
  });

  router.post(
    '/api/v1/prometheus/runbooks/:id/execute',
    (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const runbook = prometheusStore.executeRunbook(id);
      if (!runbook) return apiError(res, 'Runbook not found', 404, 'RUNBOOK_NOT_FOUND');
      json(res, runbook);
    }
  );
}
