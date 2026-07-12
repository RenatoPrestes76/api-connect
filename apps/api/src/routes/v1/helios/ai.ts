import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';

export function registerEventAIRoutes(router: { get: Function }): void {
  router.get('/api/v1/helios/ai/insights', (ctx: RouteContext, res: ServerResponse) => {
    const type = ctx.query.get('type') ?? undefined;
    const insights = heliosStore.getAIInsights({ type });
    json(res, { insights, total: insights.length });
  });

  router.get('/api/v1/helios/ai/forecast', (ctx: RouteContext, res: ServerResponse) => {
    const topicId = ctx.query.get('topicId') ?? undefined;
    const forecasts = heliosStore.getForecasts({ topicId });
    json(res, { forecasts, total: forecasts.length });
  });
}
