import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { prometheusStore } from '../../../modules/prometheus/prometheus-store.js';

export function registerRecommendationRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/prometheus/alerts/predictive', (ctx: RouteContext, res: ServerResponse) => {
    const type = ctx.query.get('type') ?? undefined;
    const alerts = prometheusStore.getPredictiveAlerts({ type });
    json(res, { alerts, total: alerts.length });
  });

  router.get('/api/v1/prometheus/recommendations', (ctx: RouteContext, res: ServerResponse) => {
    const category = ctx.query.get('category') ?? undefined;
    const status = ctx.query.get('status') ?? undefined;
    const recs = prometheusStore.getRecommendations({ category, status });
    json(res, { recommendations: recs, total: recs.length });
  });

  router.post(
    '/api/v1/prometheus/recommendations/:id/apply',
    (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const result = prometheusStore.applyRecommendation(id);
      if (result === null)
        return apiError(res, 'Recommendation not found', 404, 'RECOMMENDATION_NOT_FOUND');
      if (result === 'already_applied')
        return apiError(res, 'Recommendation already applied', 400, 'ALREADY_APPLIED');
      json(res, result);
    }
  );

  router.post(
    '/api/v1/prometheus/recommendations/:id/dismiss',
    (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const result = prometheusStore.dismissRecommendation(id);
      if (result === null)
        return apiError(res, 'Recommendation not found', 404, 'RECOMMENDATION_NOT_FOUND');
      if (result === 'already_dismissed')
        return apiError(res, 'Recommendation already dismissed', 400, 'ALREADY_DISMISSED');
      json(res, result);
    }
  );
}
