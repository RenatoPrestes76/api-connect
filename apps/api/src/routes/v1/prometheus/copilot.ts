import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { prometheusStore } from '../../../modules/prometheus/prometheus-store.js';

export function registerCopilotRoutes(router: { post: Function }): void {
  router.post('/api/v1/prometheus/copilot', async (ctx: RouteContext, res: ServerResponse) => {
    const body = ctx.body as { question?: string } | undefined;
    const question = body?.question?.trim();
    if (!question) return apiError(res, 'question is required', 400, 'MISSING_QUESTION');
    json(res, prometheusStore.queryCopilot(question));
  });
}
